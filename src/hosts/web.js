// Browser host (local file, GitHub Pages, claude.ai page).
//
// The font: embedded in local builds; the public GitHub Pages build ships
// without it (licensed font, public repository) and instead uses
//   1. fonts/DFB_SANS_VAR_Italic.ttf next to the page, if someone put it there
//   2. the copy this browser remembered from an earlier visit
//   3. a one-time drop of the font file (from the DFB brand package)
import embedded from 'font:DFB_SANS_VAR_Italic.ttf';
import { startApp } from '../ui/app.js';
import { createEngine } from '../core/index.js';

const FONT_KEY = 'dfb-pattern-font-v1';
const fromB64 = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const toB64 = (bytes) => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); };

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

async function findFont() {
  if (embedded) return fromB64(embedded);
  try {
    const r = await fetch('fonts/DFB_SANS_VAR_Italic.ttf');
    if (r.ok) return new Uint8Array(await r.arrayBuffer());
  } catch { /* not hosted */ }
  try { const b = localStorage.getItem(FONT_KEY); if (b) return fromB64(b); } catch { /* storage blocked */ }
  return askForFont();
}

function askForFont() {
  return new Promise((resolve) => {
    const gate = document.createElement('div');
    gate.id = 'fontgate';
    gate.innerHTML = `<div class="card">
      <h1>Schrift laden</h1>
      <p>Das Tool braucht <b>DFB SANS VAR Italic</b> (Datei <code>DFB_SANS_VAR_Italic.ttf</code>, im DFB-Markenpaket unter
      03_DFB-Maenner-NM_Typografie › DFB_SANS_VAR_23 › DFB_SANS_VAR). Die Schrift ist lizenziert und liegt deshalb nicht auf dieser öffentlichen Seite.</p>
      <label class="drop" id="drop">Datei hierher ziehen oder <u>auswählen</u><input type="file" id="fontfile" accept=".ttf,.otf,.woff,.woff2" hidden></label>
      <p class="hint">Einmalig: dieser Browser merkt sich die Schrift. Sie wird nirgendwohin hochgeladen.</p>
      <p class="hint" id="fonterr" hidden></p>
    </div>`;
    document.body.append(gate);
    const drop = gate.querySelector('#drop'), input = gate.querySelector('#fontfile'), err = gate.querySelector('#fonterr');
    const take = async (file) => {
      if (!file) return;
      const bytes = new Uint8Array(await file.arrayBuffer());
      try {
        const e = createEngine(bytes);
        if (!/DFB SANS VAR/i.test(e.font.family)) throw new Error('family');
      } catch {
        err.textContent = 'Das ist nicht DFB SANS VAR Italic. Bitte DFB_SANS_VAR_Italic.ttf wählen.';
        err.hidden = false;
        return;
      }
      try { localStorage.setItem(FONT_KEY, toB64(bytes)); } catch { /* remembered for this visit only */ }
      gate.remove();
      resolve(bytes);
    };
    input.addEventListener('change', () => take(input.files[0]));
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); take(e.dataTransfer.files[0]); });
  });
}

findFont().then((fontBytes) => {
  window.dfbPattern = startApp({ fontBytes, host: { save, libraryURL: 'library.json' } });
});
