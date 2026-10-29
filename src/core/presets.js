// Brand data and presets. Only values found in the supplied material:
//   - colours: DFB-Maenner-NM_Farben_Digital.ase (Archive.zip) + the Figma colour
//     board (section "Männer Nationalmannschaft — DFB Sans VAR", node 1:40)
//   - type: Figma frame "Strophe mit Wiederholung für Welle" (node 1:26)

export const PALETTE = [
  { id: 'tiefschwarz', name: 'DFB-Tiefschwarz', hex: '#000000', source: 'ase' },
  { id: 'graphit', name: 'DFB-Graphitschwarz', hex: '#262626', source: 'ase' },
  { id: 'offwhite', name: 'DFB-Offwhite', hex: '#F5F5F5', source: 'ase' },
  { id: 'weiss', name: 'Weiß', hex: '#FFFFFF', source: 'figma' },
  { id: 'dunkelrot', name: 'DFB-Dunkelrot', hex: '#A60014', source: 'ase' },
  { id: 'offred', name: 'DFB-Offred', hex: '#7A071A', source: 'figma (NEU)' },
  { id: 'gold', name: 'DFB-Gold', hex: '#A9936F', source: 'ase' },
  { id: 'hellgold', name: 'DFB-Hellgold', hex: '#BAA98C', source: 'figma (NEU)' },
];

export const FORMATS = [
  { id: 'fhd', name: '1920 × 1080', width: 1920, height: 1080 },
  { id: 'bus', name: 'Bus 2095 × 672', width: 2095, height: 672 },
  { id: 'bande', name: 'Bande 2095 × 504', width: 2095, height: 504 },
  { id: 'custom', name: 'Eigene Größe', width: null, height: null },
];

export const HYMNE_TEXT =
  'Einigkeit und Recht und Freiheit für das deutsche Vaterland! ' +
  'Danach lasst uns alle streben brüderlich mit Herz und Hand! ' +
  'Einigkeit und Recht und Freiheit sind des Glückes Unterpfand – ' +
  'Blüh im Glanze dieses Glückes, blühe, deutsches Vaterland!';

// Hymne: type settings from Figma 1:26 (34.285 px, line height 100 %,
// tracking 1 %, 1560 px column in 1920 × 1080, weights 145 → 1000), with the
// stepped stanza bands replaced by a generated, gently bent wave.
export const HYMNE = {
  id: 'hymne',
  name: 'Hymne',
  color: '#BAA98C',            // Hellgold — as on the Gold reference
  previewBackground: '#A9936F',
  params: {
    text: HYMNE_TEXT,
    uppercase: true,
    keepLineBreaks: false,
    repeat: 'fill',
    repeatCount: 3,
    separator: ' ',
    width: 1920, height: 1080,
    fontSize: 34.285,
    lineHeight: 1.0,
    tracking: 0.01,
    boxX: 0, boxY: -3, boxWidth: 1560,
    overflow: 'wrap',
    unit: 'word',
    minWeight: 145, maxWeight: 1000,
    reverse: false,
    steps: 0,
    field: {
      shape: 'waves', waveform: 'sine',
      angle: 90, bands: 1.5, phase: 0,
      wobble: 0.08, wobbleFreq: 1, wobblePhase: 0,
      curve: 0, cx: 0.5, cy: 0.5,
      contrast: 0, offset: 0,
    },
  },
};

export const PRESETS = [HYMNE];
