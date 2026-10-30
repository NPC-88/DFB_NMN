// Control schema: every slider/toggle, its range and label, grouped. UIs
// render from this list, so a future UI kit only needs a renderer per `type`.
// The gradient editor (preview, handles, stops), format, colour and library
// are dedicated components in src/ui/. `key` is a path into the params.

const mode = (...m) => (p) => m.includes(p.field.mode);

export const SCHEMA = [
  { group: 'Text', id: 'text', open: false, controls: [
    { key: 'text', type: 'textarea', label: 'Text' },
  ] },
  { group: 'Typografie', id: 'type', open: true, controls: [
    { key: 'align', type: 'segmented', label: 'Zeilenende', options: [['cut', 'Angeschnitten'], ['ragged', 'Flattersatz'], ['justify', 'Bündig']] },
    { key: 'lineHeight', type: 'range', label: 'Zeilenabstand', min: 1, max: 1.6, step: 0.01, unit: '×' },
  ] },
  { group: 'Verlauf', id: 'gradient', open: true, controls: [
    { key: 'field.bands', type: 'range', label: 'Anzahl Wellen', min: 0.25, max: 12, step: 0.05, when: mode('waves') },
    { key: 'field.angle', type: 'range', label: 'Richtung', min: 0, max: 360, step: 1, unit: '°', when: mode('waves', 'ramp') },
    { key: 'field.phase', type: 'range', label: 'Verschiebung', min: 0, max: 1, step: 0.005, when: mode('waves') },
    { key: 'field.wobble', type: 'range', label: 'Biegung', min: 0, max: 0.5, step: 0.005, when: mode('waves', 'ramp') },
    { key: 'field.wobbleFreq', type: 'range', label: 'Biegungen', min: 0, max: 8, step: 0.05, when: mode('waves', 'ramp') },
    { key: 'field.waves', type: 'range', label: 'Wellen', min: 0, max: 1, step: 0.005, when: mode('parametric') },
    { key: 'field.bend', type: 'range', label: 'Wellenstärke', min: 0, max: 0.5, step: 0.005, when: (p) => p.field.mode === 'parametric' && p.field.waves > 0 },
    { key: 'field.size', type: 'range', label: 'Größe', min: 0, max: 1, step: 0.005, when: mode('points') },
    { key: 'field.contrast', type: 'range', label: 'Kontrast', min: 0, max: 1, step: 0.005 },
  ] },
];

// Fixed for every pattern (team decision): weight per letter, 160 → 1000,
// neutral lighter/heavier. Applied on load so older saved patterns match.
export const FIXED = { unit: 'letter', minWeight: 160, maxWeight: 1000 };
export const FIXED_FIELD = { offset: 0.5 };

export const FIELD_MODES = [['waves', 'Wellen'], ['ramp', 'Verlauf'], ['parametric', 'Parametrisch'], ['points', 'Punkte']];

export function getPath(obj, key) {
  return key.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
}

export function setPath(obj, key, value) {
  const ks = key.split('.');
  const last = ks.pop();
  let o = obj;
  for (const k of ks) o = o[k] = { ...(o[k] || {}) };
  o[last] = value;
  return obj;
}
