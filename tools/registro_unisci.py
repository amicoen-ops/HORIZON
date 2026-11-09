#!/usr/bin/env python3
# HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
# Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
"""
Unisce due copie del registro delle licenze (JSON in chiaro, già decifrato) quando due giri lo hanno scritto insieme
(il ramo «licenze» è cambiato mentre questo giro lavorava): nessuna riga si perde.

  registro_unisci.py REMOTO.json NOSTRO.json USCITA.json

Le righe uguali per numero e telefono si tengono una volta (quella con più campi). Due righe con lo stesso numero ma
telefono diverso (due giri hanno dato lo stesso numero) si tengono entrambe: si segnala nel registro con «conflitto».
Stampa solo conteggi.
"""
import json, sys


def unisci(remoto, nostro):
    per = {}
    for r in remoto + nostro:
        k = (r.get('numero'), r.get('telefono'))
        if k not in per or len(r) > len(per[k]): per[k] = r
    righe = sorted(per.values(), key=lambda r: (r.get('numero') or 0, r.get('emesso') or ''))
    numeri = {}
    for r in righe: numeri.setdefault(r.get('numero'), []).append(r)
    conflitti = 0
    for gruppo in numeri.values():
        if len(gruppo) > 1:
            conflitti += 1
            for r in gruppo: r['conflitto'] = 'stesso numero dato a due telefoni'
    return righe, conflitti


if __name__ == '__main__':
    remoto, nostro = json.load(open(sys.argv[1])), json.load(open(sys.argv[2]))
    righe, conflitti = unisci(remoto, nostro)
    json.dump(righe, open(sys.argv[3], 'w'), indent=1)
    print(f'registro unito: {len(righe)} righe ({len(remoto)} remote, {len(nostro)} nostre), numeri in conflitto: {conflitti}')
