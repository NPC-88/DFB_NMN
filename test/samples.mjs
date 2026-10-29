// Sample sheet: the Hymne preset with different units and wave settings → test/out/samples.html
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createEngine, HYMNE } from '../src/core/index.js';
const engine = createEngine(readFileSync(new URL('../fonts/DFB_SANS_VAR_Italic.ttf', import.meta.url)));
const H = HYMNE.params, F = H.field;
const variants = [
  ['Hymne · Wort (Standard)', {}, '#BAA98C', '#A9936F'],
  ['Hymne · Zeile', { unit: 'line' }, '#BAA98C', '#A9936F'],
  ['Hymne · Buchstabe, diagonale Welle', { unit: 'letter', field: { ...F, angle: 30, bands: 2, wobble: 0.12, wobbleFreq: 1.5 } }, '#BAA98C', '#A9936F'],
  ['Verlauf mehr → weniger, Wort, über den Rand', { overflow: 'bleed', boxX: -40, field: { ...F, shape: 'ramp', angle: 20, wobble: 0.1 }, reverse: true }, '#000000', '#262626'],
  ['Rundung um ein Zentrum, Buchstabe', { unit: 'letter', field: { ...F, curve: 1, bands: 2.5, wobble: 0, cx: 0.35, cy: 0.55 } }, '#7A071A', '#A60014'],
  ['Kurzer Text, große Schrift', { text: 'Mit dir.', fontSize: 120, lineHeight: 0.9, boxWidth: 1920, field: { ...F, bands: 1, wobble: 0.15 } }, '#F5F5F5', '#262626'],
];
mkdirSync('test/out', { recursive: true });
const html = variants.map(([label, over, color, bg]) => {
  const m = engine.layout({ ...H, ...over });
  return `<figure style="margin:0 0 24px"><figcaption style="font:600 18px system-ui;margin:0 0 6px">${label}</figcaption><div style="background:${bg};width:960px;height:540px">${engine.svg(m, { color }).replace('<svg ', '<svg style="width:100%;height:100%" ')}</div></figure>`;
}).join('');
writeFileSync('test/out/samples.html', `<body style="margin:16px;background:#fff">${html}</body>`);
