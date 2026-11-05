#!/usr/bin/env python3
# HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
# Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
"""Campi di tutta Italia, San Marino, tutta la Francia (Corsica compresa) e delle Alpi vicine (Svizzera, Austria, Slovenia) da OurAirports (pubblico dominio).

Uso:  python3 campi_ourairports.py cartella_con_airports.csv_e_runways.csv
Scrive src/campi.json nel formato di FIELDS_RAW:
  [id, sigla, nome, lat, lon, quota_ft|null, [[le, he, prua_vera, lunghezza_m, asfalto 0/1], ...], tipo]
tipo: aero (aeroporto), ulm (aviosuperficie), alti (altiporto), glac (ghiacciaio).
I campi che ci sono già nello strumento restano come sono: questo elenco li completa soltanto.
"""
import csv, json, re, sys
from pathlib import Path

TIPI = {"small_airport", "medium_airport", "large_airport"}
INTERI = {"IT", "SM", "FR", "MC"}                             # paesi presi interi
ESTERO = {"CH", "AT", "SI"}                                   # Alpi oltre confine: lat 43,6–47,3 · lon 5,8–14,6
PAVED = re.compile(r"asp|con|bit|pem|tar|pav|cem", re.I)
VIA = re.compile(r"\b(aviosuperficie|avio\s?superficie|airfield|airstrip|airport|aeroporto( di)?|aerodromo|aérodrome|aerodrome|altiport|altisurface|flugplatz|flugfeld|letališče|campo( di)? volo|ultralight( field)?|field|ulm|ultraleggeri|club)\b", re.I)
GLAC = re.compile(r"ghiacciaio|glacier|gletscher|\bgh\.", re.I)


def pulito(nome):
    n = VIA.sub(" ", nome)
    n = re.sub(r"\s+", " ", n).strip(" -·,")
    return n or nome.strip()


def num(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def main(cart):
    cart = Path(cart)
    piste = {}
    for r in csv.DictReader(open(cart / "runways.csv", encoding="utf-8")):
        piste.setdefault(r["airport_ident"], []).append(r)
    out = []
    for a in csv.DictReader(open(cart / "airports.csv", encoding="utf-8")):
        if a["type"] not in TIPI or (a["iso_country"] not in INTERI and a["iso_country"] not in ESTERO):
            continue
        lat, lon = num(a["latitude_deg"]), num(a["longitude_deg"])
        if lat is None or lon is None:
            continue
        if a["iso_country"] in ESTERO and not (43.6 <= lat <= 47.3 and 5.8 <= lon <= 14.6):
            continue
        if re.search(r"heli|elisuperficie|eliporto|hospital|ospedale", a["name"], re.I):
            continue
        ident = a["ident"]
        icao = (a["icao_code"] or a["gps_code"] or "").strip()
        aero = bool(re.fullmatch(r"L[IFSOJN][A-Z]{2}", ident) or re.fullmatch(r"L[IFSOJN][A-Z]{2}", icao)) or a["type"] != "small_airport"
        elev = num(a["elevation_ft"])
        nome = pulito(a["name"])
        kind = "aero" if aero else ("glac" if GLAC.search(a["name"]) else ("alti" if (elev and elev > 4000) or re.search(r"altiport|altisurface", a["name"], re.I) else "ulm"))
        sigla = (icao if aero and re.fullmatch(r"L[IFSOJN][A-Z]{2}", icao or "") else (ident if aero and re.fullmatch(r"L[IFSOJN][A-Z]{2}", ident) else nome.upper()))[:13]
        rws = []
        for r in piste.get(ident, []):
            if r.get("closed") == "1":
                continue
            le, he = (r["le_ident"] or "").strip(), (r["he_ident"] or "").strip()
            if not le or le.upper().startswith("H"):
                continue
            L = num(r["length_ft"])
            if not L or L < 150:
                continue
            hdg = num(r["le_heading_degT"])
            if hdg is None:
                d = re.match(r"\d+", le)
                if not d:
                    continue
                hdg = (int(d.group()) * 10 + (1 if a["iso_country"] == "FR" else 3)) % 360   # declinazione: Italia circa +3°, Francia circa +1°
            if not he:
                d = re.match(r"(\d+)([LRC]?)", le)
                if d:
                    n = (int(d.group(1)) + 18 - 1) % 36 + 1
                    he = f"{n:02d}" + {"L": "R", "R": "L", "C": "C"}.get(d.group(2), "")
            rws.append([le, he, round(hdg, 1), round(L * 0.3048), 1 if PAVED.search(r["surface"] or "") else 0])
        out.append([ident, sigla, nome, round(lat, 5), round(lon, 5), int(elev) if elev is not None else None, rws, kind])
    out.sort(key=lambda f: f[0])
    dest = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).resolve().parent / "src" / "campi.json"
    dest.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    from collections import Counter
    print(len(out), "campi", dict(Counter(f[7] for f in out)), "con piste", sum(1 for f in out if f[6]), "->", dest)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else ".")
