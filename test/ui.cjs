// Drives the built page (docs/, served like GitHub Pages) in Chromium. node test/ui.cjs
const { chromium } = require('playwright');
const path = require('path'); const fs = require('fs'); const http = require('http');

(async () => {
  const srv = http.createServer((q, r) => {
    const f = path.join(__dirname, '../docs', decodeURIComponent(q.url.split('?')[0].split('#')[0]).replace(/\/$/, '/index.html'));
    fs.readFile(f, (e, d) => { r.writeHead(e ? 404 : 200); r.end(d); });
  }).listen(8765);
  const b = await chromium.launch();
  const errors = [];
  const pg = await b.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  pg.on('pageerror', (e) => errors.push(e.message));
  const P = () => pg.evaluate(() => window.dfbPattern.params);
  const log = (...a) => console.log(...a);

  await pg.goto('http://localhost:8765/');
  await pg.waitForSelector('#art svg path');
  log('opens directly:', !(await pg.$('#fontgate')), '|', await pg.textContent('#status'));
  await pg.screenshot({ path: 'test/out/v3-waves.png' });

  // stops: add by clicking the bar, drag it, flip
  const bar = await pg.locator('.stops-bar').boundingBox();
  await pg.mouse.click(bar.x + bar.width * 0.5, bar.y + bar.height / 2);
  log('stops after click:', (await P()).field.stops.length);
  await pg.locator('#stop-value').fill('1');
  await pg.locator('#stop-value').dispatchEvent('change');
  const sel = await pg.locator('.stop.sel').boundingBox();
  await pg.mouse.move(sel.x + 8, sel.y + 9); await pg.mouse.down();
  await pg.mouse.move(bar.x + bar.width * 0.35, sel.y + 9, { steps: 6 }); await pg.mouse.up();
  log('stops after drag:', JSON.stringify((await P()).field.stops.map((s) => [+s.pos.toFixed(2), +s.value.toFixed(2)])));
  await pg.screenshot({ path: 'test/out/v3-stops.png' });

  // undo / redo
  await pg.click('#undo'); const afterUndo = (await P()).field.stops.map((s) => +s.pos.toFixed(2));
  await pg.click('#redo'); const afterRedo = (await P()).field.stops.map((s) => +s.pos.toFixed(2));
  log('undo → redo:', JSON.stringify(afterUndo), '→', JSON.stringify(afterRedo));
  await pg.click('.stop-row button[aria-label="Stopp löschen"]');

  // parametric radial: drag end handle
  await pg.click('.modes button[data-value=parametric]');
  await pg.click('.grad-tools button[data-value=radial]');
  const end = await pg.locator('.grad-overlay .handle.end').boundingBox();
  await pg.mouse.move(end.x + end.width / 2, end.y + end.height / 2); await pg.mouse.down();
  await pg.mouse.move(end.x - 40, end.y - 20, { steps: 6 }); await pg.mouse.up();
  log('radial handles:', JSON.stringify((await P()).field.b));
  await pg.screenshot({ path: 'test/out/v3-radial.png' });

  // points: add, move, resize, delete
  await pg.click('.modes button[data-value=points]');
  const st = await pg.locator('.grad-overlay').boundingBox();
  await pg.mouse.click(st.x + st.width * 0.85, st.y + st.height * 0.2);
  log('points after click:', (await P()).field.points.length);
  const dot = await pg.locator('.grad-overlay .pt.sel .dot').boundingBox();
  await pg.mouse.move(dot.x + dot.width / 2, dot.y + dot.height / 2); await pg.mouse.down();
  await pg.mouse.move(st.x + st.width * 0.6, st.y + st.height * 0.3, { steps: 5 }); await pg.mouse.up();
  const rs = await pg.locator('.grad-overlay .pt.sel .resize').boundingBox();
  await pg.mouse.move(rs.x + rs.width / 2, rs.y + rs.height / 2); await pg.mouse.down();
  await pg.mouse.move(rs.x + 40, rs.y + rs.height / 2, { steps: 5 }); await pg.mouse.up();
  const pts = (await P()).field.points;
  log('moved+resized point:', JSON.stringify(pts.at(-1)));
  await pg.screenshot({ path: 'test/out/v3-points.png' });
  await pg.locator('.grad-overlay .pt.sel .del').dispatchEvent('pointerdown');
  log('points after delete:', (await P()).field.points.length);

  // line ends + format + font size
  await pg.click('.modes button[data-value=waves]');
  for (const a of ['ragged', 'justify', 'cut']) { await pg.click(`.row[data-key=align] button[data-value=${a}]`); await pg.waitForTimeout(150); }
  await pg.click('#formatBtn'); await pg.click('#formatList .menu-item[data-id=square]');
  await pg.fill('#fontSizeNum', '60'); await pg.locator('#fontSizeNum').dispatchEvent('change');
  await pg.waitForTimeout(300);
  log('format/size:', JSON.stringify((({ width, height, fontSize, align }) => ({ width, height, fontSize, align }))(await P())));
  await pg.screenshot({ path: 'test/out/v3-square.png' });

  // save → library tab → open
  await pg.click('#saveBtn');
  await pg.fill('#saveName', 'Test Welle'); await pg.fill('#saveAuthor', 'NC');
  await pg.click('#savePop button[type=submit]');
  await pg.waitForTimeout(500);
  await pg.click('#reset');
  await pg.click('[role=tab][data-tab=library]');
  await pg.waitForSelector('.lib-card');
  log('library cards:', await pg.$$eval('.lib-card .lib-name', (n) => n.map((x) => x.textContent)), 'tab count:', await pg.textContent('#libCount'));
  await pg.screenshot({ path: 'test/out/v3-library.png' });
  await pg.click('.lib-card .lib-thumb');
  await pg.waitForTimeout(300);
  log('reopened:', JSON.stringify((({ width, fontSize }) => ({ width, fontSize }))(await P())), 'tool visible:', await pg.isVisible('#tool'));

  const [dl] = await Promise.all([pg.waitForEvent('download'), pg.click('#download')]);
  const out = 'test/out/' + dl.suggestedFilename(); await dl.saveAs(out);
  log('download:', path.basename(out), fs.statSync(out).size, 'bytes');

  const ph = await b.newPage({ viewport: { width: 400, height: 800 } });
  ph.on('pageerror', (e) => errors.push(e.message));
  await ph.goto('http://localhost:8765/'); await ph.waitForSelector('#art svg path');
  log('phone scrollWidth:', await ph.evaluate(() => document.documentElement.scrollWidth));
  await ph.screenshot({ path: 'test/out/v3-phone.png' });
  log('errors:', errors);
  await b.close(); srv.close();
})();
