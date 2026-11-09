#!/usr/bin/env python3
# HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
# Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
"""
Azioni a mano sulle licenze, per il workflow «Licenze» (si lancia dalla cartella del ramo «licenze», cifratura fatta dal
workflow). Pensato per essere ripetuto: se il push trova il ramo cambiato, il workflow riprende la copia nuova e
rilancia l'azione, che si applica di nuovo senza doppioni.

  licenze_azione.py genera   REGISTRO.json PRIVATA.pem STATO.json   (TIPO, TELEFONO in ambiente)
  licenze_azione.py revoca   REGISTRO.json                          (NUMERO in ambiente)
  licenze_azione.py ripristina REGISTRO.json                        (NUMERO in ambiente)
  licenze_azione.py manda    STATO.json                             (GMAIL_UTENTE, GMAIL_LICENZE in ambiente)

Il repository è pubblico: nel riepilogo della corsa mai il codice di licenza né indirizzi; il codice va per posta alla
casella di HORIZON, che lo inoltra al pilota.
"""
import datetime, json, os, smtplib, sys
from email.message import EmailMessage

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__))))
import licenze

TIPI = {'M': 'mensile', 'A': 'annuale', 'P': 'perenne'}
REV = 'licenze/revocate.json'
oggi = datetime.date.today().isoformat()


def riepilogo(t):
    with open(os.environ.get('GITHUB_STEP_SUMMARY', '/dev/null'), 'a') as f: f.write(t + '\n')


def genera(reg_p, priv_p, stato_p):
    reg = json.load(open(reg_p))
    st = json.load(open(stato_p)) if os.path.exists(stato_p) else None
    # già generato in un tentativo precedente: si riusa se il numero è ancora libero (il codice non è ancora partito)
    if st and not any(r['numero'] == st['numero'] and r['telefono'] != st['telefono'] for r in reg):
        if not any(r['numero'] == st['numero'] for r in reg): reg.append(st['riga'])
    else:
        n = max([r['numero'] for r in reg] + [0]) + 1
        codice = licenze.genera(open(priv_p, 'rb').read(), os.environ['TIPO'], os.environ['TELEFONO'], n)
        info = licenze.leggi(open('licenze/chiave_pubblica.txt').read(), codice)
        riga = {'numero': n, 'tipo': info['tipo'], 'telefono': info['telefono'], 'emesso': info['emesso'], 'scade': info['scade'], 'origine': 'a mano'}
        st = {'numero': n, 'telefono': info['telefono'], 'codice': codice, 'riga': riga}
        json.dump(st, open(stato_p, 'w')); reg.append(riga)
    json.dump(reg, open(reg_p, 'w'), indent=1)


def numero_valido(reg_p):
    n = int(os.environ['NUMERO'])
    if reg_p and os.path.exists(reg_p) and not any(r['numero'] == n for r in json.load(open(reg_p))):
        raise SystemExit(f'::error::La licenza n. {n} non è nel registro')
    return n


def revoca(reg_p, rimetti=False):
    n = numero_valido(reg_p); d = json.load(open(REV)); era = n in d['revocate']
    if rimetti and not era: riepilogo(f'## Licenza n. {n} non era revocata: niente da fare'); return
    if not rimetti and era: riepilogo(f'## Licenza n. {n} già revocata'); return
    d['revocate'] = [x for x in d['revocate'] if x != n] if rimetti else d['revocate'] + [n]
    d.setdefault('storico', []).append({'numero': n, 'azione': 'ripristino' if rimetti else 'revoca', 'data': oggi})
    json.dump(d, open(REV, 'w'), indent=1)


def manda(stato_p):
    st = json.load(open(stato_p)); r = st['riga']; tipo = TIPI[r['tipo']]
    utente, pw = os.environ.get('GMAIL_UTENTE'), os.environ.get('GMAIL_LICENZE')
    if not (utente and pw):
        riepilogo(f"## Licenza n. {st['numero']} · {tipo}\n\nCreata, ma il segreto GMAIL_LICENZE manca: il codice non si può mandare per posta "
                  "(e qui, nel repository pubblico, non si scrive). Imposta il segreto e rigenera.")
        return
    m = EmailMessage()
    m['From'] = f'HORIZON <{utente}>'; m['To'] = utente
    m['Subject'] = f"HORIZON · licenza n. {st['numero']} ({tipo}) creata a mano"
    m.set_content(f"Licenza n. {st['numero']} · {tipo} · telefono {st['telefono'][:4]}-{st['telefono'][4:8]}-{st['telefono'][8:]}\n"
                  f"Emessa il {r['emesso']} · scade: {r['scade'] or 'mai'}\n\nInoltra al pilota questo testo:\n\n"
                  f"Ciao, ecco il codice della tua licenza HORIZON ({tipo}).\n"
                  "In HORIZON apri Info, tocca 5 volte il logo in alto a sinistra, incolla il codice in «Codice di licenza» e premi «Attiva».\n\n"
                  f"{st['codice']}\n\nBuoni voli!\n")
    with smtplib.SMTP_SSL('smtp.gmail.com', 465, timeout=60) as s:
        s.login(utente, pw); s.send_message(m)
    riepilogo(f"## Licenza n. {st['numero']} · {tipo}\n\nEmessa il {r['emesso']} · scade: {r['scade'] or 'mai'}.\n\n"
              "Il codice è nella casella di HORIZON (oggetto «licenza n. … creata a mano»): inoltralo al pilota.")


if __name__ == '__main__':
    a = sys.argv[1:]
    if a[:1] == ['genera']: genera(a[1], a[2], a[3])
    elif a[:1] == ['revoca']: revoca(a[1] if len(a) > 1 else None)
    elif a[:1] == ['ripristina']: revoca(a[1] if len(a) > 1 else None, rimetti=True)
    elif a[:1] == ['manda']: manda(a[1])
    else: print(__doc__); sys.exit(1)
