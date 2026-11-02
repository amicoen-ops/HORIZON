// HORIZON · prestazioni del velivolo per salite, discese e giri di 360° · © 2026 Enrico D'Amico · Tutti i diritti riservati.
// Modello semplice e prudente, dai dati del profilo del velivolo:
//  · rateo di salita «roc» = a peso massimo, al livello del mare, aria standard;
//    cala in modo lineare con la quota di densità fino a 100 ft/min alla quota massima operativa «ceil»;
//    più leggero sale di più (al massimo +35%), più pesante di meno; in virata a 20° si perde il 15%.
//  · rateo di discesa massimo «rod» (ft/min), di serie 700.
//  · giri di 360° a 20° d'inclinazione alla velocità di salita (Vy) o di crociera: raggio, durata, piedi per giro.
(function(){
'use strict';
const G=9.80665, FT=0.3048, BANK=20*Math.PI/180;
const num=(a,k,d)=>{ const v=a&&a[k]; return v===''||v==null||isNaN(+v)?d:+v; };
const dens=a=>({mogas:0.74,avgas:0.72,ul91:0.72}[a&&a.fuelType]||0.72);
// peso: vuoto + persone + bagaglio + carburante; senza dati, il massimo al decollo (la stima più prudente)
function weight(a,o){ o=o||{}; const mt=num(a,'mtow',450), em=num(a,'empty',0);
  if(!em) return mt;
  const w=em+(+o.pil||80)+(+o.pax||0)+(+o.bag||0)+(o.fuelL!=null?o.fuelL:num(a,'fuelCap',60))*dens(a);
  return Math.max(em,Math.min(w,mt*1.2)); }
// quota di densità (ft) con la differenza dall'aria standard in °C (+120 ft per grado)
const da=(altFt,isa)=>altFt+118.8*(isa||0);
function roc(a,altFt,o){ o=o||{}; const r0=num(a,'roc',600), ce=num(a,'ceil',10000), mt=num(a,'mtow',450), W=o.W||mt;
  const fw=Math.max(0.8,Math.min(1.35,Math.pow(mt/W,1.2)));
  const h=Math.max(0,da(altFt,o.isa)), r=(r0*fw)-(r0*fw-100)*h/Math.max(1000,ce);
  return Math.max(0,r)*(o.turn?0.85:1); }
function rod(a){ return num(a,'rod',700); }
// velocità in salita (m/s): Vy se c'è, altrimenti l'80% della crociera
function vclimb(a){ return Math.max(15,(num(a,'vy',0)||num(a,'vcruise',110)*0.8)/3.6); }
function orbit(a,altFt,o){ o=o||{}; const V=o.kmh?o.kmh/3.6:vclimb(a), R=V*V/(G*Math.tan(BANK)), sec=2*Math.PI*R/V;
  return {R,sec,V,up:roc(a,altFt,Object.assign({},o,{turn:true}))*sec/60,down:rod(a)*sec/60,bank:20}; }
// distanza (m) per salire da h0 a h1 alla velocità al suolo gs (m/s): a passi di 100 ft, col rateo che cala con la quota
function climbDist(a,h0,h1,gs,o){ if(h1<=h0) return 0; let d=0; for(let h=h0;h<h1;h+=100){ const r=roc(a,h+50,o); if(r<=1) return Infinity; d+=Math.min(100,h1-h)/(r/60)*gs; } return d; }
function descDist(a,h0,h1,gs){ if(h1>=h0) return 0; return (h0-h1)/(rod(a)/60)*gs; }
// quota massima raggiungibile salendo per d metri a gs
function climbIn(a,h0,d,gs,o){ let h=h0, left=d; while(left>0){ const r=roc(a,h+50,o); if(r<=1) break; const need=100/(r/60)*gs; if(need>left){ h+=100*left/need; break; } h+=100; left-=need; } return h; }
window.IA517_PERF={weight,roc,rod,vclimb,orbit,climbDist,descDist,climbIn,da};
})();
