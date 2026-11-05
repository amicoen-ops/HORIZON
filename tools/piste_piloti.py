#!/usr/bin/env python3
# HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
# Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
"""Archivio comune delle piste rilevate dai piloti e dei campi usati.

Uso:  python3 tools/piste_piloti.py posta1.txt [posta2.txt …]
      python3 tools/piste_piloti.py --approva CHIAVE [CHIAVE …]

I file di posta sono il testo delle mail «HORIZON · Pista rilevata» e «HORIZON · Campi usati» (etichetta Gmail
«HORIZON App/Segnalazioni»): si cercano le righe «HORIZON-PISTA {…}» e «HORIZON-CAMPI {…}».

- tools/archivio/segnalazioni.json  tutte le segnalazioni ricevute (una sola per telefono e pista)
- tools/archivio/campi_usati.json   decolli e atterraggi per campo, sommati (per sapere quali sono i più usati)
- tools/archivio/campi_ricevuti.json invii «Campi usati» già contati (telefono e periodo), per non contarli due volte
- tools/archivio/entrate.json       chiavi delle piste già aggiunte alle mappe
- tools/archivio/in_attesa.json     piste viste da meno di 3 telefoni: aspettano il controllo dello sviluppatore
- tools/archivio/approvate.json     chiavi delle piste approvate a mano (--approva)

Una pista è la stessa se il centro è entro 300 m e la direzione entro 12° (le due testate contano uguali).
Entra nelle mappe di tutti se la vedono almeno 3 telefoni diversi, oppure se è stata approvata. Si aggiunge a
FIELDS_RAW di www/index.html e www/app.html: al campo noto (se non ha già una pista con quella direzione)
o come campo nuovo «P-…». La riga di stato dell'app mostra quante piste sono entrate e quando.
"""
import datetime, hashlib, html, json, math, re, statistics, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ARC = ROOT / "tools" / "archivio"
PAGINE = [ROOT / "www" / "index.html", ROOT / "www" / "app.html"]
MIN_TELEFONI = 3


def leggi(p, d):
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else d


def scrivi(p, v):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(v, ensure_ascii=False, indent=1), encoding="utf-8")


def righe(testo, tipo):                                          # testo semplice o HTML: il JSON si legge da dove comincia
    testo = html.unescape(testo); dec = json.JSONDecoder()
    for m in re.finditer(r"HORIZON-" + tipo + r"\s+\{", testo):
        try:
            v, _ = dec.raw_decode(testo, m.end() - 1)
            if isinstance(v, dict): yield v
        except json.JSONDecodeError:
            pass


def dist(a, b):
    la = math.radians((a["lat"] + b["lat"]) / 2)
    return math.hypot((a["lat"] - b["lat"]) * 111195, (a["lon"] - b["lon"]) * 111195 * math.cos(la))


def ddir(a, b):                                                  # differenza di direzione di una pista (0–90°)
    d = abs((a - b) % 180)
    return min(d, 180 - d)


def gruppi(seg):
    G = []
    for s in seg:
        for g in G:
            if dist(s, g[0]) < 300 and ddir(s["hdg"], g[0]["hdg"]) < 12:
                g.append(s); break
        else:
            G.append([s])
    return G


def chiave(g):
    s = g[0]
    return hashlib.sha1(f"{round(s['lat'], 3)},{round(s['lon'], 3)},{round(s['hdg'] % 180 / 10)}".encode()).hexdigest()[:8].upper()


def trova(s):
    i = s.index("const FIELDS_RAW=") + 17
    d = 0; j = i
    while True:
        c = s[j]
        if c == "[": d += 1
        elif c == "]":
            d -= 1
            if d == 0: return i, j + 1
        j += 1


def applica(accettate):
    oggi = datetime.date.today().strftime("%d/%m/%Y")
    for p in PAGINE:
        s = p.read_text(encoding="utf-8")
        i, j = trova(s)
        F = json.loads(s[i:j]); per_id = {f[0]: f for f in F}; nuove = 0
        for g in accettate:
            lat = statistics.median(x["lat"] for x in g); lon = statistics.median(x["lon"] for x in g)
            hdg = round(statistics.median(x["hdg"] % 180 for x in g) + (180 if g[0]["hdg"] >= 180 else 0), 1) % 360
            ln = int(statistics.median(x["len"] for x in g)); el = statistics.median(x["elev"] for x in g if x.get("elev") is not None) if any(x.get("elev") is not None for x in g) else None
            n1 = round(hdg / 10) % 36 or 36; n2 = (n1 + 17) % 36 + 1
            le, he = f"{min(n1, n2):02d}", f"{max(n1, n2):02d}"; lh = hdg if n1 < n2 else (hdg + 180) % 360
            pista = [le, he, round(lh, 1), ln, 0]
            campo = next((x["campo"] for x in g if x.get("campo") in per_id), None)
            if campo:
                f = per_id[campo]
                if any(ddir(r[2], lh) < 15 for r in f[6]): continue
                f[6].append(pista); nuove += 1
            else:
                fid = "P-" + chiave(g)
                if fid in per_id: continue
                f = [fid, "CAMPO " + chiave(g)[:4], "Campo dai piloti", round(lat, 5), round(lon, 5), int(el) if el is not None else None, [pista], "ulm"]
                F.append(f); per_id[fid] = f; nuove += 1
        s = s[:i] + json.dumps(F, ensure_ascii=False, separators=(",", ":")) + s[j:]
        m = re.search(r"const PISTE_PILOTI=\{n:(\d+),data:(null|'[^']*')\};", s)
        if m and nuove:
            s = s[:m.start()] + f"const PISTE_PILOTI={{n:{int(m.group(1)) + nuove},data:'{oggi}'}};" + s[m.end():]
        p.write_text(s, encoding="utf-8")
        print(p.name, "piste entrate:", nuove)


def main(argv):
    seg = leggi(ARC / "segnalazioni.json", []); usati = leggi(ARC / "campi_usati.json", {}); appr = set(leggi(ARC / "approvate.json", []))
    gia = leggi(ARC / "entrate.json", []); ricevuti = set(leggi(ARC / "campi_ricevuti.json", []))
    if argv and argv[0] == "--approva":
        appr |= set(argv[1:]); scrivi(ARC / "approvate.json", sorted(appr)); argv = []
    visti = {(x["dev"], round(x["lat"], 4), round(x["lon"], 4), x["le"]) for x in seg}
    for f in argv:
        t = Path(f).read_text(encoding="utf-8", errors="replace")
        for x in righe(t, "PISTA"):
            if not all(k in x for k in ("dev", "lat", "lon", "le", "hdg", "len")): continue
            k = (x["dev"], round(x["lat"], 4), round(x["lon"], 4), x["le"])
            if k in visti: continue
            visti.add(k); seg.append(x)
        for x in righe(t, "CAMPI"):
            r = f"{x.get('dev')}|{x.get('dal')}|{x.get('al')}"
            if r in ricevuti: continue                           # lo stesso invio letto due volte conta una volta sola
            ricevuti.add(r)
            for cid, c in (x.get("campi") or {}).items():
                u = usati.setdefault(cid, {"d": 0, "a": 0, "telefoni": []})
                u["d"] += int(c.get("d", 0)); u["a"] += int(c.get("a", 0))
                if x.get("dev") not in u["telefoni"]: u["telefoni"].append(x.get("dev"))
    G = gruppi(seg)
    ok, attesa = [], []
    for g in G:
        k = chiave(g); tel = {x["dev"] for x in g}
        if k in gia: continue
        (ok if len(tel) >= MIN_TELEFONI or k in appr else attesa).append(g)
    if ok:
        applica(ok); gia += [chiave(g) for g in ok]
    scrivi(ARC / "segnalazioni.json", seg); scrivi(ARC / "campi_usati.json", usati); scrivi(ARC / "entrate.json", gia)
    scrivi(ARC / "campi_ricevuti.json", sorted(ricevuti))
    scrivi(ARC / "in_attesa.json", [{"chiave": chiave(g), "telefoni": len({x["dev"] for x in g}), "campo": g[0].get("sigla") or g[0].get("campo"),
                                     "lat": g[0]["lat"], "lon": g[0]["lon"], "pista": f"{g[0]['le']}/{g[0]['he']}", "lunghezza_m": g[0]["len"],
                                     "mappa": f"https://www.openstreetmap.org/?mlat={g[0]['lat']}&mlon={g[0]['lon']}#map=17/{g[0]['lat']}/{g[0]['lon']}"} for g in attesa])
    print(f"segnalazioni {len(seg)} · piste distinte {len(G)} · entrate ora {len(ok)} · in attesa {len(attesa)} · campi contati {len(usati)}")
    piu = sorted(usati.items(), key=lambda kv: -(kv[1]["d"] + kv[1]["a"]))[:10]
    if piu: print("campi più usati:", ", ".join(f"{k} {v['d'] + v['a']}" for k, v in piu))
    return len(ok)


if __name__ == "__main__":
    main(sys.argv[1:])
