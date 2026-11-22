#!/usr/bin/env node
// HORIZON · © 2026 Enrico D'Amico. Prove del giudizio di TailorFly (www/tailorfly.js): dalle misure alle righe e alle regolazioni.
'use strict';
const fs=require('fs'), vm=require('vm'), path=require('path');
let prove=0, rotte=0; const ok=(c,n)=>{ prove++; if(!c){ rotte++; console.log('ROTTA: '+n); } };
const mem={}; const PH={baro:{on:true},terrQ:'auto',compassMode:'ground',act(){},vario:{}};
const ctx={PH,window:{addEventListener(){},removeEventListener(){}},document:{createElement:()=>({set textContent(v){}}),head:{appendChild(){}},getElementById:()=>null},
  lsGet:(k,d)=>k in mem?JSON.parse(mem[k]):d,lsSet:(k,v)=>{ mem[k]=JSON.stringify(v); },toastShow(){},performance,setInterval,clearInterval,requestAnimationFrame(){},cancelAnimationFrame(){},innerWidth:412,innerHeight:915,console};
vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(__dirname,'../www/tailorfly.js'),'utf8'),ctx);
const T=PH.tailor;
const base=()=>({durata:20000,eventi:2000,giro:{n:2000,medie:[0.01,-0.02,0.01],scarti:[0.05,0.06,0.05]},acc:{n:2000,scarto:0.03},bussola:{n:90,scarto:1.2,acc:3},
  baro:{nativo:true,n:90,scarto:0.03},gps:{n:20,acc:4,sat:22},disegno:{mediana:16.7},schermo:{w:412,h:915,dpr:2.6},ora:{terrQ:'auto',baro:true,compass:'ground'}});
const riga=(g,n)=>g.righe.find(r=>r[1]===n)||[];
let g=T.giudica(base());
ok(g.voto==='buono'&&g.proposte.length===0&&g.righe.every(r=>r[0]==='ok'),'telefono buono: tutto a posto, nessuna regolazione');
ok(Math.abs(g.deriva-Math.hypot(0.01,0.02,0.01)*60)<1e-9,'deriva del giroscopio in gradi al minuto');
let m=base(); m.giro.scarti=[2,0.1,0.1]; g=T.giudica(m); ok(g.mosso&&g.proposte.length===0&&g.voto===null,'telefono mosso: prova da rifare, niente proposte');
m=base(); m.giro={n:0,medie:[NaN,NaN,NaN],scarti:[NaN,NaN,NaN]}; g=T.giudica(m); ok(riga(g,'Giroscopio')[0]==='bad'&&g.voto==='scarso'&&!g.mosso,'senza giroscopio: scarso, e lo dice');
m=base(); m.giro.medie=[0.3,0.2,0.1]; g=T.giudica(m); ok(riga(g,'Giroscopio')[0]==='warn','giroscopio con deriva di 22°/min: discreto');
m=base(); m.giro.medie=[0.6,0.5,0.1]; g=T.giudica(m); ok(riga(g,'Giroscopio')[0]==='bad','giroscopio con deriva di 47°/min: scarso');
m=base(); m.disegno.mediana=45; g=T.giudica(m); ok(g.proposte.length===1&&g.proposte[0].k==='terrQ'&&g.proposte[0].v==='0','disegno lento: propone il terreno più leggero');
m=base(); m.disegno.mediana=45; m.ora.terrQ='0'; g=T.giudica(m); ok(g.proposte.length===0,'disegno lento ma terreno già leggero: niente da proporre');
m=base(); m.ora.terrQ='0'; g=T.giudica(m); ok(g.proposte.some(p=>p.k==='terrQ'&&p.v==='auto'),'disegno fluido con terreno bloccato al minimo: propone automatico');
m=base(); m.ora.baro=false; g=T.giudica(m); ok(g.proposte.some(p=>p.k==='baro'&&p.v===true),'barometro presente ma spento: propone di accenderlo');
m=base(); m.baro={nativo:false,n:0,scarto:NaN}; m.ora.baro=false; g=T.giudica(m); ok(!g.proposte.some(p=>p.k==='baro')&&riga(g,'Barometro')[0]==='warn','versione web: niente barometro, niente proposta');
m=base(); m.bussola={n:90,scarto:15,acc:3}; g=T.giudica(m); ok(g.proposte.some(p=>p.k==='compass'&&p.v==='never')&&riga(g,'Bussola')[0]==='warn','bussola disturbata: propone la prua dalla traccia');
m=base(); m.bussola={n:0,scarto:NaN,acc:null}; m.ora.compass='never'; g=T.giudica(m); ok(!g.proposte.some(p=>p.k==='compass'),'bussola assente e già spenta: niente da proporre');
m=base(); m.gps={n:0,acc:NaN,sat:null}; g=T.giudica(m); ok(riga(g,'GPS')[0]==='warn','senza GPS: avviso, non errore');
m=base(); m.eventi=0; m.giro.n=0; m.acc.n=0; g=T.giudica(m); ok(riga(g,'Sensori di movimento')[0]==='bad','nessun dato dai sensori: errore');
ok(Math.abs(T.scartoAng([359,1,0,358,2])-1.58)<0.2,'scarto della bussola attraverso lo zero (359°–2°)');
// applica e torna indietro
m=base(); m.disegno.mediana=45; m.bussola.scarto=20; g=T.giudica(m); const fatte=T.applica(g);
ok(fatte.length===2&&PH.terrQ==='0'&&PH.compassMode==='never'&&mem.ia517p_terrq==='"0"'&&mem.ia517p_compass==='"never"','Applica: regolazioni messe e salvate');
ok(T.annulla()&&PH.terrQ==='auto'&&PH.compassMode==='ground'&&PH.baro.on===true,'Torna a com\'era: valori di prima'); ok(T.annulla()===false,'annullare due volte non fa niente');
console.log(rotte?`PROVE DI TAILORFLY: ${rotte} ROTTE su ${prove}`:`Prove di TailorFly: ${prove} su ${prove} passate`); process.exit(rotte?1:0);
