// Render SVG files to PNG on a preview background: node test/shot.cjs bg out.png a.svg [b.svg…]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
(async () => {
  const [bg, out, ...files] = process.argv.slice(2);
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1920, height: 1080 * files.length } });
  const html = files.map(f => `<div style="background:${bg};line-height:0">${fs.readFileSync(f, 'utf8').replace(/<\?xml[^>]*>/, '')}</div>`).join('');
  await pg.setContent(`<body style="margin:0">${html}</body>`);
  await pg.screenshot({ path: out, fullPage: true }); await b.close();
})();
