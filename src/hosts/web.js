// Browser host: downloads the SVG.
import fontB64 from 'font:DFB_SANS_VAR_Italic.ttf';
import { startApp } from '../ui/app.js';

const bytes = Uint8Array.from(atob(fontB64), (c) => c.charCodeAt(0));

function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name + '.svg' });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

window.dfbPattern = startApp({
  fontBytes: bytes,
  host: {
    actions: [
      { label: 'SVG herunterladen', primary: true, run: ({ svg, name }) => { download(name, svg); return 'SVG gespeichert: ' + name + '.svg'; } },
    ],
  },
});
