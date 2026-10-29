// App shell: state, preview, field overlay, colour and export. Host-specific
// actions (download in the browser, insert into Figma) come from `host`.

import { createEngine, SCHEMA, PALETTE, FORMATS, PRESETS, setPath } from '../core/index.js';
import { renderControls, el } from './controls.js';

const clone = (o) => JSON.parse(JSON.stringify(o));

export function startApp({ fontBytes, host }) {
  const engine = createEngine(fontBytes);
  let preset = PRESETS[0];
  let params = clone(preset.params);
  let color = preset.color;
  let previewBg = preset.previewBackground;
  let showField = false;
  let exportMode = 'outlines';
  let model = null;

  const $ = (s) => document.querySelector(s);
  const stage = $('#stage');
  const art = $('#art');
  const fieldCanvas = $('#field');
  const status = $('#status');

  // Presets
  const presetSel = $('#preset');
  for (const p of PRESETS) presetSel.append(el('option', { value: p.id }, p.name));
  presetSel.addEventListener('change', () => applyPreset(PRESETS.find((p) => p.id === presetSel.value)));
  $('#reset').addEventListener('click', () => applyPreset(preset));

  // Controls
  const controls = renderControls($('#controls'), SCHEMA, {
    get: () => params,
    set: (key, value) => { params = setPath(clone(params), key, value); update(); },
    formats: FORMATS,
    formatOf: (p) => (FORMATS.find((f) => f.width === p.width && f.height === p.height) || { id: 'custom' }).id,
    onFormat: (id) => {
      const f = FORMATS.find((x) => x.id === id);
      if (!f || !f.width) return;
      // keep the column proportional to the frame width
      const ratio = params.boxWidth / params.width;
      params = { ...params, width: f.width, height: f.height, boxWidth: Math.round(f.width * ratio) };
      update();
    },
  });

  // Colour (exported) and preview background (not exported)
  swatches($('#color'), (hex) => { color = hex; update(); }, () => color);
  swatches($('#previewBg'), (hex) => { previewBg = hex; update(); }, () => previewBg, true);

  $('#showField').addEventListener('change', (e) => { showField = e.target.checked; update(); });
  $('#exportMode').addEventListener('change', (e) => { exportMode = e.target.value; });
  for (const a of host.actions) {
    const b = el('button', { type: 'button', class: a.primary ? 'primary' : '' }, a.label);
    b.addEventListener('click', () => run(a));
    $('#actions').append(b);
  }

  function applyPreset(p) {
    preset = p;
    params = clone(p.params);
    color = p.color;
    previewBg = p.previewBackground;
    update();
  }

  let queued = false;
  function update() {
    controls.sync();
    document.querySelectorAll('.swatches').forEach((s) => s.sync && s.sync());
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; render(); });
  }

  function render() {
    const t0 = performance.now();
    model = engine.layout(params);
    const svg = engine.svg(model, { color, mode: 'outlines', precision: 1 });
    art.innerHTML = svg;
    stage.style.aspectRatio = `${params.width} / ${params.height}`;
    stage.style.background = previewBg || 'transparent';
    stage.classList.toggle('checker', !previewBg);
    drawField();
    const ws = model.lines.flatMap((l) => l.runs.flatMap((r) => r.glyphs.map((g) => g.weight)));
    status.textContent = `${model.lines.length} Zeilen · ${ws.length} Zeichen · wght ${Math.min(...ws)}–${Math.max(...ws)} · ${new Set(ws).size} Gewichte · ${Math.round(performance.now() - t0)} ms`;
  }

  // Field overlay shows the weight the field asks for (dark = heaviest).
  function drawField() {
    fieldCanvas.hidden = !showField;
    if (!showField) return;
    const cols = 160, rows = Math.max(1, Math.round((160 * params.height) / params.width));
    const grid = engine.fieldGrid(params, cols, rows);
    fieldCanvas.width = cols; fieldCanvas.height = rows;
    const ctx = fieldCanvas.getContext('2d');
    const img = ctx.createImageData(cols, rows);
    for (let i = 0; i < grid.length; i++) {
      let v = params.reverse ? 1 - grid[i] : grid[i];
      if (params.steps >= 2) v = Math.round(v * (params.steps - 1)) / (params.steps - 1);
      const g = Math.round((1 - v) * 255);
      img.data.set([g, g, g, 255], i * 4);
    }
    ctx.putImageData(img, 0, 0);
  }

  async function run(action) {
    if (!model) render();
    const name = `DFB-${preset.name}-${params.unit}-${params.width}x${params.height}`;
    const svg = engine.svg(model, { color, mode: action.mode || exportMode, title: name });
    try {
      const msg = await action.run({ svg, model, color, name, params, font: engine.font, engine });
      if (msg) flash(msg);
    } catch (e) {
      flash('Fehler: ' + e.message);
    }
  }

  function flash(msg) {
    const n = $('#message');
    n.textContent = msg;
    n.hidden = false;
    clearTimeout(flash.t);
    flash.t = setTimeout(() => { n.hidden = true; }, 5000);
  }

  host.onMessage && host.onMessage(flash);
  update();
  return { get params() { return params; }, get model() { return model; }, engine };
}

function swatches(root, onPick, current, allowNone = false) {
  root.classList.add('swatches');
  const items = [...(allowNone ? [{ name: 'Transparent', hex: null }] : []), ...PALETTE];
  const btns = items.map((c) => {
    const b = el('button', { type: 'button', title: c.hex ? `${c.name} ${c.hex}` : c.name, class: c.hex ? '' : 'none' });
    if (c.hex) b.style.background = c.hex;
    b.addEventListener('click', () => onPick(c.hex));
    root.append(b);
    return [b, c.hex];
  });
  const label = el('span', { class: 'swatch-name' });
  root.append(label);
  root.sync = () => {
    const cur = current();
    for (const [b, hex] of btns) b.setAttribute('aria-pressed', String(hex === cur));
    const c = items.find((i) => i.hex === cur);
    label.textContent = c ? (c.hex ? `${c.name} ${c.hex}` : c.name) : cur;
  };
  root.sync();
}
