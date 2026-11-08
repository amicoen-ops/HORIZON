// HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
// Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
//
// VENTO SULLA PISTA. Disegno della pista con la freccia del vento e, per ogni testata, la componente contraria (o in coda)
// e quella al traverso, confrontata con il traverso massimo del velivolo. Si usa nella pagina del vento (tocca la casella
// VENTO), nel circuito (riquadro piccolo a sinistra sulla mappa, tocca per aprire), in EMERGENZA e nel Piano (destinazione).
// La pista migliore è quella con più vento contrario e un traverso entro il limite. Vale sempre la manica a vento.
(function(){
'use strict';
const D=Math.PI/180, r3=v=>String(Math.round(((v%360)+360)%360)).padStart(3,'0'), esc=s=>String(s==null?'':s).replace(/[<&>"]/g,c=>({'<':'&lt;','&':'&amp;','>':'&gt;','"':'&quot;'}[c]));
// head > 0: vento contrario; cross > 0: vento da destra
PH.ventoComp=function(hdg,dir,kmh){ const a=(dir-hdg)*D; return {head:kmh*Math.cos(a),cross:kmh*Math.sin(a)}; };
function xmax(){ const x=+(PH.ac&&PH.ac.xwind); return x>0?x:20; }
// valutazione di ogni testata: ok / attenzione / no
PH.ventoTestate=function(f,w){
  if(!f||!f.ends||!f.ends.length||!w||!(w.kmh>=0)) return [];
  const X=xmax(), g=Math.max(w.kmh,w.gust||0);
  return f.ends.map(e=>{ const c=PH.ventoComp(e.hdg,w.dir,w.kmh), cg=PH.ventoComp(e.hdg,w.dir,g), xs=Math.abs(cg.cross);
    const st=(xs>X||c.head<-10)?'no':((xs>X*0.75||c.head<-3)?'att':'ok');
    return {id:e.id,hdg:e.hdg,head:c.head,cross:c.cross,crossG:cg.cross,st}; })
    .sort((a,b)=>({ok:0,att:1,no:2}[a.st]-{ok:0,att:1,no:2}[b.st])||b.head-a.head);
};
PH.ventoBest=function(f,w){ const t=PH.ventoTestate(f,w); return t[0]||null; };
// testo breve di una testata: «36 ↓12 contrario · ⇢5 da sx»
PH.ventoTxt=function(t){ if(!t) return '';
  const h=Math.round(Math.abs(t.head)), x=Math.round(Math.abs(t.cross));
  return `${t.id} · ${t.head>=0?'contrario':'IN CODA'} ${h} · traverso ${x}${x?(t.cross>0?' da dx':' da sx'):''} km/h`; };
// disegno: piste del campo, freccia del vento, testata migliore in verde
PH.ventoSvg=function(f,w,size,soloEnd){
  size=size||170; const c=size/2, Rr=size*0.31, col={ok:'#3ddc84',att:'#ffc531',no:'#ff5a5a'};
  const T=PH.ventoTestate(f,w), best=T[0], stOf=id=>(T.find(t=>t.id===id)||{}).st;
  let s=`<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="Vento sulla pista"><circle cx="${c}" cy="${c}" r="${c-2}" fill="#0b1720" stroke="#2c4152"/>`;
  s+=`<text x="${c}" y="${size*0.1}" fill="#8fa3b3" font-size="${size*0.075}" font-weight="700" text-anchor="middle" font-family="system-ui">N</text>`;
  const rws=(f.rw||[]).filter(r=>r.hdg!=null);
  rws.forEach(r=>{ if(soloEnd&&r.le!==soloEnd&&r.he!==soloEnd) return;
    const a=r.hdg*D, dx=Math.sin(a), dy=-Math.cos(a), wpx=size*0.075;
    const x1=c-dx*Rr, y1=c-dy*Rr, x2=c+dx*Rr, y2=c+dy*Rr;
    s+=`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#5d6b78" stroke-width="${wpx}" stroke-linecap="butt"/>`;
    s+=`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#e8eef3" stroke-width="1" stroke-dasharray="4 4"/>`;
    // numero della testata dove si atterra: la soglia «le» è dal lato opposto alla sua prua
    [[r.le,x1,y1],[r.he,x2,y2]].forEach(([id,x,y])=>{ const st=stOf(id), on=best&&best.id===id;
      const ox=(x-c)/Rr*size*0.085, oy=(y-c)/Rr*size*0.085;
      s+=`<text x="${(x+ox).toFixed(1)}" y="${(y+oy+size*0.03).toFixed(1)}" fill="${st?col[st]:'#e8eef3'}" font-size="${size*(on?0.1:0.082)}" font-weight="800" text-anchor="middle" font-family="system-ui">${esc(id)}</text>`; });
  });
  if(w&&w.kmh>=0){
    if(w.kmh<3) s+=`<text x="${c}" y="${c+size*0.03}" fill="#3ddc84" font-size="${size*0.09}" font-weight="800" text-anchor="middle" font-family="system-ui">CALMA</text>`;
    else { const a=w.dir*D, ux=Math.sin(a), uy=-Math.cos(a), L0=c-4, L1=size*0.1;      // la freccia entra dal lato da cui viene il vento
      const xa=c+ux*L0, ya=c+uy*L0, xb=c+ux*L1, yb=c+uy*L1, hx=-ux, hy=-uy, px=-hy, py=hx, hs=size*0.06;
      s+=`<line x1="${xa.toFixed(1)}" y1="${ya.toFixed(1)}" x2="${xb.toFixed(1)}" y2="${yb.toFixed(1)}" stroke="#33e1ff" stroke-width="${size*0.03}" stroke-linecap="round"/>`;
      s+=`<polygon points="${(xb+hx*hs).toFixed(1)},${(yb+hy*hs).toFixed(1)} ${(xb+px*hs*0.7).toFixed(1)},${(yb+py*hs*0.7).toFixed(1)} ${(xb-px*hs*0.7).toFixed(1)},${(yb-py*hs*0.7).toFixed(1)}" fill="#33e1ff"/>`; }
  }
  return s+'</svg>';
};
// riquadro completo: disegno + testate + note
PH.ventoHtml=function(f,w,opt){ opt=opt||{};
  if(!f) return '';
  if(!f.ends||!f.ends.length) return `<p class="ph-sub">Pista non presente nei dati: guarda la manica a vento.</p>`;
  if(!w||!(w.kmh>=0)) return `<div class="hz-vn">${PH.ventoSvg(f,null,opt.size||150)}<div class="hz-vt"><p class="ph-sub">Vento non noto: ${opt.inVolo?'vira una volta per stimarlo, oppure':'aggiorna il meteo, oppure'} guarda la manica a vento e ascolta la radio.</p></div></div>`;
  const T=PH.ventoTestate(f,w), X=xmax(), lab={ok:'BUONA',att:'ATTENZIONE',no:'NO'};
  const righe=T.map((t,i)=>{ const h=Math.round(Math.abs(t.head)), x=Math.round(Math.abs(t.crossG));
    return `<div class="hz-vr ${t.st}${i===0?' best':''}"><b>${esc(t.id)}</b><span>${t.head>=0?'↓ contrario':'↑ IN CODA'} <b>${h}</b> · traverso <b>${x}</b>${x?(t.cross>0?' da dx':' da sx'):''}</span><i>${i===0&&t.st!=='no'?'MIGLIORE':lab[t.st]}</i></div>`; }).join('');
  const src=w.src==='stim'?'stimato in volo':(w.src==='metar'?'METAR '+esc(w.id||''):(w.src==='prev'||w.src==='model'?'previsto dal modello':esc(w.src||'')));
  return `<div class="hz-vn">${PH.ventoSvg(f,w,opt.size||150)}<div class="hz-vt">
    <div class="hz-vw">Vento <b>${r3(w.dir)}° · ${Math.round(w.kmh)} km/h</b>${w.gust>w.kmh+5?' raffiche <b>'+Math.round(w.gust)+'</b>':''}<small>${src}</small></div>${righe}
    <small class="ph-sub">Traverso massimo del velivolo ${X} km/h${PH.ac&&+PH.ac.xwind>0?'':' (non impostato, uso 20: Impostazioni › Velivoli)'}${w.gust>w.kmh+5?' · traverso calcolato sulle raffiche':''}. Conta la manica a vento.</small></div></div>`;
};
// vento da usare allo strumento per un campo: METAR del campo (entro 8 km), vento stimato in volo, previsione sul campo
function stim(){ if(typeof WIND==='undefined'||!WIND.valid) return null; return {dir:WIND.dir,kmh:WIND.kmh,src:WIND.src||'stim'}; }
PH.ventoAl=function(f){
  let M=null; try{ M=PH.metarDi&&PH.metarDi(f); }catch(e){}
  const met=M&&M.kmh!=null&&((M.vrb&&M.kmh<6)||(!M.vrb&&M.dir!=null))?{dir:M.vrb?0:M.dir,kmh:M.vrb?0:M.kmh,gust:M.gust,src:'metar',id:M.id}:null;
  const w=stim(), m=f&&PH.wx&&PH.wx[f.id];
  if(w&&w.src==='stim'&&PH.flight) return w;                       // in volo vale il vento misurato dalle virate
  if(met) return met;
  if(w) return w;
  if(m&&m.kmh!=null&&m.dir!=null) return {dir:m.dir,kmh:m.kmh,gust:m.gust,src:'model'};
  return null;
};
// ---- pagina del vento (tocca la casella VENTO) ----
PH.ventoOpen=function(f){
  if(!f){ f=(typeof NAV!=='undefined'&&NAV.dest)||null;
    if(!f&&typeof FIELDS!=='undefined'&&typeof S!=='undefined') f=FIELDS.filter(x=>x.ends&&x.ends.length).map(x=>({x,d:distBrg(S,x).d})).sort((a,b)=>a.d-b.d).map(o=>o.x)[0]; }
  let d=document.getElementById('hzVento'); if(d) d.remove();
  d=document.createElement('div'); d.className='ph-sheet'; d.id='hzVento';
  const vicini=()=>typeof FIELDS==='undefined'?[]:FIELDS.filter(x=>x.ends&&x.ends.length).map(x=>({x,d:distBrg(S,x).d})).sort((a,b)=>a.d-b.d).slice(0,6).map(o=>o.x);
  const draw=()=>{ const w=f?PH.ventoAl(f):null;
    d.innerHTML=`<div class="ph-sheet-h"><button type="button" data-close>◀ Strumento</button><b>Vento sulla pista</b></div>
    <div class="ph-imp"><section><h3>${f?esc(f.name):'Nessun campo vicino'}</h3>${f?PH.ventoHtml(f,w,{size:Math.min(220,innerWidth*0.45),inVolo:true}):''}</section>
    <section><h3>Altri campi</h3><div class="hz-vc">${vicini().filter(x=>x!==f).map(x=>`<button type="button" class="ph-btn" data-f="${esc(x.id)}">${esc(x.short||x.name)}</button>`).join('')}</div></section></div>`;
    d.querySelector('[data-close]').onclick=()=>d.remove();
    d.querySelectorAll('[data-f]').forEach(b=>b.onclick=()=>{ f=FIELDS.find(x=>x.id===b.dataset.f)||f; draw(); }); };
  document.body.appendChild(d); draw(); PH.act&&PH.act('vento pista');
};
{ const c=document.getElementById('phWind'); if(c){ c.style.cursor='pointer'; c.setAttribute('role','button'); c.addEventListener('click',()=>PH.ventoOpen()); } }

// ---- riquadro piccolo nel circuito ----
function mini(){
  let m=document.getElementById('hzVnt');
  const A=typeof NAV!=='undefined'?NAV.app:null, host=document.getElementById('unit');
  if(!A||!A.f||!host||PH.ui==='simple'||(typeof PAGE!=='undefined'&&PAGE!=='map')){ if(m) m.hidden=true; return; }      // solo sulla mappa: sull'orizzonte c'è la scala della velocità
  if(!m){ m=document.createElement('button'); m.type='button'; m.id='hzVnt'; m.setAttribute('aria-label','Vento sulla pista'); m.onclick=e=>{ e.stopPropagation(); PH.ventoOpen(A.f); };
    m.addEventListener('pointerdown',e=>e.stopPropagation()); host.appendChild(m); }
  m.onclick=e=>{ e.stopPropagation(); PH.ventoOpen(NAV.app&&NAV.app.f); };
  const w=PH.ventoAl(A.f), id=A.end&&A.end.id, t=w&&PH.ventoTestate(A.f,w).find(x=>x.id===id);
  const key=A.f.id+id+(w?Math.round(w.dir/5)+','+Math.round(w.kmh):'');
  if(m.dataset.k!==key){ m.dataset.k=key;
    m.innerHTML=PH.ventoSvg(A.f,w,64,id)+(t?`<span class="${t.st}">${t.head>=0?'↓':'↑'}${Math.round(Math.abs(t.head))} ${t.cross>0?'⇠':'⇢'}${Math.round(Math.abs(t.crossG))}</span>`:'<span>vento ?</span>'); }
  m.hidden=false;
}
setInterval(()=>{ try{ mini(); }catch(e){} },1000);

// ---- METAR dal Piano: categoria VFR sui campi della mappa e vento al campo ----
PH.metar=lsGet('ia517p_metar',{t:0,list:[]});
PH.metarSet=function(m){ PH.metar=m&&m.list?m:{t:0,list:[]}; lsSet('ia517p_metar',PH.metar); };
const vecchio=()=>!PH.metar.t||Date.now()-PH.metar.t>3*3600e3;
PH.metarDi=function(f){ if(!f||vecchio()) return null; let b=null,bd=8000;
  for(const m of PH.metar.list){ const d=distBrg(f,m).d; if(d<bd){ bd=d; b=m; } } return b; };
const CAT={VFR:[61,220,132],MVFR:[79,155,255],IFR:[255,90,90],LIFR:[224,92,255]};
{ const prev=PH.mapUnder;
  PH.mapUnder=function(toS,sc,c){ if(prev) prev(toS,sc,c);
    if(PH.lyr&&PH.lyr.meteo===false||PH.ui==='simple'||vecchio()||!PH.metar.list.length) return;
    const z=ZOOMS[zi]; if(z>80) return;
    ctx.save(); ctx.font=font(R*0.03,'800'); ctx.textAlign='center'; ctx.textBaseline='top';
    for(const m of PH.metar.list){ const col=CAT[m.cat]; if(!col) continue;
      const q=enu(m.lat,m.lon), p=toS(q.E,q.N); if(p.x<-20||p.y<-20||p.x>W+20||p.y>H+20) continue;
      ctx.beginPath(); ctx.arc(p.x,p.y,11*k,0,2*Math.PI); ctx.lineWidth=3.2*k; ctx.strokeStyle=`rgba(0,0,0,.6)`; ctx.stroke(); ctx.lineWidth=2.4*k; ctx.strokeStyle=`rgb(${col})`; ctx.stroke();
      if(z<=30){ const t=m.cat+(m.kmh!=null?' '+(m.vrb?'VRB':String(Math.round(m.dir)).padStart(3,'0'))+'/'+Math.round(m.kmh):''); ctx.lineWidth=3*k; ctx.strokeStyle='rgba(0,0,0,.8)'; ctx.strokeText(t,p.x,p.y+13*k); ctx.fillStyle=`rgb(${col})`; ctx.fillText(t,p.x,p.y+13*k); } }
    ctx.restore(); };
}
{ const s=document.createElement('style'); s.textContent=`
  .hz-vn{display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap} .hz-vn svg{flex:none}
  .hz-vt{flex:1;min-width:190px;display:flex;flex-direction:column;gap:5px}
  .hz-vw{font:600 15px system-ui,sans-serif;color:#e8eef3} .hz-vw small{display:block;color:#9aa4b0;font-size:12px}
  .hz-vr{display:grid;grid-template-columns:44px 1fr auto;gap:6px;align-items:center;padding:6px 8px;border-radius:9px;background:#0f1d28;border:1px solid #24394a;font:600 14px system-ui,sans-serif;color:#cfd8e0}
  .hz-vr>b{font:800 18px 'Oxanium',system-ui,sans-serif} .hz-vr i{font-style:normal;font:800 11px system-ui;letter-spacing:.05em;padding:2px 6px;border-radius:6px}
  .hz-vr.ok>b,.hz-vr.ok i{color:#3ddc84} .hz-vr.att>b,.hz-vr.att i{color:#ffc531} .hz-vr.no>b,.hz-vr.no i{color:#ff5a5a}
  .hz-vr.best{border-color:#3ddc84;border-width:2px}
  .hz-vc{display:flex;flex-wrap:wrap;gap:6px}
  #hzVnt{position:absolute;left:6px;top:30%;z-index:6;display:flex;flex-direction:column;align-items:center;gap:1px;padding:3px;border-radius:12px;background:rgba(5,12,18,.78);border:1px solid #2c4152;cursor:pointer}
  #hzVnt[hidden]{display:none} #hzVnt span{font:800 13px 'Oxanium',system-ui,sans-serif;color:#e8eef3} #hzVnt span.att{color:#ffc531} #hzVnt span.no{color:#ff5a5a} #hzVnt span.ok{color:#3ddc84}
  body.ph-simple #hzVnt{display:none!important}`; document.head.appendChild(s); }
})();
