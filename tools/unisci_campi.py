#!/usr/bin/env python3
# HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
# Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
"""Aggiunge a FIELDS_RAW di www/index.html e www/app.html i campi di campi.json (da campi_ourairports.py).

Uso:  python3 tools/unisci_campi.py campi.json
I campi già presenti restano come sono (sono stati sistemati a mano: piste, quote, nomi); a quelli senza piste o senza
quota si aggiungono soltanto le piste e la quota di OurAirports con la stessa sigla. Si aggiungono i campi con una sigla
nuova e a più di 400 m da un campo che c'è già. Le due pagine restano con lo stesso elenco.
"""
import json, math, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PAGINE = [ROOT / "www" / "index.html", ROOT / "www" / "app.html"]


def trova(s):
    m = re.search(r"const FIELDS_RAW=", s)
    i = m.end(); d = 0; j = i
    while True:
        c = s[j]
        if c == "[": d += 1
        elif c == "]":
            d -= 1
            if d == 0: return i, j + 1
        j += 1


def dist(a, b):
    la = math.radians((a[3] + b[3]) / 2)
    return math.hypot((a[3] - b[3]) * 111195, (a[4] - b[4]) * 111195 * math.cos(la))


def main(nuovi_file):
    nuovi = json.loads(Path(nuovi_file).read_text(encoding="utf-8"))
    for p in PAGINE:
        s = p.read_text(encoding="utf-8")
        i, j = trova(s)
        cur = json.loads(s[i:j])
        ids = {f[0] for f in cur}
        cella = {}
        def chiave(f): return (round(f[3] * 50), round(f[4] * 50))      # celle di circa 2 km per cercare i vicini
        for f in cur: cella.setdefault(chiave(f), []).append(f)
        add = []; compl = 0
        per_id = {f[0]: f for f in cur}
        for f in nuovi:
            if f[0] in ids:
                g = per_id.get(f[0])
                if g is not None:
                    if not g[6] and f[6]: g[6] = f[6]; compl += 1
                    if g[5] is None and f[5] is not None: g[5] = f[5]
                continue
            k = chiave(f)
            vicino = any(dist(f, g) < 400 for dx in (-1, 0, 1) for dy in (-1, 0, 1) for g in cella.get((k[0] + dx, k[1] + dy), []))
            if vicino: continue
            add.append(f); ids.add(f[0]); cella.setdefault(k, []).append(f)
        out = cur + add
        s = s[:i] + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + s[j:]
        p.write_text(s, encoding="utf-8")
        print(p.name, "campi", len(cur), "+", len(add), "=", len(out), "· piste aggiunte a", compl, "campi che non le avevano")


if __name__ == "__main__":
    main(sys.argv[1])
