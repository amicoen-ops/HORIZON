// HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
// Prove della console (doGet/doPost) dello script di Gmail, con servizi di Google finti: node tools/test_console_gmail.js
const vm = require('vm'), fs = require('fs');
const prop = { CONSOLE_KEY: 'k'.repeat(32), GITHUB_TOKEN: 't' }, avvii = [];
const etichette = { T1: ['Da gestire'], T2: ['Segnalazioni da vedere'], T3: ['Segnalazioni analizzate'], T4: ['Da gestire', 'M'] };
const thread = id => ({ getId: () => id, getLabels: () => etichette[id].map(n => ({ getName: () => n })), addLabel: l => etichette[id].push(l.getName()),
  getFirstMessageSubject: () => 'oggetto ' + id, getLastMessageDate: () => new Date(), getMessages: () => [{ getPlainBody: () => '14 licenze · 11 attive', getDate: () => new Date(), getFrom: () => 'x' }] });
const ctx = { console: { log() {} }, Utilities: { getUuid: () => 'u-u', formatDate: () => '' }, CalendarApp: {}, Session: { getEffectiveUser: () => ({ getEmail: () => 'h@gmail.com' }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => prop[k] ?? null, setProperty: (k, v) => { prop[k] = v; }, deleteProperty: k => { delete prop[k]; } }) },
  ScriptApp: { getProjectTriggers: () => [1] }, LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  UrlFetchApp: { fetch: (u, o) => { avvii.push(JSON.parse(o.payload).inputs); return { getResponseCode: () => 204 }; } },
  GmailApp: { search: q => q.includes('da-gestire in:inbox') ? [thread('T1')] : q.includes('Riepilogo') ? [thread('T1')] : [], getThreadById: id => etichette[id] ? thread(id) : null,
    getUserLabelByName: n => ({ getName: () => n }), createLabel: n => ({ getName: () => n }) },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: t => ({ setMimeType: () => JSON.parse(t) }) } };
vm.createContext(ctx); vm.runInContext(fs.readFileSync(require("path").join(__dirname, "gmail-licenze", "HORIZON-Licenze.gs"), 'utf8'), ctx);
const post = b => ctx.doPost({ postData: { contents: JSON.stringify(b) } }), K = prop.CONSOLE_KEY;
let n = 0; const vero = (c, x) => { n++; if (!x) { console.log('FALLITA:', c); process.exit(1); } };
vero('lettura senza chiave rifiutata', ctx.doGet({ parameter: { k: 'x' } }).errore);
let g = ctx.doGet({ parameter: { k: K } });
vero('lettura: code, id, licenze, tasti spenti senza PIN', g.code.length === 6 && g.code[0].voci[0].id === 'T1' && g.code[0].tipo === 'licenza' && g.licenze.testo.startsWith('14') && g.tasti === false);
vero('tasto senza PIN impostato: spento', /spenti/.test(post({ k: K, pin: '123456', azione: 'M', id: 'T1' }).errore));
prop.CONSOLE_PIN = '246810';
vero('tasti accesi con il PIN impostato', ctx.doGet({ parameter: { k: K } }).tasti === true);
vero('chiave sbagliata', /chiave/.test(post({ k: 'no', pin: '246810', azione: 'M', id: 'T1' }).errore));
vero('PIN sbagliato conta', post({ k: K, pin: '000000', azione: 'M', id: 'T1' }).pin === false && prop.CONSOLE_PIN_SBAGLIATI === '1' && !etichette.T1.includes('M'));
vero('PIN giusto: etichetta M e contatore azzerato', post({ k: K, pin: '246810', azione: 'M', id: 'T1' }).ok && etichette.T1.includes('M') && !prop.CONSOLE_PIN_SBAGLIATI);
vero('seconda etichetta sulla stessa licenza rifiutata', /già/.test(post({ k: K, pin: '246810', azione: 'P', id: 'T4' }).errore));
vero('M su una segnalazione rifiutata', /non è più/.test(post({ k: K, pin: '246810', azione: 'M', id: 'T2' }).errore));
vero('Chiusa su segnalazione da vedere', post({ k: K, pin: '246810', azione: 'chiusa', id: 'T2' }).ok && etichette.T2.includes('Chiusa'));
vero('Chiusa su una licenza rifiutata', post({ k: K, pin: '246810', azione: 'chiusa', id: 'T1' }).errore);
vero('Risposta sbagliata su analizzata', post({ k: K, pin: '246810', azione: 'sbagliata', id: 'T3' }).ok && etichette.T3.includes('Risposta sbagliata'));
vero('tasto sconosciuto e conversazione inesistente', post({ k: K, pin: '246810', azione: 'cancella', id: 'T1' }).errore && post({ k: K, pin: '246810', azione: 'M', id: 'ZZ' }).errore);
vero('riepilogo avvia il giro giusto', post({ k: K, pin: '246810', azione: 'riepilogo' }).ok && avvii.pop().riepilogo === 'true');
for (let i = 0; i < 5; i++) post({ k: K, pin: '111111', azione: 'M', id: 'T1' });
vero('dopo 5 PIN sbagliati: bloccati anche col PIN giusto', /bloccati/.test(post({ k: K, pin: '246810', azione: 'chiusa', id: 'T2' }).errore) && ctx.doGet({ parameter: { k: K } }).tasti === false);
ctx.consoleSblocca(); vero('sblocco', post({ k: K, pin: '246810', azione: 'prova' }).ok);
// scelta dell'autore: CONSOLE_PIN = «no» → tasti con la sola chiave
prop.CONSOLE_PIN = 'No'; etichette.T5 = ['Segnalazioni da vedere'];
vero('senza PIN: tasti accesi e dichiarati', ctx.doGet({ parameter: { k: K } }).tasti === true && ctx.doGet({ parameter: { k: K } }).senzaPin === true);
vero('senza PIN: il tasto passa con la sola chiave', post({ k: K, azione: 'chiusa', id: 'T5' }).ok && etichette.T5.includes('Chiusa'));
vero('senza PIN: la chiave sbagliata resta rifiutata', /chiave/.test(post({ k: 'x', azione: 'chiusa', id: 'T5' }).errore));
prop.CONSOLE_PIN = '246810';
// la sveglia non deve ripartire per una segnalazione già chiusa dall'autore («Segnalazioni gestite»)
etichette.G1 = ['Segnalazioni gestite']; etichette.N1 = [];
ctx.GmailApp.search = q => q.includes('Registrazione sensori') ? [thread('G1')] : [];
vero('segnalazione gestita: niente da lavorare', vm.runInContext('daLavorare_()', ctx) === 0 && /-label:segnalazioni-gestite/.test(vm.runInContext('SEGNALAZIONI', ctx)));
ctx.GmailApp.search = q => q.includes('Registrazione sensori') ? [thread('N1')] : [];
vero('segnalazione nuova: da lavorare', vm.runInContext('daLavorare_()', ctx) === 1);
// consoleCollega: manda a sé stessa l'indirizzo completo; senza deployment (o con l'URL di prova) non manda niente
const mandate = []; ctx.GmailApp.sendEmail = (a, o, t) => mandate.push({ a, o, t });
ctx.ScriptApp.getService = () => ({ getUrl: () => 'https://script.google.com/macros/s/AKfycb_dev/dev' }); ctx.consoleCollega();
vero('collega: con l\'URL di prova non manda niente', mandate.length === 0);
ctx.ScriptApp.getService = () => ({ getUrl: () => 'https://script.google.com/macros/u/1/s/AKfycb_ok-1/exec' }); ctx.consoleCollega();
vero('collega: mail a sé stessa con l\'indirizzo completo e pulito', mandate.length === 1 && mandate[0].a === 'h@gmail.com' && mandate[0].t.includes('https://script.google.com/macros/s/AKfycb_ok-1/exec?k=' + K));
console.log('Tutte le ' + n + ' prove della console di Gmail passano.');
