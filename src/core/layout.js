// Pattern layout: repeats the text in straight, left-aligned rows and gives
// every unit (line, word or letter) a weight read from the wave field.
// Output is a plain model (no DOM, no SVG) that any renderer can draw.

import { createField } from './field.js';

export const LAYOUT_DEFAULTS = {
  text: '',
  uppercase: true,
  keepLineBreaks: false,   // true: every line break in the text starts a new row
  repeat: 'fill',          // 'fill' (repeat until the frame is full) | 'count'
  repeatCount: 1,
  separator: ' ',          // what goes between repetitions

  width: 1920, height: 1080,
  fontSize: 34.285,
  lineHeight: 1.0,         // × font size
  tracking: 0.01,          // em (Figma "1 %")
  boxX: 0, boxY: -3, boxWidth: 1560,   // text column inside the frame
  overflow: 'wrap',        // 'wrap' (ragged right inside the column) | 'bleed' (rows run past the frame edge)

  unit: 'word',            // 'line' | 'word' | 'letter' — what one weight value covers
  minWeight: 145, maxWeight: 1000,
  reverse: false,          // false: field 0 → min weight; true: field 0 → max weight
  steps: 0,                // 0 = continuous; n ≥ 2 = snap to n weights
  field: {},               // see field.js
};

const MAX_WORDS = 50000;

export function layoutPattern(font, params) {
  const p = { ...LAYOUT_DEFAULTS, ...params, field: { ...(params && params.field) } };
  const sample = createField(p.field, p.width, p.height);
  const scale = p.fontSize / font.unitsPerEm;
  const track = p.tracking * p.fontSize;
  const lineAdvance = p.fontSize * p.lineHeight;
  // Baseline of the first row: cap height sits at the top of the box (Figma
  // places the line box so text with line height 1 starts at boxY).
  const firstBaseline = p.boxY + p.fontSize * lineHeightBaseline(font, p.lineHeight);
  const left = p.boxX;
  const right = p.overflow === 'bleed' ? p.width : p.boxX + p.boxWidth;

  const weightAt = (x, y) => toWeight(sample(x, y), p);
  const stream = tokenStream(p);

  const lines = [];
  let line = newLine(firstBaseline);
  let x = left;

  for (let n = 0; n < MAX_WORDS; n++) {
    if (line.baseline - p.fontSize > p.height) break;   // row starts below the frame
    const tok = stream.next();
    if (tok.done) break;
    if (tok.value === '\n') { x = breakLine(); continue; }

    const word = tok.value;
    let placed = placeWord(word, x, line);
    // wrap: a word that does not fit starts the next row. bleed: it runs past
    // the frame edge (clipped on export) and the row ends after it.
    if (p.overflow !== 'bleed' && placed.x1 > right && line.runs.length) {
      x = breakLine();
      if (line.baseline - p.fontSize > p.height) break;
      placed = placeWord(word, x, line);
    }
    line.runs.push(placed.run);
    x = placed.x1 + spaceAdvance(placed.lastWeight);
    if (p.overflow === 'bleed' && x >= p.width) x = breakLine();
  }
  if (line.runs.length) lines.push(line);

  return {
    width: p.width, height: p.height,
    fontSize: p.fontSize, scale, tracking: track,
    unit: p.unit, lineHeight: lineAdvance,
    lines,
    params: p,
  };

  // top: upper edge of the row's line box (where Figma/CSS would place it)
  function newLine(baseline) { return { baseline, top: baseline - (firstBaseline - p.boxY), runs: [], weight: null }; }

  function breakLine() {
    if (line.runs.length) lines.push(line);
    line = newLine(line.baseline + lineAdvance);
    return left;
  }

  function lineWeight(ln) {
    if (ln.weight == null) ln.weight = weightAt(left + (right - left) / 2, ln.baseline - p.fontSize * 0.35);
    return ln.weight;
  }

  function spaceAdvance(w) {
    const g = font.run(' ', w)[0];
    return g ? g.advance * scale + track : p.fontSize * 0.25;
  }

  // Lay out one word starting at x. Returns its run and right edge.
  function placeWord(word, x0, ln) {
    const midY = ln.baseline - p.fontSize * 0.35;       // optical middle of caps
    if (p.unit === 'letter') {
      const glyphs = [];
      let gx = x0;
      let base = font.run(word, weightAt(x0, midY));
      for (let i = 0; i < base.length; i++) {
        const est = base[i].advance * scale;
        const w = font.clampWeight(weightAt(gx + est / 2, midY));
        const g = font.run(word, w)[i] || base[i];
        glyphs.push({ id: g.id, chars: g.chars, x: gx + g.xOffset * scale, dy: g.yOffset * scale, weight: w });
        gx += g.advance * scale + track;
      }
      const lastWeight = glyphs.length ? glyphs[glyphs.length - 1].weight : p.minWeight;
      return { x1: gx - track, lastWeight, run: { text: word, x: x0, weight: null, glyphs } };
    }

    let w;
    if (p.unit === 'line') {
      w = font.clampWeight(lineWeight(ln));
    } else {
      // word: sample at the word's centre; refine once with the measured width
      w = font.clampWeight(weightAt(x0 + p.fontSize * word.length * 0.3, midY));
      const est = measure(word, w);
      w = font.clampWeight(weightAt(x0 + est / 2, midY));
    }
    const glyphs = [];
    let gx = x0;
    for (const g of font.run(word, w)) {
      glyphs.push({ id: g.id, chars: g.chars, x: gx + g.xOffset * scale, dy: g.yOffset * scale, weight: w });
      gx += g.advance * scale + track;
    }
    return { x1: gx - track, lastWeight: w, run: { text: word, x: x0, weight: w, glyphs } };
  }

  function measure(word, w) {
    let s = 0;
    for (const g of font.run(word, w)) s += g.advance * scale + track;
    return s - track;
  }
}

// Field value 0..1 → wght.
export function toWeight(v, p) {
  if (p.reverse) v = 1 - v;
  if (p.steps >= 2) v = Math.round(v * (p.steps - 1)) / (p.steps - 1);
  return p.minWeight + (p.maxWeight - p.minWeight) * v;
}

// Where the baseline sits inside a line box, as a fraction of font size.
// Figma (and CSS) centre the font's ascent+descent in the line box.
function lineHeightBaseline(font, lineHeight) {
  const asc = font.ascent / font.unitsPerEm;
  const desc = -font.descent / font.unitsPerEm;
  return (lineHeight - (asc + desc)) / 2 + asc;
}

// Words of the text, repeated as the settings ask. '\n' tokens mark forced breaks.
function* tokenStream(p) {
  let text = String(p.text || '');
  if (p.uppercase) text = text.toLocaleUpperCase('de-DE');
  const paragraphs = text.split(/\r?\n/);
  const units = [];
  paragraphs.forEach((para, i) => {
    for (const w of para.split(/[ \t]+/)) if (w) units.push(w);
    if (p.keepLineBreaks && i < paragraphs.length - 1) units.push('\n');
  });
  if (!units.length) return;
  const sep = (p.separator || '').trim();
  const reps = p.repeat === 'count' ? Math.max(1, p.repeatCount | 0) : Infinity;
  for (let r = 0; r < reps; r++) {
    if (r > 0) {
      if (p.keepLineBreaks) yield '\n';
      if (sep) yield sep;
    }
    yield* units;
  }
}
