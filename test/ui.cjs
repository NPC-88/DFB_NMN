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
  // Never touch the real team library: answer Firestore calls from memory.
  const docs = new Map(); let n = 0;
  await pg.context().route(/firestore\.googleapis\.com/, async (route) => {
    const req = route.request(); const u = new URL(req.url()); const id = u.pathname.split('/').pop();
    const name = (i) => 'projects/p/databases/(default)/documents/patterns/' + i;
    const json = (b) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
    if (req.method() === 'GET') return json({ documents: [...docs.values()].reverse() });
    if (req.method() === 'POST') { const i = 'd' + ++n; const d = { name: name(i), ...JSON.parse(req.postData()) }; docs.set(i, d); return json(d); }
    if (req.method() === 'PATCH') { Object.assign(docs.get(id).fields, JSON.parse(req.postData()).fields); return json(docs.get(id)); }
    if (req.method() === 'DELETE') { docs.delete(id); return json({}); }
    return route.fulfill({ status: 400 });
  });
  const log = (...a) => console.log(...a);

  await pg.goto('http://localhost:8765/');
  await pg.waitForSelector('#art svg path');
  log('opens directly:', !(await pg.$('#fontgate')), '|', await pg.textContent('#status'));
  await pg.screenshot({ path: 'test/out/v3-waves.png' });

  // stops: add by clicking the bar, drag it, flip
  const bar = await pg.locator('.stops-bar').boundingBox();
  await pg.mouse.click(bar.x + bar.width * 0.5, bar.y + bar.height / 2);
  log('stops after click:', (await P()).field.stops.length);
  await pg.locator('#ctl-stop-value').fill('1');
  await pg.locator('#ctl-stop-value').dispatchEvent('change');
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
  await pg.click('#saveForm button[type=submit]');
  await pg.waitForTimeout(500);
  await pg.click('#reset');
  await pg.click('[role=tab][data-tab=library]');
  await pg.waitForSelector('.lib-card');
  log('library cards:', await pg.$$eval('.lib-card .lib-name', (n) => n.map((x) => x.textContent)), 'tab count:', await pg.textContent('#libCount'));
  await pg.screenshot({ path: 'test/out/v3-library.png' });
  // delete via the confirm modal
  await pg.hover('.lib-card'); await pg.click('.lib-card button[aria-label="Löschen"]');
  await pg.screenshot({ path: 'test/out/v3-confirm.png' });
  await pg.click('#confirmDialog button[value=cancel]');
  log('after cancel:', await pg.$$eval('.lib-card', (n) => n.length));
  await pg.click('.lib-card .lib-thumb');
  await pg.waitForTimeout(300);
  log('reopened:', JSON.stringify((({ width, fontSize }) => ({ width, fontSize }))(await P())), 'tool visible:', await pg.isVisible('#tool'));

  const [dl] = await Promise.all([pg.waitForEvent('download'), pg.click('#download')]);
  const out = 'test/out/' + dl.suggestedFilename(); await dl.saveAs(out);
  log('download:', path.basename(out), fs.statSync(out).size, 'bytes');

  // animation: two moments, play, export GIF + MP4
  await pg.click('#reset');
  await pg.click('#markMoment');
  await pg.locator('#ctl-field-phase').fill('0.5'); await pg.locator('#ctl-field-phase').dispatchEvent('change');
  await pg.locator('#ctl-field-angle').fill('40'); await pg.locator('#ctl-field-angle').dispatchEvent('change');
  await pg.click('#markMoment');
  log('moments:', await pg.textContent('#momentCount'), '| tab badge:', await pg.textContent('#animCount'));
  await pg.screenshot({ path: 'test/out/v4-tool.png' });
  await pg.click('[role=tab][data-tab=animation]');
  await pg.waitForTimeout(300);
  await pg.click('.anim-main .btn-primary');           // play
  await pg.waitForTimeout(1500);
  log('playing:', await pg.textContent('.time'), '|', await pg.textContent('#animStatus'));
  await pg.screenshot({ path: 'test/out/v4-anim.png' });
  await pg.click('.anim-main .btn-primary');           // pause
  log('mp4 encoder:', await pg.evaluate(async () => {
    if (!window.VideoEncoder) return 'none';
    const r = await VideoEncoder.isConfigSupported({ codec: 'avc1.640028', width: 960, height: 540, bitrate: 4e6, framerate: 25 });
    return r.supported ? 'h264 ok' : 'h264 not supported';
  }));
  for (const [format, sz] of [['gif', '0.5'], ['mp4', '0.5']]) {
    await pg.click(`.anim-aside .chip[data-value=${format}]`);
    await pg.click(`.anim-aside .chip[data-value="${sz}"]`);
    const t = Date.now();
    const [dl] = await Promise.all([pg.waitForEvent('download', { timeout: 120000 }).catch(() => null), pg.click('#videoExport')]);
    if (!dl) { log(format, 'no download:', await pg.textContent('#toast')); continue; }
    const out = 'test/out/' + dl.suggestedFilename(); await dl.saveAs(out);
    log(format, path.basename(out), Math.round(fs.statSync(out).size / 1024) + ' KB', ((Date.now() - t) / 1000).toFixed(1) + ' s');
  }

  const ph = await b.newPage({ viewport: { width: 400, height: 800 } });
  ph.on('pageerror', (e) => errors.push(e.message));
  await ph.goto('http://localhost:8765/'); await ph.waitForSelector('#art svg path');
  log('phone scrollWidth:', await ph.evaluate(() => document.documentElement.scrollWidth));
  await ph.screenshot({ path: 'test/out/v3-phone.png' });
  log('errors:', errors);
  await b.close(); srv.close();
})();
