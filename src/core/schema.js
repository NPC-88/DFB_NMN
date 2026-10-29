// Control schema: every adjustable parameter, its type, range and label.
// UIs render from this list instead of hard-coding controls, so a future UI
// kit only needs a renderer for each `type`. `key` is a path into the params
// object ('field.angle' → params.field.angle).

export const SCHEMA = [
  { group: 'Text', controls: [
    { key: 'text', type: 'textarea', label: 'Text' },
    { key: 'uppercase', type: 'toggle', label: 'Versalien' },
    { key: 'keepLineBreaks', type: 'toggle', label: 'Zeilenumbrüche behalten' },
    { key: 'repeat', type: 'select', label: 'Wiederholung', options: [['fill', 'Fläche füllen'], ['count', 'Anzahl']] },
    { key: 'repeatCount', type: 'number', label: 'Anzahl', min: 1, max: 200, step: 1, when: (p) => p.repeat === 'count' },
  ] },
  { group: 'Komposition', controls: [
    { key: 'format', type: 'format', label: 'Format' },
    { key: 'width', type: 'number', label: 'Breite', min: 50, max: 10000, step: 1, unit: 'px' },
    { key: 'height', type: 'number', label: 'Höhe', min: 50, max: 10000, step: 1, unit: 'px' },
    { key: 'fontSize', type: 'range', label: 'Schriftgröße', min: 8, max: 200, step: 0.5, unit: 'px' },
    { key: 'lineHeight', type: 'range', label: 'Zeilenabstand', min: 0.7, max: 1.6, step: 0.01, unit: '×' },
    { key: 'tracking', type: 'range', label: 'Laufweite', min: -0.05, max: 0.15, step: 0.005, unit: 'em' },
    { key: 'boxWidth', type: 'range', label: 'Spaltenbreite', min: 50, max: 10000, step: 1, unit: 'px', maxFrom: 'width' },
    { key: 'boxX', type: 'range', label: 'Versatz X', min: -500, max: 500, step: 1, unit: 'px' },
    { key: 'boxY', type: 'range', label: 'Versatz Y', min: -500, max: 500, step: 1, unit: 'px' },
    { key: 'overflow', type: 'select', label: 'Zeilenende', options: [['wrap', 'Flattersatz in der Spalte'], ['bleed', 'Über den Rand laufen']] },
  ] },
  { group: 'Welle', controls: [
    { key: 'unit', type: 'segmented', label: 'Gewicht je', options: [['line', 'Zeile'], ['word', 'Wort'], ['letter', 'Buchstabe']] },
    { key: 'minWeight', type: 'range', label: 'Leichtestes Gewicht', min: 75, max: 1000, step: 1, unit: 'wght' },
    { key: 'maxWeight', type: 'range', label: 'Schwerstes Gewicht', min: 75, max: 1000, step: 1, unit: 'wght' },
    { key: 'reverse', type: 'toggle', label: 'Richtung umkehren (mehr → weniger)' },
    { key: 'field.shape', type: 'segmented', label: 'Form', options: [['waves', 'Wellen'], ['ramp', 'Verlauf']] },
    { key: 'field.waveform', type: 'segmented', label: 'Wellenform', options: [['sine', 'Weich'], ['triangle', 'Linear']], when: (p) => p.field.shape === 'waves' },
    { key: 'field.bands', type: 'range', label: 'Anzahl Wellen', min: 0.25, max: 12, step: 0.05, when: (p) => p.field.shape === 'waves' },
    { key: 'field.angle', type: 'range', label: 'Richtung', min: 0, max: 360, step: 1, unit: '°' },
    { key: 'field.phase', type: 'range', label: 'Verschiebung', min: 0, max: 1, step: 0.005, when: (p) => p.field.shape === 'waves' },
    { key: 'field.wobble', type: 'range', label: 'Biegung', min: 0, max: 0.5, step: 0.005 },
    { key: 'field.wobbleFreq', type: 'range', label: 'Biegungen', min: 0, max: 8, step: 0.05 },
    { key: 'field.wobblePhase', type: 'range', label: 'Biegung verschieben', min: 0, max: 1, step: 0.005 },
    { key: 'field.curve', type: 'range', label: 'Rundung', min: 0, max: 1, step: 0.01 },
    { key: 'field.cx', type: 'range', label: 'Zentrum X', min: 0, max: 1, step: 0.01, when: (p) => p.field.curve > 0 },
    { key: 'field.cy', type: 'range', label: 'Zentrum Y', min: 0, max: 1, step: 0.01, when: (p) => p.field.curve > 0 },
    { key: 'field.contrast', type: 'range', label: 'Kontrast', min: 0, max: 1, step: 0.01 },
    { key: 'field.offset', type: 'range', label: 'Leichter ↔ schwerer', min: -1, max: 1, step: 0.01 },
    { key: 'steps', type: 'range', label: 'Stufen (0 = stufenlos)', min: 0, max: 12, step: 1 },
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
