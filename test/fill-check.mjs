import { readFileSync, writeFileSync } from 'node:fs';
import { createEngine, HYMNE } from '../src/core/index.js';
const e = createEngine(readFileSync(new URL('../fonts/DFB_SANS_VAR_Italic.ttf', import.meta.url)));
for (const [w, h, fs, unit] of [[1000, 1000, 34.5, 'word'], [1920, 1080, 34.285, 'letter'], [2095, 504, 80, 'line'], [1000, 1000, 200, 'word']]) {
  const m = e.layout({ ...HYMNE.params, width: w, height: h, fontSize: fs, unit });
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, worstRow = 0;
  for (const l of m.lines) { let rx0 = 1e9, rx1 = -1e9;
    for (const r of l.runs) for (const g of r.glyphs) { const b = e.font.bounds(g.id, g.weight); if (!b) continue;
      const a = g.x + b.xMin * m.scale, c = g.x + b.xMax * m.scale; rx0 = Math.min(rx0, a); rx1 = Math.max(rx1, c);
      y0 = Math.min(y0, l.baseline - g.dy - b.yMax * m.scale); y1 = Math.max(y1, l.baseline - g.dy - b.yMin * m.scale); }
    x0 = Math.min(x0, rx0); x1 = Math.max(x1, rx1); worstRow = Math.max(worstRow, Math.abs(rx1 - w), Math.abs(rx0)); }
  console.log(`${w}x${h} fs${fs} ${unit}: rows ${m.lines.length} pitch ${m.rowPitch.toFixed(1)} ink x ${x0.toFixed(2)}..${x1.toFixed(2)} y ${y0.toFixed(2)}..${y1.toFixed(2)} worst row edge err ${worstRow.toFixed(2)}`);
  writeFileSync(`test/out/fill-${w}x${h}-${fs}.svg`, e.svg(m, { color: '#BAA98C' }));
}
