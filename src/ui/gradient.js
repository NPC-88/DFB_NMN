// Gradient editor (like the HUK preview + Figma's gradient tools):
//   - mode: Wellen / Verlauf / Parametrisch / Punkte
//   - preview of the gradient (dark = heavy) with handles drawn on it:
//       Parametrisch: start and end handles (linear) or centre and edge (radial)
//       Punkte: drag the dot to move, drag the ring handle to resize, × to delete,
//               click empty space to add
//   - stop bar: drag stops, click the bar to add one, select one to set its
//     value or delete it; flip reverses it, rotate turns it by 90°
// All edits go through ctx.setField(patch, { transient }) so the app can keep
// undo history (transient = while dragging; the drop commits).

import { FIELD_MODES, stopMap } from '../core/index.js';
import { el, chips, slider, iconButton } from './controls.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs = {}) => { const n = document.createElementNS(SVGNS, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); return n; };

export function createGradientEditor(root, ctx) {
  // ctx: { params(), setField(patch, opts), fieldGrid(cols, rows) }
  const modes = chips(null, FIELD_MODES, (v) => ctx.setField({ mode: v }));
  modes.node.classList.add('modes');

  const typeBar = el('div', { class: 'grad-tools' });
  const types = chips(null, [['linear', 'Linear'], ['radial', 'Radial']], (v) => ctx.setField({ type: v }), { small: true });
  const flip = iconButton('flip', 'Verlauf umkehren');
  const turn = iconButton('rotate', 'Um 90° drehen');
  typeBar.append(types.node, el('span', { class: 'spacer' }), flip, turn);

  const stage = el('div', { class: 'grad-stage' });
  const canvas = el('canvas', { width: 240, height: 135, class: 'grad-canvas' });
  const overlay = svg('svg', { class: 'grad-overlay' });
  stage.append(canvas, overlay);

  const stopsWrap = el('div', { class: 'stops' });
  const bar = el('div', { class: 'stops-bar', 'data-tip': 'Klicken: Stopp hinzufügen' });
  const markers = el('div', { class: 'stops-markers' });
  stopsWrap.append(bar, markers);
  const stopRow = el('div', { class: 'stop-row' });
  const stopSlider = slider({ key: 'stop-value', label: 'Stopp', min: 0, max: 1, step: 0.005 },
    (v, transient) => setStop(selStop, { value: v }, transient));
  const stopLabel = stopSlider.node.querySelector('label');
  const stopDel = iconButton('remove', 'Stopp löschen');
  const stopAdd = iconButton('add', 'Stopp hinzufügen');
  stopRow.append(stopSlider.node, stopDel, stopAdd);

  root.append(modes.node, typeBar, stage, stopsWrap, stopRow);

  let selStop = 1;
  let selPoint = 0;
  const f = () => ctx.params().field;
  const stops = () => f().stops.map((s) => ({ ...s }));

  // --- stops ---------------------------------------------------------------
  flip.addEventListener('click', () => ctx.setField({ stops: stops().map((s) => ({ pos: 1 - s.pos, value: s.value })).reverse() }));
  turn.addEventListener('click', () => {
    const r = (q) => ({ x: 0.5 - (q.y - 0.5), y: 0.5 + (q.x - 0.5) });      // 90° around the centre
    if (f().mode === 'parametric') ctx.setField({ a: r(f().a), b: r(f().b) });
    else if (f().mode === 'waves' || f().mode === 'ramp') ctx.setField({ angle: (f().angle + 90) % 360 });
  });
  bar.addEventListener('pointerdown', (e) => {
    const pos = posFromEvent(e);
    const value = stopMap(f().stops)(pos);
    const next = [...stops(), { pos, value }].sort((a, b) => a.pos - b.pos);
    selStop = next.findIndex((s) => s.pos === pos);
    ctx.setField({ stops: next });
  });
  stopDel.addEventListener('click', () => deleteStop());
  stopAdd.addEventListener('click', () => {
    const s = stops().sort((a, b) => a.pos - b.pos);
    let gi = 0, gap = -1;
    for (let i = 0; i < s.length - 1; i++) if (s[i + 1].pos - s[i].pos > gap) { gap = s[i + 1].pos - s[i].pos; gi = i; }
    const pos = s[gi].pos + gap / 2;
    const next = [...s, { pos, value: stopMap(s)(pos) }].sort((a, b) => a.pos - b.pos);
    selStop = next.findIndex((q) => q.pos === pos);
    ctx.setField({ stops: next });
  });
  root.addEventListener('keydown', (e) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && e.target.closest('.stops-markers')) { e.preventDefault(); deleteStop(); }
    if ((e.key === 'Delete' || e.key === 'Backspace') && e.target.closest('.grad-overlay')) { e.preventDefault(); deletePoint(selPoint); }
  });

  function posFromEvent(e) { const r = bar.getBoundingClientRect(); return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)); }
  function setStop(i, patch, transient) { const s = stops(); if (!s[i]) return; s[i] = { ...s[i], ...patch }; ctx.setField({ stops: s }, { transient }); }
  function focusStop() { const n = markers.querySelectorAll('.stop')[selStop]; if (n) n.focus(); }
  function deleteStop() {
    const s = stops();
    if (s.length <= 2) return;
    s.splice(selStop, 1);
    selStop = Math.max(0, selStop - 1);
    ctx.setField({ stops: s });
  }

  // --- points / handles on the preview ---------------------------------------
  const size = () => { const r = canvas.getBoundingClientRect(); return { w: r.width || 1, h: r.height || 1, r }; };
  const toUV = (e) => { const { r } = size(); return { x: clamp((e.clientX - r.left) / r.width), y: clamp((e.clientY - r.top) / r.height) }; };

  // Track the pointer on the window: handles are redrawn while dragging.
  function drag(e, onMove, onEnd) {
    e.preventDefault();
    e.stopPropagation();
    const move = (ev) => onMove(toUV(ev), ev);
    const up = (ev) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      onEnd && onEnd(toUV(ev), ev);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }

  overlay.addEventListener('pointerdown', (e) => {
    if (f().mode !== 'points' || e.target !== overlay) return;
    const u = toUV(e);
    const pts = [...f().points, { x: u.x, y: u.y, r: 0.15 }];
    selPoint = pts.length - 1;
    ctx.setField({ points: pts });
  });

  function setPoint(i, patch, transient) { const pts = f().points.map((q, k) => (k === i ? { ...q, ...patch } : q)); ctx.setField({ points: pts }, { transient }); }
  function deletePoint(i) {
    const pts = f().points.filter((_, k) => k !== i);
    if (!pts.length) return;
    selPoint = Math.min(selPoint, pts.length - 1);
    ctx.setField({ points: pts });
  }

  function drawOverlay() {
    const { w, h } = size();
    overlay.setAttribute('viewBox', `0 0 ${w} ${h}`);
    overlay.replaceChildren();
    overlay.setAttribute('tabindex', '0');
    const fld = f();
    if (fld.mode === 'parametric') {
      const A = { x: fld.a.x * w, y: fld.a.y * h }, B = { x: fld.b.x * w, y: fld.b.y * h };
      if (fld.type === 'radial') overlay.append(svg('circle', { cx: A.x, cy: A.y, r: Math.hypot(B.x - A.x, B.y - A.y), class: 'ring' }));
      overlay.append(svg('line', { x1: A.x, y1: A.y, x2: B.x, y2: B.y, class: 'axis' }));
      for (const [key, P, cls] of [['a', A, 'start'], ['b', B, 'end']]) {
        const hnd = svg('rect', { x: P.x - 7, y: P.y - 7, width: 14, height: 14, rx: 2, class: 'handle ' + cls, transform: `rotate(45 ${P.x} ${P.y})` });
        hnd.addEventListener('pointerdown', (e) => drag(e, (u) => ctx.setField({ [key]: u }, { transient: true }), (u) => ctx.setField({ [key]: u })));
        overlay.append(hnd);
      }
    }
    if (fld.mode === 'points') {
      fld.points.forEach((q, i) => {
        const cx = q.x * w, cy = q.y * h, rr = q.r * h;
        const sel = i === selPoint;
        const g = svg('g', { class: 'pt' + (sel ? ' sel' : '') });
        const ring = svg('circle', { cx, cy, r: rr, class: 'ring' });
        const dot = svg('circle', { cx, cy, r: 6, class: 'dot' });
        const rh = svg('circle', { cx: cx + rr, cy, r: 5, class: 'resize' });
        const del = svg('g', { class: 'del', transform: `translate(${cx + rr * 0.707 + 2} ${cy - rr * 0.707 - 2})` });
        del.append(svg('circle', { r: 8 }), svg('path', { d: 'M-3,-3L3,3M3,-3L-3,3' }));
        del.append(Object.assign(svg('title'), { textContent: 'Punkt löschen' }));
        dot.addEventListener('pointerdown', (e) => { selPoint = i; drag(e, (u) => setPoint(i, { x: u.x, y: u.y }, true), (u) => setPoint(i, { x: u.x, y: u.y }, false)); });
        const resize = (u) => Math.min(0.8, Math.max(0.03, Math.hypot((u.x - q.x) * w, (u.y - q.y) * h) / h));
        rh.addEventListener('pointerdown', (e) => { selPoint = i; drag(e, (u) => setPoint(i, { r: resize(u) }, true), (u) => setPoint(i, { r: resize(u) }, false)); });
        del.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); deletePoint(i); });
        g.append(ring, dot, rh);
        if (fld.points.length > 1) g.append(del);
        overlay.append(g);
      });
    }
  }

  function drawCanvas() {
    const p = ctx.params();
    const cols = 240, rows = Math.max(1, Math.round((cols * p.height) / p.width));
    stage.style.aspectRatio = `${p.width} / ${p.height}`;
    const grid = ctx.fieldGrid(cols, rows);
    canvas.width = cols; canvas.height = rows;
    const c2 = canvas.getContext('2d');
    const img = c2.createImageData(cols, rows);
    for (let i = 0; i < grid.length; i++) {
      const g = Math.round((1 - grid[i]) * 255);
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = g;
      img.data[i * 4 + 3] = 255;
    }
    c2.putImageData(img, 0, 0);
  }

  function drawStops() {
    const s = f().stops;
    const map = stopMap(s);
    const parts = [];
    for (let i = 0; i <= 32; i++) { const g = Math.round((1 - map(i / 32)) * 255); parts.push(`rgb(${g},${g},${g}) ${(i / 32) * 100}%`); }
    bar.style.background = `linear-gradient(90deg, ${parts.join(',')})`;
    markers.replaceChildren();
    selStop = Math.min(selStop, s.length - 1);
    s.forEach((st, i) => {
      const g = Math.round((1 - st.value) * 255);
      const m = el('button', { type: 'button', class: 'stop' + (i === selStop ? ' sel' : ''), 'aria-label': `Stopp ${i + 1}` });
      m.style.left = st.pos * 100 + '%';
      m.style.setProperty('--swatch', `rgb(${g},${g},${g})`);
      m.addEventListener('pointerdown', (e) => {
        selStop = i;
        markers.querySelectorAll('.stop').forEach((n, k) => n.classList.toggle('sel', k === i));
        stopSlider.set(st.value);
        let moved = false;
        drag(e, (_, ev) => { moved = true; setStop(i, { pos: posFromEvent(ev) }, true); },
          (_, ev) => { if (moved) setStop(i, { pos: posFromEvent(ev) }, false); focusStop(); });
      });
      markers.append(m);
    });
    stopSlider.set(s[selStop] ? s[selStop].value : 0);
    stopLabel.textContent = s[selStop] ? `Stopp ${Math.round(s[selStop].pos * 100)} %` : 'Stopp';
    stopDel.disabled = s.length <= 2;
  }

  function sync() {
    const fld = f();
    modes.set(fld.mode);
    types.set(fld.type);
    types.node.hidden = fld.mode !== 'parametric';
    turn.hidden = fld.mode === 'points';
    drawCanvas();
    drawOverlay();
    drawStops();
  }

  new ResizeObserver(() => drawOverlay()).observe(stage);
  return { sync };
}

const clamp = (v) => Math.min(1, Math.max(0, v));
