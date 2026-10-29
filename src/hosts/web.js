// Browser host: downloads the SVG.
import fontB64 from 'font:DFB_SANS_VAR_Italic.ttf';
import { startApp } from '../ui/app.js';

const bytes = Uint8Array.from(atob(fontB64), (c) => c.charCodeAt(0));

// As a claude.ai artifact, plain downloads are blocked: save through the
// page's `downloads` capability (the viewer confirms). Elsewhere: a normal link.
const saver = window.claude && window.claude.use ? window.claude.use('downloads').catch(() => null) : Promise.resolve(null);

async function download(name, text) {
  const downloads = await saver;
  if (downloads) {
    try { await downloads.save({ filename: name + '.svg', data: text }); return 'SVG gespeichert: ' + name + '.svg'; }
    catch (e) { return e && e.code === 'declined' ? 'Speichern abgebrochen.' : 'Speichern nicht möglich (' + ((e && e.code) || 'Fehler') + ').'; }
  }
  const url = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name + '.svg' });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'SVG gespeichert: ' + name + '.svg';
}

window.dfbPattern = startApp({
  fontBytes: bytes,
  host: {
    actions: [
      { label: 'SVG herunterladen', primary: true, run: ({ svg, name }) => download(name, svg) },
    ],
  },
});
