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

- Repeats the text in capitals until the format is full. The ink starts in the top-left corner;
  rows are spread so nothing is ever cut at the top or bottom. Line height 1 (minimum), tracking 0.
- **Zeilenende:** *Angeschnitten* (default, rows run past the right edge and are cut there),
  *Flattersatz* (left-aligned, ragged), *Bündig* (justified with word spacing).
- **Verlauf** (gradient), always visible with its handles:
  *Wellen* (repeating bands) and *Verlauf* (one gradient) from the first version; *Parametrisch*
  (linear or radial between two handles, plus HUK's sine "Wellen"); *Punkte* (drag the dot to move,
  the blue handle to resize, × to delete, click empty space to add).
  A Figma-style **stop bar** shapes the gradient in every mode (click the bar to add a stop, drag
  to move, select to set its value or delete; ⇄ flips, ⟳ turns 90°). Dark = heavy.
- **Gewicht je** Zeile / Wort / Buchstabe, lightest/heaviest weight.
- Top bar: tabs *Werkzeug / Bibliothek*, colour (Hellgold auf Gold, Schwarz auf Graphit), format
  menu (presets + custom size), undo/redo (⌘Z / ⇧⌘Z), *Speichern*, SVG export.
  Font size and zoom sit under the preview.
- **Bibliothek** tab: saved patterns as previews; open, copy link, rename, delete.
- **Export:** SVG in the pattern colour only, no background: outlined paths (exact weights),
  paths + hidden live text, or live text only.

### Team library (Firebase, free)

Until it is connected, saved patterns stay in each person's browser. To share one library:

1. With a team Google account, open <https://console.firebase.google.com> → *Add project*
   (Google Analytics not needed). The free *Spark* plan needs no credit card.
2. *Build → Firestore Database → Create database*, location `eur3 (europe-west)`, *production mode*.
3. *Rules* tab, paste and publish:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{db}/documents {
       match /patterns/{id} {
         allow read: if true;
         allow create: if request.resource.data.keys().hasOnly(['name','author','thumb','settings','created'])
                       && request.resource.data.name is string && request.resource.data.name.size() < 120
                       && request.resource.data.settings.size() < 200000 && request.resource.data.thumb.size() < 400000;
         allow update: if request.resource.data.diff(resource.data).affectedKeys().hasOnly(['name']);
         allow delete: if true;
       }
     }
   }
   ```
4. *Project settings → General → Your apps → Web (</>)*, register an app, copy `projectId` and
   `apiKey` into `src/config.js`, run `npm run build`, commit.

Anyone with the page link can read, add, rename and delete patterns (no login), which suits an
internal tool; the free plan allows 50,000 reads and 20,000 writes per day.

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
src/ui/            UI in the DFB toolkit style (Figma node 26:43): app shell, controls from the schema, gradient editor,
                   library tab, store.js (browser or Firestore)
src/config.js      team library connection (Firebase project id + api key)
src/hosts/         web.js (font loading, saving) · figma-ui.js (parked)
docs/              GitHub Pages build
assets/icons/      DFB icons (from DFB_Icons.zip) + flip/rotate drawn to match
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

## UI

Built from the DFB UI toolkit (Figma "UI tool kit selection"): Tab Bar, Buttons (primary,
secondary, ghost, icon), Chips, Range Slider, Dropdown, Input Field, Text Area, Modal, Toast,
Card, Tooltip; colours, radii and shadows from its variables (light only). Icons from the DFB
icon set. The UI font is DFB Sans Pro / DFB Sans Web: until those files are added, the page uses
the system font (add `@font-face` rules in `src/ui/shell.html` when they arrive).
