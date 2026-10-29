import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createEngine, createField, HYMNE, PALETTE } from '../src/core/index.js';

const engine = createEngine(readFileSync(new URL('../fonts/DFB_SANS_VAR_Italic.ttf', import.meta.url)));
const base = { ...HYMNE.params };
const weightsOf = (m) => m.lines.flatMap((l) => l.runs.flatMap((r) => r.glyphs.map((g) => g.weight)));

test('font: DFB SANS VAR italic, wght 75–1000, four named styles', () => {
  assert.equal(engine.font.familyCSS, 'DFB SANS VAR');
  assert.deepEqual(engine.font.axis, { min: 75, max: 1000, default: 400 });
  assert.deepEqual(engine.font.namedInstances.map((i) => i.wght), [145, 400, 650, 925]);
});

test('font: word space follows the weight (fontTools reference values)', () => {
  // instancer: 241 @145, 224 @537, 195 @925 (rounded; fontkit rounds each delta, so ±1 unit)
  const sp = (w) => engine.font.run(' ', w)[0].advance;
  assert.ok(Math.abs(sp(145) - 241) <= 1);
  assert.ok(Math.abs(sp(537) - 224) <= 1);
  assert.ok(Math.abs(sp(925) - 195) <= 1);
});

test('field: values stay in 0..1, reverse and steps map weights', () => {
  const f = createField(base.field, 1920, 1080);
  for (let i = 0; i < 200; i++) {
    const v = f(Math.random() * 1920, Math.random() * 1080);
    assert.ok(v >= 0 && v <= 1);
  }
  const m = engine.layout({ ...base, steps: 4 });
  const allowed = [145, 430, 715, 1000];
  for (const w of weightsOf(m)) assert.ok(allowed.some((a) => Math.abs(a - w) <= 1), `weight ${w} not on a step`);
});

test('layout: weights stay inside min/max and the full range is used', () => {
  for (const unit of ['line', 'word', 'letter']) {
    const ws = weightsOf(engine.layout({ ...base, unit, minWeight: 200, maxWeight: 800 }));
    assert.ok(Math.min(...ws) >= 200 && Math.max(...ws) <= 800, unit);
    assert.ok(Math.max(...ws) - Math.min(...ws) > 500, unit + ' uses the range');
  }
});

test('layout: line = one weight per row, word = one per word, letter varies inside words', () => {
  const line = engine.layout({ ...base, unit: 'line' });
  for (const l of line.lines) assert.equal(new Set(l.runs.flatMap((r) => r.glyphs.map((g) => g.weight))).size, 1);
  const word = engine.layout({ ...base, unit: 'word' });
  for (const l of word.lines) for (const r of l.runs) assert.equal(new Set(r.glyphs.map((g) => g.weight)).size, 1);
  const letter = engine.layout({ ...base, unit: 'letter', field: { ...base.field, angle: 0, bands: 6 } });
  const varying = letter.lines.flatMap((l) => l.runs).filter((r) => new Set(r.glyphs.map((g) => g.weight)).size > 1);
  assert.ok(varying.length > 10);
});

test('layout: rows are straight and left-aligned, ragged right inside the column', () => {
  const m = engine.layout(base);
  const step = m.lines[1].baseline - m.lines[0].baseline;
  m.lines.forEach((l, i) => {
    assert.ok(Math.abs(l.baseline - (m.lines[0].baseline + i * step)) < 1e-6);
    assert.equal(l.runs[0].x, base.boxX);
    const last = l.runs[l.runs.length - 1];
    const g = last.glyphs[last.glyphs.length - 1];
    assert.ok(g.x <= base.boxX + base.boxWidth, 'row stays inside the column');
  });
  assert.ok(m.lines.at(-1).baseline - base.fontSize <= base.height, 'stops at the frame');
});

test('layout: text from one word to a passage; repeat count; line breaks', () => {
  const one = engine.layout({ ...base, text: 'Mannschaft', repeat: 'count', repeatCount: 3 });
  assert.deepEqual(one.lines.flatMap((l) => l.runs.map((r) => r.text)), ['MANNSCHAFT', 'MANNSCHAFT', 'MANNSCHAFT']);
  const breaks = engine.layout({ ...base, text: 'Eins\nZwei', keepLineBreaks: true, repeat: 'count', repeatCount: 1 });
  assert.deepEqual(breaks.lines.map((l) => l.runs.map((r) => r.text).join(' ')), ['EINS', 'ZWEI']);
  const fill = engine.layout({ ...base, text: 'Ja' });
  assert.ok(fill.lines.length > 20);
  assert.equal(engine.layout({ ...base, text: '   ' }).lines.length, 0);
});

test('svg: no background, one palette colour, unique ids, words as paths', () => {
  const m = engine.layout(base);
  const svg = engine.svg(m, { color: PALETTE[4].hex });
  assert.ok(!/<rect(?![^>]*\/>\s*<\/clipPath>)/.test(svg), 'only the clip rect');
  assert.deepEqual([...new Set(svg.match(/fill="[^"]+"/g))], [`fill="${PALETTE[4].hex}"`]);
  const ids = svg.match(/ id="([^"]+)"/g);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal((svg.match(/<path /g) || []).length, m.lines.reduce((n, l) => n + l.runs.length, 0));
});

test('svg: live text keeps the weights; "both" hides the text layer', () => {
  const m = engine.layout({ ...base, unit: 'letter' });
  const text = engine.svg(m, { mode: 'text' });
  assert.ok(!text.includes('<path '));
  assert.equal((text.match(/<tspan /g) || []).length, weightsOf(m).length);
  assert.match(text, /font-variation-settings:'wght' \d+/);
  const both = engine.svg(m, { mode: 'both' });
  assert.match(both, /id="Text_editierbar"[^>]*display="none"/);
});
