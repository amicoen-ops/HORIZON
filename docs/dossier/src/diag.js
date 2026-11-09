// HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
// Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
//
// Piccola libreria per i diagrammi del dossier tecnico: riquadri, gruppi, frecce ortogonali con etichetta e
// diagrammi di sequenza, disegnati in SVG. Ogni pagina docs/dossier/src/fig-*.html la usa e chiama D.render().
// Colori uguali in tutti i diagrammi (classe «k» dei riquadri):
//   web = pagine e JavaScript dell'app · nat = moduli nativi Java · ext = servizi esterni · ci = GitHub Actions
//   mail = Gmail e Apps Script · watch = orologio Garmin · data = dati e memorie · hw = sensori e hardware
const K = {
  web:   { f: '#e6f1fb', s: '#185fa5', t: '#0c447c' },
  nat:   { f: '#e4f4ec', s: '#0f6e56', t: '#0b5040' },
  ext:   { f: '#f4f2ec', s: '#8a8780', t: '#3d3c38' },
  ci:    { f: '#efe9fb', s: '#5b3fa0', t: '#3e2a72' },
  mail:  { f: '#fdf0e0', s: '#b06d00', t: '#6e4300' },
  watch: { f: '#fbeaf0', s: '#993556', t: '#6d1f3b' },
  data:  { f: '#fffbe6', s: '#b39500', t: '#5e4e00' },
  hw:    { f: '#eceff3', s: '#4a5563', t: '#2a313b' },
  red:   { f: '#fdeaea', s: '#a32020', t: '#7a1414' },
  pilot: { f: '#ffffff', s: '#0c447c', t: '#0c447c' },
};
const NS = 'http://www.w3.org/2000/svg';
function el(tag, attrs, parent) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}
class Diagram {
  constructor(w, h, title) { this.w = w; this.h = h; this.items = []; this.boxes = {}; this.title = title; }
  box(o) { o.k = o.k || 'web'; this.boxes[o.id] = o; this.items.push(['box', o]); return this; }
  group(o) { this.items.unshift(['group', o]); return this; }
  arrow(a, b, o) { this.items.push(['arrow', Object.assign({ a, b }, o || {})]); return this; }
  text(o) { this.items.push(['text', o]); return this; }
  badge(o) { this.items.push(['badge', o]); return this; }
  legend(o) { this.items.push(['legend', o]); return this; }
  // punto di aggancio: lato (l r t b) e frazione lungo il lato (0..1, di serie 0.5)
  anchor(id, side, f) {
    const b = this.boxes[id]; if (!b) throw new Error('riquadro ' + id);
    f = f == null ? 0.5 : f;
    if (side === 'l') return [b.x, b.y + b.h * f];
    if (side === 'r') return [b.x + b.w, b.y + b.h * f];
    if (side === 't') return [b.x + b.w * f, b.y];
    return [b.x + b.w * f, b.y + b.h];
  }
  autoSides(a, b) {
    const A = this.boxes[a], B = this.boxes[b];
    const ac = [A.x + A.w / 2, A.y + A.h / 2], bc = [B.x + B.w / 2, B.y + B.h / 2];
    if (A.x + A.w <= B.x) return ['r', 'l']; if (B.x + B.w <= A.x) return ['l', 'r'];
    return ac[1] < bc[1] ? ['b', 't'] : ['t', 'b'];
  }
  render(sel) {
    const host = document.querySelector(sel || '#fig');
    host.style.width = this.w + 'px';
    const svg = el('svg', { width: this.w, height: this.h, viewBox: `0 0 ${this.w} ${this.h}` }, host);
    const defs = el('defs', {}, svg);
    for (const [n, c] of Object.entries(Object.assign({ n: '#333a44' }, Object.fromEntries(Object.entries(K).map(([a, b]) => [a, b.s]))))) {
      const m = el('marker', { id: 'ah-' + n, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, defs);
      el('path', { d: 'M0,0 L10,5 L0,10 z', fill: c }, m);
    }
    const labels = [];
    for (const [t, o] of this.items) {
      if (t === 'group') {
        const c = K[o.k || 'ext'];
        el('rect', { x: o.x, y: o.y, width: o.w, height: o.h, rx: 14, fill: o.fill || 'none', stroke: c.s, 'stroke-width': 1.4, 'stroke-dasharray': '6 5' }, svg);
        const tx = el('text', { x: o.x + 12, y: o.bottom ? o.y + o.h - 9 : o.y + 19, fill: c.t, 'font-size': 13, 'font-weight': 700, 'letter-spacing': '.04em' }, svg); tx.textContent = o.t;
      } else if (t === 'box') {
        const c = K[o.k];
        el('rect', { x: o.x, y: o.y, width: o.w, height: o.h, rx: 9, fill: c.f, stroke: c.s, 'stroke-width': o.bold ? 2.4 : 1.5 }, svg);
        const lines = o.s || [];
        const th = 17, sh = 14.5, tot = (o.t ? th : 0) + lines.length * sh;
        let y = o.y + (o.h - tot) / 2 + 13;
        if (o.top) y = o.y + 20;
        if (o.t) { for (const [i, part] of String(o.t).split('\n').entries()) { const e = el('text', { x: o.left ? o.x + 10 : o.x + o.w / 2, y: y + i * 0, 'text-anchor': o.left ? 'start' : 'middle', fill: c.t, 'font-size': o.fs || 14.5, 'font-weight': 700 }, svg); e.textContent = part; } y += th; }
        for (const l of lines) {
          const e = el('text', { x: o.la ? o.x + 12 : o.x + o.w / 2, y, 'text-anchor': o.la ? 'start' : 'middle', fill: '#333a44', 'font-size': o.ss || 12, 'font-family': /^`/.test(l) ? 'DejaVu Sans Mono, monospace' : 'inherit' }, svg);
          e.textContent = l.replace(/^`/, ''); y += sh;
        }
        if (o.n != null) this.drawBadge(svg, o.x - 9, o.y - 9, o.n, c.s);
      } else if (t === 'arrow') {
        const sd = o.sides || ((Array.isArray(o.a) || Array.isArray(o.b)) ? 'tb' : this.autoSides(o.a, o.b).join('')); const sa = sd[0], sb = sd[1];
        const p0 = Array.isArray(o.a) ? o.a : this.anchor(o.a, sa, o.fa), p1 = Array.isArray(o.b) ? o.b : this.anchor(o.b, sb, o.fb);
        let pts;
        if (o.via) pts = [p0, ...o.via, p1];
        else if (Math.abs(p0[0] - p1[0]) < 1 || Math.abs(p0[1] - p1[1]) < 1) pts = [p0, p1];
        else if ('lr'.includes(sa) && 'lr'.includes(sb)) { const mx = o.mid != null ? o.mid : (p0[0] + p1[0]) / 2; pts = [p0, [mx, p0[1]], [mx, p1[1]], p1]; }
        else if ('tb'.includes(sa) && 'tb'.includes(sb)) { const my = o.mid != null ? o.mid : (p0[1] + p1[1]) / 2; pts = [p0, [p0[0], my], [p1[0], my], p1]; }
        else if ('lr'.includes(sa)) pts = [p0, [p1[0], p0[1]], p1];
        else pts = [p0, [p0[0], p1[1]], p1];
        const col = (o.k && K[o.k]) ? K[o.k].s : '#333a44';
        const pa = el('polyline', { points: pts.map(p => p.join(',')).join(' '), fill: 'none', stroke: col, 'stroke-width': o.w || 1.7, 'stroke-linejoin': 'round' }, svg);
        if (o.dash) pa.setAttribute('stroke-dasharray', '6 4');
        pa.setAttribute('marker-end', `url(#ah-${(o.k && K[o.k]) ? o.k : 'n'})`);
        if (o.both) pa.setAttribute('marker-start', `url(#ah-${(o.k && K[o.k]) ? o.k : 'n'})`);
        if (o.t) {
          let best = 0, bi = 0; for (let i = 0; i < pts.length - 1; i++) { const d = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); if (d > best) { best = d; bi = i; } }
          const at = o.at != null ? o.at : 0.5;
          let lx = pts[bi][0] + (pts[bi + 1][0] - pts[bi][0]) * at, ly = pts[bi][1] + (pts[bi + 1][1] - pts[bi][1]) * at;
          if (o.lp) { lx = o.lp[0]; ly = o.lp[1]; }
          labels.push({ x: lx + (o.dx || 0), y: ly + (o.dy || 0), t: o.t, col, n: o.n });
        }
      } else if (t === 'text') {
        const parts = String(o.t).split('\n');
        parts.forEach((p, i) => { const e = el('text', { x: o.x, y: o.y + i * (o.lh || 15), 'text-anchor': o.a || 'start', fill: o.c || '#5f5e5a', 'font-size': o.fs || 12, 'font-weight': o.b ? 700 : 400, 'font-style': o.i ? 'italic' : 'normal' }, svg); e.textContent = p; });
      } else if (t === 'badge') {
        this.drawBadge(svg, o.x, o.y, o.n, o.c || '#0c447c');
      } else if (t === 'legend') {
        let x = o.x; const y = o.y;
        for (const k of o.keys) { const c = K[k[0]]; el('rect', { x, y: y - 11, width: 22, height: 14, rx: 4, fill: c.f, stroke: c.s, 'stroke-width': 1.3 }, svg);
          const e = el('text', { x: x + 28, y, fill: '#3d3c38', 'font-size': 12 }, svg); e.textContent = k[1]; x += 34 + k[1].length * 6.6; }
      }
    }
    for (const L of labels) {
      const parts = String(L.t).split('\n'); const lh = 14;
      const g = el('g', {}, svg);
      const tw = Math.max(...parts.map(p => p.length)) * 6.3 + 10, h = parts.length * lh + 6;
      el('rect', { x: L.x - tw / 2, y: L.y - h / 2, width: tw, height: h, rx: 4, fill: '#ffffff', 'fill-opacity': 0.94 }, g);
      parts.forEach((p, i) => { const e = el('text', { x: L.x, y: L.y - h / 2 + 3 + lh * (i + 1) - 3, 'text-anchor': 'middle', fill: L.col, 'font-size': 11.5, 'font-weight': 600 }, g); e.textContent = p; });
      if (L.n != null) this.drawBadge(svg, L.x - tw / 2 - 12, L.y - 9, L.n, L.col);
    }
    return svg;
  }
  drawBadge(svg, x, y, n, c) {
    el('circle', { cx: x + 9, cy: y + 9, r: 10, fill: c }, svg);
    const e = el('text', { x: x + 9, y: y + 13.5, 'text-anchor': 'middle', fill: '#fff', 'font-size': 12, 'font-weight': 800 }, svg); e.textContent = n;
  }
}

// diagramma di sequenza: corsie verticali, messaggi orizzontali dall'alto in basso
function sequence(o) {
  const lanes = o.lanes, n = lanes.length, W = o.w || 1000, x0 = o.x0 || 20, lw = (W - 2 * x0) / n;
  const top = o.top || 20, hh = o.hh || 54, step = o.step || 40;
  const cx = {}; lanes.forEach((l, i) => { cx[l.id] = x0 + lw * i + lw / 2; });
  let y = top + hh + (o.first || 34);
  const rows = [];
  for (const r of o.rows) { rows.push(Object.assign({ y }, r)); y += r.h || step; }
  const H = y + 10;
  const D = new Diagram(W, H);
  lanes.forEach((l, i) => {
    D.box({ id: l.id, x: x0 + lw * i + 8, y: top, w: lw - 16, h: hh, t: l.t, s: l.s, k: l.k, fs: 13.5, ss: 11 });
  });
  D._seq = { cx, top, hh, H, rows };
  const orig = D.render.bind(D);
  D.render = function (sel) {
    const svg = orig(sel);
    // linee di vita sotto ai messaggi
    const g = el('g', {}, svg); svg.insertBefore(g, svg.children[1]);
    for (const l of lanes) el('line', { x1: cx[l.id], y1: top + hh, x2: cx[l.id], y2: H - 6, stroke: '#9aa0a8', 'stroke-width': 1.2, 'stroke-dasharray': '4 4' }, g);
    for (const r of rows) {
      if (r.note) {
        const parts = String(r.note).split('\n'), h = parts.length * 14 + 8;
        const a = cx[r.f], b = cx[r.to || r.f], nw = Math.max(Math.abs(a - b) + 140, Math.max(...parts.map(p => p.length)) * 6.4 + 20);
        let x1 = (a + b) / 2 - nw / 2; x1 = Math.max(4, Math.min(W - 4 - nw, x1)); const x2 = x1 + nw;
        const c = K[r.k || 'data'];
        el('rect', { x: x1, y: r.y - h / 2, width: x2 - x1, height: h, rx: 5, fill: c.f, stroke: c.s, 'stroke-width': 1.1 }, svg);
        parts.forEach((p, i) => { const e = el('text', { x: (x1 + x2) / 2, y: r.y - h / 2 + 15 + i * 14, 'text-anchor': 'middle', fill: c.t, 'font-size': 11.5, 'font-style': 'italic' }, svg); e.textContent = p; });
        continue;
      }
      const kk = (r.k && K[r.k]) ? r.k : 'n', a = cx[r.f], b = cx[r.to], col = kk === 'n' ? '#333a44' : K[kk].s;
      const ln = el('line', { x1: a, y1: r.y, x2: b + (b > a ? -2 : 2), y2: r.y, stroke: col, 'stroke-width': 1.7, 'marker-end': `url(#ah-${kk})` }, svg);
      if (r.dash) ln.setAttribute('stroke-dasharray', '6 4');
      const parts = String(r.t).split('\n'), mx = (a + b) / 2;
      parts.forEach((p, i) => {
        const yy = r.y - 6 - (parts.length - 1 - i) * 13.5;
        const tw = p.length * 6.4 + 8;
        el('rect', { x: mx - tw / 2, y: yy - 11, width: tw, height: 14, fill: '#fff', 'fill-opacity': 0.9 }, svg);
        const e = el('text', { x: mx, y: yy, 'text-anchor': 'middle', fill: col, 'font-size': 11.5, 'font-weight': 600 }, svg); e.textContent = p;
      });
      if (r.n != null) D.drawBadge(svg, Math.min(a, b) - 22, r.y + 3, r.n, col);
    }
    return svg;
  };
  return D;
}
