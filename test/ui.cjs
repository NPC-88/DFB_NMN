// Drives the built pages in Chromium. node test/ui.cjs
const { chromium } = require('playwright');
const path = require('path'); const fs = require('fs');
const http = require('http');
(async () => {
  // serve docs/ like GitHub Pages
  const srv = http.createServer((q, r) => { const f = path.join(__dirname, '../docs', decodeURIComponent(q.url.split('?')[0].split('#')[0]).replace(/\/$/, '/index.html')); fs.readFile(f, (e, d) => { r.writeHead(e ? 404 : 200); r.end(d); }); }).listen(8765);
  const b = await chromium.launch();
  const errors = [];
  const pg = await b.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  pg.on('pageerror', (e) => errors.push(e.message));
  await pg.goto('http://localhost:8765/');
  console.log('no font screen:', !(await pg.$('#fontgate')));
  await pg.waitForSelector('#art svg path');
  await pg.reload(); await pg.waitForSelector('#art svg path', { timeout: 5000 });
  await pg.screenshot({ path: 'test/out/ui-main.png' });

  // points mode + drag
  await pg.click('.row[data-key="field.mode"] button[data-value=points]');
  const box = await pg.locator('#gradient').boundingBox();
  await pg.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.3); await pg.mouse.down();
  await pg.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5, { steps: 5 }); await pg.mouse.up();
  await pg.waitForTimeout(400);
  console.log('points after drag:', JSON.stringify(await pg.evaluate(() => window.dfbPattern.params.field.points)));
  await pg.check('#showField'); await pg.waitForTimeout(300);
  await pg.screenshot({ path: 'test/out/ui-points.png' });
  await pg.uncheck('#showField');

  // library save + share link
  await pg.fill('#lib-name', 'Test Welle'); await pg.click('.lib-save button');
  console.log('library:', await pg.$$eval('.lib-list .lib-item', (x) => x.map((n) => n.textContent)));
  const share = await pg.evaluate(() => window.dfbPattern.share());
  const p2 = await b.newPage({ viewport: { width: 1200, height: 800 } });
  p2.on('pageerror', (e) => errors.push(e.message));
  await p2.goto('http://localhost:8765/' + share); await p2.waitForSelector('#art svg path');
  console.log('share link opens same mode:', await p2.evaluate(() => window.dfbPattern.params.field.mode));

  // zoom + format
  await pg.selectOption('#ctl-format', 'square'); await pg.waitForTimeout(300);
  await pg.click('#zoomIn'); await pg.click('#zoomIn');
  console.log('zoom label:', await pg.textContent('#zoomLabel'));
  await pg.click('#zoomFit');
  const [dl] = await Promise.all([pg.waitForEvent('download'), pg.click('#download')]);
  const out = 'test/out/' + dl.suggestedFilename(); await dl.saveAs(out);
  console.log('download:', out, fs.statSync(out).size, 'bytes');
  await pg.screenshot({ path: 'test/out/ui-square.png' });

  // phone + local build
  const ph = await b.newPage({ viewport: { width: 400, height: 800 } });
  ph.on('pageerror', (e) => errors.push(e.message));
  await ph.goto('file://' + path.resolve(__dirname, '../dist/index.html')); await ph.waitForSelector('#art svg path');
  console.log('phone scrollWidth:', await ph.evaluate(() => document.documentElement.scrollWidth));
  await ph.screenshot({ path: 'test/out/ui-phone.png', fullPage: false });
  console.log('errors:', errors);
  await b.close(); srv.close();
})();
