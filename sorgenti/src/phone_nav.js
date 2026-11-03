// ---------------- barra in basso: 4 tasti grandi (VOLO, PIANO, TRAFFICO, ALTRO) e griglia ALTRO ----------------
// Pensata per il volo: tasti alti, scritte grandi e contrasto alto. ALTRO apre una griglia che resta aperta
// finché non scegli una voce o la chiudi con ✕; non si richiude da sola.
PH.NAV_MORE=['imp','sim','prof','fuel','info'];
PH.moreOpen=function(on){ const m=el('phMore'); if(!m) return; m.hidden=!on; const b=el('phNavMore'); if(b) b.setAttribute('aria-expanded',String(!!on)); if(on) PH.act&&PH.act('menu altro'); };
{ const origShow=PH.show;
  PH.show=function(v){
    if(v==='more'){ PH.moreOpen(el('phMore').hidden); return; }
    PH.moreOpen(false); origShow.apply(this,arguments);
    const b=el('phNavMore'); if(b) b.setAttribute('aria-current',PH.NAV_MORE.includes(v)?'page':'false'); };
}
setTimeout(()=>{ const m=el('phMore'); if(!m) return;
  m.addEventListener('click',ev=>{ const b=ev.target.closest('button'); if(ev.target===m){ PH.moreOpen(false); return; } if(!b) return;
    if(b.hasAttribute('data-x')){ PH.moreOpen(false); return; } if(b.dataset.v) PH.show(b.dataset.v); }); },0);
