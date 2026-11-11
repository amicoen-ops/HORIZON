#!/usr/bin/env python3
# HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
# Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
"""Prepara www/ dell'APK dalla versione telefono costruita da build_android.py (cartella www/ della PWA).
Aggiunge il runtime di Capacitor, così la pagina usa le funzioni native (GLO 2, voce, file, METAR)."""
import shutil, sys
from pathlib import Path
HERE = Path(__file__).resolve().parent.parent
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE.parent / "android" / "www"
DST = HERE / "www"
if DST.exists(): shutil.rmtree(DST)
DST.mkdir()
# carta-web.js e sqlite3.* servono solo alla versione web, ma www/ è la stessa per il sito e per l'APK e sw.js li elenca
# in CORE: se mancassero il sito non si installerebbe più. Dall'APK li toglie la compilazione, dopo «cap sync».
for f in ["index.html", "app.html", "version.js", "regole.js", "carburante.js", "prestazioni.js", "licenza.js", "guida.js", "squadriglia.js", "frequenze.js", "radio.js", "stimati.js", "impostazioni.js", "emergenza.js", "atterraggi.js", "anticipo.js", "livelli.js", "note.js", "schermo.js", "carta.js", "carta-web.js", "sqlite3.js", "sqlite3.wasm", "vento.js", "schede.js", "voce.js", "orologio.js", "ogn.js", "riservato.js", "spazi3d.js", "three.min.js", "LICENZE.txt", "sw.js", "manifest.webmanifest", "icon-192.png", "icon-512.png", "icon-maskable-512.png"]:
    shutil.copy(SRC / f, DST / f)
shutil.copy(HERE / "node_modules/@capacitor/core/dist/capacitor.js", DST / "capacitor.js")
idx = (DST / "index.html").read_text(encoding="utf-8")
tag = '<script src="capacitor.js"></script>\n'
assert "</head>" in idx
if 'src="capacitor.js"' not in idx:                 # già presente: non lo aggiungo una seconda volta
    idx = idx.replace("</head>", tag + "</head>", 1)
(DST / "index.html").write_text(idx, encoding="utf-8")
print("www pronta:", ", ".join(sorted(p.name for p in DST.iterdir())))
