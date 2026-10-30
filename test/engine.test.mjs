import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createEngine, createField, stopMap, HYMNE, PALETTE } from '../src/core/index.js';

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

test('field: both HUK modes stay in 0..1; offset shifts toward heavier', () => {
  for (const mode of ['parametric', 'points']) {
    const f = createField({ ...base.field, mode }, 1920, 1080);
    for (let i = 0; i < 300; i++) { const v = f(Math.random() * 1920, Math.random() * 1080); assert.ok(v >= 0 && v <= 1, mode); }
  }
  const avg = (o) => { const f = createField({ ...base.field, offset: o }, 100, 100); let t = 0; for (let i = 0; i < 100; i++) t += f(i, (i * 37) % 100); return t / 100; };
  assert.ok(avg(0.7) > avg(0.5) && avg(0.5) > avg(0.3));
});

test('layout: weights stay inside min/max and spread over the range', () => {
  for (const unit of ['line', 'word', 'letter']) {
    const ws = weightsOf(engine.layout({ ...base, unit, minWeight: 200, maxWeight: 800 }));
    assert.ok(Math.min(...ws) >= 200 && Math.max(...ws) <= 800, unit);
    assert.ok(Math.max(...ws) - Math.min(...ws) > 300, unit + ' uses the range');
  }
});

test('layout: line = one weight per row, word = one per word, letter varies inside words', () => {
  const line = engine.layout({ ...base, unit: 'line' });
  for (const l of line.lines) assert.equal(new Set(l.runs.flatMap((r) => r.glyphs.map((g) => g.weight))).size, 1);
  const word = engine.layout({ ...base, unit: 'word' });
  for (const l of word.lines) for (const r of l.runs) assert.equal(new Set(r.glyphs.map((g) => g.weight)).size, 1);
  const letter = engine.layout({ ...base, unit: 'letter', field: { ...base.field, rotate: 0, waves: 1 } });
  const varying = letter.lines.flatMap((l) => l.runs).filter((r) => new Set(r.glyphs.map((g) => g.weight)).size > 1);
  assert.ok(varying.length > 10);
});

// Ink box of the whole pattern, per row.
function ink(m) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  const rows = m.lines.map((l) => {
    let a = Infinity, b = -Infinity;
    for (const r of l.runs) for (const g of r.glyphs) {
      const bb = engine.font.bounds(g.id, g.weight);
      if (!bb) continue;
      a = Math.min(a, g.x + bb.xMin * m.scale); b = Math.max(b, g.x + bb.xMax * m.scale);
      y0 = Math.min(y0, l.baseline - g.dy - bb.yMax * m.scale); y1 = Math.max(y1, l.baseline - g.dy - bb.yMin * m.scale);
    }
    x0 = Math.min(x0, a); x1 = Math.max(x1, b);
    return [a, b];
  });
  return { x0, x1, y0, y1, rows };
}

test('layout: starts in the top-left corner, never cut at top/bottom; row ends per mode', () => {
  for (const [width, height, fontSize, unit] of [[1000, 1000, 34.5, 'word'], [1920, 1080, 34.285, 'letter'], [2095, 504, 80, 'line'], [1000, 1000, 200, 'word']]) {
   for (const align of ['cut', 'ragged', 'justify']) {
    const m = engine.layout({ ...base, width, height, fontSize, unit, align });
    const k = ink(m);
    const tag = `${width}x${height}@${fontSize} ${align}`;
    assert.ok(Math.abs(k.y0) < 0.01 && Math.abs(k.y1 - height) < 0.01, tag + ' top and bottom edges');
    for (const [a, b] of k.rows) {
      assert.ok(Math.abs(a) < 0.01, tag + ' row starts at the left edge');
      if (align === 'justify') assert.ok(Math.abs(b - width) < 0.01, tag + ' row ends at the right edge');
      if (align === 'ragged') assert.ok(b <= width + 0.01, tag + ' ragged row stays inside');
      if (align === 'cut') assert.ok(b >= width - 0.01, tag + ' cut row runs to/over the right edge');
    }
    const pitches = m.lines.slice(1).map((l, i) => l.baseline - m.lines[i].baseline);
    assert.ok(Math.max(...pitches) - Math.min(...pitches) < 1e-6, tag + ' straight, evenly spaced rows');
    assert.ok(m.rowPitch >= fontSize - 1e-6, tag + ' rows never closer than line height 1');
   }
  }
});

test('stops: two stops are a straight gradient; extra stops shape it; smooth and in range', () => {
  const lin = stopMap([{ pos: 0, value: 0 }, { pos: 1, value: 1 }]);
  for (const t of [0, 0.25, 0.5, 0.9]) assert.ok(Math.abs(lin(t) - t) < 1e-9);
  const plateau = stopMap([{ pos: 0, value: 0 }, { pos: 0.3, value: 1 }, { pos: 0.7, value: 1 }, { pos: 1, value: 0 }]);
  assert.ok(Math.abs(plateau(0.5) - 1) < 1e-9);
  for (let t = 0; t <= 1; t += 0.01) { const v = plateau(t); assert.ok(v >= 0 && v <= 1); }
  const unsorted = stopMap([{ pos: 1, value: 1 }, { pos: 0, value: 0 }]);
  assert.ok(Math.abs(unsorted(0.5) - 0.5) < 1e-9);
});

test('field: all four modes and both parametric types give 0..1', () => {
  for (const [mode, type] of [['waves'], ['ramp'], ['parametric', 'linear'], ['parametric', 'radial'], ['points']]) {
    const f = createField({ ...base.field, mode, type, waves: 0.3 }, 1920, 1080);
    let lo = 1, hi = 0;
    for (let i = 0; i < 400; i++) { const v = f((i * 97) % 1920, (i * 53) % 1080); assert.ok(v >= 0 && v <= 1); lo = Math.min(lo, v); hi = Math.max(hi, v); }
    assert.ok(hi - lo > 0.3, mode + ' ' + (type || '') + ' varies');
  }
  // linear: value rises from handle A to handle B
  const f = createField({ ...base.field, mode: 'parametric', type: 'linear', a: { x: 0, y: 0.5 }, b: { x: 1, y: 0.5 } }, 1000, 500);
  assert.ok(f(10, 250) < f(500, 250) && f(500, 250) < f(990, 250));
});

test('layout: one word or a passage, always capitals, repeats to fill', () => {
  const one = engine.layout({ ...base, text: 'Mannschaft' });
  assert.ok(one.lines.length > 20);
  assert.ok(one.lines.every((l) => l.runs.every((r) => r.text === 'MANNSCHAFT')));
  assert.equal(engine.layout({ ...base, text: 'straße' }).lines[0].runs[0].text, 'STRASSE');
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
