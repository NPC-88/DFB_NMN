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

// Colour pairs used in the Figma references: pattern colour on background.
// Only the pattern colour is exported; the background is for the preview.
export const COLOR_PAIRS = [
  { id: 'gold', name: 'Hellgold auf Gold', color: '#BAA98C', background: '#A9936F' },
  { id: 'graphit', name: 'Schwarz auf Graphit', color: '#000000', background: '#262626' },
];

export const FORMATS = [
  { id: 'fhd', name: '1920 × 1080', width: 1920, height: 1080 },
  { id: 'square', name: '1000 × 1000', width: 1000, height: 1000 },
  { id: 'bus', name: 'Bus 2095 × 672', width: 2095, height: 672 },
  { id: 'bande', name: 'Bande 2095 × 504', width: 2095, height: 504 },
  { id: 'custom', name: 'Eigene Größe', width: null, height: null },
];

export const HYMNE_TEXT =
  'Einigkeit und Recht und Freiheit für das deutsche Vaterland! ' +
  'Danach lasst uns alle streben brüderlich mit Herz und Hand! ' +
  'Einigkeit und Recht und Freiheit sind des Glückes Unterpfand – ' +
  'Blüh im Glanze dieses Glückes, blühe, deutsches Vaterland!';

// Hymne: 34.285 px as in Figma 1:26, weights 145 → 1000, fixed line height 1
// and tracking 0; the gradient is HUK's parametric default.
export const HYMNE = {
  id: 'hymne',
  name: 'Hymne',
  colorPair: 'gold',
  params: {
    text: HYMNE_TEXT,
    width: 1920, height: 1080,
    fontSize: 34.285,
    unit: 'word',
    minWeight: 145, maxWeight: 1000,
    reverse: false,
    field: {
      mode: 'parametric',
      waves: 0.4, curve: 0.5, rotate: 0.2,
      size: 0.5,
      points: [{ x: 0.25, y: 0.3, r: 0.18 }, { x: 0.7, y: 0.65, r: 0.22 }],
      contrast: 0, offset: 0.5,
    },
  },
};

export const PRESETS = [HYMNE];
