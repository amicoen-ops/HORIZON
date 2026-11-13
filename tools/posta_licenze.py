#!/usr/bin/env python3
# HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
# Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
"""
Posta delle licenze, sulla casella horizonlicenses (IMAP e SMTP di Gmail con la password per le app).
Lo lancia il workflow «Licenze per posta» ogni 10 minuti.

1. Richieste nuove (oggetto con «HORIZON» e «licenza» e il codice del telefono, arrivate dall'app o scritte a mano):
   risponde con i prezzi e il link PayPal, mette l'etichetta «Da gestire» e la toglie dalla Posta in arrivo.
   Le risposte dei piloti («ho pagato…») restano in arrivo, con «Da gestire».
2. Pagate: l'autore, visto il pagamento su PayPal, mette alla mail l'etichetta M, A o P. Qui si crea il codice di
   quel tipo per quel telefono, si risponde al pilota, si annota nel registro (cifrato; tiene anche nome e mail del
   pilota, per il riepilogo) e la mail passa a «Gestite», fuori dalla Posta in arrivo. Se nella mail non c'è un codice
   del telefono valido, o se ha più di una etichetta tra M, A e P, resta in arrivo con «Da vedere» e non parte niente.

Il progetto è pubblico: nei log solo numeri, mai indirizzi o codici del telefono.
Ambiente: GMAIL_UTENTE, GMAIL_LICENZE (password per le app), PRIVATA (pem), PUBBLICA (txt), REGISTRO (json),
PAYPAL, RIEPILOGO (file del riepilogo della corsa, facoltativo).
"""
import email, email.utils, imaplib, json, os, re, smtplib, sys
from email.header import decode_header, make_header
from email.message import EmailMessage

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import licenze, segnalazioni

TIPI = {'M': 'mensile', 'A': 'annuale', 'P': 'perenne'}
DA_GESTIRE, GESTITE, DA_VEDERE, INBOX = 'Da gestire', 'Gestite', 'Da vedere', '\\Inbox'
ARCHIVIO = 'Archivio generale licenze'
SEG_OK, SEG_VEDERE, SEG_SENZA = 'Segnalazioni analizzate', 'Segnalazioni da vedere', 'Senza indirizzo'
SEG_GESTITE, CHIUSA = 'Segnalazioni gestite', 'Chiusa'      # «Chiusa» è un tasto: la mette l'autore quando non serve risposta
AUTO = 'X-HORIZON-Auto'                  # intestazione delle mail mandate da questo programma (non dall'autore a mano)
SEG_GIORNO_IND, SEG_GIORNO = 5, 40      # risposte automatiche alle segnalazioni: per indirizzo e in tutto, al giorno
PASSI_PAYPAL = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'docs', 'licenze', 'paypal-passi.png')
PREZZI = {'M': 5, 'A': 30, 'P': 150}
MAX_RIGHE_PISTE = 20          # righe HORIZON-PISTA/CAMPI tenute per ogni mail (l'app ne manda una): vanno su un ramo pubblico
TEL = re.compile(r'(?<![A-Z0-9])([A-Z2-9]{4})-([A-Z2-9]{4})-([A-Z2-9]{4})(?![A-Z0-9])')


def tel_da(testo):
    for m in TEL.finditer((testo or '').upper()):
        t = ''.join(m.groups())
        if all(ch in licenze.TEL_ALFA for ch in t): return t
    return None


def dec(h):
    try: return str(make_header(decode_header(h or '')))
    except Exception: return h or ''


def testo_di(msg):
    parti = []
    for p in (msg.walk() if msg.is_multipart() else [msg]):
        if p.get_content_type() == 'text/plain':
            try: parti.append(p.get_payload(decode=True).decode(p.get_content_charset() or 'utf-8', 'replace'))
            except Exception: pass
    return '\n'.join(parti)


def con_trattini(t): return t[:4] + '-' + t[4:8] + '-' + t[8:]


class Posta:
    def __init__(self, utente, password):
        self.utente, self.password = utente, password
        self.imap = imaplib.IMAP4_SSL('imap.gmail.com', timeout=60)
        self.imap.login(utente, password)
        tutti = None
        for riga in self.imap.list()[1]:
            r = riga.decode('utf-8', 'replace')
            if '\\All' in r: tutti = r.rsplit(' "/" ', 1)[-1]
        if not tutti: raise SystemExit('cartella «Tutti i messaggi» non trovata (IMAP di Gmail)')
        self.imap.select(tutti)

    def cerca(self, raw):
        typ, d = self.imap.uid('SEARCH', 'X-GM-RAW', '"' + raw + '"')
        return d[0].split() if typ == 'OK' and d and d[0] else []

    def leggi(self, uid):
        typ, d = self.imap.uid('FETCH', uid, '(BODY.PEEK[])')
        for x in d:
            if isinstance(x, tuple): return email.message_from_bytes(x[1])
        return None

    def conversazione(self, uid):
        """Tutte le mail della stessa conversazione di Gmail."""
        typ, d = self.imap.uid('FETCH', uid, '(X-GM-THRID)')
        m = re.search(rb'X-GM-THRID (\d+)', b' '.join(x if isinstance(x, bytes) else x[0] for x in d if x)) if typ == 'OK' else None
        if not m: return []
        typ, d = self.imap.uid('SEARCH', 'X-GM-THRID', m.group(1).decode())
        return d[0].split() if typ == 'OK' and d and d[0] else []

    def crea(self, nome):
        try: self.imap.create('"' + nome + '"')
        except Exception: pass

    def etichetta(self, uid, aggiungi=(), togli=()):
        q = lambda e: e if e.startswith('\\') or ' ' not in e else '"' + e + '"'
        if aggiungi: self.imap.uid('STORE', uid, '+X-GM-LABELS', '(' + ' '.join(q(e) for e in aggiungi) + ')')
        if togli: self.imap.uid('STORE', uid, '-X-GM-LABELS', '(' + ' '.join(q(e) for e in togli) + ')')

    def rispondi(self, msg, testo, html=None, immagini=None):
        a = msg.get('Reply-To') or msg.get('From')
        nome, indirizzo = email.utils.parseaddr(a)
        self.ultimo = (dec(nome), indirizzo)
        if not indirizzo or indirizzo.lower() == self.utente.lower() or 'web3forms' in indirizzo.lower() or 'noreply' in indirizzo.lower():
            return False
        r = EmailMessage()
        r['From'] = email.utils.formataddr(('HORIZON', self.utente))
        r['To'] = email.utils.formataddr((re.sub(r'[\r\n\t]+', ' ', dec(nome))[:80], indirizzo))
        ogg = re.sub(r'[\r\n\t]+', ' ', dec(msg.get('Subject')))[:200]      # mai a capo nell'intestazione
        r['Subject'] = ogg if ogg.lower().startswith('re:') else 'Re: ' + ogg
        r['Auto-Submitted'] = 'auto-replied'; r[AUTO] = '1'      # risposta automatica: si distingue da quelle scritte a mano
        if msg.get('Message-ID'):
            # su una riga sola: un'intestazione arrivata su più righe (References lungo, tipico delle risposte) tiene
            # gli a capo, e EmailMessage li rifiuta: il codice non partiva e la mail finiva in «Da vedere»
            una_riga = lambda h: ' '.join((h or '').split())
            r['In-Reply-To'] = una_riga(msg['Message-ID'])
            r['References'] = una_riga((msg.get('References') or '') + ' ' + msg['Message-ID'])
        r.set_content(testo)
        if html:
            r.add_alternative(html, subtype='html')
            parte = r.get_payload()[-1]
            for cid, percorso in (immagini or {}).items():      # immagini dentro la mail (cid:…): si vedono anche senza scaricare
                parte.add_related(open(percorso, 'rb').read(), 'image', 'png', cid='<' + cid + '>', filename=os.path.basename(percorso))
        self.manda(r)
        return True

    def manda(self, r):
        with smtplib.SMTP_SSL('smtp.gmail.com', 465, timeout=60) as s:
            s.login(self.utente, self.password)
            s.send_message(r)


BOX = ('<div style="font:700 22px ui-monospace,Menlo,Consolas,monospace;letter-spacing:.04em;background:#fff6d6;'
       'border:2px solid #e0a800;border-radius:10px;padding:14px;margin:10px 0;word-break:break-all;color:#111">{}</div>')
PASSO = ('<div style="background:#e8f4ff;border-left:5px solid #1a73e8;padding:10px 14px;margin:10px 0;font-size:16px">'
         '<b>{}</b></div>')


def html_di(corpo):
    return ('<div style="font:16px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#222;max-width:560px">'
            + corpo + '<p style="color:#666;font-size:13px;margin-top:24px">HORIZON · strumento di volo</p></div>')


def testo_prezzi(tel, paypal):
    p = paypal.rstrip('/'); t = con_trattini(tel)
    testo = f"""Ciao,
grazie per l'interesse per HORIZON. Abbiamo ricevuto la richiesta per il telefono {t}.

Le licenze:
  · mensile  5 €    {p}/5EUR
  · annuale  30 €   {p}/30EUR
  · perenne  150 €  {p}/150EUR

>>> IMPORTANTE: copia questo codice del telefono e incollalo nella nota del pagamento PayPal <<<

    {t}

Senza il codice nella nota non sappiamo per quale telefono fare la licenza.

Come pagare, passo per passo:
  1. tocca il link PayPal dell'importo che hai scelto;
  2. controlla l'importo, tocca «Avanti» ed entra con il tuo account PayPal;
  3. come tipo di pagamento scegli «Per amici e familiari» (invio di denaro tra privati),
     poi tocca «Aggiungi una nota» e incolla il codice del telefono;
  4. tocca «Invia pagamento ora».

Appena vediamo il pagamento ti mandiamo qui il codice di licenza, di solito in giornata.

Per qualsiasi domanda rispondi a questa mail.

HORIZON · strumento di volo
"""
    riga = lambda nome, euro: (f'<tr><td style="padding:6px 12px 6px 0">{nome}</td><td style="padding:6px 12px 6px 0"><b>{euro} €</b></td>'
                               f'<td><a href="{p}/{euro}EUR" style="background:#0070ba;color:#fff;padding:7px 14px;border-radius:18px;text-decoration:none">Paga con PayPal</a></td></tr>')
    html = html_di(f"""<p>Ciao,<br>grazie per l'interesse per HORIZON. Abbiamo ricevuto la richiesta per il telefono <b style="white-space:nowrap">{t}</b>.</p>
<table style="border-collapse:collapse;margin:8px 0">{riga('Mensile', 5)}{riga('Annuale', 30)}{riga('Perenne', 150)}</table>
{PASSO.format('IMPORTANTE: copia questo codice del telefono e incollalo nella nota del pagamento PayPal')}
{BOX.format(t)}
<p>Senza il codice nella nota non sappiamo per quale telefono fare la licenza.</p>
<p><b>Come pagare, passo per passo:</b></p>
<p style="background:#fff6d6;border:1px solid #e0a800;border-radius:8px;padding:8px 12px">Tipo di pagamento: scegli <b>«Per amici e familiari»</b> (invio di denaro tra privati).</p>
<img src="cid:passi-paypal" width="518" alt="1. tocca Paga con PayPal · 2. controlla l'importo e tocca Avanti · 3. scegli Per amici e familiari, Aggiungi una nota: incolla il codice del telefono · 4. Invia pagamento ora" style="max-width:100%;height:auto;border:1px solid #ddd;border-radius:8px">
<p>Appena vediamo il pagamento ti mandiamo qui il codice di licenza, di solito in giornata.</p>
<p>Per qualsiasi domanda rispondi a questa mail.</p>""")
    return testo, html


def testo_codice(tipo, codice, scade):
    sc = ("Vale fino al " + '/'.join(reversed(scade.split('-'))) + ".") if scade else "Non scade."
    testo = f"""Ciao,
grazie! Ecco il codice della tua licenza HORIZON ({TIPI[tipo]}). {sc}

>>> COPIA TUTTO IL CODICE QUI SOTTO (da HZ1 fino all'ultimo carattere) <<<

{codice}

Per attivarla:
  1. copia il codice qui sopra, tutto;
  2. in HORIZON apri Info e tocca 5 volte il logo in alto a sinistra;
  3. incolla il codice in «Codice di licenza» e premi «Attiva».

Il codice vale solo sul telefono per cui è stato fatto: se cambi telefono scrivici.

Buoni voli!
HORIZON · strumento di volo
"""
    html = html_di(f"""<p>Ciao,<br>grazie! Ecco il codice della tua licenza HORIZON (<b>{TIPI[tipo]}</b>). {sc}</p>
{PASSO.format("COPIA TUTTO IL CODICE QUI SOTTO, da HZ1 fino all'ultimo carattere")}
{BOX.format(codice)}
<p><b>Per attivarla:</b></p>
<ol style="font-size:16px"><li>copia il codice qui sopra, <b>tutto</b> (tienilo premuto e scegli «Copia»);</li>
<li>in HORIZON apri <b>Info</b> e tocca <b>5 volte il logo</b> in alto a sinistra;</li>
<li>incolla il codice in <b>«Codice di licenza»</b> e premi <b>«Attiva»</b>.</li></ol>
<p>Il codice vale solo sul telefono per cui è stato fatto: se cambi telefono scrivici.</p>
<p>Buoni voli!</p>""")
    return testo, html


def recupera_indirizzi(posta, registro, pub):
    """Licenze mandate prima che il registro tenesse nome e mail: si ritrovano dalle mail inviate (il codice dice il numero)."""
    manca = {r['numero'] for r in registro if r.get('origine') == 'posta' and not r.get('mail')}
    if not manca: return False
    cambiato = False
    for uid in posta.cerca('in:sent subject:(HORIZON licenza)'):
        msg = posta.leggi(uid)
        if msg is None: continue
        m = re.search(r'HZ1(?:-[0-9A-Z]{1,5})+', testo_di(msg))
        if not m: continue
        try: n = licenze.leggi(pub, m.group(0))['numero']
        except Exception: continue
        if n in manca:
            nome, ind = email.utils.parseaddr(msg.get('To'))
            for r in registro:
                if r['numero'] == n: r['nome'], r['mail'] = dec(nome), ind; cambiato = True
            manca.discard(n)
    return cambiato


def stato_di(r, revocate, oggi, quando=None):
    if r['numero'] in revocate:
        d = (quando or {}).get(str(r['numero']))
        return ('revocata il ' + '/'.join(reversed(d.split('-'))) if d else 'revocata'), '#c62828'
    if not r.get('scade'): return 'attiva, senza scadenza', '#2e7d32'
    import datetime
    g = (datetime.date.fromisoformat(r['scade']) - oggi).days
    if g < 0: return 'scaduta', '#9e9e9e'
    if g <= 15: return f'scade tra {g} giorni', '#ef6c00'
    return 'attiva', '#2e7d32'


def riepilogo(posta, registro, rev, seg_da_vedere=0):
    """Mail all'autore (alla casella di HORIZON) con la tabella di tutte le licenze."""
    import datetime, html as H
    oggi = datetime.date.today()
    it = lambda d: '/'.join(reversed(d.split('-'))) if d else '—'
    revocate = set(rev.get('revocate', [])); storico = rev.get('storico', [])
    quando = {str(e['numero']): e['data'] for e in storico if e.get('azione') == 'revoca'}
    righe, testo, conta = [], [], {}
    for r in sorted(registro, key=lambda r: -r['numero']):
        st, col = stato_di(r, revocate, oggi, quando)
        k = 'revocate' if st.startswith('revocata') else {'scaduta': 'scadute'}.get(st, 'in scadenza' if st.startswith('scade') else 'attive')
        conta[k] = conta.get(k, 0) + 1
        chi = (r.get('nome') or '') + (f" <{r['mail']}>" if r.get('mail') else '') or r.get('origine', '')
        tel = con_trattini(r['telefono'])
        righe.append(f'<tr><td><b>{r["numero"]}</b></td><td>{TIPI.get(r["tipo"], r["tipo"])}</td><td>{H.escape(chi)}</td>'
                     f'<td style="padding:6px 8px;border-bottom:1px solid #ddd;font-family:monospace;white-space:nowrap">{tel}</td><td>{it(r["emesso"])}</td><td>{it(r.get("scade"))}</td>'
                     f'<td style="padding:6px 8px;border-bottom:1px solid #ddd;color:{col};font-weight:700">{st}</td></tr>')
        testo.append(f"n. {r['numero']} · {TIPI.get(r['tipo'], r['tipo'])} · {chi} · {tel} · emessa {it(r['emesso'])} · scade {it(r.get('scade'))} · {st}")
    sintesi = ' · '.join(f'{v} {k}' for k, v in conta.items()) or 'nessuna licenza'
    td = 'style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:left"'
    avviso = (f'<p style="background:#fff6d6;border:1px solid #e0a800;border-radius:8px;padding:8px 12px"><b>{seg_da_vedere} segnalazioni dei piloti da vedere</b>: '
              'sono in Posta in arrivo con l\'etichetta «Segnalazioni da vedere». Le altre hanno già avuto risposta automatica («Segnalazioni analizzate»).</p>') if seg_da_vedere else ''
    corpo = (avviso + f'<p><b>{len(registro)} licenze</b> · {sintesi}</p>'
             f'<table style="border-collapse:collapse;font-size:14px"><tr style="background:#f0f3f7">'
             + ''.join(f'<th {td}>{h}</th>' for h in ('N.', 'Tipo', 'Pilota', 'Telefono', 'Emessa', 'Scade', 'Stato')) + '</tr>'
             + ''.join(righe).replace('<td>', f'<td {td}>') + '</table>'
             + (('<p style="margin-top:18px"><b>Revoche e ripristini</b></p><ul style="font-size:14px">'
                 + ''.join(f'<li>{it(e["data"])} · licenza n. {e["numero"]} · {"revocata" if e["azione"] == "revoca" else "ripristinata"}</li>'
                           for e in sorted(storico, key=lambda e: e['data'], reverse=True)) + '</ul>') if storico else '')
             + '<p style="color:#666;font-size:13px">Per revocare: GitHub › Actions › Licenze › Run workflow › revoca, con il numero.<br>'
             'Arriva una volta al giorno. Per averlo subito: GitHub › Actions › Licenze per posta › Run workflow › «riepilogo».</p>')
    r = EmailMessage()
    r['From'] = email.utils.formataddr(('HORIZON', posta.utente)); r['To'] = posta.utente
    r['Subject'] = f'HORIZON · Riepilogo licenze · {oggi.strftime("%d/%m/%Y")}'
    if storico: testo += ['', 'Revoche e ripristini:'] + [f"{it(e['data'])} · licenza n. {e['numero']} · {'revocata' if e['azione'] == 'revoca' else 'ripristinata'}" for e in sorted(storico, key=lambda e: e['data'], reverse=True)]
    r.set_content((f'{seg_da_vedere} segnalazioni dei piloti da vedere (etichetta «Segnalazioni da vedere»).\n\n' if seg_da_vedere else '') + f'{len(registro)} licenze · {sintesi}\n\n' + '\n'.join(testo) + '\n')
    r.add_alternative(html_di(corpo), subtype='html')
    posta.manda(r)


def main():
    env = os.environ
    posta = Posta(env['GMAIL_UTENTE'], env['GMAIL_LICENZE'])
    registro = json.load(open(env['REGISTRO']))
    priv = open(env['PRIVATA'], 'rb').read()
    pub = open(env['PUBBLICA']).read()
    conti = {'prezzi': 0, 'codici': 0, 'da vedere': 0, 'saltate': 0}

    # 0. etichette delle prime versioni: «Risposto» diventa «Da gestire», «Fatte» diventa «Gestite»
    for uid in posta.cerca('label:risposto'): posta.etichetta(uid, aggiungi=[DA_GESTIRE], togli=['Risposto', INBOX])
    for uid in posta.cerca('label:fatte'): posta.etichetta(uid, aggiungi=[GESTITE], togli=['Fatte', DA_GESTIRE, INBOX])

    # limiti alle mail dei prezzi (la casella non deve diventare un modo per mandare posta a chiunque):
    # una per telefono ogni 7 giorni, una per indirizzo al giorno, al massimo 30 al giorno. Stato cifrato come il registro.
    import datetime, hashlib
    oggi_d = datetime.date.today()
    lim = json.load(open(env['PREZZI'])) if env.get('PREZZI') and os.path.exists(env['PREZZI']) else {}
    lim = {k: {x: d for x, d in lim.get(k, {}).items() if (oggi_d - datetime.date.fromisoformat(d)).days < 30} for k in ('tel', 'mail', 'seg')}
    mandati_oggi = sum(1 for d in lim['mail'].values() if d == oggi_d.isoformat())
    def recente(k, x, giorni): d = lim[k].get(x); return bool(d) and (oggi_d - datetime.date.fromisoformat(d)).days < giorni
    def indirizzo_di(msg): return email.utils.parseaddr(msg.get('Reply-To') or msg.get('From'))[1].lower()
    def impronta(ind): return hashlib.sha256(ind.encode()).hexdigest()[:16]

    def errore(uid, tipo=None):                          # una mail che dà errore va in «Da vedere» e il giro continua
        conti['errori'] = conti.get('errori', 0) + 1
        try: posta.etichetta(uid, aggiungi=[DA_VEDERE, INBOX], togli=[tipo] if tipo else [])
        except Exception: pass

    # 1. richieste nuove: prezzi e PayPal, poi «Da gestire» fuori dalla Posta in arrivo (si aspetta il pagamento)
    for uid in posta.cerca('subject:(HORIZON licenza) newer_than:30d -from:me -label:da-gestire -label:gestite -label:da-vedere -label:m -label:a -label:p'):
        try:
            msg = posta.leggi(uid)
            if msg is None: continue
            ogg = dec(msg.get('Subject'))
            tel = tel_da(ogg) or tel_da(testo_di(msg))
            risposta = bool(msg.get('In-Reply-To')) or re.match(r'\s*(re|r|aw|sv)\s*:', ogg, re.I)
            ind = indirizzo_di(msg)
            if risposta:                                  # «ho pagato…»: resta in arrivo perché l'autore la veda
                posta.etichetta(uid, aggiungi=[DA_GESTIRE]); conti['saltate'] += 1
            elif tel and ind and (recente('tel', tel, 7) or recente('mail', impronta(ind), 1) or mandati_oggi >= 30):
                posta.etichetta(uid, aggiungi=[DA_GESTIRE]); conti['limitate'] = conti.get('limitate', 0) + 1   # resta in arrivo: decide l'autore
            elif tel and posta.rispondi(msg, *testo_prezzi(tel, env['PAYPAL']), immagini={'passi-paypal': PASSI_PAYPAL}):
                lim['tel'][tel] = lim['mail'][impronta(ind)] = oggi_d.isoformat(); mandati_oggi += 1
                if env.get('PREZZI'): json.dump(lim, open(env['PREZZI'], 'w'))
                posta.etichetta(uid, aggiungi=[DA_GESTIRE], togli=[INBOX]); conti['prezzi'] += 1
            else:                                         # senza codice del telefono o senza indirizzo: la guarda l'autore
                posta.etichetta(uid, aggiungi=[DA_VEDERE]); conti['da vedere'] += 1
        except Exception:
            errore(uid)

    # 2. pagate: etichetta M, A o P messa dall'autore → codice, poi «Gestite» fuori dalla Posta in arrivo.
    # Mai due codici per la stessa richiesta: il registro tiene il Message-ID della mail a cui si è risposto.
    fatti = set()
    # Più di una etichetta tra M, A e P sulla stessa mail (un tocco sbagliato sul telefono): non si sceglie da soli,
    # sarebbe partito il primo tipo in ordine «MAP». Niente codice: «Da vedere», in arrivo, senza le tre etichette.
    con_tipo = {t: set(posta.cerca(f'label:{t.lower()} -label:gestite -from:me')) for t in 'MAP'}
    doppi = (con_tipo['M'] & con_tipo['A']) | (con_tipo['M'] & con_tipo['P']) | (con_tipo['A'] & con_tipo['P'])
    for uid in doppi:
        try: posta.etichetta(uid, aggiungi=[DA_VEDERE, INBOX], togli=list('MAP')); conti['da vedere'] += 1
        except Exception: conti['errori'] = conti.get('errori', 0) + 1
    for tipo in 'MAP':
        for uid in posta.cerca(f'label:{tipo.lower()} -label:gestite -from:me'):
            if uid in doppi: continue                     # anche se togliere le etichette non è riuscito
            try:
                msg = posta.leggi(uid)
                if msg is None: continue
                mid = (msg.get('Message-ID') or '').strip()
                tel = tel_da(dec(msg.get('Subject'))) or tel_da(testo_di(msg))
                gia = (mid and any(r.get('msgid') == mid for r in registro)) or \
                      any(r.get('telefono') == tel and r.get('tipo') == tipo and r.get('emesso') == oggi_d.isoformat() and r.get('origine') == 'posta' for r in registro)
                if (tipo, tel) in fatti or gia:           # già mandato (anche in un giro precedente interrotto): solo etichette
                    posta.etichetta(uid, aggiungi=[GESTITE], togli=[tipo, DA_GESTIRE, INBOX]); continue
                if not tel:
                    posta.etichetta(uid, aggiungi=[DA_VEDERE, INBOX], togli=[tipo]); conti['da vedere'] += 1; continue
                n = max([r['numero'] for r in registro] + [0]) + 1
                codice = licenze.genera(priv, tipo, tel, n)
                info = licenze.leggi(pub, codice)
                if not posta.rispondi(msg, *testo_codice(tipo, codice, info['scade'])):
                    posta.etichetta(uid, aggiungi=[DA_VEDERE, INBOX], togli=[tipo]); conti['da vedere'] += 1; continue
                registro.append({'numero': n, 'tipo': tipo, 'telefono': info['telefono'], 'emesso': info['emesso'],
                                 'scade': info['scade'], 'origine': 'posta', 'nome': posta.ultimo[0], 'mail': posta.ultimo[1], 'msgid': mid})
                json.dump(registro, open(env['REGISTRO'], 'w'), indent=1)      # subito: se dopo qualcosa va storto il numero resta usato
                fatti.add((tipo, tel)); conti['codici'] += 1
                posta.etichetta(uid, aggiungi=[GESTITE], togli=[tipo, DA_GESTIRE, INBOX])
            except Exception:
                errore(uid, tipo)
        # le nostre risposte nella stessa conversazione: l'etichetta M/A/P messa a mano la prendono anche loro
        try:
            for uid in posta.cerca(f'label:{tipo.lower()} from:me'): posta.etichetta(uid, aggiungi=[GESTITE], togli=[tipo, DA_GESTIRE])
            # e anche le mail già «Gestite» della stessa conversazione (un rinnovo): lì l'etichetta resterebbe per
            # sempre, e la sveglia in Gmail (tools/gmail-licenze) continuerebbe a far partire questo giro
            for uid in posta.cerca(f'label:{tipo.lower()} label:gestite'): posta.etichetta(uid, togli=[tipo])
        except Exception: conti['errori'] = conti.get('errori', 0) + 1
    # 2b. piste rilevate e campi usati (segnalazioni anonime dall'app, arrivano qui dalla 1.0.138): se ne salvano solo
    # le righe «HORIZON-PISTA {…}» / «HORIZON-CAMPI {…}» (codice casuale del telefono, niente nomi né indirizzi) in
    # PISTE/, che il workflow mette sul ramo «licenze» (cartella piste/) per tools/piste_piloti.py. La mail va in «Piste lette».
    if env.get('PISTE'):
        os.makedirs(env['PISTE'], exist_ok=True)
        for uid in posta.cerca('newer_than:60d -label:piste-lette (subject:(HORIZON pista rilevata) OR subject:(HORIZON campi usati))'):
            try:
                msg = posta.leggi(uid)
                if msg is None: continue
                import piste_piloti                        # stesso lettore del lavoro settimanale (testo o HTML)
                testo = ''
                for parte in msg.walk():
                    if parte.get_content_type() in ('text/plain', 'text/html'):
                        try: testo += '\n' + parte.get_payload(decode=True).decode(parte.get_content_charset() or 'utf-8', 'replace')
                        except Exception: pass
                righe = [f'HORIZON-{t} ' + json.dumps(v, ensure_ascii=False, separators=(',', ':'))
                         for t in ('PISTA', 'CAMPI') for v in piste_piloti.righe(testo, t)]
                righe = list(dict.fromkeys(righe))[:MAX_RIGHE_PISTE]   # la stessa riga nella parte testo e in quella HTML: una volta
                if righe:
                    nome = f"{datetime.date.today().isoformat()}-{hashlib.sha256((msg.get('Message-ID') or str(uid)).encode()).hexdigest()[:12]}.txt"
                    open(os.path.join(env['PISTE'], nome), 'w').write('\n'.join(righe) + '\n')
                    conti['piste'] = conti.get('piste', 0) + len(righe)
                posta.etichetta(uid, aggiungi=['Piste lette'], togli=[INBOX])
            except Exception:
                conti['errori'] = conti.get('errori', 0) + 1

    # 2c. segnalazioni dei piloti («Problema», «Registrazione sensori», …): tools/segnalazioni.py le analizza dai dati tecnici.
    # Caso riconosciuto → risposta al pilota, mail in «Segnalazioni analizzate» fuori dalla Posta in arrivo (senza indirizzo
    # l'analisi resta nella conversazione, con «Senza indirizzo»). Tutto il resto → «Segnalazioni da vedere», in arrivo, per
    # l'autore; al pilota solo la ricevuta. Solo le ultime 3 giornate: mai risposte a segnalazioni vecchie.
    try:
        for uid in posta.cerca('from:me to:me in:inbox subject:(HORIZON Analisi automatica)'):     # le analisi senza indirizzo, tornate a noi
            posta.etichetta(uid, aggiungi=[SEG_OK], togli=[INBOX])
        ultima = segnalazioni.ultima_versione(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'www', 'index.html'), encoding='utf-8').read())
    except Exception:
        ultima = None
    seg_oggi = lambda pref='': sum(1 for x, d in lim['seg'].items() if d == oggi_d.isoformat() and x.startswith(pref))
    righe_seg = []
    for uid in (posta.cerca('newer_than:3d -from:me -label:segnalazioni-analizzate -label:segnalazioni-da-vedere -label:segnalazioni-gestite -label:chiusa '
                            '{subject:(HORIZON Problema) subject:(HORIZON Registrazione sensori) subject:(HORIZON Suggerimento) subject:(HORIZON Dato sbagliato)}')
                if ultima else []):
        try:
            msg = posta.leggi(uid)
            if msg is None: continue
            ogg = dec(msg.get('Subject'))
            if 'licenza' in ogg.lower(): continue          # le richieste di licenza hanno il loro giro
            if msg.get('In-Reply-To') or re.match(r'\s*(re|r|aw|sv|fwd?|i)\s*:', ogg, re.I):     # il pilota ha risposto: la legge l'autore
                posta.etichetta(uid, aggiungi=[SEG_VEDERE]); conti['seg da vedere'] = conti.get('seg da vedere', 0) + 1; continue
            campi = segnalazioni.campi(testo_di(msg))
            if not campi.get('Segnalazione'):
                pagina = ''
                for parte in msg.walk():
                    if parte.get_content_type() == 'text/html':
                        try: pagina += parte.get_payload(decode=True).decode(parte.get_content_charset() or 'utf-8', 'replace')
                        except Exception: pass
                campi = segnalazioni.campi(segnalazioni.testo_da_html(pagina))
            caso = segnalazioni.Caso(campi, ultima)
            esito = segnalazioni.analizza(caso) if campi.get('Segnalazione') else {'riconosciuto': False, 'motivo': 'mail non letta', 'codici': [], 'sezioni': []}
            ind = indirizzo_di(msg)
            ha_ind = bool(ind) and ind != posta.utente.lower() and 'web3forms' not in ind and 'noreply' not in ind
            troppe = ha_ind and (seg_oggi(impronta(ind) + ':') >= SEG_GIORNO_IND or seg_oggi() >= SEG_GIORNO)
            def segna():
                lim['seg'][f"{impronta(ind)}:{seg_oggi(impronta(ind) + ':')}:{oggi_d.isoformat()}"] = oggi_d.isoformat()
                if env.get('PREZZI'): json.dump(lim, open(env['PREZZI'], 'w'))
            if esito['riconosciuto'] and ha_ind and not troppe and posta.rispondi(msg, *segnalazioni.risposta(caso, esito)):
                segna(); posta.etichetta(uid, aggiungi=[SEG_OK], togli=[INBOX]); conti['seg risposte'] = conti.get('seg risposte', 0) + 1
            elif esito['riconosciuto'] and not ha_ind:    # niente indirizzo: l'analisi resta scritta nella conversazione
                t, h = segnalazioni.risposta(caso, esito)
                r = EmailMessage()
                r['From'] = email.utils.formataddr(('HORIZON', posta.utente)); r['To'] = posta.utente
                r['Subject'] = 'Re: ' + re.sub(r'[\r\n\t]+', ' ', ogg)[:180] + ' · HORIZON Analisi automatica'
                r['Auto-Submitted'] = 'auto-generated'; r[AUTO] = '1'
                if msg.get('Message-ID'): r['In-Reply-To'] = r['References'] = ' '.join(msg['Message-ID'].split())
                nota = 'Il pilota non ha lasciato un indirizzo: questa analisi NON gli è arrivata. Resta qui come traccia.\n\n'
                r.set_content(nota + t); r.add_alternative(html_di('<p><b>' + nota.strip() + '</b></p>' + h), subtype='html')
                posta.manda(r)
                posta.etichetta(uid, aggiungi=[SEG_OK, SEG_SENZA], togli=[INBOX]); conti['seg senza indirizzo'] = conti.get('seg senza indirizzo', 0) + 1
            else:                                         # non riconosciuta, difetto, troppe in un giorno: la guarda l'autore
                if ha_ind and not troppe and posta.rispondi(msg, *segnalazioni.ricevuta(caso)): segna()
                posta.etichetta(uid, aggiungi=[SEG_VEDERE]); conti['seg da vedere'] = conti.get('seg da vedere', 0) + 1
            if campi.get('Segnalazione'): righe_seg.append(segnalazioni.riga_anonima(caso, esito, oggi_d.isoformat()))
        except Exception:
            conti['errori'] = conti.get('errori', 0) + 1
            try: posta.etichetta(uid, aggiungi=[SEG_VEDERE, INBOX])
            except Exception: pass
    if righe_seg and env.get('SEGNALAZIONI'):             # registro anonimo dei casi, sul ramo «licenze» (cartella segnalazioni/)
        os.makedirs(env['SEGNALAZIONI'], exist_ok=True)
        with open(os.path.join(env['SEGNALAZIONI'], 'nuove.txt'), 'a', encoding='utf-8') as f: f.write('\n'.join(righe_seg) + '\n')

    # 2d. le «Segnalazioni da vedere» che l'autore ha chiuso: ha risposto a mano nella conversazione (dopo la mail del
    # pilota, e non è una nostra risposta automatica) oppure ha messo l'etichetta «Chiusa». Passano in «Segnalazioni
    # gestite», fuori dalla Posta in arrivo. Se il pilota riscrive, la mail nuova rientra dal passo 2c in «da vedere».
    try:
        posta.crea(CHIUSA); posta.crea(SEG_GESTITE)
        from email.utils import parsedate_to_datetime
        def quando(m):
            try: return parsedate_to_datetime(m.get('Date')).timestamp()
            except Exception: return 0
        def a_mano(m):
            if m is None or m.get(AUTO): return False
            if email.utils.parseaddr(m.get('From'))[1].lower() != posta.utente.lower(): return False
            t = testo_di(m).lstrip()
            return not (t.startswith('Ciao, abbiamo ricevuto la tua segnalazione') or t.startswith('Il pilota non ha lasciato un indirizzo'))
        chiuse = set(posta.cerca('label:chiusa'))
        for uid in set(posta.cerca('label:segnalazioni-da-vedere -from:me')) | chiuse:
            try:
                if uid not in chiuse:
                    msg = posta.leggi(uid)
                    if msg is None: continue
                    t0 = quando(msg)
                    if not any(a_mano(m) and quando(m) > t0 for m in (posta.leggi(u) for u in posta.conversazione(uid) if u != uid)): continue
                posta.etichetta(uid, aggiungi=[SEG_GESTITE], togli=[SEG_VEDERE, CHIUSA, INBOX]); conti['seg gestite'] = conti.get('seg gestite', 0) + 1
            except Exception:
                conti['errori'] = conti.get('errori', 0) + 1
    except Exception:
        conti['errori'] = conti.get('errori', 0) + 1

    if recupera_indirizzi(posta, registro, pub): json.dump(registro, open(env['REGISTRO'], 'w'), indent=1)
    # 3. riepilogo: uno al giorno (al primo giro del giorno) o a richiesta; finisce in «Archivio generale licenze»
    import datetime
    oggi = datetime.date.today().isoformat(); fu = env.get('ULTIMO_RIEPILOGO')
    ultimo = open(fu).read().strip() if fu and os.path.exists(fu) else ''
    from zoneinfo import ZoneInfo
    ora_it = datetime.datetime.now(ZoneInfo('Europe/Rome'))
    if (ultimo != oggi and ora_it.hour >= 7) or env.get('MANDA_RIEPILOGO') == 'true':   # il riepilogo del giorno dalle 7
        rev = json.load(open(env['REVOCATE'])) if env.get('REVOCATE') and os.path.exists(env['REVOCATE']) else {}
        try: da_vedere = len(posta.cerca('label:segnalazioni-da-vedere in:inbox'))
        except Exception: da_vedere = 0
        riepilogo(posta, registro, rev, da_vedere); conti['riepilogo'] = 1
        if fu: open(fu, 'w').write(oggi + '\n')
    # in archivio: anche quello appena mandato, che Gmail consegna dopo qualche secondo (si aspetta al massimo 1 minuto)
    import time
    for prova in range(13 if conti.get('riepilogo') else 1):
        if prova: time.sleep(5); posta.imap.noop()
        uids = posta.cerca('subject:(HORIZON Riepilogo licenze) in:inbox')
        for uid in uids: posta.etichetta(uid, aggiungi=[ARCHIVIO], togli=[INBOX])
        if uids and prova: break
    for uid in posta.cerca('subject:(HORIZON Riepilogo licenze) -label:archivio-generale-licenze'):
        posta.etichetta(uid, aggiungi=[ARCHIVIO])
    posta.imap.logout()

    riga = (f"prezzi mandati {conti['prezzi']} · codici mandati {conti['codici']} · da vedere {conti['da vedere']} · saltate {conti['saltate']}"
            f" · limitate {conti.get('limitate', 0)} · righe piste/campi {conti.get('piste', 0)}"
            f" · segnalazioni: risposte {conti.get('seg risposte', 0)}, senza indirizzo {conti.get('seg senza indirizzo', 0)}, da vedere {conti.get('seg da vedere', 0)}, chiuse dall'autore {conti.get('seg gestite', 0)}"
            f" · errori {conti.get('errori', 0)}")
    print(riga)
    if env.get('RIEPILOGO'):
        with open(env['RIEPILOGO'], 'a') as f: f.write('## Licenze per posta\n\n' + riga + '\n')
    if env.get('GITHUB_OUTPUT'):
        with open(env['GITHUB_OUTPUT'], 'a') as f: f.write(f"codici={conti['codici']}\n")


if __name__ == '__main__':
    try:
        main()
    except SystemExit:
        raise
    except Exception as e:                                # niente testo dell'errore: potrebbe contenere un indirizzo
        print('errore:', type(e).__name__); sys.exit(1)
