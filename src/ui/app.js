// App shell: state, gradient panel, preview with zoom, colour pairs, library
// and export. Host-specific things (how a file is saved, where the team
// library lives) come from `host`.

import { createEngine, SCHEMA, COLOR_PAIRS, FORMATS, PRESETS, setPath } from '../core/index.js';
import { renderControls, panel, el } from './controls.js';
import { createLibrary, encodeShare, decodeShare } from './library.js';

const clone = (o) => JSON.parse(JSON.stringify(o));
const ZOOMS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8];

export function startApp({ fontBytes, host }) {
  const engine = createEngine(fontBytes);
  const preset = PRESETS[0];
  let params = clone(preset.params);
  let pairId = preset.colorPair;
  let showField = false;
  let zoom = 'fit';
  let model = null;

  const shared = decodeShare(location.hash);
  if (shared) apply(shared);

  const $ = (s) => document.querySelector(s);
  const viewport = $('#viewport'), stage = $('#stage'), art = $('#art'), overlay = $('#overlay');
  const status = $('#status');
  const pair = () => COLOR_PAIRS.find((c) => c.id === pairId) || COLOR_PAIRS[0];

  // --- Gradient panel (always visible, like HUK) ---------------------------
  const grad = $('#gradient');
  const gctx = grad.getContext('2d');
  let drag = null;
  const pts = () => params.field.points || [];
  const toUV = (e) => { const r = grad.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, r }; };
  const hit = (u) => pts().findIndex((q) => Math.hypot((u.x - q.x) * u.r.width, (u.y - q.y) * u.r.height) < 14);
  grad.addEventListener('pointerdown', (e) => {
    if (params.field.mode !== 'points') return;
    const u = toUV(e);
    let i = hit(u);
    if (i < 0) { setField('points', [...pts(), { x: u.x, y: u.y, r: 0.15 }]); i = pts().length - 1; }
    drag = i;
    grad.setPointerCapture(e.pointerId);
  });
  grad.addEventListener('pointermove', (e) => {
    if (drag == null) { grad.style.cursor = params.field.mode === 'points' ? (hit(toUV(e)) >= 0 ? 'grab' : 'crosshair') : 'default'; return; }
    const u = toUV(e);
    setField('points', pts().map((q, k) => (k === drag ? { ...q, x: clamp(u.x), y: clamp(u.y) } : q)));
  });
  grad.addEventListener('pointerup', () => { drag = null; });
  grad.addEventListener('dblclick', (e) => {
    const i = hit(toUV(e));
    if (i >= 0 && pts().length > 1) setField('points', pts().filter((_, k) => k !== i));
  });
  grad.addEventListener('wheel', (e) => {
    const i = hit(toUV(e));
    if (params.field.mode !== 'points' || i < 0) return;
    e.preventDefault();
    setField('points', pts().map((q, k) => (k === i ? { ...q, r: Math.min(0.6, Math.max(0.03, q.r * (e.deltaY < 0 ? 1.08 : 0.93))) } : q)));
  }, { passive: false });
  $('#showField').addEventListener('change', (e) => { showField = e.target.checked; update(); });

  function setField(key, value) { params = setPath(clone(params), 'field.' + key, value); update(); }

  // --- Controls -------------------------------------------------------------
  const controls = renderControls($('#controls'), SCHEMA, {
    get: () => params,
    set: (key, value) => { params = setPath(clone(params), key, value); update(); },
    formats: FORMATS,
    formatOf: (p) => (FORMATS.find((f) => f.width === p.width && f.height === p.height) || { id: 'custom' }).id,
    onFormat: (id) => {
      const f = FORMATS.find((x) => x.id === id);
      if (f && f.width) { params = { ...params, width: f.width, height: f.height }; zoom = 'fit'; update(); }
    },
  });

  // Colour pairs
  const colorBox = panel('Farbe', true);
  const pairBtns = COLOR_PAIRS.map((c) => {
    const b = el('button', { type: 'button', class: 'pair', 'data-id': c.id });
    const sw = el('span', { class: 'pair-swatch' });
    sw.style.background = c.background;
    const ink = el('span', { class: 'pair-ink' }, 'Aa');
    ink.style.color = c.color;
    sw.append(ink);
    b.append(sw, el('span', {}, c.name));
    b.addEventListener('click', () => { pairId = c.id; update(); });
    colorBox.body.append(b);
    return b;
  });
  colorBox.body.append(el('p', { class: 'hint' }, 'Exportiert wird nur die Musterfarbe, ohne Hintergrund.'));
  $('#controls').prepend(colorBox.node);

  // Library
  const library = createLibrary({ host, onLoad: (s) => { apply(s); zoom = 'fit'; update(); }, current: () => snapshot(), flash });
  $('#controls').append(library.node);

  // Reset
  $('#reset').addEventListener('click', () => { params = clone(preset.params); pairId = preset.colorPair; zoom = 'fit'; history.replaceState(null, '', location.pathname); update(); });

  // Zoom
  $('#zoomIn').addEventListener('click', () => stepZoom(1));
  $('#zoomOut').addEventListener('click', () => stepZoom(-1));
  $('#zoomFit').addEventListener('click', () => { zoom = 'fit'; layoutStage(); });
  $('#zoom100').addEventListener('click', () => { zoom = 1; layoutStage(); });
  new ResizeObserver(() => layoutStage()).observe(viewport);

  // Export
  $('#download').addEventListener('click', async () => {
    if (!model) render();
    const name = `DFB-${preset.name}-${params.unit}-${params.width}x${params.height}`;
    const svg = engine.svg(model, { color: pair().color, mode: $('#exportMode').value, title: name });
    flash(await host.save({ filename: name + '.svg', data: svg }));
  });

  function apply(s) {
    if (s.params) params = { ...clone(preset.params), ...s.params, field: { ...preset.params.field, ...(s.params.field || {}) } };
    if (s.colorPair && COLOR_PAIRS.some((c) => c.id === s.colorPair)) pairId = s.colorPair;
  }
  function snapshot() { return { v: 1, params: clone(params), colorPair: pairId }; }

  let queued = false;
  function update() {
    controls.sync();
    pairBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === pairId)));
    drawGradient();
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; render(); });
  }

  function render() {
    const t0 = performance.now();
    model = engine.layout(params);
    art.innerHTML = engine.svg(model, { color: pair().color, mode: 'outlines', precision: 1 });
    stage.style.background = pair().background;
    overlay.hidden = !showField;
    if (showField) drawField(overlay, 200);
    layoutStage();
    const ws = model.lines.flatMap((l) => l.runs.flatMap((r) => r.glyphs.map((g) => g.weight)));
    status.textContent = ws.length
      ? `${model.lines.length} Zeilen · wght ${Math.min(...ws)}–${Math.max(...ws)} · ${Math.round(performance.now() - t0)} ms`
      : 'Kein Text';
  }

  function layoutStage() {
    const W = params.width, H = params.height;
    const vw = viewport.clientWidth - 48, vh = viewport.clientHeight - 48;
    const fit = Math.max(0.01, Math.min(vw / W, vh / H));
    const z = zoom === 'fit' ? fit : zoom;
    stage.style.width = W * z + 'px';
    stage.style.height = H * z + 'px';
    $('#zoomLabel').textContent = Math.round(z * 100) + ' %';
  }
  function stepZoom(dir) {
    const cur = zoom === 'fit' ? parseFloat($('#zoomLabel').textContent) / 100 : zoom;
    const next = dir > 0 ? ZOOMS.find((z) => z > cur + 1e-6) : [...ZOOMS].reverse().find((z) => z < cur - 1e-6);
    if (next) { zoom = next; layoutStage(); }
  }

  // Gradient: dark = heavy (what the pattern will show), points on top.
  function drawGradient() {
    const cols = 240, rows = Math.max(1, Math.round((cols * params.height) / params.width));
    grad.style.aspectRatio = `${params.width} / ${params.height}`;
    drawField(grad, cols, rows);
    document.querySelector('#gradHint').textContent = params.field.mode === 'points'
      ? 'Punkt ziehen · Klick = neuer Punkt · Doppelklick = löschen · Mausrad = Größe'
      : 'dunkel = schwer';
    if (params.field.mode !== 'points') return;
    const sx = grad.width, sy = grad.height;
    for (const q of pts()) {
      gctx.beginPath();
      gctx.arc(q.x * sx, q.y * sy, 4, 0, Math.PI * 2);
      gctx.fillStyle = '#ffffff'; gctx.fill();
      gctx.lineWidth = 1.5; gctx.strokeStyle = '#000000'; gctx.stroke();
      gctx.beginPath();
      gctx.arc(q.x * sx, q.y * sy, q.r * sy, 0, Math.PI * 2);
      gctx.setLineDash([3, 3]); gctx.strokeStyle = 'rgba(255,255,255,.7)'; gctx.stroke(); gctx.setLineDash([]);
    }
  }
  function drawField(canvas, cols, rows = Math.max(1, Math.round((cols * params.height) / params.width))) {
    const grid = engine.fieldGrid(params, cols, rows);
    canvas.width = cols; canvas.height = rows;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(cols, rows);
    for (let i = 0; i < grid.length; i++) {
      const v = params.reverse ? 1 - grid[i] : grid[i];
      const g = Math.round((1 - v) * 255);
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = g;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }

  function flash(msg) {
    if (!msg) return;
    const n = $('#message');
    n.textContent = msg;
    n.hidden = false;
    clearTimeout(flash.t);
    flash.t = setTimeout(() => { n.hidden = true; }, 4000);
  }

  update();
  return { get params() { return params; }, get model() { return model; }, engine, share: () => encodeShare(snapshot()) };
}

const clamp = (v) => Math.min(1, Math.max(0, v));
