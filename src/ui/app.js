// App shell: state + undo history, top bar (tabs, colour, format, undo,
// save, export), preview with zoom and font size, the control panel with the
// gradient editor, and the library tab. Host-specific things (saving files)
// come from `host`; the library backend from `store`.

import { createEngine, SCHEMA, COLOR_PAIRS, FORMATS, PRESETS, setPath } from '../core/index.js';
import { renderControls, el } from './controls.js';
import { createGradientEditor } from './gradient.js';
import { createLibraryView, encodeShare, decodeShare } from './library.js';
import { icon, hydrateIcons } from './icons.js';

const clone = (o) => JSON.parse(JSON.stringify(o));
const ZOOMS = [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8];
const AUTHOR_KEY = 'dfb-pattern-author';

export function startApp({ fontBytes, host, store }) {
  const engine = createEngine(fontBytes);
  const preset = PRESETS[0];
  let params = clone(preset.params);
  let pairId = preset.colorPair;
  let zoom = 'fit';
  let model = null;

  const $ = (s) => document.querySelector(s);
  hydrateIcons();
  const viewport = $('#viewport'), stage = $('#stage'), art = $('#art');
  const pair = () => COLOR_PAIRS.find((c) => c.id === pairId) || COLOR_PAIRS[0];

  const shared = decodeShare(location.hash);
  if (shared) apply(shared);

  // --- undo history ----------------------------------------------------------
  const history = [JSON.stringify(snapshot())];
  let hi = 0;
  function commit() {
    const s = JSON.stringify(snapshot());
    if (s === history[hi]) return;
    history.splice(hi + 1);
    history.push(s);
    if (history.length > 200) history.shift();
    hi = history.length - 1;
    syncUndo();
  }
  function travel(d) {
    const n = hi + d;
    if (n < 0 || n >= history.length) return;
    hi = n;
    apply(JSON.parse(history[hi]));
    update(false);
    syncUndo();
  }
  function syncUndo() { $('#undo').disabled = hi <= 0; $('#redo').disabled = hi >= history.length - 1; }
  $('#undo').addEventListener('click', () => travel(-1));
  $('#redo').addEventListener('click', () => travel(1));
  document.addEventListener('keydown', (e) => {
    if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return;
    if (e.target.closest('input[type=text], input[type=search], textarea')) return;
    e.preventDefault();
    travel(e.shiftKey ? 1 : -1);
  });

  function set(key, value, opts = {}) { params = setPath(clone(params), key, value); update(!opts.transient); }
  function setField(patch, opts = {}) { params = { ...params, field: { ...params.field, ...patch } }; update(!opts.transient); }

  // --- tabs ------------------------------------------------------------------
  const tabs = document.querySelectorAll('[role=tab]');
  tabs.forEach((t) => t.addEventListener('click', () => showTab(t.dataset.tab)));
  function showTab(id) {
    tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === id)));
    $('#tool').hidden = id !== 'tool';
    $('#library').hidden = id !== 'library';
    document.body.dataset.tab = id;
    if (id === 'library') library.refresh();
    else layoutStage();
  }

  // --- colour (two swatches) -------------------------------------------------
  const pairBtns = COLOR_PAIRS.map((c) => {
    const b = el('button', { type: 'button', class: 'pair', title: c.name, 'aria-label': c.name, 'data-id': c.id });
    b.style.background = c.background;
    const ink = el('span', {}, 'Aa');
    ink.style.color = c.color;
    b.append(ink);
    b.addEventListener('click', () => { pairId = c.id; update(); });
    $('#colors').append(b);
    return b;
  });

  // --- format popover --------------------------------------------------------
  const fmtList = $('#formatList');
  for (const f of FORMATS.filter((x) => x.width)) {
    const b = el('button', { type: 'button', class: 'menu-item', 'data-id': f.id }, f.name);
    b.addEventListener('click', () => { params = { ...params, width: f.width, height: f.height }; zoom = 'fit'; update(); closePopovers(); });
    fmtList.append(b);
  }
  const fw = $('#fmtW'), fh = $('#fmtH');
  const setSize = () => {
    const w = Math.min(10000, Math.max(50, +fw.value || params.width)), h = Math.min(10000, Math.max(50, +fh.value || params.height));
    params = { ...params, width: w, height: h };
    zoom = 'fit';
    update();
  };
  fw.addEventListener('change', setSize);
  fh.addEventListener('change', setSize);

  // popovers (format, save)
  document.querySelectorAll('[data-popover]').forEach((btn) => {
    const pop = document.getElementById(btn.dataset.popover);
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = pop.hidden;
      closePopovers();
      pop.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
      if (open) { const f = pop.querySelector('input'); if (f) f.focus(); }
    });
    pop.addEventListener('click', (e) => e.stopPropagation());
  });
  document.addEventListener('click', closePopovers);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePopovers(); });
  function closePopovers() {
    document.querySelectorAll('.popover').forEach((p) => { p.hidden = true; });
    document.querySelectorAll('[data-popover]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
  }

  // --- controls + gradient editor --------------------------------------------
  const controls = renderControls($('#controls'), SCHEMA, { get: () => params, set });
  const gradBody = controls.bodies.gradient;
  const editorRoot = el('div', { class: 'grad-editor' });
  gradBody.prepend(editorRoot);
  const editor = createGradientEditor(editorRoot, {
    params: () => params,
    setField,
    fieldGrid: (cols, rows) => engine.fieldGrid(params, cols, rows),
  });

  // --- preview: zoom + font size ---------------------------------------------
  $('#zoomIn').addEventListener('click', () => stepZoom(1));
  $('#zoomOut').addEventListener('click', () => stepZoom(-1));
  $('#zoomFit').addEventListener('click', () => { zoom = 'fit'; layoutStage(); });
  $('#zoom100').addEventListener('click', () => { zoom = 1; layoutStage(); });
  new ResizeObserver(() => layoutStage()).observe(viewport);
  const fsRange = $('#fontSize'), fsNum = $('#fontSizeNum');
  fsRange.addEventListener('input', () => set('fontSize', +fsRange.value, { transient: true }));
  fsRange.addEventListener('change', () => set('fontSize', +fsRange.value));
  fsNum.addEventListener('change', () => { const v = Math.min(400, Math.max(4, +fsNum.value)); if (v) set('fontSize', v); });

  // --- reset, export ---------------------------------------------------------
  $('#reset').addEventListener('click', () => { params = clone(preset.params); pairId = preset.colorPair; zoom = 'fit'; window.history.replaceState(null, '', location.pathname); update(); });
  $('#exportMode').addEventListener('change', (e) => { $('#exportLabel').textContent = e.target.selectedOptions[0].textContent; });
  $('#download').addEventListener('click', async () => {
    if (!model) render();
    const name = `DFB-${preset.name}-${params.field.mode}-${params.width}x${params.height}`;
    const svg = engine.svg(model, { color: pair().color, mode: $('#exportMode').value, title: name });
    flash(await host.save({ filename: name + '.svg', data: svg }));
  });

  // --- library ---------------------------------------------------------------
  const library = createLibraryView($('#library'), {
    store,
    flash,
    onOpen: (it) => { apply(it.settings); zoom = 'fit'; showTab('tool'); update(); flash('Geöffnet: ' + it.name); },
    onCount: (n) => { $('#libCount').textContent = n ? String(n) : ''; },
  });
  const saveName = $('#saveName'), saveAuthor = $('#saveAuthor');
  try { saveAuthor.value = localStorage.getItem(AUTHOR_KEY) || ''; } catch { /* storage blocked */ }
  const saveDialog = $('#saveDialog');
  $('#saveBtn').addEventListener('click', () => { closePopovers(); saveDialog.showModal(); saveName.focus(); });
  $('#saveCancel').addEventListener('click', () => saveDialog.close());
  $('#saveForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = saveName.value.trim() || `Muster ${new Date().toLocaleString('de-DE')}`;
    const author = saveAuthor.value.trim();
    try { localStorage.setItem(AUTHOR_KEY, author); } catch { /* storage blocked */ }
    const btn = $('#saveForm button[type=submit]');
    btn.disabled = true;
    try {
      await library.save({ name, author, settings: snapshot(), thumb: await thumbnail() });
      saveName.value = '';
      saveDialog.close();
      flash(`Gespeichert: ${name} — zu finden unter „Bibliothek“.`);
    } catch (err) {
      flash('Speichern fehlgeschlagen: ' + err.message);
    } finally { btn.disabled = false; }
  });

  // --- state -----------------------------------------------------------------
  function apply(s) {
    if (s.params) params = { ...clone(preset.params), ...s.params, field: { ...preset.params.field, ...(s.params.field || {}) } };
    if (s.colorPair && COLOR_PAIRS.some((c) => c.id === s.colorPair)) pairId = s.colorPair;
  }
  function snapshot() { return { v: 2, params: clone(params), colorPair: pairId }; }

  let queued = false;
  function update(record = true) {
    if (record) commit();
    controls.sync();
    editor.sync();
    pairBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === pairId)));
    const f = FORMATS.find((x) => x.width === params.width && x.height === params.height);
    $('#formatBtn .dd-value').textContent = f ? f.name : `${params.width} × ${params.height}`;
    fmtList.querySelectorAll('.menu-item').forEach((b) => b.setAttribute('aria-pressed', String(f && b.dataset.id === f.id)));
    if (document.activeElement !== fw) fw.value = params.width;
    if (document.activeElement !== fh) fh.value = params.height;
    fsRange.value = params.fontSize;
    fsRange.style.setProperty('--fill', ((params.fontSize - fsRange.min) / (fsRange.max - fsRange.min)) * 100 + '%');
    if (document.activeElement !== fsNum) fsNum.value = +params.fontSize.toFixed(2);
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; render(); });
  }

  function render() {
    const t0 = performance.now();
    model = engine.layout(params);
    art.innerHTML = engine.svg(model, { color: pair().color, mode: 'outlines', precision: 1 });
    stage.style.background = pair().background;
    layoutStage();
    const ws = model.lines.flatMap((l) => l.runs.flatMap((r) => r.glyphs.map((g) => g.weight)));
    $('#status').textContent = ws.length
      ? `${params.width} × ${params.height} · ${model.lines.length} Zeilen · wght ${Math.min(...ws)}–${Math.max(...ws)} · ${Math.round(performance.now() - t0)} ms`
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

  // Small JPEG of the current pattern on its background, for the library grid.
  function thumbnail() {
    return new Promise((resolve) => {
      if (!model) render();
      const w = 480, h = Math.max(1, Math.round((w * params.height) / params.width));
      const svgText = engine.svg(model, { color: pair().color, mode: 'outlines', precision: 1 });
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d');
        ctx.fillStyle = pair().background;
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL('image/jpeg', 0.75));
      };
      img.onerror = () => resolve('');
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText);
    });
  }

  // Toast (toolkit: none / success / error), closes itself after 4 s.
  function flash(msg, kind) {
    if (!msg) return;
    kind = kind || (/fehl|nicht|Fehler|abgebrochen/i.test(msg) ? 'error' : /^(Gespeichert|Geöffnet|Link kopiert|Umbenannt|Gelöscht)/.test(msg) ? 'success' : 'none');
    const n = $('#toast');
    n.className = 'toast toast-' + kind;
    n.replaceChildren();
    if (kind !== 'none') n.append(icon(kind === 'success' ? 'success' : 'error', 20));
    const text = el('span', { class: 'toast-text' }, msg);
    const close = el('button', { type: 'button', class: 'btn btn-icon btn-ghost btn-small', 'aria-label': 'Schließen' });
    close.append(icon('close', 16));
    close.addEventListener('click', () => { n.hidden = true; });
    n.append(text, close);
    n.hidden = false;
    clearTimeout(flash.t);
    flash.t = setTimeout(() => { n.hidden = true; }, 4000);
  }

  showTab('tool');
  update(false);
  syncUndo();
  return { get params() { return params; }, get model() { return model; }, engine, share: () => encodeShare(snapshot()), library };
}
