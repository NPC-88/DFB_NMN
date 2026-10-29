# DFB Typo-Pattern (Männer-Nationalmannschaft)

Generates decorative typography patterns in **DFB SANS VAR Italic**: the text repeats in
straight, left-aligned rows, and a wave generated in the tool runs through it as a smooth
change of **weight** (continuous `wght`, 75–1000 — not a few fixed styles). Export: SVG in one
palette colour, no background. Same engine as a web tool and a Figma plugin.

First preset: **Hymne** (based on the Figma section *Männer Nationalmannschaft — DFB Sans VAR*).

## Use

```bash
npm install
npm run build      # unpacks the font from Archive.zip, builds dist/index.html and figma/ui.html
npm test
```

- **Web:** open `dist/index.html` (self-contained, works from disk).
- **Figma:** *Plugins → Development → Import plugin from manifest…* → `figma/manifest.json`
  (after `npm run build`).

### Controls

| Group | Controls |
|---|---|
| Text | text (one word to a long passage), capitals, keep line breaks, repeat: fill the frame / count |
| Komposition | format (1920×1080, Bus 2095×672, Bande 2095×504, custom), font size, line height, tracking, column width, offset X/Y, row end: ragged in column / run over the edge |
| Welle | **weight per line / word / letter**, lightest and heaviest weight, direction (less → more or more → less), shape (waves / single gradient), waveform (soft / linear), number of waves, direction angle, shift, bend + number of bends + bend shift, rounding (radial) + centre, contrast, lighter ↔ heavier, steps (0 = stepless) |
| Farbe | pattern colour (palette only), preview background (**not exported**), show the wave as an overlay |

### Export

- **Pfade (skalierbar)** — every word is one outlined `<path>` at its exact weight, grouped per
  row (`Zeile_01`, …) and named after the word and its weight (`EINIGKEIT_537`). Scales anywhere,
  needs no font, recolour via one fill.
- **Pfade + editierbarer Text** — same, plus the live text as a hidden layer (`Text_editierbar`).
- **Nur editierbarer Text** — `<text>`/`<tspan>` per unit with `font-variation-settings: 'wght' N`.

Figma plugin: *Einfügen: Pfade* (exact), *Einfügen: Text (stufenlos)* (one text layer per row,
weights bound to FLOAT variables in a collection „DFB Pattern Gewichte“, 5-unit steps),
*Einfügen: Text (4 Schnitte)* (nearest of Light/Regular/Bold/Black Italic), *SVG herunterladen*.

## Structure

```
src/core/          pattern engine — no DOM; runs in browser, Figma UI and Node
  field.js         wave field generator (0..1 at every point)
  font.js          variable-font adapter (fontkit): advances, kerning, outlines at any wght
  layout.js        repeats text in rows, assigns a weight per line/word/letter → plain model
  svg.js           model → SVG (outlines / live text / both)
  presets.js       palette, formats, Hymne preset (values from the supplied material)
  schema.js        every control: type, range, label — UIs render from this
  index.js         createEngine(fontBytes) → { layout, svg, fieldGrid, font }
src/ui/            placeholder UI (generic controls from the schema + preview)
src/hosts/         web.js (download) · figma-ui.js (talks to figma/code.js)
figma/             manifest.json, code.js (canvas side); ui.html is built
scripts/           build.mjs (esbuild, inlines everything), fonts.mjs (unpacks the font)
test/              node:test suites (engine, Figma plugin against a mock API) + render helpers
```

**Swapping the UI:** the app only needs `createEngine`, `SCHEMA` and the presets. A UI kit
replaces `src/ui/` (or just the `make*` functions in `controls.js`, one per control type);
engine, presets and export stay as they are.

```js
import { createEngine, HYMNE } from './src/core/index.js';
const engine = createEngine(fontBytes);
const model = engine.layout({ ...HYMNE.params, unit: 'letter', text: 'Mit dir.' });
const svg = engine.svg(model, { color: '#A60014', mode: 'outlines' });
```

## Sources and decisions

- **Font:** `DFB_SANS_VAR_Italic.ttf` from `Archive.zip` (v3.026, one axis `wght` 75–1000,
  named styles 145/400/650/925, italic only, kerning used). The Figma frames name it
  “DFB Sans Pro” (same weights); this tool uses the VAR file as asked.
- **Hymne preset:** Figma node 1:26 — 34.285 px, line height 100 %, tracking 1 %, 1560 px
  column in 1920 × 1080, weights 145 → 1000. Default colour Hellgold on a Gold preview, as in
  the reference. Figma's stepped stanza bands are replaced by a generated, gently bent wave.
- **Palette:** `DFB-Maenner-NM_Farben_Digital.ase` (Tiefschwarz, Graphitschwarz, Offwhite,
  Dunkelrot, Gold) + Figma colour board (Weiß, Offred, Hellgold — marked “NEU”).
- Weight only: no opacity or width changes.

## Limits

- **Variable font in SVG:** only the outlined export keeps the stepless weights everywhere.
  Live text needs DFB SANS VAR installed, and many apps ignore `font-variation-settings`
  (Figma's SVG import and Illustrator fall back to a named style).
- **Figma live text:** stepless weights rely on binding `fontWeight` to variables; not verified
  in Figma from here. If the binding is not supported, the plugin snaps to the four styles and
  says so. The font must be available in Figma.
- fontkit leaves empty glyphs (word spaces) at the default width; `font.js` applies the font's
  variation deltas itself (checked against fontTools, ±1 unit).
- **Licence:** the font's licence says it may not be given away, and this repository is public.
  `fonts/` and the built pages (which embed the font) are git-ignored; the font is only in
  `Archive.zip`, which is already in the repo.
