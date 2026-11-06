#!/usr/bin/env python3
# HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
# Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
"""Frequenze radio dei campi dello strumento, da OurAirports (pubblico dominio).

Uso:  python3 tools/frequenze_ourairports.py airport-frequencies.csv
(il file si scarica da raw.githubusercontent.com/davidmegginson/ourairports-data/main/airport-frequencies.csv)

Scrive www/frequenze.js: per ogni campo di FIELDS_RAW (www/index.html) che ne ha, l'elenco
[tipo, nome, MHz] con tipo CTAF, Radio, AFIS, TWR, APP, GND, ATIS, FIC (informazioni di volo) e simili.
Si tengono solo le frequenze della banda aeronautica VHF (118,000–136,975 MHz).
Sono dati della comunità: l'app dice sempre di verificarli su AIP e carta prima del volo.
"""
import csv, json, re, sys
from pathlib import Path

RADICE = Path(__file__).resolve().parent.parent
ORDINE = ["CTAF", "UNIC", "RDO", "RADIO", "AFIS", "INFO", "A/G", "TWR", "APP", "GND", "ATIS", "FIC", "FIS"]


def campi():
    t = (RADICE / "www/index.html").read_text(encoding="utf-8")
    m = re.search(r"^const FIELDS_RAW=(\[.*?\]);\s*$", t, re.M)
    return {f[0] for f in json.loads(m.group(1))}


def main(argv):
    ids, out = campi(), {}
    with open(argv[0], encoding="utf-8") as fh:
        for r in csv.DictReader(fh):
            if r["airport_ident"] not in ids: continue
            try: mhz = float(r["frequency_mhz"])
            except ValueError: continue
            if not 118.0 <= mhz <= 136.975: continue
            tipo = (r["type"] or "").strip().upper()[:6] or "FREQ"
            nome = re.sub(r"\s+", " ", (r["description"] or "").strip())[:40]
            v = [tipo, nome, round(mhz, 3)]
            lst = out.setdefault(r["airport_ident"], [])
            if v not in lst: lst.append(v)
    for lst in out.values():
        lst.sort(key=lambda v: (ORDINE.index(v[0]) if v[0] in ORDINE else 50, v[2]))
    testa = ("// HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.\n"
             "// Frequenze dei campi da OurAirports (pubblico dominio), generate da tools/frequenze_ourairports.py.\n"
             "// [tipo, nome, MHz]. Dati della comunità: da verificare su AIP e carta prima del volo.\n")
    corpo = "window.PH_FREQ=" + json.dumps(dict(sorted(out.items())), ensure_ascii=False, separators=(",", ":")) + ";\n"
    (RADICE / "www/frequenze.js").write_text(testa + corpo, encoding="utf-8")
    print(f"frequenze: {len(out)} campi, {sum(len(v) for v in out.values())} frequenze")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
