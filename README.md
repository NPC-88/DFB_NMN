# DFB Typo-Pattern (Männer-Nationalmannschaft)

Generates decorative typography patterns in **DFB SANS VAR Italic**: the text repeats in
straight, left-aligned rows, and a wave generated in the tool runs through it as a smooth
change of **weight** (continuous `wght`, 75–1000 — not a few fixed styles). Export: SVG in one
palette colour, no background. Same engine as a web tool and a Figma plugin.

First preset: **Hymne** (based on the Figma section *Männer Nationalmannschaft — DFB Sans VAR*).

## Use

**Team link (GitHub Pages):** `https://npc-88.github.io/DFB_NMN/` — served from `docs/`.
The font is embedded in the page (team decision), so it opens ready to use.

```bash
npm install
npm run build      # docs/ (Pages), dist/index.html + dist/artifact.html (font embedded)
npm test
```

### What the tool does

- Repeats the text in capitals until it **fills the format exactly**: the ink starts in the
  top-left corner, every row is justified to the full width (word spacing), and rows are spread
  so the last one sits on the bottom edge. Nothing is cut. Line height 1 (minimum) and tracking 0
  are fixed.
- **Verlauf** (gradient), always visible, ported from the HUK pattern generator:
  *Parametrisch* (Wellen, Kurve, Drehung) and *Punkte* (drag points; click adds, double-click
  removes, mouse wheel changes size). Plus Kontrast and Leichter ↔ schwerer. Dark = heavy.
- **Gewicht je** Zeile / Wort / Buchstabe, Umkehren, lightest/heaviest weight.
- **Format** presets or custom size, Schriftgröße; preview zoom (− / + / Einpassen / 100 %).
- **Farbe:** Hellgold auf Gold, Schwarz auf Graphit (as in Figma). Export = pattern colour only.
- **Bibliothek:** save settings by name (this browser), *Link kopieren* (the link opens exactly
  that pattern for anyone), export/import as JSON. The **Team** list is `docs/library.json`:
  add entries there (export from the tool, paste the items) and everyone sees them.
- **Export:** SVG as outlined paths (exact weights), paths + hidden live text, or live text only.

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
src/ui/            placeholder UI: controls from the schema, gradient panel, library, zoom
src/hosts/         web.js (font loading, saving) · figma-ui.js (parked)
docs/              GitHub Pages build + library.json (team library)
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
