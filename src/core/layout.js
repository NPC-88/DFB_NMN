// Pattern layout: repeats the text (capitals) until it fills the frame.
// - The ink starts in the top-left corner. Rows are spread so the first row's
//   tallest letters touch the top and the last row's lowest marks the bottom:
//   nothing is ever cut at the top or bottom.
// - Row ends (align):
//     cut      rows run past the right edge and are cut there (default)
//     ragged   left-aligned, a word that does not fit moves to the next row
//     justify  as ragged, then word spacing stretches the row to the right edge
// - Every unit (line, word or letter) gets a weight from the gradient field.
// Output is a plain model (no DOM, no SVG) that any renderer can draw.

import { createField } from './field.js';

export const LAYOUT_DEFAULTS = {
  text: '',
  width: 1920, height: 1080,
  fontSize: 34.285,          // px; also the nominal row pitch (line height 1, tracking 0)
  unit: 'word',              // 'line' | 'word' | 'letter' — what one weight value covers
  align: 'cut',              // 'cut' | 'ragged' | 'justify'
  minWeight: 145, maxWeight: 1000,
  reverse: false,            // false: dark/heavy where the gradient is high
  lineHeight: 1,             // minimum row pitch × font size; rows then spread to fill the height
  field: {},                 // see field.js
  plan: null,                // optional: rows from an earlier layout (model.plan) — same words on
                             // the same rows at the same height; used by animations so words
                             // slide within their row instead of jumping between rows
};


export function layoutPattern(font, params) {
  const p = { ...LAYOUT_DEFAULTS, ...params, field: { ...(params && params.field) } };
  const W = p.width, H = p.height, s = p.fontSize;
  const scale = s / font.unitsPerEm;
  const sample = createField(p.field, W, H);
  const weightAt = (x, y) => font.clampWeight(toWeight(sample(x, y), p));
  const empty = { width: W, height: H, fontSize: s, scale, unit: p.unit, lines: [], params: p };

  const words = String(p.text || '').toLocaleUpperCase('de-DE').split(/\s+/).filter(Boolean);
  if (!words.length) return empty;

  // Vertical ink of this text at the extremes of the weight range.
  const { top, bottom } = inkExtents(font, words, p);
  const inkTop = top * scale, inkBottom = -bottom * scale;
  const span = H - inkTop - inkBottom;
  const plan = p.plan && p.plan.rows && p.plan.rows.length ? p.plan.rows : null;
  const rows = plan ? plan.length : Math.max(1, Math.floor(span / (s * Math.max(0.5, p.lineHeight))) + 1);
  const pitch = rows > 1 ? span / (rows - 1) : 0;

  const lines = [];
  let wi = 0;
  for (let r = 0; r < rows; r++) {
    if (plan) wi = plan[r].start;
    const baseline = plan ? plan[r].baseline : inkTop + r * pitch;
    const midY = baseline - s * 0.35;
    const lineWeight = p.unit === 'line' ? weightAt(W / 2, midY) : null;
    const runs = [];
    let x = 0;
    const start = wi;
    for (let guard = 0; guard < 10000; guard++) {
      if (plan && runs.length >= plan[r].count) break;
      const word = words[wi % words.length];
      if (runs.length) x += spaceAdvance(lastWeight(runs));
      const run = placeWord(word, x, midY, lineWeight);
      if (!runs.length) shiftRun(run, -inkLeft(run));          // ink touches the left edge
      if (!plan && p.align !== 'cut' && runs.length && inkRight(run) > W) break;   // does not fit: next row
      runs.push(run);
      wi++;
      x = run.end;
      if (!plan && inkRight(run) > W) break;                   // reached (or crossed) the right edge
    }
    if (p.align === 'justify') justify(runs, W);
    lines.push({ baseline, runs, start, count: runs.length });
  }

  // Second pass: the first and last rows may lack accents or commas; move the
  // rows so their real ink touches the top and bottom edge.
  if (lines.length && !plan) {
    const first = lines[0], last = lines[lines.length - 1];
    const t = first.baseline - rowInk(first).top, b = rowInk(last).bottom - last.baseline;
    const b0 = t, b1 = H - b;
    lines.forEach((l, i) => { l.baseline = lines.length > 1 ? b0 + (i * (b1 - b0)) / (lines.length - 1) : b0; });
  }
  for (const l of lines) l.top = l.baseline - s * 0.5 - ((font.ascent + font.descent) / 2) * scale;   // line box, as Figma
  return {
    ...empty, lines,
    rowPitch: lines.length > 1 ? lines[1].baseline - lines[0].baseline : 0,
    plan: { rows: lines.map((l) => ({ start: l.start, count: l.count, baseline: l.baseline })) },
  };

  function rowInk(line) {
    let top = line.baseline, bottom = line.baseline;
    for (const r of line.runs) for (const g of r.glyphs) {
      const bb = font.bounds(g.id, g.weight);
      if (!bb) continue;
      top = Math.min(top, line.baseline - g.dy - bb.yMax * scale);
      bottom = Math.max(bottom, line.baseline - g.dy - bb.yMin * scale);
    }
    return { top, bottom };
  }

  function placeWord(word, x0, midY, fixedWeight) {
    const glyphs = [];
    let gx = x0;
    if (p.unit === 'letter') {
      const base = font.runFast(word, weightAt(x0, midY));
      for (let i = 0; i < base.length; i++) {
        const w = weightAt(gx + base[i].advance * scale / 2, midY);
        const g = font.runFast(word, w)[i] || base[i];
        glyphs.push({ id: g.id, chars: g.chars, x: gx + g.xOffset * scale, dy: g.yOffset * scale, weight: w, adv: g.advance * scale });
        gx += g.advance * scale;
      }
      return { text: word, weight: null, glyphs, end: gx };
    }
    let w = fixedWeight;
    if (w == null) {
      const est = measure(word, weightAt(x0 + s * word.length * 0.3, midY));
      w = weightAt(x0 + est / 2, midY);
    }
    for (const g of font.run(word, w)) {
      glyphs.push({ id: g.id, chars: g.chars, x: gx + g.xOffset * scale, dy: g.yOffset * scale, weight: w, adv: g.advance * scale });
      gx += g.advance * scale;
    }
    return { text: word, weight: w, glyphs, end: gx };
  }

  function measure(word, w) { let a = 0; for (const g of font.run(word, w)) a += g.advance * scale; return a; }
  function spaceAdvance(w) { const g = font.run(' ', w)[0]; return g ? g.advance * scale : s * 0.25; }
  function lastWeight(runs) { const r = runs[runs.length - 1]; return r.glyphs[r.glyphs.length - 1].weight; }

  function inkLeft(run) {
    for (const g of run.glyphs) { const b = font.bounds(g.id, g.weight); if (b) return g.x + b.xMin * scale; }
    return run.glyphs.length ? run.glyphs[0].x : 0;
  }
  function inkRight(run) {
    for (let i = run.glyphs.length - 1; i >= 0; i--) {
      const g = run.glyphs[i]; const b = font.bounds(g.id, g.weight);
      if (b) return g.x + b.xMax * scale;
    }
    return run.end;
  }
  function shiftRun(run, dx) { for (const g of run.glyphs) g.x += dx; run.end += dx; }

  // Spread the leftover width over the gaps so the row's ink ends exactly at W.
  function justify(runs, width) {
    if (!runs.length) return;
    const extra = width - inkRight(runs[runs.length - 1]);
    if (extra <= 0) return;
    // Word spacing only; letter spacing just when the row is a single word.
    const single = runs.length === 1;
    const gaps = [];
    runs.forEach((run, ri) => run.glyphs.forEach((g, gi) => {
      if (ri === 0 && gi === 0) return;
      gaps.push(gi === 0 || single ? 1 : 0);
    }));
    const total = gaps.reduce((a, b) => a + b, 0);
    if (!total) return;
    let k = 0, acc = 0;
    runs.forEach((run, ri) => run.glyphs.forEach((g, gi) => {
      if (ri === 0 && gi === 0) return;
      acc += (extra * gaps[k++]) / total;
      g.x += acc;
    }));
    for (const run of runs) run.end = run.glyphs[run.glyphs.length - 1].x + run.glyphs[run.glyphs.length - 1].adv;
  }
}

// Highest and lowest ink of the text's letters, over the weight range (font units).
function inkExtents(font, words, p) {
  const chars = [...new Set(words.join(''))].join('');
  let top = font.capHeight, bottom = 0;
  for (const w of [p.minWeight, (p.minWeight + p.maxWeight) / 2, p.maxWeight]) {
    for (const g of font.run(chars, w)) {
      const b = font.bounds(g.id, w);
      if (!b) continue;
      top = Math.max(top, b.yMax + g.yOffset);
      bottom = Math.min(bottom, b.yMin + g.yOffset);
    }
  }
  return { top, bottom };
}

// Field value 0..1 → wght.
export function toWeight(v, p) {
  if (p.reverse) v = 1 - v;
  return p.minWeight + (p.maxWeight - p.minWeight) * v;
}
