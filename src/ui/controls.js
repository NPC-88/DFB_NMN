// Generic control renderer: turns SCHEMA entries into plain DOM inputs.
// Placeholder UI — to adopt a UI kit, replace the `make*` functions (one per
// schema `type`); the app logic does not depend on how controls look.

import { getPath } from '../core/schema.js';

export function renderControls(root, schema, ctx) {
  // ctx: { get(): params, set(key, value), formats, onFormat(id) }
  root.innerHTML = '';
  const rows = [];
  for (const section of schema) {
    const fs = el('fieldset', { class: 'group' });
    fs.append(el('legend', {}, section.group));
    for (const c of section.controls) {
      const row = el('div', { class: 'row', 'data-key': c.key });
      const input = make(c, ctx);
      row.append(el('label', { class: 'label' }, c.label), input.node);
      fs.append(row);
      rows.push({ c, row, input });
    }
    root.append(fs);
  }
  const sync = () => {
    const p = ctx.get();
    for (const { c, row, input } of rows) {
      row.hidden = c.when ? !c.when(p) : false;
      input.set(c.type === 'format' ? ctx.formatOf(p) : getPath(p, c.key), p);
    }
  };
  sync();
  return { sync };
}

function make(c, ctx) {
  switch (c.type) {
    case 'textarea': {
      const t = el('textarea', { rows: 5, spellcheck: 'false' });
      t.addEventListener('input', () => ctx.set(c.key, t.value));
      return { node: t, set: (v) => { if (document.activeElement !== t) t.value = v ?? ''; } };
    }
    case 'toggle': {
      const t = el('input', { type: 'checkbox' });
      t.addEventListener('change', () => ctx.set(c.key, t.checked));
      return { node: t, set: (v) => { t.checked = !!v; } };
    }
    case 'select':
    case 'format': {
      const opts = c.type === 'format' ? ctx.formats.map((f) => [f.id, f.name]) : c.options;
      const s = el('select');
      for (const [v, l] of opts) s.append(el('option', { value: v }, l));
      s.addEventListener('change', () => (c.type === 'format' ? ctx.onFormat(s.value) : ctx.set(c.key, s.value)));
      return { node: s, set: (v) => { s.value = v; } };
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
      const n = el('input', { type: 'number', min: c.min, max: c.max, step: c.step });
      n.addEventListener('change', () => { const v = parseFloat(n.value); if (Number.isFinite(v)) ctx.set(c.key, v); });
      return { node: n, set: (v) => { if (document.activeElement !== n) n.value = v; } };
    }
    case 'range':
    default: {
      const wrap = el('div', { class: 'range' });
      const r = el('input', { type: 'range', min: c.min, max: c.max, step: c.step });
      const n = el('input', { type: 'number', min: c.min, step: c.step, class: 'value' });
      wrap.append(r, n);
      r.addEventListener('input', () => { n.value = r.value; ctx.set(c.key, parseFloat(r.value)); });
      n.addEventListener('change', () => { const v = parseFloat(n.value); if (Number.isFinite(v)) ctx.set(c.key, v); });
      return {
        node: wrap,
        set: (v, p) => {
          if (c.maxFrom) r.max = getPath(p, c.maxFrom);
          r.value = v;
          if (document.activeElement !== n) n.value = v;
        },
      };
    }
  }
}

export function el(tag, attrs = {}, text) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined) n.setAttribute(k, v);
  if (text !== undefined) n.textContent = text;
  return n;
}
