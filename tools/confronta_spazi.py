#!/usr/bin/env python3
# HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
# Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
"""Confronto fra due file OpenAir di spazi aerei (es. openAIP e open flightmaps).

Uso:  python3 tools/confronta_spazi.py A.txt B.txt [--nomi openAIP OFM] [--md rapporto.md]

Per ogni file: numero di spazi per classe/tipo. Poi l'abbinamento: due spazi sono lo stesso se hanno classe
compatibile e il centro entro 5 km con area simile (rapporto entro 2,5), oppure lo stesso nome normalizzato e il centro
entro 25 km. Per gli abbinati: limiti inferiori e superiori diversi (oltre 100 ft). In fondo gli spazi che ci sono
solo in una delle due fonti, divisi per classe, con nome e posizione.
Le quote AGL e FL non si convertono: si confrontano solo se hanno lo stesso riferimento.
"""
import math, re, sys, collections

NM = 1852.0
AYMAP = {'R': 'R', 'P': 'P', 'Q': 'Q', 'D': 'Q', 'DANGER': 'Q', 'RESTRICTED': 'R', 'PROHIBITED': 'P', 'TRA': 'R', 'TSA': 'R', 'OFR': 'OFR', 'ASRA': 'SPORT', 'GLIDING_SECTOR': 'GSEC', 'TMZ': 'TMZ', 'RMZ': 'RMZ'}


def coord(s):
    m = re.search(r"(\d{1,3}):(\d{1,2})(?::(\d{1,2}(?:\.\d+)?))?\s*([NS])[\s,]+(\d{1,3}):(\d{1,2})(?::(\d{1,2}(?:\.\d+)?))?\s*([EW])", s)
    if not m: return None
    la = (int(m[1]) + int(m[2]) / 60 + float(m[3] or 0) / 3600) * (-1 if m[4] == 'S' else 1)
    lo = (int(m[5]) + int(m[6]) / 60 + float(m[7] or 0) / 3600) * (-1 if m[8] == 'W' else 1)
    return la, lo


def alt(s):
    s = s.strip().upper()
    if re.match(r"^(SFC|GND|0\s*(FT)?\s*(AGL|GND|SFC)?)$", s) or s in ('', '0'): return ('SFC', 0)
    if re.match(r"^(UNL|UNLTD|UNLIM)", s): return ('UNL', 99999)
    m = re.match(r"^FL\s*(\d+)", s)
    if m: return ('FL', int(m[1]) * 100)
    m = re.match(r"^(\d+)\s*FL\b", s)
    if m: return ('FL', int(m[1]) * 100)
    m = re.match(r"^(\d+(?:\.\d+)?)\s*(M(?!SL)|FT|F)?\s*(AGL|AGND|GND|SFC|AMSL|MSL|ASFC)?", s)
    if m:
        v = float(m[1]) * (3.28084 if m[2] == 'M' else 1)
        ref = 'AGL' if m[3] in ('AGL', 'AGND', 'GND', 'SFC', 'ASFC') else 'MSL'
        return (ref, round(v))
    return ('?', 0)


def parse(path):
    txt = open(path, encoding='utf-8', errors='replace').read()
    out, cur, center, d = [], None, None, 1

    def push():
        if cur and len(cur['pts']) >= 3 and not cur.get('skip'): out.append(cur)

    def arc(c, r_m, a1, a2, dirn):
        span = ((a2 - a1) % 360) if dirn > 0 else -((a1 - a2) % 360)
        if abs(span) < 1e-6: span = 360 * dirn
        n = max(6, int(abs(span) / 10) + 1)
        return [(c[0] + r_m * math.cos(math.radians(a1 + span * i / n)) / 110540,
                 c[1] + r_m * math.sin(math.radians(a1 + span * i / n)) / (111320 * math.cos(math.radians(c[0])))) for i in range(n + 1)]

    for raw in txt.splitlines():
        line = raw.split('*', 1)[0].strip()
        if not line: continue
        up = line.upper()
        if up.startswith('V '):
            v = line[1:].strip()
            if re.match(r"(?i)^X\s*=", v): center = coord(v) or center
            elif re.match(r"(?i)^D\s*=", v): d = -1 if '-' in v else 1
            continue
        k, v = up[:2], line[2:].strip()
        if k == 'AC':
            push(); cur = {'cls': v.upper(), 'name': '', 'lo': ('SFC', 0), 'hi': ('UNL', 99999), 'pts': []}; d = 1; continue
        if not cur: continue
        if k == 'AY':
            t = v.upper()
            if t in ('FIR', 'UIR'): cur['pts'] = []; cur['skip'] = True
            elif AYMAP.get(t) and cur['cls'] in ('UNC', 'UNCLASSIFIED', ''): cur['cls'] = AYMAP[t]
            continue
        if k == 'AN': cur['name'] = v
        elif k == 'AL': cur['lo'] = alt(v)
        elif k == 'AH': cur['hi'] = alt(v)
        elif k == 'DP':
            p = coord(v)
            if p: cur['pts'].append(p)
        elif k == 'DC' and center:
            try: cur['pts'] += arc(center, float(v.split()[0]) * NM, 0, 360, 1)
            except ValueError: pass
        elif k == 'DA' and center:
            try:
                r, a1, a2 = [float(x) for x in v.split(',')[:3]]; cur['pts'] += arc(center, r * NM, a1, a2, d)
            except ValueError: pass
        elif k == 'DB' and center:
            cs = re.findall(r"\d{1,3}:\d{1,2}(?::\d{1,2}(?:\.\d+)?)?\s*[NS][\s,]+\d{1,3}:\d{1,2}(?::\d{1,2}(?:\.\d+)?)?\s*[EW]", v)
            if len(cs) == 2: cur['pts'] += [coord(cs[0]), coord(cs[1])]
    push()
    for a in out:
        la = [p[0] for p in a['pts']]; lo = [p[1] for p in a['pts']]
        a['c'] = (sum(la) / len(la), sum(lo) / len(lo))
        cl = math.cos(math.radians(a['c'][0])); A = 0
        pts = a['pts']
        for i in range(len(pts)):
            x1, y1 = pts[i][1] * 111.32 * cl, pts[i][0] * 110.54
            x2, y2 = pts[(i + 1) % len(pts)][1] * 111.32 * cl, pts[(i + 1) % len(pts)][0] * 110.54
            A += x1 * y2 - x2 * y1
        a['km2'] = abs(A) / 2
        a['key'] = norm(a['name'])
        a['tipo'] = tipo(a)
    return out


def norm(n):
    n = n.upper()
    n = re.sub(r"\b\d{3}\.\d{1,3}\b", " ", n)
    n = re.sub(r"\bZONE\s*(\d+)", r"Z\1", n)
    n = re.sub(r"\bLI[A-Z]{2}\b", " ", n)
    n = re.sub(r"\(.*?\)", " ", n)
    n = re.sub(r"\b(ATZ|CTR|TMA|CTA|TIZ|TIA|AREA|ZONE|ZONA|SECTOR|SETTORE|PARCO|PARK|RMZ|TMZ)\b", " ", n)
    return re.sub(r"[^A-Z0-9]+", "", n)


def tipo(a):
    c, n = a['cls'], a['name'].upper()
    if c in ('P', 'R', 'Q', 'W', 'GP', 'TMZ', 'RMZ', 'CTR'): return c
    for t in ('CTR', 'ATZ', 'TMA', 'CTA', 'TIZ', 'TIA', 'RMZ', 'TMZ', 'FIR', 'PARK', 'PARCO'):
        if re.search(r"\b" + t + r"\b", n): return c + ' ' + ('PARCO' if t == 'PARK' else t)
    return c


def km(p, q):
    cl = math.cos(math.radians((p[0] + q[0]) / 2))
    return math.hypot((p[0] - q[0]) * 110.54, (p[1] - q[1]) * 111.32 * cl)


def compat(a, b):
    ca, cb = a['cls'], b['cls']
    if ca == cb: return True
    grp = [{'R', 'Q', 'P', 'GP'}, {'D', 'CTR'}, {'C', 'D', 'E'}]
    return any(ca in g and cb in g for g in grp)


def abbina(A, B):
    usati, coppie = set(), []
    idx = collections.defaultdict(list)
    for j, b in enumerate(B): idx[(round(b['c'][0] * 4), round(b['c'][1] * 4))].append(j)
    for i, a in enumerate(A):
        best, bd = None, 1e9
        gx, gy = round(a['c'][0] * 4), round(a['c'][1] * 4)
        cand = [j for dx in (-1, 0, 1) for dy in (-1, 0, 1) for j in idx.get((gx + dx, gy + dy), [])]
        for j in cand:
            if j in usati: continue
            b = B[j]
            if not compat(a, b): continue
            d = km(a['c'], b['c']); r = max(a['km2'], b['km2']) / max(1e-3, min(a['km2'], b['km2']))
            same = a['key'] and a['key'] == b['key']
            vz = sum(abs(x[1] - y[1]) / 1000 for x, y in ((a['lo'], b['lo']), (a['hi'], b['hi'])) if x[0] == y[0])
            if (d < 5 and r < 2.5) or (same and d < 25):
                s = d + (0 if same else 3) + math.log(r) + vz
                if s < bd: best, bd = j, s
        if best is not None: usati.add(best); coppie.append((i, best))
    return coppie, usati


def fmt_alt(x):
    r, v = x
    return {'SFC': 'SFC', 'UNL': 'UNL', 'FL': f'FL{v // 100}'}.get(r, f'{v} ft {r}')


def main(argv):
    nomi = ['A', 'B']; md = None; files = []
    i = 0
    while i < len(argv):
        if argv[i] == '--nomi': nomi = argv[i + 1:i + 3]; i += 3; continue
        if argv[i] == '--md': md = argv[i + 1]; i += 2; continue
        files.append(argv[i]); i += 1
    A, B = parse(files[0]), parse(files[1])
    L = [f"# Confronto spazi aerei: {nomi[0]} e {nomi[1]}", '',
         f"- {nomi[0]}: **{len(A)}** spazi · {nomi[1]}: **{len(B)}** spazi", '']
    ca, cb = collections.Counter(a['tipo'] for a in A), collections.Counter(b['tipo'] for b in B)
    L += ['## Spazi per tipo', '', f'| tipo | {nomi[0]} | {nomi[1]} |', '|---|---:|---:|']
    for t in sorted(set(ca) | set(cb), key=lambda t: -(ca[t] + cb[t])): L.append(f'| {t} | {ca[t]} | {cb[t]} |')
    coppie, usati = abbina(A, B)
    L += ['', f'## Abbinati: {len(coppie)} (lo stesso spazio nelle due fonti)', '']
    dl = []
    for i, j in coppie:
        a, b = A[i], B[j]
        for lab, x, y in (('base', a['lo'], b['lo']), ('tetto', a['hi'], b['hi'])):
            if x[0] == y[0] and abs(x[1] - y[1]) > 100 or (x[0] != y[0] and {x[0], y[0]} != {'SFC', 'AGL'} and not (x[0] == 'SFC' and y[1] == 0) and not (y[0] == 'SFC' and x[1] == 0)):
                dl.append((a['tipo'], a['name'], lab, fmt_alt(x), b['name'], fmt_alt(y)))
    L.append(f'Limiti verticali diversi: **{len(dl)}** casi (primi 80).')
    if dl:
        L += ['', f'| tipo | {nomi[0]} | limite | {nomi[0]} | {nomi[1]} | {nomi[1]} |', '|---|---|---|---|---|---|']
        for t, n1, lab, x, n2, y in dl[:80]: L.append(f'| {t} | {n1} | {lab} | {x} | {y} | {n2} |')
    soloA = [A[i] for i in range(len(A)) if i not in {p[0] for p in coppie}]
    soloB = [B[j] for j in range(len(B)) if j not in usati]
    for nome, lst in ((nomi[0], soloA), (nomi[1], soloB)):
        L += ['', f'## Solo in {nome}: {len(lst)}', '']
        cc = collections.Counter(x['tipo'] for x in lst)
        L.append(' · '.join(f'{t} {n}' for t, n in cc.most_common()))
        imp = [x for x in lst if x['cls'] in ('P', 'R', 'D', 'C', 'CTR', 'A', 'B') or 'CTR' in x['tipo'] or 'ATZ' in x['tipo']]
        if imp:
            L += ['', f'Quelli che contano per gli avvisi (P, R, CTR, ATZ, classi A–D), primi 120:', '', '| tipo | nome | base | tetto | centro |', '|---|---|---|---|---|']
            for x in sorted(imp, key=lambda x: (x['tipo'], x['name']))[:120]:
                L.append(f"| {x['tipo']} | {x['name']} | {fmt_alt(x['lo'])} | {fmt_alt(x['hi'])} | {x['c'][0]:.3f}, {x['c'][1]:.3f} |")
    out = '\n'.join(L) + '\n'
    if md: open(md, 'w', encoding='utf-8').write(out)
    print(out)


if __name__ == '__main__':
    main(sys.argv[1:])
