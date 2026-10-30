// Animation tab: the gradient moves, the text stays on its rows.
//   Momente  — marked in the tool ("Moment merken"); reorder, set the time to the
//              next one, open one in the tool, delete
//   Bewegung — Fließen (endless drift), Übergang (smooth/linear), Ablauf
//              (loop / back and forth), length when there are fewer than two moments
//   Export   — MP4 or GIF, full or half size, 25/30 fps (GIF 25), with progress
// The preview plays live at screen resolution; the export renders every frame.

import { animLength, fieldAt } from '../core/index.js';
import { panel, el, chips, slider, iconButton } from './controls.js';
import { icon } from './icons.js';
import { drawModel, drawField } from './render.js';
import { exportMP4, exportGIF, mp4Supported } from './video.js';

export function createAnimationView(root, ctx) {
  // ctx: { engine, params(), pair(), anim(), setAnim(patch, { transient }), openMoment(i), flash, save(file) }
  const main = el('main', { class: 'anim-main' });
  const viewport = el('div', { class: 'anim-viewport' });
  const canvas = el('canvas', { class: 'anim-canvas' });
  viewport.append(canvas);
  const transport = el('div', { class: 'previewbar' });
  const playBtn = iconButton('play', 'Abspielen', { variant: 'primary', size: 'medium' });
  const scrub = el('input', { type: 'range', min: 0, max: 1, step: 0.001, value: 0, 'aria-label': 'Zeit', class: 'scrub' });
  const timeLabel = el('span', { class: 'time' }, '0,0 / 8,0 s');
  const fpsLabel = el('span', { id: 'animStatus' });
  transport.append(playBtn, scrub, timeLabel, fpsLabel);
  main.append(viewport, transport);

  const aside = el('aside', { class: 'anim-aside' });
  // Momente
  const mBox = panel('Momente', true);
  const list = el('ol', { class: 'moments' });
  const emptyHint = el('p', { class: 'hint' }, 'Noch keine Momente. Im Werkzeug den Verlauf einstellen und „Moment merken“ klicken – mindestens zwei, damit sich etwas bewegt. Oder hier „Fließen“ einschalten.');
  mBox.body.append(list, emptyHint);
  // Bewegung
  const bBox = panel('Bewegung', true);
  const flowRow = el('label', { class: 'switch' });
  const flowInput = el('input', { type: 'checkbox', role: 'switch', id: 'anim-flow' });
  flowRow.append(el('span', { class: 'switch-label' }, 'Fließen'), flowInput, el('span', { class: 'switch-track', 'aria-hidden': 'true' }));
  flowInput.addEventListener('change', () => ctx.setAnim({ flow: flowInput.checked }));
  const turns = chips('Fließen pro Durchlauf', [['1', '1×'], ['2', '2×'], ['3', '3×']], (v) => ctx.setAnim({ flowTurns: +v }), { small: true });
  const easing = chips('Übergang', [['smooth', 'Weich'], ['linear', 'Linear']], (v) => ctx.setAnim({ easing: v }), { small: true });
  const loop = chips('Ablauf', [['loop', 'Schleife'], ['pingpong', 'Hin und zurück']], (v) => ctx.setAnim({ loop: v }), { small: true });
  const length = slider({ key: 'anim-length', label: 'Länge', min: 5, max: 10, step: 0.5, unit: 's' }, (v, transient) => ctx.setAnim({ length: v }, { transient }));
  const total = el('p', { class: 'hint' });
  bBox.body.append(flowRow, turns.node, easing.node, loop.node, length.node, total);
  // Export
  const xBox = panel('Export', true);
  const fmt = chips('Format', [['mp4', 'MP4'], ['gif', 'GIF']], (v) => { exportOpts.format = v; syncExport(); }, { small: true });
  const size = chips('Größe', [['1', '100 %'], ['0.5', '50 %']], (v) => { exportOpts.scale = +v; syncExport(); }, { small: true });
  const rate = chips('Bilder pro Sekunde', [['25', '25'], ['30', '30']], (v) => { exportOpts.fps = +v; syncExport(); }, { small: true });
  const xInfo = el('p', { class: 'hint' });
  const xBtn = el('button', { type: 'button', class: 'btn btn-primary btn-medium', id: 'videoExport' });
  xBtn.append(icon('download', 20), document.createTextNode('Video exportieren'));
  const progress = el('div', { class: 'progress', hidden: '' });
  const bar = el('div', { class: 'progress-bar' });
  const pLabel = el('span', { class: 'progress-label' });
  const cancel = el('button', { type: 'button', class: 'btn btn-ghost btn-small' }, 'Abbrechen');
  progress.append(el('div', { class: 'progress-track' }, ''), pLabel, cancel);
  progress.firstChild.append(bar);
  xBox.body.append(fmt.node, size.node, rate.node, xInfo, xBtn, progress);
  aside.append(mBox.node, bBox.node, xBox.node);
  root.append(main, aside);

  const exportOpts = { format: 'mp4', scale: 1, fps: 25 };
  let playing = false, t0 = 0, tNow = 0, raf = 0, plan = null, planKey = '', busy = false, abort = null;
  let lastDraw = 0, frames = 0, fpsShown = 0;

  // --- preview ---------------------------------------------------------------
  function rowPlan() {
    const p = ctx.params(), a = ctx.anim();
    const key = JSON.stringify({ ...p, field: null }) + JSON.stringify(a.moments[0] || null);
    if (key !== planKey) {
      planKey = key;
      plan = ctx.engine.layout({ ...p, field: fieldAt(p.field, a, 0) }).plan;
    }
    return plan;
  }

  function draw(t) {
    const p = ctx.params(), a = ctx.anim();
    const r = viewport.getBoundingClientRect();
    const fit = Math.min((r.width - 32) / p.width, (r.height - 32) / p.height);
    const cssW = Math.max(1, Math.floor(p.width * fit)), cssH = Math.max(1, Math.floor(p.height * fit));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = Math.min(p.width, Math.round(cssW * dpr)), ch = Math.round((cw * p.height) / p.width);
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    const model = ctx.engine.layout({ ...p, field: fieldAt(p.field, a, t), plan: rowPlan() });
    drawModel(canvas.getContext('2d'), model, ctx.engine.font, { color: ctx.pair().color, background: ctx.pair().background, k: cw / p.width });
  }

  function frame(now) {
    if (!playing) return;
    const L = animLength(ctx.anim());
    tNow = ((now - t0) / 1000) % L;
    draw(tNow);
    frames++;
    if (now - lastDraw > 1000) { fpsShown = frames; frames = 0; lastDraw = now; }
    syncTime(L);
    raf = requestAnimationFrame(frame);
  }
  function setPlaying(on) {
    playing = on;
    playBtn.replaceChildren(icon(on ? 'pause' : 'play', 20));
    playBtn.setAttribute('aria-label', on ? 'Pause' : 'Abspielen');
    playBtn.dataset.tip = on ? 'Pause' : 'Abspielen';
    cancelAnimationFrame(raf);
    if (on) { t0 = performance.now() - tNow * 1000; lastDraw = performance.now(); frames = 0; raf = requestAnimationFrame(frame); }
    else fpsShown = 0;
    syncTime(animLength(ctx.anim()));
  }
  playBtn.addEventListener('click', () => setPlaying(!playing));
  scrub.addEventListener('input', () => { setPlaying(false); tNow = +scrub.value * animLength(ctx.anim()); draw(tNow); syncTime(animLength(ctx.anim())); });
  new ResizeObserver(() => { if (!root.hidden) draw(tNow); }).observe(viewport);

  function syncTime(L) {
    scrub.value = L ? tNow / L : 0;
    timeLabel.textContent = `${fmtS(tNow)} / ${fmtS(L)} s`;
    fpsLabel.textContent = playing && fpsShown ? `Vorschau ${fpsShown} B/s` : '';
  }

  // --- moments list ----------------------------------------------------------
  function drawMoments() {
    const a = ctx.anim(), p = ctx.params();
    const n = a.moments.length;
    list.replaceChildren();
    emptyHint.hidden = n > 0;
    a.moments.forEach((m, i) => {
      const li = el('li', { class: 'moment' });
      const thumb = el('canvas', { class: 'moment-thumb', 'aria-hidden': 'true' });
      const cols = 96, rows = Math.max(1, Math.round((cols * p.height) / p.width));
      drawField(thumb, ctx.engine.fieldGrid({ ...p, field: m.field }, cols, rows), cols, rows);
      const body = el('div', { class: 'moment-body' });
      body.append(el('strong', {}, `Moment ${i + 1}`));
      const showDur = n > 1 && !(a.loop === 'pingpong' && i === n - 1);
      if (showDur) {
        const next = i === n - 1 ? 1 : i + 2;
        const dur = slider({ key: `dur-${i}`, label: `→ Moment ${next}`, min: 0.3, max: 6, step: 0.1, unit: 's' }, (v, transient) => {
          const d = [...a.durations]; while (d.length < n) d.push(2); d[i] = v; ctx.setAnim({ durations: d }, { transient });
        });
        dur.set(a.durations[i] ?? 2);
        body.append(dur.node);
      }
      const acts = el('div', { class: 'moment-actions' });
      const upB = iconButton('up', 'Nach oben'), downB = iconButton('down', 'Nach unten');
      const openB = iconButton('edit', 'Im Werkzeug öffnen'), delB = iconButton('trash', 'Löschen');
      upB.disabled = i === 0; downB.disabled = i === n - 1;
      upB.addEventListener('click', () => move(i, -1));
      downB.addEventListener('click', () => move(i, 1));
      openB.addEventListener('click', () => ctx.openMoment(i));
      delB.addEventListener('click', () => {
        const ms = a.moments.filter((_, k) => k !== i), d = a.durations.filter((_, k) => k !== i);
        ctx.setAnim({ moments: ms, durations: d });
      });
      acts.append(upB, downB, openB, delB);
      li.append(thumb, body, acts);
      list.append(li);
    });
  }
  function move(i, dir) {
    const a = ctx.anim();
    const ms = [...a.moments], d = [...a.durations];
    const j = i + dir;
    [ms[i], ms[j]] = [ms[j], ms[i]];
    [d[i], d[j]] = [d[j], d[i]];
    ctx.setAnim({ moments: ms, durations: d });
  }

  // --- export ----------------------------------------------------------------
  function syncExport() {
    const p = ctx.params(), a = ctx.anim();
    fmt.set(exportOpts.format);
    size.set(String(exportOpts.scale));
    const fps = exportOpts.format === 'gif' ? 25 : exportOpts.fps;
    rate.set(String(fps));
    rate.node.hidden = exportOpts.format === 'gif';
    const w = Math.round(p.width * exportOpts.scale), h = Math.round(p.height * exportOpts.scale);
    const L = animLength(a), n = Math.round(L * fps);
    const mp4Note = exportOpts.format === 'mp4' && !mp4Supported() ? ' · MP4 geht in diesem Browser nicht (Chrome, Edge oder Safari verwenden)' : '';
    xInfo.textContent = `${w} × ${h} px · ${fmtS(L)} s · ${n} Bilder${exportOpts.format === 'gif' ? ' · GIF-Dateien werden groß' : ''}${mp4Note}`;
  }

  xBtn.addEventListener('click', async () => {
    if (busy) return;
    const p = ctx.params(), a = ctx.anim(), pair = ctx.pair();
    const fps = exportOpts.format === 'gif' ? 25 : exportOpts.fps;
    const L = animLength(a), total = Math.round(L * fps);
    const w = Math.round(p.width * exportOpts.scale), h = Math.round(p.height * exportOpts.scale);
    const fixedPlan = rowPlan();
    const renderFrame = (c2, i, t) => {
      const model = ctx.engine.layout({ ...p, field: fieldAt(p.field, a, t), plan: fixedPlan });
      drawModel(c2, model, ctx.engine.font, { color: pair.color, background: pair.background, k: c2.canvas.width / p.width });
    };
    setPlaying(false);
    busy = true;
    abort = new AbortController();
    xBtn.disabled = true;
    progress.hidden = false;
    const started = performance.now();
    const onProgress = (q) => {
      bar.style.width = (q * 100).toFixed(1) + '%';
      const el2 = (performance.now() - started) / 1000, rest = q > 0.02 ? el2 / q - el2 : null;
      pLabel.textContent = `${Math.round(q * 100)} %` + (rest != null ? ` · noch ca. ${Math.ceil(rest)} s` : '');
    };
    onProgress(0);
    try {
      const opts = { width: w, height: h, fps, frames: total, renderFrame, onProgress, signal: abort.signal, background: pair.background, color: pair.color };
      const blob = exportOpts.format === 'gif' ? await exportGIF(opts) : await exportMP4(opts);
      const name = `DFB-Animation-${w}x${h}-${fmtS(L).replace(",", "_")}s.${exportOpts.format}`;
      ctx.flash(await ctx.save({ filename: name, data: blob }));
    } catch (e) {
      ctx.flash(e && e.name === 'AbortError' ? 'Export abgebrochen.' : 'Export fehlgeschlagen: ' + (e && e.message));
    } finally {
      busy = false;
      xBtn.disabled = false;
      progress.hidden = true;
    }
  });
  cancel.addEventListener('click', () => abort && abort.abort());

  // --- sync --------------------------------------------------------------------
  function sync() {
    const a = ctx.anim();
    flowInput.checked = !!a.flow;
    turns.set(String(a.flowTurns || 1));
    turns.node.hidden = !a.flow;
    easing.set(a.easing);
    loop.set(a.loop);
    const many = a.moments.length >= 2;
    easing.node.hidden = loop.node.hidden = !many;
    length.node.hidden = many;
    length.set(a.length);
    const L = animLength(a);
    total.textContent = `Gesamtlänge ${fmtS(L)} s, läuft als Schleife.`;
    drawMoments();
    syncExport();
    if (tNow > L) tNow = 0;
    syncTime(L);
    if (!root.hidden && !playing) draw(tNow);
  }

  // While a slider in this tab is dragged: only the numbers and the preview.
  function light() {
    const L = animLength(ctx.anim());
    total.textContent = `Gesamtlänge ${fmtS(L)} s, läuft als Schleife.`;
    syncExport();
    syncTime(L);
    if (!playing) draw(tNow);
  }

  return {
    sync,
    light,
    show() { sync(); draw(tNow); },
    hide() { setPlaying(false); },
  };
}

const fmtS = (s) => (Math.round(s * 10) / 10).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
