// HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
// HorizonAdmin: la GUIDA DELL'AUTORE (come funziona tutto il sistema e le logiche decise) e le NOTE (appunti per
// migliorare HorizonAdmin, HORIZON e HORIZON 2). Le note restano solo su questo telefono finché non le condividi.
'use strict';
(function(){
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[<&>"']/g,c=>({'<':'&lt;','&':'&amp;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// ───────────── GUIDA: ogni argomento ha un titolo, parole per la ricerca e il testo ─────────────
const GUIDA=[
['Il sistema in una pagina','pezzi insieme panoramica', `
<p>Sono sei pezzi che lavorano insieme. Nessuno usa l'intelligenza artificiale e nessuno manda dati d'uso dei piloti.</p>
<ul>
<li><b>HORIZON</b> (telefono, Google Play e APK): lo strumento di volo dei piloti.</li>
<li><b>HORIZON 2</b> (APK a parte): come HORIZON, più il collegamento all'orologio Garmin con l'app «HORIZON Link».</li>
<li><b>Versione web</b>: la stessa app nel browser, per iPhone e computer.</li>
<li><b>Casella HORIZON</b> (Gmail horizonlicenses): arrivano lì le richieste di licenza e le segnalazioni dei piloti.</li>
<li><b>Script di Gmail</b>: ogni minuto guarda la casella e, se c'è lavoro, sveglia GitHub. Risponde anche a questa console.</li>
<li><b>Lavori su GitHub</b>: compilano le app, lavorano la posta (licenze e segnalazioni), preparano i prati.</li>
</ul>
<p><b>HorizonAdmin</b> è il pannello sopra tutto questo: legge lo stato e preme i «tasti». Non ha logica sua: mette le stesse etichette che metteresti in Gmail, e il lavoro lo fa sempre il giro su GitHub.</p>`],

['HorizonAdmin · scheda Stato','da fare code riquadri salute versioni', `
<p><b>Da fare</b>: le code della casella. In rosso o giallo quello che aspetta te.</p>
<ul>
<li><b>Licenze: il pilota ha scritto</b>: una richiesta di licenza a cui il pilota ha risposto (di solito «ho pagato»).</li>
<li><b>Licenze da vedere</b>: richieste che il giro non ha saputo trattare (manca il codice del telefono, due etichette insieme…).</li>
<li><b>Segnalazioni da vedere</b>: segnalazioni a cui l'agente non ha risposto da solo.</li>
<li><b>Licenze in attesa di pagamento</b>: i prezzi sono partiti, il pilota non ha ancora pagato. Escono dall'elenco dopo 30 giorni.</li>
<li><b>Risposte automatiche</b> e <b>Segnalazioni chiuse da te</b>: solo conteggi degli ultimi 7 giorni.</li>
</ul>
<p>Toccando una voce si apre la conversazione in Gmail.</p>
<p><b>Salute del sistema</b>: l'ultima corsa di ogni lavoro su GitHub. Verde riuscito, rosso fallito, giallo in corso o fermo da troppo. La posta di solito gira ogni 1–3 ore e subito quando arriva una mail; l'avviso scatta dopo 5 ore.</p>
<p><b>Cosa ha fatto l'agente</b>: le segnalazioni degli ultimi 14 giorni, divise tra risposte automatiche e rimaste a te, con la regola scattata.</p>
<p><b>Versioni pubblicate</b>: l'ultima di HORIZON, HORIZON 2 e HorizonAdmin. Quando esce una HorizonAdmin più nuova compare un avviso in alto con il collegamento.</p>
<p><b>Se un servizio non risponde</b> restano a schermo gli ultimi dati buoni, con l'ora. GitHub senza token concede 60 domande l'ora: con un token (anche senza permessi) in ⚙ diventano 5000.</p>`],

['HorizonAdmin · i tasti','mensile annuale perenne chiusa risposta sbagliata giro riepilogo pin', `
<p>I tasti mettono un'etichetta in Gmail; entro 1–2 minuti il giro su GitHub fa il resto.</p>
<ul>
<li><b>Mensile / Annuale / Perenne</b> (5 €, 30 €, 150 €): crea il codice di licenza per il telefono di quella richiesta e lo spedisce al pilota. <b>Solo dopo aver visto il pagamento su PayPal.</b> Vale solo sulle richieste in «Da gestire», e mai due volte sulla stessa.</li>
<li><b>Chiusa</b> (segnalazioni da vedere): archivia senza rispondere, quando non serve risposta.</li>
<li><b>Risposta sbagliata</b> (risposte automatiche): la risposta dell'agente non c'entrava. La mail torna tra quelle da vedere e nel registro resta scritto quale regola ha sbagliato.</li>
<li><b>Avvia il giro della posta</b>: lo fa partire subito, senza aspettare.</li>
<li><b>Riepilogo subito</b>: manda adesso la mail con la tabella di tutte le licenze.</li>
</ul>
<p><b>PIN</b>: nello script di Gmail la proprietà CONSOLE_PIN decide. Un numero di almeno 6 cifre: l'app lo chiede e lo dimentica dopo 10 minuti; dopo 5 errori i tasti si bloccano (funzione «consoleSblocca»). La parola <b>no</b>: tasti con la sola chiave. Senza la proprietà: sola lettura.</p>
<p>Se la rete cade mentre premi un tasto, aggiorna l'elenco prima di riprovare: l'app non ripete mai un tasto da sola, per non emettere due licenze.</p>`],

['HorizonAdmin · scheda Analisi','grafici scarichi licenze dispositivi dove', `
<ul>
<li><b>Scarichi dell'APK da GitHub</b>: quante volte è stato scaricato ogni file. Non conta chi installa da Google Play né la versione web.</li>
<li><b>Licenze</b>: i numeri dell'ultimo riepilogo del mattino.</li>
<li><b>Chi ha mandato segnalazioni</b>: per settimana, canale (Google Play, APK, web), versione, modello di telefono, tipo.</li>
</ul>
<p><b>Cosa non si può sapere</b>: quanti telefoni usano HORIZON e dove. Per scelta l'app non manda dati d'uso. I telefoni attivi e i paesi li conta solo Google, per chi installa dal Play Store, e i suoi rapporti mensili compaiono quando l'app è in Produzione.</p>`],

['HorizonAdmin · collegamento alla console','indirizzo chiave collega url', `
<p>L'app parla con lo script di Gmail tramite un indirizzo segreto (URL dell'applicazione web + chiave). Non è nel codice perché il progetto è pubblico: resta solo su questo telefono.</p>
<ul>
<li><b>Per collegare</b>: nel riquadro di «Da fare» incolli l'indirizzo e tocchi «Collega». Se incolli più righe le prova tutte. Se l'indirizzo è giusto ma la chiave è vecchia, lo ricorda e chiede solo la chiave.</li>
<li><b>Dal computer</b>: nello script la funzione «consoleCollega» manda l'indirizzo completo alla casella HORIZON; «consoleChiave» scrive la chiave nel registro.</li>
<li><b>Se cambi telefono o lo perdi</b>: nello script cancella la proprietà CONSOLE_KEY e rilancia «consoleChiave». L'indirizzo vecchio smette di valere.</li>
<li><b>Dopo aver cambiato lo script</b> in una parte che riguarda la console: Gestisci deployment › matita › Versione «Nuova versione». L'indirizzo resta lo stesso.</li>
</ul>`],

['Licenze · come funziona il giro','prezzi paypal codice telefono gestite revoca', `
<ol>
<li>Il pilota chiede la licenza dall'app: arriva una mail con il <b>codice del telefono</b> (tre gruppi di quattro lettere).</li>
<li>Il giro risponde da solo con i prezzi e i collegamenti PayPal, chiedendo di scrivere il codice del telefono nella nota del pagamento. La mail passa in «Da gestire».</li>
<li>Tu vedi il pagamento su PayPal e premi Mensile, Annuale o Perenne (qui, o con le etichette M, A, P in Gmail).</li>
<li>Il giro crea il codice di licenza, lo spedisce, lo annota nel registro e sposta la mail in «Gestite».</li>
</ol>
<ul>
<li><b>Il codice vale solo su quel telefono.</b> Se il pilota cambia telefono serve un codice nuovo.</li>
<li><b>Limiti contro gli abusi</b>: una mail dei prezzi per telefono ogni 7 giorni, una per indirizzo al giorno, 30 al giorno in tutto.</li>
<li><b>Mai due codici per la stessa richiesta</b>: il registro ricorda a quale mail ha già risposto.</li>
<li><b>Riepilogo</b>: ogni mattina dalle 7 una mail con la tabella di tutte le licenze, in «Archivio generale licenze».</li>
<li><b>Revoca</b>: su GitHub › Actions › Licenze › Run workflow › revoca, con il numero della licenza.</li>
<li>La chiave che firma le licenze e il registro stanno cifrati su GitHub. Né l'app dei piloti né questa console le hanno.</li>
</ul>`],

['Segnalazioni · l\'agente che risponde da solo','problema registrazione sensori regole team', `
<p>Il pilota manda una segnalazione dall'app (Problema, Suggerimento, Dato sbagliato, Registrazione sensori). L'agente legge i <b>dati tecnici</b> allegati e decide.</p>
<p><b>Regola di fondo</b>: risponde da solo soltanto se i dati spiegano il problema. Le parole del pilota da sole non bastano mai.</p>
<p><b>Casi che riconosce</b></p>
<ul>
<li><b>Versione vecchia</b>: 30 o più versioni indietro. Istruzioni per aggiornare.</li>
<li><b>Livella</b>: telefono mai livellato e il pilota parla dell'orizzonte; oppure registrazione da fermo con l'orizzonte non a zero. Dopo una livella a terra di N gradi, N gradi da fermo sono giusti.</li>
<li><b>Sensori assenti o lenti</b>, telefono senza giroscopio: solo se il pilota parla di orizzonte o sensori (sul computer mancano sempre).</li>
<li><b>Bussola da calibrare</b>, <b>GPS debole</b>, <b>quota non tarata o telefono senza barometro</b>, <b>terreno non scaricato</b>: se il pilota ne parla e i dati lo confermano.</li>
<li><b>Registrazione dei sensori regolare</b>: conferma che i sensori vanno.</li>
</ul>
<p><b>Sempre a te, mai risposta automatica</b>: errori di disegno, blocchi, errori del giorno nel registro dell'app, parole come «si chiude» o «si blocca», licenze e pagamenti, suggerimenti, dati sbagliati, risposte dei piloti, segnalazioni senza dati tecnici.</p>
<p><b>Cosa riceve il pilota</b>: caso riconosciuto → la risposta con le istruzioni; altrimenti → solo la ricevuta («il nostro team è al lavoro»). La soluzione, in quel caso, la scrivi tu.</p>
<p><b>Freni</b>: solo segnalazioni degli ultimi 3 giorni; al massimo 5 risposte al giorno per indirizzo e 40 in tutto.</p>`],

['Segnalazioni · dove finiscono e come le chiudi','etichette analizzate da vedere gestite scheda registro', `
<ul>
<li><b>Segnalazioni analizzate</b>: risposta automatica partita. Con «Senza indirizzo» se il pilota non ha lasciato l'email: l'analisi resta scritta nella conversazione.</li>
<li><b>Segnalazioni da vedere</b>: in Posta in arrivo, aspettano te. Dentro c'è la <b>scheda dell'agente</b>: perché non ha risposto, cosa c'è di anomalo nei dati, gli ultimi errori.</li>
<li><b>Segnalazioni gestite</b>: quelle che hai chiuso.</li>
</ul>
<p><b>Per chiudere</b>: rispondi al pilota dalla casella HORIZON (controlla che il destinatario sia il suo indirizzo), oppure tasto «Chiusa». Al giro dopo passa in «gestite». La ricevuta automatica non conta come risposta. Se il pilota riscrive, torna da vedere.</p>
<p><b>Registro anonimo</b>: ogni caso lascia una riga su GitHub (data, tipo, versione, canale, modello, esito, regola). Niente nomi, indirizzi, marche o testo. È quello che vede Claude per capire quali regole lavorano.</p>
<p><b>Per insegnare un caso nuovo</b>: incolla a Claude la mail o la scheda. Aggiunge la regola e la sua prova; dalla volta dopo parte la risposta.</p>
<p>Nell'app dei piloti l'email per la risposta viene ricordata e vale anche per le registrazioni dei sensori. Tutte le mail hanno il logo in testa.</p>`],

['Script di Gmail · funzioni e proprietà','installa stato sveglia token console', `
<p>Un solo file, incollato in script.google.com con l'account HORIZON. Si aggiorna copiandolo da GitHub (tools/gmail-licenze).</p>
<ul>
<li><b>sveglia</b>: gira da sola ogni minuto. Se c'è posta da lavorare avvia il giro su GitHub, non più di una volta ogni 4 minuti. Una volta al giorno, dalle 7, lo avvia comunque per il riepilogo.</li>
<li><b>installa</b>: crea etichette e sveglia. Si lancia la prima volta e quando cambi il token.</li>
<li><b>stato</b>: scrive quante mail sono da lavorare, l'ultimo avvio, se il token c'è.</li>
<li><b>riepilogoOra</b>: riepilogo delle licenze subito.</li>
<li><b>consoleChiave</b>, <b>consoleCollega</b>, <b>consoleSblocca</b>: per questa console.</li>
</ul>
<p><b>Proprietà</b> (Impostazioni progetto): GITHUB_TOKEN (può solo avviare i lavori del progetto; scade ogni anno, il Calendar di HORIZON te lo ricorda 14 giorni prima), CONSOLE_KEY, CONSOLE_PIN.</p>`],

['Lavori su GitHub','compila release build versioni numeri', `
<ul>
<li><b>App HORIZON</b>: a ogni modifica dell'app compila APK e pacchetto per il Play Store, lo carica nei Test interni e pubblica la Release «build-N». La versione è 1.0.N.</li>
<li><b>HORIZON 2 e orologio</b>: Release «horizon2-N» con l'APK e i file per il Garmin.</li>
<li><b>HorizonAdmin</b>: Release «admin-N».</li>
<li><b>Versione web</b>: pubblica il sito.</li>
<li><b>Posta</b>: licenze e segnalazioni. Parte dalla sveglia di Gmail e, di riserva, ogni ora (GitHub la fa partire anche con 2–3 ore di ritardo).</li>
<li><b>Prati</b>: prepara i riquadri per l'atterraggio fuori campo, ogni 6 ore.</li>
<li><b>Prove automatiche</b>: orizzonte, regole delle segnalazioni, console, prati. Più il collaudo su emulatore.</li>
</ul>
<p>Il numero di versione sale a ogni unione che tocca l'app: per questo tra una versione e l'altra a volte non cambia niente di visibile.</p>`],

['Prati per l\'atterraggio fuori campo','emergenza planata riquadri overpass segna prato', `
<p>In planata l'app propone i prati raggiungibili dentro la zona di planata.</p>
<ul>
<li><b>Da dove vengono</b>: OpenStreetMap, a riquadri di 0,1°. Alla rete va solo il riquadro, mai la posizione.</li>
<li><b>Riquadri già pronti</b>: per il Nord-Ovest (780 riquadri) li prepara GitHub, partendo dal centro della zona, e l'app li scarica subito. Ogni riquadro si rifà dopo 25 giorni. Altrove, o se GitHub non risponde, l'app usa i servizi pubblici, lenti.</li>
<li><b>Quando scarica</b>: da sola solo a terra; in volo solo se manca il riquadro sotto l'aereo, al massimo uno al minuto.</li>
<li><b>Come sceglie</b>: la striscia dritta più lunga, meglio controvento; scarta se è corta, in pendenza, dentro o vicino a un paese, attraversata da una linea elettrica, o non raggiungibile.</li>
</ul>
<p><b>SEGNA PRATO QUI</b> (menu ALTRO): un tocco in volo, senza domande, con ANNULLA per 8 secondi. Segna posizione e direzione di volo. Elenco in Impostazioni › Volare senza internet.</p>
<p><b>Scelta di sicurezza</b>: un prato segnato salta solo il requisito «sulla mappa c'è un'area adatta». Tutti gli altri controlli restano. Va segnato in volo (da fermo non ha direzione) e non viene proposto se di quella zona non ci sono i dati.</p>
<p>È un'indicazione dalle mappe, non una pista: coltura, fossi, fili non segnati si vedono solo dall'alto.</p>`],

['HORIZON · le logiche decise insieme','livella domande scarichi barrette precarico traffico ogn', `
<ul>
<li><b>Livella</b>: a terra con l'assetto dell'aereo fermo (11° di serie, per i bicicli), o in volo livellato. Dopo la livella a terra l'orizzonte da fermo segna quell'assetto, e zero in volo: è giusto così.</li>
<li><b>Domande a schermo</b>: hanno due tasti, SÌ e NO, oltre al tasto OK. Prima toccare la domanda non faceva niente.</li>
<li><b>Mai domande al pilota in volo</b>, e nessuna soglia di sicurezza cambia senza dirtelo.</li>
<li><b>Scarichi</b>: tutti con barretta di avanzamento e MB. La zona davanti all'aereo si precarica prima di arrivarci; lo scarico automatico avviene solo a terra.</li>
<li><b>Terreno</b>: in montagna la carta resta sopra ai colori di pericolo, che compaiono solo in volo.</li>
<li><b>Traffico</b>: trasmissione su OGN solo se accesa dal pilota (spenta di serie): è l'unico caso in cui esce la posizione, con consenso. La mail a OGN è ancora da mandare.</li>
<li><b>Privacy</b>: nessun dato d'uso. Le segnalazioni partono solo se il pilota le invia.</li>
</ul>`],

['HORIZON 2 e orologio Garmin','fenix link pagine swipe tasti', `
<ul>
<li>HORIZON 2 si installa accanto a HORIZON e parla con l'app «HORIZON Link» sull'orologio (fenix 7).</li>
<li><b>Tre pagine</b> sull'orologio; quella mostrata segue la fase del volo. Scorrendo il dito si cambia pagina per 20 secondi, poi torna da sola.</li>
<li><b>Tocco</b>: toglie l'avviso. I tasti dell'orologio comandano lo strumento.</li>
<li>Il telefono manda un messaggio corto ogni 2 secondi e uno completo ogni 10.</li>
<li>Il file per l'orologio (.prg) sta nella Release «horizon2-N»: si copia in GARMIN/APPS con il cavo.</li>
</ul>`],

['Sicurezza · le regole fisse','chiavi privacy telefono perso', `
<ul>
<li><b>Il progetto è pubblico</b>: nel codice non c'è mai una chiave, un indirizzo o un dato di un pilota.</li>
<li><b>Dove stanno le chiavi</b>: firma delle licenze e registro, cifrati su GitHub; token GitHub e chiave della console, nello script di Gmail; indirizzo della console, solo su questo telefono.</li>
<li><b>Tutto dipende dall'account Google di HORIZON</b>: tienilo con la verifica in due passaggi.</li>
<li><b>Telefono perso</b>: rifai la chiave della console (CONSOLE_KEY). Senza PIN, con quell'indirizzo si possono emettere licenze.</li>
<li><b>Niente intelligenza artificiale</b> nella posta: solo regole fisse.</li>
</ul>`],

['Cose rimaste in sospeso','da fare futuro', `
<ul>
<li>Mail a OGN per la trasmissione del traffico.</li>
<li>Incrocio dei prati con le foto satellitari (ESA WorldCover).</li>
<li>Statistiche di Google Play, quando l'app sarà in Produzione.</li>
<li>Tasto «Togli dalla coda» per le richieste di licenza di prova.</li>
<li>Punti del controllo generale ancora da decidere (origine fissa del piano, alcune scelte di sicurezza).</li>
</ul>
<p>Le idee nuove scrivile nella scheda <b>Note</b>.</p>`],
];

function disegnaGuida(){
  const el=$('pGuida'); if(!el||el.dataset.fatto) return; el.dataset.fatto='1';
  el.innerHTML='<section class="card"><h2>Guida dell\'autore</h2><input id="gCerca" type="search" placeholder="Cerca: licenza, livella, prati, chiave…" autocomplete="off">'
    +'<p class="sub" id="gVuoto" hidden>Niente con queste parole.</p></section>'
    +GUIDA.map(([t,k,h],i)=>`<details class="card g" data-k="${esc((t+' '+k).toLowerCase())}"><summary>${esc(t)}</summary><div class="gt">${h}</div></details>`).join('');
  $('gCerca').oninput=()=>{ const q=$('gCerca').value.trim().toLowerCase(); let n=0;
    el.querySelectorAll('details.g').forEach(d=>{ const si=!q||d.dataset.k.includes(q)||d.textContent.toLowerCase().includes(q); d.hidden=!si; d.open=!!q&&si; if(si) n++; });
    $('gVuoto').hidden=n>0; };
}

// ───────────── NOTE: appunti per migliorare le tre app; restano sul telefono ─────────────
const APP=['HorizonAdmin','HORIZON','HORIZON 2','Altro'];
const leggi=()=>{ try{ const a=JSON.parse(localStorage.getItem('adm_note')||'[]'); return Array.isArray(a)?a:[]; }catch(e){ return []; } };
const scrivi=a=>{ try{ localStorage.setItem('adm_note',JSON.stringify(a)); return true; }catch(e){ return false; } };
const quando=t=>new Date(t).toLocaleString('it-IT',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
function testoNote(solo){ const n=leggi().filter(x=>!x.fatta&&(!solo||x.app===solo)); if(!n.length) return '';
  return 'NOTE PER CLAUDE · '+new Date().toLocaleDateString('it-IT')+'\n'+APP.map(a=>{ const r=n.filter(x=>x.app===a); return r.length?'\n'+a.toUpperCase()+'\n'+r.map(x=>'- ('+quando(x.t)+') '+x.testo).join('\n'):''; }).join('')+'\n'; }
function disegnaNote(){
  const el=$('pNote'); if(!el) return;
  if(!el.dataset.fatto){ el.dataset.fatto='1';
    el.innerHTML=`<section class="card"><h2>Nota nuova</h2>
      <div class="seg" id="nApp">${APP.map((a,i)=>`<button data-a="${esc(a)}" aria-pressed="${i===1}">${esc(a)}</button>`).join('')}</div>
      <textarea id="nTesto" rows="4" placeholder="Scrivi qui, oppure tocca il microfono della tastiera per dettare"></textarea>
      <p style="margin:8px 0 0"><button class="pri" id="nSalva">Salva la nota</button> <button id="nDetta" hidden>Detta</button></p>
      <p class="sub" id="nMsg"></p></section>
      <section class="card"><h2>Le tue note</h2><div id="nElenco"></div>
      <p style="margin:12px 0 0"><button id="nCondividi">Condividi con Claude</button> <button id="nCopia">Copia tutte</button></p>
      <p class="sub">Le note restano solo su questo telefono. «Condividi» apre il menu del telefono: scegli l'app di Claude, o copia e incolla nella conversazione. Le note segnate come fatte non vengono inviate.</p>
      <textarea id="nUscita" rows="6" readonly hidden></textarea></section>`;
    let app='HORIZON';
    $('nApp').onclick=e=>{ const b=e.target.closest('button[data-a]'); if(!b) return; app=b.dataset.a; $('nApp').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b))); };
    $('nSalva').onclick=()=>{ const t=$('nTesto').value.trim(), m=$('nMsg'); if(t.length<3){ m.textContent='Scrivi almeno due parole.'; return; }
      const a=leggi(); a.unshift({t:Date.now(),app,testo:t.slice(0,2000),fatta:false});
      if(!scrivi(a.slice(0,300))){ m.textContent='Non riesco a salvare: la memoria del telefono è piena?'; return; }
      $('nTesto').value=''; m.textContent='Salvata in '+app+'.'; elenco(); };
    // dettatura dentro l'app, dove il telefono la offre; altrimenti c'è il microfono della tastiera
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(SR){ const b=$('nDetta'); b.hidden=false; let r=null;
      b.onclick=()=>{ if(r){ r.stop(); return; } try{ r=new SR(); r.lang='it-IT'; r.interimResults=false; r.continuous=true;
          r.onresult=e=>{ for(let i=e.resultIndex;i<e.results.length;i++) if(e.results[i].isFinal) $('nTesto').value=($('nTesto').value+' '+e.results[i][0].transcript).trim(); };
          r.onend=()=>{ r=null; b.textContent='Detta'; }; r.onerror=()=>{ $('nMsg').textContent='La dettatura dell\'app non parte: usa il microfono della tastiera.'; };
          r.start(); b.textContent='Ferma'; }catch(e){ r=null; $('nMsg').textContent='La dettatura dell\'app non parte: usa il microfono della tastiera.'; } }; }
    $('nElenco').onclick=e=>{ const b=e.target.closest('button[data-n]'); if(!b) return; const a=leggi(), i=a.findIndex(x=>String(x.t)===b.dataset.n); if(i<0) return;
      if(b.dataset.c==='fatta') a[i].fatta=!a[i].fatta; else if(b.dataset.c==='via'){ if(b.dataset.sicuro!=='1'){ b.dataset.sicuro='1'; b.textContent='Sicuro?'; return; } a.splice(i,1); }
      scrivi(a); elenco(); };
    const mostra=t=>{ const u=$('nUscita'); u.hidden=false; u.value=t; u.focus(); u.select(); };
    $('nCopia').onclick=async()=>{ const t=testoNote(); if(!t){ $('nMsg').textContent='Non ci sono note da inviare.'; return; }
      try{ await navigator.clipboard.writeText(t); $('nMsg').textContent='Copiate: incollale nella conversazione con Claude.'; }catch(e){ mostra(t); $('nMsg').textContent='Tieni premuto sul testo qui sotto e scegli «Copia».'; } };
    $('nCondividi').onclick=async()=>{ const t=testoNote(); if(!t){ $('nMsg').textContent='Non ci sono note da inviare.'; return; }
      try{ const C=window.Capacitor, S=C&&C.isNativePlatform&&C.isNativePlatform()?((C.Plugins&&C.Plugins.Share)||C.registerPlugin('Share')):null;
        if(S){ await S.share({title:'Note HORIZON',text:t,dialogTitle:'Manda le note con…'}); return; }
        if(navigator.share){ await navigator.share({title:'Note HORIZON',text:t}); return; } throw new Error('x'); }
      catch(e){ if(e&&/cancel/i.test(String(e.message||e))) return; mostra(t); $('nMsg').textContent='Tieni premuto sul testo qui sotto e scegli «Copia».'; } };
  }
  elenco();
}
function elenco(){ const a=leggi(), el=$('nElenco'); if(!el) return;
  el.innerHTML=a.length?APP.map(p=>{ const r=a.filter(x=>x.app===p); return r.length?`<p class="gr">${esc(p)} <span class="sub">· ${r.filter(x=>!x.fatta).length} aperte</span></p>`+r.map(x=>
    `<div class="row"><div class="t" style="${x.fatta?'opacity:.5;text-decoration:line-through':''}">${esc(x.testo)}<div class="az"><button data-n="${x.t}" data-c="fatta">${x.fatta?'Riapri':'Fatta'}</button><button data-n="${x.t}" data-c="via">Cancella</button></div></div><small>${esc(quando(x.t))}</small></div>`).join(''):''; }).join('')
    :'<p class="sub">Ancora nessuna nota. Scrivi quello che noti usando le app: un difetto, un\'idea, una cosa scomoda.</p>';
}
window.HZ_GUIDA={disegnaGuida,disegnaNote,testoNote};
})();
