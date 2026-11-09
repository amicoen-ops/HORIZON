// HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
// Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
//
// Schermate per il dossier tecnico (docs/dossier/img/sch-*.png). Serve www/ su http://localhost:8765:
//   cd www && python3 -m http.server 8765 &  node ../docs/dossier/src/schermate.js
// Telefono 412×900, deviceScaleFactor 2. Volo dimostrativo (PH.setDemo) per avere valori realistici.
// In questo ambiente le tessere delle mappe e del terreno non arrivano (rete chiusa): le schermate lo mostrano.
const { chromium } = require('playwright');
const path = require('path');
const OUT = path.join(__dirname, '..', 'img');
const URL = process.env.HZ_URL || 'http://localhost:8765/index.html';

const pulisci = `(() => {
  for (const id of ['phTerms', 'phPre', 'phNag', 'hzRis']) { const d = document.getElementById(id); if (d) d.remove(); }
  document.querySelectorAll('.ph-sheet').forEach(d => { if (!/^(phPiano|phInfo|phImp|phSim|phProf|phFuel|phTrf)$/.test(d.id)) d.remove(); });
  const w = document.getElementById('phWait'); if (w) w.hidden = true;
  return 'ok'; })()`;

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 900 }, deviceScaleFactor: 2, locale: 'it-IT' });
  const page = await ctx.newPage();
  const errori = [];
  page.on('pageerror', e => errori.push(String(e.message || e)));
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  // condizioni d'uso: spunta e conferma, come un pilota (poi via ogni foglio residuo)
  await page.evaluate(() => { const c = document.getElementById('phTermsOk'); if (c) { c.checked = true; c.dispatchEvent(new Event('change')); const g = document.getElementById('phTermsGo'); if (g) { g.disabled = false; g.click(); } } });
  await page.waitForTimeout(800);
  await page.evaluate(pulisci);
  // volo dimostrativo: valori finti ma coerenti (assetto, velocità, quota, traffico finto)
  await page.evaluate(() => { PH.setDemo(true); try { directTo(FIELDS.find(f => f.short === 'LILE') || FIELDS[0]); } catch (e) {} });
  await page.waitForTimeout(6000);
  await page.evaluate(pulisci);
  const scatta = async (nome, attesa) => { await page.waitForTimeout(attesa || 1200); await page.evaluate(pulisci); await page.screenshot({ path: path.join(OUT, nome + '.png') }); console.log('schermata', nome); };

  await page.evaluate(() => { PH.show('volo'); if (PAGE !== 'pfd') togglePage(); });
  await scatta('sch-pfd', 1500);
  await page.evaluate(() => { togglePage(); });
  await scatta('sch-mappa', 2500);
  await page.evaluate(() => { togglePage(); });
  // Piano: tasto PIANO della barra in basso (app.html nell'iframe #phAppFrame)
  await page.evaluate(() => { const b = [...document.querySelectorAll('.ph-nav button')].find(x => x.dataset.v === 'piano'); if (b) b.click(); else PH.show('piano'); });
  await scatta('sch-piano', 3500);
  try {
    const fr = page.frameLocator('#phAppFrame');
    await fr.locator('button[data-tab="briefing"]').click({ timeout: 4000 });
    await scatta('sch-briefing', 2500);
  } catch (e) { console.log('briefing non raggiunto:', e.message.split('\n')[0]); }
  await page.evaluate(() => PH.show('imp'));
  await scatta('sch-impostazioni', 1500);
  await page.evaluate(() => PH.show('trf'));
  await scatta('sch-traffico', 2500);
  await page.evaluate(() => { PH.show('volo'); if (PH.guidaOpen) PH.guidaOpen(); });
  await scatta('sch-guida', 1500);
  await page.evaluate(() => { document.querySelectorAll('.ph-sheet').forEach(d => { if (!/^(phPiano|phInfo|phImp|phSim|phProf|phFuel|phTrf)$/.test(d.id)) d.remove(); }); PH.show('info'); });
  await page.waitForTimeout(800);
  await page.evaluate(() => PH.riservatoOpen());
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, 'sch-riservato.png') }); console.log('schermata sch-riservato');
  await page.evaluate(() => { const d = document.getElementById('hzRis'); if (d) d.remove(); PH.show('volo'); PH.setUi('simple'); });
  await scatta('sch-semplice', 1500);
  await page.evaluate(() => { PH.setUi('full'); });
  // tablet in orizzontale: orizzonte e mappa affiancati (schermo diviso)
  await page.setViewportSize({ width: 1180, height: 820 });
  await page.evaluate(() => { PH.show('volo'); PH.layout(); });
  await scatta('sch-tablet', 2500);
  console.log('errori della pagina:', errori.length ? errori.slice(0, 5).join(' | ') : 'nessuno');
  await browser.close();
})();
