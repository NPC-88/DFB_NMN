// Public entry of the pattern engine. Everything a front end needs:
//
//   const engine = createEngine(fontBytes);
//   const model  = engine.layout(params);          // plain data
//   const svg    = engine.svg(model, { color, mode });
//
// No DOM access anywhere in core/, so the same engine runs in the browser,
// the Figma plugin UI and Node (tests).

import * as fontkit from 'fontkit';
import { createVarFont } from './font.js';
import { layoutPattern, LAYOUT_DEFAULTS, toWeight } from './layout.js';
import { createField, FIELD_DEFAULTS } from './field.js';
import { toSVG, runPath } from './svg.js';

export { PALETTE, COLOR_PAIRS, FORMATS, PRESETS, HYMNE, HYMNE_TEXT } from './presets.js';
export { SCHEMA, FIELD_MODES, getPath, setPath } from './schema.js';
export { LAYOUT_DEFAULTS, FIELD_DEFAULTS, createField, toWeight };
export { stopMap } from './field.js';

export function createEngine(fontBytes) {
  const bytes = fontBytes instanceof Uint8Array ? fontBytes : new Uint8Array(fontBytes);
  const font = createVarFont(fontkit.create(bytes));
  return {
    font,
    layout: (params) => layoutPattern(font, params),
    svg: (model, opts) => toSVG(model, font, opts),
    runPath: (run, baseline, scale, precision) => runPath(run, baseline, scale, font, precision),
    // Field as a grayscale grid (for previews/overlays): values 0..1, row-major.
    fieldGrid(params, cols, rows) {
      const p = { ...LAYOUT_DEFAULTS, ...params };
      const f = createField(p.field, p.width, p.height);
      const out = new Float32Array(cols * rows);
      for (let j = 0; j < rows; j++)
        for (let i = 0; i < cols; i++)
          out[j * cols + i] = f(((i + 0.5) / cols) * p.width, ((j + 0.5) / rows) * p.height);
      return out;
    },
  };
}
