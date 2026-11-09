// HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
// Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
//
// CARTA VFR nella versione web (browser, iPhone/iPad): worker che fa quello che nell'app Android fa CartaPlugin.java.
// Il pacchetto MBTiles di open flightmaps (circa 105 MB) si scarica a pezzi direttamente nella memoria privata del sito
// (OPFS, senza passare dalla RAM) e si legge con SQLite per il browser (sqlite3.js + sqlite3.wasm), una tessera alla volta.
// Ogni carta è un file «/NOME@AIRAC.mbtiles»: la nuova si scrive accanto alla vecchia, che si cancella solo a scarico finito.
// Messaggi: {id, op:'info'|'tile'|'scarica'|'cancella', a:{…}} → {id, ok, r} oppure {id, ok:false, e}; durante lo scarico {prog:[fatti,totale]}.
import sqlite3InitModule from './sqlite3.js';

let pool = null, aperte = {};
async function avvia() {
  if (pool) return pool;
  const S = await sqlite3InitModule({ print: () => {}, printErr: () => {} });
  pool = await S.installOpfsSAHPoolVfs({ name: 'hz-carta', directory: '/hz-carta', initialCapacity: 4 });
  return pool;
}
const file = () => pool.getFileNames().filter(f => /\.mbtiles$/.test(f));
const nomeDi = f => f.replace(/^\//, '').replace(/@.*$/, '').replace(/\.mbtiles$/, '');
const ultima = nome => file().filter(f => nomeDi(f) === nome).sort().pop() || null;
function apri(f) {
  if (!aperte[f]) aperte[f] = new pool.OpfsSAHPoolDb(f, 'r');
  return aperte[f];
}
function chiudi(f) { try { aperte[f] && aperte[f].close(); } catch (e) {} delete aperte[f]; }
function b64(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }

const op = {
  async info() {
    await avvia();
    const carte = [];
    for (const nome of [...new Set(file().map(nomeDi))]) {
      const f = ultima(nome); if (!f) continue;
      const o = { nome };
      try {
        const db = apri(f);
        o.size = db.selectValue('pragma page_count') * db.selectValue('pragma page_size');
        db.exec({ sql: "select name, value from metadata where name in ('version','description','bounds')", rowMode: 'array', callback: r => { o[r[0]] = r[1]; } });
      } catch (e) { continue; }
      carte.push(o);
    }
    return { carte };
  },
  async tile({ nome, z, x, y }) {
    await avvia();
    const f = ultima(nome); if (!f) throw new Error('carta non scaricata');
    const row = (1 << z) - 1 - y;                                   // MBTiles: righe contate dal basso (TMS)
    const d = apri(f).selectValue('select tile_data from tiles where zoom_level=? and tile_column=? and tile_row=?', [z, x, row]);
    return { data: d ? b64(d) : null };
  },
  async scarica({ url, nome, versione }) {
    await avvia();
    const f = '/' + nome + '@' + versione + '.mbtiles';
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error('risposta ' + r.status);
    const tot = +r.headers.get('content-length') || 0, rd = r.body.getReader();
    let fatti = 0, ultimo = 0;
    if (file().length >= pool.getCapacity() - 1) await pool.addCapacity(2);
    chiudi(f);
    await pool.importDb(f, async () => {
      const { done, value } = await rd.read(); if (done) return undefined;
      fatti += value.byteLength;
      if (fatti - ultimo > 512 * 1024) { ultimo = fatti; postMessage({ prog: [fatti, tot] }); }
      return value;
    });
    if (tot && fatti !== tot) { pool.unlink(f); throw new Error('scarico incompleto'); }
    try { apri(f).selectValue('select count(*) from metadata'); } catch (e) { chiudi(f); pool.unlink(f); throw new Error('file non valido'); }
    for (const g of file()) if (g !== f && nomeDi(g) === nome) { chiudi(g); pool.unlink(g); }   // le vecchie solo adesso
    return { ok: true, size: fatti };
  },
  async cancella({ nome }) {
    await avvia();
    for (const g of file()) if (nomeDi(g) === nome) { chiudi(g); pool.unlink(g); }
    return { ok: true };
  },
};

onmessage = async ev => {
  const { id, op: o, a } = ev.data || {};
  try { postMessage({ id, ok: true, r: await op[o](a || {}) }); }
  catch (e) { postMessage({ id, ok: false, e: String(e && e.message || e) }); }
};
