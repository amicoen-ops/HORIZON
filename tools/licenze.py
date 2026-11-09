#!/usr/bin/env python3
# HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
# Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
"""
Codici di licenza di HORIZON: firmati con una chiave privata (ECDSA P-256) che ha solo l'autore,
verificati dall'app anche senza internet con la chiave pubblica.

Contenuto del codice (21 byte, poi 64 byte di firma):
  versione (1) · tipo (1: M mensile, A annuale, P perenne) · giorno di emissione (2) · giorno di scadenza (2,
  65535 = nessuna) · numero della licenza (3) · codice del telefono (12 caratteri, quello che l'app mostra
  nel menu riservato, senza trattini)
I giorni si contano dal 1° gennaio 2026. Mensile = 31 giorni, annuale = 366 giorni dalla data di emissione.
Il codice si scrive in base32 (Crockford, senza lettere ambigue) a gruppi di 5, preceduto da «HZ1».

Uso:
  licenze.py chiave PRIVATA.pem PUBBLICA.txt          crea la coppia di chiavi
  licenze.py genera PRIVATA.pem TIPO TELEFONO NUMERO  stampa il codice
  licenze.py verifica PUBBLICA.txt CODICE             controlla un codice e ne stampa il contenuto
"""
import base64, datetime, struct, sys
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature, encode_dss_signature

ALFA = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
EPOCA = datetime.date(2026, 1, 1)
DURATA = {'M': 31, 'A': 366, 'P': None}
NESSUNA = 65535
TEL_ALFA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'          # alfabeto del codice del telefono (licenza.js)


def b32(b):
    n, bits, out = 0, 0, ''
    for x in b:
        n = (n << 8) | x; bits += 8
        while bits >= 5:
            bits -= 5; out += ALFA[(n >> bits) & 31]
    if bits: out += ALFA[(n << (5 - bits)) & 31]
    return out


def unb32(s):
    s = s.upper().replace('O', '0').replace('I', '1').replace('L', '1')
    n, bits, out = 0, 0, bytearray()
    for ch in s:
        if ch not in ALFA: continue
        n = (n << 5) | ALFA.index(ch); bits += 5
        if bits >= 8:
            bits -= 8; out.append((n >> bits) & 255)
    return bytes(out)


def telefono(t):
    t = ''.join(ch for ch in t.upper() if ch.isalnum())
    if len(t) != 12 or any(ch not in TEL_ALFA for ch in t):
        raise SystemExit('Codice del telefono non valido: servono 12 caratteri come XXXX-XXXX-XXXX')
    return t


def giorno(d): return (d - EPOCA).days


def genera(priv_pem, tipo, tel, numero, oggi=None):
    tipo = tipo.upper()
    if tipo not in DURATA: raise SystemExit('Tipo: M (mensile), A (annuale) o P (perenne)')
    oggi = oggi or datetime.date.today()
    em = giorno(oggi); sc = NESSUNA if DURATA[tipo] is None else em + DURATA[tipo]
    dati = struct.pack('>BcHH', 1, tipo.encode(), em, sc) + int(numero).to_bytes(3, 'big') + telefono(tel).encode()
    key = serialization.load_pem_private_key(priv_pem, password=None)
    r, s = decode_dss_signature(key.sign(dati, ec.ECDSA(hashes.SHA256())))
    testo = b32(dati + r.to_bytes(32, 'big') + s.to_bytes(32, 'big'))
    return 'HZ1-' + '-'.join(testo[i:i + 5] for i in range(0, len(testo), 5))


def leggi(pub_txt, codice):
    c = codice.strip().upper()
    if c.startswith('HZ1'): c = c[3:]
    raw = unb32(c)
    if len(raw) < 85: raise ValueError('codice troppo corto')
    dati, firma = raw[:21], raw[21:85]
    der = base64.b64decode(pub_txt.strip())
    key = serialization.load_der_public_key(der)
    key.verify(encode_dss_signature(int.from_bytes(firma[:32], 'big'), int.from_bytes(firma[32:], 'big')), dati, ec.ECDSA(hashes.SHA256()))
    v, tipo, em, sc = struct.unpack('>BcHH', dati[:6])
    return {'versione': v, 'tipo': tipo.decode(), 'emesso': str(EPOCA + datetime.timedelta(days=em)),
            'scade': None if sc == NESSUNA else str(EPOCA + datetime.timedelta(days=sc)),
            'numero': int.from_bytes(dati[6:9], 'big'), 'telefono': dati[9:21].decode()}


def chiave(priv_path, pub_path):
    k = ec.generate_private_key(ec.SECP256R1())
    open(priv_path, 'wb').write(k.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
    der = k.public_key().public_bytes(serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo)
    open(pub_path, 'w').write(base64.b64encode(der).decode() + '\n')


if __name__ == '__main__':
    a = sys.argv[1:]
    if a[:1] == ['chiave'] and len(a) == 3: chiave(a[1], a[2])
    elif a[:1] == ['genera'] and len(a) == 5: print(genera(open(a[1], 'rb').read(), a[2], a[3], a[4]))
    elif a[:1] == ['verifica'] and len(a) == 3: print(leggi(open(a[1]).read(), a[2]))
    else: print(__doc__); sys.exit(1)
