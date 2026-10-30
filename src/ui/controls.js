// Control renderer: turns SCHEMA sections into collapsible panels built from
// the DFB UI toolkit components (Figma "UI tool kit selection"):
//   range     → Range Slider (label left, value right in highlight, thin track)
//   segmented → Chips (active chip filled in highlight)
//   textarea  → Text Area (label + field)
//   toggle    → Switch
// The app logic does not depend on the markup; restyle here and in shell.html.

import { getPath } from '../core/schema.js';
import { icon } from './icons.js';

export function renderControls(root, schema, ctx) {
  // ctx: { get(): params, set(key, value, { transient }) }
  // transient: while a slider is dragged; the release commits (one undo step).
  const rows = [];
  const bodies = {};
  for (const section of schema) {
    const box = panel(section.group, section.open);
    bodies[section.id] = box.body;
    for (const c of section.controls) {
      const row = el('div', { class: 'row row-' + c.type, 'data-key': c.key });
      const input = make(c, ctx);
      row.append(input.node);
      box.body.append(row);
      rows.push({ c, row, input });
    }
    root.append(box.node);
  }
  const sync = () => {
    const p = ctx.get();
    for (const { c, row, input } of rows) {
      row.hidden = c.when ? !c.when(p) : false;
      input.set(getPath(p, c.key), p);
    }
  };
  sync();
  return { sync, bodies };
}

// Collapsible section (native <details>; chevron turns when open).
export function panel(title, open = true) {
  const node = el('details', { class: 'panel' });
  node.open = open;
  const sum = el('summary', {}, title);
  sum.append(icon('chevron', 20));
  node.append(sum);
  const body = el('div', { class: 'panel-body' });
  node.append(body);
  return { node, body };
}

const idOf = (key) => 'ctl-' + key.replace(/\W/g, '-');

function make(c, ctx) {
  switch (c.type) {
    case 'textarea': {
      const wrap = el('label', { class: 'field field-area' });
      wrap.append(el('span', { class: 'field-label' }, c.label));
      const t = el('textarea', { rows: 5, spellcheck: 'false', id: idOf(c.key) });
      wrap.append(t);
      t.addEventListener('input', () => ctx.set(c.key, t.value, { transient: true }));
      t.addEventListener('change', () => ctx.set(c.key, t.value));
      return { node: wrap, set: (v) => { if (document.activeElement !== t) t.value = v ?? ''; } };
    }
    case 'toggle': {
      const wrap = el('label', { class: 'switch' });
      const t = el('input', { type: 'checkbox', role: 'switch', id: idOf(c.key) });
      wrap.append(el('span', { class: 'switch-label' }, c.label), t, el('span', { class: 'switch-track', 'aria-hidden': 'true' }));
      t.addEventListener('change', () => ctx.set(c.key, t.checked));
      return { node: wrap, set: (v) => { t.checked = !!v; } };
    }
    case 'segmented':
      return chips(c.label, c.options, (v) => ctx.set(c.key, v));
    case 'range':
    default:
      return slider(c, (v, transient) => ctx.set(c.key, v, { transient }));
  }
}

// Chips: one choice out of a few. Returns { node, set(value) }.
export function chips(label, options, onPick, { small = false } = {}) {
  const wrap = el('div', { class: 'chip-group' });
  if (label) wrap.append(el('span', { class: 'group-label' }, label));
  const row = el('div', { class: 'chips' + (small ? ' small' : ''), role: 'radiogroup', 'aria-label': label || undefined });
  const btns = options.map(([v, l]) => {
    const b = el('button', { type: 'button', class: 'chip', role: 'radio', 'data-value': v }, l);
    b.addEventListener('click', () => onPick(v));
    row.append(b);
    return b;
  });
  wrap.append(row);
  return {
    node: wrap,
    set: (v) => btns.forEach((b) => { const on = b.dataset.value === v; b.setAttribute('aria-checked', String(on)); b.classList.toggle('active', on); }),
  };
}

// Range Slider: label + value on top, track below. onChange(value, transient).
export function slider(c, onChange) {
  const wrap = el('div', { class: 'slider' });
  const head = el('div', { class: 'slider-head' });
  const lab = el('label', { for: idOf(c.key) }, c.label);
  const out = el('output', { for: idOf(c.key) });
  head.append(lab, out);
  const r = el('input', { type: 'range', min: c.min, max: c.max, step: c.step, id: idOf(c.key) });
  wrap.append(head, r);
  const show = (v) => {
    out.textContent = (c.step >= 1 ? Math.round(v) : (+v).toFixed(c.step < 0.01 ? 2 : 2)) + (c.unit && c.unit !== '×' ? (c.unit === '°' ? '°' : ' ' + c.unit) : '');
    r.style.setProperty('--fill', ((v - c.min) / (c.max - c.min)) * 100 + '%');
  };
  r.addEventListener('input', () => { show(r.value); onChange(parseFloat(r.value), true); });
  r.addEventListener('change', () => onChange(parseFloat(r.value), false));
  return { node: wrap, set: (v) => { r.value = v; show(v); } };
}

export function el(tag, attrs = {}, text) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined) n.setAttribute(k, v);
  if (text !== undefined) n.textContent = text;
  return n;
}

// Icon button (toolkit Button, icon-only) with a tooltip.
export function iconButton(name, label, { variant = 'ghost', size = 'small' } = {}) {
  const b = el('button', { type: 'button', class: `btn btn-icon btn-${variant} btn-${size}`, 'aria-label': label, 'data-tip': label });
  b.append(icon(name, size === 'small' ? 18 : 20));
  return b;
}
