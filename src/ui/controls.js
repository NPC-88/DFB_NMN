// Generic control renderer: turns SCHEMA sections into collapsible panels of
// plain inputs. Placeholder UI — to adopt a UI kit, replace the `make*`
// branches (one per schema `type`); the app logic does not depend on them.

import { getPath } from '../core/schema.js';

export function renderControls(root, schema, ctx) {
  // ctx: { get(): params, set(key, value, { transient }) }
  // transient: while a slider is dragged; the release commits (one undo step).
  const rows = [];
  const bodies = {};
  for (const section of schema) {
    const box = panel(section.group, section.open);
    bodies[section.id] = box.body;
    for (const c of section.controls) {
      const row = el('div', { class: 'row' + (c.type === 'textarea' ? ' wide' : ''), 'data-key': c.key });
      const input = make(c, ctx);
      if (c.type !== 'textarea') row.append(el('label', { class: 'label' }, c.label));
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

// Collapsible section (native <details>, + / − marker in CSS).
export function panel(title, open = true) {
  const node = el('details', { class: 'panel' });
  node.open = open;
  node.append(el('summary', {}, title));
  const body = el('div', { class: 'panel-body' });
  node.append(body);
  return { node, body };
}

function make(c, ctx) {
  switch (c.type) {
    case 'textarea': {
      const t = el('textarea', { rows: 6, spellcheck: 'false', id: 'ctl-' + c.key.replace(/\W/g, '-'), 'aria-label': c.label });
      t.addEventListener('input', () => ctx.set(c.key, t.value, { transient: true }));
      t.addEventListener('change', () => ctx.set(c.key, t.value));
      return { node: t, set: (v) => { if (document.activeElement !== t) t.value = v ?? ''; } };
    }
    case 'toggle': {
      const t = el('input', { type: 'checkbox', id: 'ctl-' + c.key.replace(/\W/g, '-') });
      t.addEventListener('change', () => ctx.set(c.key, t.checked));
      return { node: t, set: (v) => { t.checked = !!v; } };
    }
    case 'segmented': {
      const wrap = el('div', { class: 'segmented', role: 'radiogroup' });
      const btns = c.options.map(([v, l]) => {
        const b = el('button', { type: 'button', 'data-value': v }, l);
        b.addEventListener('click', () => ctx.set(c.key, v));
        wrap.append(b);
        return b;
      });
      return { node: wrap, set: (v) => btns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.value === v))) };
    }
    case 'number': {
      const n = el('input', { type: 'number', min: c.min, max: c.max, step: c.step, id: 'ctl-' + c.key });
      n.addEventListener('change', () => { const v = parseFloat(n.value); if (Number.isFinite(v)) ctx.set(c.key, Math.min(c.max, Math.max(c.min, v))); });
      return { node: n, set: (v) => { if (document.activeElement !== n) n.value = v; } };
    }
    case 'range':
    default: {
      const wrap = el('div', { class: 'range' });
      const r = el('input', { type: 'range', min: c.min, max: c.max, step: c.step, id: 'ctl-' + c.key.replace(/\W/g, '-') });
      const out = el('output', { class: 'value' });
      wrap.append(r, out);
      const show = (v) => { out.textContent = c.step >= 1 ? Math.round(v) : (+v).toFixed(c.step < 0.01 ? 3 : 2); };
      r.addEventListener('input', () => { show(r.value); ctx.set(c.key, parseFloat(r.value), { transient: true }); });
      r.addEventListener('change', () => ctx.set(c.key, parseFloat(r.value)));
      return { node: wrap, set: (v) => { r.value = v; show(v); } };
    }
  }
}

export function el(tag, attrs = {}, text) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined) n.setAttribute(k, v);
  if (text !== undefined) n.textContent = text;
  return n;
}
