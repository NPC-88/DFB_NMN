// Browser host (local file, GitHub Pages, claude.ai page).
//
// The font is embedded in every build, so the tool opens directly.
import embedded from 'font:DFB_SANS_VAR_Italic.ttf';
import { startApp } from '../ui/app.js';

const fromB64 = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

// In a claude.ai page plain downloads are blocked: save through the page's
// `downloads` capability (the viewer confirms). Elsewhere: a normal link.
const saver = window.claude && window.claude.use ? window.claude.use('downloads').catch(() => null) : Promise.resolve(null);

async function save({ filename, data }) {
  const downloads = await saver;
  if (downloads) {
    try { await downloads.save({ filename, data }); return 'Gespeichert: ' + filename; }
    catch (e) { return e && e.code === 'declined' ? 'Speichern abgebrochen.' : 'Speichern nicht möglich (' + ((e && e.code) || 'Fehler') + ').'; }
  }
  const type = filename.endsWith('.svg') ? 'image/svg+xml' : 'application/json';
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'Gespeichert: ' + filename;
}

window.dfbPattern = startApp({ fontBytes: fromB64(embedded), host: { save, libraryURL: 'library.json' } });
