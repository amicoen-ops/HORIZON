// HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
// Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
//
// HORIZON Licenze: UN SOLO FILE da incollare in script.google.com (account horizonlicenses). Fa tutto da sé:
//  · ogni minuto guarda la casella: se c'è una richiesta nuova o una mail con l'etichetta M, A o P
//    (messa da te dopo aver visto il pagamento) fa partire su GitHub il giro «Licenze per posta», che manda
//    i prezzi o il codice di licenza al pilota e sistema le etichette (Da gestire, Gestite);
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
  // a livello di conversazione: già gestita no; con M/A/P sì; altrimenti solo se nessuno l'ha ancora presa (né Da gestire né Da vedere)
  return GmailApp.search(DA_LAVORARE, 0, 20).filter(t => {
    const nomi = t.getLabels().map(l => l.getName());
    if (nomi.includes('Gestite')) return false;
    if (nomi.some(n => n === 'M' || n === 'A' || n === 'P')) return true;
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
  ['M', 'A', 'P', 'Da gestire', 'Gestite', 'Da vedere', 'Archivio generale licenze'].forEach(n => GmailApp.getUserLabelByName(n) || GmailApp.createLabel(n));
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
