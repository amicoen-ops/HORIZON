#!/usr/bin/env node
// HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
// Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
//
// Banco di prova dell'assetto: prende il codice VERO dei sensori da www/index.html (filtro Mahony, montaggio,
// PH.onMotion), gli dà dati di sensori calcolati da un moto noto e controlla orizzonte e vario.
// Uso: node tools/test_assetto.js        (esce con 1 se una prova non passa)
// Nel moto simulato l'inclinazione dell'aereo cambia di colpo (a 2 s e a 7 s): per l'aereo si misura in virata stabile, dopo 4 s.
//
// Convenzioni (le stesse dell'app):
//  - assi dell'aereo: avanti, destra, giù; forza specifica a riposo e livellato = (0, 0, −1 g)
//  - accelerationIncludingGravity (Android, W3C) = forza specifica negli assi del telefono
//  - rotationRate: beta attorno a x, gamma attorno a y, alpha attorno a z, in °/s
//  - telefono in verticale, schermo verso il pilota: x = destra, y = su, z = verso il pilota
'use strict';
const fs = require('fs'), path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'www', 'index.html'), 'utf8').split('\n');

function block(startRe, endTest) {
  const i = SRC.findIndex(l => startRe.test(l));
  if (i < 0) throw new Error('non trovato in index.html: ' + startRe);
  let j = i; while (!endTest(SRC[j], j - i)) j++;
  return SRC.slice(i, j + 1).join('\n');
}
const code = [
  block(/^function PhMahony\(/, (l, k) => k > 0 && /^PhMahony\.prototype\.euler/.test(SRC[SRC.indexOf(l) - 2] || '')),
  block(/^PH\.toBody=/, () => true),
  block(/^PH\.GPERM=/, (l) => /^PH\.gyroTxt=/.test(l)),
  block(/^PH\.onMotion=function/, (l) => /^};/.test(l)),
].join('\n');

const D2R = Math.PI / 180, R2D = 180 / Math.PI, G = 9.80665;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const angDiff = (a, b) => ((a - b + 540) % 360) - 180, wrap360 = a => ((a % 360) + 360) % 360;
let T = 0; const performance = { now: () => T };
let S, PH, LIVE, PhMahony;
// il codice dell'app gira qui dentro con le sue variabili globali sostituite da quelle del banco
const load = new Function('ctx', `
  let {D2R,R2D,clamp,angDiff,wrap360,performance}=ctx; let PH=ctx.PH, S=ctx.S, LIVE=ctx.LIVE;
  const lsGet=(k,d)=>d, lsSet=()=>{};
  ${code}
  return {PhMahony, onMotion: PH.onMotion, toBody: PH.toBody, giro: PH, bind(p,s,l){ PH=p; S=s; LIVE=l; }};`);

// righe = assi dell'aereo (avanti, destra, giù) espressi negli assi dello schermo
const VERTICALE = [[0, 0, -1], [1, 0, 0], [0, -1, 0]];
function inclinato(deg) { const a = deg * D2R, c = Math.cos(a), s = Math.sin(a); return [[0, -s, -c], [1, 0, 0], [0, -c, s]]; }

// telefono che dà gli assi del giroscopio in un altro ordine (o.ordine = indici in [alpha, beta, gamma])
function giro(o, r) { if (!o.ordine) return r; const v = [r.alpha, r.beta, r.gamma]; return { alpha: v[o.ordine[0]], beta: v[o.ordine[1]], gamma: v[o.ordine[2]] }; }

function prova(nome, o) {
  const ctx = { D2R, R2D, clamp, angDiff, wrap360, performance, PH: {}, S: {}, LIVE: {} };
  const app = load(ctx);
  S = { gpsReal: true, gs: o.V * 3.6, roll: 0, hdg: 0, trk: 0 }; LIVE = {};
  PH = { M: o.mount || VERTICALE, accSign: 1, aAvg: [0, 0, 0], mCount: 0, mT0: 0, demo: false, scrAng: () => o.scr || 0, accCheck: () => {},
    gyroLearn: () => {}, gyroRaw: r => [r.beta || 0, r.gamma || 0, r.alpha || 0],
    ahrs: new app.PhMahony(), ahrsInit: false, attF: null, smooth: 3, tas: null, dvdt: 0, trkRate: 0, trkRateT: -1e9, slipF: 0, hdg: 0,
    magInUse: () => false, mag: {}, act: () => {}, vario: { a: 0, predict(a) { this.a = a; } } };
  PH.toBody = app.toBody; PH.onMotion = app.onMotion;
  if (o.impara) {                                     // riconoscimento vero dell'ordine degli assi del giroscopio
    for (const k of ['GPERM', 'gdet', 'gyroRaw', 'gyroLearn']) PH[k] = app.giro[k];
    PH.gmap = o.gmap || { p: 0, s: 1, fixed: false }; PH.gdet = { A: null, w: null, E: new Float64Array(12), n: 0 };
  }
  app.bind(PH, S, LIVE);
  const Mt = o.mountTrue || o.mount || VERTICALE;
  const toScr = v => [0, 1, 2].map(j => Mt[0][j] * v[0] + Mt[1][j] * v[1] + Mt[2][j] * v[2]);
  const sc = (o.scr || 0) * D2R, c = Math.cos(sc), sn = Math.sin(sc);
  const toRaw = v => [v[0] * c + v[1] * sn, -v[0] * sn + v[1] * c, v[2]];        // inverso della rotazione fatta dall'app
  let peggio = { roll: 0, pitch: 0, aUp: 0 }, fine = null;
  for (let i = 0; i < 60 * 10; i++) {
    T = i * 1000 / 60; const t = T / 1000, inV = t > 2 && t < 7, V = o.V;
    let f, w, trk;
    if (o.tavolo) {                                      // fermo sul tavolo, girato a mano attorno alla verticale (±60° a 0,3 Hz)
      const wt = 60 * D2R * 2 * Math.PI * 0.3 * Math.cos(2 * Math.PI * 0.3 * t);
      f = [0, 0, -G]; w = [0, 0, wt]; trk = 0; S.gs = 0;
    } else if (o.aereo) {                                       // virata coordinata: inclinato, nessuna forza laterale
      const ph = inV ? o.aereo * D2R : 0, wt = G * Math.tan(ph) / V;
      f = [0, 0, -G / Math.cos(ph)]; w = [0, wt * Math.sin(ph), wt * Math.cos(ph)]; trk = wt;
    } else {                                             // macchina: non s'inclina, forza laterale verso il centro
      const wt = inV ? o.virata * D2R : 0; f = [0, V * wt, -G]; w = [0, 0, wt]; trk = wt;
    }
    const fd = toRaw(toScr(f)), wd = toRaw(toScr(w)).map(x => x + 0.001);
    PH.trkRate = trk * R2D; PH.trkRateT = T; S.roll = PH.attF ? PH.attF[0] : 0;
    PH.onMotion({ accelerationIncludingGravity: { x: fd[0], y: fd[1], z: fd[2] },
      rotationRate: o.senzaGiro ? null : giro(o, { alpha: wd[2] * R2D, beta: wd[0] * R2D, gamma: wd[1] * R2D }), interval: 1 / 60, timeStamp: T });
    if (t > (o.daT || 1)) {
      const r0 = o.atteso ? (inV && t > 4 ? o.atteso.roll : null) : 0;
      if (r0 != null) peggio.roll = Math.max(peggio.roll, Math.abs(S.roll - r0));
      peggio.pitch = Math.max(peggio.pitch, Math.abs(S.pitch - (o.pitch0 || 0)));
      if (!o.atteso || (inV && t > 4)) peggio.aUp = Math.max(peggio.aUp, Math.abs(PH.vario.a));
    }
    if (Math.abs(t - 6) < 1e-9) fine = { roll: S.roll, pitch: S.pitch, src: PH.turnSrc };
  }
  const lim = o.limiti || { roll: 3, pitch: 3, aUp: 0.6 };
  const ok = peggio.roll <= lim.roll && peggio.pitch <= lim.pitch && peggio.aUp <= lim.aUp;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${nome.padEnd(58)} errore max: rollio ${peggio.roll.toFixed(1)}° · beccheggio ${peggio.pitch.toFixed(1)}° · acc. verticale ${peggio.aUp.toFixed(2)} m/s²` +
    ` · a 6 s: ${fine.roll.toFixed(1)}° / ${fine.pitch.toFixed(1)}° (${fine.src})`);
  return ok;
}

const P = [
  ['Macchina, curva a destra 20°/s, giroscopio', { V: 15, virata: 20 }],
  ['Macchina, curva a sinistra 20°/s, giroscopio', { V: 15, virata: -20 }],
  ['Macchina, curva a destra, virata dal GPS (senza giroscopio)', { V: 15, virata: 20, senzaGiro: true }],
  ['Macchina, curva a sinistra, virata dal GPS (senza giroscopio)', { V: 15, virata: -20, senzaGiro: true }],
  ['Macchina, telefono in orizzontale (schermo 90°)', { V: 15, virata: 20, scr: 90 }],
  ['Macchina, telefono in orizzontale (schermo 270°)', { V: 15, virata: 20, scr: 270 }],
  ['Macchina, telefono inclinato 30° e livellato', { V: 15, virata: 20, mount: inclinato(30) }],
  ['Sul tavolo, girato a destra e sinistra (cambio bussola), assi standard', { V: 0, tavolo: true, impara: true }],
  ['Sul tavolo, girato, giroscopio con assi beta e gamma scambiati', { V: 0, tavolo: true, impara: true, ordine: [0, 2, 1], daT: 6 }],
  ['Sul tavolo, girato, assi scambiati ma salvati sbagliati come «riconosciuti»', { V: 0, tavolo: true, impara: true, ordine: [0, 2, 1], gmap: { p: 0, s: 1, fixed: true }, daT: 6 }],
  ['Aereo, virata coordinata a destra 30°, giroscopio', { V: 32, aereo: 30, atteso: { roll: 30 }, limiti: { roll: 3, pitch: 3, aUp: 0.6 } }],
  ['Aereo, virata coordinata a sinistra 30°, giroscopio', { V: 32, aereo: -30, atteso: { roll: -30 }, limiti: { roll: 3, pitch: 3, aUp: 0.6 } }],
  ['Aereo, virata coordinata a destra 30°, virata dal GPS', { V: 32, aereo: 30, senzaGiro: true, atteso: { roll: 30 }, limiti: { roll: 3, pitch: 3, aUp: 0.6 } }],
  ['Aereo, virata coordinata a sinistra 30°, virata dal GPS', { V: 32, aereo: -30, senzaGiro: true, atteso: { roll: -30 }, limiti: { roll: 3, pitch: 3, aUp: 0.6 } }],
];
let tutti = true; for (const [n, o] of P) tutti = prova(n, o) && tutti;

// ---- registrazioni vere (Impostazioni › Registra 20 s e invia), in tools/registrazioni ----
// Si rigiocano nel codice vero con il riconoscimento degli assi acceso. Riferimento: l'assetto dal solo accelerometro
// mediato su 1 s (il telefono è fermo o quasi). Dopo 9 s la stima deve stargli entro 8° di beccheggio e 15° di rollio.
// Controprova: gli stessi dati riportati all'ordine standard (alpha = z, beta = x, gamma = y) non devono far cambiare l'ordine degli assi.
function registrazione(file, rimetti) {
  const righe = fs.readFileSync(file, 'utf8').split('\n');
  const mont = JSON.parse((righe.find(l => /^# montaggio /.test(l)) || '# montaggio null').slice(12));
  const dati = righe.filter(l => l && l[0] !== '#').map(l => l.split(' ').map(Number));
  const ctx = { D2R, R2D, clamp, angDiff, wrap360, performance, PH: {}, S: {}, LIVE: {} }, app = load(ctx), log = [];
  S = { gpsReal: true, gs: 4, roll: 0, hdg: 0, trk: null }; LIVE = {};
  PH = { M: mont || VERTICALE, accSign: 1, aAvg: [0, 0, 0], mCount: 0, mT0: 0, demo: false, scrAng: () => 0, accCheck: () => {}, smooth: 3, tas: null, dvdt: 0,
    trkRate: 0, trkRateT: -1e9, slipF: 0, hdg: 0, magInUse: () => false, mag: {}, act: m => log.push(m), vario: { predict() {} },
    ahrs: new app.PhMahony(), ahrsInit: false, attF: null };
  for (const k of ['GPERM', 'gyroRaw', 'gyroLearn']) PH[k] = app.giro[k];
  PH.gmap = { p: 0, s: 1, fixed: false }; PH.gdet = { A: null, w: null, E: new Float64Array(12), n: 0, tt: 0 };
  PH.toBody = app.toBody; PH.onMotion = app.onMotion; app.bind(PH, S, LIVE);
  const acc = [];                                          // assetto dal solo accelerometro, mediato su 1 s
  let peggio = { roll: 0, pitch: 0 };
  for (const r of dati) {
    T = r[0]; const g = rimetti ? [r[7], r[5], r[6]] : [r[5], r[6], r[7]];   // telefono: alpha, beta, gamma = x, y, z
    PH.onMotion({ accelerationIncludingGravity: { x: r[2], y: r[3], z: r[4] }, rotationRate: { alpha: g[0], beta: g[1], gamma: g[2] }, interval: 0.016, timeStamp: T });
    const fb = PH.toBody([r[2], r[3], r[4]]).map(x => x / G);
    acc.push([T, Math.atan2(-fb[1], -fb[2]) * R2D, Math.atan2(fb[0], Math.hypot(fb[1], fb[2])) * R2D]);
    while (acc.length && T - acc[0][0] > 1000) acc.shift();
    if (T > 9000) { const ro = acc.reduce((s, x) => s + x[1], 0) / acc.length, pi = acc.reduce((s, x) => s + x[2], 0) / acc.length;
      peggio.roll = Math.max(peggio.roll, Math.abs(angDiff(S.roll, ro))); peggio.pitch = Math.max(peggio.pitch, Math.abs(S.pitch - pi)); }
  }
  const cambi = log.filter(m => /giroscopio: assi/.test(m));
  const ok = peggio.pitch <= 8 && peggio.roll <= 15 && (rimetti ? cambi.length === 0 : true);
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${(path.basename(file) + (rimetti ? ' (riportata agli assi standard)' : '')).padEnd(58)} scarto max dall'accelerometro dopo 9 s: rollio ${peggio.roll.toFixed(1)}° · beccheggio ${peggio.pitch.toFixed(1)}° · ${cambi.length ? cambi.join(', ') : 'assi invariati'}`);
  return ok;
}
const dirReg = path.join(__dirname, 'registrazioni');
if (fs.existsSync(dirReg)) for (const f of fs.readdirSync(dirReg).filter(f => f.endsWith('.txt')).sort()) {
  tutti = registrazione(path.join(dirReg, f), false) && tutti;
  if (/scambiati/.test(fs.readFileSync(path.join(dirReg, f), 'utf8').slice(0, 400))) tutti = registrazione(path.join(dirReg, f), true) && tutti;
}
console.log(tutti ? '\nTutte le prove dell\'assetto passano.' : '\nAlmeno una prova dell\'assetto NON passa.');
process.exit(tutti ? 0 : 1);
