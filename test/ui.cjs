// Drives dist/index.html in Chromium: renders, switches units, toggles the field overlay, downloads the SVG.
const { chromium } = require('playwright');
const path = require('path'); const fs = require('fs');
(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const errors = [];
  pg.on('pageerror', (e) => errors.push(e.message));
  pg.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await pg.goto('file://' + path.resolve(__dirname, '../dist/index.html'));
  await pg.waitForSelector('#art svg path');
  console.log('status:', await pg.textContent('#status'));
  await pg.screenshot({ path: 'test/out/ui-word.png' });
  await pg.click('.row[data-key=unit] button[data-value=letter]');
  await pg.waitForTimeout(300);
  console.log('letter:', await pg.textContent('#status'));
  await pg.click('#showField');
  await pg.click('.row[data-key=unit] button[data-value=line]');
  await pg.waitForTimeout(300);
  console.log('line:', await pg.textContent('#status'));
  await pg.screenshot({ path: 'test/out/ui-line-field.png' });
  await pg.click('#showField');
  // text edit
  await pg.fill('.row[data-key=text] textarea', 'Mit dir. Für Deutschland.');
  await pg.click('.row[data-key=unit] button[data-value=word]');
  await pg.waitForTimeout(300);
  console.log('short text:', await pg.textContent('#status'));
  const [dl] = await Promise.all([pg.waitForEvent('download'), pg.click('#actions button')]);
  const p = 'test/out/' + dl.suggestedFilename(); await dl.saveAs(p);
  const svg = fs.readFileSync(p, 'utf8');
  console.log('download:', p, svg.length, 'bytes; has <rect background>?', /<rect(?![^>]*clipPath)/.test(svg.replace(/<clipPath[\s\S]*?<\/clipPath>/, '')), 'fill:', svg.match(/fill="([^"]+)"/)[1]);
  await pg.screenshot({ path: 'test/out/ui-short.png' });
  console.log('errors:', errors);
  await b.close();
})();
