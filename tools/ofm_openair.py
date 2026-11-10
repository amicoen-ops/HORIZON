#!/usr/bin/env python3
# HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
# Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
"""Spazi aerei da open flightmaps (OFM) in formato OpenAir: fonte di riserva quando openAIP non risponde.

Uso:  python3 tools/ofm_openair.py <file di uscita> [--solo-italia <file>]

Scarica dal ciclo AIRAC in corso (se non c'è ancora, dal precedente) gli export OpenAir di open flightmaps
(variante SeeYou, «isolated»: solo lo spazio aereo di quel Paese) per Italia, e per Francia, Svizzera, Austria e
Slovenia tiene solo gli spazi nella fascia alpina vicina al Nord Italia, come fa l'app con openAIP.
Licenza: OFMA General Users' License (uso anche commerciale, con citazione della fonte; gli errori nei dati si
segnalano a info@openflightmaps.org).
"""
import datetime, io, re, sys, urllib.request, zipfile

BASE = "https://storage.googleapis.com/snapshots.openflightmaps.org/live/{airac}/openair/{reg}/latest/openair_{r2}.zip"
REGIONI = [("li", "Italia", False), ("lf", "Francia", True), ("lsas", "Svizzera", True), ("lovv", "Austria", True), ("ljla", "Slovenia", True)]


def airac(oggi=None, indietro=0):
    """Codice del ciclo AIRAC (es. 2611): cicli di 28 giorni dal 2 gennaio 2020 (ciclo 2001)."""
    oggi = oggi or datetime.date.today()
    d, n = datetime.date(2020, 1, 2), 0
    while d + datetime.timedelta(days=28) <= oggi: d += datetime.timedelta(days=28); n += 1
    d -= datetime.timedelta(days=28 * indietro)
    primo = datetime.date(d.year, 1, 1)
    # numero del ciclo nell'anno: quanti inizi di ciclo ci sono dal 1° gennaio a d
    k, x = 0, d
    while x >= primo: k += 1; x -= datetime.timedelta(days=28)
    return f"{d.year % 100:02d}{k:02d}"


def scarica(reg):
    for ind in (0, 1):
        url = BASE.format(airac=airac(indietro=ind), reg=reg, r2=reg[:2])
        try:
            with urllib.request.urlopen(url, timeout=120) as r: dati = r.read()
            z = zipfile.ZipFile(io.BytesIO(dati))
            nome = next(n for n in z.namelist() if re.search(r"isolated/(" + reg + "|" + reg[:2] + r")\.seeyou\.openair\.txt$", n))
            return z.read(nome).decode("utf-8", "replace"), airac(indietro=ind)
        except Exception as e:
            print(f"OFM {reg} ciclo {airac(indietro=ind)}: {e}", file=sys.stderr)
    return None, None


def nelle_alpi(blocco):
    for m in re.finditer(r"(\d{1,3}):(\d{1,2})(?::(\d{1,2}(?:\.\d+)?))?\s*([NS])[\s,]+(\d{1,3}):(\d{1,2})(?::(\d{1,2}(?:\.\d+)?))?\s*([EW])", blocco):
        la = (int(m[1]) + int(m[2]) / 60 + float(m[3] or 0) / 3600) * (-1 if m[4] == "S" else 1)
        lo = (int(m[5]) + int(m[6]) / 60 + float(m[7] or 0) / 3600) * (-1 if m[8] == "W" else 1)
        if 43.5 <= la <= 47.6 and 5.3 <= lo <= 14.8: return True
    return False


def main(argv):
    out = argv[0]; solo = argv[argv.index("--solo-italia") + 1] if "--solo-italia" in argv else None
    parti, nomi, cicli = [], [], set()
    for reg, nome, filtra in REGIONI:
        t, c = scarica(reg)
        if not t: continue
        cicli.add(c)
        if solo and reg == "li": open(solo, "w", encoding="utf-8").write(t)
        if filtra:
            blocchi = re.split(r"\r?\n(?=AC\s)", t)
            t = "\n".join(b for b in blocchi if b.startswith("AC") and nelle_alpi(b))
            if not t: continue
        parti.append(f"* --- {nome} ---\n{t}"); nomi.append(nome)
    if not parti: print("open flightmaps non raggiungibile: nessun file"); return 1
    # senza l'Italia il file di riserva sembrerebbe buono ma avrebbe solo le Alpi dei vicini: meglio non pubblicarlo
    if "Italia" not in nomi: print("open flightmaps: manca l'Italia, nessun file"); return 1
    testa = ("* open flightmaps · " + ", ".join(nomi) + " · AIRAC " + "/".join(sorted(cicli)) + "\n"
             "* Contains information from the open flightmaps database · OFMA General Users' License\n"
             "* Errori nei dati: info@openflightmaps.org\n")
    open(out, "w", encoding="utf-8").write(testa + "\n".join(parti) + "\n")
    print(f"OFM: {out} · {', '.join(nomi)} · AIRAC {'/'.join(sorted(cicli))} · {sum(p.count(chr(10) + 'AC ') for p in parti)} spazi")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
