#!/usr/bin/env python3
# HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
# Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
"""
Posta delle licenze, sulla casella horizonlicenses (IMAP e SMTP di Gmail con la password per le app).
Lo lancia il workflow «Licenze per posta» ogni 10 minuti.

1. Richieste nuove (oggetto con «HORIZON» e «licenza» e il codice del telefono, arrivate dall'app o scritte a mano):
   risponde con i prezzi e il link PayPal, poi mette l'etichetta «Risposto».
2. Pagate: l'autore, visto il pagamento su PayPal, mette alla mail l'etichetta M, A o P. Qui si crea il codice di
   quel tipo per quel telefono, si risponde al pilota, si annota nel registro (cifrato, senza indirizzi) e la mail
   passa a «Fatte». Se nella mail non c'è un codice del telefono valido va a «Da vedere».

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

    def etichetta(self, uid, aggiungi=None, togli=None):
        if aggiungi: self.imap.uid('STORE', uid, '+X-GM-LABELS', '(' + aggiungi + ')')
        if togli: self.imap.uid('STORE', uid, '-X-GM-LABELS', '(' + togli + ')')

    def rispondi(self, msg, testo, html=None):
        a = msg.get('Reply-To') or msg.get('From')
        nome, indirizzo = email.utils.parseaddr(a)
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
        if html: r.add_alternative(html, subtype='html')
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as s:
            s.login(self.utente, self.password)
            s.send_message(r)
        return True


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
<p>Senza il codice nella nota non sappiamo per quale telefono fare la licenza.<br>
Appena vediamo il pagamento ti mandiamo qui il codice di licenza, di solito in giornata.</p>
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


def main():
    env = os.environ
    posta = Posta(env['GMAIL_UTENTE'], env['GMAIL_LICENZE'])
    registro = json.load(open(env['REGISTRO']))
    priv = open(env['PRIVATA'], 'rb').read()
    pub = open(env['PUBBLICA']).read()
    conti = {'prezzi': 0, 'codici': 0, 'da vedere': 0, 'saltate': 0}

    # 1. richieste nuove: prezzi e PayPal
    for uid in posta.cerca('subject:(HORIZON licenza) newer_than:30d -from:me -label:risposto -label:fatte -label:m -label:a -label:p'):
        msg = posta.leggi(uid)
        if msg is None: continue
        ogg = dec(msg.get('Subject'))
        tel = tel_da(ogg) or tel_da(testo_di(msg))
        risposta = bool(msg.get('In-Reply-To')) or re.match(r'\s*(re|r|aw|sv)\s*:', ogg, re.I)
        if tel and not risposta and posta.rispondi(msg, *testo_prezzi(tel, env['PAYPAL'])): conti['prezzi'] += 1
        else: conti['saltate'] += 1
        posta.etichetta(uid, aggiungi='Risposto')

    # 2. pagate: etichetta M, A o P messa dall'autore
    fatti = set()
    for tipo in 'MAP':
        for uid in posta.cerca(f'label:{tipo.lower()} -label:fatte -from:me'):
            msg = posta.leggi(uid)
            if msg is None: continue
            tel = tel_da(dec(msg.get('Subject'))) or tel_da(testo_di(msg))
            if not tel:
                posta.etichetta(uid, aggiungi='"Da vedere"', togli=tipo); conti['da vedere'] += 1; continue
            if (tipo, tel) in fatti:                      # altre mail della stessa conversazione
                posta.etichetta(uid, aggiungi='Fatte', togli=tipo); continue
            n = max([r['numero'] for r in registro] + [0]) + 1
            codice = licenze.genera(priv, tipo, tel, n)
            info = licenze.leggi(pub, codice)
            if not posta.rispondi(msg, *testo_codice(tipo, codice, info['scade'])):
                posta.etichetta(uid, aggiungi='"Da vedere"', togli=tipo); conti['da vedere'] += 1; continue
            registro.append({'numero': n, 'tipo': tipo, 'telefono': info['telefono'], 'emesso': info['emesso'],
                             'scade': info['scade'], 'origine': 'posta'})
            json.dump(registro, open(env['REGISTRO'], 'w'), indent=1)      # subito: se dopo qualcosa va storto il numero resta usato
            fatti.add((tipo, tel)); conti['codici'] += 1
            posta.etichetta(uid, aggiungi='Fatte', togli=tipo)
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
