// Figma plugin UI host: same app, actions talk to figma/code.js.
import fontB64 from 'font:DFB_SANS_VAR_Italic.ttf';
import { startApp } from '../ui/app.js';

const bytes = Uint8Array.from(atob(fontB64), (c) => c.charCodeAt(0));
const post = (msg) => parent.postMessage({ pluginMessage: msg }, '*');

// Only what the plugin needs to rebuild the pattern as Figma text.
function textModel(model, color, name) {
  return {
    name, color,
    width: model.width, height: model.height,
    fontSize: model.fontSize, tracking: model.params.tracking, lineHeight: model.params.lineHeight,
    lines: model.lines.map((l) => ({
      top: l.top,
      runs: l.runs.map((r) => ({ text: r.text, x: r.x, weight: r.weight, glyphs: r.weight == null ? r.glyphs.map((g) => ({ chars: g.chars, weight: g.weight })) : undefined })),
    })),
  };
}

let listener = null;
window.onmessage = (e) => { const m = e.data && e.data.pluginMessage; if (m && m.type === 'notice' && listener) listener(m.text); };

window.dfbPattern = startApp({
  fontBytes: bytes,
  host: {
    onMessage: (fn) => { listener = fn; },
    actions: [
      { label: 'Einfügen: Pfade', primary: true, mode: 'outlines',
        run: ({ svg, name }) => { post({ type: 'insert-svg', svg, name }); return 'Wird eingefügt…'; } },
      { label: 'Einfügen: Text (stufenlos)',
        run: ({ model, color, name }) => { post({ type: 'insert-text', model: textModel(model, color, name), variable: true }); return 'Wird eingefügt…'; } },
      { label: 'Einfügen: Text (4 Schnitte)',
        run: ({ model, color, name }) => { post({ type: 'insert-text', model: textModel(model, color, name), variable: false }); return 'Wird eingefügt…'; } },
      { label: 'SVG herunterladen',
        run: ({ svg, name }) => {
          const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
          const a = Object.assign(document.createElement('a'), { href: url, download: name + '.svg' });
          document.body.append(a); a.click(); a.remove();
          return 'SVG gespeichert';
        } },
    ],
  },
});
