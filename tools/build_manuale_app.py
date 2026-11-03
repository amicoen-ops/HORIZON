#!/usr/bin/env python3
# HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
# Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
# -*- coding: utf-8 -*-
# Manuale completo di HORIZON per telefono, tablet e browser
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle,
                                PageBreak, KeepTogether, HRFlowable, CondPageBreak)
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily
from PIL import Image as PILImage

FD = "/usr/share/fonts/truetype/dejavu/"
for n, f in [("DV", "DejaVuSans.ttf"), ("DVB", "DejaVuSans-Bold.ttf"), ("DVI", "DejaVuSans-Oblique.ttf"),
             ("DVC", "DejaVuSansCondensed.ttf"), ("DVCB", "DejaVuSansCondensed-Bold.ttf")]:
    pdfmetrics.registerFont(TTFont(n, FD + f))
registerFontFamily("DV", normal="DV", bold="DVB", italic="DVI", boldItalic="DVB")
registerFontFamily("DVC", normal="DVC", bold="DVCB", italic="DVC", boldItalic="DVCB")

VER = "1.0.56"
OUT = "/mnt/user-data/outputs/Manuale_HORIZON.pdf"
M = "/home/claude/android/man/"
NAVY = colors.HexColor("#0c447c"); MAG = colors.HexColor("#b0168f"); GREY = colors.HexColor("#5f5e5a")
DG = colors.HexColor("#2c2c2a"); ALT = colors.HexColor("#f4f2ec"); LINE = colors.HexColor("#cfcdc4")
OKC = colors.HexColor("#0f6e56"); AMB = colors.HexColor("#8a5a00"); RED = colors.HexColor("#a32020")

H1 = ParagraphStyle("H1", fontName="DVB", fontSize=22, leading=27, textColor=NAVY, alignment=TA_CENTER, spaceAfter=4)
SUB = ParagraphStyle("SUB", fontName="DV", fontSize=10.5, leading=15, textColor=GREY, alignment=TA_CENTER)
H2 = ParagraphStyle("H2", fontName="DVB", fontSize=14.5, leading=19, textColor=NAVY, spaceBefore=6, spaceAfter=6)
H3 = ParagraphStyle("H3", fontName="DVB", fontSize=10.8, leading=14, textColor=DG, spaceBefore=8, spaceAfter=3)
B = ParagraphStyle("B", fontName="DV", fontSize=9.2, leading=13.4, textColor=DG, spaceAfter=4)
BL = ParagraphStyle("BL", parent=B, leftIndent=11, bulletIndent=1, spaceAfter=2)
SM = ParagraphStyle("SM", fontName="DV", fontSize=7.9, leading=10.8, textColor=GREY)
CAP = ParagraphStyle("CAP", fontName="DVI", fontSize=7.6, leading=9.8, textColor=GREY, alignment=TA_CENTER, spaceBefore=2, spaceAfter=6)
C = ParagraphStyle("C", fontName="DVC", fontSize=8.1, leading=10.8, textColor=DG)
CB = ParagraphStyle("CB", parent=C, fontName="DVCB")
CH = ParagraphStyle("CH", parent=C, fontName="DVCB", textColor=colors.white)
TOC = ParagraphStyle("TOC", fontName="DV", fontSize=9.6, leading=15, textColor=DG, leftIndent=4)
W = 174 * mm


def img(path, w=None, h=None):
    im = PILImage.open(M + path); iw, ih = im.size
    if h is not None and w is None: w = h * iw / ih
    return Image(M + path, width=w, height=w * ih / iw)


def shots(items, w=52 * mm):
    """Riga di schermate: [(file, didascalia), ...]"""
    n = len(items); cw = W / n
    t = Table([[img(f, w) for f, _ in items], [Paragraph(c, CAP) for _, c in items]], colWidths=[cw] * n)
    t.setStyle(TableStyle([("ALIGN", (0, 0), (-1, -1), "CENTER"), ("VALIGN", (0, 0), (-1, -1), "TOP"),
                           ("LEFTPADDING", (0, 0), (-1, -1), 2), ("RIGHTPADDING", (0, 0), (-1, -1), 2)]))
    return t


def side(imgfile, flow, w=56 * mm, cap=""):
    """Schermata a sinistra, testo a destra"""
    cell = [img(imgfile, w)] + ([Paragraph(cap, CAP)] if cap else [])
    t = Table([[cell, flow]], colWidths=[w + 6 * mm, W - w - 6 * mm])
    t.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0),
                           ("RIGHTPADDING", (0, 0), (0, 0), 6 * mm), ("RIGHTPADDING", (1, 0), (1, 0), 0)]))
    return t


def table(head, rows, widths, hcol=NAVY):
    data = [[Paragraph(h, CH) for h in head]] + [[Paragraph(str(c), CB if i == 0 else C) for i, c in enumerate(r)] for r in rows]
    t = Table(data, colWidths=widths, repeatRows=1)
    st = [("BACKGROUND", (0, 0), (-1, 0), hcol), ("GRID", (0, 0), (-1, -1), 0.4, LINE), ("VALIGN", (0, 0), (-1, -1), "TOP"),
          ("LEFTPADDING", (0, 0), (-1, -1), 4), ("RIGHTPADDING", (0, 0), (-1, -1), 4), ("TOPPADDING", (0, 0), (-1, -1), 3),
          ("BOTTOMPADDING", (0, 0), (-1, -1), 3)]
    for i in range(1, len(data)):
        if i % 2 == 0: st.append(("BACKGROUND", (0, i), (-1, i), ALT))
    t.setStyle(TableStyle(st)); return t


def box(text, bg="#fbeaf0", border="#993556", w=W):
    t = Table([[Paragraph(text, SM)]], colWidths=[w])
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(bg)), ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor(border)),
                           ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                           ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6)]))
    return t


def tip(text, w=W): return box(text, "#e6f1fb", "#185fa5", w)
P = lambda t: Paragraph(t, B)
def bullets(items): return [Paragraph(i, BL, bulletText="•") for i in items]
def steps(items): return [Paragraph(i, BL, bulletText=f"{n}.") for n, i in enumerate(items, 1)]
def chap(n, title): return [CondPageBreak(60 * mm), Paragraph(f"{n}. {title}", H2)]


s = []
# ---------------- COPERTINA ----------------
s += [Spacer(1, 8 * mm), Paragraph("HORIZON · strumento di volo", H1),
      Paragraph("Manuale dell'app per telefono, tablet e browser", SUB),
      Paragraph(f"Versione {VER} · novembre 2026", SUB), Spacer(1, 8 * mm),
      shots([("11_volo_circuito.png", "Orizzonte in circuito"), ("12_mappa.png", "Mappa mobile"), ("21_simula.png", "Simulazione di una rotta")], 50 * mm),
      Spacer(1, 6 * mm),
      box("<b>Strumento sperimentale, non certificato.</b> L'app non è un equipaggiamento approvato da EASA, ENAC o altre autorità e non sostituisce "
          "gli strumenti di bordo, le carte, l'AIP, i NOTAM né il meteo ufficiale. Serve come ausilio alla consapevolezza della situazione. "
          "Il pilota in comando resta l'unico responsabile della condotta del volo."),
      Spacer(1, 6 * mm),
      Paragraph("© 2026 Enrico D'Amico · tutti i diritti riservati · amicoen@gmail.com", SUB),
      PageBreak()]

# ---------------- INDICE ----------------
CH_ = ["Che cos'è", "Installazione e aggiornamenti", "Primo avvio", "Montaggio del telefono e sensori",
       "La schermata VOLO", "L'orizzonte", "La mappa", "Comandi e gesti", "Il menu: direct to, rotte, QNH, pista",
       "Avvicinamento, circuito e atterraggio", "Piano, campi e meteo", "Spazi aerei, NOTAM e Desk Aeronautico",
       "Simula", "Avvisi: terreno, spazi aerei, tramonto, traffico", "GPS del telefono e Garmin GLO 2", "Quota",
       "Bussola e prua", "Vento e velocità vera", "Diario di volo", "Volare senza internet", "Mappe di base",
       "Impostazioni in sintesi", "Info, segnalazioni e scatola nera", "Tablet e telefono in orizzontale",
       "Problemi e soluzioni", "Limiti, responsabilità, licenza e privacy", "Fonti dei dati"]
s += [Paragraph("Indice", H2)] + [Paragraph(f"{i}. {t}", TOC) for i, t in enumerate(CH_, 1)] + [PageBreak()]

# 1 ---------------------------------------------------------------
s += chap(1, CH_[0])
s += [P("HORIZON porta sul telefono lo strumento di volo nato come strumento da 80 mm per un Avid Flyer, ora per qualsiasi ultraleggero o aereo VFR, con un profilo per ogni velivolo: orizzonte sintetico, mappa mobile, guida verso il campo "
        "con circuito e atterraggio, avvisi di terreno e spazi aerei. In più usa quello che il telefono ha: GPS, sensori di movimento, bussola, internet.")]
s += bullets(["<b>Assetto</b> dai sensori del telefono, con lo stesso filtro della scheda sensori dello strumento e la compensazione di virata con la velocità GPS.",
              "<b>Terreno vero</b> (modello digitale del terreno) nella vista sintetica e nella mappa, con l'avviso «TERRENO! CABRA».",
              "<b>Mappa</b> da 1 a 700 km, con OpenTopoMap, OpenStreetMap, satellite Esri, tavolette IGM 1:25.000 e ortofoto.",
              "<b>342 campi</b> di tutto il Nord Italia, con le piste, più quelli che aggiungi tu.",
              "<b>Piano di volo</b> con meteo del modello sui campi, METAR e TAF, NOTAM e spazi aerei OpenAir confrontati con la rotta.",
              "<b>Simula</b>: lo strumento vola da solo una rotta, per provarla a terra.",
              "<b>Vento e velocità vera</b> stimati dalle virate, senza Pitot.",
              "<b>Diario di volo</b> automatico con traccia GPX.",
              "<b>Garmin GLO 2</b> via Bluetooth, o il GPS del telefono.",
              "Funziona <b>senza internet</b>, se scarichi prima terreno e mappe."])
s += [P("Il telefono non ha Pitot e l'app non usa il barometro: la velocità è quella al suolo, la quota è quella GPS. Il capitolo 26 elenca tutti i limiti.")]

# 2 ---------------------------------------------------------------
s += chap(2, CH_[1])
s += [box("<b>Requisiti</b>: Android 14 o più recente (consigliata l'ultima versione disponibile sul telefono); su iPhone e iPad l'ultima versione di iOS/iPadOS, con Safari. Sulle versioni più vecchie l'app non si installa o non funziona.", "#e6f1fb", "#185fa5")]
s += [Paragraph("APK da GitHub (con aggiornamenti e donazione)", H3)]
s += steps(["Sul telefono apri la pagina delle release: github.com/amicoen-ops/HORIZON/releases. Scarica il file <b>HORIZON-1.0.N.apk</b> della release più recente.",
            "Apri il file. La prima volta Android chiede di consentire l'installazione da questa fonte, cioè dal browser o dall'app File: consenti.",
            "Installa. Le versioni successive si installano sopra la precedente: rotte, campi, impostazioni e diario restano."])
s += [P("A ogni avvio con internet l'app controlla se c'è una versione nuova. Se c'è, compare la finestra <b>«Nuova versione disponibile»</b> con le novità e il tasto <b>«Aggiorna ora»</b>: l'app scarica l'APK e apre l'installazione di Android, tu confermi «Aggiorna» e l'app si riapre aggiornata, con rotte, campi, velivoli, impostazioni e diario intatti. "
        "La prima volta Android chiede il permesso <b>«Consenti da questa fonte»</b> per HORIZON: attivalo e torna nell'app, l'installazione riparte da sola. «Più tardi» rimanda al prossimo avvio. Lo stesso tasto c'è in <b>Info › Aggiornamenti</b>, con «Controlla ora». In volo la finestra non compare mai: aspetta che tu sia a terra.")]
s += [Paragraph("Versione del Play Store", H3)]
s += [P("È la stessa app, ma senza la donazione e senza il controllo degli aggiornamenti su GitHub: le regole di Google Play vietano tutte e due le cose. "
        "Si aggiorna dal Play Store, anche da dentro l'app: all'avvio, se il Play Store ha una versione nuova, compare «Aggiorna ora» e l'aggiornamento si installa con la finestra di Google. Le due versioni non si installano l'una sopra l'altra, perché quella del Play Store è firmata da Google. "
        "Per passare dall'una all'altra esporta rotte e diario, disinstalla quella che hai e installa l'altra.")]
s += [Paragraph("Versione da browser", H3)]
s += [P("All'avvio controlla se le pagine pubblicate sono cambiate: se sì propone «Aggiorna ora», che ricarica la versione nuova.")]
s += [P("La stessa app può girare anche nel browser Chrome, da un indirizzo https, e si installa con il menu ⋮ › <i>Installa app</i>. "
        "Ha qualche limite in più: il GLO 2 funziona solo con Chrome recente, i METAR vanno incollati a mano e le mappe solo http, come l'IGM, possono essere bloccate.")]

s += [Paragraph("iPhone, iPad e browser (Chrome, Safari)", H3)]
s += [P("La stessa app gira nel browser all'indirizzo <b>amicoen-ops.github.io/HORIZON</b>. Il link è anche in Info › Sul browser, anche iPhone e iPad, con i tasti Apri, Copia e Condividi.")]
s += steps(["Su iPhone o iPad apri l'indirizzo con <b>Safari</b>, poi Condividi › <b>Aggiungi alla schermata Home</b>: si apre a schermo intero e funziona anche senza internet.",
            "Al primo avvio tocca lo schermo una volta: iOS chiede di consentire i <b>sensori di movimento</b>. Poi consenti la posizione.",
            "Inclina un momento il telefono in avanti, quasi in piano: la bussola di iOS trova il nord e da lì la prua resta giusta anche col telefono dritto in cabina."])
s += bullets(["Il Garmin GLO 2 su iPhone funziona come posizione del sistema: abbinalo nelle impostazioni Bluetooth e l'app lo usa senza fare altro.",
              "Su iPhone non c'è la vibrazione negli avvisi; la voce sì.",
              "Gli spazi aerei d'Italia arrivano da una copia di openAIP aggiornata ogni notte sullo stesso sito."])

# 3 ---------------------------------------------------------------
s += chap(3, CH_[2])
s += [shots([("01_avvertenze.png", "Avvertenze da accettare"), ("02_donazione.png", "Invito alla donazione (primi 5 avvii)"), ("03_attesa_gps.png", "In attesa di GPS e sensori")], 48 * mm)]
s += steps(["<b>Avvertenze.</b> Al primo avvio, e quando cambiano, l'app mostra avvertenze e licenza. Si accettano con la spunta.",
            "<b>Permessi.</b> Consenti la <b>posizione precisa</b>, senza la quale non ci sono GPS, mappa e navigazione. Il permesso «dispositivi nelle vicinanze» serve solo se colleghi il GLO 2.",
            "<b>Donazione.</b> Nei primi 5 avvii compare un invito con PayPal: «Più tardi» lo chiude, «Ho già donato» lo spegne per sempre. "
            "Non compare mai se l'app si riapre in volo o in movimento, e non c'è nella versione del Play Store.",
            "<b>In attesa di GPS e sensori.</b> Finché non arriva la prima posizione l'app lo dice. All'aperto bastano pochi secondi. "
            "«Volo dimostrativo» fa vedere lo strumento in volo simulato; «Chiudi» toglie il riquadro."])
s += [tip("Prima del primo volo, con il WiFi, vai in <b>Impostazioni › Volare senza internet</b> e scarica terreno e mappa della zona (capitolo 20).")]

# 4 ---------------------------------------------------------------
s += chap(4, CH_[3])
s += [side("32_imp_montaggio.png", [
    P("<b>Di serie</b> il telefono sta in verticale, con lo schermo verso il pilota e il dorso verso il muso. Può essere dritto o girato in orizzontale, "
      "da una parte o dall'altra: l'app segue il verso dello schermo e, quando lo giri, l'orizzonte si rilivella da solo."),
    P("<b>Livellare.</b> Se il supporto è inclinato o montato diversamente, livella."),
    *bullets(["<b>Livella ora</b>: in volo rettilineo e livellato, ali orizzontali.",
              "<b>Livella a terra</b>: con l'aereo fermo, indicando di quanto è cabrato. Per un biciclo come l'Avid circa 10–12°.",
              "<b>Telefono verticale</b> torna al montaggio di serie."]),
    P("<b>Supporto rigido.</b> Le vibrazioni del supporto entrano nell'assetto: usa un supporto rigido, lontano da magneti e cavi di potenza, che disturbano la bussola."),
], 70 * mm, "Impostazioni › Montaggio")]
s += [Paragraph("Orizzonte più morbido e fotogrammi", H3)]
s += [P("Il cursore <b>Orizzonte più morbido</b> va da 0 (risposta immediata) a 1 secondo e parte da 0,3. Più è morbido, meno trema con vibrazioni e movimenti della mano, "
        "ma l'orizzonte arriva un po' dopo il movimento vero: in volo va bene 2–4. "
        "<b>Fotogrammi al secondo</b>: 30 di serie, che consumano meno batteria e scaldano meno, oppure 60, più fluidi.")]
s += [Paragraph("Sensori usati", H3)]
s += [table(["Sensore", "A che cosa serve"], [
    ["Giroscopio e accelerometro", "Assetto (rollio e beccheggio) con filtro Mahony, sbandamento, accelerazione verticale per il vario."],
    ["GPS (telefono o GLO 2)", "Posizione, velocità al suolo, traccia, quota; compensazione di virata; stima del vento."],
    ["Bussola (sensore di rotazione di Android)", "Prua a terra e da lenti, corretta in prua vera con la declinazione magnetica."],
    ["Internet", "Terreno, mappe, meteo, METAR e TAF, aggiornamenti, segnalazioni. Tutto il resto funziona senza."],
], [52 * mm, 122 * mm])]

# 5 ---------------------------------------------------------------
s += chap(5, CH_[4])
s += [side("10_volo_crociera.png", [
    P("Dall'alto in basso:"),
    *bullets(["<b>Lo strumento</b>, rotondo come quello da 80 mm, con due pagine: orizzonte e mappa.",
              "<b>Le spie di stato</b>: GPS (o GLO 2), ASSETTO, TERRENO, la rete e la batteria. Verde va bene, giallo è incompleto, rosso manca. "
              "La rete mostra la generazione e il segnale in percentuale (per esempio <b>4G 70%</b> o <b>5G 45%</b>; giallo sotto il 25%), oppure <b>WIFI</b>, o <b>NO NET</b> in rosso. "
              "<b>BATT</b> è la carica del telefono: ⚡ quando è in carica, giallo sotto il 40%, rosso sotto il 20% e anche quando il telefono supera i 45 °C. "
              "In simulazione al loro posto c'è la scritta <b>SIMULAZIONE</b>: toccandola si apre la scheda per fermarla.",
              "<b>I comandi</b> ◀ OK ▶ PAGINA, gli stessi della manopola dello strumento (capitolo 8).",
              "<b>Otto riquadri</b>: GS (velocità al suolo), QUOTA, VARIO, TRK o PRUA, VENTO, DESTINAZIONE (distanza e tempo), VOLO (durata) e TRAMONTO.",
              "<b>La barra in basso</b>: quattro tasti grandi, VOLO, PIANO, ✈ TRAFFICO e ☰ ALTRO. ALTRO apre una griglia di tasti grandi con IMPOSTAZIONI, SIMULA, PROFILO, ⛽ CARBURANTE e INFO, che resta aperta finché non scegli una voce o tocchi ✕ CHIUDI. In orizzontale la barra resta sempre visibile in fondo alla colonna."]),
    P("Il riquadro TRK mostra la traccia GPS quando ti muovi. Da fermo la traccia è solo rumore, quindi il riquadro diventa <b>PRUA</b> e mostra la bussola."),
], 62 * mm, "La schermata VOLO in crociera")]

s += [tip("Tastino <b>LIVELLA</b> (bordo giallo e nero) accanto alle spie di stato: livella l'assetto senza aprire le impostazioni. In volo usa ali livellate e volo rettilineo; a terra usa l'assetto a terra impostato. Chiede sempre conferma con OK.")]

# 6 ---------------------------------------------------------------
s += chap(6, CH_[5])
s += [side("11_volo_circuito.png", [
    *bullets(["<b>Cielo e terreno</b>: dove il modello del terreno è scaricato, la vista sintetica mostra rilievi veri. Il terreno sotto 180 m di margine si colora di giallo, sotto 60 m di rosso (solo in volo).",
              "<b>Simbolo dell'aereo</b> giallo e scala di beccheggio ogni 5° e 10°; in alto la scala di rollio con l'indice.",
              "<b>Pallina dello sbandamento</b> sotto l'indice di rollio.",
              "<b>Scala sinistra</b>: velocità al suolo in km/h (GS). Senza Pitot non ci sono archi di stallo.",
              "<b>Scala destra</b>: quota GPS in ft, con il vario in m/s e il segno della quota obiettivo (magenta).",
              "<b>In basso</b>: prua con la scala, finestra della destinazione (sigla, km, minuti) e QNH.",
              "<b>Guida</b>: le porte magenta e la barra di direzione portano sulla rotta, sul circuito e sul sentiero di discesa.",
              "<b>Fase</b> in alto, per esempio «SOTTOVENTO SX · PISTA 36»; il vento nel riquadro, con PREV (previsto) o stimato in volo.",
              "<b>Croci rosse</b> su una scala: quel dato manca o è vecchio, per esempio GS e ALT senza GPS."]),
], 62 * mm, "Orizzonte in circuito, sottovento sinistro")]

s += [tip("Virate: l'app confronta il giroscopio con la velocità di virata misurata dal GPS. Se il giroscopio manca, o per qualche secondo non segue una virata che il GPS vede chiaramente, l'orizzonte usa la virata del GPS. In Info › dati tecnici la riga «Giroscopio» dice quale fonte è in uso.")]

# 7 ---------------------------------------------------------------
s += chap(7, CH_[6])
s += [shots([("12_mappa.png", "Mappa a 4 km, in circuito"), ("13_mappa_180.png", "Mappa a 180 km, campi come puntini")], 56 * mm)]
s += bullets(["<b>Orientamento</b>: la mappa gira con la traccia (TRK) e, da fermo, con la prua della bussola (PRUA). La N indica il nord.",
              "<b>Zoom</b>: 19 scale da 1 a 700 km, con due dita, con i pulsanti <b>+</b> e <b>−</b> o con ◀ ▶ sulla pagina mappa. L'ultima scala resta memorizzata. "
              "A 700 km si vede tutto il Nord Italia; oltre 60 km i campi diventano puntini e restano scritti solo gli aeroporti.",
              "<b>Anello tratteggiato</b> con la distanza scritta (metà della scala).",
              "<b>Campi</b>: azzurro aeroporto, bianco aviosuperficie, arancione altiporto, celeste ghiacciaio. Le piste sono disegnate col loro orientamento.",
              "<b>Rotta e circuito</b> in magenta, con ING, SV, BASE, FIN e il punto «↓ discesa».",
              "<b>Terreno</b>: in volo giallo e rosso dove il margine è piccolo; con la mappa di base resta solo il colore di avviso.",
              "<b>Ostacoli e cavi</b>: triangoli arancioni e linee rosse tratteggiate («CAVI» fino a 8 km di scala).",
              "In basso il vento e la destinazione; sotto, l'attribuzione della mappa e lo stato del terreno."])

s += [Paragraph("Spostare la mappa", H3)]
s += [P("Trascina la mappa col dito per guardare un altro punto: la mappa passa a <b>nord in alto</b> (in alto c'è scritto NORD ↑), l'aereo resta disegnato dov'è e lo zoom (due dita o + e −) si fa sul punto guardato. "
        "Il tasto <b>⌖ CENTRA</b> riporta la mappa sull'aereo, con la traccia in alto.")]

s += [Paragraph("Profilo verticale", H3)]
s += [P("Tasto <b>PROFILO</b> in basso, oppure tocca la riga dello spazio aereo sotto lo strumento. È una pagina rettangolare con, lungo la rotta o davanti all'aereo (10, 25, 50, 100 km o tutta la rotta): "
        "il <b>terreno</b>, gli <b>spazi aerei</b> con base e tetto (rossi se vietati per il tuo tipo di volo, arancio se chiedono attenzione, blu se consentiti), la <b>quota dell'aereo</b> con la linea tratteggiata di dove ti porta il vario nei prossimi 2 minuti, la <b>crociera</b> della rotta e i suoi punti. "
        "Sotto: lo spazio in cui sei, il terreno più alto davanti con il margine alla quota attuale, e il primo spazio vietato che incontri. Si aggiorna ogni secondo.")]
s += [tip("Terreno 3D: in Impostazioni › Montaggio scegli il dettaglio (Normale, Alto, Massimo). In automatico parte dal massimo, con riquadri di circa 120 m vicino all'aereo, e scende da solo se il telefono non tiene i fotogrammi al secondo.")]

# 8 ---------------------------------------------------------------
s += chap(8, CH_[7])
s += [table(["Comando", "Che cosa fa"], [
    ["◀  ▶", "Ruotano, come la manopola: nel menu scorrono le voci, sulla mappa cambiano lo zoom, sull'orizzonte spostano il bug di prua (se acceso). Tenuti premuti ripetono."],
    ["OK", "Premi: apre il menu e conferma. Tenuto premuto cambia pagina (orizzonte o mappa)."],
    ["PAGINA", "Cambia pagina."],
    ["Sullo strumento", "Tocco = premi; trascina in orizzontale = ruota; tieni premuto = cambia pagina; due dita = zoom della mappa."],
    ["Pulsanti + e −", "Zoom della mappa; compaiono quando la mappa è visibile."],
    ["Telecomando o tastiera Bluetooth", "Frecce e PagSu/PagGiù = ruota; Invio, spazio o Play = premi; P = pagina."],
    ["Domande a schermo", "Per esempio «PISTA 36? OK: SÌ · ◀ ▶: NO». OK risponde sì, ruotare risponde no; senza risposta vale no."],
], [42 * mm, 132 * mm])]

# 9 ---------------------------------------------------------------
s += chap(9, CH_[8])
s += [shots([("14_menu.png", "Il menu"), ("15_direct_to.png", "DIRECT TO con ricerca"), ("16_nuova_rotta.png", "NUOVA ROTTA")], 50 * mm)]
s += [P("In cima al menu c'è sempre una barra con <b>◀ Indietro</b> (torna al menu principale, o chiude dal menu principale) e <b>✕</b> (chiude il menu).")]
s += [table(["Voce", "Uso"], [
    ["DIRECT TO…", "Elenco dei campi dal più vicino, con distanza e rotta. In alto c'è il campo di <b>ricerca</b>: scrivi il nome o la sigla (per esempio «asiago» o «LIDA») e Invio sceglie il primo trovato."],
    ["ROTTE SALVATE…", "Le rotte fatte nel Piano o con NUOVA ROTTA. Si attivano dal primo punto; se sei già sul primo, si parte dal secondo."],
    ["Rotta …  n/N", "Con una rotta attiva: premi per saltare al punto successivo."],
    ["Inverti rotta", "La stessa rotta al contrario."],
    ["NUOVA ROTTA…", "Si sceglie un punto dopo l'altro, con la stessa ricerca; ogni punto aggiunto riordina l'elenco dal più vicino all'ultimo. «✓ VOLA» salva e attiva la rotta, «↶» toglie l'ultimo punto."],
    ["QNH", "Premi e ruota per cambiarlo; arriva anche dal Piano (METAR)."],
    ["Pista …", "AUTO sceglie la pista col vento; oppure ne forzi una."],
    ["Lato circuito", "AUTO (dalle note del campo o dalla pista), SINISTRO o DESTRO."],
    ["Annulla rotta", "Toglie destinazione e rotta."],
], [36 * mm, 138 * mm])]

# 10 --------------------------------------------------------------
s += chap(10, CH_[9])
s += bullets(["<b>Verso il campo</b>: la guida porta al punto di ingresso del circuito alla quota impostata; la quota obiettivo è il segno magenta sulla scala della quota.",
              "<b>Pista</b>: con AUTO lo strumento sceglie la pista col vento (stimato in volo o previsto) e la pista preferenziale delle note del campo, rispettando il limite di vento in coda. "
              "Quando cambia la pista lo dice a voce.",
              "<b>Circuito</b>: ingresso, sottovento, base e finale, sul lato giusto e alla quota di circuito del campo. Il banner in alto dice la fase.",
              "<b>Finale</b>: sentiero di discesa, previsione dello spazio di arresto confrontata con la pista disponibile (verde, giallo, rosso).",
              "<b>Atterraggio</b>: a contatto la navigazione si chiude («ATTERRATO PISTA …»), compare la corsa con il punto di arresto; da fermo lo strumento misura quanto spazio hai usato e corregge la stima per le volte dopo.",
              "<b>Rotte</b>: i punti intermedi si sorvolano anticipando la virata; l'ultimo, se è un campo, porta al circuito; se è un punto, «FINE ROTTA»."])

# 11 --------------------------------------------------------------
s += chap(11, CH_[10])
s += [P("La barra PIANO apre il piano di volo, la stessa app che sullo strumento gira sul telefono del pilota. Qui è dentro l'app e parla con lo strumento direttamente (spia «Su questo telefono»). Ha cinque schede.")]
s += [shots([("40_piano.png", "Piano"), ("42_campi.png", "Campi"), ("43_meteo.png", "Meteo")], 50 * mm)]
s += [table(["Scheda", "Contenuto"], [
    ["Piano", "Partenza, arrivo, alternato, tappe; mappa della rotta; invio allo strumento («Invia allo strumento»): a terra la rotta è subito attiva, in volo arriva come proposta."],
    ["Briefing", "Controlli della rotta (spazi aerei, NOTAM, quote dei campi da confermare), profilo verticale con gli spazi aerei, NOTAM, Desk Aeronautico, quote dei campi (capitolo 12)."],
    ["Campi", "Nuovo campo o pista (sigla, nome, posizione, quota, piste) inviato subito allo strumento; i tuoi campi; note dei campi (pista preferenziale, lato e quota del circuito, ostacoli, vento in coda massimo)."],
    ["Meteo", "Modello Open-Meteo su ogni campo del piano: vento a 10 m, a circa 2500 e 5000 ft, raffiche, nubi, visibilità, QNH; METAR e TAF ufficiali scaricati da soli nell'APK; collegamenti a Desk Aeronautico."],
    ["Strumento", "Stato dello strumento (GPS, GLO 2, sensori, bussola, montaggio, quota, terreno, internet, dati salvati)."],
], [24 * mm, 150 * mm])]
s += [P("Sotto ogni scelta (partenza, tappe, arrivo, alternato) c'è una casella di ricerca: scrivi una parte del nome o la sigla, per esempio «asiago», e tocca il campo trovato; Invio sceglie il primo.")]
s += [Paragraph("Correggere o aggiungere un campo", H3)]
s += steps(["Piano › Campi › <b>Nuovo campo o pista</b>.",
            "Per correggere un campo che c'è, usa <b>Copia da un campo</b>: tieni la stessa sigla e cambia posizione, quota o piste.",
            "«Salva e invia allo strumento». Il campo tuo sostituisce quello dei dati, anche in volo, e resta salvato.",
            "Pista preferenziale, lato e quota del circuito, ostacoli: in <b>Note dei campi</b>. La quota letta sull'altimetro a terra, con il QNH: in Briefing › <b>Quote dei campi</b>."])

s += [Paragraph("Disegnare la rotta sulla mappa (schermo pieno)", H3)]
s += [P("In Piano › Rotta tocca <b>✎ Disegna sulla mappa</b>, oppure la piccola mappa della rotta. Si apre la mappa a schermo pieno con campi e spazi aerei.")]
s += bullets(["<b>Un tocco</b> aggiunge un punto in fondo alla rotta. Vicino a un campo il punto si aggancia al campo.",
              "<b>Trascina la linea magenta</b>: nasce un punto nuovo in quel punto della tratta, e lo porti dove vuoi (per esempio per girare intorno a una zona R o P).",
              "<b>Trascina un punto</b> per spostarlo; portalo sopra il punto vicino e rilascia per <b>toglierlo</b>.",
              "<b>Punti di riporto VFR</b> (cerchio con la V, per esempio LEW1 Ivrea o MFNE1 Candia, da openAIP): toccali per metterli in rotta.",
              "<b>Tieni premuto</b> sulla mappa: segni un <b>punto da non sorvolare</b> (paese, casa, impianto) con raggio 1 o 2 km, oppure metti un punto di rotta lì. Tenendo premuto sul cerchio lo togli.",
              "<b>Tocca una tratta</b>: l'etichetta lungo la linea («8,6 km; 4 min; 349°») mostra anche la quota da tenere; in alto rotta, prua, vento e terreno più alto.",
              "Due dita per lo zoom, un dito sullo spazio vuoto per spostare la mappa. ↶ Annulla torna indietro di un passo; ⇄ Inverti; Svuota per ridisegnare da capo.",
              "Su ogni tratta: <b>prua</b> (con il vento previsto dal modello, se scaricato), <b>minuti</b>, <b>km</b> e la <b>quota</b> da tenere."])
s += [P("<b>Quota della tratta.</b> L'app cerca il terreno più alto entro 500 m dalla tratta (così le valli strette restano percorribili) e aggiunge il margine che scegli (500, 1000, 1500 o 2000 ft): è la <b>quota sicura</b>. "
        "Se sulla tratta c'è una zona da evitare con la base sopra il terreno (per esempio una CTA da 2500 ft per il VDS basico), propone di passarci sotto. "
        "<b>Il terreno vince sempre</b>: se la quota sicura entra in uno spazio aereo, l'etichetta dice SALI e l'elenco sotto la mappa dice in quale spazio entri, così chiedi l'autorizzazione o cambi rotta. "
        "«Quota sicura» porta la crociera alla quota sicura più alta della rotta.")]
s += [P("<b>Calcola rotta</b> cerca, tra un punto e il successivo, la strada più breve <b>in tempo</b> con il vento previsto, intorno alle zone P e R, agli spazi vietati dal tipo di volo e ai punti da non sorvolare, e dalle valli dove il terreno supererebbe la crociera. "
        "Aggiunge i punti R1, R2… Per ogni tratta propone la <b>quota ideale</b>: sopra il terreno con il margine, sotto la base delle zone da evitare, e tra queste quella con il vento migliore. "
        "Le zone in cui parti o arrivi non si possono girare: restano nell'elenco sotto la mappa. «Fatto» salva la rotta nel piano.")]
s += [Paragraph("Alternati con carburante (⛽)", H3)]
s += [P("Nel piano, sotto il carburante, la scheda <b>⛽ Alternati con carburante</b> elenca i campi con carburante adatto al motore del velivolo scelto (per MOGAS valgono anche UL91 e 100LL) entro 40 km dalla rotta. "
        "Per ognuno dice dove deviare (al km tale, dopo quale punto, quanti km fuori rotta) e con quanti litri e minuti arrivi, partendo con il carburante del piano. I campi sono divisi in tre fasce:")]
s += [table(["Fascia", "Significato"], [
           ["1 · comodo (verde)", "Arrivi con almeno la riserva del piano."],
           ["2 · riserva (giallo)", "Arrivi intaccando la riserva, ma con almeno 10 minuti."],
           ["3 · critico (rosso)", "Arrivi con meno di 10 minuti, oppure non ci arrivi."]], [45 * mm, 125 * mm])]
s += [P("La barra in alto mostra la rotta colorata secondo il carburante che resta (verde, giallo sotto la riserva, rosso sotto i 10 minuti) con i campi come pallini. "
        "Se il carburante non basta, l'app indica l'ultimo rifornimento utile: toccalo e premi <b>«Aggiungi come tappa»</b>. "
        "In volo il tasto <b>⛽</b> in basso apre lo stesso schema dalla posizione attuale: carburante stimato (a bordo al decollo meno consumo × tempo di volo), correggibile con −5, +5 o «Imposta», e per ogni campo rotta, distanza, tempo e litri all'arrivo; toccando un campo, <b>«Vai diretto»</b>.")]
s += [P("I dati vengono da openAIP, aggiornati ogni notte, ma in Italia pochi campi hanno il carburante indicato. Segna tu quelli che conosci (in fondo alla scheda: campo, carburanti, nota): restano sul telefono e valgono sopra openAIP. Prima di contare su un rifornimento, telefona o chiama per radio.")]
s += [Paragraph("Quota che sale da sola sul terreno", H3)]
s += [P("In volo, con una destinazione o una rotta attiva, lo strumento guarda avanti sulla traccia: sempre il primo chilometro, e fino a 10 km le creste per cui, con la velocità e il rateo di salita del velivolo, bisogna cominciare a salire subito. Se alla quota obiettivo il margine sul terreno scende nel giallo (meno di circa 600 ft), la quota obiettivo sale da sola al terreno più 600 ft, arrotondata ai 100 ft: il flight director e il nastro della quota indicano di salire. "
        "La sicurezza dal terreno vince sugli spazi aerei: se salendo entri in uno spazio, l'avviso lo nomina («ENTRI IN …: AVVISA») perché tu chiami l'ente. Passato il rilievo, dopo 20 secondi con il terreno di nuovo libero, compare «PUOI TORNARE A … FT». "
        "Se col rateo di salita del velivolo non si riesce comunque a passare, l'avviso rosso «SALENDO NON PASSI · VIRA» dice di cambiare direzione. In avvicinamento la funzione è spenta.")]
s += [Paragraph("Salite, discese e giri di 360°", H3)]
s += [P("Il rateo di salita non è fisso: l'app lo calcola dal profilo del velivolo (rateo a pieno carico al livello del mare e quota massima operativa), più basso man mano che si sale e quando l'aereo è pesante (persone, bagaglio e carburante del piano). "
        "Nel piano il riquadro <b>«Salite, discese e giri»</b> calcola un profilo continuo su tutta la rotta: le salite sono <b>graduali</b> (il 60% del rateo disponibile, al massimo 500 ft/min, a una velocità fra quella di salita e la crociera, così liquidi e motore restano freschi) e cominciano prima quando più avanti c'è una cresta; le discese sono al massimo di 500 ft/min. "
        "La rotta migliore cerca la strada dove il terreno sale piano: prende quota avanzando verso l'arrivo dove il terreno è basso e si avvicina alle creste solo quando ci si arriva sopra; per salire non si allontana più di 10 km dalla rotta. "
        "Solo se la strada non basta propone giri di 360° <b>larghi</b> (10° d'inclinazione, poi 15° o 20° se lo spazio è poco), <b>al massimo 4 in salita e 4 in discesa</b>, sopra il campo di partenza o su un punto della rotta dove il terreno intorno lascia spazio; il tempo dei giri entra nel tempo e nel carburante. "
        "Se nemmeno così ci si arriva l'app lo dice in rosso e suggerisce un'altra rotta. "
        "Se la rotta è dritta e passa su zone da evitare o costringe a salire più di 1000 ft sopra la crociera, la rotta migliore dalle valli si calcola da sola; «Torna alla rotta dritta» la annulla.")]
s += [P("In volo, se salendo diritto si passerebbe la cresta davanti con meno di 150 m di margine, compare l'allarme rosso e dopo 10 secondi (subito, se alla cresta mancano meno di 45 secondi) parte la manovra guidata dalle barre rosa: <b>spirale in salita</b> la più larga che ci sta (10°, 15° o 20°) dal lato dove il cerchio resta 150 m sopra il terreno, al massimo 4 giri; se non c'è spazio o i giri sarebbero di più, <b>inversione</b> a 30° e salita tornando verso il terreno più basso. Raggiunta la quota sicura: «RIPRENDI LA ROTTA». "
        "Se a meno di 8 km dal campo sei troppo alto per scendere al circuito col rateo di discesa del velivolo, l'app propone una <b>spirale larga in discesa</b> (al massimo 4 giri) dove c'è spazio, altrimenti ti dice di allungare il percorso e scendere piano.")]
s += [box("La rotta calcolata è un aiuto alla pianificazione: controllala sempre sulla carta e sul briefing ufficiale (AIP, NOTAM, AUP), soprattutto in montagna. Quote del terreno e spazi aerei possono essere incompleti o non aggiornati.")]

s += [tip("Meteo: in alto c'è sempre l'ora esatta dell'ultimo aggiornamento del modello e dei METAR, con da quanti minuti. Verde fino a 30 minuti, arancio oltre (aggiorna prima di partire), rosso oltre un'ora e mezza. Ogni campo indica anche l'ora a cui si riferisce la previsione e ogni METAR l'ora dell'osservazione.")]

s += [Paragraph("Controllo meteo della rotta alle quote", H3)]
s += [P("Nella rotta disegnata tocca <b>☁ Controllo meteo alle quote</b> (oppure Briefing › Meteo sulla rotta). L'app scarica la previsione dei modelli (Open-Meteo: ICON-D2/ICON-EU, AROME, GFS, ECMWF) su tutti i livelli da 1000 a 700 hPa, circa da 300 a 10.000 ft, nei punti della rotta e <b>all'ora in cui ci passerai</b>, calcolata dall'orario di partenza del piano. Poi:")]
s += bullets(["sceglie per ogni tratta la <b>quota ottimizzata</b>: sopra il terreno con il margine, sotto le basi delle zone da evitare e 500 ft sotto la base stimata delle nubi basse, con il vento più favorevole;",
              "calcola vento contrario o in coda, velocità al suolo, <b>tempo e carburante col vento</b>;",
              "segnala in verde, giallo o rosso: nubi basse, visibilità, pioggia, temporali (CAPE), rischio ghiaccio (temperatura e zero termico), raffiche e vento al traverso all'arrivo rispetto al massimo del velivolo."])
s += [P("Il vento è scritto in gradi e a parole, con la direzione da cui viene e il nome tradizionale: per esempio «270° da O (ponente)», «045° da NE (grecale)».")]
s += [box("È una previsione dei modelli, non un'osservazione: confrontala con METAR, TAF e briefing ufficiale prima di partire. In alto c'è sempre l'ora del controllo.")]

# 12 --------------------------------------------------------------
s += chap(12, CH_[11])
s += [side("45_spazi_aerei.png", [
    P("Di serie gli spazi aerei sono <b>esempi non reali</b> (scritto in giallo): non danno avvisi. Per quelli veri d'Italia basta un pulsante:"),
    *steps(["Piano › Briefing › <b>Scarica gli spazi aerei d'Italia (openAIP)</b>, con internet.",
            "Fatto: sotto compare «In uso: openAIP · Italia», il numero di spazi, la data e il ciclo AIRAC. Restano sul telefono e funzionano anche senza internet."]),
    P("<b>openAIP</b> è la banca dati aperta degli spazi aerei usata da molte app di volo; l'app scarica il file dell'Italia che openAIP pubblica ogni giorno, senza account. "
      "All'inizio di ogni nuovo ciclo AIRAC (ogni 28 giorni) lo riscarica da sola."),
    P("<b>Se il pulsante dice «Non riuscito»</b>: apri «Chiave openAIP e altre strade», crea un account gratuito su openaip.net (Profilo › API Clients › crea una chiave), "
      "incolla la chiave e premi di nuovo il pulsante: l'app usa l'API di openAIP."),
    P("<b>Altre strade</b>: «Carica file OpenAir» per un file che hai sul telefono, oppure l'indirizzo di un file OpenAir qualsiasi con «Scarica da questo indirizzo»."),
    P("Con gli spazi veri, il Briefing confronta rotta e quota con ogni spazio (sotto, dentro, sopra; classe, limiti) e lo strumento dà gli avvisi in volo (capitolo 14). "
      "openAIP è curata da volontari: per il volo vale l'AIP in vigore."),
], 50 * mm, "Briefing › Spazi aerei sulla rotta")]
s += [Paragraph("Tipo di volo: la rotta controllata con le tue regole", H3)]
s += [side("47_tipo_di_volo.png", [
    P("In cima al Briefing, e in Impostazioni › <b>Tipo di volo</b>, scegli <b>VDS basico</b> (di serie), <b>VDS avanzato</b> o <b>Aviazione generale VFR</b>. Il briefing giudica ogni spazio aereo e la rotta con quelle regole."),
    *bullets(["<b>VDS basico</b> (DPR 133/2010, art. 9): fuori dagli spazi controllati (classi A–E) e dalle ATZ; almeno 5 km dagli aeroporti; al massimo <b>500 ft</b> sull'ostacolo più alto entro 5 km, <b>1000 ft</b> sabato, domenica e festivi; niente sorvolo di centri abitati. L'app controlla la quota di crociera lungo la rotta sul terreno vero e dice di quanto abbassarla.",
              "<b>VDS avanzato</b> (art. 8–9: radio, transponder, ELT) e <b>aviazione generale VFR</b>: tutto lo spazio aperto al VFR; classi C e D con autorizzazione ATC; E libera; A vietata.",
              "Sempre: P proibite; R regolamentate da evitare salvo disattivazione (AIP, AUP, NOTAM); pericolose da verificare. Le aree <b>FMC</b> sono una raccomandazione (codice transponder e ascolto), non un divieto."]),
    P("Salvo autorizzazioni ENAC. I dati vengono da openAIP: per il volo valgono l'AIP in vigore e i NOTAM."),
], 62 * mm, "Briefing › Tipo di volo")]
s += [Paragraph("NOTAM", H3)]
s += [P("Incolla i NOTAM del briefing ufficiale, nel formato ICAO con la riga Q): «Analizza NOTAM» li confronta con rotta, quota e orario e li segna ROTTA, VICINO oppure OK.")]
s += [side("46_desk.png", [
    P("<b>Desk Aeronautico</b> è un portale italiano gratuito con NOTAM, meteo e briefing presi dalle fonti AIS. L'app ne apre le pagine: mappa NOTAM, ricerca NOTAM, briefing aeroporto, METAR, TAF, SIGMET e AIRMET, carte meteo."),
    P("È comodo per un controllo veloce, ma il sito stesso avverte che non è una fonte ufficiale né a uso operativo: per il volo valgono AIP, NOTAM e meteo ufficiali."),
], 74 * mm, "Collegamenti a Desk Aeronautico")]

s += [box("<b>Parchi e aree protette</b> (OFR nei dati openAIP, per esempio il Parco Nazionale del Gran Paradiso, dal suolo a 14.763 ft): per l'app sono zone da non sorvolare con ogni tipo di volo, fino al limite superiore indicato. Danno l'avviso in volo e «Calcola rotta» li gira intorno. Verifica sempre in AIP le regole del singolo parco.")]
s += [P("Spazi aerei: oltre all'Italia l'app scarica da openAIP Francia, Svizzera, Austria e Slovenia, tenendo solo la fascia alpina vicina al Nord Italia. Campi: anche gli aeroporti, le aviosuperfici e gli altiporti delle Alpi oltre confine (per esempio la Tovière, a Tignes), da OurAirports.")]

# 13 --------------------------------------------------------------
s += chap(13, CH_[12])
s += [shots([("21_simula.png", "Prepara la simulazione"), ("20_simula_in_corso.png", "Simulazione in corso"), ("11_volo_circuito.png", "Lo strumento vola da solo")], 50 * mm)]
s += steps(["Barra in basso › <b>SIMULA</b>.",
            "Scegli <b>Rotta salvata</b> (e partenza dal primo punto o da dove sei) oppure <b>Direct to un campo</b> (da un campo o da dove sei, a un campo).",
            "Imposta crociera (km/h), quota (ft), vento (da quale direzione e quanti km/h) e velocità del tempo (×1, ×2, ×4, ×8).",
            "<b>Avvia la simulazione</b>. Si parte in volo, circa 1000 ft sul terreno."])
s += [P("Lo strumento segue la guida, sceglie la pista col vento che hai messo, fa il circuito e atterra. Usa terreno, campi, spazi aerei e avvisi veri. "
        "Finché simula, GPS e sensori del telefono restano fuori e il diario non registra niente. Si ferma da solo all'atterraggio o a fine rotta; "
        "per fermarlo prima tocca la scritta SIMULAZIONE oppure, in SIMULA, «Ferma la simulazione». L'ultima simulazione resta scritta con durata e km.")]
s += [P("Il <b>volo dimostrativo</b> (Impostazioni) è diverso: gira da solo tra Carolina, Il Falco, Moncucco-Vische e Ivrea, con terreno e ostacoli di esempio.")]

# 14 --------------------------------------------------------------
s += chap(14, CH_[13])
s += [side("18_spazio_qui.png", [
    P("<b>Spazio aereo in cui sei.</b> Sotto le spie dello strumento una riga dice sempre dove sei, alla tua quota, e se è consentito con il tuo tipo di volo: verde (per esempio «CLASSE G · VDS BASICO: consentito»), giallo (attenzione) o rosso («D · CTA MILANO Z23 CANDIA · VIETATO VDS BASICO»). Dice anche il primo spazio sopra di te e, per il VDS basico, la quota massima in quel punto. Funziona anche in simulazione; toccandola si apre il Briefing."),
], 56 * mm, "Simulazione dentro la CTA Milano Z23")]
s += [side("17_avviso.png", [
    P("Gli avvisi compaiono in alto sullo strumento, con <b>voce</b> e <b>vibrazione</b> (spegnibili in Impostazioni › Avvisi). Funzionano in volo, cioè da quando il diario ha aperto il volo."),
], 52 * mm, "Avviso di terreno")]
s += [table(["Avviso", "Quando"], [
    ["TERRENO! CABRA (rosso)", "Guardando avanti sulla traccia, con il vario attuale, entro 30 secondi il margine sul terreno scende sotto 100 ft. Si ripete ogni 5 secondi."],
    ["ATTENZIONE TERRENO (giallo)", "Entro 60 secondi il margine scende sotto 300 ft."],
    ["DENTRO … (rosso o giallo)", "Sei dentro uno spazio aereo vero che il tuo tipo di volo non consente (rosso, «VIETATO VDS BASICO») o che chiede attenzione (giallo), tra i suoi limiti (±100 ft). Anche in simulazione."],
    ["SOPRA IL LIMITE VDS", "Solo VDS basico: sei più alto di 500 ft (1000 ft sabato, domenica e festivi) sull'ostacolo più alto entro 5 km."],
    ["TRA 30 SECONDI / TRA 1 MINUTO …", "Lo spazio è sulla traccia, alla quota prevista; con classe, nome e limiti."],
    ["TRAMONTO TRA 30 / 10 MINUTI", "Calcolato per la posizione e il giorno."],
    ["Pista, circuito, decollo", "A voce: pista scelta o cambiata, ingresso, sottovento, base, finale, atterrato, prossimo punto, fine rotta."],
], [52 * mm, 122 * mm])]
s += [P("Vicino al campo di destinazione, in avvicinamento e in corsa, l'avviso di terreno si spegne entro 3,5 km dal campo, per non suonare in finale.")]

s += [tip("Un tocco sull'avviso lo toglie dal video. Uno spazio aereo non avvisa più finché non ne sei uscito da 2 minuti; gli altri avvisi tornano dopo 1 minuto. Le zone R danno sempre l'avviso, perché l'app non sa se sono attive: verifica NOTAM e AUP.")]
s += [Paragraph("Traffico in tempo reale", H3)]
s += [P("Il tasto <b>✈</b> della barra in basso apre la pagina <b>Traffico</b>: un radar con la tua traccia in alto (anelli a metà e a fine portata, 5, 10 o 25 km, e il cerchio tratteggiato dei 1000 ft), "
        "e sotto l'elenco con distanza, posizione a ore, differenza di quota (+ sopra, − sotto, frecce se sale o scende), velocità, fonte ed età del dato. "
        "Il tasto <b>SafeSky ↗</b> apre la mappa di SafeSky centrata su di te, nel browser.")]
s += [P("Il traffico compare anche sulla <b>mappa mobile</b> (e sulla mappa del tablet accanto all'orizzonte): una freccia nella sua direzione, con la differenza di quota in centinaia di piedi (<b>+03</b> = 300 ft sopra, <b>−12</b> = 1200 ft sotto), ↑ o ↓ se sale o scende e, fino a 15 km di zoom, le marche. "
        "Stessi colori della pagina Traffico: azzurro lontano, giallo chiaro vicino (entro 3 km e 1000 ft), arancio e rosso in rotta di collisione, grigio a terra o dato vecchio. Sull'orizzonte resta solo il triangolo.")]
s += [P("<b>Tocca un traffico</b> (sul radar, nell'elenco o sulla mappa mobile) e si apre la sua scheda: tipo di aereo, distanza, posizione a ore e rilevamento, quota in piedi e metri e differenza con la tua, velocità e traccia, vario, "
        "quando e di quanto vi avvicinerete se nessuno cambia rotta, fonte, codice ed età del dato, e il tasto «Vedi su SafeSky». Sulla mappa, un tocco lontano dai traffici apre il menu come sempre.")]
s += [P("I dati arrivano da internet: <b>OGN</b> (Open Glider Network: FLARM e tracker OGN, cioè alianti e molti ultraleggeri) e <b>adsb.lol</b> (ADS-B e MLAT: aerei con transponder). "
        "Si scaricano ogni 6 secondi solo in volo o con la pagina aperta, circa 5–15 MB l'ora. Si spengono in Impostazioni › Traffico.")]
s += [table(["Sullo strumento", "Quando"], [
    ["Triangolo di pericolo rosso", "Un traffico è entro 1000 ft di lato e entro 1000 ft in quota, oppure ci arriverà entro 30 secondi se nessuno cambia rotta. Sotto il triangolo: posizione a ore e differenza di quota (per esempio «ORE 2 · +300 ft»)."],
    ["Triangolo di pericolo giallo (lampeggia)", "Lo stesso, ma l'incontro è fra 30 e 60 secondi."],
], [52 * mm, 122 * mm])]
s += [P("Sullo strumento non compare nient'altro: niente traffici lontani, niente voce, niente vibrazione. I traffici a terra o più lenti di 25 km/h non danno il triangolo, e nemmeno quelli con un dato più vecchio di 30 secondi. "
        "Il tuo aereo, se ha FLARM, un tracker o l'app SafeSky accesa, non conta come traffico: sono escluse le marche del velivolo attivo e il codice che scrivi in Impostazioni › Traffico, "
        "e in volo l'app riconosce da sola un traffico che ha sempre la tua posizione e la tua velocità. Nel volo dimostrativo c'è traffico finto, uno di fronte in rotta di collisione.")]
s += [Paragraph("SafeSky sullo stesso telefono", H3)]
s += [P("Con <b>SafeSky Premium</b> sullo stesso telefono, HORIZON riceve il traffico di SafeSky (FLARM/OGN, ADS-B e utenti SafeSky) senza tenere SafeSky aperto. "
        "In SafeSky › Impostazioni attiva la condivisione del traffico e scegli come software di navigazione <b>altro software GDL90</b>; premi DECOLLO, poi torna a HORIZON. "
        "SafeSky resta in sottofondo senza schermo: trasmette la tua posizione agli altri e manda il suo traffico a HORIZON sulla porta UDP 4000. "
        "Finché arriva, HORIZON non scarica il traffico da internet e la pagina Traffico mostra «SafeSky (GDL90)». "
        "Perché Android non chiuda SafeSky: Impostazioni di Android › App › SafeSky › Batteria › <b>Senza restrizioni</b>. Lo stesso vale per SkyEcho, PilotAware e Stratux sul WiFi. "
        "Si spegne in Impostazioni › Traffico.")]
s += [box("<b>Il traffico via internet è solo un aiuto.</b> Arriva con 5–20 secondi di ritardo; manca dove non ci sono ricevitori (valli, bassa quota), senza copertura del telefono e per chi non ha FLARM, OGN o ADS-B. "
          "Non è un sistema anticollisione: guarda sempre fuori.", "#fdecea", "#a32020")]

# 15 --------------------------------------------------------------
s += chap(15, CH_[14])
s += [side("31_imp_posizione.png", [
    P("Il <b>Garmin GLO 2</b> (GPS e GLONASS, 10 posizioni al secondo, quota sul livello del mare) è più preciso del GPS del telefono."),
    *steps(["Abbinalo nelle impostazioni Bluetooth di Android.",
            "Impostazioni › Posizione › <b>Collega Garmin GLO 2</b> e scegli dall'elenco. Le volte dopo si ricollega da solo ogni 5 secondi."]),
    P("<b>Fonte</b>:"),
    *bullets(["<b>Automatica</b>: il GLO 2 quando dà la posizione, altrimenti il GPS del telefono; il passaggio è automatico, in circa 2 secondi.",
              "<b>Solo GLO 2</b>: il GPS del telefono è ignorato; se il GLO 2 tace, le croci rosse lo dicono.",
              "<b>Solo telefono</b>: il GLO 2 è ignorato."]),
], 74 * mm, "Impostazioni › Posizione")]

# 16 --------------------------------------------------------------
s += chap(16, CH_[15])
s += [side("34_imp_quota.png", [
    P("La quota è quella GPS, riportata al livello del mare con il geoide (Nord Italia circa 47 m), con un errore tipico di ±10–30 m. Non usarla al posto dell'altimetro."),
    *bullets(["<b>Taratura automatica</b>: fermo per 20 secondi entro 700 m da un campo di quota nota, l'app tara la quota su quella del campo.",
              "<b>Tara qui</b>: scrivi la quota vera, per esempio quella dell'altimetro con il QNH, e premi «Tara qui». Vale per la fonte in uso.",
              "<b>Azzera taratura</b> toglie le tarature."]),
    P("Il vario unisce la quota GPS e l'accelerazione verticale con un filtro stabile anche con il GPS irregolare: un dato GPS isolato fuori misura viene scartato."),
], 74 * mm, "Impostazioni › Quota GPS")]

# 17 --------------------------------------------------------------
s += chap(17, CH_[16])
s += [side("33_imp_bussola.png", [
    P("La prua viene dal <b>sensore di rotazione di Android</b> (bussola, giroscopio e accelerometro), corretta in <b>prua vera</b> con la declinazione magnetica (Piemonte circa +3°). "
      "Conta il dorso del telefono; con il telefono in piano conta il lato alto dello schermo."),
    *bullets(["<b>A terra e lento</b> (di serie): sotto 25 km/h la prua è quella della bussola; in volo conta la traccia GPS corretta col vento, perché motore e metallo disturbano la bussola.",
              "<b>Sempre</b>: la bussola corregge la prua anche in volo.",
              "<b>Mai</b>: solo giroscopio e traccia GPS."]),
    P("Se la riga «Bussola» dello Stato dice «da calibrare», o la prua è sbagliata, muovi il telefono a otto per qualche secondo, lontano da oggetti di metallo."),
], 74 * mm, "Impostazioni › Bussola")]

# 18 --------------------------------------------------------------
s += chap(18, CH_[17])
s += [P("Senza Pitot l'app stima vento e velocità vera dalle <b>virate</b>: durante una virata la velocità al suolo cambia con la direzione, e da questa variazione si ricava il vento. "
        "Finché non c'è una stima, il riquadro dice «vira per stimare» e usa il vento <b>previsto</b> dal modello meteo sul campo di destinazione (PREV). "
        "Con il vento stimato la prua tiene conto della deriva e il riquadro GS mostra anche la velocità vera (TAS stimata). Nelle prove su un vento vero di 270°/15 km/h la stima è stata 268°/15.")]

# 19 --------------------------------------------------------------
s += chap(19, CH_[18])
s += [side("39_imp_diario.png", [
    *bullets(["Il volo si apre da solo quando la velocità supera 55 km/h per 5 secondi (voce «decollo»), con il campo di partenza se sei entro 3 km.",
              "Si chiude 30 secondi dopo l'arresto, con il campo di arrivo, la durata, la distanza e la quota massima.",
              "Esporta la traccia in <b>GPX</b> e il diario in <b>CSV</b>: nell'APK con il pannello «Condividi» di Android.",
              "Se l'app si chiude in volo o il telefono si riavvia, riaprendola entro 15 minuti il volo riprende."]),
], 74 * mm, "Impostazioni › Diario di volo")]

s += [P("Le <b>tracce</b> degli ultimi 50 voli restano nel telefono (in un archivio separato dal diario, che regge voli lunghi). In Impostazioni › Diario di volo: "
        "spunta i voli e tocca <b>Esporta GPX</b> o <b>Esporta KML</b> (Google Earth): più voli finiscono in un solo file. «Sulla mappa» disegna la traccia in giallo sulla mappa; ⌖ CENTRA torna all'aereo.")]

# 20 --------------------------------------------------------------
s += chap(20, CH_[19])
s += [side("35_imp_offline.png", [
    P("Prima del volo, con il WiFi:"),
    *bullets(["<b>Scarica terreno</b>: modello del terreno fino a 450 km intorno (dettaglio crescente verso il centro), circa 10–15 MB.",
              "<b>Scarica mappa della zona</b>: le tessere della mappa di base scelta, fino a 60 km."]),
    P("Senza internet restano: strumento, terreno e mappe scaricati, campi, rotte, piano, ultimo meteo, diario. "
      "Gli spazi aerei caricati restano salvati. Mancano solo meteo nuovo, METAR, mappe non scaricate e segnalazioni (che restano in coda e partono da sole)."),
], 74 * mm, "Impostazioni › Volare senza internet")]

# 21 --------------------------------------------------------------
s += chap(21, CH_[20])
s += [table(["Mappa", "Che cos'è", "Condizioni"], [
    ["Solo terreno", "Rilievo dal modello del terreno, colori di avviso", "Sempre; non serve internet dopo lo scarico"],
    ["OpenTopoMap", "Topografica con curve di livello", "Gratuita, con attribuzione"],
    ["OpenStreetMap", "Stradale", "Gratuita, con attribuzione; niente scarichi massicci"],
    ["Satellite Esri (World Imagery)", "Foto satellitari 30–60 cm", "Chiave gratuita ArcGIS Location Platform, da incollare nelle Impostazioni"],
    ["IGM 1:25.000", "Tavolette dell'Istituto Geografico Militare (Geoportale Nazionale)", "Servizio solo http: funziona nell'APK; si vede da 2 a 8 km di scala"],
    ["Ortofoto AGEA", "Foto aeree a colori (Geoportale Nazionale)", "Come sopra; da 2 a 4 km di scala"],
    ["Personalizzata", "Qualunque servizio a tessere {z}/{x}/{y} o WMS", "Solo servizi di cui hai il diritto di uso"],
], [38 * mm, 66 * mm, 70 * mm])]
s += [P("Si scelgono in Impostazioni › <b>Mappa di base</b>. Per i servizi WMS «Rileggi i livelli» legge i nomi dei livelli dal servizio stesso.")]

# 22 --------------------------------------------------------------
s += chap(22, CH_[21])
s += [table(["Sezione", "Che cosa contiene"], [
    ["Stato", "GPS del telefono, GLO 2, posizione in uso, sensori di movimento, bussola, montaggio, quota GPS, terreno, internet, dati salvati."],
    ["Posizione", "Fonte (automatica, solo GLO 2, solo telefono), collega o scollega il GLO 2."],
    ["Montaggio", "Livella ora, livella a terra, telefono verticale; orizzonte più morbido; fotogrammi al secondo."],
    ["Tipo di volo", "VDS basico, VDS avanzato, aviazione generale VFR: decide che cosa è consentito."],
    ["Bussola", "A terra e lento, sempre, mai; declinazione magnetica."],
    ["Quota GPS", "Geoide, azzera taratura, tara qui con una quota nota."],
    ["Volare senza internet", "Scarica terreno, scarica mappa della zona."],
    ["Mappa di base", "Scelta della mappa, chiave Esri, livelli WMS, mappa personalizzata."],
    ["Avvisi", "Voce, vibrazione, schermo sempre acceso; nota sugli spazi aerei."],
    ["Volo dimostrativo", "Avvia o ferma il volo dimostrativo."],
    ["Diario di volo", "Voli registrati, GPX, CSV."],
], [36 * mm, 138 * mm])]
s += [shots([("30_imp_stato.png", "Impostazioni › Stato"), ("36_imp_mappe.png", "Impostazioni › Mappa di base")], 80 * mm)]

s += [P("<b>Interfaccia</b>: <b>Completa</b> (tutto) o <b>Semplice</b>: solo l'orizzonte, come uno strumento di bordo classico, con velocità, quota, vario, prua, vento e tempo di volo; niente mappa, rotte e simulazione. Gli avvisi di terreno e spazio aereo restano attivi.")]

s += [Paragraph("Velivoli", H3)]
s += [P("In Impostazioni › <b>Velivoli</b> c'è un profilo per ogni aereo: tocca quello da usare, <b>Modifica</b> per cambiarlo, <b>Nuovo velivolo</b> o <b>Duplica</b> per aggiungerne uno. Esporta e Importa passano i profili tra telefoni (file .json). Il velivolo attivo regola tutta l'app:")]
s += [table(["Dati del profilo", "Dove servono"], [
    ["Marche, modello, categoria (VDS basico, VDS avanzato, VFR)", "Diario e tracce (nome dei voli); la categoria imposta il tipo di volo e quindi gli spazi aerei consentiti"],
    ["VS0, VS1, VFE, VNO, VNE (km/h)", "Archi colorati della scala di velocità: bianco VS0–VFE, verde VS1–VNO, giallo VNO–VNE, rosso VNE"],
    ["VA, VX, VY, miglior planata", "Promemoria nel profilo; la planata con l'efficienza disegna il cerchio di planata"],
    ["Avvicinamento, circuito, crociera", "Simulazione, piano di volo (velocità vera), tempi delle tratte nella rotta disegnata"],
    ["Rateo di salita, efficienza", "Cerchio di planata sulla mappa: distanza raggiungibile dall'altezza sul terreno, con il 25% di margine (si accende e si spegne in Impostazioni › Velivoli)"],
    ["Decollo e atterraggio (m), vento al traverso", "Piano: pista di partenza e di arrivo abbastanza lunghe (+15%); avviso se il traverso supera il massimo dimostrato"],
    ["Quota del circuito", "Circuito e sentiero di discesa sullo strumento e nel piano"],
    ["Serbatoi, non utilizzabile, consumo, riserva, rullaggio", "Piano: carburante necessario, capienza, autonomia"],
    ["Pesi, bracci e limiti del baricentro", "Piano › Carico e centraggio: peso al decollo e all'atterraggio contro il MTOW, baricentro entro i limiti"],
    ["Transponder e radio", "Spazi aerei: le zone TMZ e RMZ diventano vietate se il velivolo non ha transponder o radio"],
], [62 * mm, 112 * mm])]
s += [P("Mentre scrivi, l'app controlla la coerenza dei dati (VS0 ≤ VS1 < VNO < VNE, avvicinamento almeno 1,2 × VS0, peso a vuoto sotto il MTOW, limiti del baricentro in ordine) e dice cosa controllare. Il profilo di partenza è quello dell'Avid Flyer I-A517: modificalo o aggiungi il tuo aereo.")]
s += [P("<b>Carico e centraggio</b> (Piano): scrivi i pesi di pilota, passeggero e bagaglio; il carburante viene dal piano. Senza bracci nel profilo l'app controlla solo i pesi.")]

# 23 --------------------------------------------------------------
s += chap(23, CH_[22])
s += bullets(["<b>Versione</b> installata, data di installazione, versione precedente, avvertenze accettate.",
              "<b>Aggiornamenti</b> (APK da GitHub): versione nuova disponibile con «Scarica e installa»; si installa sopra, i dati restano.",
              "<b>Novità</b> di ogni versione.",
              "<b>Segnala un problema o un'idea</b>: il testo arriva per posta all'autore. La tua email è facoltativa. Con la spunta «dati tecnici» la segnalazione porta versione, telefono, stato dei sensori, ultimi errori e la <b>scatola nera</b>; mai la posizione. Senza rete resta in coda e parte da sola.",
              "<b>Avvertenze e responsabilità</b>, <b>Licenza</b> con il testo completo, <b>Crediti</b> e informativa sulla privacy.",
              "<b>Ti è utile?</b>: la donazione con PayPal (non nella versione del Play Store)."])
s += [tip("<b>Scatola nera.</b> L'app ricorda ogni secondo pagina, zoom, mappa, prestazioni e le ultime 15 azioni. Se si blocca, alla riapertura vai in Info › Segnala un problema con la spunta dei dati tecnici: arriva esattamente che cosa stava succedendo. I blocchi di più di 1,5 secondi vengono anche registrati tra gli errori.")]

s += [P("Se l'invio della segnalazione non riesce, l'app apre la scelta di un'altra app (Gmail, WhatsApp, Telegram…) con il testo già pronto; c'è anche il tasto «Invia con un'altra app».")]

# 24 --------------------------------------------------------------
s += chap(24, CH_[23])
s += [img("60_tablet.png", W), Paragraph("Tablet in orizzontale: orizzonte e mappa insieme, comandi e riquadri a destra", CAP)]
s += [P("Su un tablet o un telefono largo in orizzontale l'app mostra le due pagine insieme: lo strumento a sinistra e l'altra pagina a destra. PAGINA le scambia. "
        "Con il telefono girato l'assetto resta giusto: i sensori seguono il verso dello schermo.")]

# 25 --------------------------------------------------------------
s += chap(25, CH_[24])
s += [table(["Problema", "Che cosa fare"], [
    ["L'app si blocca o è lenta", "Aggiorna all'ultima versione (la 1.0.9 ha corretto il blocco della quota con il GPS irregolare). Lascia 30 fotogrammi al secondo. Se succede ancora: riapri e manda la segnalazione con i dati tecnici."],
    ["Prua sbagliata da fermo", "Impostazioni › Stato › riga Bussola: se dice «da calibrare» o la prua non torna, muovi il telefono a otto. Controlla la declinazione e che il supporto non sia vicino a magneti."],
    ["Orizzonte storto", "Livella (in volo o a terra con l'assetto a terra). Se il telefono è stato girato, aspetta un istante: si rilivella da solo."],
    ["Orizzonte che trema", "Supporto più rigido; Orizzonte più morbido a 2–4."],
    ["Quota diversa dall'altimetro", "La quota GPS ha ±10–30 m: tarala con «Tara qui» o fermandoti su un campo di quota nota."],
    ["GPS PERSO, croci rosse", "Al chiuso il GPS non arriva. All'aperto controlla il permesso di posizione precisa per l'app."],
    ["Il GLO 2 non si collega", "Abbinato in Android? Acceso? Permesso «dispositivi nelle vicinanze» concesso? Spegni e riaccendi il GLO 2 e premi di nuovo «Collega»."],
    ["Mappa vuota", "Esri: manca la chiave. IGM e ortofoto: solo nell'APK e solo a certe scale. Senza internet: mappa non scaricata."],
    ["Spazi aerei «di esempio»", "Piano › Briefing › «Scarica gli spazi aerei d'Italia (openAIP)»; se non riesce, la chiave gratuita openAIP (capitolo 12)."],
    ["Nessun METAR", "Nell'APK arrivano da soli; dal browser vanno incollati. Senza internet resta l'ultimo meteo."],
    ["Il campo non si trova", "Scrivi una parte del nome o la sigla nella ricerca; se manca, aggiungilo in Piano › Campi."],
], [44 * mm, 130 * mm])]

# 26 --------------------------------------------------------------
s += chap(26, CH_[25])
s += [Paragraph("Limiti", H3)]
s += bullets(["Niente Pitot: la velocità mostrata è al suolo, senza archi di stallo.",
              "Niente barometro: la quota è GPS, con errori di decine di metri.",
              "L'assetto viene dai sensori del telefono e può essere sbagliato con supporti non rigidi, vibrazioni, accelerazioni o dopo un riavvio.",
              "GPS, sensori, Bluetooth e batteria possono smettere di funzionare senza preavviso.",
              "Campi, piste, quote, ostacoli, spazi aerei, terreno, mappe e meteo possono essere incompleti, sbagliati o non aggiornati; il meteo del modello è una previsione.",
              "Gli avvisi possono mancare o arrivare in ritardo."])
s += [Paragraph("Responsabilità", H3)]
s += [P("Il pilota in comando resta l'unico responsabile della condotta del volo, della navigazione, della separazione da terreno, ostacoli, altri aeromobili e spazi aerei, "
        "e del rispetto delle norme, compreso il regolamento VDS/ULM (DPR 133/2010) dove applicabile. Fissa il telefono in modo che non intralci i comandi e non cada; "
        "non distrarti dal pilotaggio e dalla vista fuori. Verifica sempre AIP, NOTAM, carte e meteo ufficiali prima del volo. "
        "L'app è fornita gratuitamente «così com'è», senza garanzie di alcun tipo.")]
s += [Paragraph("Licenza", H3)]
s += [P("© 2026 Enrico D'Amico. Tutti i diritti riservati: non è software libero. Puoi installare e usare l'app ufficiale per uso personale e non commerciale. "
        "Per copiarla, modificarla, ridistribuirla, usarla a scopo di lucro o riusarne il codice serve il permesso scritto dell'autore (amicoen@gmail.com). "
        "Una donazione non cambia queste condizioni. Le librerie di terze parti (Capacitor e plugin, MIT; AndroidX, Apache 2.0) restano sotto le proprie licenze.")]
s += [Paragraph("Privacy", H3)]
s += [P("Nessun account, pubblicità o analisi. Posizione, rotte, campi, diario e impostazioni restano sul telefono. Escono solo le richieste ai servizi di mappe, terreno e meteo "
        "(con la zona mostrata o le sigle dei campi), il controllo degli aggiornamenti e le segnalazioni che invii tu. Informativa completa: "
        "github.com/amicoen-ops/HORIZON/blob/main/PRIVACY.md.")]

# 27 --------------------------------------------------------------
s += chap(27, CH_[26])
s += [table(["Che cosa", "Fonte"], [
    ["Campi e piste", "OurAirports (pubblico dominio), 342 campi del Nord Italia; note e correzioni del pilota"],
    ["Terreno", "Terrain Tiles su AWS Open Data (Mapzen; SRTM, EU-DEM e altre fonti pubbliche)"],
    ["Mappe", "© OpenStreetMap contributors (ODbL); OpenTopoMap (CC BY-SA); World Imagery © Esri e fornitori; IGM 1:25.000 e ortofoto AGEA dal Geoportale Nazionale (CC BY-SA)"],
    ["Meteo", "Open-Meteo (CC BY 4.0); METAR e TAF da aviationweather.gov (NOAA)"],
    ["Spazi aerei", "openAIP (CC BY-NC 4.0, www.openaip.net), Italia, riscaricati a ogni AIRAC; oppure un file OpenAir del pilota"],
    ["NOTAM e briefing", "Briefing ufficiale; collegamenti a Desk Aeronautico (non ufficiale)"],
    ["Traffico", "Open Glider Network (OGN, ODbL) e adsb.lol (ODbL), via internet; SafeSky solo come collegamento alla sua mappa"],
    ["Segnalazioni", "Web3Forms, inoltro per posta all'autore; in alternativa l'app che scegli tu"],
], [34 * mm, 140 * mm])]
s += [Spacer(1, 4 * mm), HRFlowable(width="100%", thickness=0.6, color=GREY),
      Paragraph(f"Manuale dell'app HORIZON · strumento di volo, versione {VER}, aggiornato al 1 novembre 2026. Le schermate vengono dalla simulazione dell'app; "
                "terreno e mappe di prova possono differire da quelli reali.", SM)]


# un titolo di capitolo non resta mai da solo in fondo alla pagina: va insieme al primo blocco che lo segue
_k = []
i = 0
while i < len(s):
    f = s[i]
    if isinstance(f, Paragraph) and f.style is H2 and i + 1 < len(s):
        _k.append(KeepTogether([f, s[i + 1]])); i += 2; continue
    _k.append(f); i += 1
s = _k

def footer(c, d):
    c.saveState(); c.setFont("DV", 7); c.setFillColor(GREY)
    c.drawString(18 * mm, 9 * mm, f"HORIZON · strumento di volo · manuale dell'app {VER} · © 2026 Enrico D'Amico")
    c.drawRightString(A4[0] - 18 * mm, 9 * mm, str(d.page)); c.restoreState()


SimpleDocTemplate(OUT, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=14 * mm, bottomMargin=15 * mm,
                  title="HORIZON · strumento di volo - Manuale dell'app", author="Enrico D'Amico").build(s, onFirstPage=footer, onLaterPages=footer)
import os; print(OUT, os.path.getsize(OUT))
