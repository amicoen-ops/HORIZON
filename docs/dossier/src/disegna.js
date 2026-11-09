// HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
// Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
//
// Disegna i diagrammi del dossier: ogni docs/dossier/src/fig-*.html diventa docs/dossier/img/fig-*.png
// (Playwright, Chromium, deviceScaleFactor 2, screenshot dell'elemento #fig). Uso: node docs/dossier/src/disegna.js [nome…]
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const SRC = __dirname, OUT = path.join(__dirname, '..', 'img');
(async () => {
  const solo = process.argv.slice(2);
  const files = fs.readdirSync(SRC).filter(f => /^fig-.*\.html$/.test(f) && (!solo.length || solo.some(s => f.includes(s)))).sort();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1300, height: 900 }, deviceScaleFactor: 2 });
  let err = 0;
  page.on('pageerror', e => { err++; console.log('ERRORE', e.message); });
  for (const f of files) {
    await page.goto('file://' + path.join(SRC, f));
    await page.waitForTimeout(150);
    const fig = await page.$('#fig');
    await fig.screenshot({ path: path.join(OUT, f.replace(/\.html$/, '.png')) });
    console.log('disegnato', f);
  }
  await browser.close();
  process.exit(err ? 1 : 0);
})();
