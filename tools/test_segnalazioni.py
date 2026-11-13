#!/usr/bin/env python3
# HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
"""Prove di tools/segnalazioni.py: casi veri resi anonimi. Si lancia con: python3 tools/test_segnalazioni.py"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import segnalazioni as S

ULTIMA = (1, 0, 174)
DIAG = """Versione {v} (build 174, play) · HZ·XX·2026·000000000000
Mozilla/5.0 (Linux; Android 14; MODELLO Build/X; wv)
Schermo 384×816 @2.8125
GPS del telefono: {gps}
Garmin GLO 2: non collegato
Sensori di movimento: {sens}
Bussola: {bus}
Barometro: {baro}
Montaggio: {mont}
Quota GPS: {quota}
Terreno (DEM): {dem}
Internet: sì
Giroscopio: sì · virate da giroscopio · virata GPS 0.0°/s
Errori di disegno: {err}
Disegno: 5.2 ms per fotogramma · 60 al secondo · blocchi {blocchi}
Sessione precedente, ultimo stato: 12/11/2026, 15:02:32 · pagina pfd · zoom 22 km · mappa topo · 5 ms (max 17) · blocchi 0{domanda} · terreno 42 · tessere in arrivo 0
Ultime azioni della sessione precedente:
15:02:17 menu chiuso
{azione}
Ultimi errori:
{errori}"""
BASE = dict(v='1.0.174', gps='±3 m · 33 satelliti usati su 54 · adesso', sens='60 Hz (dichiarati 63) · assi αβγ (riconosciuti) · schermo 0°',
            bus='152° vera · in uso', baro='1013.2 hPa · quota e vario dal barometro, tenuti giusti dal GPS', mont='livellato',
            quota='tarata a CAMPO', dem='21 riquadri in memoria', err='0', blocchi='0', domanda='', azione='15:02:28 menu altro',
            errori='2026-11-10T17:54:20 blocco 2946 ms · pagina pfd')


def rec(rollio, becch, gs='0.2', terra='0'):
    righe = '\n'.join(f'{i*17} 16.7 0.600 9.700 0.300 0.10 0.10 0.10 {rollio} {becch} 0.00 giroscopio' for i in range(1, 60))
    return (f'\n\nREGISTRAZIONE SENSORI 60 eventi/s\nmontaggio [[0,0.2,-0.97],[1,0,0],[0,-0.97,-0.2]] · a terra {terra}° · segno acc 1\n'
            f'GPS vivo · GS {gs} km/h · bussola 153°\nms dt_ms ax ay az alpha beta gamma rollio beccheggio vario virata\n{righe}')


def caso(tipo='Problema', msg='x', ver='HORIZON 1.0.174 · Google Play', coda='', **k):
    d = dict(BASE, **k)
    mail = (f"Segnalazione\n{tipo}\nMessaggio\n{msg}\nRispondere a\nnon indicato\nVelivolo\nI-0000 · Aereo · VNE 245 km/h\n"
            f"Versione\n{ver}\nTelefono\nMODELLO · Android 14\nInviata il\n12/11/2026 alle 15:05\nDati tecnici\n" + DIAG.format(**d) + coda)
    c = S.Caso(S.campi(mail), ULTIMA)
    return c, S.analizza(c)


prove = 0
def vero(cosa, cond):
    global prove; prove += 1
    if not cond: print('FALLITA:', cosa); sys.exit(1)

# 1. il caso da cui è nato tutto: registrazione da fermo con 12° a cabrare, livella premuta e non confermata
c, e = caso('Registrazione sensori', 'Registrazione di 20 s', coda=rec(-5.2, 12.4), domanda=' · domanda a schermo', azione='15:02:25 livella a terra 11°')
vero('registrazione storta: riconosciuta', e['riconosciuto'] and e['codici'] == ['livella'])
t, h = S.risposta(c, e)
vero('risposta: parla di livella non confermata e di biciclo', 'non è stata applicata' in t and 'biciclo' in t and 'LIVELLA' in t and '<ol>' in h)
vero('risposta: avvertenza sempre presente', S.AVVISO in t and S.AVVISO in h)
vero('ai piloti si parla del team, mai dell\'autore', 'autore' not in t and 'autore' not in S.ricevuta(c)[0] and 'nostro team' in S.ricevuta(c)[0])
# 2. registrazione regolare
c, e = caso('Registrazione sensori', 'Registrazione di 20 s', coda=rec(0.4, -1.1))
vero('registrazione regolare: riconosciuta come sensori-ok', e['riconosciuto'] and e['codici'] == ['sensori-ok'])
# 2b. livella a terra fatta con 11°: da fermo 11° a cabrare è GIUSTO, niente consiglio di rilivellare
c, e = caso('Registrazione sensori', 'Registrazione di 20 s', coda=rec(0.5, 11.3, terra='11'))
vero('a terra 11° dopo la livella: sensori-ok', e['codici'] == ['sensori-ok'] and 'È giusto così' in S.risposta(c, e)[0])
# 3. registrazione in volo: l'assetto non a zero è normale, niente consiglio di livellare
c, e = caso('Registrazione sensori', 'Registrazione di 20 s', coda=rec(-20, 8, gs='130'))
vero('registrazione in volo: niente livella', 'livella' not in e['codici'])
# 4. versione molto vecchia: basta quello
c, e = caso(msg="ruotando il telefono a destra l'orizzonte va verso l'alto", ver='HORIZON 1.0.71 · Google Play', v='1.0.71')
vero('versione vecchia: riconosciuta', e['riconosciuto'] and 'versione-vecchia' in e['codici'])
vero('versione vecchia: istruzioni Play', 'Play Store' in S.risposta(c, e)[0])
# 5. versione attuale, dati a posto, problema di orizzonte: NON si risponde da soli
c, e = caso(msg="l'orizzonte in virata resta inclinato")
vero('dati a posto: va all\'autore', not e['riconosciuto'] and e['motivo'] == 'nessuna regola')
# 6. orizzonte storto e telefono mai livellato
c, e = caso(msg="l'orizzonte è storto", mont='telefono verticale (predefinito)')
vero('mai livellato: riconosciuta', e['riconosciuto'] and e['codici'] == ['livella'])
# 7. difetti: sempre all'autore, anche se una regola scatterebbe
for k, m in ((dict(err='3 · ultimo: x'), 'orizzonte storto'), (dict(blocchi='2'), 'orizzonte storto'), ({}, "l'app si chiude da sola"),
             (dict(errori='2026-11-12T15:01:00 TypeError'), 'orizzonte storto')):
    c, e = caso(msg=m, mont='telefono verticale (predefinito)', **k)
    vero(f'difetto all\'autore: {m} {k}', not e['riconosciuto'])
# 8. suggerimenti e dati sbagliati: sempre all'autore
for tipo in ('Suggerimento', 'Dato sbagliato'):
    vero(tipo + ': autore', not caso(tipo, 'la quota del campo è sbagliata', quota='geoide 48 m, non tarata')[1]['riconosciuto'])
# 9. quota senza barometro
c, e = caso(msg='la quota balla di 50 piedi', baro='non presente su questo telefono: quota e vario dal GPS')
vero('quota senza barometro', e['riconosciuto'] and e['codici'] == ['quota'])
# 10. bussola da calibrare, terreno non scaricato, GPS debole, sensori lenti
vero('bussola', caso(msg='la bussola segna sbagliato', bus='152° vera · in uso · da calibrare (muovi a otto)')[1]['codici'] == ['bussola'])
vero('terreno', caso(msg='non vedo il terreno', dem='non ancora scaricato')[1]['codici'] == ['terreno'])
vero('gps', caso(msg='la posizione salta', gps='±85 m · 4 satelliti usati su 12 · adesso')[1]['codici'] == ['gps'])
vero('sensori lenti', caso(msg='orizzonte a scatti', sens='12 Hz · assi αβγ · schermo 0°')[1]['codici'] == ['sensori-lenti'])
# 10b. versione web sul computer: i sensori mancano sempre; se il pilota parla d'altro la mail va all'autore
c, e = caso(msg='non riesco a salvare la rotta', ver='HORIZON 13.11.2026 · web / iPhone', v='13.11.2026', sens='nessun dato')
vero('web senza sensori, domanda su altro: autore', not e['riconosciuto'])
vero('web senza sensori, domanda sull\'orizzonte: riconosciuta', caso(msg="l'orizzonte non si muove", ver='HORIZON 13.11.2026 · web / iPhone', v='13.11.2026', sens='nessun dato')[1]['codici'] == ['sensori-assenti'])
# 11. senza dati tecnici: autore
c = S.Caso(S.campi('Segnalazione\nProblema\nMessaggio\nla bussola non va\nVersione\nHORIZON 1.0.174 · Google Play\nDati tecnici\nnon allegati'), ULTIMA)
vero('senza dati: autore', not S.analizza(c)['riconosciuto'])
# 12. la mail come pagina (Web3Forms) e la riga anonima
pag = '<table><tr><td><b>Segnalazione</b></td></tr><tr><td>Problema</td></tr><tr><td>Messaggio</td></tr><tr><td>prova &amp; riprova</td></tr><tr><td>Versione</td></tr><tr><td>HORIZON 1.0.174 · Google Play</td></tr></table>'
f = S.campi(S.testo_da_html(pag))
vero('pagina: campi letti', f.get('Segnalazione') == 'Problema' and f.get('Messaggio') == 'prova & riprova')
c, e = caso(msg="l'orizzonte è storto", mont='telefono verticale (predefinito)')
riga = S.riga_anonima(c, e, '2026-11-12')
vero('riga anonima: niente marche né testo', 'I-0000' not in riga and 'storto' not in riga and 'livella' in riga)
vero('ultima versione letta dal sorgente', S.ultima_versione('const PH_CHANGES=[\n  ["1.0.174","x"],') == (1, 0, 174))
print(f'Tutte le {prove} prove delle segnalazioni passano.')
