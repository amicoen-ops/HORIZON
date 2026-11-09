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
   quel tipo per quel telefono, si risponde al pilota, si annota nel registro (cifrato, senza indirizzi) e la mail
   passa a «Gestite», fuori dalla Posta in arrivo. Se nella mail non c'è un codice del telefono valido resta in arrivo
   con «Da vedere».

Il progetto è pubblico: nei log solo numeri, mai indirizzi o codici del telefono.
Ambiente: GMAIL_UTENTE, GMAIL_LICENZE (password per le app), PRIVATA (pem), PUBBLICA (txt), REGISTRO (json),
PAYPAL, RIEPILOGO (file del riepilogo della corsa, facoltativo).
"""
import email, email.utils, imaplib, json, os, re, smtplib, sys
from email.header import decode_header, make_header
from email.message import EmailMessage

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import licenze

TIPI = {'M': 'mensile', 'A': 'annuale', 'P': 'perenne'}
DA_GESTIRE, GESTITE, DA_VEDERE, INBOX = 'Da gestire', 'Gestite', 'Da vedere', '\\Inbox'
ARCHIVIO = 'Archivio generale licenze'
PASSI_PAYPAL = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'docs', 'licenze', 'paypal-passi.png')
PREZZI = {'M': 5, 'A': 30, 'P': 150}
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
        self.imap = imaplib.IMAP4_SSL('imap.gmail.com')
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
        r['To'] = email.utils.formataddr((nome, indirizzo))
        ogg = dec(msg.get('Subject'))
        r['Subject'] = ogg if ogg.lower().startswith('re:') else 'Re: ' + ogg
        if msg.get('Message-ID'):
            r['In-Reply-To'] = msg['Message-ID']
            r['References'] = ((msg.get('References') or '') + ' ' + msg['Message-ID']).strip()
        r.set_content(testo)
        if html:
            r.add_alternative(html, subtype='html')
            parte = r.get_payload()[-1]
            for cid, percorso in (immagini or {}).items():      # immagini dentro la mail (cid:…): si vedono anche senza scaricare
                parte.add_related(open(percorso, 'rb').read(), 'image', 'png', cid='<' + cid + '>', filename=os.path.basename(percorso))
        self.manda(r)
        return True

    def manda(self, r):
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as s:
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


def riepilogo(posta, registro, rev):
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
    corpo = (f'<p><b>{len(registro)} licenze</b> · {sintesi}</p>'
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
    r.set_content(f'{len(registro)} licenze · {sintesi}\n\n' + '\n'.join(testo) + '\n')
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

    # 1. richieste nuove: prezzi e PayPal, poi «Da gestire» fuori dalla Posta in arrivo (si aspetta il pagamento)
    for uid in posta.cerca('subject:(HORIZON licenza) newer_than:30d -from:me -label:da-gestire -label:gestite -label:da-vedere -label:m -label:a -label:p'):
        msg = posta.leggi(uid)
        if msg is None: continue
        ogg = dec(msg.get('Subject'))
        tel = tel_da(ogg) or tel_da(testo_di(msg))
        risposta = bool(msg.get('In-Reply-To')) or re.match(r'\s*(re|r|aw|sv)\s*:', ogg, re.I)
        if risposta:                                      # «ho pagato…»: resta in arrivo perché l'autore la veda
            posta.etichetta(uid, aggiungi=[DA_GESTIRE]); conti['saltate'] += 1
        elif tel and posta.rispondi(msg, *testo_prezzi(tel, env['PAYPAL']), immagini={'passi-paypal': PASSI_PAYPAL}):
            posta.etichetta(uid, aggiungi=[DA_GESTIRE], togli=[INBOX]); conti['prezzi'] += 1
        else:                                             # senza codice del telefono o senza indirizzo: la guarda l'autore
            posta.etichetta(uid, aggiungi=[DA_VEDERE]); conti['da vedere'] += 1

    # 2. pagate: etichetta M, A o P messa dall'autore → codice, poi «Gestite» fuori dalla Posta in arrivo
    fatti = set()
    for tipo in 'MAP':
        for uid in posta.cerca(f'label:{tipo.lower()} -label:gestite -from:me'):
            msg = posta.leggi(uid)
            if msg is None: continue
            tel = tel_da(dec(msg.get('Subject'))) or tel_da(testo_di(msg))
            if (tipo, tel) in fatti or (not tel and fatti and any(t == tipo for t, _ in fatti) and msg.get('In-Reply-To')):
                posta.etichetta(uid, aggiungi=[GESTITE], togli=[tipo, DA_GESTIRE, INBOX]); continue   # altre mail della stessa conversazione
            if not tel:
                posta.etichetta(uid, aggiungi=[DA_VEDERE, INBOX], togli=[tipo]); conti['da vedere'] += 1; continue
            n = max([r['numero'] for r in registro] + [0]) + 1
            codice = licenze.genera(priv, tipo, tel, n)
            info = licenze.leggi(pub, codice)
            if not posta.rispondi(msg, *testo_codice(tipo, codice, info['scade'])):
                posta.etichetta(uid, aggiungi=[DA_VEDERE, INBOX], togli=[tipo]); conti['da vedere'] += 1; continue
            registro.append({'numero': n, 'tipo': tipo, 'telefono': info['telefono'], 'emesso': info['emesso'],
                             'scade': info['scade'], 'origine': 'posta', 'nome': posta.ultimo[0], 'mail': posta.ultimo[1]})
            json.dump(registro, open(env['REGISTRO'], 'w'), indent=1)      # subito: se dopo qualcosa va storto il numero resta usato
            fatti.add((tipo, tel)); conti['codici'] += 1
            posta.etichetta(uid, aggiungi=[GESTITE], togli=[tipo, DA_GESTIRE, INBOX])
        # le nostre risposte nella stessa conversazione: l'etichetta M/A/P messa a mano la prendono anche loro
        for uid in posta.cerca(f'label:{tipo.lower()} from:me'): posta.etichetta(uid, aggiungi=[GESTITE], togli=[tipo, DA_GESTIRE])
    if recupera_indirizzi(posta, registro, pub): json.dump(registro, open(env['REGISTRO'], 'w'), indent=1)
    # 3. riepilogo: uno al giorno (al primo giro del giorno) o a richiesta; finisce in «Archivio generale licenze»
    import datetime
    oggi = datetime.date.today().isoformat(); fu = env.get('ULTIMO_RIEPILOGO')
    ultimo = open(fu).read().strip() if fu and os.path.exists(fu) else ''
    if ultimo != oggi or env.get('MANDA_RIEPILOGO') == 'true':
        rev = json.load(open(env['REVOCATE'])) if env.get('REVOCATE') and os.path.exists(env['REVOCATE']) else {}
        riepilogo(posta, registro, rev); conti['riepilogo'] = 1
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

    riga = f"prezzi mandati {conti['prezzi']} · codici mandati {conti['codici']} · da vedere {conti['da vedere']} · saltate {conti['saltate']}"
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
