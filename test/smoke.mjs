import { readFileSync, writeFileSync } from 'node:fs';
import { createEngine, HYMNE } from '../src/core/index.js';
const engine = createEngine(readFileSync(new URL('../fonts/DFB_SANS_VAR_Italic.ttf', import.meta.url)));
for (const unit of ['line', 'word', 'letter']) {
  const t = performance.now();
  const model = engine.layout({ ...HYMNE.params, unit });
  const t1 = performance.now();
  const svg = engine.svg(model, { color: HYMNE.color });
  const t2 = performance.now();
  writeFileSync(`test/out/hymne-${unit}.svg`, svg);
  const ws = model.lines.flatMap(l => l.runs.flatMap(r => r.glyphs.map(g => g.weight)));
  console.log(unit, 'lines', model.lines.length, 'glyphs', ws.length, 'distinct weights', new Set(ws).size, 'range', Math.min(...ws), Math.max(...ws), `layout ${(t1-t).toFixed(0)}ms svg ${(t2-t1).toFixed(0)}ms`, (svg.length/1024|0)+'KB');
}
