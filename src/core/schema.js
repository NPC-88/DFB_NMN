// Control schema: every adjustable parameter, its type, range and label,
// grouped in sections. UIs render from this list instead of hard-coding
// controls, so a future UI kit only needs a renderer per `type`.
// `key` is a path into the params object ('field.waves' → params.field.waves).

const parametric = (p) => p.field.mode !== 'points';
const points = (p) => p.field.mode === 'points';

export const SCHEMA = [
  { group: 'Verlauf', open: true, controls: [
    { key: 'field.mode', type: 'segmented', label: 'Art', options: [['parametric', 'Parametrisch'], ['points', 'Punkte']] },
    { key: 'field.waves', type: 'range', label: 'Wellen', min: 0, max: 1, step: 0.005, when: parametric },
    { key: 'field.curve', type: 'range', label: 'Kurve', min: 0, max: 1, step: 0.005, when: parametric },
    { key: 'field.rotate', type: 'range', label: 'Drehung', min: 0, max: 1, step: 0.0025, when: parametric },
    { key: 'field.size', type: 'range', label: 'Größe', min: 0, max: 1, step: 0.005, when: points },
    { key: 'field.contrast', type: 'range', label: 'Kontrast', min: 0, max: 1, step: 0.005 },
    { key: 'field.offset', type: 'range', label: 'Leichter ↔ schwerer', min: 0, max: 1, step: 0.005 },
  ] },
  { group: 'Gewicht', open: true, controls: [
    { key: 'unit', type: 'segmented', label: 'Je', options: [['line', 'Zeile'], ['word', 'Wort'], ['letter', 'Buchstabe']] },
    { key: 'reverse', type: 'toggle', label: 'Umkehren' },
    { key: 'minWeight', type: 'range', label: 'Leichtestes', min: 75, max: 1000, step: 1 },
    { key: 'maxWeight', type: 'range', label: 'Schwerstes', min: 75, max: 1000, step: 1 },
  ] },
  { group: 'Format', open: true, controls: [
    { key: 'format', type: 'format', label: 'Format' },
    { key: 'width', type: 'number', label: 'Breite', min: 50, max: 10000, step: 1 },
    { key: 'height', type: 'number', label: 'Höhe', min: 50, max: 10000, step: 1 },
    { key: 'fontSize', type: 'range', label: 'Schriftgröße', min: 8, max: 300, step: 0.5 },
  ] },
  { group: 'Text', open: false, controls: [
    { key: 'text', type: 'textarea', label: 'Text' },
  ] },
];

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
