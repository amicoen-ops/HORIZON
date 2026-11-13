#!/usr/bin/env python3
# HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
# Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
"""
Analisi automatica delle segnalazioni che l'app manda per posta («Problema», «Registrazione sensori», …).
La usa tools/posta_licenze.py: legge la mail, riconosce i casi noti dai DATI TECNICI allegati e prepara la risposta
per il pilota. Qui non c'è posta né rete: solo testo in entrata e testo in uscita, così si prova da soli
(tools/test_segnalazioni.py).

Regola di fondo: un caso è «riconosciuto» solo se i dati tecnici SPIEGANO il problema (versione vecchia, telefono
non livellato, quota non tarata…). Le parole del pilota da sole non bastano mai: se i dati sono a posto, la mail
resta all'autore. Lo stesso per tutto ciò che sa di difetto dell'app (chiusure, blocchi, errori) e per
suggerimenti e dati sbagliati: quelli li legge sempre una persona.

Per insegnare un caso nuovo: aggiungere una funzione regola_… qui sotto, metterla in REGOLE e aggiungere il caso
(senza nomi né indirizzi) a tools/test_segnalazioni.py.
"""
import html as H
import re

TIPI = ('Problema', 'Suggerimento', 'Dato sbagliato', 'Registrazione sensori')
CAMPI = ('Segnalazione', 'Messaggio', 'Rispondere a', 'Velivolo', 'Versione', 'Telefono', 'Inviata il', 'Dati tecnici')
VECCHIA_DI = 30           # versioni di ritardo oltre le quali «aggiorna» è già la risposta
AVVISO = 'HORIZON è un aiuto al volo e non sostituisce gli strumenti di bordo.'


def testo_da_html(s):
    """La mail di Web3Forms è una pagina: qui diventa testo, una riga per cella."""
    s = re.sub(r'(?is)<(script|style)\b.*?</\1>', ' ', s or '')
    s = re.sub(r'(?i)<br\s*/?>|</(p|div|td|th|tr|li|h[1-6]|pre|table)>', '\n', s)
    s = re.sub(r'<[^>]+>', '', s)
    return H.unescape(s).replace('\r', '').replace('\xa0', ' ')


def campi(testo):
    """Dal testo della mail ai campi del modulo: l'etichetta su una riga, il valore sotto (o dopo i due punti)."""
    out, nome = {}, None
    for riga in (testo or '').replace('\r', '').split('\n'):
        r = riga.strip()
        trovato = None
        for c in CAMPI:
            if r == c or r == c + ':': trovato = (c, ''); break
            if r.startswith(c + ':') and c != 'Dati tecnici': trovato = (c, r[len(c) + 1:].strip()); break
        if trovato and trovato[0] not in out:
            nome = trovato[0]; out[nome] = [trovato[1]] if trovato[1] else []
        elif nome:
            out[nome].append(riga.rstrip())
    return {k: '\n'.join(v).strip() for k, v in out.items()}


def versione(s):
    m = re.search(r'(\d+)\.(\d+)\.(\d+)', s or '')
    return tuple(int(x) for x in m.groups()) if m else None


def ultima_versione(index_html):
    """La versione più recente: la prima voce di PH_CHANGES in www/index.html."""
    m = re.search(r'const PH_CHANGES=\[\s*\["(\d+\.\d+\.\d+)"', index_html or '')
    return versione(m.group(1)) if m else None


def registrazione(diag):
    """Dalla registrazione dei sensori: velocità, assetto medio all'inizio e alla fine, righe. None se non c'è."""
    if 'REGISTRAZIONE SENSORI' not in (diag or ''): return None
    coda = diag.split('REGISTRAZIONE SENSORI', 1)[1]
    righe = []
    for r in coda.split('\n'):
        p = r.split()
        if len(p) >= 10 and re.fullmatch(r'\d+', p[0]):
            try: righe.append((float(p[8]), float(p[9])))
            except ValueError: pass
    gs = re.search(r'GS\s+([\d.]+)\s*km/h', coda)
    terra = re.search(r'a terra\s+(-?[\d.]+)°', coda)
    if not righe: return {'righe': 0, 'gs': float(gs.group(1)) if gs else None}
    media = lambda v: sum(v) / len(v)
    return {'righe': len(righe), 'gs': float(gs.group(1)) if gs else None,
            'rollio': media([x[0] for x in righe]), 'beccheggio': media([x[1] for x in righe]),
            'deriva': max(abs(righe[-1][0] - righe[0][0]), abs(righe[-1][1] - righe[0][1])),
            'a_terra': float(terra.group(1)) if terra else None}


class Caso:
    """Tutto quello che le regole possono guardare."""
    def __init__(self, c, ultima=None):
        self.tipo = c.get('Segnalazione', '').strip()
        self.msg = c.get('Messaggio', '').strip()
        self.diag = c.get('Dati tecnici', '')
        self.ver = versione(c.get('Versione') or self.diag)
        self.ultima = ultima
        self.canale = 'Google Play' if 'Google Play' in c.get('Versione', '') else ('web' if 'web' in c.get('Versione', '') else 'APK')
        self.telefono = c.get('Telefono', '')
        self.rec = registrazione(self.diag)
        self.righe = {}
        for r in self.diag.split('REGISTRAZIONE SENSORI', 1)[0].split('\n'):
            m = re.match(r'\s*([A-Za-zÀ-ú0-9 (),]{3,40}):\s*(.*)$', r)
            if m and m.group(1) not in self.righe: self.righe[m.group(1).strip()] = m.group(2).strip()

    def riga(self, nome): return self.righe.get(nome, '')
    def dice(self, *parole): return any(p in self.msg.lower() for p in parole)
    @property
    def ritardo(self):
        if not self.ver or not self.ultima or self.ver[:2] != self.ultima[:2]: return 0
        return max(0, self.ultima[2] - self.ver[2])
    @property
    def con_dati(self): return bool(self.diag) and self.diag.strip() != 'non allegati'


def v_txt(v): return '.'.join(str(x) for x in v) if v else '?'


# ───────────── casi che vanno SEMPRE all'autore ─────────────
def difetto(c):
    """Motivo per cui la mail deve leggerla una persona, o None."""
    if c.tipo in ('Suggerimento', 'Dato sbagliato'): return c.tipo.lower()
    if c.tipo not in TIPI: return 'tipo sconosciuto'
    if c.dice('si chiude', 'si è chius', 'crash', 'si blocca', 'bloccat', 'si pianta', 'schermo nero', 'non si apre', 'non parte',
              'si riavvia', 'impallat', 'congelat', 'pagament', 'licenza', 'rimborso'): return 'parole da difetto o da licenza'
    m = re.search(r'Errori di disegno:\s*(\d+)', c.diag)
    if m and int(m.group(1)) > 0: return 'errori di disegno'
    m = re.search(r'Disegno:.*blocchi\s+(\d+)', c.diag)
    if m and int(m.group(1)) > 0: return 'blocchi del disegno'
    if 'il giroscopio non seguiva la virata' in c.diag: return 'giroscopio sospetto'
    # errori registrati lo stesso giorno della segnalazione (quelli vecchi no: sono di versioni passate)
    giorno = re.search(r'(\d{2})/(\d{2})/(\d{4})', c.riga('Sessione precedente, ultimo stato') or '')
    dopo = c.diag.split('Ultimi errori:', 1)[1].split('REGISTRAZIONE SENSORI', 1)[0] if 'Ultimi errori:' in c.diag else ''
    if giorno and f'{giorno.group(3)}-{giorno.group(2)}-{giorno.group(1)}' in dopo: return 'errori di oggi nel registro'
    return None


# ───────────── regole: ognuna torna None o (codice, titolo, [paragrafi]) ─────────────
def regola_versione(c):
    if c.ritardo < 5: return None
    come = ("Apri il Play Store, cerca HORIZON e tocca «Aggiorna». Se il Play Store non propone l'aggiornamento, "
            "rispondi a questa mail e ti rimettiamo tra i tester del canale giusto."
            if c.canale == 'Google Play' else
            "In HORIZON apri Info e tocca «Controlla aggiornamenti», oppure scarica l'ultima versione dalla pagina del progetto."
            if c.canale == 'APK' else "Chiudi e riapri la pagina: la versione web si aggiorna da sola.")
    return ('versione-vecchia', 'Aggiorna HORIZON',
            [f"Stai usando la versione {v_txt(c.ver)}; l'ultima è la {v_txt(c.ultima)} ({c.ritardo} versioni dopo). "
             "Nel frattempo sono stati corretti molti difetti, soprattutto su orizzonte, bussola, terreno e velocità dell'app.",
             come, "Se dopo l'aggiornamento il problema c'è ancora, manda una nuova segnalazione: la guardiamo subito."])


LIVELLA = ["Aereo fermo, in piano, telefono già fissato nel supporto nella posizione in cui lo userai in volo.",
           "Premi il tastino LIVELLA (bordo giallo e nero, vicino alla riga GPS · ASSETTO · TERRENO).",
           "Compare la domanda «LIVELLA A TERRA? … ASSETTO 11°»: tocca SÌ entro 15 secondi, altrimenti viene ignorata. Nelle versioni "
           "fino alla 1.0.176 la domanda non si può toccare: si conferma premendo il tasto grande OK sotto lo strumento, oppure si usa "
           "Impostazioni › «Livella a terra», che non chiede conferma.",
           "Deve comparire la scritta «LIVELLATO». Attenzione: da quel momento A TERRA l'orizzonte NON segna zero ma l'assetto vero "
           "dell'aereo fermo (per esempio 11° a cabrare). È giusto così: segna zero in volo livellato."]
LIVELLA_DOPO = ["Se il tuo aereo a terra non è cabrato di 11° (triciclo: 0°; biciclo: di solito 10–12°), metti il valore giusto in "
                "Impostazioni, campo «Assetto a terra (°)», e poi premi «Livella a terra».",
                "In alternativa, in volo rettilineo con ali livellate e quota costante: premi LIVELLA e conferma. È il modo più preciso.",
                "Se sposti il telefono nel supporto dopo aver livellato, la livella va rifatta."]


def regola_livella(c):
    mont = c.riga('Montaggio')
    non_livellato = mont.startswith('telefono verticale')
    r = c.rec
    # dopo una «livella a terra» di N gradi l'orizzonte da fermo DEVE segnare N a cabrare: storto è solo lo scarto da lì
    atteso = (r.get('a_terra') or 0) if r else 0
    storto = bool(r and r.get('righe') and (r.get('gs') or 0) < 5 and (abs(r['beccheggio'] - atteso) > 4 or abs(r['rollio']) > 3))
    if c.tipo == 'Registrazione sensori':
        if not storto: return None
    elif not (non_livellato and c.dice('orizzont', 'assetto', 'inclinat', 'storto', 'storta', 'beccheggi', 'rollio', 'livella', 'cabra', 'picchia')):
        return None
    testo = []
    if storto:
        testo.append(f"Da fermo l'orizzonte segnava circa {abs(r['beccheggio']):.0f}° a {'cabrare' if r['beccheggio'] > 0 else 'picchiare'} e "
                     f"{abs(r['rollio']):.0f}° di inclinazione a {'destra' if r['rollio'] > 0 else 'sinistra'}. I sensori funzionano: "
                     "è il telefono che non è livellato per la posizione in cui si trova ora.")
        if 10 <= r['beccheggio'] <= 14 and not r.get('a_terra'):
            testo.append("Un valore tra 10° e 14° a cabrare è l'assetto tipico di un biciclo fermo sulla coda: se la livella era stata "
                         "fatta in volo, quello che vedi a terra è l'assetto vero dell'aereo, non un errore.")
    if non_livellato:
        testo.append("Dai dati il telefono risulta mai livellato: l'app lo considera perfettamente verticale, e ogni grado di "
                     "differenza del supporto diventa un errore dell'orizzonte.")
    if 'livella a terra' in c.diag and 'domanda a schermo' in c.diag and not (r and r.get('a_terra')):
        testo.append("Risulta che hai premuto LIVELLA ma la domanda di conferma è rimasta a schermo senza risposta: la livella non è stata applicata.")
    return ('livella', "Livellare l'orizzonte", testo + ['Come si fa, a terra:'] + [('·', LIVELLA)] + LIVELLA_DOPO)


def regola_sensori(c):
    s = c.riga('Sensori di movimento')
    hz = re.match(r'(\d+)\s*Hz', s)
    # in un «Problema» scritto a parole i sensori contano solo se il pilota parla di orizzonte o sensori: sul computer
    # (versione web) mancano sempre, e rispondere «mancano i sensori» a chi chiedeva altro sarebbe una risposta sbagliata
    if c.tipo == 'Problema' and not c.dice('orizzont', 'assetto', 'sensor', 'giroscop', 'inclinat', 'a scatti', 'virata', 'non si muove', 'fermo'):
        return None
    if c.con_dati and (s == 'nessun dato' or (c.rec is not None and not c.rec.get('righe'))):
        return ('sensori-assenti', 'I sensori di movimento non arrivano',
                ["L'app non riceve dati dai sensori di movimento del telefono: senza, l'orizzonte non può funzionare.",
                 "Controlla che HORIZON abbia il permesso per i sensori di movimento (su iPhone lo chiede al primo avvio: se è stato "
                 "negato, va ridato dalle impostazioni del telefono) e che il risparmio energetico non sia attivo. Poi chiudi e riapri l'app.",
                 "Se il telefono non ha il giroscopio, l'orizzonte non è disponibile su quel modello."])
    if hz and int(hz.group(1)) <= 20:
        return ('sensori-lenti', 'Sensori di movimento lenti',
                [f"Il telefono dà solo {hz.group(1)} letture al secondo dai sensori di movimento: l'orizzonte risulta a scatti e meno preciso.",
                 "Di solito dipende dal risparmio energetico o da un telefono molto carico: toglilo, chiudi le altre app e riprova con il "
                 "telefono collegato alla corrente."])
    if 'Giroscopio: assente' in c.diag:
        return ('giroscopio-assente', 'Telefono senza giroscopio',
                ["Questo telefono non ha il giroscopio: l'orizzonte usa solo l'accelerometro e in virata non è affidabile. "
                 "Per l'assetto serve un telefono con giroscopio."])
    return None


def regola_bussola(c):
    b = c.riga('Bussola')
    if c.tipo != 'Problema' or not c.dice('bussola', 'prua', 'direzione', 'rotta sbagliata', 'nord'): return None
    if 'da calibrare' not in b: return None
    return ('bussola', 'Calibrare la bussola',
            ["Dai dati la bussola del telefono risulta da calibrare.",
             "Con l'app aperta muovi il telefono disegnando un otto in aria per una decina di secondi, lontano da metallo e magneti "
             "(supporti magnetici, altoparlanti, cruscotto).",
             "In volo HORIZON usa comunque la traccia del GPS, che non risente della bussola."])


def regola_gps(c):
    g = c.riga('GPS del telefono')
    m = re.search(r'±\s*(\d+)\s*m', g)
    scarso = (m and int(m.group(1)) > 30) or (c.con_dati and c.tipo == 'Problema' and g and not m and 'dimostrativo' not in g)
    if not scarso or not (c.tipo == 'Registrazione sensori' or c.dice('gps', 'posizione', 'velocit', 'mappa ferma', 'non mi trova', 'quota')):
        return None
    return ('gps', 'Segnale GPS debole',
            [f"Al momento della segnalazione il GPS del telefono era impreciso ({g.split(' · ')[0] or 'nessuna posizione'}).",
             "Controlla che HORIZON abbia il permesso di posizione «precisa» e «sempre/mentre usi l'app», e prova all'aperto: "
             "in casa, in hangar o dietro un parabrezza riscaldato il segnale è molto più debole.",
             "Se voli spesso con segnale debole, un ricevitore esterno (per esempio Garmin GLO 2) migliora molto posizione e quota."])


def regola_quota(c):
    if c.tipo != 'Problema' or not c.dice('quota', 'altitudine', 'altimetr', 'vario', 'piedi', ' ft'): return None
    q, b = c.riga('Quota GPS'), c.riga('Barometro')
    non_tarata, senza_baro = 'non tarata' in q, 'non presente' in b
    if not (non_tarata or senza_baro): return None
    t = []
    if senza_baro:
        t.append("Questo telefono non ha il barometro: quota e vario vengono solo dal GPS, che è preciso a ±10–30 m e reagisce con "
                 "qualche secondo di ritardo. È un limite del telefono, non un guasto.")
    if non_tarata:
        t.append("La quota GPS non risulta tarata. Si tara da sola quando resti fermo una ventina di secondi su un campo dell'elenco "
                 "di quota nota; oppure a mano in Impostazioni, scrivendo la quota del punto in cui sei.")
    t.append("Per la separazione dal terreno e dagli spazi aerei fa sempre fede l'altimetro di bordo.")
    return ('quota', 'Quota e vario', t)


def regola_terreno(c):
    if c.tipo != 'Problema' or not c.dice('terreno', 'rilievo', 'montagn', 'vista sintetica', 'taws', 'avviso terreno'): return None
    if 'non ancora scaricato' not in c.riga('Terreno (DEM)'): return None
    return ('terreno', 'Scaricare il terreno',
            ["Dai dati il terreno non è ancora stato scaricato su questo telefono: senza, vista sintetica e avvisi del terreno non funzionano.",
             "A terra, con internet: Impostazioni › «Volare senza internet» › «Scarica terreno». Una barretta mostra l'avanzamento."])


def regola_sensori_ok(c):
    r = c.rec
    if c.tipo != 'Registrazione sensori' or not r or not r.get('righe'): return None
    terra = r.get('a_terra') or 0
    giusto = ([f"La livella a terra risulta fatta con {terra:.0f}°: a terra l'orizzonte segna apposta circa {terra:.0f}° a cabrare, "
               "cioè l'assetto dell'aereo fermo. È giusto così: in volo livellato segnerà zero."] if terra and (r.get('gs') or 0) < 5 else [])
    return ('sensori-ok', 'Sensori regolari',
            [f"Abbiamo ricevuto la registrazione ({r['righe']} letture). I sensori del telefono risultano regolari: "
             f"{c.riga('Sensori di movimento').split(' · ')[0] or 'frequenza regolare'} "
             f"(inclinazione {r['rollio']:+.0f}°, beccheggio {r['beccheggio']:+.0f}°)."] + giusto + [
             "Se in volo avevi notato qualcosa di strano, mandaci una segnalazione di tipo «Problema» descrivendo cosa hai visto e "
             "quando: con la registrazione da sola non possiamo saperlo."])


REGOLE = (regola_versione, regola_sensori, regola_livella, regola_bussola, regola_gps, regola_quota, regola_terreno)


def analizza(c):
    """→ {'riconosciuto', 'motivo', 'codici', 'sezioni'}. «motivo» dice perché la mail va all'autore."""
    trovate = []
    for regola in REGOLE:
        try: r = regola(c)
        except Exception: r = None
        if r: trovate.append(r)
    codici = [r[0] for r in trovate]
    motivo = difetto(c)
    if not motivo and not c.con_dati: motivo = 'senza dati tecnici'
    # la versione vecchia da sola spiega un «Problema» solo se è davvero molto indietro
    if not motivo and codici == ['versione-vecchia'] and c.ritardo < VECCHIA_DI: motivo = 'solo versione un po\' vecchia'
    if not motivo and not trovate:
        ok = regola_sensori_ok(c)
        if ok: trovate.append(ok); codici.append(ok[0])
        else: motivo = 'nessuna regola'
    return {'riconosciuto': not motivo, 'motivo': motivo, 'codici': codici, 'sezioni': trovate}


def _fmt(sezioni, saluto, chiusa):
    t, h = [saluto, ''], [f'<p>{H.escape(saluto)}</p>']
    for _, titolo, paragrafi in sezioni:
        t += [titolo.upper()]; h.append(f'<p style="margin:18px 0 6px"><b>{H.escape(titolo)}</b></p>')
        for p in paragrafi:
            if isinstance(p, tuple):                       # ('·', [passi]) → elenco numerato
                t += [f'  {i}. {x}' for i, x in enumerate(p[1], 1)]
                h.append('<ol>' + ''.join(f'<li>{H.escape(x)}</li>' for x in p[1]) + '</ol>')
            else:
                t.append(p); h.append(f'<p>{H.escape(p)}</p>')
        t.append('')
    t += chiusa + ['', 'HORIZON · strumento di volo']
    h += [f'<p>{H.escape(x)}</p>' for x in chiusa]
    return '\n'.join(t) + '\n', ''.join(h)


def risposta(c, esito):
    """Testo e HTML della risposta al pilota per un caso riconosciuto."""
    return _fmt(esito['sezioni'], f"Ciao, abbiamo ricevuto la tua segnalazione dalla versione {v_txt(c.ver)} e l'abbiamo analizzata in automatico dai dati tecnici allegati.",
                ["Questa risposta è preparata in automatico. Se non risolve, rispondi a questa mail: la legge il nostro team.", AVVISO, 'Buoni voli!'])


def ricevuta(c):
    """Testo e HTML per i casi che guarda l'autore: solo «ricevuta», nessun consiglio."""
    return _fmt([], "Ciao, abbiamo ricevuto la tua segnalazione" + (f" dalla versione {v_txt(c.ver)}" if c.ver else '') + ". Grazie!",
                ["Il nostro team è al lavoro per darti la risposta: ti scriviamo a questo indirizzo.", AVVISO])


def riga_anonima(c, esito, giorno):
    """Una riga per il registro dei casi (ramo pubblico): niente nomi, indirizzi, marche, testo del pilota."""
    modello = re.sub(r'[^A-Za-z0-9 ._-]', '', (c.telefono.split('·')[0] or '').strip())[:24]
    return ' | '.join([giorno, c.tipo or '?', v_txt(c.ver), c.canale, modello or '?',
                       'riconosciuto' if esito['riconosciuto'] else 'autore: ' + (esito['motivo'] or '?'), ','.join(esito['codici']) or '-'])
