#!/usr/bin/env python3
# HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
# Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
# -*- coding: utf-8 -*-
"""
Dossier tecnico di HORIZON (PDF, A4, in italiano): architettura, sensori, schermate, piano, dati senza internet,
moduli nativi, orologio Garmin, licenze, CI/CD, prove, sicurezza, proposte e appendice con il codice.

Uso:  python3 tools/build_dossier_tecnico.py          → docs/dossier/HORIZON-dossier-tecnico.pdf

Le figure stanno in docs/dossier/img/: i diagrammi si rifanno con `node docs/dossier/src/disegna.js` (sorgenti HTML/SVG
in docs/dossier/src/fig-*.html), le schermate con docs/dossier/src/schermate.js (vedi l'intestazione di quel file).
Conteggi delle righe, numeri di riga degli estratti di codice e versione dell'app si leggono dal repository a ogni
esecuzione: il documento resta allineato al codice.
"""
import datetime, glob, html, os, re
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.pdfmetrics import registerFontFamily
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (BaseDocTemplate, CondPageBreak, Frame, HRFlowable, Image, KeepTogether, PageBreak,
                                PageTemplate, Paragraph, Spacer, Table, TableStyle)
from reportlab.platypus.tableofcontents import TableOfContents
from PIL import Image as PILImage

ROOT = Path(__file__).resolve().parent.parent
IMG = ROOT / 'docs' / 'dossier' / 'img'
OUT = ROOT / 'docs' / 'dossier' / 'HORIZON-dossier-tecnico.pdf'

# ---------------- caratteri e colori (gli stessi del manuale dell'app, tools/build_manuale_app.py) ----------------
FD = '/usr/share/fonts/truetype/'
# come il manuale (DejaVu); dove mancano corsivo o condensato si ripiega su un carattere presente
FONTI = {'DV': ['dejavu/DejaVuSans.ttf'], 'DVB': ['dejavu/DejaVuSans-Bold.ttf'],
         'DVI': ['dejavu/DejaVuSans-Oblique.ttf', 'liberation/LiberationSans-Italic.ttf', 'dejavu/DejaVuSans.ttf'],
         'DVC': ['dejavu/DejaVuSansCondensed.ttf', 'liberation/LiberationSansNarrow-Regular.ttf', 'dejavu/DejaVuSans.ttf'],
         'DVCB': ['dejavu/DejaVuSansCondensed-Bold.ttf', 'liberation/LiberationSansNarrow-Bold.ttf', 'dejavu/DejaVuSans-Bold.ttf'],
         'DVM': ['dejavu/DejaVuSansMono.ttf'], 'DVMB': ['dejavu/DejaVuSansMono-Bold.ttf']}
for n, lista in FONTI.items():
    f = next((FD + x for x in lista if os.path.exists(FD + x)), None)
    if not f: raise SystemExit('carattere mancante: ' + lista[0])
    pdfmetrics.registerFont(TTFont(n, f))
registerFontFamily('DV', normal='DV', bold='DVB', italic='DVI', boldItalic='DVB')
registerFontFamily('DVC', normal='DVC', bold='DVCB', italic='DVC', boldItalic='DVCB')
registerFontFamily('DVM', normal='DVM', bold='DVMB', italic='DVM', boldItalic='DVMB')

NAVY = colors.HexColor('#0c447c'); MAG = colors.HexColor('#b0168f'); GREY = colors.HexColor('#5f5e5a')
DG = colors.HexColor('#2c2c2a'); ALT = colors.HexColor('#f4f2ec'); LINE = colors.HexColor('#cfcdc4')
OKC = colors.HexColor('#0f6e56'); AMB = colors.HexColor('#8a5a00'); RED = colors.HexColor('#a32020')
CODEBG = colors.HexColor('#f6f7f9')

H0 = ParagraphStyle('H0', fontName='DVB', fontSize=26, leading=32, textColor=NAVY, alignment=TA_CENTER, spaceAfter=6)
SUB = ParagraphStyle('SUB', fontName='DV', fontSize=11, leading=16, textColor=GREY, alignment=TA_CENTER)
H1 = ParagraphStyle('H1', fontName='DVB', fontSize=16, leading=21, textColor=NAVY, spaceBefore=4, spaceAfter=8)
H2 = ParagraphStyle('H2', fontName='DVB', fontSize=11.6, leading=15, textColor=NAVY, spaceBefore=9, spaceAfter=4)
H3 = ParagraphStyle('H3', fontName='DVB', fontSize=9.8, leading=13, textColor=DG, spaceBefore=6, spaceAfter=2)
B = ParagraphStyle('B', fontName='DV', fontSize=9, leading=13.2, textColor=DG, spaceAfter=4)
BL = ParagraphStyle('BL', parent=B, leftIndent=11, bulletIndent=1, spaceAfter=2)
SM = ParagraphStyle('SM', fontName='DV', fontSize=7.9, leading=10.8, textColor=GREY)
CAP = ParagraphStyle('CAP', fontName='DVI', fontSize=7.8, leading=10, textColor=GREY, alignment=TA_CENTER, spaceBefore=3, spaceAfter=8)
C = ParagraphStyle('C', fontName='DVC', fontSize=7.9, leading=10.4, textColor=DG)
CB = ParagraphStyle('CB', parent=C, fontName='DVCB')
CH = ParagraphStyle('CH', parent=C, fontName='DVCB', textColor=colors.white)
CODE = ParagraphStyle('CODE', fontName='DVM', fontSize=6.9, leading=8.6, textColor=DG, leftIndent=26, firstLineIndent=-26, splitLongWords=1)
CODET = ParagraphStyle('CODET', fontName='DVB', fontSize=8.6, leading=11, textColor=MAG, spaceBefore=8, spaceAfter=2)
TOC1 = ParagraphStyle('TOC1', fontName='DVB', fontSize=9.6, leading=14, textColor=NAVY, leftIndent=4)
TOC2 = ParagraphStyle('TOC2', fontName='DV', fontSize=8.4, leading=11.2, textColor=DG, leftIndent=18)
W = 174 * mm

MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']
OGGI = datetime.date.today()
DATA = f'{OGGI.day} {MESI[OGGI.month - 1]} {OGGI.year}'
INDEX = (ROOT / 'www' / 'index.html').read_text(encoding='utf-8')
_v = re.search(r'PH_CHANGES=\[\s*\["(\d+\.\d+\.\d+)"', INDEX)
VER = _v.group(1) if _v else '1.0.?'


# ---------------- testo: markup minimo ----------------
# Nei testi: <b> <i> <br/> restano; `codice` diventa monospazio; tutto il resto si scappa (così «< 2,5 s» è sicuro).
def mk(t):
    t = html.escape(str(t), quote=False)
    t = re.sub(r'&lt;(/?)(b|i|br/?)&gt;', r'<\1\2>', t)
    return re.sub(r'`([^`]+)`', lambda m: '<font face="DVM" size="7.8" color="#7a1f5c">' + m.group(1) + '</font>', t)


def P(t, st=B): return Paragraph(mk(t), st)
def bullets(items): return [Paragraph(mk(i), BL, bulletText='•') for i in items]
def steps(items): return [Paragraph(mk(i), BL, bulletText=f'{n}.') for n, i in enumerate(items, 1)]


def table(head, rows, widths, hcol=NAVY, mono0=False):
    st0 = ParagraphStyle('c0', parent=CB, fontName='DVM' if mono0 else 'DVCB', fontSize=7.4 if mono0 else 7.9)
    data = [[Paragraph(mk(h), CH) for h in head]] + [[Paragraph(mk(c), st0 if i == 0 else C) for i, c in enumerate(r)] for r in rows]
    t = Table(data, colWidths=widths, repeatRows=1)
    st = [('BACKGROUND', (0, 0), (-1, 0), hcol), ('GRID', (0, 0), (-1, -1), 0.4, LINE), ('VALIGN', (0, 0), (-1, -1), 'TOP'),
          ('LEFTPADDING', (0, 0), (-1, -1), 4), ('RIGHTPADDING', (0, 0), (-1, -1), 4), ('TOPPADDING', (0, 0), (-1, -1), 2.5),
          ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5)]
    for i in range(1, len(data)):
        if i % 2 == 0: st.append(('BACKGROUND', (0, i), (-1, i), ALT))
    t.setStyle(TableStyle(st)); return t


def box(text, bg='#fbeaf0', border='#993556', w=W):
    t = Table([[Paragraph(mk(text), SM)]], colWidths=[w])
    t.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, -1), colors.HexColor(bg)), ('BOX', (0, 0), (-1, -1), 0.6, colors.HexColor(border)),
                           ('LEFTPADDING', (0, 0), (-1, -1), 8), ('RIGHTPADDING', (0, 0), (-1, -1), 8),
                           ('TOPPADDING', (0, 0), (-1, -1), 5), ('BOTTOMPADDING', (0, 0), (-1, -1), 5)]))
    return t


def tip(text, w=W): return box(text, '#e6f1fb', '#185fa5', w)
def warn(text, w=W): return box(text, '#fdf0e0', '#b06d00', w)


# ---------------- figure numerate ----------------
FIGURE = []


def _img(name, w=None, h=None):
    p = IMG / name
    iw, ih = PILImage.open(p).size
    if w is None: w = h * iw / ih
    if h is not None and w * ih / iw > h: w = h * iw / ih
    return Image(str(p), width=w, height=w * ih / iw)


def fig(name, caption, w=W, h=None):
    FIGURE.append(caption); n = len(FIGURE)
    return KeepTogether([_img(name, w, h), Paragraph(mk(f'Figura {n} — {caption}'), CAP)])


def shots(items, w=52 * mm, h=None, numera=True):
    """Riga di schermate (numerate come figure, tranne in copertina): [(file, didascalia), ...]"""
    n = len(items); cw = W / n; cells, caps = [], []
    for f, c in items:
        if numera: FIGURE.append(c)
        cells.append(_img(f, w, h)); caps.append(Paragraph(mk(f'Figura {len(FIGURE)} — {c}' if numera else c), CAP))
    t = Table([cells, caps], colWidths=[cw] * n)
    t.setStyle(TableStyle([('ALIGN', (0, 0), (-1, -1), 'CENTER'), ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                           ('LEFTPADDING', (0, 0), (-1, -1), 2), ('RIGHTPADDING', (0, 0), (-1, -1), 2)]))
    return t


# ---------------- estratti di codice letti dal repository ----------------
CODICI = []


def estratto(rel, ancora, n, titolo, spiegazione, taglia=360):
    path = ROOT / rel
    righe = path.read_text(encoding='utf-8').split('\n')
    rx = re.compile(ancora)
    i = next((k for k, l in enumerate(righe) if rx.search(l)), None)
    if i is None: raise SystemExit(f'estratto non trovato: {rel} · {ancora}')
    pezzo = righe[i:i + n]
    CODICI.append((rel, i + 1, i + len(pezzo)))
    rows = []
    for k, l in enumerate(pezzo):
        l = l.replace('\t', '    ').rstrip()
        if len(l) > taglia: l = l[:taglia] + ' …'
        lead = len(l) - len(l.lstrip(' '))
        corpo = html.escape(l.lstrip(' '), quote=False)
        rows.append([Paragraph(f'<font color="#9aa0a8">{i + 1 + k:>5}</font>&nbsp;&nbsp;' + '&nbsp;' * lead + corpo, CODE)])
    t = Table(rows, colWidths=[W - 4 * mm])
    t.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, -1), CODEBG), ('LINEBEFORE', (0, 0), (0, -1), 2.2, MAG),
                           ('LEFTPADDING', (0, 0), (-1, -1), 5), ('RIGHTPADDING', (0, 0), (-1, -1), 4),
                           ('TOPPADDING', (0, 0), (-1, -1), 0.4), ('BOTTOMPADDING', (0, 0), (-1, -1), 0.4)]))
    return [CondPageBreak(45 * mm), KeepTogether([Paragraph(mk(f'{titolo} · `{rel}:{i + 1}–{i + len(pezzo)}`'), CODET), t,
            Spacer(1, 2), P(spiegazione)])]


def righe_di(rel):
    p = ROOT / rel
    if p.is_dir():
        return sum(righe_di(str(q.relative_to(ROOT))) for q in p.rglob('*') if q.is_file())
    try: return len(p.read_text(encoding='utf-8').splitlines())
    except Exception: return 0


def kb(rel): return f'{(ROOT / rel).stat().st_size / 1024:.0f} KB'


# ---------------- documento con indice, intestazioni e piè di pagina ----------------
class Dossier(BaseDocTemplate):
    def __init__(self, fn, **kw):
        super().__init__(fn, **kw)
        fr = Frame(self.leftMargin, self.bottomMargin, self.width, self.height, id='f', leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
        self.addPageTemplates([PageTemplate('copertina', [fr], onPage=self.copertina),
                               PageTemplate('pagina', [fr], onPage=self.pagina)])
        self.capitolo = ''; self._n = 0

    def beforeDocument(self):
        self._n = 0; self.capitolo = ''

    def afterFlowable(self, f):
        if isinstance(f, Paragraph) and f.style.name in ('H1', 'H2'):
            liv = 0 if f.style.name == 'H1' else 1
            testo = f.getPlainText(); self._n += 1; key = f'k{self._n}'
            self.canv.bookmarkPage(key); self.canv.addOutlineEntry(testo, key, liv, closed=liv > 0)
            self.notify('TOCEntry', (liv, testo, self.page, key))
            if liv == 0: self.capitolo = testo

    def copertina(self, c, d):
        pass

    def pagina(self, c, d):
        c.saveState()
        c.setStrokeColor(LINE); c.setLineWidth(0.5)
        c.line(18 * mm, A4[1] - 11.5 * mm, A4[0] - 18 * mm, A4[1] - 11.5 * mm)
        c.setFont('DV', 7.2); c.setFillColor(GREY)
        c.drawString(18 * mm, A4[1] - 10 * mm, f'HORIZON · dossier tecnico · {DATA}')
        c.drawRightString(A4[0] - 18 * mm, A4[1] - 10 * mm, self.capitolo[:70])
        c.line(18 * mm, 13 * mm, A4[0] - 18 * mm, 13 * mm)
        c.drawString(18 * mm, 9 * mm, "© 2026 Enrico D'Amico · Tutti i diritti riservati")
        c.drawRightString(A4[0] - 18 * mm, 9 * mm, f'pagina {d.page}')
        c.restoreState()


def chap(n, title): return [PageBreak(), Paragraph(f'{n}. {mk(title)}', H1)]
def sec(title): return [CondPageBreak(30 * mm), Paragraph(mk(title), H2)]


s = []
# =====================================================================================================
# COPERTINA
# =====================================================================================================
s += [Spacer(1, 14 * mm), Paragraph('HORIZON', H0), Paragraph('Dossier tecnico', ParagraphStyle('t2', parent=H0, fontSize=17, leading=22, textColor=MAG)),
      Spacer(1, 3 * mm),
      Paragraph(mk('Strumento di volo per ultraleggeri e piloti VFR · app Android (Capacitor), versione web per iPhone e browser, '
                   'HORIZON 2 con l\'orologio Garmin, automazioni su GitHub Actions'), SUB),
      Spacer(1, 2 * mm), Paragraph(mk(f'Codice del ramo principale al {DATA} · ultima versione nelle novità dell\'app: {VER}'), SUB),
      Spacer(1, 8 * mm),
      shots([('sch-pfd.png', 'Orizzonte (volo dimostrativo)'), ('sch-mappa.png', 'Mappa mobile (senza tessere)'),
             ('sch-piano.png', 'Piano di volo')], 48 * mm, numera=False),
      Spacer(1, 6 * mm),
      box('<b>Documento tecnico.</b> Descrive come è fatto il software HORIZON e come funziona, leggendo il codice del repository: '
          'architettura, sensori, schermate, dati, moduli nativi, orologio, licenze, compilazione e collaudo. Non è un manuale d\'uso: '
          'quello è il «Manuale dell\'app». HORIZON è uno strumento sperimentale, non certificato: il pilota in comando resta l\'unico responsabile del volo.'),
      Spacer(1, 4 * mm),
      Paragraph(mk("© 2026 Enrico D'Amico · Tutti i diritti riservati · horizonlicenses@gmail.com"), SUB)]

# INDICE
toc = TableOfContents(); toc.levelStyles = [TOC1, TOC2]; toc.dotsMinLevel = 0
s += [PageBreak(), Paragraph('Indice', ParagraphStyle('IX', parent=H1)), toc]

# =====================================================================================================
# 2. PANORAMICA E ARCHITETTURA
# =====================================================================================================
s += chap(1, 'Panoramica e architettura')
s += [P('HORIZON porta sul telefono lo strumento da 80 mm nato per un Avid Flyer: orizzonte sintetico con terreno vero, mappa mobile, '
        'navigazione con circuito e atterraggio, avvisi di terreno, spazi aerei, tramonto e traffico, piano di volo con meteo e briefing, '
        'diario di volo. Il codice è quasi tutto JavaScript in due pagine HTML (`www/index.html`, lo strumento, e `www/app.html`, il Piano) '
        'più una ventina di moduli in `www/`; la parte Android aggiunge pochi moduli nativi in Java per quello che il browser non sa fare '
        '(Bluetooth seriale, bussola di Android, UDP, carta VFR in SQLite, firma dell\'app e Play Billing, aggiornamenti, stato del telefono).'),
      P('Lo stesso codice gira in tre forme: come app Android (Capacitor impacchetta `www/` dentro un\'APK), come sito su GitHub Pages '
        '(PWA, da aggiungere alla schermata Home su iPhone) e come «HORIZON 2», un\'app Android a parte con il collegamento all\'orologio Garmin. '
        'Le differenze tra le versioni le decide `www/version.js`, scritto dai workflow con il campo `channel` (`apk`, `play`, `web`, `h2`).')]
s += sec('1.1 Canali di distribuzione')
s += [table(['Canale', 'Come arriva al pilota', 'channel', 'Cosa cambia'], [
    ['APK da GitHub', 'Release «HORIZON 1.0.N» (tag `build-N`), installazione a mano sopra la precedente', 'apk',
     'Permesso `REQUEST_INSTALL_PACKAGES` aggiunto in compilazione; aggiornamenti dall\'app (`UpdaterPlugin.apkDownload/apkInstall`, '
     'controllo su `api.github.com/…/releases/latest`); donazione PayPal'],
    ['Google Play', 'AAB caricato da solo nel canale «Test interni»; la Produzione si pubblica a mano', 'play',
     'Niente permesso di installare pacchetti; aggiornamento con Play In-App Updates (`playCheck`, `playStart`); «Offrimi un caffè» con Play Billing (prodotto `caffe`)'],
    ['Web / iPhone (PWA)', '`amicoen-ops.github.io/HORIZON`, su iPhone Safari › Condividi › Aggiungi alla schermata Home', 'web',
     'Nessun modulo nativo: GLO 2 con Web Serial dove c\'è, carta VFR con il worker sqlite-wasm, IGM e ortofoto non disponibili (servizio solo http); '
     'aggiornamento proposto confrontando l\'impronta in `version.js?chk=…`'],
    ['HORIZON 2 (prova)', 'Release pre-release `horizon2-N`; app `it.amicoen.horizon2` che si installa accanto a HORIZON', 'h2',
     'Stesso `www/` più il modulo `GarminPlugin` (compilazione `-Ph2`) e l\'app «HORIZON Link» per fenix 7 / epix 2; mai su Play'],
], [27 * mm, 50 * mm, 15 * mm, 82 * mm])]
s += sec('1.2 Come Capacitor impacchetta www/')
s += bullets([
    '`capacitor.config.json`: `webDir` = `www`, `androidScheme` = `https` (la pagina ha origine `https://localhost`), `cleartext:false`, '
    '`allowMixedContent:true` (serve solo al WMS http del Geoportale), `captureInput:true`, `webContentsDebuggingEnabled:false` '
    '(acceso solo nell\'APK di collaudo per l\'emulatore).',
    '`npx cap sync android` copia `www/` negli asset dell\'app e collega i plugin npm: `@capacitor/filesystem`, `@capacitor/share`, '
    '`@capacitor-community/keep-awake`, `@capacitor-community/text-to-speech` (Capacitor 8.6.0).',
    '`MainActivity` registra i 7 plugin nativi del progetto e, solo se la classe esiste (HORIZON 2), `GarminPlugin` con `Class.forName`; '
    'imposta `setTextZoom(100)` (il carattere ingrandito di sistema non deve rompere lo strumento), `FLAG_KEEP_SCREEN_ON` e lo schermo intero immersivo.',
    'In pagina `PH.native` vale `null` nel browser; nell\'app contiene i riferimenti ai plugin (`TextToSpeech`, `KeepAwake`, `Filesystem`, `Share`, '
    '`CapacitorHttp`, `GloSerial`, `Compass`, `Updater`). `IA517.http(url)` usa `CapacitorHttp` nell\'app (niente limiti CORS) e `fetch` con 12 s di timeout nel browser.',
    'Nella versione web il workflow toglie `capacitor.js` e il suo tag `<script>`; `sw.js` riconosce l\'app (host `localhost` senza porta) e non mette in cache le pagine, che sono già nell\'APK.',
    'Origine storica: `index.html` è lo strumento del Raspberry Pi con la scheda sensori XIAO; la sezione «VERSIONE TELEFONO / TABLET» ridefinisce le funzioni '
    '(per esempio `linkStart()` diventa una funzione vuota) e `PH.handle` risponde alle stesse richieste REST che il Piano faceva al servizio del Raspberry.'])
s += [fig('fig-architettura.png', 'Architettura dei componenti: pagine e moduli JavaScript nella WebView, moduli nativi Java, sensori e '
          'dispositivi esterni, servizi in rete, GitHub (Actions, Release, Pages, ramo «licenze») e la casella Gmail con lo script di sveglia.')]
s += sec('1.3 Il ciclo dello strumento')
s += [P('Lo strumento disegna con `requestAnimationFrame(frame)`: `frame()` limita i fotogrammi a `PH.fps` (30 di serie, `ia517p_fps`), misura il '
        'tempo di disegno, registra i blocchi oltre 1,5 s e chiama `frameBody` → `drawPFD` o `drawMap`. Un errore di disegno non ferma il ciclo: '
        'il fotogramma successivo è già prenotato e a schermo compare «ERRORE DI VISUALIZZAZIONE». Prima di ogni fotogramma `PH.sane()` '
        'riporta a valori sicuri i numeri impossibili (quota oltre 60.000 ft, assetto non numerico…). `PH.afterFrame` fa il resto con tre ritmi:'),
      table(['Ritmo', 'Cosa fa'], [
          ['ogni fotogramma', 'schermo diviso del tablet (`PH.drawSplit`), traffico sulla mappa e triangolo di pericolo (`PH.trfMap`, `PH.trfDraw`)'],
          ['ogni 0,5 s', 'caselle dei dati e riga di stato (`PH.info`), tasti dello zoom, zoom salvato'],
          ['ogni 1 s', 'campi vicini, spazio aereo attuale (`PH.renderAsp`), simulazione (`PH.simTick`), vento previsto, avvisi di terreno, spazi aerei e tramonto, traffico (`PH.trfTick`)'],
          ['ogni 5 s', 'stato del telefono (`PH.statoPoll`: batteria, rete, satelliti)'],
          ['eventi', 'sensori di movimento, GPS, bussola, GLO 2, GDL90 e orologio arrivano quando arrivano e aggiornano lo stato `S`'],
      ], [28 * mm, 146 * mm]),
      P('Lo stato del volo è l\'oggetto globale `S` (`pitch`, `roll`, `hdg`, `trk`, `gs`, `ias`, `alt`, `vs`, `slip`, `lat`, `lon`, `gpsReal`, `sats`, `hdop`…), '
        'esposto anche come `window.phS` per il Piano. Le scadenze sono in `STALE` (assetto 0,7 s; velocità e quota 2,5 s; GPS 3,5 s) e i tempi '
        'dell\'ultimo dato in `LIVE`: se un dato scade, `drawFailFlags` copre la scala con una X rossa e una bandierina («ASSETTO NON DISPONIBILE», «GPS PERSO»): '
        'mai un valore congelato.')]

# =====================================================================================================
# 3. MAPPA DEL REPOSITORY
# =====================================================================================================
s += chap(2, 'Mappa del repository')
s += [P('Righe contate al momento della generazione di questo documento. I file vendorizzati (librerie di terze parti) sono indicati come tali e '
        'non sono descritti oltre.')]
REPO = [
    ('www/index.html', 'Strumento: orizzonte, mappa, sensori, filtri, avvisi, navigazione, circuito, diario, traffico, impostazioni, Info'),
    ('www/app.html', 'Piano (iframe): rotte, campi, meteo, METAR/TAF, NOTAM, spazi aerei openAIP/OFM, briefing, Calcola rotta, profilo'),
    ('www/regole.js', 'Regole per tipo di volo (VDS basico, avanzato, VFR; DPR 133/2010), giudizio sugli spazi aerei'),
    ('www/carburante.js', 'Carburante e alternati in tre fasce (comodo, riserva, critico), campi con carburante'),
    ('www/prestazioni.js', 'Salita e discesa per quota di densità e peso, giri di 360°, salita graduale'),
    ('www/licenza.js', 'Codice del telefono, prova e abbonamento (spenti: `abbonamento:false`), «Offrimi un caffè»'),
    ('www/riservato.js', 'Menu riservato: codice del telefono, richiesta, verifica del codice HZ1 (ECDSA), revoche'),
    ('www/guida.js', 'Guida in linea, tour guidato, catalogo dei velivoli, «Prima del volo», check list a fasi'),
    ('www/impostazioni.js', 'Impostazioni ordinate e pieghevoli, «Prima di partire», «In volo», tasti grandi'),
    ('www/schede.js', 'Caselle dei dati a scelta (completa e semplice, al massimo 8)'),
    ('www/schermo.js', 'Tema «pieno sole», tablet: schermo diviso regolabile, tocco per scambiare'),
    ('www/livelli.js', 'Livelli della mappa e disegno degli spazi aerei e dei NOTAM sulla mappa'),
    ('www/emergenza.js', 'Zona di planata vera, campi raggiungibili, modo EMERGENZA e MAYDAY'),
    ('www/vento.js', 'Vento sulla pista (componenti), METAR sulla mappa, pagina del vento'),
    ('www/voce.js', 'Voce su richiesta, check list a voce, METAR a voce, scadenze, rivedi un volo in 3D'),
    ('www/radio.js', 'Chiamata radio nel circuito e pagina FREQUENZE'),
    ('www/frequenze.js', 'Frequenze dei campi (generato da `tools/frequenze_ourairports.py`)'),
    ('www/stimati.js', 'Riporto di posizione, ETA/ATA in UTC, autonomia'),
    ('www/note.js', 'Punti VFR sulla mappa e NOTE ENTE (QNH, squawk, readback)'),
    ('www/squadriglia.js', 'Aerei amici riconosciuti nel traffico'),
    ('www/carta.js', 'Carta VFR open flightmaps: plugin nativo o worker web, ciclo AIRAC'),
    ('www/carta-web.js', 'Worker della carta VFR: sqlite-wasm + OPFS'),
    ('www/orologio.js', 'Orologio Garmin (attivo solo con il modulo nativo di HORIZON 2)'),
    ('www/spazi3d.js', 'Vista 3D degli spazi aerei e voli rivisti (three.js)'),
    ('www/sw.js', 'Service worker: cache per l\'uso senza internet'),
    ('www/version.js', 'Versione e canale (riscritto dai workflow)'),
    ('www/capacitor.js', 'Runtime di Capacitor (generato, vendorizzato)'),
    ('www/sqlite3.js', 'sqlite-wasm 3.53.4 (vendorizzato, Apache-2.0)'),
    ('www/three.min.js', 'three.js r160 (vendorizzato, MIT)'),
    ('android/app/src/main/java/it/amicoen/horizon', '10 classi Java: MainActivity e 9 file dei plugin (Gdl90Parser compreso)'),
    ('android/app/src/h2/java/it/amicoen/horizon/GarminPlugin.java', 'Orologio Garmin (solo HORIZON 2, `-Ph2`)'),
    ('android/app/build.gradle', 'Compilazione, firma, variante H2 (`applicationId` horizon2, SDK Connect IQ 2.4.0)'),
    ('garmin/source/HorizonApp.mc', 'App per l\'orologio: sensori, messaggi, tasti, scatola nera'),
    ('garmin/source/HorizonView.mc', 'Schermata dell\'orologio e gestione dei tasti'),
    ('garmin/manifest.xml', 'Manifest Connect IQ (fenix 7/7S/7X, Pro, epix 2; permessi)'),
    ('.github/workflows', '8 workflow (vedi capitolo 10)'),
    ('tools/test_assetto.js', 'Banco di prova dell\'assetto sul codice vero di index.html'),
    ('tools/registrazioni', '2 registrazioni vere dei sensori (Samsung S23 FE)'),
    ('tools/emu_test.sh', 'Collaudo dell\'APK sull\'emulatore (adb)'),
    ('tools/emu_cdp.py', 'Collaudo nella WebView via DevTools (CDP)'),
    ('tools/licenze.py', 'Chiavi ECDSA, genera e verifica i codici HZ1'),
    ('tools/licenze_azione.py', 'Azioni a mano del workflow Licenze (genera, revoca, ripristina, manda)'),
    ('tools/posta_licenze.py', 'Posta delle licenze: prezzi, codici, piste, riepilogo (IMAP/SMTP)'),
    ('tools/registro_unisci.py', 'Unione di due copie del registro delle licenze'),
    ('tools/gmail-licenze/HORIZON-Licenze.gs', 'Apps Script: sveglia ogni minuto, promemoria nel Calendar'),
    ('tools/piste_piloti.py', 'Archivio comune delle piste rilevate e dei campi usati'),
    ('tools/campi_ourairports.py', 'Campi da OurAirports (Italia, Francia, Alpi)'),
    ('tools/unisci_campi.py', 'Unisce i campi nuovi a `FIELDS_RAW` delle due pagine'),
    ('tools/frequenze_ourairports.py', 'Genera `www/frequenze.js`'),
    ('tools/ofm_openair.py', 'Spazi aerei open flightmaps in OpenAir (riserva notturna)'),
    ('tools/confronta_spazi.py', 'Confronto openAIP / open flightmaps'),
    ('tools/carburante_openaip.py', 'Campi con carburante da openAIP → `dati/carburante.json`'),
    ('tools/prepare_www.py', 'Prepara `www/` dai sorgenti esterni (ramo v2) con il runtime Capacitor'),
    ('tools/build_manuale_app.py', 'Manuale dell\'app in PDF'),
    ('tools/build_dossier_tecnico.py', 'Questo documento'),
    ('.claude/skills/horizon/SKILL.md', 'Mappa del progetto e regole di lavoro'),
    ('README.md', 'Presentazione, canali, struttura, licenza'),
    ('PRIVACY.md', 'Informativa sulla privacy'),
]
rows = []
for rel, uso in REPO:
    p = ROOT / rel
    if not p.exists(): continue
    rows.append([rel, uso, f'{righe_di(rel):,}'.replace(',', '.') if not rel.endswith(('sqlite3.js', 'three.min.js', 'capacitor.js')) else f'{righe_di(rel):,} ({kb(rel)})'.replace(',', '.')])
s += [table(['File o cartella', 'A cosa serve', 'Righe'], rows, [62 * mm, 92 * mm, 20 * mm], mono0=True)]
s += [Spacer(1, 3 * mm), P('Altre cartelle: `docs/play/` (scheda e immagini del Play Store, note per i tester in `docs/play/novita/whatsnew-it-IT`), '
      '`docs/licenze/` (immagine dei passi di pagamento usata nella mail dei prezzi), `docs/garmin/` (immagini per lo store Connect IQ), '
      '`docs/dossier/` (questo documento, figure e sorgenti), `keystore/strumento.keystore.enc` (chiave di firma cifrata), '
      '`garmin/devkey.der.enc` (chiave da sviluppatore Garmin cifrata).')]
s += sec('2.1 Servizi esterni chiamati dall\'app')
s += [table(['Servizio', 'Indirizzo', 'A cosa serve', 'Quando'], [
    ['Open-Meteo', '`api.open-meteo.com/v1/forecast`', 'Meteo del modello sui campi (vento, nubi) e controllo della rotta alle quote (1000–700 hPa)', 'Piano: al cambio dei campi (al più ogni 20 min) e a richiesta; cache «network first» nel service worker'],
    ['aviationweather.gov', '`/api/data/metar`, `/api/data/taf`', 'METAR e TAF dei campi vicini alla rotta (fino a 14 stazioni)', 'Piano, solo dentro lo strumento (`IA517.http`), al più ogni 10 min'],
    ['openAIP', '`storage.openaip.net/openaip-system-exports/xx_asp_v2.txt`, `api.core.openaip.net`', 'Spazi aerei Italia + fascia alpina (Francia, Svizzera, Austria, Slovenia); API con chiave del pilota come ripiego', 'A ogni ciclo AIRAC o a richiesta; sul web dalla copia notturna `dati/`'],
    ['open flightmaps', '`storage.googleapis.com/snapshots.openflightmaps.org/live/AIRAC/…`', 'Carta VFR MBTiles (≈ 105 MB) e, dalla copia notturna, spazi aerei di riserva', 'Scarico a mano della carta; spazi dal workflow notturno'],
    ['AWS Terrain Tiles', '`s3.amazonaws.com/elevation-tiles-prod/terrarium/z/x/y.png`', 'Rilievo (TAWS, orizzonte 3D, quote dei campi, rotte)', 'Continuamente attorno all\'aereo; cache «cache first» (4000 tessere)'],
    ['Tessere della mappa', '`tile.opentopomap.org`, `tile.openstreetmap.org`, `ibasemaps-api.arcgis.com` (Esri, con chiave), `wms.pcn.minambiente.it` (IGM, ortofoto, solo app)', 'Mappa di base', 'Mentre la mappa è visibile; «Scarica per il volo» prepara le zone'],
    ['OGN', '`live.glidernet.org/lxml.php`', 'Traffico FLARM/OGN', 'Ogni 6 s in volo o con la pagina TRAFFICO aperta, se il GDL90 tace; zona arrotondata a 0,1°'],
    ['adsb.lol', '`api.adsb.lol/v2/point/lat/lon/20`', 'Traffico ADS-B/MLAT', 'Come OGN'],
    ['Overpass (OSM)', '`overpass-api.de/api/interpreter`', 'Nomi di paesi, laghi e cime per i punti disegnati', 'Quando si disegna una rotta (riquadro arrotondato a 0,1°)'],
    ['Web3Forms', '`api.web3forms.com/submit`', 'Segnalazioni, registrazioni dei sensori, piste e campi condivisi, richieste di licenza', 'Su azione del pilota (piste e campi solo con consenso, a terra)'],
    ['FormSubmit', '`formsubmit.co/ajax/…`', 'Riserva di Web3Forms (usata solo se la chiave Web3Forms è vuota)', 'Come sopra'],
    ['GitHub API', '`api.github.com/repos/amicoen-ops/HORIZON/releases/latest`', 'Controllo degli aggiornamenti (solo APK di GitHub)', 'All\'avvio con la rete e da Info › Aggiornamenti'],
    ['GitHub raw', '`raw.githubusercontent.com/amicoen-ops/HORIZON/licenze/licenze/revocate.json`', 'Licenze revocate', '15 s dopo l\'avvio (al più una volta al giorno) e all\'apertura del menu riservato'],
    ['Sito HORIZON', '`amicoen-ops.github.io/HORIZON/dati/carburante.json`, `version.js?chk=`', 'Campi con carburante; nuova versione web', 'Una volta al giorno; all\'avvio (solo web)'],
    ['Desk Aeronautico', '`www.deskaeronautico.it`', 'Solo collegamenti (NOTAM, meteo, briefing): i NOTAM si incollano nel Piano', 'Su tocco del pilota'],
    ['Google Fonts', '`fonts.googleapis.com`', 'Caratteri Barlow Semi Condensed e Oxanium (Piano)', 'All\'apertura, poi dalla cache'],
], [24 * mm, 48 * mm, 54 * mm, 48 * mm])]

# =====================================================================================================
# 4. SENSORI E ACQUISIZIONE DEI DATI
# =====================================================================================================
s += chap(3, 'Sensori e acquisizione dei dati')
s += [P('È la parte più delicata dello strumento: tutto quello che il pilota vede viene da qui. Ogni sensore arriva per una strada sua (API del browser, '
        'evento di un plugin nativo, messaggio dell\'orologio), viene trasformato da una funzione precisa e finisce nello stato `S`, da cui leggono '
        'disegno, caselle e avvisi. La tabella riassume; le sezioni seguenti entrano nel dettaglio.'),
      table(['Sensore', 'Sorgente / evento', 'Frequenza', 'Funzione', 'Dove finisce'], [
          ['GPS del telefono', '`navigator.geolocation.watchPosition` (alta precisione, `maximumAge 0`)', '≈ 1 Hz (dal telefono)', '`PH.onPos` → `PH.fixIn`', '`S.lat/lon/gs/trk/alt/vs`, diario, vento'],
          ['Garmin GLO 2', '`GloSerialPlugin` evento «nmea» (web: Web Serial)', 'gruppi ogni 100 ms; fix 1–10 Hz', '`PH.gloLine` → `PH.fixIn`', 'come sopra, `S.sats`, `S.hdop`'],
          ['Orologio Garmin', '`GarminPlugin` evento «dati»', '≈ 1 Hz', '`dati()` in `orologio.js` → `PH.fixIn`', 'come sopra; quota baro; bussola'],
          ['Accelerometro e giroscopio', 'evento `devicemotion`', '60–200 Hz', '`PH.onMotion` (Mahony)', '`S.roll/pitch/slip/hdg`, vario'],
          ['Bussola', '`CompassPlugin` «rot» (20 Hz) o `deviceorientation(absolute)`', '≤ 20 Hz', '`PH.magFromR`', '`PH.mag.hdg` → `S.hdg` a terra'],
          ['Barometro del telefono', '`BarometroPlugin` evento «p» {hPa} (`TYPE_PRESSURE`)', '≈ 5 Hz', '`PH.baroIn` → `PhVario.correct`', '`S.alt`, `S.vs`; scarto tenuto giusto dal GPS'],
          ['Quota e vario', 'barometro del telefono se c\'è, altrimenti GPS; accelerazione verticale; barometro dell\'orologio (corretto)', 'fix + eventi di moto', '`PhVario`', '`S.alt`, `S.vs`'],
          ['Traffico GDL90', '`Gdl90Plugin` evento «traffico» (UDP 4000)', 'per pacchetto', '`PH.gdlIn` → `PH.trfEval` (1 Hz)', '`PH.TRF.tg`, triangolo, mappa'],
          ['Stato del telefono', '`StatoTelefonoPlugin.get()`', 'ogni 5 s', '`PH.statoPoll`', 'riga di stato, qualità GPS'],
      ], [24 * mm, 46 * mm, 24 * mm, 34 * mm, 46 * mm])]
s += sec('3.1 Posizione: GPS del telefono, Garmin GLO 2, orologio')
s += [P('Ogni fonte produce un oggetto «fix» con la stessa forma: `{src, lat, lon, msl, speed, heading, acc, t, recv}` (più `sats` e `hdop` per il GLO 2). '
        '`acc` è la precisione stimata in metri ed è il criterio di scelta. Tutte le fonti passano da `PH.fixIn(fx)`, che memorizza il fix in '
        '`PH.fixes[src]` e lo applica solo se `PH.srcPick()` dice che quella è la fonte in uso.'),
      fig('fig-gps.png', 'Fonti di posizione e scelta della migliore: dal fix di ogni fonte a `PH.fixIn`, `PH.srcPick` e `PH.applyFix`, fino a chi legge lo stato `S`.')]
s += [Paragraph('GPS del telefono', H3)]
s += bullets(['Avvio in fondo alla parte telefono: `watchPosition(PH.onPos, PH.onPosErr, {enableHighAccuracy:true, maximumAge:0, timeout:15000})`.',
              'La quota del browser è sull\'ellissoide WGS84: `PH.onPos` sottrae un geoide fisso `PH.geoid` (47 m di serie, `ia517p_geoid`), poi la taratura sul campo corregge il resto.',
              'Con il plugin `StatoTelefono` (solo APK) la riga di stato mostra quanti satelliti sono usati nel fix (da `GnssStatus`) e la colora: verde se ≥ 7 satelliti e precisione ≤ 15 m (`PH.GPS_Q`).'])
s += [Paragraph('Garmin GLO 2', H3)]
s += bullets(['App Android: `GloSerialPlugin.connect({address})` apre un socket RFCOMM verso l\'UUID SPP `00001101-…`, prima cifrato e poi, se fallisce, '
              '«insecure». Un thread legge le righe ASCII che iniziano con `$` e le manda in gruppi (evento «nmea» `{lines:[…]}`) ogni 100 ms o ogni 40 righe. '
              'Se il collegamento cade arriva l\'evento «state» `{connected:false, error}`. Il permesso `BLUETOOTH_CONNECT` è chiesto al primo uso.',
              'Browser: `navigator.serial.requestPort` con il filtro sulla classe SPP, `port.open({baudRate:115200})`, lettura in streaming con `TextDecoder`.',
              '`PH.gloLine` controlla il checksum NMEA, tiene l\'ultima GGA (qualità, satelliti, HDOP, quota MSL) e, a ogni RMC valida (stato A), crea il fix `glo` '
              'con velocità in nodi × 0,514444 e `acc = max(2,5 m, HDOP × 3)` (8 m se manca una GGA fresca). Ogni 5 s, se il pilota lo vuole, si ritenta il collegamento.'])
s += [Paragraph('Orologio Garmin (HORIZON 2)', H3)]
s += bullets(['`orologio.js` si attiva solo se `Capacitor.isPluginAvailable(\'Garmin\')`. Dei dati dell\'orologio usa la posizione solo con qualità ≥ 2 e stima '
              'la precisione dalla qualità Garmin: 4 → 4 m, 3 → 10 m, 2 → 25 m, 1 → 60 m (`QM`).',
              'Se «Quota dal barometro» è accesa (di serie sì), la quota del fix è barometrica: `44330,77 · (1 − ((p + pOfs) / (QNH·100))^0,190263)` con la pressione `p` in Pa e il QNH dello strumento. '
              '`pOfs` è lo scarto del barometro dell\'orologio imparato dal barometro del telefono quando sono freschi tutti e due (media sulle prime 30 letture, poi circa 5 minuti; salvato in `ia517p_fenix_pofs`). '
              'Misurato: fenix 7 −4,4 hPa (circa 37 m); la calibrazione dell\'orologio non lo toglie.',
              'Il capitolo 8 descrive il protocollo completo.'])
s += [Paragraph('Scelta della fonte: PH.srcPick', H3)]
s += bullets(['`PH.srcPref` (`ia517p_src`): «auto» oppure una fonte fissa (`phone`, `glo`, `fenix`); con una fonte fissa che tace compaiono le bandierine rosse.',
              '«auto»: tra i fix freschi (ricevuti da meno di 2,5 s) si prende quello con `acc` minore. Per non saltare avanti e indietro si cambia solo se il '
              'candidato resta migliore del 30% per 5 s di fila; se la fonte in uso tace si passa subito alla migliore.',
              '`PH.applyFix` aggiorna posizione, velocità (da `speed` o, se manca, da distanza e tempo tra due fix), traccia (solo sopra 1,5 m/s), accelerazione '
              'lungo la traccia `PH.dvdt`, velocità di virata dalla traccia `PH.trkRate`, prua riallineata alla traccia (sopra 25 km/h, corretta con il vento stimato), '
              'quota e vario, taratura, vento, diario. Quando cambia la fonte della quota il filtro del vario riparte da capo.'])
s += [P('<b>Taratura della quota (`PH.autoCal`).</b> Fermi (meno di 0,8 m/s, precisione entro 20 m) per almeno 20 s e 10 fix, entro 700 m da un campo con quota '
        'nota: la differenza tra quota del campo e media GPS (se entro 120 m) diventa l\'offset di quella fonte (`PH.altOfsBy[src]`, `ia517p_altofs2`) e compare «QUOTA TARATA SU …».'),
      P('<b>Vento e velocità vera senza Pitot (`PH.windSample`).</b> Un campione di velocità al suolo (Est, Nord) al secondo, fino a 3 minuti e 100 campioni. '
        'Con almeno 20 campioni e una virata vera (le direzioni non tutte allineate), si risolve ai minimi quadrati il cerchio |v − vento| = TAS: accettato '
        'se TAS tra 15 e 70 m/s e vento sotto 25 m/s, poi filtrato (80/20). Prima del vento stimato vale quello previsto da Open-Meteo per la destinazione (`PH.applyForecast`).'),
      P('<b>Diario (`PH.logFix`).</b> Il volo inizia dopo 5 s sopra 55 km/h (decollo, con il campo più vicino entro 3 km); il volo in corso è salvato in '
        '`ia517p_curflight` e ripreso se l\'app si riavvia entro 15 minuti. Le tracce degli ultimi 50 voli (`PH.TRK_KEEP`) stanno in IndexedDB ed esportano in GPX e KML.')]

s += sec('3.2 Assetto: accelerometro e giroscopio')
s += [P('L\'assetto viene da `PH.onMotion`, chiamata a ogni evento `devicemotion`. Usa lo stesso filtro della scheda sensori dello strumento fisico '
        '(Mahony a quaternioni, `ahrs_core.h`) con la compensazione delle accelerazioni in virata fatta con la velocità GPS al posto del Pitot. '
        'Convenzioni: assi dell\'aereo avanti, destra, giù; forza specifica a riposo e livellato (0, 0, −1 g).'),
      fig('fig-imu.png', 'Dai sensori di movimento all\'assetto: i dieci passi di `PH.onMotion`, il livellamento (LIVELLA) e la registrazione di 20 s.', h=150 * mm)]
s += bullets([
    '<b>Segno dell\'accelerometro.</b> Safari su iPhone dà `accelerationIncludingGravity` col segno opposto ad Android: si parte da `PH.accSign = −1` su iOS e lo '
    'si conferma da soli col telefono dritto in verticale (`PH.accCheck`, 40 voti contrari per invertirlo).',
    '<b>Verso dello schermo.</b> I vettori arrivano negli assi del telefono in verticale; `PH.scrAng()` (0, 90, 180, 270°; su iOS da `window.orientation`) '
    'li ruota negli assi dello schermo. Una rotazione dello schermo fa ripartire il filtro (`PH.onRotate`).',
    '<b>Passo di tempo vero.</b> Molti Android dichiarano `interval` 16 ms ma mandano 100–200 eventi al secondo: `dt` si misura da `e.timeStamp` '
    '(valido tra 1 e 100 ms), altrimenti si usa `interval`, sempre limitato a 1–60 ms. Con il valore dichiarato il giroscopio veniva contato 2–3 volte.',
    '<b>Montaggio (`PH.M`).</b> Matrice le cui righe sono gli assi avanti, destra, giù dell\'aereo negli assi dello schermo; di partenza il telefono in verticale con lo schermo '
    'verso il pilota (`[[0,0,−1],[1,0,0],[0,−1,0]]`). `PH.toBody(v)` = M·v porta accelerazione e rotazione negli assi dell\'aereo.',
    '<b>Ordine degli assi del giroscopio (`PH.gyroLearn`).</b> Lo standard W3C è x = beta, y = gamma, z = alpha, ma alcuni WebView (Samsung S23 FE) li danno come alpha, beta, gamma = x, y, z. '
    'Per 6 ordini × 2 segni la gravità di inizio finestra viene ruotata con il giroscopio per 0,5 s (dG/dt = −ω × G) e confrontata con quella misurata: l\'ipotesi giusta '
    'resta dove la vede l\'accelerometro. Servono almeno 9° di rotazione per finestra e 4 finestre; il segno si cambia solo con una prova netta. Il risultato è in `ia517p_gmap`.',
    '<b>Virata dal GPS.</b> Se il giroscopio manca, o per 3 s non vede una virata che il GPS vede chiaramente (oltre 4°/s, meno del 30% della rotazione attesa), '
    'la velocità di virata della traccia (rotazione attorno alla verticale) si porta negli assi dell\'aereo con l\'assetto stimato in quel momento: '
    '`[−ω sinθ, ω sinφ cosθ, ω cosφ cosθ]`. Usare l\'inclinazione teorica della virata coordinata faceva beccheggiare l\'orizzonte di circa 28° in macchina.',
    '<b>Compensazione.</b> Con V = TAS stimata o GS (sopra 15 km/h): `fx −= dV/dt / g`, `fy −= r·V / g`, `fz += q·V / g`. Con la virata dal GPS, se il modulo della forza '
    'misurata è quello atteso √(1 + (V·ω/g)²), se ne tiene solo la direzione così l\'inclinazione converge.',
    '<b>Filtro Mahony.</b> `kp` 1,8, `ki` 0,02 con integrale limitato a ±0,035 rad/s; la fiducia nell\'accelerometro scende con |f| lontano da 1 g (scala 0,08 g) e con la rotazione '
    '(scala 0,6 rad/s): `trust = exp(−e1²)·exp(−e2²)`. Senza accelerometro credibile (|f| fuori da 0,3–3 g) integra solo il giroscopio più il bias stimato.',
    '<b>Uscite.</b> Rollio e beccheggio passano da un filtro del primo ordine regolabile («orizzonte più morbido», τ = `PH.smooth` × 0,1 s, di serie 0,3 s) e vanno in `S.roll`, `S.pitch`; '
    'lo sbandamento `S.slip` dalla forza laterale; la prua integra il giroscopio tra un fix e l\'altro e, a terra o lenti, viene tirata verso la bussola. `LIVE.att` scade in 0,7 s.'])
s += [Paragraph('LIVELLA', H3),
      P('Il tasto LIVELLA (giallo e nero, chiede conferma; non disponibile in demo e simulazione) chiama `PH.level(gp)`: dalla media lenta dell\'accelerometro '
        '`PH.aAvg` ricava la direzione «giù» vista dal telefono, prende come «avanti» l\'asse −z dello schermo proiettato sul piano orizzontale (se il telefono è quasi '
        'in piano, l\'alto dello schermo) e lo ruota del beccheggio a terra (`gp`: di serie 11° per un biciclo a terra, 0° se si livella in volo). Ne esce la nuova `PH.M`, '
        'salvata in `ia517p_mount`; il filtro riparte già allineato (`levelFrom`). Se l\'accelerazione media non è tra 7 e 12,5 m/s² compare «TIENI FERMO IL TELEFONO E RIPROVA».'),
      Paragraph('Registrazione dei sensori («Registra 20 s e invia»)', H3),
      P('Da Impostazioni il pilota registra 20 s di dati grezzi: `PH.recStart` scrive l\'intestazione (montaggio, beccheggio a terra, segno, ordine degli assi, verso dello schermo, '
        'liscio, stato del GPS, user agent); `PH.recPush`, chiamata da `onMotion`, aggiunge per ogni evento una riga `ms dt ax ay az alpha beta gamma rollio beccheggio vario virata` '
        '(al massimo 6000 righe). La fine non dipende dagli eventi: un timer chiama `PH.recFinish`, che manda tutto con `PH.sendReport` (Web3Forms, entro 20 s) oppure apre la '
        'condivisione del file. Le registrazioni ricevute vanno in `tools/registrazioni/` e il banco di prova le rigioca nel codice vero (capitolo 11).')]

s += sec('3.3 Bussola')
s += [fig('fig-bussola.png', 'Bussola: le quattro sorgenti (plugin nativo, browser Android, iPhone, orologio) arrivano a `PH.magFromR`; uso nella prua e taratura automatica in corsa di decollo.')]
s += bullets(['<b>CompassPlugin</b>: sensore `TYPE_ROTATION_VECTOR` (o, se manca, `GEOMAGNETIC_ROTATION_VECTOR`) a `SENSOR_DELAY_GAME`, eventi «rot» al più ogni 50 ms con la '
              'matrice R (telefono → Est, Nord magnetico, Su) e la precisione 0–3. Si sospende in pausa e riprende con l\'app.',
              'Nel browser: `deviceorientationabsolute` (o `deviceorientation` con `absolute`), ignorato se c\'è il modulo nativo. Su iPhone `alpha` è relativo: lo scarto '
              'verso `webkitCompassHeading` si stima quando il lato alto del telefono non è verticale e poi resta valido anche col telefono dritto.',
              '`PH.magFromR` porta l\'asse avanti dell\'aereo nella terna terrestre, calcola la prua magnetica, aggiunge deviazione (`PH.magDev`) e declinazione (`PH.decl`, 3° di serie) '
              'e la filtra (τ = `hdgSmooth` × 0,25 s). La bussola tiene la prua solo se `PH.magInUse()`: dato recente e modo «ground» (fino a 25 km/h) o «always».',
              '`PH.magAuto` sfrutta la corsa di decollo (20–55 km/h, traccia stabile): con almeno 5 campioni coerenti (dispersione sotto 8°) aggiorna la deviazione, senza domande.'])
s += sec('3.4 Quota, vario e QNH')
s += [fig('fig-quota.png', 'Quota e vario: il barometro del telefono (5 Hz) corregge il filtro `PhVario`; il GPS tarato tiene giusto lo scarto. Senza barometro il filtro usa la quota GPS come prima.')]
s += [P('`PhVario` è un filtro complementare del 3° ordine (τ = 3 s: guadagni 3/τ, 3/τ², 1/τ³) che stima quota, velocità verticale e bias dell\'accelerometro. '
        '`predict` integra l\'accelerazione verticale ricavata da `onMotion` solo se un fix è arrivato da meno di 3 s (altrimenti il vario si smorza verso zero); '
        '`correct` usa la quota della fonte in uso, scarta un salto isolato di oltre 150 m e riparte dopo tre salti o dopo un buco di oltre 3 s. Uscite: `S.alt` in piedi, '
        '`S.vs` in m/s (limitato a ±30).'),
      P('<b>Barometro del telefono (dal 9 novembre 2026).</b> `BarometroPlugin.java` legge `TYPE_PRESSURE` circa 5 volte al secondo (evento «p» {hPa}) e si ferma quando l\'app va in pausa. '
        '`PH.baroIn` trasforma la pressione in quota-pressione standard `44330 · (1 − (p/1013,25)^0,190263)` e, una volta agganciato lo scarto `PH.baro.ofs`, chiama `PhVario.correct(pa + ofs)` a 5 Hz. '
        'In `PH.applyFix`, con il barometro fresco, il GPS non corregge più il filtro ma solo lo scarto: `ofs += (quota GPS tarata − (pa + ofs)) · dt / τ`, con τ = 20 s a terra e 120 s in volo, ignorando i fix con precisione peggiore di 30 m. '
        'Lo scarto si riaggancia subito quando il filtro riparte (taratura sul campo, «Tara qui», cambio di fonte, avvio). Barometro fermo da 2 s, spento (`ia517p_baro`) o volo dimostrativo/simulazione: si torna al solo GPS. '
        'Così il vario viene dal barometro e la quota assoluta resta quella del GPS tarato, senza bisogno del QNH. Simulazione con GPS ±15 m: rumore del vario da ±2,4–3,6 a ±0,05–0,11 m/s, errore di quota da 5–8 a 2–5 m.'),
      P('Il QNH (950–1060 hPa, di serie 1020, `ia517_qnh`) si imposta dalla manopola, dalle NOTE ENTE o dal Piano («Invia QNH» sui METAR) e serve alla quota barometrica dell\'orologio e alla scritta sull\'orizzonte; '
        'il codice di `applyNMEA` che converte la pressione con il QNH appartiene allo strumento fisico (scheda sensori via Raspberry). In Stato la riga «Barometro» dice se c\'è, quanti hPa legge e se è in uso.'),
      tip('<b>Misure vere</b> (`docs/sensori/scarti.json`, 9 novembre 2026): Galaxy S23 FE 982,5 hPa → QNH 1021,5 contro il METAR di LIMF 1022 (−0,5 hPa); Galaxy S23 −0,4 hPa rispetto all\'S23 FE; '
          'fenix 7 −4,4 hPa (circa 37 m), corretto da `orologio.js`. Ogni nuova prova su un dispositivo si aggiunge a quel file.')]
s += sec('3.5 Traffico GDL90 (SafeSky, SkyEcho, PilotAware)')
s += [fig('fig-traffico.png', 'Traffico: GDL90 via UDP 4000 (plugin e parser Java) oppure OGN e adsb.lol da internet, valutazione del pericolo e visualizzazione.')]
s += bullets(['`Gdl90Plugin.start({porta:4000})` apre un `DatagramSocket` riusabile con broadcast e prende un `MulticastLock` del Wi-Fi (senza, i pacchetti broadcast di SkyEcho e Stratux non arrivano).',
              '`Gdl90Parser.parse` separa i messaggi tra byte 0x7E, toglie l\'escape 0x7D, verifica il CRC-CCITT (polinomio 0x1021, due byte in coda) e legge i messaggi 10 (proprio aereo) e 20 (traffico): '
              'indirizzo a 24 bit, lat/lon a 24 bit con segno (× 180 / 2²³), quota a passi di 25 ft − 1000, velocità in nodi, vario × 64 ft/min, traccia × 360/256, categoria, nominativo.',
              '`PH.gdlIn` tiene il proprio aereo (e lo scarto tra la sua quota e quella GPS, `gdlOfs`, per correggere le quote del traffico SafeSky) e mette ogni traffico in `PH.TRF.tg` '
              'togliendo lo stesso aereo arrivato da internet. Finché il GDL90 parla (ultimi 15 s) OGN e adsb.lol non si interrogano.',
              '`PH.trfEval` (1 Hz) proietta ogni traffico in avanti con la sua velocità (al più 45 s), scarta i dati più vecchi di 180 s, riconosce il proprio aereo (stessa posizione e velocità '
              'per 3 controlli), calcola il punto di massimo avvicinamento e dà il pericolo: entro 1000 ft di lato e di quota adesso o entro 60 s (rosso se entro 30 s). Il triangolo «ORE n · ±ft» '
              'compare sull\'orizzonte e sulla mappa; la pagina TRAFFICO ha radar 5/10/25 km ed elenco.'])
s += sec('3.6 Stato del telefono')
s += [P('`StatoTelefonoPlugin.get()` (ogni 5 s) restituisce batteria (percentuale, in carica, temperatura), rete (Wi-Fi/cellulare, internet validato), generazione e segnale del cellulare '
        '(5G da SS-RSRP, 4G da RSRP tra −120 e −80 dBm, 3G/2G da dBm) e, dal `GnssStatus.Callback`, satelliti usati e visti con il C/N0 medio (solo se aggiornati negli ultimi 10 s). '
        'Nessun permesso aggiuntivo oltre alla posizione. Nel browser `PH.statoPoll` usa `navigator.getBattery()` e `navigator.connection` quando ci sono. La riga di stato mostra '
        '«WIFI», «4G 63%», «BATT 18%» con i colori (rosso sotto 20%, giallo sotto 40%, rosso oltre 45 °C).')]

# =====================================================================================================
# 5. STRUMENTO E SCHERMATE
# =====================================================================================================
s += chap(4, 'Strumento e schermate')
s += [P('Le schermate di questo capitolo vengono dalla pagina vera servita in locale (Chromium, 412 × 900 punti, volo dimostrativo). In questo ambiente '
        'le tessere della mappa e del terreno non arrivano (rete chiusa): la mappa è senza fondo e l\'orizzonte usa le colline sintetiche che il volo dimostrativo '
        'disegna proprio quando manca il rilievo.'),
      shots([('sch-pfd.png', 'Orizzonte (PFD) nel volo dimostrativo con direct to LILE: sentiero magenta, CDI, destinazione'),
             ('sch-mappa.png', 'Mappa mobile senza tessere (rete chiusa in questo ambiente)'),
             ('sch-semplice.png', 'Interfaccia semplice')], 52 * mm)]
s += sec('4.1 Orizzonte (PFD)')
s += bullets(['`drawPFD` disegna nel tondo: cielo e terreno 3D (`drawTerrain` proietta il rilievo con `project`/`rel` e lo colora per quota; in volo giallo sotto 180 m e rosso sotto 60 m di margine, `TAWS_RED`/`TAWS_YEL`), '
              'ostacoli e cavi (solo nel demo), piste 3D con barra di arresto prevista, sentiero a riquadri magenta lungo la rotta (`drawPathway`), scala di beccheggio, arco di rollio, '
              'nastri di velocità (archi colorati del velivolo attivo) e quota, vario, nastro di prua, CDI con modi ENR/TERM/APR, indicatore di sentiero (VDI), barre del direttore di volo, '
              'marcatore della traiettoria, riquadri di destinazione, vento e fase del circuito.',
              'Senza Pitot il nastro di velocità mostra la velocità al suolo (`S.ias = S.gs`); la TAS stimata dalle virate compare nella casella GS.',
              'Interfaccia semplice (`PH.ui === \'simple\'`, classe `ph-simple`): solo orizzonte, `drawPFD` viene chiamato con rotta e destinazione nascoste; avvisi e SOS restano.'])
s += sec('4.2 Mappa')
s += bullets(['`drawMap` a tutto riquadro (`mapClip`), traccia in alto o nord in alto con la mappa spostata a dito (`PH.pan`); 19 passi di zoom da 1 a 700 km.',
              'Basi (`PH.BASES`): OpenTopoMap, OpenStreetMap, Satellite Esri (con chiave del pilota), IGM 1:25.000 e ortofoto AGEA (WMS http, solo app), personalizzata (XYZ o WMS), '
              'solo rilievo, e la carta VFR open flightmaps locale (`ofm`, capitolo 6). Le tessere coprono 1,8 volte la scala per riempire gli angoli ruotati.',
              'Sopra la base: rilievo colorato, spazi aerei e NOTAM (`livelli.js`, attenuati oltre ±1000 ft dalla quota), campi e piste, punti VFR (`note.js`), zona di planata vera (`emergenza.js`), '
              'rotta e tappe, traffico con scia, METAR come anelli colorati per categoria VFR (`vento.js`). I livelli si spengono dal tasto ◧ senza spegnere gli avvisi.'])
s += sec('4.3 Terreno (DEM) e TAWS')
s += bullets(['Rilievo da AWS Terrain Tiles in formato Terrarium: `phDemFetch` scarica la tessera PNG, la decodifica (quota = R·256 + G + B/256 − 32768) in un `Int16Array` 256 × 256; '
              'al massimo 6 richieste insieme, 220 tessere in memoria (circa 28 MB), ritentativo dopo 60 s. `phDemAt` interpola in modo bilineare e scende ai livelli più grossolani se manca il dettaglio; '
              'restituisce almeno 0 m (il fondo del mare non conta) salvo con `raw`, che serve a riconoscere il mare.',
              '`PH.checkTerrain` (1 s, solo in volo con GPS vero): per t da 0 a 60 s a passi di 5 s proietta la posizione lungo la traccia con il vario; «TERRENO! CABRA» (avviso rosso, ripetuto ogni 5 s) '
              'se entro 30 s il margine scende sotto 100 ft, «ATTENZIONE TERRENO» sotto 300 ft. Tace vicino alla destinazione in circuito (`tawsInhibit`).',
              'Terreno davanti alla quota obiettivo, quota sicura delle tratte e Calcola rotta usano lo stesso `phDemAt`.'])
s += sec('4.4 Avvisi')
s += [P('`PH.alert(chiave, livello, testo, ogni)` è l\'unico punto di ingresso: a schermo, i gialli informativi (spazi aerei, tramonto, limite VDS) diventano bandierine dal bordo destro, aperte 3 s e poi '
        'linguette finché la condizione continua (spariscono dopo 5 s di silenzio); i rossi e i gialli di terreno restano al centro. La voce (`PH.say`, TextToSpeech nativo o `speechSynthesis`) '
        'e la vibrazione partono al più una volta per intervallo. Un tocco toglie l\'avviso: per uno spazio aereo finché non se ne esce da 2 minuti, per gli altri 1 minuto. In HORIZON 2 l\'avviso va anche all\'orologio.'),
      table(['Avviso', 'Condizione', 'Livello'], [
          ['TERRENO! CABRA / ATTENZIONE TERRENO', 'margine sotto 100 ft entro 30 s / sotto 300 ft entro 60 s', 'W / C'],
          ['DENTRO … / TRA 30 SECONDI …', 'spazio aereo con il giudizio di `IA517_RULES` per il tipo di volo, adesso, a metà anticipo e all\'anticipo (di serie 60 s), margine di quota 100 ft', 'W se vietato, altrimenti C'],
          ['SOPRA IL LIMITE VDS', 'VDS basico: quota sopra ostacolo più alto entro 5 km + limite del giorno (`vdsMaxAgl`)', 'C'],
          ['TRAMONTO TRA 30 / 10 MINUTI', 'alba e tramonto NOAA semplificato (`phSun`)', 'C / W'],
          ['Traffico', 'triangolo «ORE n · ±ft» (non passa da `PH.alert`)', 'giallo / rosso'],
      ], [52 * mm, 98 * mm, 24 * mm])]
s += sec('4.5 Vista 3D, schede, schermo diviso, voce, emergenza')
s += bullets(['<b>Vista 3D (`spazi3d.js`, caricato dal Piano).</b> `SP3D_open` costruisce con three.js r160 (caricato solo all\'apertura) il terreno attorno alla rotta, gli spazi aerei come solidi tra base e tetto '
              '(tagliati a 10.000 ft di partenza, FIR/UIR esclusi), la rotta alla quota del piano, il velo del limite VDS e l\'aereo; tratti di circa 100 km. `SP3D_replay` rivede un volo del diario. Non si apre in volo vero.',
              '<b>Caselle (`schede.js`).</b> Fino a 8 caselle a scelta, elenchi separati per l\'interfaccia completa e quella semplice (`ia517p_cards`, `ia517p_cards_s`); toccare VENTO, DESTINAZIONE o AUTONOMIA apre la pagina relativa.',
              '<b>Tablet (`schermo.js`, `PH.layout`).</b> In orizzontale e oltre 820 punti lo schermo si divide: orizzonte e mappa (o stimati) affiancati; tocco breve sulla finestra grande per scambiarle, riga centrale da trascinare (`ia517p_split_r`).',
              '<b>Voce (`voce.js`).</b> `PH.sayNow` parla anche con la voce spenta su richiesta; check list guidata a voce; METAR letto a parole; scadenze personali (medico, attestato, assicurazione) avvisate a terra entro 30 giorni.',
              '<b>Emergenza (`emergenza.js`).</b> `PH.glideZone`: in 36 direzioni la discesa con efficienza × 0,75, corretta dal vento, fino a 200 ft dal terreno vero; `PH.glideFields`: campi con terreno libero lungo la strada '
              'e almeno 500 ft all\'arrivo; `PH.emergStart` (tasto SOS da tenere premuto 0,8 s) apre la barra di emergenza con il MAYDAY compilato.',
              '<b>Simulazione.</b> `PH.setDemo(true)` è il volo dimostrativo (sensori finti, colline sintetiche senza rilievo, ostacoli e traffico finti); `PH.simStart` fa volare lo strumento lungo una rotta o un direct to '
              'con velocità, quota, vento e accelerazione (×2 di serie) scelti, con avvisi veri ma simulati; sotto il terreno la simulazione si ferma come impatto.'])
s += [shots([('sch-impostazioni.png', 'Impostazioni ordinate (sezioni pieghevoli)'), ('sch-guida.png', 'Guida in linea'),
             ('sch-traffico.png', 'Pagina TRAFFICO nel volo dimostrativo')], 52 * mm)]
s += [fig('sch-tablet.png', 'Tablet in orizzontale (1180 × 820): orizzonte e mappa affiancati con lo schermo diviso; mappa senza tessere per la rete chiusa.', w=150 * mm)]

# =====================================================================================================
# 6. PIANO
# =====================================================================================================
s += chap(5, 'Piano di volo (app.html)')
s += [P('Il Piano è una pagina a parte caricata nell\'iframe `#phAppFrame` dello strumento (tasto PIANO). Nasce come app web che parlava con il servizio del Raspberry: '
        'in versione telefono `api()` passa da `parent.IA517.api`, cioè `PH.handle`, che valida campi (`PH.valField`) e rotte (`PH.valRoute`) e li salva in `localStorage`. '
        'Il Piano legge dallo strumento il rilievo (`parent.phDemAt`), il velivolo attivo (`parent.IA517_AC`), il vento sulla pista (`parent.PH.ventoSvg`); lo strumento legge dal Piano '
        'gli spazi aerei veri (`IA517_asp`), i NOTAM con la riga Q validi oggi (`IA517_notam`), il calcolo della rotta per il direct to (`IA517_dctRoute`). Cinque schede: Piano, Briefing, Campi, Meteo, Strumento.'),
      shots([('sch-piano.png', 'Piano: partenza, arrivo, alternato, tappe e piccola mappa'), ('sch-briefing.png', 'Briefing (spazi aerei non scaricati in questo ambiente)')], 56 * mm)]
s += sec('5.1 Rotta')
s += bullets(['Partenza, tappe, arrivo e alternato si scelgono scrivendo nome o sigla tra circa 1950 campi (`FIELDS_RAW`, uguale nelle due pagine) più quelli del pilota.',
              '«Disegna sulla mappa» apre la rotta a schermo pieno (`rdOpen`): un tocco aggiunge un punto, trascinare la linea inserisce una tappa, i punti liberi prendono il nome di paesi, laghi e cime da Overpass. '
              'Per ogni tratta `rdLegAnalyze` calcola prua (con il vento alle quote), minuti, distanza, quota sicura sul terreno e spazi attraversati; `rdVert` verifica le salite e discese possibili col velivolo e mette giri di 360° dove servono.',
              '«Calcola rotta» (`rdAround`, ricerca A* su griglia con heap): aggira P, R e gli spazi vietati per il tipo di volo, passa dalle valli rispettando il margine sul terreno, evita il mare al largo '
              '(e lo permette caro, ×9, solo se non c\'è altra strada), costa di più lontano da campi o terreno pianeggiante. Per il VDS basico una tratta si spezza solo se supera il limite di oltre 500 ft (`RD_VDS_TOL`).',
              'Il direct to dello strumento (`PH.dctSmart`) parte subito in linea retta e intanto chiede al Piano la stessa rotta calcolata e la quota migliore.'])
s += sec('5.2 Briefing, meteo, spazi aerei, NOTAM')
s += bullets(['<b>Briefing</b> (`runBriefing`): profilo verticale con terreno, spazi aerei lungo la rotta campionata ogni 250 m, quota di crociera e giudizio per tipo di volo (`IA517_RULES`), più la Vista 3D.',
              '<b>Meteo</b>: Open-Meteo sui campi del piano (fino a 24), METAR e TAF veri da aviationweather.gov (solo dentro lo strumento), categoria VFR/MVFR/IFR/LIFR (`vfrCat`), TAF interpretati '
              '(FM, BECMG, TEMPO/PROB come peggio possibile, `tafAt`) e TAF entro 40 km all\'ora di passaggio (`wxTafRoute`); METAR a parole e a voce.',
              '<b>Meteo della rotta alle quote</b> (`rdWxCheck`): Open-Meteo con vento, temperatura e geopotenziale da 1000 a 700 hPa, nubi basse e medie, visibilità, CAPE, zero termico, all\'ora in cui si passa su ogni tratta.',
              '<b>Spazi aerei</b>: file OpenAir dell\'Italia di openAIP (nell\'app direttamente, sul web dalla copia notturna `dati/` perché openAIP non permette la lettura dal browser), più la fascia alpina dei Paesi vicini; '
              'ripiego sull\'API openAIP con la chiave del pilota, su un file o su un indirizzo. Riserva open flightmaps unita sul telefono (`aspMerge`: base più bassa, tetto più alto, classe più restrittiva).',
              '<b>NOTAM</b>: si incollano (copiati dal briefing ufficiale o da Desk Aeronautico); `parseNotams` legge riga Q (posizione, raggio, quote), A), B), C), E) e li confronta con la rotta.'])
s += sec('5.3 Velivolo, carburante, prestazioni, diario')
s += bullets(['Profili dei velivoli (`PH.AC_SCHEMA`): identità e categoria (decide le regole), check list a fasi, velocità VS0…VNE (archi colorati), prestazioni, serbatoi e consumi, pesi e bracci, transponder e radio.',
              '`carburante.js`: carburante all\'arrivo in tre fasce (comodo, riserva, critico sotto 10 minuti), alternati con carburante lungo la rotta da `dati/carburante.json` (openAIP).',
              '`prestazioni.js`: rateo di salita che cala con la quota di densità e cambia con il peso, discesa massima, giri di 360° da 10° a 20° d\'inclinazione, salita graduale.',
              'Carico e centraggio (`renderWB`) con i limiti del baricentro del profilo. Il diario è nello strumento: voli automatici, tracce GPX/KML, esportazione CSV.'])

# =====================================================================================================
# 7. OFFLINE
# =====================================================================================================
s += chap(6, 'Volare senza internet: cache, carta VFR, spazi aerei')
s += sec('6.1 Service worker')
s += [table(['Richiesta', 'Strategia', 'Cache'], [
    ['Pagine e moduli del sito (stessa origine)', '«stale while revalidate»: dalla cache subito, aggiornata in sottofondo', '`ia517-app-1.0.0` (precaricata con `CORE` all\'installazione, solo web)'],
    ['Terreno (`s3.amazonaws.com/elevation-tiles-prod`)', '«cache first»', '`ia517-dem`, al massimo 4000 tessere'],
    ['OpenTopoMap, OpenStreetMap', '«cache first»', '`ia517-map`, al massimo 3000 tessere'],
    ['Open-Meteo', '«network first», cache se offline', '`ia517-wx`'],
    ['Google Fonts', '«cache first»', '`ia517-fonts`, 40 voci'],
    ['URL con `?chk=`', 'sempre dalla rete (controllo della versione)', '—'],
], [56 * mm, 64 * mm, 54 * mm]),
      P('Nell\'app (host `localhost` senza porta) le pagine non si mettono in cache perché sono già nell\'APK; terreno, mappe e meteo sì. «Scarica per il volo» (`PH.prefetch`) '
        'riempie le cache in anticipo: rilievo a zoom 7–11 in raggi da 450 a 60 km, tessere della base a zoom 8–13 in raggi da 60 a 6 km, con 4 scarichi in parallelo.')]
s += sec('6.2 Carta VFR open flightmaps')
s += [P('La carta VFR d\'Italia di open flightmaps (pacchetto MBTiles ufficiale, circa 105 MB, zoom 4–11, licenza OFMA con citazione) si scarica una volta e resta sul telefono. '
        '`carta.js` sceglie la strada: plugin nativo `Carta` nell\'app Android, worker `carta-web.js` nel browser (se ci sono `Worker` e `navigator.storage.getDirectory`).'),
      fig('fig-carta.png', 'Carta VFR: lo stesso pacchetto MBTiles letto dal plugin nativo (SQLite di Android) o dal worker web (sqlite-wasm con il VFS «opfs-sahpool»).'),
      P('Il plugin accetta solo indirizzi di `snapshots.openflightmaps.org` e nomi `[a-z0-9_]{1,24}`; il worker scrive la carta nuova accanto alla vecchia (`/li@AIRAC.mbtiles`) e cancella la vecchia '
        'solo a scarico completo e verificato. Sul web la libreria SQLite si carica solo se `ia517p_carta_web` dice che la carta c\'è; su iPhone serve la schermata Home, altrimenti iOS può cancellare '
        'i dati del sito dopo alcune settimane di inattività (l\'app lo scrive).')]
s += sec('6.3 Ciclo AIRAC e fonti degli spazi aerei')
s += bullets(['`PH.airac()` (carta.js) conta cicli di 28 giorni dal 2 gennaio 2020 (ciclo 2001) e dà la sigla AAkk; lo scarico prova il ciclo in corso e poi il precedente. Il Piano ha una sua funzione `airac` equivalente '
              'per decidere quando riscaricare gli spazi aerei.',
              'Fonte principale: export OpenAir giornaliero di openAIP (CC BY-NC 4.0). Riserva: open flightmaps (`tools/ofm_openair.py` nel workflow notturno → `dati/ofm_it.txt`), unita sul telefono e mai '
              'pubblicata unita (licenze diverse). `tools/confronta_spazi.py` confronta ogni notte le due fonti (`dati/confronto_spazi.md` e riepilogo della corsa).',
              'Quote OpenAir: «3500MSL» è in piedi; SFC/GND e AGL si riferiscono al terreno sotto il punto (`phDemAt`).'])

# =====================================================================================================
# 8. MODULI NATIVI
# =====================================================================================================
s += chap(7, 'Moduli nativi Android (Java)')
s += [P('Tutti i plugin estendono `com.getcapacitor.Plugin` e si registrano in `MainActivity`. Le chiamate dalla pagina sono asincrone (`PluginCall`); i dati continui arrivano con `notifyListeners` come eventi.'),
      table(['Plugin (nome JS)', 'Metodi', 'Eventi', 'Cosa fa'], [
          ['GloSerial', '`paired`, `connect({address})`, `disconnect`', '«nmea» {lines}, «state»', 'GPS Bluetooth classico (SPP/RFCOMM), lettura NMEA in un thread; permesso BLUETOOTH_CONNECT'],
          ['Compass', '`start`, `stop`', '«rot» {R[9], acc}', 'Sensore di rotazione di Android (≤ 20 Hz), sospeso in pausa'],
          ['Barometro', '`info`, `start`, `stop`', '«p» {hPa, acc}', 'Sensore di pressione di Android (`TYPE_PRESSURE`, ≈ 5 Hz), sospeso in pausa; rifiuta se il telefono non ce l\'ha'],
          ['Gdl90', '`start({porta})`, `stop`, `status`', '«traffico» {proprio, addr, lat, lon, altFt, kt, fpm, trk, cs…}', 'Ricevitore UDP con MulticastLock e `Gdl90Parser` (senza dipendenze da Android)'],
          ['StatoTelefono', '`get`', '—', 'Batteria, rete, segnale 2G–5G, satelliti GNSS'],
          ['Carta', '`scarica({url,nome})`, `info`, `tile({nome,z,x,y})`, `cancella`', '«progresso» {done,total}', 'MBTiles della carta VFR in `files/carte/`'],
          ['Licenza', '`info`, `billingStart`, `billingBuy`, `billingRestore`, `caffeStart`, `caffeBuy`', '—', 'ANDROID_ID, prima installazione, installatore, firma dell\'app confrontata con due impronte SHA-256; Play Billing (abbonamento rinviato, «caffe» a consumo)'],
          ['Updater', '`apkDownload`, `apkInstall`, `playCheck`, `playStart`', '«progress»', 'Scarica l\'APK (solo https, anche nei rimandi, al più 6) nella cache e apre l\'installazione con FileProvider; Play In-App Updates'],
          ['Garmin (solo H2)', '`avvia`, `invia({msg})`, `apri`, `info`', '«dati», «stato»', 'Connect IQ Mobile SDK 2.4.0, collegamento WIRELESS tramite Garmin Connect'],
      ], [24 * mm, 46 * mm, 38 * mm, 66 * mm])]
s += bullets(['<b>Gdl90Parser</b> è una classe Java pura: il commento dice che «si prova anche sul PC», ma nel repository non c\'è ancora un test che lo faccia (capitolo 13).',
              '<b>Licenza</b>: il controllo della firma considera valida l\'app se il certificato coincide con una delle impronte (Play App Signing o chiave di caricamento, usata anche per gli APK di GitHub) oppure se arriva dal Play Store.',
              '<b>Updater</b>: il file scaricato va sempre in `cache/aggiornamento/HORIZON.apk` ed è l\'unico che `apkInstall` può aprire; il permesso `REQUEST_INSTALL_PACKAGES` esiste solo nell\'APK di GitHub.',
              '<b>Sicurezza di rete</b>: `network_security_config.xml` permette http solo verso `wms.pcn.minambiente.it`; `allowBackup=false` e `data_extraction_rules.xml` escludono i dati dai backup; FileProvider solo sulla cache.'])
s += sec('7.1 La variante HORIZON 2 (-Ph2)')
s += [P('`android/app/build.gradle` legge `project.hasProperty(\'h2\')`. Con `./gradlew assembleRelease -Ph2`: `applicationId` diventa `it.amicoen.horizon2` (si installa accanto a HORIZON), '
        'i sorgenti includono `src/h2/java` (dove c\'è `GarminPlugin.java`) e si aggiunge la dipendenza `com.garmin.connectiq:ciq-companion-app-sdk:2.4.0@aar`. Il workflow cambia anche il nome '
        'dell\'app in «HORIZON 2» e scrive `version.js` con versione 2.0.N e canale `h2`. Senza `-Ph2` la compilazione non contiene codice né librerie Garmin; `MainActivity` cerca la classe con `Class.forName` e, se non c\'è, va avanti.'),
      P('Firma: tutte le varianti si firmano con la stessa chiave (`keystore/strumento.keystore.enc` decifrata in CI); `versionCode` = numero della corsa del workflow, `minSdk` 34 (Android 14), `targetSdk` 36.')]

# =====================================================================================================
# 9. OROLOGIO
# =====================================================================================================
s += chap(8, 'Orologio Garmin (Connect IQ)')
s += [P('L\'app «HORIZON Link» (`garmin/`, Monkey C, `watch-app`, API minima 3.2.0) gira su fenix 7, 7S, 7X, le versioni Pro ed epix 2, con i permessi Positioning, Sensor, Communications e SensorHistory. '
        'Parla con HORIZON 2 attraverso l\'app Garmin Connect del telefono; l\'identificativo dell\'app (`5d505a6e…`) è lo stesso nel manifest e in `GarminPlugin.APP_ID`.'),
      fig('fig-orologio.png', 'Messaggi tra orologio e telefono: dati dei sensori ≈ 1 al secondo, tasti, dati da mostrare ogni 2 s, avvisi che fanno vibrare; scatola nera alla riapertura.', h=150 * mm)]
s += sec('8.1 Dall\'orologio al telefono')
s += [table(['Chiave', 'Contenuto', 'Origine sull\'orologio'], [
    ['t, v', '«d» = dati, versione 2 (oppure «k» = tasto, con `k`)', '—'],
    ['la, lo, q, al, sp, hd, w', 'lat/lon in gradi, qualità del fix (0–4), quota GPS (m), velocità (m/s), traccia (°), ora del fix', '`Position.Info` (solo con qualità ≥ POOR)'],
    ['ps, ba, mh, hr, te', 'pressione al livello del mare (Pa), quota barometrica, prua magnetica (°), battito, temperatura', '`Sensor.Info`'],
    ['ox, oxa', 'SpO₂ (%) e età della misura (s; 0 se dal sensore)', 'sensore o `SensorHistory.getOxygenSaturationHistory` ogni 60 s'],
    ['p', 'pressione ambiente vera (Pa): base della quota con il QNH', '`Activity.getActivityInfo().ambientPressure`'],
    ['bt, mu, mt', 'batteria (%), memoria usata e totale (byte)', '`System.getSystemStats()`'],
    ['pv, pm', 'ultimo passo e memoria della sessione precedente (scatola nera), nei primi 60 s', '`Application.Storage`'],
], [32 * mm, 86 * mm, 56 * mm], mono0=True)]
s += bullets(['GPS: multibanda `CONFIGURATION_GPS_GLONASS_GALILEO_BEIDOU_L1_L5` se l\'orologio la supporta, altrimenti GPS + Galileo, altrimenti la modalità continua di base.',
              'Invio (`tick` ogni 1 s → `send`): un solo messaggio in volo alla volta (`busy`); senza risposta per 15 s si riprova; la coda tiene al massimo 4 messaggi e i tasti passano prima dei dati. '
              'Il collegamento si considera perso dopo 8 s senza scambi.',
              'Commento del sorgente: niente sensori esterni né Pulse Ox continuo «meno carico, meno chiusure»: la SpO₂ viene dallo storico (Pulse Ox «tutto il giorno» acceso sul fenix).'])
s += sec('8.2 Dal telefono all\'orologio, tasti, avvisi')
s += bullets(['Ogni 2 s, se l\'orologio è collegato, `orologio.js` manda `{t:"s", gs, al, vs, dt}` (velocità km/h, quota ft, vario m/s, destinazione con distanza e rotta). Il commento nel codice dice «ogni 2 s: il collegamento passa da Garmin Connect, non va intasato».',
              '`PH.alert` è avvolta: quando un avviso parla davvero (non solo si ripresenta) e «Avvisi sull\'orologio» è acceso, parte `{t:"a", l:"W"|"C", x: testo di al più 40 caratteri}`. L\'orologio vibra '
              '(W: tre impulsi da 0,5 s al 100%; C: due da 0,25 s al 70%), accende lo schermo e riempie il quadrante di rosso o giallo per 8 s.',
              'Schermata normale: stato del collegamento e del GPS, velocità e quota (dallo strumento se arrivate negli ultimi 5 s, altrimenti dai sensori dell\'orologio), vario, destinazione, battito e SpO₂ (gialla sotto 92%, rossa sotto 88%; solo colore, nessun avviso).',
              'Tasti: START = OK (`push`), SU = ruota a sinistra, GIÙ = ruota a destra, SU tenuto (menu) = cambia pagina, GIÙ + INDIETRO insieme = cambia pagina, INDIETRO da solo = esci. GIÙ e INDIETRO aspettano 0,35 s per riconoscere la combinazione.',
              'Bussola dell\'orologio: facoltativa e spenta di serie, perché al polso si muove col braccio; se accesa sostituisce `PH.magFromR` finché i dati sono freschi.'])
s += sec('8.3 Scatola nera e diagnosi delle chiusure')
s += [P('`segna(passo)` tiene in memoria gli ultimi 12 punti attraversati dal codice («secondo», «invio al telefono», «disegno»…); ogni 5 tick la traccia si salva in `Application.Storage` alla chiave «passo», '
        'ogni 10 tick si salva la memoria usata. Se l\'app si chiude per un errore (sull\'orologio compare «IQ!»), alla riapertura i campi `pv`/`pm` viaggiano nei dati per un minuto e compaiono in '
        'Impostazioni › Orologio Garmin come «Ultima chiusura dell\'app sull\'orologio durante: …», da mandare all\'autore. `onUpdate` è protetto da `try/catch`; `tick` e `onPhone` no (vedi capitolo 13).')]
s += sec('8.4 Compilazione (horizon2.yml)')
s += bullets(['Job «orologio»: decifra la chiave da sviluppatore `garmin/devkey.der.enc` con `KEYSTORE_PASSWORD` (alla prima corsa la crea, la cifra e la salva sul ramo), scrive la versione 1.0.N nel manifest, '
              'compila con `monkeyc` dentro l\'immagine pubblica `ghcr.io/matco/connectiq-tester` un `.prg` per ogni orologio presente nel kit e il pacchetto `.iq` per lo store; poi cancella la chiave in chiaro.',
              'Job «telefono»: Node 22, Java 21, `npx cap sync`, firma, `gradlew assembleRelease -Ph2` → `HORIZON2-2.0.N.apk`.',
              'Job «pubblica» (solo su `main`): Release pre-release `horizon2-N` con APK, `.prg` e `.iq`. Sui rami `claude/**` restano solo gli artifact della corsa.'])

# =====================================================================================================
# 10. LICENZE
# =====================================================================================================
s += chap(9, 'Licenze')
s += [warn('Stato attuale: la verifica del codice funziona, ma <b>la licenza non blocca niente</b> (commento in `riservato.js`: «Per ora non blocca niente»). Lo schema deciso dall\'autore '
           '(30 giorni di prova, poi niente uso dal vivo senza licenza, mai blocchi in volo) è descritto in `SKILL.md` ma non è ancora nel codice. Anche l\'abbonamento di `licenza.js` è spento (`abbonamento:false`).')]
s += sec('9.1 Formato del codice')
s += [fig('fig-licenza-codice.png', 'Formato del codice di licenza: 21 byte di dati più 64 byte di firma ECDSA P-256, scritti in base32 Crockford con il prefisso HZ1 a gruppi di 5.'),
      bullets(['Giorni contati dal 1° gennaio 2026; mensile = emissione + 31 giorni, annuale = + 366, perenne = 65535 (nessuna scadenza).',
               'Il «codice del telefono» (12 caratteri dell\'alfabeto `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, mostrato come XXXX-XXXX-XXXX) è calcolato da `licenza.js`: SHA-256 di `"ia517|" + id`, '
               'con `id` = ANDROID_ID nell\'app (resta uguale reinstallando) oppure un UUID casuale salvato in `localStorage` e IndexedDB nel browser.',
               'La firma è (r, s) di 32 byte ciascuno; la chiave pubblica (SPKI in base64) è la costante `PUB` di `riservato.js` ed è pubblica per definizione.'])]
s += sec('9.2 Verifica sul telefono, revoca, menu riservato')
s += bullets(['Menu riservato: 5 tocchi entro 3 s sul logo in Info (`PH.riservatoOpen`). Mostra il codice del telefono, la richiesta della licenza (email del pilota + «Invia la richiesta» via Web3Forms, '
              'oppure «Scrivi dalla tua posta» con `mailto:`), il campo del codice e lo stato. Nessun prezzo né link di pagamento nell\'app, in nessuna versione (regole di Google Play).',
              '`leggi(codice)`: toglie «HZ1», decodifica il base32 (O → 0, I/L → 1), verifica con `crypto.subtle.verify({name:"ECDSA", hash:"SHA-256"})`, poi controlla versione 1 e tipo M/A/P. Funziona senza internet.',
              '`codiceStato()`: «attesa» se il codice del telefono non è ancora pronto (mai «attivo» alla cieca), «altro telefono», «revocato» (numero nella lista locale), «scaduto» (con un giorno di tolleranza e '
              'l\'ora più avanti mai vista, contro l\'orologio portato indietro), altrimenti «attivo».',
              'Revoche: `revocate.json` sul ramo `licenze`, letto da `raw.githubusercontent.com` 15 s dopo l\'avvio (al più una volta al giorno, `ia517p_revoche`) e ogni volta che si apre il menu riservato.'])
s += [shots([('sch-riservato.png', 'Menu riservato (codice del telefono, richiesta, campo del codice)')], 56 * mm)]
s += sec('9.3 Automazione per posta')
s += [P('Tutto il giro passa dalla casella Gmail di HORIZON; la chiave privata e il registro non escono mai da GitHub e sono cifrati sul ramo `licenze` (AES-256-CBC, PBKDF2 200.000 iterazioni, con '
        '`LICENZE_PASSWORD`; prima del cambio con `KEYSTORE_PASSWORD`, la funzione `scegli` legge `licenze/cifratura-v2.txt` per decidere quale).'),
      fig('fig-licenze-flusso.png', 'Flusso completo: richiesta dall\'app, Web3Forms, Gmail, sveglia di Apps Script, workflow con posta_licenze.py, pagamento, etichetta dell\'autore, codice, revoche e riepilogo.', h=170 * mm)]
s += steps(['<b>Richiesta</b>: dall\'app con Web3Forms (oggetto «HORIZON · Richiesta licenza · … telefono XXXX-…», `replyto` = pilota) oppure con la posta del pilota («HORIZON licenza XXXX-…»).',
            '<b>Sveglia</b> (`HORIZON-Licenze.gs`, trigger ogni minuto): se `GmailApp.search` trova richieste nuove o mail con etichetta M/A/P non gestite, chiama `workflow_dispatch` di `licenze-posta.yml` '
            '(token fine-grained con «Actions: read/write» nella proprietà `GITHUB_TOKEN`), con una pausa di 4 minuti tra due avvii; una volta al giorno dalle 7 anche senza lavoro, per il riepilogo. '
            'Motivo: su questo repository i cron di GitHub partono con ore di ritardo (il `*/10` non è mai partito); il cron orario `23 * * * *` resta come riserva.',
            '<b>Prezzi</b> (`posta_licenze.py`, passo 1): per ogni richiesta degli ultimi 30 giorni senza etichette, legge il codice del telefono dall\'oggetto o dal testo; le risposte dei piloti («Re:») restano in arrivo '
            'con «Da gestire»; altrimenti risponde in testo e HTML con i tre prezzi, i link `paypal.me/…/5EUR·30EUR·150EUR` e l\'immagine dei passi (`docs/licenze/paypal-passi.png`, inline con `cid:`) e sposta la mail in «Da gestire». '
            'Limiti: una mail di prezzi per telefono ogni 7 giorni, una per indirizzo al giorno, al massimo 30 al giorno (stato cifrato `licenze/prezzi.json.enc`, indirizzi solo come impronta SHA-256).',
            '<b>Pagamento</b>: il pilota paga su PayPal con la nota = codice del telefono; l\'autore controlla la notifica e mette alla mail l\'etichetta M, A o P.',
            '<b>Codice</b> (passo 2): numero = massimo del registro + 1, `licenze.genera`, verifica con la chiave pubblica, risposta al pilota con il codice e le istruzioni, riga nel registro (con nome, mail e Message-ID) '
            'scritta subito, etichetta «Gestite». Mai due codici per lo stesso Message-ID o per lo stesso telefono e tipo nello stesso giorno; senza codice del telefono la mail va in «Da vedere».',
            '<b>Piste dei piloti</b> (passo 2b): dalle mail «Pista rilevata» e «Campi usati» salva solo le righe anonime `HORIZON-PISTA {…}`/`HORIZON-CAMPI {…}` in `piste/AAAA-MM-GG-<hash>.txt` sul ramo `licenze`, etichetta «Piste lette».',
            '<b>Riepilogo</b> (passo 3): al primo giro del giorno dopo le 7 (ora italiana) o a richiesta (input `riepilogo`), mail «HORIZON · Riepilogo licenze» con la tabella (numero, tipo, pilota, telefono, date, stato) '
            'e lo storico delle revoche, spostata (aspettando fino a 1 minuto la consegna) in «Archivio generale licenze». È l\'unico elenco: il repository è pubblico e i log contengono solo conteggi.',
            '<b>Salvataggio</b>: il passo «Salva il registro» gira sempre (`if: always()`), ricifra solo se il contenuto in chiaro è cambiato e, se il ramo è stato scritto da un altro giro, unisce i registri '
            '(`registro_unisci.py`) e riprova fino a 4 volte.'])
s += [Paragraph('Azioni a mano (licenze.yml)', H3),
      table(['Azione', 'Cosa fa'], [
          ['crea-chiave', 'Una volta sola: coppia ECDSA P-256, privata cifrata, pubblica in chiaro nel riepilogo della corsa (va in `riservato.js`); rifiuta di ricrearla se esiste'],
          ['genera', 'Codice per tipo e telefono (`licenze_azione.py`, riapplicabile se il push fallisce); il codice parte per posta verso la casella di HORIZON solo dopo il salvataggio del registro, mai nel riepilogo pubblico'],
          ['revoca / ripristina', 'Aggiunge o toglie il numero in `revocate.json` con la data nello storico (solo numeri e date)'],
          ['cambia-password', 'Ricifra tutti i `.enc` con `LICENZE_PASSWORD` (almeno 24 caratteri), verifica ogni file e scrive `cifratura-v2.txt` (sul ramo questo file esiste: il cambio è stato fatto)'],
      ], [30 * mm, 144 * mm]),
      P('I due workflow hanno gruppi di concorrenza diversi (`licenze-posta` e `licenze-manuale`), così la sveglia non annulla mai un giro manuale; il rovescio della medaglia è descritto tra le proposte (capitolo 13).')]

# =====================================================================================================
# 11. CI/CD
# =====================================================================================================
s += chap(10, 'Compilazione e pubblicazione (GitHub Actions)')
s += [fig('fig-cicd.png', 'Gli otto workflow: evento che li avvia, passi principali, uscite.', h=170 * mm)]
s += sec('10.1 Numeri di versione')
s += bullets(['APK e AAB: `1.0.<run_number>` di «Compila APK», `versionCode` = `run_number` (variabili `VERSION_NAME`, `VERSION_CODE` lette da `build.gradle`). Il tag della Release è `build-N`.',
              'L\'app confronta il numero del tag dell\'ultima Release con `IA517_BUILD.build` per proporre l\'aggiornamento (APK); su Play usa il `versionCode` disponibile.',
              f'Le novità mostrate in Info stanno nell\'array `PH_CHANGES` di `index.html` (oggi la prima voce è {VER}) e vanno aggiornate a mano a ogni modifica visibile, insieme a `docs/play/novita/whatsnew-it-IT` (al più 500 caratteri).',
              'Web: `version.js` = `web gg.mm.aaaa` (data dell\'ultimo commit) con `build` = primi 8 caratteri dello SHA-1 delle pagine e dei moduli: cambia solo quando cambia l\'app.',
              'HORIZON 2: `2.0.<run_number>` di horizon2.yml; app dell\'orologio `1.0.<run_number>` nel manifest.'])
s += sec('10.2 Dettagli dei workflow')
s += bullets(['<b>build-apk.yml</b>: parte su `main` tranne che per modifiche a soli workflow, testi `.md`, `garmin/`, `android/app/src/h2/`, `docs/garmin/`. Se le prove dell\'assetto falliscono non esce nessuna APK. '
              'In caso di errore crea una issue «Compilazione N fallita» con le righe significative del log. Il caricamento su Play si salta (restando verde) se manca `PLAY_SERVICE_ACCOUNT_JSON`; `status` viene da `vars.PLAY_STATUS` (di serie «completed»).',
              '<b>test-emulatore.yml</b>: dopo una compilazione riuscita scarica l\'artifact `apk-collaudo` di quella corsa, avvia un emulatore Android 14 con KVM, installa, prova il primo avvio senza permessi, dà la posizione '
              'finta (Carolina, 45,2683 N 7,8656 E) e pilota la WebView via DevTools (capitolo 11); schermate e logcat nella pre-release «diagnostica», sintesi in una issue.',
              '<b>pubblica-web.yml</b>: copia `www/` in `sito/`, scrive `version.js`, scarica gli spazi aerei openAIP di it/fr/ch/at/si, la riserva open flightmaps, il confronto e i campi con carburante; '
              'aggiunge `/v2/` che rimanda alla versione attuale; pubblica con `deploy-pages`. Concorrenza «pages» con annullamento della corsa precedente.',
              '<b>sonda-spazi-aerei.yml</b>: nonostante il nome, prova le risposte CORS di `api.polar.sh` (per la licenza Polar rinviata) e scrive l\'esito in una issue.'])
s += sec('10.3 Segreti usati dai workflow')
s += [table(['Segreto (solo nome)', 'Usato da', 'A cosa serve'], [
    ['KEYSTORE_PASSWORD', 'build-apk, horizon2, licenze, licenze-posta', 'Decifra la chiave di firma e la chiave Garmin; ex password delle licenze (ancora letta prima del cambio)'],
    ['LICENZE_PASSWORD', 'licenze, licenze-posta', 'Cifratura di chiave privata, registro e stato delle licenze'],
    ['GMAIL_LICENZE', 'licenze, licenze-posta', 'Password per le app della casella di HORIZON (IMAP/SMTP)'],
    ['PLAY_SERVICE_ACCOUNT_JSON', 'build-apk', 'Caricamento dell\'AAB in «Test interni»'],
    ['GITHUB_TOKEN (proprietà Apps Script)', 'HORIZON-Licenze.gs', 'Token fine-grained per `workflow_dispatch` (non è un segreto di Actions)'],
], [52 * mm, 48 * mm, 74 * mm], mono0=True)]

# =====================================================================================================
# 12. PROVE
# =====================================================================================================
s += chap(11, 'Prove e qualità')
s += sec('11.1 Banco di prova dell\'assetto (tools/test_assetto.js)')
s += [P('Il test estrae da `index.html` il codice vero (`PhMahony`, `PH.toBody`, il blocco da `PH.GPERM` a `PH.gyroTxt`, `PH.onMotion`) e lo esegue in Node con le variabili globali sostituite. '
        'Genera dati di sensori da un moto noto (60 Hz per 10 s, con la virata tra 2 e 7 s) e misura l\'errore massimo di rollio, beccheggio e accelerazione verticale. Esce con 1 se una prova non passa.'),
      table(['Gruppo', 'Casi', 'Soglie'], [
          ['Macchina in curva (non s\'inclina)', 'destra e sinistra 20°/s con giroscopio, con la virata dal GPS, schermo a 90° e 270°, telefono inclinato 30° e livellato', 'rollio e beccheggio ≤ 3°, acc. verticale ≤ 0,6 m/s²'],
          ['Sul tavolo', 'girato ±60° attorno alla verticale: assi standard, assi beta/gamma scambiati, assi scambiati ma salvati come «riconosciuti»', 'come sopra'],
          ['Aereo in virata coordinata', '30° a destra e sinistra, con giroscopio e con la virata dal GPS', 'rollio atteso ±3°, beccheggio ≤ 3°'],
          ['Segno del giroscopio', '10 serie di 1 minuto di rotazione con rumore e accelerometro arrotondato a 0,1 m/s² (S23 FE)', 'nessuna inversione del segno'],
          ['Registrazioni vere', 'ogni file di `tools/registrazioni`, anche riportato agli assi standard e partendo da «αβγ invertiti»', 'dopo 9 s entro 8° di beccheggio e 15° di rollio dall\'accelerometro mediato'],
      ], [36 * mm, 92 * mm, 46 * mm]),
      P('Esecuzione in questo ambiente: tutte le 21 righe di prova passano (`Tutte le prove dell\'assetto passano.`). Il test gira in `build-apk.yml` (blocca l\'APK) e in `test-assetto.yml` a ogni push che tocca `index.html` o il test.')]
s += sec('11.2 Registrazioni dei sensori')
s += [P('`tools/registrazioni/` contiene due registrazioni di un Samsung S23 FE (HORIZON 1.0.75 e 1.0.76, Android 16, WebView 156): «giri su sé stessi» e «giri lenti», con il giroscopio ad assi scambiati. '
        'Ogni file ha l\'intestazione `# montaggio [...]` (la matrice usata dal telefono) e le righe nel formato di `PH.recPush`. Sono i dati che hanno portato al riconoscimento automatico dell\'ordine degli assi.')]
s += sec('11.3 Collaudo sull\'emulatore')
s += bullets(['`tools/emu_test.sh`: installa l\'APK di collaudo, primo avvio senza permessi (schermata), tocco su «Consenti» se il sistema lo chiede, permessi di posizione concessi da adb, posizione finta ripetuta ogni 2 s, poi `emu_cdp.py`; alla fine estrae dal logcat crash Java, problemi del renderer, errori della console e del processo.',
              '`tools/emu_cdp.py`: trova il socket `webview_devtools_remote_*`, valuta espressioni nella pagina e fa schermate: avvio e versione, accettazione delle condizioni, fix GPS, «Prima del volo», Impostazioni, Piano, Info, '
              'pagine e zoom, spazi aerei, carburante, rotta, profilo, traffico, volo dimostrativo, telefono in orizzontale; misura anche il blocco più lungo del disegno.',
              'Limiti: l\'emulatore non ha sensori di movimento reali, Bluetooth, GDL90 né orologio; la parte Java non è coperta da test unitari.'])
s += sec('11.4 Archivio degli scarti dei sensori')
s += [P('`docs/sensori/scarti.json` raccoglie le misure vere dei sensori di pressione: dispositivo (solo il modello), pressione letta, riferimento (METAR o altro dispositivo), scarto in hPa e in metri, note e osservazioni '
        '(per esempio l\'«avviso temporale» del fenix nelle salite e discese rapide). Serve da riferimento e, in futuro, come scarto di partenza per i dispositivi dello stesso modello. Prime misure: Galaxy S23 FE, Galaxy S23, fenix 7.')]
s += sec('11.5 Altre verifiche')
s += bullets(['`SKILL.md` chiede, prima di dire «provato», la compilazione con `vm.Script` di ogni `<script>` inline, il test dell\'assetto e una prova nel browser con Playwright (errori di pagina e di console).',
              'Nessun test automatico per: verifica dei codici di licenza tra Python e WebCrypto, `posta_licenze.py`, `Gdl90Parser`, lettura NMEA, TAWS, parser OpenAir e NOTAM, Calcola rotta, service worker, app dell\'orologio.'])

# =====================================================================================================
# 13. SICUREZZA E PRIVACY
# =====================================================================================================
s += chap(12, 'Sicurezza e privacy')
s += sec('12.1 Chiavi e segreti')
s += bullets(['<b>Firma delle app</b>: `keystore/strumento.keystore.enc` è nel repository solo cifrato (`openssl enc -aes-256-cbc -pbkdf2 -iter 200000`); la password è `KEYSTORE_PASSWORD`, usata anche come password del keystore e della chiave in `build.gradle`. '
              'La stessa password cifra la chiave da sviluppatore Garmin. Su Play la firma finale è di Google (Play App Signing); la chiave del repository è la chiave di caricamento e firma gli APK di GitHub.',
              '<b>Licenze</b>: chiave privata, registro e stato dei prezzi cifrati sul ramo `licenze` con la password dedicata `LICENZE_PASSWORD` (dal cambio registrato in `cifratura-v2.txt`); decifrati solo in `$RUNNER_TEMP` con `umask 077` e cancellati a fine corsa.',
              '<b>Gmail</b>: password per le app nel segreto `GMAIL_LICENZE`; senza il segreto il workflow non fa niente. <b>Apps Script</b>: token GitHub limitato al solo repository e ad Actions, con promemoria della scadenza nel Calendar.',
              '<b>Log</b>: il repository è pubblico, quindi `posta_licenze.py` stampa solo conteggi e, in caso di eccezione, solo il tipo dell\'errore («potrebbe contenere un indirizzo»).'])
s += sec('12.2 Cosa è pubblico')
s += bullets(['Tutto il codice (con licenza «tutti i diritti riservati»), i workflow, la chiave pubblica delle licenze (`PUB`), la chiave pubblica di licenza della Play Console e le impronte dei certificati in `LicenzaPlugin.java`, '
              'la chiave pubblica di Web3Forms (`PH_INFO.w3f`, fatta per stare nelle pagine), l\'indirizzo della casella di HORIZON e il link PayPal dell\'autore.',
              'Sul ramo `licenze`: `revocate.json` (numeri e date), `chiave_pubblica.txt`, i file cifrati, `ultimo_riepilogo.txt` (una data), le righe anonime delle piste.',
              'I campi di input di `licenze.yml` finiscono nei log di GitHub: il workflow avverte di non mettere dati personali; il codice di licenza può comparire perché vale solo sul telefono per cui è fatto.'])
s += sec('12.3 Impronta e filigrana dell\'autore')
s += bullets(['<b>Impronta nel codice</b>: `PH_INFO.impronta` = `HZ·ED·2026·DA8A3A7ED40C` (prime 12 cifre dello SHA-256 di una frase con il nome dell\'autore). Non è un commento: il codice la usa nella prima riga di `PH.diag` '
              '(quindi in ogni segnalazione), in Info sotto la licenza e nella filigrana, per cui resta anche nel codice compresso o copiato.',
              '<b>Filigrana sulle schermate</b>: `#hzFil`, un testo fisso in basso a sinistra su tutte le pagine di `index.html` (in `app.html` solo se aperto da solo): «HORIZON © E. D\'Amico · codice del telefono · fine dell\'impronta». '
              'Carattere di 8 px ridotto a metà, grigio, opacità 0,2 e trasparente ai tocchi: durante l\'uso non si nota, ma si legge ingrandendo uno screenshot e dice da quale telefono viene.',
              'Restano le intestazioni «© 2026 Enrico D\'Amico · Tutti i diritti riservati» in testa ai file. La prova più forte dell\'origine è la storia pubblica di git, con le date di ogni modifica; la filigrana è un deterrente e una traccia.'])
s += sec('12.4 Privacy (sintesi di PRIVACY.md)')
s += bullets(['Nessun account, pubblicità o analisi. Posizione, assetto, rotte, campi, diario e impostazioni restano sul telefono (posizione usata solo con l\'app aperta).',
              'Escono: tessere di mappe e terreno della zona mostrata, coordinate dei campi a Open-Meteo, sigle ICAO ad aviationweather.gov, riquadro arrotondato a 0,1° a Overpass e ai servizi di traffico, '
              'controllo degli aggiornamenti a GitHub, segnalazioni inviate dal pilota (con dati tecnici facoltativi, mai la posizione).',
              '<b>Archivio comune anonimo</b>: con il consenso, chiesto solo a terra (`PH.aTerra`, mai in volo), l\'app manda le piste rilevate (centro, direzione, lunghezza, quota, campo vicino) e una volta alla settimana '
              'il conteggio di decolli e atterraggi per campo, con un codice casuale di 8 caratteri (`PH.anonId`). Una pista entra nelle mappe di tutti se la vedono almeno 3 telefoni (centro entro 300 m, direzione entro 12°) o dopo il controllo dell\'autore.',
              'Donazioni: Play Billing su Play, PayPal fuori dall\'app su APK e web.',
              'Aggiornata al 6 novembre 2026: non parla ancora della richiesta di licenza (email e codice del telefono, registro con nome e mail), dell\'orologio Garmin (battito, SpO₂) né della lista delle revoche (vedi proposte).'])

# =====================================================================================================
# 14. PROPOSTE
# =====================================================================================================
s += chap(13, 'Proposte e rischi')
s += [P('Osservazioni nate leggendo il codice, in ordine di priorità: P1 da fare presto, P2 utile, P3 quando capita. Dove un punto non è verificato in esecuzione lo si dice.')]
PROP = [
    ['P1', 'Prova automatica Python ↔ WebCrypto dei codici di licenza', 'Il formato è scritto due volte (base32 e struttura in `licenze.py` e in `riservato.js`); `SKILL.md` lo segna come «resta da fare». '
     'Un test in CI che genera codici con una chiave di prova (tutti i tipi, numeri al limite dei 24 bit, scadenza 65535) e li verifica con `PH._licLeggi` in Node (WebCrypto è in `globalThis.crypto`) eviterebbe codici rifiutati in silenzio.'],
    ['P1', 'Pagamenti PayPal «amici e familiari»', 'La mail dei prezzi chiede esplicitamente «Per amici e familiari» verso un conto personale: per PayPal è un uso non previsto per la vendita di beni e servizi (rischio di '
     'limitazione del conto) e il pilota non ha la protezione acquisti. Valutare un conto Business con «beni e servizi» o un fornitore di pagamenti, almeno prima di accendere il blocco della licenza.'],
    ['P1', 'Blocco della licenza ancora spento', 'Oggi un codice valido o assente non cambia niente. Prima di accenderlo servono: le regole «mai in volo» in un punto solo, la pagina a terra, la prova di 30 giorni, la tolleranza sulle revoche '
     'senza rete e i test sui casi limite (orologio indietro, telefono cambiato, ANDROID_ID diverso dopo un ripristino di fabbrica).'],
    ['P2', 'Numeri di licenza in conflitto', '`licenze-posta.yml` e `licenze.yml` hanno gruppi di concorrenza diversi e calcolano entrambi «massimo + 1»: due giri contemporanei possono dare lo stesso numero a due telefoni. '
     '`registro_unisci.py` lo segnala con «conflitto», ma le revoche sono per numero e colpirebbero tutte e due. Un gruppo di concorrenza comune solo per la scrittura del numero, o un numero assegnato dopo il push, chiuderebbe il caso.'],
    ['Fatto', 'Etichetta «Piste lette» tra virgolette doppie (corretto il 9/11/2026)', 'Trovato durante la stesura di questo dossier: `posta_licenze.py` passava `\'"Piste lette"\'` a `etichetta()`, che aggiunge già le virgolette alle etichette con spazi. Corretto: ora si passa `Piste lette`.'],
    ['P2', 'Ritardi dei cron di GitHub', 'Sul repository i cron partono con ore di ritardo; per le licenze il problema è aggirato dalla sveglia di Apps Script, che però dipende da un token annuale (promemoria già nel Calendar). '
     'La copia notturna degli spazi aerei di `pubblica-web.yml` resta soggetta al ritardo: si potrebbe farla partire dalla stessa sveglia una volta al giorno.'],
    ['P2', 'Diagnosi delle chiusure dell\'orologio («IQ!»)', 'La scatola nera dice dove era il codice, non l\'errore. `tick()` e `onPhone()` non sono protetti da `try/catch` (solo `onUpdate` lo è): avvolgerli e salvare il messaggio '
     'dell\'eccezione in Storage darebbe la causa. Utile anche leggere `CIQ_LOG` / ERA dal portale sviluppatori e registrare il picco di memoria, non solo l\'ultimo valore.'],
    ['P2', 'PRIVACY.md da aggiornare', 'Mancano: richiesta di licenza (email, codice del telefono; nome e mail nel registro cifrato), dati dell\'orologio in HORIZON 2 (battito e SpO₂, dati sanitari), lettura della lista delle revoche e scarico della carta VFR.'],
    ['P2', 'Lacune nei test', 'Senza prove automatiche: `Gdl90Parser` (si potrebbe provare con javac nella CI, come dice il suo commento), lettura NMEA e scelta della fonte, TAWS, parser OpenAir/NOTAM, Calcola rotta, posta delle licenze '
     '(con la classe `Posta` sostituita, come nella prova locale citata in `SKILL.md`), app dell\'orologio (il container `connectiq-tester` può eseguire test Monkey C).'],
    ['P3', 'Dimensione di index.html', f'{righe_di("www/index.html"):,} righe e {kb("www/index.html")}'.replace(',', '.') + ' in un solo script, con funzioni ridefinite in più punti (per esempio `PH.show`, `togglePage`, `PH.renderImp` avvolte dai moduli). '
     'Spostare gradualmente le sezioni stabili (DEM, traffico, diario, simulazione) in moduli come quelli già esistenti renderebbe più facili test e revisioni; `test_assetto.js` dipende dalla forma esatta di alcune righe di `index.html`.'],
    ['P3', 'Libreria SQLite anche nell\'APK', '`prepare_www.py` esclude `sqlite3.js`, `sqlite3.wasm` e `carta-web.js` dall\'APK, ma la CI fa `cap sync` direttamente su `www/` del repository: circa 1,5 MB inutili nell\'app Android (lì c\'è il plugin nativo).'],
    ['P3', 'Due calcoli del ciclo AIRAC', '`PH.airac` in `carta.js` e `airac` in `app.html` fanno la stessa cosa in due modi: una funzione sola eviterebbe divergenze.'],
    ['P3', 'Nomi e percorsi', '«Sonda fonti spazi aerei» prova in realtà Polar; `build_manuale_app.py` scrive in percorsi fuori dal repository (`/mnt/user-data`, `/home/claude`) e non è riproducibile da qui; la cache del service worker ha un nome fisso (`ia517-app-1.0.0`).'],
    ['Fatto', 'Barometro del telefono (9 novembre 2026)', 'Plugin `BarometroPlugin` e fusione con il GPS in `PhVario`: vario dal barometro, quota assoluta dal GPS tarato; barometro dell\'orologio corretto sul telefono (capitolo 3.4). Da verificare in volo contro l\'altimetro di bordo.'],
]
s += [table(['', 'Proposta', 'Perché'], PROP, [10 * mm, 44 * mm, 120 * mm])]

# =====================================================================================================
# 15. APPENDICE CODICE
# =====================================================================================================
s += chap(14, 'Appendice: il codice')
s += [P('Estratti scelti, letti dal repository mentre si genera il documento (i numeri di riga sono quelli del file attuale). Le righe molto lunghe vanno a capo; '
        'quelle oltre i 360 caratteri sono accorciate con «…».')]
s += estratto('www/index.html', r'^PH\.onPos=function', 7, 'Fix del GPS del telefono',
              'Il fix del browser diventa un oggetto «fix» comune a tutte le fonti: quota riportata al livello del mare con il geoide fisso, precisione in metri, ora del fix e ora di ricezione.')
s += estratto('www/index.html', r'^PH\.fixes=\{\}', 13, 'Scelta della fonte di posizione',
              '`PH.srcPick`: con una fonte fissa la restituisce sempre; in automatico considera solo i fix degli ultimi 2,5 s, cambia fonte solo dopo 5 s di vantaggio oltre il 30% (`a(best) > a(cur)*0.7`) '
              'e subito se quella in uso tace. `PH.fixIn` applica solo il fix della fonte scelta.')
s += estratto('www/index.html', r'^PH\.gloLine=function', 12, 'Garmin GLO 2: frasi NMEA',
              'Checksum, GGA memorizzata (valida 1,5 s), RMC con stato «A» trasformata in fix; la precisione è stimata da HDOP × 3 con un minimo di 2,5 m.')
s += estratto('www/index.html', r'^PhMahony\.prototype\.update', 14, 'Cuore del filtro di assetto (Mahony)',
              'La fiducia nell\'accelerometro (`trust`) cala con la distanza da 1 g e con la rotazione; l\'errore tra gravità misurata e stimata (prodotto vettoriale) corregge il giroscopio con il guadagno proporzionale e un integrale limitato; '
              'infine il quaternione si integra e si normalizza.')
s += estratto('www/index.html', r'^  const V=\(S\.gpsReal && S\.gs>15\)', 9, 'Compensazione della virata con la velocità GPS',
              'Si tolgono dalla forza specifica le accelerazioni dovute alla virata e alla variazione di velocità; con la virata dal GPS si tiene solo la direzione della forza quando il suo modulo è quello atteso, così l\'inclinazione converge.')
s += estratto('www/index.html', r'^PH\.level=function', 16, 'LIVELLA: la matrice di montaggio',
              'Dalla gravità media si ricavano «giù», «avanti» (−z dello schermo proiettato) e «destra» (prodotto vettoriale); il beccheggio a terra ruota avanti e giù. Il filtro riparte già allineato.')
s += estratto('www/index.html', r'^PhVario\.prototype\.predict', 13, 'Vario: filtro complementare del 3° ordine',
              '`predict` integra l\'accelerazione verticale solo con un fix recente; `correct` corregge quota, velocità e bias, scarta i salti isolati e riparte dopo un buco.')
s += estratto('www/index.html', r'^PH\.baroIn=function', 10, 'Barometro del telefono: fusione con il GPS',
              'Ogni lettura diventa quota-pressione standard; con lo scarto agganciato corregge il filtro del vario 5 volte al secondo. Lo scarto lo tiene giusto il GPS in `PH.applyFix`.')
s += estratto('www/index.html', r'^PH\.alert=function', 7, 'Punto unico degli avvisi',
              'Silenziamento per chiave, bandierina o avviso centrale, poi voce e vibrazione al più una volta per intervallo (`every`, di serie 60 s).')
s += estratto('www/index.html', r'^PH\.checkTerrain=function', 13, 'TAWS',
              'Proiezione lungo la traccia ogni 5 s fino a 60 s con il vario attuale: margine sotto 100 ft entro 30 s = rosso, sotto 300 ft = giallo.')
s += estratto('android/app/src/main/java/it/amicoen/horizon/GloSerialPlugin.java', r'private void startReader', 34, 'GloSerialPlugin: lettura in un thread',
              'Righe NMEA raccolte e mandate alla pagina a gruppi (100 ms o 40 righe); alla caduta del collegamento l\'evento «state» avvisa la pagina, che torna al GPS del telefono.')
s += estratto('android/app/src/main/java/it/amicoen/horizon/Gdl90Parser.java', r'public List<Target> parse', 31, 'Gdl90Parser: messaggi, escape e CRC',
              'Ogni messaggio è racchiuso tra 0x7E; l\'escape 0x7D si toglie con XOR 0x20; il CRC-CCITT è in coda con il byte meno significativo prima. Si leggono solo i messaggi 10 e 20 lunghi almeno 28 byte.')
s += estratto('www/orologio.js', r'^function dati\(d\)', 13, 'orologio.js: messaggi dall\'orologio',
              'I tasti diventano i comandi della manopola; i dati diventano un fix della fonte «fenix» con precisione stimata dalla qualità Garmin e, se richiesto, quota barometrica con il QNH.')
s += estratto('www/orologio.js', r'^setInterval\(\(\)=>\{ if\(!PH\.fenix\.stato\.collegato\)', 7, 'orologio.js: dati e avvisi verso l\'orologio',
              'Dati da mostrare ogni 2 s; `PH.alert` avvolta per mandare all\'orologio solo gli avvisi che hanno appena parlato.')
s += estratto('garmin/source/HorizonApp.mc', r'function dati\(\)', 34, 'HorizonApp.mc: dati()',
              'Il dizionario dei sensori con chiavi corte per occupare poco nella trasmissione: posizione solo con qualità almeno POOR, SpO₂ dal sensore o dallo storico con l\'età, pressione ambiente, memoria e la scatola nera della sessione precedente.')
s += estratto('garmin/source/HorizonApp.mc', r'function tick\(\) as Void', 19, 'HorizonApp.mc: il secondo dell\'orologio',
              'Un solo invio alla volta (Garmin Connect può metterci secondi), coda corta, salvataggio periodico della traccia e della memoria.')
s += estratto('www/riservato.js', r'^async function leggi', 17, 'riservato.js: verifica del codice',
              'Decodifica base32, verifica ECDSA P-256 con WebCrypto sulla chiave pubblica, poi lettura dei campi con `DataView` (big-endian, come `struct.pack(\'>BcHH\')` in Python).')
s += estratto('tools/licenze.py', r'^def genera', 10, 'licenze.py: generazione del codice',
              'Struttura binaria, firma DER convertita in (r, s) di 32 byte, base32 a gruppi di 5 con il prefisso HZ1.')
s += estratto('tools/posta_licenze.py', r'# 2\. pagate', 28, 'posta_licenze.py: dal pagamento al codice',
              'Ciclo sulle etichette M, A, P: controlli contro i doppioni (Message-ID nel registro, stesso telefono e tipo oggi), numero nuovo, codice verificato, risposta, registro scritto subito, etichette sistemate. Ogni mail è trattata da sola: un errore la manda in «Da vedere».')
s += estratto('tools/gmail-licenze/HORIZON-Licenze.gs', r'^function sveglia', 12, 'Apps Script: la sveglia',
              'Ogni minuto, con 4 minuti di pausa dopo un avvio: se c\'è lavoro o se non è ancora partito il giro del giorno (dalle 7), chiama `workflow_dispatch`.')
s += estratto('www/carta-web.js', r'^  async scarica', 20, 'carta-web.js: importazione nella memoria del sito',
              'Il corpo della risposta passa a pezzi da `fetch` a `pool.importDb` senza tenere il file in RAM; la carta si verifica aprendo i metadati e le versioni vecchie si cancellano solo alla fine.')
s += estratto('www/sw.js', r"^self\.addEventListener\('fetch'", 10, 'Service worker: strategie di cache',
              'Terreno e mappe dalla cache, meteo dalla rete con ripiego, pagine del sito «stale while revalidate»; il controllo della versione (`?chk`) va sempre in rete.')

s += [Spacer(1, 6 * mm), HRFlowable(width='100%', thickness=0.6, color=GREY),
      P(f'Documento generato da `tools/build_dossier_tecnico.py` il {DATA}. Figure: {len(FIGURE)}; estratti di codice: {len(CODICI)}. '
        'Diagrammi rifatti con `node docs/dossier/src/disegna.js`, schermate con `docs/dossier/src/schermate.js`.', SM)]

# liste annidate (bullets dentro una lista) → elenco piatto
def _piatto(x):
    for y in x:
        if isinstance(y, (list, tuple)): yield from _piatto(y)
        else: yield y


s = list(_piatto(s))
# un titolo non resta mai da solo in fondo alla pagina
_k, i = [], 0
while i < len(s):
    f = s[i]
    if isinstance(f, Paragraph) and f.style.name in ('H2', 'H3') and i + 1 < len(s) and not isinstance(s[i + 1], (PageBreak, CondPageBreak)):
        nx = s[i + 1]   # niente KeepTogether dentro un altro: ReportLab non ne misura bene l'altezza
        _k.append(KeepTogether([f] + (list(nx._content) if isinstance(nx, KeepTogether) else [nx]))); i += 2; continue
    _k.append(f); i += 1
s = _k


# dalla seconda pagina in poi: modello con intestazione
from reportlab.platypus.doctemplate import NextPageTemplate
s.insert(0, NextPageTemplate('pagina'))

doc = Dossier(str(OUT), pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=16 * mm, bottomMargin=17 * mm,
              title='HORIZON · dossier tecnico', author="Enrico D'Amico", subject='Architettura e funzionamento del software HORIZON')
doc.multiBuild(s)
print(OUT, f'{OUT.stat().st_size / 1024:.0f} KB', f'{len(FIGURE)} figure', f'{len(CODICI)} estratti')
for n, c in enumerate(FIGURE, 1): print(f'  Figura {n}: {c[:90]}')
