// HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
// Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
//
// HORIZON Licenze: UN SOLO FILE da incollare in script.google.com (account horizonlicenses). Fa tutto da sé:
//  · ogni minuto guarda la casella: se c'è una richiesta nuova o una mail con l'etichetta M, A o P
//    (messa da te dopo aver visto il pagamento) fa partire su GitHub il giro «Licenze per posta», che manda
//    i prezzi o il codice di licenza al pilota e sistema le etichette (Da gestire, Gestite);
//  · lo stesso per le segnalazioni dei piloti («Problema», «Registrazione sensori»…): il giro le analizza, risponde da
//    solo ai casi noti («Segnalazioni analizzate») e lascia in arrivo le altre («Segnalazioni da vedere»);
//  · una volta al giorno, dalle 7, fa partire il giro anche per il riepilogo («Archivio generale licenze»);
//  · nel Calendar di horizonlicenses mette i promemoria delle scadenze che servono a far funzionare tutto:
//    token GitHub (data vera, letta da GitHub: avviso 14 giorni prima e il giorno stesso), controllo di Google Play
//    ogni estate (requisito Android di riferimento entro il 31 agosto) e controllo annuale delle altre chiavi.
// Le etichette M, A, P in Gmail sono i «tasti»: sul telefono, apri la mail › ⋮ › Etichetta › M, A o P.
// La chiave che firma le licenze e il registro restano su GitHub; qui c'è solo un token che può far partire i lavori
// del repository HORIZON, salvato nelle proprietà dello script (GITHUB_TOKEN), mai nel codice.
//
// INSTALLAZIONE (una volta, circa 5 minuti, meglio dal computer):
//  1. github.com/settings/personal-access-tokens/new › nome «HORIZON licenze Gmail», scadenza 1 anno,
//     Only select repositories › amicoen-ops/HORIZON, Permissions › Actions: Read and write › Generate token. Copialo.
//  2. script.google.com (entrato come horizonlicenses) › Nuovo progetto › cancella tutto e incolla QUESTO file.
//  3. Ingranaggio «Impostazioni progetto» › in fondo «Aggiungi proprietà dello script»: GITHUB_TOKEN = il token › Salva.
//  4. Torna all'editor, in alto scegli la funzione «installa» › Esegui › consenti l'accesso (se dice «Google non ha
//     verificato questa app»: Avanzate › Vai a … › Consenti: lo script è tuo e non è pubblicato).
//     Nel registro deve comparire «Pronto: controllo ogni minuto … Promemoria nel Calendar: il token scade il …».
// Altre funzioni da lanciare quando vuoi: «riepilogoOra» (riepilogo subito), «stato» (cosa c'è da lavorare).

const REPO = 'amicoen-ops/HORIZON', WORKFLOW = 'licenze-posta.yml';
// richieste nuove (senza etichette) oppure mail con M/A/P non ancora gestite
const DA_LAVORARE = '(subject:(HORIZON licenza) newer_than:30d -from:me -label:da-gestire -label:gestite -label:da-vedere -label:m -label:a -label:p)'
  + ' OR label:m OR label:a OR label:p';
// segnalazioni dei piloti arrivate dall'app e non ancora analizzate (il giro risponde da solo ai casi noti)
const SEGNALAZIONI = 'newer_than:3d -from:me -label:segnalazioni-analizzate -label:segnalazioni-da-vedere -label:segnalazioni-gestite '
  + '{subject:(HORIZON Problema) subject:(HORIZON Registrazione sensori) subject:(HORIZON Suggerimento) subject:(HORIZON Dato sbagliato)}';
const PAUSA_MS = 4 * 60 * 1000;          // dopo un avvio si aspetta che GitHub finisca prima di riavviarlo

function avviaGiro_(riepilogo) {
  const token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!token) return 'manca GITHUB_TOKEN nelle proprietà dello script (Impostazioni progetto)';
  const r = UrlFetchApp.fetch('https://api.github.com/repos/' + REPO + '/actions/workflows/' + WORKFLOW + '/dispatches', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    payload: JSON.stringify({ ref: 'main', inputs: riepilogo ? { riepilogo: 'true' } : {} })
  });
  const c = r.getResponseCode();
  return c === 204 ? '' : 'GitHub ha risposto ' + c + (c === 401 || c === 403 ? ' (token scaduto o senza «Actions: Read and write»)' : '');
}

function daLavorare_() {
  // a livello di conversazione: con M/A/P sì, anche se è già gestita (un rinnovo nella stessa conversazione: prima la
  // sveglia non partiva; il giro toglie M/A/P a tutte le mail, quindi non riparte a vuoto); già gestita no;
  // altrimenti solo se nessuno l'ha ancora presa (né Da gestire né Da vedere)
  const seg = GmailApp.search(SEGNALAZIONI, 0, 20).filter(t => !t.getLabels().some(l => /^Segnalazioni (analizzate|da vedere|gestite)$/.test(l.getName()))).length;      // «gestite» comprese: senza, una segnalazione chiusa da te faceva ripartire il giro ogni 4 minuti per 3 giorni
  const chiuse = GmailApp.search('label:chiusa OR label:risposta-sbagliata', 0, 5).length;      // «Chiusa» messa da te: il giro la archivia in «Segnalazioni gestite»
  return seg + chiuse + GmailApp.search(DA_LAVORARE, 0, 20).filter(t => {
    const nomi = t.getLabels().map(l => l.getName());
    if (nomi.some(n => n === 'M' || n === 'A' || n === 'P')) return true;
    if (nomi.includes('Gestite')) return false;
    return !nomi.includes('Da gestire') && !nomi.includes('Da vedere') && t.getMessages().some(m => !/horizonlicenses@gmail\.com/i.test(m.getFrom()));
  }).length;
}

// gira da sola ogni minuto
function sveglia() {
  const p = PropertiesService.getScriptProperties(), ora = new Date();
  const oggi = Utilities.formatDate(ora, 'Europe/Rome', 'yyyy-MM-dd'), h = +Utilities.formatDate(ora, 'Europe/Rome', 'H');
  const ultimo = +(p.getProperty('ULTIMO_AVVIO') || 0);
  if (ora.getTime() - ultimo < PAUSA_MS) return;
  const serve = daLavorare_() > 0 || (h >= 7 && p.getProperty('GIRO_DEL_GIORNO') !== oggi);
  if (!serve) return;
  const err = avviaGiro_(false);
  if (err) { console.log(err); return; }
  p.setProperty('ULTIMO_AVVIO', String(ora.getTime()));
  if (p.getProperty('GIRO_DEL_GIORNO') !== oggi) { p.setProperty('GIRO_DEL_GIORNO', oggi); try { calendario_(); } catch (e) { console.log('calendario: ' + e); } }
}

// ---------- scadenze nel Calendar ----------
const GIORNO = 86400000;
const TESTO_TOKEN = 'Il token GitHub «HORIZON licenze Gmail» (sveglia delle licenze) sta per scadere: senza, le licenze non partono da sole.\n'
  + '1. github.com/settings/personal-access-tokens › HORIZON licenze Gmail › Regenerate token (scadenza 1 anno) e copialo.\n'
  + '2. script.google.com (horizonlicenses) › HORIZON Licenze › Impostazioni progetto › proprietà GITHUB_TOKEN › incolla il nuovo › Salva.\n'
  + '3. Editor › funzione «installa» › Esegui: i promemoria si spostano da soli alla nuova scadenza.';
const TESTO_PLAY = 'Google Play chiede ogni anno, entro il 31 agosto, che gli aggiornamenti usino un Android di riferimento recente (targetSdk).\n'
  + 'Controlla in Play Console › Criteri e programmi › Stato dell\'app se ci sono avvisi; HORIZON oggi è a targetSdk 36 (android/variables.gradle).\n'
  + 'Se serve, chiedi a Claude di alzarlo e ricompilare.';
const TESTO_ANNO = 'Controllo annuale di HORIZON (le chiavi senza scadenza che però si possono invalidare):\n'
  + '· Gmail horizonlicenses: la password per le app (segreto GitHub GMAIL_LICENZE) smette di valere se cambi la password di Google.\n'
  + '· Google Play: account di servizio (segreto PLAY_SERVICE_ACCOUNT_JSON) ancora attivo in Play Console › Utenti e autorizzazioni.\n'
  + '· Web3Forms (segnalazioni dall\'app): la chiave è attiva su web3forms.com.\n'
  + '· Garmin Connect IQ: l\'app HORIZON Link è ancora pubblicata nel tuo account sviluppatore.\n'
  + '· PayPal: il link paypal.me/amicoen funziona.';

function scadenzaToken_() {
  const token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN'); if (!token) return null;
  const r = UrlFetchApp.fetch('https://api.github.com/repos/' + REPO, { muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' } });
  const h = r.getAllHeaders(), k = Object.keys(h).find(x => x.toLowerCase() === 'github-authentication-token-expiration');
  if (!k) return null;
  const d = new Date(String(h[k]).replace(' UTC', 'Z').replace(' ', 'T'));
  return isNaN(d) ? null : d;
}

function alle9_(d) { const x = new Date(d); x.setHours(9, 0, 0, 0); return x; }
function evento_(cal, titolo, giorno, testo) {
  const e = cal.createEvent(titolo, alle9_(giorno), new Date(alle9_(giorno).getTime() + 30 * 60000), { description: testo });
  e.addPopupReminder(0); e.addEmailReminder(0); return e.getId();
}

function calendario_() {
  const p = PropertiesService.getScriptProperties(), cal = CalendarApp.getDefaultCalendar();
  const exp = scadenzaToken_();
  if (exp && p.getProperty('SCADENZA_TOKEN') !== exp.toISOString()) {          // token nuovo: promemoria spostati
    JSON.parse(p.getProperty('EVENTI_TOKEN') || '[]').forEach(id => { try { cal.getEventById(id).deleteEvent(); } catch (e) {} });
    const ids = [evento_(cal, 'HORIZON · il token GitHub delle licenze scade tra 14 giorni', new Date(exp.getTime() - 14 * GIORNO), TESTO_TOKEN),
                 evento_(cal, 'HORIZON · OGGI scade il token GitHub delle licenze', exp, TESTO_TOKEN)];
    p.setProperty('EVENTI_TOKEN', JSON.stringify(ids)); p.setProperty('SCADENZA_TOKEN', exp.toISOString());
  }
  if (!p.getProperty('EVENTI_ANNUALI')) {                                       // una volta sola: ripetuti ogni anno
    const y = new Date().getFullYear(), rip = CalendarApp.newRecurrence().addYearlyRule();
    const luglio = alle9_(new Date(y + (new Date().getMonth() >= 6 ? 1 : 0), 6, 1));
    const novembre = alle9_(new Date(y + 1, 10, 9));
    const a = cal.createEventSeries('HORIZON · Google Play: controlla il requisito Android (entro il 31 agosto)', luglio, new Date(luglio.getTime() + 30 * 60000), rip, { description: TESTO_PLAY });
    const b = cal.createEventSeries('HORIZON · controllo annuale delle chiavi', novembre, new Date(novembre.getTime() + 30 * 60000), rip, { description: TESTO_ANNO });
    [a, b].forEach(s => { s.addPopupReminder(0); s.addEmailReminder(0); });
    p.setProperty('EVENTI_ANNUALI', '1');
  }
  return exp;
}

// da lanciare una volta: crea le etichette e la sveglia ogni minuto, poi fa un primo giro
function installa() {
  ['M', 'A', 'P', 'Da gestire', 'Gestite', 'Da vedere', 'Archivio generale licenze', 'Chiusa', 'Risposta sbagliata', 'Segnalazioni gestite'].forEach(n => GmailApp.getUserLabelByName(n) || GmailApp.createLabel(n));
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('sveglia').timeBased().everyMinutes(1).create();
  const err = avviaGiro_(false), p = PropertiesService.getScriptProperties();
  if (!err) { p.setProperty('ULTIMO_AVVIO', String(Date.now())); p.setProperty('GIRO_DEL_GIORNO', Utilities.formatDate(new Date(), 'Europe/Rome', 'yyyy-MM-dd')); }
  let cal = ''; try { const exp = calendario_(); cal = exp ? ' Promemoria nel Calendar: il token scade il ' + Utilities.formatDate(exp, 'Europe/Rome', 'dd/MM/yyyy') + '.' : ' (scadenza del token non letta: promemoria rimandati)'; } catch (e) { cal = ' Calendar: ' + e; }
  console.log((err ? 'Sveglia creata, ma ' + err : 'Pronto: controllo ogni minuto. Primo giro avviato su GitHub.') + cal);
}

function riepilogoOra() { console.log(avviaGiro_(true) || 'Riepilogo in arrivo entro 1-2 minuti, in «Archivio generale licenze».'); }

function stato() {
  const p = PropertiesService.getScriptProperties();
  console.log('Da lavorare: ' + daLavorare_() + ' · ultimo avvio: ' + (p.getProperty('ULTIMO_AVVIO') ? new Date(+p.getProperty('ULTIMO_AVVIO')) : 'mai')
    + ' · sveglie attive: ' + ScriptApp.getProjectTriggers().length + ' · token: ' + (p.getProperty('GITHUB_TOKEN') ? 'presente' : 'MANCA'));
}

// ---------- console (app HorizonAdmin): SOLA LETTURA ----------
// L'app chiede a questo indirizzo le code di lavoro. Non cambia niente nella casella. Risponde solo a chi ha la chiave
// (proprietà CONSOLE_KEY, creata dalla funzione «consoleChiave»); negli elenchi ci sono oggetto e data, mai indirizzi.
// Attivazione, una volta: lancia «consoleChiave» › poi in alto a destra Esegui il deployment › Nuovo deployment › tipo
// «Applicazione web» › Esegui come: Me › Chi ha accesso: Chiunque › Esegui il deployment › copia l'URL dell'applicazione web,
// aggiungi in fondo ?k= e la chiave scritta nel registro, e incolla tutto in HorizonAdmin › ⚙.
// nome, ricerca, urgente, tipo delle voci ('licenza': tasti M/A/P · 'segnalazione': tasto Chiusa · 'analizzata': tasto
// Risposta sbagliata · '' : solo elenco · null: solo il numero)
const CODE_CONSOLE = [
  ['Licenze: il pilota ha scritto', 'label:da-gestire in:inbox', true, 'licenza'],
  ['Licenze da vedere', 'label:da-vedere in:inbox', true, ''],
  ['Segnalazioni da vedere', 'label:segnalazioni-da-vedere in:inbox', true, 'segnalazione'],
  ['Licenze in attesa di pagamento', 'label:da-gestire -in:inbox newer_than:30d', false, 'licenza'],
  ['Risposte automatiche, 7 giorni', 'label:segnalazioni-analizzate newer_than:7d', false, 'analizzata'],
  ['Segnalazioni chiuse da te, 7 giorni', 'label:segnalazioni-gestite newer_than:7d', false, null]
];
// i tasti della console: mettono un'etichetta (come faresti tu in Gmail) o avviano un giro; il lavoro lo fa GitHub.
// Ogni tasto vale solo sulle conversazioni che hanno già l'etichetta giusta.
const TASTI_CONSOLE = { M: ['M', 'Da gestire'], A: ['A', 'Da gestire'], P: ['P', 'Da gestire'],
  chiusa: ['Chiusa', 'Segnalazioni da vedere'], sbagliata: ['Risposta sbagliata', 'Segnalazioni analizzate'] };
const MAX_PIN_SBAGLIATI = 5;

function consoleChiave() {
  const p = PropertiesService.getScriptProperties();
  let k = p.getProperty('CONSOLE_KEY');
  if (!k) { k = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ''); p.setProperty('CONSOLE_KEY', k); }
  console.log('Chiave della console (da aggiungere in fondo all\'URL dell\'applicazione web):  ?k=' + k
    + '\nPer cambiarla: cancella la proprietà CONSOLE_KEY nelle Impostazioni progetto e rilancia questa funzione.');
}

function doGet(e) {
  const p = PropertiesService.getScriptProperties(), k = p.getProperty('CONSOLE_KEY'), data = {};
  const dato = (e && e.parameter && e.parameter.k) || '';
  if (!k || dato.length !== k.length || dato !== k) data.errore = 'chiave della console sbagliata';
  else {
    const posta = encodeURIComponent(Session.getEffectiveUser().getEmail());
    data.code = CODE_CONSOLE.map(c => {
      const t = GmailApp.search(c[1], 0, 50);
      return { nome: c[0], n: t.length, urgente: c[2], info: !c[2] && c[3] !== 'licenza', tipo: c[3] || '', voci: c[3] === null ? [] : t.slice(0, 10).map(x => ({
        id: x.getId(), oggetto: String(x.getFirstMessageSubject() || '(senza oggetto)').slice(0, 140), quando: x.getLastMessageDate().toISOString(),
        link: 'https://mail.google.com/mail/?authuser=' + posta + '#all/' + x.getId() })) };
    });
    const rie = GmailApp.search('subject:(HORIZON Riepilogo licenze) from:me', 0, 1)[0];      // numeri delle licenze: la prima riga dell'ultimo riepilogo
    if (rie) { const m = rie.getMessages().pop(), riga = String(m.getPlainBody() || '').split('\n').map(x => x.trim()).filter(x => /^\d+ licenze/.test(x))[0];
      if (riga) data.licenze = { testo: riga.slice(0, 200), quando: m.getDate().toISOString() }; }
    const pinC = String(p.getProperty('CONSOLE_PIN') || '').trim();
    data.senzaPin = pinC.toLowerCase() === 'no';      // scelta dell'autore: tasti con la sola chiave
    data.tasti = data.senzaPin || (pinC.length >= 6 && +(p.getProperty('CONSOLE_PIN_SBAGLIATI') || 0) < MAX_PIN_SBAGLIATI);
    data.stato = { ultimoAvvio: p.getProperty('ULTIMO_AVVIO') ? new Date(+p.getProperty('ULTIMO_AVVIO')).toISOString() : null,
      sveglie: ScriptApp.getProjectTriggers().length, token: !!p.getProperty('GITHUB_TOKEN'), scadenzaToken: p.getProperty('SCADENZA_TOKEN') || null };
  }
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

// Se nella proprietà CONSOLE_PIN scrivi «no», i tasti funzionano con la sola chiave, senza PIN: comodo, ma allora chi
// ha il telefono sbloccato (o l'indirizzo con la chiave) può emettere licenze. Tieni segreta la chiave.
// I tasti: servono la chiave (sul telefono) E il PIN (proprietà CONSOLE_PIN, almeno 6 cifre, che scrivi tu nelle
// Impostazioni progetto e che l'app non salva). Dopo 5 PIN sbagliati i tasti si bloccano: per sbloccarli lancia
// «consoleSblocca». Senza la proprietà CONSOLE_PIN i tasti restano spenti e la console è in sola lettura.
function consoleSblocca() { PropertiesService.getScriptProperties().deleteProperty('CONSOLE_PIN_SBAGLIATI'); console.log('Tasti della console sbloccati.'); }

function doPost(e) {
  const p = PropertiesService.getScriptProperties(), out = x => ContentService.createTextOutput(JSON.stringify(x)).setMimeType(ContentService.MimeType.JSON);
  let d = {}; try { d = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) {}
  const k = p.getProperty('CONSOLE_KEY'), pin = String(p.getProperty('CONSOLE_PIN') || '').trim(), senzaPin = pin.toLowerCase() === 'no';
  if (!k || String(d.k || '') !== k) return out({ errore: 'chiave della console sbagliata' });
  if (!senzaPin && pin.length < 6) return out({ errore: 'i tasti sono spenti: nello script manca la proprietà CONSOLE_PIN (un PIN di almeno 6 cifre, oppure «no» per usarli senza PIN)' });
  const blocco = LockService.getScriptLock(); blocco.waitLock(10000);
  try { if (!senzaPin) {
    const sbagli = +(p.getProperty('CONSOLE_PIN_SBAGLIATI') || 0);
    if (sbagli >= MAX_PIN_SBAGLIATI) return out({ errore: 'tasti bloccati dopo troppi PIN sbagliati: lancia «consoleSblocca» nello script' });
    if (String(d.pin || '') !== pin) { p.setProperty('CONSOLE_PIN_SBAGLIATI', String(sbagli + 1)); return out({ errore: 'PIN sbagliato (' + (MAX_PIN_SBAGLIATI - sbagli - 1) + ' tentativi rimasti)', pin: false }); }
    if (sbagli) p.deleteProperty('CONSOLE_PIN_SBAGLIATI');
  } } finally { blocco.releaseLock(); }
  if (d.azione === 'prova') return out({ ok: true });
  if (d.azione === 'riepilogo' || d.azione === 'giro') {
    const err = avviaGiro_(d.azione === 'riepilogo');
    if (!err) p.setProperty('ULTIMO_AVVIO', String(Date.now()));
    console.log('console: ' + d.azione + (err ? ' → ' + err : ''));
    return out(err ? { errore: err } : { ok: true });
  }
  const tasto = TASTI_CONSOLE[d.azione];
  if (!tasto) return out({ errore: 'tasto sconosciuto' });
  let t = null; try { t = GmailApp.getThreadById(String(d.id || '')); } catch (err) {}
  if (!t) return out({ errore: 'conversazione non trovata' });
  const nomi = t.getLabels().map(l => l.getName());
  if (!nomi.includes(tasto[1])) return out({ errore: 'questa conversazione non è più in «' + tasto[1] + '»: aggiorna l\'elenco' });
  if (['M', 'A', 'P'].some(x => nomi.includes(x))) return out({ errore: 'ha già un\'etichetta M, A o P in lavorazione' });
  t.addLabel(GmailApp.getUserLabelByName(tasto[0]) || GmailApp.createLabel(tasto[0]));
  console.log('console: etichetta ' + tasto[0] + ' su una conversazione');
  return out({ ok: true });
}

