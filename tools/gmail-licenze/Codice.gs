// HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
// Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
//
// HORIZON Licenze: componente aggiuntivo di Gmail per la casella horizonlicenses (Google Apps Script).
//  · Aprendo una richiesta di licenza compaiono i tasti Mensile / Annuale / Perenne: mettono l'etichetta M, A o P
//    e fanno partire subito il giro su GitHub (workflow «Licenze per posta»), che crea il codice e lo manda.
//  · Sveglia ogni 10 minuti: se ci sono richieste nuove o etichette M/A/P da lavorare fa partire il giro;
//    una volta al giorno, dalle 7, lo fa partire comunque per il riepilogo («Archivio generale licenze»).
//    (Su questo repository i lavori programmati di GitHub partono con ore di ritardo: per questo la sveglia è qui.)
// La chiave che firma le licenze e il registro restano su GitHub: qui c'è solo un token che può far partire i lavori
// del repository HORIZON, salvato nelle proprietà dello script (GITHUB_TOKEN), mai nel codice.
// Installazione: vedi LEGGIMI.md in questa cartella.

const REPO = 'amicoen-ops/HORIZON', WORKFLOW = 'licenze-posta.yml';
const TIPI = { M: ['Mensile', '5 €'], A: ['Annuale', '30 €'], P: ['Perenne', '150 € (o omaggio ai tester)'] };
const TEL = /([A-HJ-NP-Z2-9]{4})-([A-HJ-NP-Z2-9]{4})-([A-HJ-NP-Z2-9]{4})/;
const DA_LAVORARE = [
  'subject:(HORIZON licenza) newer_than:30d -from:me -label:da-gestire -label:gestite -label:da-vedere -label:m -label:a -label:p',
  'label:m -label:gestite -from:me', 'label:a -label:gestite -from:me', 'label:p -label:gestite -from:me'];

// ---------- GitHub ----------
function avviaGiro_(riepilogo) {
  const token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!token) return 'manca GITHUB_TOKEN nelle proprietà dello script';
  const r = UrlFetchApp.fetch('https://api.github.com/repos/' + REPO + '/actions/workflows/' + WORKFLOW + '/dispatches', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    payload: JSON.stringify({ ref: 'main', inputs: riepilogo ? { riepilogo: 'true' } : {} })
  });
  return r.getResponseCode() === 204 ? '' : 'GitHub ha risposto ' + r.getResponseCode();
}

// ---------- sveglia ----------
function sveglia() {
  const p = PropertiesService.getScriptProperties(), ora = new Date();
  const oggi = Utilities.formatDate(ora, 'Europe/Rome', 'yyyy-MM-dd'), h = +Utilities.formatDate(ora, 'Europe/Rome', 'H');
  let serve = DA_LAVORARE.some(q => GmailApp.search(q, 0, 1).length > 0);
  if (!serve && h >= 7 && p.getProperty('GIRO_DEL_GIORNO') !== oggi) serve = true;     // riepilogo del giorno
  if (!serve) return;
  const err = avviaGiro_(false);
  if (err) console.log(err); else p.setProperty('GIRO_DEL_GIORNO', oggi);
}

// da lanciare una volta dall'editor: crea la sveglia ogni 10 minuti (e le etichette, se mancano)
function installa() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'sveglia').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('sveglia').timeBased().everyMinutes(10).create();
  ['M', 'A', 'P', 'Da gestire', 'Gestite', 'Da vedere', 'Archivio generale licenze'].forEach(n => GmailApp.getUserLabelByName(n) || GmailApp.createLabel(n));
  console.log('Sveglia attiva ogni 10 minuti. ' + (avviaGiro_(false) || 'Primo giro avviato su GitHub.'));
}

// ---------- componente aggiuntivo di Gmail ----------
function home() {
  const n = DA_LAVORARE.reduce((s, q) => s + GmailApp.search(q, 0, 50).length, 0);
  return CardService.newCardBuilder().setHeader(CardService.newCardHeader().setTitle('HORIZON Licenze'))
    .addSection(CardService.newCardSection()
      .addWidget(CardService.newTextParagraph().setText('Apri una richiesta di licenza per dare la licenza con un tocco.'))
      .addWidget(CardService.newTextParagraph().setText(n ? '<b>Da lavorare: ' + n + '</b> (partono al prossimo giro, entro 10 minuti)' : 'Niente in attesa.'))
      .addWidget(CardService.newTextButton().setText('Riepilogo licenze adesso')
        .setOnClickAction(CardService.newAction().setFunctionName('riepilogoOra'))))
    .build();
}

function apriMail(e) {
  GmailApp.setCurrentMessageAccessToken(e.gmail.accessToken);
  const m = GmailApp.getMessageById(e.gmail.messageId), t = m.getThread();
  const tel = (m.getSubject().match(TEL) || m.getPlainBody().match(TEL) || [])[0];
  const etichette = t.getLabels().map(l => l.getName());
  const card = CardService.newCardBuilder().setHeader(CardService.newCardHeader().setTitle('HORIZON Licenze')
    .setSubtitle(tel ? 'Telefono ' + tel : 'Questa mail non contiene un codice del telefono'));
  const s = CardService.newCardSection();
  if (!tel) {
    s.addWidget(CardService.newTextParagraph().setText('Per dare una licenza apri la richiesta che contiene il codice del telefono (XXXX-XXXX-XXXX).'));
    return card.addSection(s).build();
  }
  if (etichette.includes('Gestite')) s.addWidget(CardService.newTextParagraph().setText('<b>Licenza già mandata</b> (etichetta «Gestite»). Una nuova licenza per lo stesso telefono si dà solo se serve davvero.'));
  const gia = ['M', 'A', 'P'].find(k => etichette.includes(k));
  if (gia) s.addWidget(CardService.newTextParagraph().setText('In lavorazione: <b>' + TIPI[gia][0] + '</b>. Il codice parte entro pochi minuti.'));
  s.addWidget(CardService.newTextParagraph().setText('Controlla su PayPal il pagamento con questo codice nella nota, poi scegli:'));
  Object.keys(TIPI).forEach(k => s.addWidget(CardService.newTextButton().setText(TIPI[k][0] + ' · ' + TIPI[k][1])
    .setTextButtonStyle(k === 'P' ? CardService.TextButtonStyle.FILLED : CardService.TextButtonStyle.OUTLINED)
    .setOnClickAction(CardService.newAction().setFunctionName('dai').setParameters({ tipo: k, id: e.gmail.messageId }))));
  return card.addSection(s).build();
}

function dai(e) {
  GmailApp.setCurrentMessageAccessToken(e.gmail.accessToken);
  const tipo = e.parameters.tipo, t = GmailApp.getMessageById(e.parameters.id).getThread();
  ['M', 'A', 'P'].forEach(k => { const l = GmailApp.getUserLabelByName(k); if (l && k !== tipo) t.removeLabel(l); });
  t.addLabel(GmailApp.getUserLabelByName(tipo) || GmailApp.createLabel(tipo));
  const err = avviaGiro_(false);
  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText(err ? 'Etichetta ' + tipo + ' messa, ma ' + err + ': parte al prossimo giro.'
      : 'Licenza ' + TIPI[tipo][0].toLowerCase() + ': il codice parte entro 1-2 minuti.'))
    .build();
}

function riepilogoOra() {
  const err = avviaGiro_(true);
  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText(err || 'Riepilogo in arrivo entro 1-2 minuti, in «Archivio generale licenze».'))
    .build();
}
