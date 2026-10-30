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
  rows are spread so nothing is ever cut at the top or bottom. Weight changes **per letter**,
  from 160 to 1000 (fixed for everyone).
- **Text** (closed by default; the Hymne is preset).
- **Typografie:** *Zeilenende* (Angeschnitten (default) / Flattersatz / Bündig) and
  *Zeilenabstand* (minimum line spacing, 1.0–1.6).
- **Verlauf**, always visible with its handles: *Wellen*, *Verlauf*, *Parametrisch* (linear or
  radial between two handles), *Punkte* (move, resize, delete, add). A Figma-style **stop bar**
  shapes the gradient in every mode; flip and 90° turn; *Kontrast*. Dark = heavy.
- **Moment merken** stores the current gradient as a keyframe for the Animation tab.
- Top bar: tabs *Werkzeug / Animation / Bibliothek*, colour (Hellgold auf Gold, Schwarz auf
  Graphit), format menu, save (to the library), SVG export type, download. Undo / redo / reset sit
  in the top-right corner of the preview; font size and zoom under it.
- **Animation** tab: only the gradient moves; the words stay on their rows (the row plan of the
  first moment is kept). Moments: reorder, time to the next moment, open in the tool, delete.
  *Fließen* adds an endless drift (seamless loop). Smooth or linear transitions; loop or back
  and forth. Live preview. Export **MP4** (H.264, Chrome / Edge / Safari) or **GIF**, 100 % or 50 %,
  25 / 30 fps (GIF 25), with progress and cancel.
- **Bibliothek** tab: saved patterns (with their moments) as previews; open, copy link, rename, delete.
- **Export:** SVG in the pattern colour only, no background: outlined paths (exact weights),
  paths + hidden live text, or live text only. Videos include the background colour.

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
  animate.js       moments → gradient at time t, Fließen
  field.js         wave field generator (0..1 at every point)
  font.js          variable-font adapter (fontkit): advances, kerning, outlines at any wght
  layout.js        repeats text in rows, assigns a weight per line/word/letter → plain model
  svg.js           model → SVG (outlines / live text / both)
  presets.js       palette, formats, Hymne preset (values from the supplied material)
  schema.js        every control: type, range, label — UIs render from this
  index.js         createEngine(fontBytes) → { layout, svg, fieldGrid, font }
src/ui/            UI in the DFB toolkit style (Figma node 26:43): app shell, animation tab +
                   video export (animation.js, render.js, video.js), controls from the schema, gradient editor,
                   library tab, store.js (browser or Firestore)
src/config.js      team library connection (Firebase project id + api key)
src/hosts/         web.js (font loading, saving) · figma-ui.js (parked)
docs/              GitHub Pages build
assets/icons/      DFB icons (from DFB_Icons.zip) + flip/rotate drawn to match
assets/fonts/      DFB Sans Pro variable web fonts (UI)
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
icon set. UI font: DFB Sans Pro (variable, upright + italic, `assets/fonts/`), embedded into the
pages by the build.
