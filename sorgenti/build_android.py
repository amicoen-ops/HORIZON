#!/usr/bin/env python3
# HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
# Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
"""Costruisce la versione telefono/tablet (PWA) dalle pagine dello strumento e del piano.

  pfd.html         -> www/index.html  (strumento + sensori del telefono + dati locali)
  companion.html   -> www/app.html    (piano, campi, meteo; parla con lo strumento sullo stesso telefono)
  + sw.js, manifest.webmanifest, icone

Le pagine originali non si toccano: ogni modifica è una sostituzione controllata qui sotto,
così quando lo strumento cambia basta rilanciare questo script.
"""
import json, re, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
SRC = HERE / "src"
OUT = HERE / "www_build"
VERSION = "1.0.0"


def rep(s, old, new, count=1, what=""):
    n = s.count(old)
    if n != count:
        sys.exit(f"sostituzione non trovata ({what or old[:60]!r}): {n} occorrenze invece di {count}")
    return s.replace(old, new)


HEAD = """<!doctype html>
<html lang="it"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<meta name="theme-color" content="#07080a">
<meta name="mobile-web-app-capable" content="yes">
<link rel="manifest" href="manifest.webmanifest">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="HORIZON">
<link rel="apple-touch-icon" href="icon-192.png">
<link rel="icon" href="icon-192.png">
<style>[hidden]{display:none!important}</style>
<script src="version.js"></script>
<script src="regole.js"></script>
<script src="carburante.js"></script>
<script src="prestazioni.js"></script>
<script src="licenza.js"></script>
</head><body>
"""


def merge_fields(s):
    """Campi del Nord Italia (src/campi_nord.json, da campi_ourairports.py) aggiunti a quelli dello strumento.
    Quelli che lo strumento ha già restano come sono, con le loro correzioni."""
    m = re.search(r"const FIELDS_RAW=(\[.*?\]);\n", s, re.S)
    assert m, "FIELDS_RAW non trovato"
    old = json.loads(m.group(1)); ids = {f[0] for f in old}
    new = json.loads((SRC / "campi_nord.json").read_text(encoding="utf-8"))
    allf = old + [f for f in new if f[0] not in ids]
    # campi con carburante di openAIP che OurAirports non ha (soprattutto Svizzera e Francia vicine): aggiunti come aeroporti
    fu = json.loads((SRC / "carburante_oa.json").read_text(encoding="utf-8"))["fields"]
    have = {f[0] for f in allf} | {f[1] for f in allf}
    def near(lat, lon):
        return any(abs(f[3] - lat) < 0.014 and abs(f[4] - lon) < 0.02 for f in allf)
    for name, icao, lat, lon, ft, types, typ, rwy in fu:
        if typ in (4, 5, 7, 8) or (icao and icao in have) or near(lat, lon):
            continue
        fid = icao or ("OA-%.3f-%.3f" % (lat, lon))
        nm = " ".join(w.capitalize() if len(w) > 3 else w for w in name.replace('"', '').split())
        allf.append([fid, (icao or nm)[:13], nm, lat, lon, ft, [], "alti" if typ == 13 else "aero"]); have.add(fid)
    return s[:m.start(1)] + json.dumps(allf, ensure_ascii=False, separators=(",", ":")) + s[m.end(1):], len(allf)


def build_pfd():
    s = (HERE / "pfd.html").read_text(encoding="utf-8")
    s, nF = merge_fields(s); print("campi nello strumento del telefono:", nF)
    s = rep(s, "<title>Orizzonte Sintetico</title>", "<title>HORIZON</title>")
    # simulazione di rotta: velocità di crociera e velocità del tempo scelte nella scheda SIMULA
    s = rep(s, "const iasT=flare?ARCS.vs0*1.25:(A?(A.idx>=2?95:(A.idx===1?105:115)):115);", "const iasT=flare?ARCS.vs0*1.25:(A?(A.idx>=2?AC_.vapp:(A.idx===1?AC_.vcirc:SIM_CRUISE)):SIM_CRUISE);")
    s = rep(s, "const warp=S.auto?(NAV.roll?1.5:(NAV.app&&NAV.app.idx>=1?2:4)):1;", "const warp=S.auto?(PH&&PH.sim?(NAV.roll?Math.min(2,PH.sim.warp):PH.sim.warp):(NAV.roll?1.5:(NAV.app&&NAV.app.idx>=1?2:4))):1;")
    # scale di velocità e quota: al massimo 400 tacche, così un valore impossibile non può bloccare il disegno
    s = rep(s, "  for(let v=Math.ceil(vmin/step)*step; v<=vmax; v+=step){", "  for(let v=Math.ceil(vmin/step)*step, nT=0; v<=vmax && nT<400; v+=step, nT++){")
    # mappa da fermo: orientata con la prua (bussola) e scritta PRUA al posto di TRK
    s = rep(s, "ctx.fillText('TRK '+String(Math.round(wrap360(t*R2D))).padStart(3,'0')+'°',CX,ty+bh/2);", "ctx.fillText(pan?'NORD ↑':(S.trk!=null?'TRK ':'PRUA ')+String(Math.round(wrap360(t*R2D))).padStart(3,'0')+'°',CX,ty+bh/2);")
    # zoom della mappa a 19 scale (1-700 km): le soglie dello strumento vanno in km, non nella posizione nella lista
    s = rep(s, "if(zi<=3 || icao || isDest){", "if(ZOOMS[zi]<=15 || icao || isDest){")
    s = rep(s, "if(zi<=2){ ctx.font=font(R*0.04,'700');", "if(ZOOMS[zi]<=8){ ctx.font=font(R*0.04,'700');")
    # oltre 60 km i campi diventano puntini, col nome solo per gli aeroporti fino a 180 km
    s = rep(s, "  for(const f of FIELDS){\n    const p=toS(f.E,f.N); if(!onS(p)) continue;\n",
            "  for(const f of FIELDS){\n    const p=toS(f.E,f.N); if(!onS(p)) continue;\n"
            "    if(ZOOMS[zi]>60 && NAV.dest!==f){ const ic=f.kind==='aero'; ctx.fillStyle=KIND_COL[f.kind]||'#e8f6ee'; ctx.beginPath(); ctx.arc(p.x,p.y,R*(ic?0.011:0.007),0,7); ctx.fill();\n"
            "      if(ic && ZOOMS[zi]<=180){ ctx.font=font(R*0.034,'700'); ctx.textAlign='left'; ctx.lineWidth=3*k; ctx.strokeStyle='rgba(0,0,0,.75)'; ctx.strokeText(f.short,p.x+R*0.016,p.y-R*0.012); ctx.fillText(f.short,p.x+R*0.016,p.y-R*0.012); }\n"
            "      continue; }\n")
    s = rep(s, "const cv=document.getElementById('pfd'), ctx=cv.getContext('2d');",
            "const cv=document.getElementById('pfd'); let ctx=cv.getContext('2d');")
    s = rep(s, "function terrainRaw(E,N){", "function terrainSynth(E,N){")
    s = rep(s, "function toast(msg){", "function toastShow(msg){")
    s = rep(s, "function ask(text,yes,secs){", "function askShow(text,yes,secs){")
    s = rep(s, "function buildApproach(f,pick,ac){", "function buildApproachBase(f,pick,ac){")
    s = rep(s, "tape(-1,S.ias,5,10,R/42,v=>Math.round(v),'km/h',ARCS);",
            "tape(-1,S.ias,5,10,R/42,v=>Math.round(v),PH&&!PH.demo&&!(PH.extAir&&PH.extAir())?'GS km/h':'IAS km/h',PH&&!PH.demo&&!(PH.extAir&&PH.extAir())?null:ARCS);")
    s = rep(s, "tape(1,S.alt,20,100,R/520,v=>Math.round(v),'ft',null,NAV.dest?g.tgtAlt:null);",
            "tape(1,S.alt,20,100,R/520,v=>Math.round(v),PH&&!PH.demo?(PH.extBaro&&PH.extBaro()?'ft QNH':'ft GPS'):'ft',null,NAV.dest?g.tgtAlt:null);")
    # mappa libera: col dito la sposti (nord in alto), lo zoom resta sul punto guardato; «Centra» torna all'aereo
    s = rep(s, "  const ac=enu(S.lat,S.lon), t=((S.trk!=null)?S.trk:S.hdg)*D2R, rng=ZOOMS[zi]*1000;",
            "  const acA=enu(S.lat,S.lon), pan=PH&&PH.pan, ac=pan?{E:acA.E+pan.E,N:acA.N+pan.N}:acA, t=pan?0:((S.trk!=null)?S.trk:S.hdg)*D2R, rng=ZOOMS[zi]*1000;")
    s = rep(s, "  const sc=1.3*R/rng, ax=CX, ay=CY+0.3*R, ct=Math.cos(t), stt=Math.sin(t);",
            "  const sc=1.3*R/rng, ax=CX, ay=CY+(pan?0:0.3*R), ct=Math.cos(t), stt=Math.sin(t); if(PH) PH.mapSc=sc;")
    s = rep(s, "A.legs.forEach((L,i)=>{ if(i<A.idx) return; const a=i===A.idx?{E:ac.E,N:ac.N}:L.a,",
            "A.legs.forEach((L,i)=>{ if(i<A.idx) return; const a=i===A.idx?{E:acA.E,N:acA.N}:L.a,")
    s = rep(s, "  ctx.strokeStyle='rgba(255,255,255,.7)'; ctx.lineWidth=1.5*k; ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(ax,CY-R); ctx.stroke();\n  ctx.save(); ctx.translate(ax,ay); const s=R*0.07;",
            "  const AP=pan?toS(acA.E,acA.N):{x:ax,y:ay}, trR=pan?((S.trk!=null)?S.trk:S.hdg)*D2R:0;\n"
            "  ctx.save(); ctx.translate(AP.x,AP.y); ctx.rotate(trR); ctx.strokeStyle='rgba(255,255,255,.7)'; ctx.lineWidth=1.5*k; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,-R*(pan?0.5:1.3)); ctx.stroke(); ctx.restore();\n"
            "  ctx.save(); ctx.translate(AP.x,AP.y); ctx.rotate(trR); const s=R*0.07;")
    s = rep(s, "  // campi volo\n  ctx.textBaseline='middle';\n  for(const f of FIELDS){",
            "  if(PH){ PH.drawTrack(toS); PH.glideRing(toS,acA,sc); }\n  // campi volo\n  ctx.textBaseline='middle';\n  for(const f of FIELDS){")
    s = rep(s, "ctx.fillStyle='#1d2a1a'; ctx.fillRect(0,0,W,H);",
            "ctx.fillStyle='#1d2a1a'; ctx.fillRect(0,0,W,H); phoneBase(ac,sc,ax,ay,t);")
    s = rep(s, "ctx.fillText('terreno sintetico · campi OurAirports',CX,CY+R*0.82);",
            "ctx.fillText(PH?PH.mapCaption():'terreno sintetico · campi OurAirports',CX,CY+R*0.82,R*1.3);")
    s = rep(s, "  if(PAGE==='pfd') drawPFD(g); else drawMap(g);\n",
            "  if(PAGE==='pfd') drawPFD(g); else drawMap(g);\n  if(PH) PH.afterFrame(g,dt);\n")
    # con la quota GPS il contatto con la pista si riconosce con più tolleranza
    s = rep(s, "if(S.alt*FT2M-f.elev>5) continue;", "if(S.alt*FT2M-f.elev>(PH&&!PH.demo?30:5)) continue;")
    s = rep(s, "<span>PREMI: SÌ · RUOTA: NO</span>", "<span>OK: SÌ · ◀ ▶: NO</span>")
    s = rep(s, "failBox(CX-R*0.79,CY+R*0.42,R*0.28,R*0.1,'IAS');", "failBox(CX-R*0.79,CY+R*0.42,R*0.28,R*0.1,PH&&!PH.demo&&!(PH.extAir&&PH.extAir())?'GS':'IAS');")
    css = (SRC / "phone_pfd.css").read_text(encoding="utf-8")
    s = rep(s, "</style>", css + "</style>", what="fine stile")
    unit_extra = (SRC / "phone_pfd_unit.html").read_text(encoding="utf-8")
    s = rep(s, '  <div class="prompt" id="prompt" hidden>', unit_extra + '  <div class="prompt" id="prompt" hidden>')
    html = (SRC / "phone_pfd.html").read_text(encoding="utf-8")
    s = rep(s, '\n<div class="panel">', "\n" + html + '\n<div class="panel">')
    js = (SRC / "phone_pfd.js").read_text(encoding="utf-8") + "\n" + (SRC / "phone_info.js").read_text(encoding="utf-8") + "\n" + (SRC / "phone_aereo.js").read_text(encoding="utf-8")
    s = rep(s, "// ---------------- avvio ----------------", js + "\n// ---------------- avvio ----------------")
    return HEAD + s + "\n</body></html>\n"


def build_app():
    s = (HERE / "companion.html").read_text(encoding="utf-8")
    s, nF = merge_fields(s); print("campi nel piano del telefono:", nF)
    # giudizio sugli spazi aerei del briefing secondo il tipo di volo (VDS basico, VDS avanzato, VFR): regole in regole.js
    i0 = s.index("    } else if(/^(P)$/.test(a.cls)){ status='bad'; verdict='Area proibita alla tua quota: cambia rotta'; }")
    i1 = s.index("    else { status='ok'; verdict='Alla tua quota, nessun vincolo particolare per la classe'; }", i0)
    i1 = s.index("\n", i1) + 1
    s = s[:i0] + "    } else { const v=IA517_RULES.verdict(a); status=v.status; verdict=v.text; }\n" + s[i1:]
    s = rep(s, "const $=id=>document.getElementById(id);",
            "const $=id=>document.getElementById(id);\n"
            "const PHONE=(()=>{ try{ return window.parent!==window && !!parent.IA517; }catch(e){ return false; } })();")
    s = rep(s, "const CAN_LINK=/^https?:$/", "const CAN_LINK=PHONE || /^https?:$/")
    s = rep(s, "async function api(method,path,body){\n",
            "async function api(method,path,body){\n  if(PHONE) return parent.IA517.api(method,path,body);\n")
    s = rep(s, "ONLINE?'Collegato allo strumento'", "ONLINE?(PHONE?'Su questo telefono':'Collegato allo strumento')")
    s = rep(s, "function renderLiveStatus(s){\n",
            "function renderLiveStatus(s){\n  if(s.rows){ $('status').innerHTML=s.rows.map(([st,a,b])=>`<div class=\"st\"><span class=\"dot\" "
            "style=\"background:var(--${st});box-shadow:none\"></span><b>${a}</b><span class=\"v\">${esc(b)}</span></div>`).join(''); return; }\n")
    s = rep(s, "if(p.lat<35||p.lat>48||p.lon<5||p.lon>19) throw new Error('posizione fuori dall\\'Italia');",
            "if(PHONE?(p.lat<30||p.lat>72||p.lon<-25||p.lon>45):(p.lat<35||p.lat>48||p.lon<5||p.lon>19)) throw new Error('posizione fuori zona');")
    s, n = re.subn(r'<h2>METAR della zona</h2>\s*<div class="sub">Ultimi METAR.*?</div>\s*<div id="metars"></div>\s*</section>',
                   '<h2>Meteo sui campi del piano</h2>\n        <div id="metars"></div>\n      </section>\n'
                   '      <section class="card">\n        <h2>METAR ufficiali</h2>\n        <div id="metarOff"></div>\n      </section>', s, flags=re.S)
    if n != 1:
        sys.exit("sezione METAR non trovata")
    s = s.replace("Anteprima: lo strumento è simulato e i METAR sono quelli reali di oggi alle 14:50 UTC, fermi a quell'ora. "
                  "Sul Raspberry questa pagina si apre dal browser del telefono collegato all'hotspot.",
                  "Pagina del piano aperta da sola: aprila dall'app dello strumento per collegarla.")
    s = rep(s, "<li><b>AIP:Aero</b>: METAR, orientamento delle piste e componenti del vento per gli aeroporti con codice ICAO (Caselle, Biella, Aosta...).</li>",
            "<li><b>METAR ufficiali</b> degli aeroporti (Caselle, Biella, Aosta...): da aviationweather.gov, aperti e incollati qui sotto.</li>")
    s = rep(s, "<li><b>Vento stimato in volo</b> dallo strumento con GPS e Pitot: è quello che decide la pista in avvicinamento.</li>",
            "<li><b>Vento stimato in volo</b> dalle virate, con il GPS del telefono: quando c'è, è quello che decide la pista in avvicinamento.</li>")
    # serbatoi e velocità massime dal velivolo attivo
    s = rep(s, "${PLAN.fuel>73?'<span class=\"pill bad\">Oltre la capienza dei serbatoi (73 L)</span>':''}",
            "${PLAN.fuel>ACP().fuelCap?`<span class=\"pill bad\">Oltre la capienza dei serbatoi (${ACP().fuelCap} L)</span>`:''}")
    s = rep(s, "hc=n.hcFt||800,", "hc=n.hcFt||ACP().hcFt||800,")
    s = rep(s, "vento ${src} ${String(wind.dir).padStart(3,'0')}°/${Math.round(wind.kmh)} km/h:", "vento ${src} ${windDir(wind.dir,1)} · ${Math.round(wind.kmh)} km/h:")
    js = (SRC / "phone_app.js").read_text(encoding="utf-8")
    js += "\n" + (SRC / "phone_route.js").read_text(encoding="utf-8").replace("__RPP__", (SRC / "rpp_nord.json").read_text(encoding="utf-8"))
    s = rep(s, "mergeUserFields(); addRwRow();\n", js + "\nmergeUserFields(); addRwRow();\n")
    return HEAD.replace('<link rel="manifest" href="manifest.webmanifest">\n', "") + s + "\n</body></html>\n"


SW = r"""// Service worker: l'app funziona anche senza internet.
// Pagine: dalla cache e aggiornate in sottofondo. Terreno e mappa: dalla cache appena scaricati.
const V='ia517-app-__VERSION__';
const CORE=['./','index.html','app.html','version.js','regole.js','carburante.js','prestazioni.js','licenza.js','LICENZE.txt','manifest.webmanifest','icon-192.png','icon-512.png'];
// nell'app installata (APK) le pagine sono già sul telefono: si mettono in cache solo terreno, mappe e meteo
const NATIVE=self.location.hostname==='localhost' && self.location.port==='';
self.addEventListener('install',e=>{ e.waitUntil((NATIVE?Promise.resolve():caches.open(V).then(c=>c.addAll(CORE))).then(()=>self.skipWaiting())); });
self.addEventListener('activate',e=>{ e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('ia517-app-')&&k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim())); });
async function trim(name,max){ const c=await caches.open(name), ks=await c.keys(); for(let i=0;i<ks.length-max;i++) await c.delete(ks[i]); }
async function cacheFirst(req,name,max){
  const c=await caches.open(name), hit=await c.match(req); if(hit) return hit;
  const r=await fetch(req); if(r.ok||r.type==='opaque'){ c.put(req,r.clone()); if(max) trim(name,max); } return r;
}
async function networkFirst(req,name){
  const c=await caches.open(name);
  try{ const r=await fetch(req); if(r.ok) c.put(req,r.clone()); return r; }
  catch(e){ const hit=await c.match(req); if(hit) return hit; throw e; }
}
async function staleWhileRevalidate(req){
  const c=await caches.open(V), hit=await c.match(req,{ignoreSearch:true});
  const net=fetch(req).then(r=>{ if(r.ok) c.put(req,r.clone()); return r; }).catch(()=>null);
  return hit||(await net)||new Response('offline',{status:503});
}
self.addEventListener('fetch',e=>{
  const req=e.request; if(req.method!=='GET') return;
  const u=new URL(req.url);
  if(u.searchParams.has('chk')) return;                     // controllo della versione: sempre dalla rete
  if(u.hostname==='s3.amazonaws.com' && u.pathname.includes('/elevation-tiles-prod/')) e.respondWith(cacheFirst(req,'ia517-dem',4000));
  else if(/tile\.opentopomap\.org$|tile\.openstreetmap\.org$/.test(u.hostname)) e.respondWith(cacheFirst(req,'ia517-map',3000));
  else if(u.hostname==='api.open-meteo.com') e.respondWith(networkFirst(req,'ia517-wx'));
  else if(/fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)) e.respondWith(cacheFirst(req,'ia517-fonts',40));
  else if(u.origin===location.origin && !NATIVE) e.respondWith(staleWhileRevalidate(req));
});
"""

MANIFEST = {
    "name": "HORIZON · strumento di volo",
    "short_name": "HORIZON",
    "description": "HORIZON: orizzonte sintetico, mappa, rotte, profilo verticale e circuito per ultraleggeri e aerei VFR — telefono, tablet e browser",
    "lang": "it",
    "start_url": "./index.html",
    "scope": "./",
    "display": "fullscreen",
    "orientation": "any",
    "background_color": "#07080a",
    "theme_color": "#07080a",
    "icons": [
        {"src": "icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
        {"src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
        {"src": "icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"},
    ],
}


def icons():
    from PIL import Image, ImageDraw
    def make(size, pad):
        im = Image.new("RGB", (size, size), (7, 8, 10))
        d = ImageDraw.Draw(im)
        c, r = size / 2, size / 2 - pad
        # orizzonte inclinato dentro il cerchio
        mask = Image.new("L", (size, size), 0); ImageDraw.Draw(mask).ellipse([c - r, c - r, c + r, c + r], fill=255)
        art = Image.new("RGB", (size, size), (79, 90, 44)); ad = ImageDraw.Draw(art)
        import math
        a = math.radians(-14); dx, dy = math.cos(a) * size, math.sin(a) * size
        ad.polygon([(c - dx, c - dy - size * 0.05), (c + dx, c + dy - size * 0.05), (size * 2, -size), (-size, -size)], fill=(46, 112, 200))
        ad.line([(c - dx, c - dy - size * 0.05), (c + dx, c + dy - size * 0.05)], fill=(255, 255, 255), width=max(2, size // 60))
        im.paste(art, (0, 0), mask)
        d.ellipse([c - r, c - r, c + r, c + r], outline=(48, 54, 63), width=max(2, size // 50))
        w = size * 0.2; t = max(3, size // 28)
        d.line([(c - w, c), (c - w * 0.35, c), (c, c + w * 0.3), (c + w * 0.35, c), (c + w, c)], fill=(255, 210, 30), width=t, joint="curve")
        d.ellipse([c - t, c - t, c + t, c + t], fill=(255, 70, 224))
        return im
    make(192, 8).save(OUT / "icon-192.png")
    make(512, 20).save(OUT / "icon-512.png")
    make(512, 70).save(OUT / "icon-maskable-512.png")


def brand(s):
    """Nome dell'app: HORIZON (le pagine di partenza sono quelle dello strumento da 80 mm per l'I-A517)."""
    for a, b in [("<!-- I-A517 Strumento di volo · ©", "<!-- HORIZON · strumento di volo · ©"),
                 ("<title>I-A517 Piano di Volo</title>", "<title>HORIZON · piano di volo</title>"),
                 ('<div class="brand"><b>I-A517</b><span>Strumento 80 mm · telefono</span></div>', '<div class="brand"><b>HORIZON</b><span>piano di volo</span></div>')]:
        s = s.replace(a, b)
    return s


def main():
    OUT.mkdir(exist_ok=True)
    (OUT / "index.html").write_text(brand(build_pfd()), encoding="utf-8")
    (OUT / "app.html").write_text(brand(build_app()), encoding="utf-8")
    (OUT / "regole.js").write_text((SRC / "regole.js").read_text(encoding="utf-8"), encoding="utf-8")
    (OUT / "prestazioni.js").write_text((SRC / "prestazioni.js").read_text(encoding="utf-8"), encoding="utf-8")
    (OUT / "carburante.js").write_text((SRC / "carburante.js").read_text(encoding="utf-8").replace("__FUEL__", (SRC / "carburante_oa.json").read_text(encoding="utf-8")), encoding="utf-8")
    cfg = json.loads((SRC / "licenza_cfg.json").read_text(encoding="utf-8"))
    lic = (SRC / "licenza.js").read_text(encoding="utf-8")
    for k, ph in [("polarOrg", "__POLAR_ORG__"), ("polarApi", "__POLAR_API__"), ("checkout", "__POLAR_CHECKOUT__"), ("portal", "__POLAR_PORTAL__")]:
        if cfg.get(k): lic = lic.replace(ph, cfg[k])
    (OUT / "licenza.js").write_text(lic, encoding="utf-8")
    (OUT / "LICENZE.txt").write_text((ROOT / "LICENSE").read_text(encoding="utf-8") + "\n\n" + (ROOT / "NOTE-TERZE-PARTI").read_text(encoding="utf-8"), encoding="utf-8")
    (OUT / "version.js").write_text(f"window.IA517_BUILD={{version:'{VERSION}',build:'web',channel:'web'}};\n", encoding="utf-8")
    (OUT / "sw.js").write_text(SW.replace("__VERSION__", VERSION), encoding="utf-8")
    (OUT / "manifest.webmanifest").write_text(json.dumps(MANIFEST, ensure_ascii=False, indent=2), encoding="utf-8")
    icons()
    print("ok:", ", ".join(sorted(p.name for p in OUT.iterdir())))


if __name__ == "__main__":
    main()
