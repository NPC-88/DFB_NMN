// Overlay the live-text export (red, real font via @font-face) on the outlines (black) to check they coincide.
import { readFileSync, writeFileSync } from 'node:fs';
import { createEngine, HYMNE } from '../src/core/index.js';
const fontPath = new URL('../fonts/DFB_SANS_VAR_Italic.ttf', import.meta.url);
const engine = createEngine(readFileSync(fontPath));
const parts = [];
for (const unit of ['word', 'letter']) {
  const model = engine.layout({ ...HYMNE.params, unit, width: 900, height: 160, boxWidth: 880, fontSize: 40 });
  const outl = engine.svg(model, { color: '#000', mode: 'outlines' });
  const text = engine.svg(model, { color: 'rgba(255,0,0,.6)', mode: 'text' });
  parts.push(`<div style="position:relative;width:900px;height:160px;margin:10px"><div style="position:absolute;inset:0">${outl}</div><div style="position:absolute;inset:0">${text}</div></div>`);
}
const b64 = readFileSync(fontPath).toString('base64');
writeFileSync('test/out/text-align.html', `<style>@font-face{font-family:'DFB SANS VAR';font-style:italic;font-weight:75 1000;src:url(data:font/ttf;base64,${b64})}</style><body style="margin:0;background:#fff">${parts.join('')}</body>`);
