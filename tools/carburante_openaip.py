#!/usr/bin/env python3
"""Campi con carburante da openAIP (CC BY-NC 4.0): Italia intera più Francia, Svizzera, Austria e Slovenia
vicine alle Alpi. Uscita compatta per l'app: [nome, icao, lat, lon, quota ft, [carburanti], tipo].
Carburanti openAIP: 0 Super Plus (MOGAS) · 1 AVGAS 100LL · 2 Jet A · 3 Jet A1 · 4 Jet B · 5 Diesel · 6 AVGAS UL91.
Uso: carburante_openaip.py cartella_con_i_file_xx_apt.json uscita.json"""
import json, sys, os, datetime
SRC, OUT = sys.argv[1], sys.argv[2]
CODE = {0: 'mogas', 1: 'avgas', 2: 'jet', 3: 'jet', 4: 'jet', 5: 'diesel', 6: 'ul91'}
rows = []
for cc in ['it', 'fr', 'ch', 'at', 'si']:
    f = os.path.join(SRC, cc + '_apt.json')
    if not os.path.exists(f):
        print(cc, 'manca'); continue
    d = json.load(open(f, encoding='utf-8'))
    items = d if isinstance(d, list) else d.get('items', [])
    n = 0
    for x in items:
        ft = (x.get('services') or {}).get('fuelTypes') or []
        if not ft: continue
        lon, lat = x['geometry']['coordinates'][:2]
        if cc != 'it' and not (43.0 <= lat <= 48.2 and 4.5 <= lon <= 16.5): continue
        el = x.get('elevation') or {}
        ftv = None
        if el.get('value') is not None: ftv = round(el['value'] * (3.28084 if el.get('unit', 0) == 0 else 1))
        types = sorted({CODE[c] for c in ft if c in CODE})
        rwy = max([r.get('dimension', {}).get('length', {}).get('value', 0) or 0 for r in x.get('runways') or []] or [0])
        rows.append([x.get('name', '').strip(), x.get('icaoCode') or None, round(lat, 5), round(lon, 5), ftv, types, x.get('type'), round(rwy)])
        n += 1
    print(cc, n)
out = {'src': 'openAIP', 'lic': 'CC BY-NC 4.0', 'upd': datetime.date.today().isoformat(), 'fields': rows}
json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('campi con carburante', len(rows), os.path.getsize(OUT), 'byte')
