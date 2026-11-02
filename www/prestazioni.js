// HORIZON · prestazioni del velivolo per salite, discese e giri di 360° · © 2026 Enrico D'Amico · Tutti i diritti riservati.
// Modello semplice e prudente, dai dati del profilo del velivolo:
//  · rateo di salita «roc» = a peso massimo, al livello del mare, aria standard;
//    cala in modo lineare con la quota di densità fino a 100 ft/min alla quota massima operativa «ceil»;
//    più leggero sale di più (al massimo +35%), più pesante di meno; in virata a 20° si perde il 15%.
//  · rateo di discesa massimo «rod» (ft/min), di serie 700.
//  · giri di 360° da 10° a 20° d'inclinazione (più larghi se c'è spazio: si perde meno salita e si stressa meno l'aereo): raggio, durata, piedi per giro.
//  · salita graduale «gentle»: il 60% del rateo disponibile, al massimo 500 ft/min, a velocità fra Vy e crociera (motore più fresco);
//    discesa graduale «gentleDn»: al massimo 500 ft/min (e mai oltre il rateo massimo del profilo).
(function(){
'use strict';
const G=9.80665, FT=0.3048, D2R=Math.PI/180;
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
  return Math.max(0,r)*(o.turn?turnF(o.bank):1); }
// in virata il carico n=1/cos(φ) aumenta la resistenza indotta: a 20° si perde ~15% del rateo, a 10° ~4%
function turnF(bank){ const b=(bank||20)*D2R, n2=1/Math.cos(b)**2, n20=1/Math.cos(20*D2R)**2; return 1-0.15*(n2-1)/(n20-1); }
// salita graduale: 60% del rateo, al massimo 500 ft/min (se l'aereo sale poco, almeno 150 ft/min o quello che c'è)
function gentle(a,altFt,o){ const r=roc(a,altFt,o); return Math.min(500,Math.max(Math.min(r,150),r*0.6)); }
function gentleDn(a){ return Math.min(500,rod(a)); }
// velocità della salita graduale (m/s): a metà fra quella di salita e la crociera, per raffreddare meglio il motore
function vgentle(a){ return (vclimb(a)+Math.max(vclimb(a),num(a,'vcruise',110)/3.6))/2; }
function rod(a){ return num(a,'rod',700); }
// velocità in salita (m/s): Vy se c'è, altrimenti l'80% della crociera
function vclimb(a){ return Math.max(15,(num(a,'vy',0)||num(a,'vcruise',110)*0.8)/3.6); }
// giro di 360°: o.bank in gradi (di serie 20), o.soft=true usa salita e discesa graduali invece dei ratei massimi
function orbit(a,altFt,o){ o=o||{}; const bank=o.bank||20, V=o.kmh?o.kmh/3.6:(o.soft?vgentle(a):vclimb(a)), R=V*V/(G*Math.tan(bank*D2R)), sec=2*Math.PI*R/V;
  const oo=Object.assign({},o,{turn:true,bank}), up=(o.soft?gentle(a,altFt,oo):roc(a,altFt,oo))*sec/60, down=(o.soft?gentleDn(a):rod(a))*sec/60;
  return {R,sec,V,up,down,bank}; }
// distanza (m) per salire da h0 a h1 alla velocità al suolo gs (m/s): a passi di 100 ft, col rateo che cala con la quota
function climbDist(a,h0,h1,gs,o){ if(h1<=h0) return 0; let d=0; for(let h=h0;h<h1;h+=100){ const r=roc(a,h+50,o); if(r<=1) return Infinity; d+=Math.min(100,h1-h)/(r/60)*gs; } return d; }
function descDist(a,h0,h1,gs){ if(h1>=h0) return 0; return (h0-h1)/(rod(a)/60)*gs; }
// quota massima raggiungibile salendo per d metri a gs
function climbIn(a,h0,d,gs,o){ let h=h0, left=d; while(left>0){ const r=roc(a,h+50,o); if(r<=1) break; const need=100/(r/60)*gs; if(need>left){ h+=100*left/need; break; } h+=100; left-=need; } return h; }
window.IA517_PERF={weight,roc,rod,vclimb,orbit,climbDist,descDist,climbIn,da,gentle,gentleDn,vgentle,turnF,MAXTURNS:4};
})();
