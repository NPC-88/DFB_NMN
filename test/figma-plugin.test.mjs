// Runs figma/code.js against a minimal mock of the Figma plugin API. This only
// checks our wiring (messages, ranges, positions) — not real Figma behaviour.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createEngine, HYMNE } from '../src/core/index.js';

function mockFigma({ fonts, bindThrows = false }) {
  const created = [];
  const notices = [];
  const node = (type) => {
    const n = { type, children: [], ranges: [], bound: [], x: 0, y: 0, width: 100, height: 100,
      appendChild(c) { this.children.push(c); }, resize(w, h) { this.width = w; this.height = h; },
      setRangeFontName(a, b, f) { this.ranges.push([a, b, f.style]); },
      setRangeBoundVariable(a, b, field, v) { if (bindThrows) throw new Error('unsupported'); this.bound.push([a, b, field, v.value]); } };
    created.push(n);
    return n;
  };
  const vars = [];
  const figma = {
    showUI() {}, ui: { postMessage() {} }, notify: (t) => notices.push(t),
    viewport: { center: { x: 0, y: 0 }, scrollAndZoomIntoView() {} },
    currentPage: { selection: [], appendChild() {} },
    createNodeFromSvg: (svg) => Object.assign(node('FRAME'), { svg }),
    createFrame: () => node('FRAME'),
    createText: () => node('TEXT'),
    listAvailableFontsAsync: async () => fonts.map((style) => ({ fontName: { family: 'DFB SANS VAR', style } })),
    loadFontAsync: async () => {},
    variables: {
      getLocalVariableCollectionsAsync: async () => [],
      createVariableCollection: (name) => ({ name, modes: [{ modeId: 'm' }], variableIds: [] }),
      getVariableByIdAsync: async () => null,
      createVariable: (name) => { const v = { name, setValueForMode(m, x) { this.value = x; } }; vars.push(v); return v; },
    },
  };
  const ctx = { figma, __html__: '', console };
  vm.runInNewContext(readFileSync(new URL('../figma/code.js', import.meta.url), 'utf8'), ctx);
  return { figma, created, notices, vars };
}

const engine = createEngine(readFileSync(new URL('../fonts/DFB_SANS_VAR_Italic.ttf', import.meta.url)));
const model = engine.layout({ ...HYMNE.params, unit: 'word', height: 200 });
const textModel = {
  name: 'T', color: '#BAA98C', width: model.width, height: model.height, fontSize: model.fontSize,
  tracking: 0.01, lineHeight: 1,
  lines: model.lines.map((l) => ({ top: l.top, runs: l.runs.map((r) => ({ text: r.text, x: r.x, weight: r.weight })) })),
};
const ITALICS = ['Light Italic', 'Regular Italic', 'Bold Italic', 'Black Italic'];

test('insert-svg: frame without background', async () => {
  const m = mockFigma({ fonts: ITALICS });
  await m.figma.ui.onmessage({ type: 'insert-svg', svg: '<svg/>', name: 'P' });
  assert.equal(m.created[0].name, 'P');
  assert.equal(m.created[0].fills.length, 0);   // array from the vm realm: compare length
});

test('insert-text: one text layer per row, every word ranged, weights bound', async () => {
  const m = mockFigma({ fonts: ITALICS });
  await m.figma.ui.onmessage({ type: 'insert-text', model: textModel, variable: true });
  const texts = m.created.filter((n) => n.type === 'TEXT');
  assert.equal(texts.length, model.lines.length);
  const words = model.lines[0].runs;
  assert.equal(texts[0].characters, words.map((r) => r.text).join(' '));
  assert.equal(texts[0].bound.length, words.length);
  assert.equal(texts[0].y, model.lines[0].top);
  for (const [, , field, v] of texts[0].bound) { assert.equal(field, 'fontWeight'); assert.equal(v % 5, 0); }
  assert.match(m.notices.at(-1), /stufenlos/);
});

test('insert-text: falls back to the four styles when binding is unsupported', async () => {
  const m = mockFigma({ fonts: ITALICS, bindThrows: true });
  await m.figma.ui.onmessage({ type: 'insert-text', model: textModel, variable: true });
  assert.match(m.notices.at(-1), /4 Schnitte/);
});

test('insert-text: clear message when the font is missing in Figma', async () => {
  const m = mockFigma({ fonts: [] });
  await m.figma.ui.onmessage({ type: 'insert-text', model: textModel, variable: true });
  assert.match(m.notices.at(-1), /nicht verfügbar/);
  assert.equal(m.created.length, 0);
});
