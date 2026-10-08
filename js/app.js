const $=s=>document.querySelector(s);
const KEY='sr1';
const store={get(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
const CFG0={def:{sets:3,reps:10,dur:30,rest:60},askAt:10,sound:true,tick:true,wake:true,lastExport:null};
// Versión del formato de datos: cada actualización convierte los datos viejos en vez de romperlos
const SCHEMA=2;
function migrate(d){d.v=d.v||1;
  if(d.v<2){(d.hist||[]).forEach(h=>{if(h.dur==null&&h.end&&h.d)h.dur=h.end-h.d});d.v=2}
  return d}
let db=migrate(Object.assign({tpl:[],hist:[],extra:[10,15,30],act:null},store.get(KEY,{})));
db.cfg=Object.assign(clone0(CFG0),db.cfg||{});db.cfg.def=Object.assign({},CFG0.def,db.cfg.def);
function clone0(o){return JSON.parse(JSON.stringify(o))}
const save=()=>store.set(KEY,db);
save();
// Pide al navegador que no borre los datos aunque la app se use poco
try{navigator.storage&&navigator.storage.persist&&navigator.storage.persisted().then(p=>p||navigator.storage.persist()).catch(()=>{})}catch(e){}
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const mmss=s=>{s=Math.max(0,Math.round(s));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
const ic=(n,c)=>`<svg class="i${c?' '+c:''}"><use href="#i-${n}"/></svg>`;
const clone=o=>JSON.parse(JSON.stringify(o));
const newEx=()=>Object.assign({n:'',t:'r'},db.cfg.def);
const FEEL={l:['Liviana','😌'],j:['Justa','💪'],d:['Dura','🥵']};
const dayKey=d=>{d=new Date(d);return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate()};
const goalTxt=e=>e.t==='t'?mmss(e.dur):e.reps+' reps';
let tt;function toast(m,ms){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('on'),ms||1900)}
// Aviso con botón (Deshacer / Actualizar). ms=0 → queda hasta que se toque
let st,snackFn=null;function snack(m,btn,fn,ms){const s=$('#snack');s.querySelector('span').textContent=m;s.querySelector('button').textContent=btn;snackFn=fn;
  $('#toast').classList.remove('on');s.classList.add('on');clearTimeout(st);if(ms!==0)st=setTimeout(()=>{s.classList.remove('on');snackFn=null},ms||5000)}
// Anuncio para VoiceOver (región "live")
const say=m=>{const r=$('#sr');if(r){r.textContent='';setTimeout(()=>{r.textContent=m},60)}};

/* ---------- Audio y pantalla encendida ---------- */
let ac=null;
function unlockAudio(){try{if(!ac){const C=window.AudioContext||window.webkitAudioContext;if(C)ac=new C()}if(ac&&ac.state==='suspended')ac.resume();if(ac){const b=ac.createBuffer(1,1,22050),s=ac.createBufferSource();s.buffer=b;s.connect(ac.destination);s.start(0)}}catch(e){}}
function beep(f,d,at,vol){try{if(!ac)return;const o=ac.createOscillator(),g=ac.createGain(),t=ac.currentTime+(at||0);d=d||.18;o.type='sine';o.frequency.value=f;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol||.22,t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+d);o.connect(g);g.connect(ac.destination);o.start(t);o.stop(t+d+.02)}catch(e){}}
const sTick=()=>{if(db.cfg.tick)beep(620,.09,0,.12)};
const sAsk=()=>{if(db.cfg.sound){beep(520,.14);beep(660,.18,.16)}};
const sEnd=()=>{if(db.cfg.sound){beep(660,.16);beep(880,.16,.18);beep(1175,.38,.36,.28)}};
let wl=null;function wake(on){try{if(on&&!db.cfg.wake)return;if(on&&navigator.wakeLock)navigator.wakeLock.request('screen').then(l=>{wl=l}).catch(()=>{});else if(!on&&wl){wl.release();wl=null}}catch(e){}}

/* ---------- Navegación ---------- */
let tab='home';
// dir: 'r' = la pantalla entra desde la derecha, 'l' = desde la izquierda (al deslizar)
function show(id,dir){['home','hist','cfg','edit'].forEach(s=>$('#'+s).hidden=s!==id);$('#tabbar').hidden=id==='edit';
  const el=$('#'+id);el.classList.remove('in-r','in-l');if(dir){void el.offsetWidth;el.classList.add('in-'+dir)}
  if(id!=='edit'){tab=id;document.querySelectorAll('.tabbar button').forEach(b=>b.setAttribute('aria-selected',b.dataset.v===id))}
  if(id==='home')rHome();if(id==='hist')rHist();if(id==='cfg')rCfg();if(id==='edit')rEdit();window.scrollTo(0,0)}

/* ---------- Entrenar ---------- */
function rHome(){
  const now=new Date(),t=db.tpl;
  const a=db.act,td=db.hist.filter(h=>dayKey(h.d)===dayKey(now));
  const ws=weekStart(0),wd=[...Array(7)].map((_,i)=>{const d=new Date(ws);d.setDate(ws.getDate()+i);return d});
  const has=new Set(db.hist.map(h=>dayKey(h.d))),wDays=wd.filter(d=>has.has(dayKey(d))).length;
  const wSets=db.hist.filter(h=>h.d>=ws.getTime()).reduce((s,h)=>s+h.ex.reduce((x,e)=>x+e.sets.length,0),0);
  $('#home').innerHTML=`
  <div class="large">${thBtn()}<div class="date">${now.toLocaleDateString('es-CL',{weekday:'long',day:'numeric',month:'long'})}</div><h1>Entrenar</h1></div>
  ${a?`<button class="resume" data-a="resume"><i class="dot"></i><div style="flex:1"><b>Sesión en curso</b><span>${esc(a.s.name)} · Ejercicio ${a.i+1} de ${a.s.ex.length}</span></div>${ic('chev')}</button>`:''}
  <div class="hero">
    <div class="hero-top"><div><small>Esta semana</small><b>${wDays?`${wDays} día${wDays===1?'':'s'} entrenado${wDays===1?'':'s'}`:'Aún sin entrenar'}</b></div><div class="hero-stat"><b>${wSets}</b><small>series</small></div></div>
    <div class="hero-days">${wd.map(d=>{const k=dayKey(d);return `<div class="${has.has(k)?'on':''}${k===dayKey(now)?' td':''}${d>now?' fut':''}"><i>${has.has(k)?ic('check'):''}</i><small>${'LMMJVSD'[(d.getDay()+6)%7]}</small></div>`}).join('')}</div>
  </div>
  <div class="tiles">
    <button class="tile pri" data-a="new"><span class="ti">${ic('plus')}</span><b>Nueva sesión</b><small>Arma tu rutina</small></button>
    <button class="tile" data-a="loose"><span class="ti">${ic('dumb')}</span><b>Ejercicio suelto</b><small>Sin planificar</small></button>
  </div>
  ${td.length?`<div class="hdr">Hoy</div><div class="group">${td.map(histRow).join('')}</div>`:''}
  <div class="hdr">Plantillas</div>
  ${t.length?`<div>${t.map((p,i)=>`<div class="tplc"><button class="tplm" data-a="tpl" data-i="${i}"><b>${esc(p.name)}</b><span>${p.ex.map(e=>esc(e.n)).join(' · ')}</span><small>${p.ex.length} ejercicio${p.ex.length>1?'s':''} · ${p.ex.reduce((s,e)=>s+e.sets,0)} series</small></button><button class="tplgo" data-a="tplGo" data-i="${i}" aria-label="Empezar ${esc(p.name)}">${ic('play')}</button></div>`).join('')}</div>
  <p class="foot">▶ para empezar al tiro, o toca la plantilla para ajustarla antes.</p>`
  :`<p class="foot">Aún no tienes plantillas. Arma una sesión y toca “Guardar como plantilla” para repetirla cuando quieras.</p>`}`;
}

/* ---------- Editor ---------- */
let ed=null;
function openEditor(src,tid){ed={tid:tid||null,name:src?src.name:'',ex:src?clone(src.ex):[newEx()]};show('edit')}
const LIM={sets:[1,30,1],reps:[1,500,1],dur:[5,3600,5],rest:[0,1200,15]};
function stp(e,i,f,label,d){const v=e[f],tm=f==='dur'||f==='rest';
  return `<div class="met m-${f}"><small>${label}</small><b>${tm?(f==='rest'&&v===0?'Sin':mmss(v)):v}</b><div><button data-a="dec" data-i="${i}" data-f="${f}"${d} aria-label="Menos ${label}">−</button><button data-a="inc" data-i="${i}" data-f="${f}"${d} aria-label="Más ${label}">+</button></div></div>`}
// Formulario de un ejercicio; s='q' cuando es el ejercicio suelto / agregado en la hoja
function exForm(e,i,s,canDel,extra){const d=s?` data-s="${s}"`:'';
  return `<div class="exh">${s?'':`<span class="exn">${i+1}</span>`}<input data-in="n" data-i="${i}"${d} placeholder="Ejercicio (ej. Curl de bíceps)" value="${esc(e.n)}" enterkeyhint="done">${canDel?`<button class="icon-btn" data-a="delEx" data-i="${i}" aria-label="Quitar ejercicio">${ic('trash')}</button>`:''}</div>${extra||''}
  <div class="seg"><button data-a="type" data-i="${i}"${d} data-v="r" aria-pressed="${e.t==='r'}">Repeticiones</button><button data-a="type" data-i="${i}"${d} data-v="t" aria-pressed="${e.t==='t'}">Tiempo</button></div>
  <div class="mets">${stp(e,i,'sets','Series',d)}${e.t==='r'?stp(e,i,'reps','Reps',d):stp(e,i,'dur','Duración',d)}${e.ss&&!s?`<div class="met off"><small>Descanso</small><b>0:00</b><span>Directo al siguiente</span></div>`:stp(e,i,'rest',!s&&i>0&&ed.ex[i-1].ss?'Desc. ronda':'Descanso',d)}</div>`}
// Ejercicio suelto (desde Entrenar) o agregado al final de una sesión en curso
let qx=null,qMode=null;
function openQuick(mode){qMode=mode;const l=mode==='add'&&A?A.s.ex[A.s.ex.length-1]:null;
  qx=Object.assign(newEx(),l?{t:l.t,sets:l.sets,reps:l.reps,dur:l.dur,rest:l.rest}:{});rQuick()}
// Atajos: tus ejercicios recientes + algunos comunes
function quickChips(){const out=usedEx().slice(0,6),k=new Set(out.map(x=>norm(x.n)));
  ['Sentadilla','Press banca','Curl de bíceps','Dominadas','Plancha','Peso muerto','Press militar','Zancadas'].forEach(n=>{if(out.length<9&&!k.has(norm(n))){const x=LIBX.find(l=>l.n===n);out.push(x);k.add(norm(n))}});
  return out}
function rQuick(){const add=qMode==='add',tm=qx.t==='t';
  openSheet(`<div class="qhead"><span class="qic${tm?' tt':''}">${ic(add?'plus':'dumb')}</span><div><h2>${add?'Agregar ejercicio':'Ejercicio suelto'}</h2><p>${add?'Se suma a la sesión en curso.':'Al terminar puedes sumar otro.'}</p></div><button class="qx" data-a="qCancel" aria-label="Cerrar">${ic('x')}</button></div>
  <div class="card ex qcard${tm?' tt':''}"><span class="qlab">¿Qué ejercicio?</span>${exForm(qx,0,'q',false,
    `<div class="chips">${quickChips().map(x=>`<button class="chip${x.t==='t'?' tm':''}${norm(x.n)===norm(qx.n)?' on':''}" data-a="chip" data-v="${esc(x.n)}" data-t="${x.t}">${esc(x.n)}</button>`).join('')}</div>`)}</div>
  <button class="btn${tm?' warm':''}" data-a="qGo" style="margin-top:14px">${ic(add?'plus':'play')}${add?'Agregar':'Empezar'} · ${qx.sets} × ${tm?mmss(qx.dur):qx.reps+' reps'}</button>`)}
function rEdit(){
  const one=ed.ex.length===1;ed.ex[ed.ex.length-1].ss=false;
  $('#edit').innerHTML=`
  <div class="edhead">
    <div class="edtop"><button class="edbtn" data-a="back">${ic('back')}Atrás</button><span>${ed.tid?'Editar plantilla':'Nueva sesión'}</span>${ed.tid?`<button class="edbtn ico" data-a="delTpl" aria-label="Eliminar plantilla">${ic('trash')}</button>`:'<i class="edsp"></i>'}</div>
    <label class="edname"><small>Nombre de la sesión</small><span class="edin"><input class="title-in" id="edName" placeholder="Ej. Día de brazos" value="${esc(ed.name)}" enterkeyhint="done">${ic('edit')}</span></label>
    <div class="edstats"><div><b>${ed.ex.length}</b><small>ejercicio${ed.ex.length>1?'s':''}</small></div><div><b>${ed.ex.reduce((s,e)=>s+e.sets,0)}</b><small>series</small></div><div><b>≈${estMin(ed.ex)}</b><small>minutos</small></div></div>
  </div>
  <div class="hdr">Ejercicios</div>
  ${ed.ex.map((e,i)=>{const ing=e.ss||(i>0&&ed.ex[i-1].ss);
    return `<div class="card ex${e.t==='t'?' tt':''}${ing?' ing':''}${e.ss?' lkb':''}">${exForm(e,i,'',!one)}</div>`
    +(i<ed.ex.length-1?`<div class="lnk${e.ss?' on':''}"><button data-a="link" data-i="${i}">${ic('link')}${e.ss?'Superserie · sin descanso entre ambos':'Unir en superserie'}</button></div>`:'')}).join('')}
  <button class="btn dash" data-a="addEx">${ic('plus')}Agregar ejercicio</button>
  <p class="foot">${ed.tid?'“Guardar” actualiza esta plantilla.':'“Guardar” la deja como plantilla para repetirla otro día.'}</p>
  <div class="edbar"><div class="edbar-in"><button class="btn sec" data-a="saveTpl">${ic('save')}Guardar</button><button class="btn" data-a="start">${ic('play')}Empezar</button></div></div>`;
}
document.addEventListener('input',e=>{const t=e.target;
  if(t.id==='feelTxt'){t.style.height='auto';t.style.height=Math.min(t.scrollHeight,220)+'px'}
  if(t.dataset.kw!==undefined&&A){const v=parseFloat(t.value.replace(',','.'));(A.kw=A.kw||{})[+t.dataset.kw]=isFinite(v)&&v>0?v:null;save();return}
  if(t.dataset.in==='n'&&t.dataset.s==='q'){if(qx)qx.n=t.value;return}
  if(!ed)return;
  if(t.id==='edName')ed.name=t.value;else if(t.dataset.in==='n')ed.ex[+t.dataset.i].n=t.value});
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.tagName==='INPUT')e.target.blur()});
// Duración aproximada: ~3 s por rep, más los descansos (sin descanso dentro de una superserie)
function estMin(ex){let s=0;ex.forEach((e,i)=>{s+=e.sets*(e.t==='t'?e.dur:e.reps*3);if(!e.ss)s+=e.rest*(i<ex.length-1?e.sets:e.sets-1)});return Math.max(1,Math.round(s/60))}
function cleanSession(){const name=(ed.name||'').trim()||'Sesión';
  const ex=ed.ex.map((e,i)=>Object.assign({},e,{n:(e.n||'').trim()||'Ejercicio '+(i+1)}));ex[ex.length-1].ss=false;
  return {name,ex}}

/* ---------- Reproductor ---------- */
const C2=339.29;
let A=null,raf=0,lastSec=null;
// A = db.act: {s:sesión, i:ejercicio, k:serie, ph:'ready'|'set'|'reps'|'work'|'rest'|'end', log:[[...]], t0, end, dur, asked, askOpen, val}
const ex=()=>A.s.ex[A.i];
function startSession(s){db.act={s,i:0,k:0,ph:'ready',log:s.ex.map(()=>[]),kg:s.ex.map(()=>[]),t0:Date.now()};save();openPlayer()}
// Lo último que hiciste en este ejercicio (de las sesiones guardadas)
function lastFor(n,before=Infinity){const k=norm(n);for(const h of db.hist){if(h.d>=before)continue;const e=h.ex.find(x=>norm(x.n)===k);if(e)return {d:h.d,e}}return null}
const kgTxt=v=>String(Math.round(v*10)/10).replace('.',',')+' kg';
function rLast(hl){const el=$('#pLast'),L=['rest','more'].includes(A.ph)?null:lastFor(ex().n);
  if(!L){el.innerHTML='';return}
  el.innerHTML=`<small>La última vez · ${new Date(L.d).toLocaleDateString('es-CL',{day:'numeric',month:'short'})}</small><div>${L.e.sets.map((v,j)=>`<span class="${hl&&j===A.k?'on':''}">${L.e.t==='t'?mmss(v):v}${L.e.kg&&L.e.kg[j]!=null?`<i>${kgTxt(L.e.kg[j])}</i>`:''}</span>`).join('')}</div>`}
// Peso "en curso" de cada ejercicio (A.kw[i]). Se ajusta en el descanso, en la serie o al anotar reps,
// y las tres pantallas comparten el mismo valor. Si no lo has tocado: el último de hoy, o el de la vez anterior.
function curKg(i,k){if(A.kw&&A.kw[i]!==undefined)return A.kw[i];
  const today=(A.kg[i]||[]).filter(x=>x!=null);if(today.length)return today[today.length-1];
  const L=lastFor(A.s.ex[i].n),p=L&&L.e.kg?L.e.kg.filter(x=>x!=null):[];return p.length?p[Math.min(k||0,p.length-1)]:null}
const kgVal=v=>v!=null?String(v).replace('.',','):'';
// Peso discreto: si no lo vas a cambiar basta un texto; se toca para editar (A.kgx abre el control completo)
function kgChip(i,k,lbl){const v=curKg(i,k);
  return `<div class="kgline"><button class="kgchip${v==null?' add':''}" data-a="kgOpen" aria-label="${v==null?'Agregar peso':'Cambiar peso: '+kgTxt(v)}">${ic('dumb')}${v==null?'Agregar peso':`${lbl} <b>${kgTxt(v)}</b>`}${ic('edit')}</button></div>`}
function kgRow(i,k,cap){return `${cap?`<div class="kgcap">${cap}</div>`:''}<div class="kgrow"><button data-a="kStep" data-i="${i}" data-d="-1" aria-label="Menos peso">−</button><label><input data-kw="${i}" inputmode="decimal" enterkeyhint="done" placeholder="Sin peso" value="${kgVal(curKg(i,k))}"><span>kg</span></label><button data-a="kStep" data-i="${i}" data-d="1" aria-label="Más peso">+</button></div>`}
// Progreso contra la última vez (y récord de peso) para la pantalla final
function bestKg(n,before=Infinity){const k=norm(n);let b=null;db.hist.forEach(h=>h.d<before&&h.ex.forEach(e=>{if(norm(e.n)===k&&e.kg)e.kg.forEach(x=>{if(x!=null&&(b==null||x>b))b=x})}));return b}
// Las reps/tiempo se comparan por la MEJOR serie, para que hacer menos series no parezca retroceso
function progress(ex2){return ex2.slice(0,5).map(e=>Object.assign({n:e.n},cmpEx(e,lastFor(e.n),bestKg(e.n))))}
// Compara un ejercicio con la vez anterior (L) y con el mejor peso previo (best)
function cmpEx(e,L,best){const tm=e.t==='t',tot=Math.max(...e.sets);
  const mx=e.kg?Math.max(...e.kg.filter(x=>x!=null)):null;
  const v=(tm?'Mejor serie '+mmss(tot):`Mejor serie ${tot} reps`)+(mx!=null&&isFinite(mx)?' · '+kgTxt(mx):'');
  if(!L)return {v,t:'Primera vez',c:'new'};
  if(mx!=null&&isFinite(mx)&&best!=null&&mx>best)return {v,t:'🏆 Récord',c:'up',L};
  const lkg=L.e.kg?Math.max(...L.e.kg.filter(x=>x!=null)):null;
  if(mx!=null&&lkg!=null&&isFinite(mx)&&isFinite(lkg)&&mx!==lkg)return {v,t:(mx>lkg?'▲ +':'▼ −')+kgTxt(Math.abs(mx-lkg)),c:mx>lkg?'up':'dn',L};
  const lt=Math.max(...L.e.sets),d=tot-lt;
  return {v,t:d===0?'= igual':(d>0?'▲ +':'▼ −')+(tm?mmss(Math.abs(d)):Math.abs(d)+(Math.abs(d)===1?' rep':' reps')),c:d>0?'up':d<0?'dn':'eq',L}}
// Arma lo que se guarda en el historial a partir de la sesión en curso
function buildEx(a){return a.s.ex.map((e,i)=>{const sets=a.log[i].filter(v=>v!=null),kg=((a.kg||[])[i]||[]).slice(0,sets.length);
  const r={n:e.n,t:e.t,goal:e.t==='t'?e.dur:e.reps,rest:e.rest,ss:!!e.ss,sets};if(kg.some(x=>x!=null))r.kg=Array.from(kg,x=>x==null?null:x);return r}).filter(e=>e.sets.length)}
// Los ejercicios sueltos del mismo día se juntan solos en una "Sesión libre"
function saveRec(a,ex2){const now=Date.now();
  if(a.s.loose){const r=db.hist.find(h=>(h.loose||h.name==='Sesión libre')&&dayKey(h.d)===dayKey(now));
    if(r){r.dur=(r.dur||(r.end-r.d))+(now-a.t0);r.ex=r.ex.concat(ex2);r.end=now;r.loose=true;save();return {rec:r,merged:true}}}
  const rec={id:uid(),d:a.t0,end:now,dur:now-a.t0,name:a.s.name,ex:ex2,feel:null};if(a.s.loose)rec.loose=true;
  db.hist.unshift(rec);save();return {rec,merged:false}}
function openPlayer(){A=db.act;A.kg=A.kg||A.s.ex.map(()=>[]);$('#player').hidden=false;$('#pRun').style.display='';$('#pctl').style.display='';$('#pEnd').hidden=true;document.body.classList.add('lock');wake(true);rP()}
function closePlayer(){cancelAnimationFrame(raf);A=null;$('#player').hidden=true;document.body.classList.remove('lock');wake(false)}
function setPh(ph,extra){Object.assign(A,{ph,askOpen:false,kgx:false},extra||{});save();rP();
  const r=$('#pRun');r.classList.remove('swap');void r.offsetWidth;r.classList.add('swap'); // transición suave entre pasos
  say(sayPh())}
// Lo que lee VoiceOver al cambiar de paso
function sayPh(){const e=ex(),ph=A.ph,w=curKg(A.i,A.k);
  if(ph==='ready')return `${e.n}. ${e.sets} series de ${goalTxt(e)}. Toca Estoy listo.`;
  if(ph==='set')return `${e.n}, serie ${A.k+1} de ${e.sets}: ${e.t==='t'?mmss(e.dur):e.reps+' reps'}${e.t!=='t'&&w!=null?' con '+kgTxt(w):''}.`;
  if(ph==='reps')return '¿Cuántas reps hiciste?';
  if(ph==='work')return `Serie en curso, ${mmss(e.dur)}.`;
  if(ph==='rest')return `Descanso de ${mmss(A.dur)}. ${nextTxt()}`;
  if(ph==='more')return 'Ejercicios completos. ¿Algo más?';return ''}
function ring(f,col){const a=$('#arc'),k=$('#knob');f=Math.max(0,Math.min(1,f));a.style.stroke=col;a.style.strokeDashoffset=(C2*(1-f)).toFixed(2);
  const r=2*Math.PI*f;k.setAttribute('cx',(60+54*Math.cos(r)).toFixed(2));k.setAttribute('cy',(60+54*Math.sin(r)).toFixed(2));$('#orb').style.setProperty('--c',col)}
const cb=(a,icon,label,cls)=>`<div class="cb ${cls||''}"><button data-a="${a}" aria-label="${label}">${icon}</button>${label}</div>`;
// Superserie: los ejercicios unidos (ss=true en todos menos el último) se hacen alternados,
// sin descanso entre ellos; el descanso del último es el de cada ronda. Un ejercicio solo es un grupo de 1.
function grp(i){const x=A.s.ex;let s=i,e=i;while(s>0&&x[s-1].ss)s--;while(e<x.length-1&&x[e].ss)e++;return [s,e]}
const rounds=(s,e)=>Math.max(...A.s.ex.slice(s,e+1).map(x=>x.sets));
function nextTxt(){const n=A.nx;if(!n)return '';const x=A.s.ex[n.i];return n.ph==='set'?`Sigue: ${x.n} · serie ${n.k+1} de ${x.sets}`:'Sigue: '+x.n}
function rP(){
  cancelAnimationFrame(raf);lastSec=null;
  const e=ex(),N=A.s.ex.length,ph=A.ph,[gs,ge]=grp(A.i),sup=ge>gs,R=rounds(gs,ge);
  $('#pTtl').textContent=ph==='ready'?(sup?`Ejercicios ${gs+1}–${ge+1} de ${N}`:`Ejercicio ${A.i+1} de ${N}`)
    :sup?`Superserie · Ronda ${Math.min(A.k+1,R)}/${R}`:`Ejercicio ${A.i+1}/${N} · Serie ${Math.min(A.k+1,e.sets)}/${e.sets}`;
  $('#pName').textContent=e.n;
  const done=A.log[A.i].length;
  $('#pBack').style.visibility=ph==='ready'&&A.i===0?'hidden':'visible';
  if(ph==='ready'&&sup){
    const g=A.s.ex.slice(gs,ge+1);
    $('#pName').textContent=g.map(x=>x.n).join(' + ');
    $('#pSub').textContent=`${g.map(x=>goalTxt(x)).join(' + ')}${A.s.ex[ge].rest?' · descanso '+mmss(A.s.ex[ge].rest):''}`;
    ring(1,'#2FD3C1');$('#ph').textContent='Superserie';$('#sec').textContent=R+'×';$('#info').textContent='rondas, sin pausa entre ejercicios';
    $('#pctl').innerHTML=`<button class="pbig" data-a="go">${ic('play')}Estoy listo</button>`;
  }else if(ph==='ready'){
    $('#pSub').textContent=`${e.sets} series × ${goalTxt(e)}${e.rest?' · descanso '+mmss(e.rest):''}`;
    ring(1,'#2FD3C1');$('#ph').textContent=A.i===0?'Primero':'Siguiente';$('#sec').textContent=e.sets+'×';$('#info').textContent=e.t==='t'?mmss(e.dur)+' por serie':e.reps+' reps por serie';
    $('#pctl').innerHTML=`<button class="pbig" data-a="go">${ic('play')}Estoy listo</button>`;
  }else if(ph==='set'){
    let nx=null;if(sup)for(let j=A.i+1;j<=ge;j++)if(A.s.ex[j].sets>A.k){nx=A.s.ex[j];break}
    $('#pSub').textContent=sup?(nx?`Luego: ${nx.n}, sin descanso`:'Último de la ronda'):done?`Hecho: ${A.log[A.i].map(v=>e.t==='t'?mmss(v):v).join(' · ')}`:'';
    ring(done/e.sets,e.t==='t'?'#FF9F45':'#2FD3C1');$('#ph').textContent='Serie '+(A.k+1);
    if(e.t==='t'){$('#sec').textContent=mmss(e.dur);$('#info').textContent='a tiempo';$('#pctl').innerHTML=`<button class="pbig o" data-a="work">${ic('play')}Iniciar serie</button>`}
    else{$('#sec').textContent=e.reps;$('#info').textContent='reps objetivo';$('#pctl').innerHTML=`${A.kgx?kgRow(A.i,A.k,'Peso para esta serie'):kgChip(A.i,A.k,'con')}<div class="pq"><button class="pbig" data-a="quickOk">${ic('check')}Hice ${e.reps} reps</button><button class="pbig sec" data-a="setDone">Hice otra cantidad</button></div>`}
  }else if(ph==='reps'){
    $('#pSub').textContent='¿Cuántas reps hiciste?';
    ring(done/e.sets,'#2FD3C1');$('#ph').textContent='Serie '+(A.k+1);$('#sec').textContent=A.val;$('#info').textContent='objetivo '+e.reps;
    $('#pctl').innerHTML=`${kgRow(A.i,A.k,'¿Con cuánto peso?')}
    <div class="prow">${cb('rDec',ic('minus'),'−1 rep')}${cb('rOk',ic('check'),'Confirmar','main')}${cb('rInc',ic('plus'),'+1 rep')}</div>`;
  }else if(ph==='work'){
    $('#pSub').textContent='';$('#ph').textContent='En curso';$('#info').textContent=`Serie ${A.k+1} de ${e.sets}`;
    $('#pctl').innerHTML=`<div class="prow">${cb('workEnd',ic('stop'),'Terminar','main o')}</div>`;loop();
  }else if(ph==='rest'){
    $('#pSub').textContent=nextTxt();$('#ph').textContent='Descanso';$('#info').textContent='';
    rCtlRest();loop();
  }else if(ph==='more'){
    const n=A.log.reduce((s,l)=>s+l.filter(v=>v!=null).length,0);
    $('#pTtl').textContent='Ejercicios completos';$('#pName').textContent='¿Algo más?';
    $('#pSub').textContent=`${N} ejercicio${N>1?'s':''} · ${n} series`;
    ring(1,'#2FD3C1');$('#ph').textContent='Listo';$('#sec').textContent=N;$('#info').textContent=N>1?'ejercicios':'ejercicio';
    $('#pctl').innerHTML=`<div class="stack" style="max-width:420px;margin:0 auto;width:100%"><button class="pbig" data-a="endS">${ic('check')}Terminar sesión</button><button class="pbig sec" data-a="qAdd">${ic('plus')}Agregar otro ejercicio</button></div>`;
  }
  rLast(ph==='set'||ph==='reps'||ph==='work');
}
function rCtlRest(){
  if(A.askOpen)$('#pctl').innerHTML=`<div class="ask"><p>¿Te basta el descanso?</p><div class="xs">${db.extra.map(v=>`<button data-a="add" data-v="${v}">+${v} s</button>`).join('')}</div><button class="ok" data-a="askOk">Está bien</button></div>`;
  else{const n=A.nx,nx=n&&A.s.ex[n.i]; // el descanso es el momento de cambiar discos: peso de la próxima serie
    const cap=n&&n.ph==='set'?'Serie '+(n.k+1)+' con':esc(nx?nx.n:'')+' con';
    $('#pctl').innerHTML=`${nx&&nx.t==='r'?(A.kgx?kgRow(n.i,n.k,`Peso para ${n.ph==='set'?'la serie '+(n.k+1):esc(nx.n)}`):kgChip(n.i,n.k,cap)):''}<div class="prow">${cb('minus10','−10','Restar 10 s')}${cb('restEnd',ic('skip'),'Empezar ya','main')}</div>`}
}
function loop(){
  if(!A)return;const now=Date.now(),left=(A.end-now)/1000,ph=A.ph;
  if(ph!=='rest'&&ph!=='work')return;
  if(left<=0){if(left<-3)toast(`${ph==='rest'?'El descanso':'La serie'} terminó hace ${mmss(-left)}`,4500); // volviste a la app después de que terminó
    return ph==='rest'?restEnd(true):workEnd(true)}
  const s=Math.ceil(left),at=db.cfg.askAt;
  if(s!==lastSec){
    if(lastSec!==null&&s<=3)sTick();
    lastSec=s;$('#sec').textContent=mmss(s);
    if(ph==='rest'&&at>0&&s<=at&&!A.asked&&A.dur>at+5&&!(A.mute||{})[A.i]){A.asked=true;A.askOpen=true;save();sAsk();rCtlRest();say(`Quedan ${s} segundos. ¿Te basta el descanso?`)}
  }
  ring(left/A.dur,ph==='work'?'#FF9F45':at>0&&s<=at?'#F5C33B':'#2FD3C1');
  raf=requestAnimationFrame(loop);
}
function logSet(v,kg){A.log[A.i][A.k]=v;(A.kg=A.kg||A.s.ex.map(()=>[]))[A.i][A.k]=kg==null?null:kg;(A.hs=A.hs||[]).push([A.i,A.k]);
  const x=A.s.ex,[s,e]=grp(A.i),k=A.k;
  for(let j=A.i+1;j<=e;j++)if(x[j].sets>k)return setPh('set',{i:j}); // superserie: directo al siguiente
  const j2=x.slice(s,e+1).findIndex(y=>y.sets>k+1);
  if(j2<0&&e>=x.length-1)return setPh('more');
  A.nx=j2>=0?{ph:'set',i:s+j2,k:k+1}:{ph:'ready',i:e+1,k:0};
  const r=x[e].rest;
  if(r>0)setPh('rest',{end:Date.now()+r*1000,dur:r,asked:false});else advance()}
function advance(){const n=A.nx;A.nx=null;if(n)return setPh(n.ph,{i:n.i,k:n.k});
  const e=ex();if(A.k<e.sets-1)setPh('set',{k:A.k+1});else setPh('ready',{i:A.i+1,k:0})}
// Retrocede un paso; si ya habías confirmado una serie, la reabre para corregirla
function stepBack(){
  const ph=A.ph;
  if(ph==='reps'||ph==='work')return setPh('set');
  const hs=A.hs||[],[s,e]=grp(A.i);
  if(ph==='set'&&!hs.some(([i])=>i>=s&&i<=e))return setPh('ready',{i:s,k:0});
  if((ph==='ready'&&A.i===0)||!hs.length)return;
  const [i,k]=hs.pop(),x=A.s.ex[i],v=A.log[i][k],kv=A.kg&&A.kg[i]?A.kg[i][k]:null;A.log[i].length=k;if(A.kg&&A.kg[i])A.kg[i].length=k;A.nx=null;
  if(x.t!=='t')(A.kw=A.kw||{})[i]=kv==null?null:kv; // al reabrir la serie vuelve su peso
  if(x.t==='t')setPh('set',{i,k});else setPh('reps',{i,k,val:v!=null?v:x.reps});
}
function restEnd(auto){if(auto)sEnd();advance()}
function workEnd(auto){const e=ex(),el=Math.round(e.dur-Math.max(0,(A.end-Date.now())/1000));if(auto)sEnd();logSet(auto?e.dur:el)}
function finish(){
  if(!A)return;cancelAnimationFrame(raf);
  const a=A,ex2=buildEx(a);
  db.act=null;
  if(!ex2.length){save();closePlayer();toast('No había series registradas');show(tab);return}
  const prog=progress(ex2); // se calcula antes de guardar, para comparar con lo anterior
  const {rec,merged}=saveRec(a,ex2);
  const n=ex2.reduce((s,e)=>s+e.sets.length,0),min=Math.max(1,Math.round((Date.now()-a.t0)/60000));
  A=null;$('#pRun').style.display='none';$('#pctl').style.display='none';$('#pTtl').textContent='';$('#pBack').style.visibility='hidden';
  const pe=$('#pEnd');pe.hidden=false;pe.dataset.id=rec.id;
  pe.innerHTML=`<div class="big">${ic('check')}</div><h2>${merged?'¡Listo!':'¡Sesión completa!'}</h2><p>${ex2.length} ejercicio${ex2.length>1?'s':''} · ${n} series · ${min} min${merged?'<br>Se sumó a tu sesión libre de hoy':''}</p>
  ${prog.length?`<div class="prog">${prog.map(p=>`<div><b>${esc(p.n)}</b><span>${p.v}</span><em class="${p.c}">${p.t}</em></div>`).join('')}</div>`:''}
  <p style="color:var(--player-ink);font-weight:600;margin-bottom:12px">¿Quieres anotar tus sensaciones?</p>
  <div class="stack"><button class="btn" data-a="feelNow">Ahora</button><button class="btn sec" data-a="feelLater">Después</button></div>`;
}
function feelForm(r){const f=r.feel||{};
  return `<div class="feel-chips">${Object.keys(FEEL).map(k=>`<button data-a="fchip" data-v="${k}" aria-pressed="${f.r===k}"><span>${FEEL[k][1]}</span>${FEEL[k][0]}</button>`).join('')}</div>
  <textarea class="feel" id="feelTxt" placeholder="¿Cómo te sentiste? Energía, técnica, molestias…">${esc(f.x||'')}</textarea>`}
function saveFeel(id){const r=db.hist.find(h=>h.id===id);if(!r)return;const on=document.querySelector('.feel-chips button[aria-pressed="true"]');
  const x=($('#feelTxt').value||'').trim(),rr=on?on.dataset.v:null;r.feel=(x||rr)?{r:rr,x}:null;save()}

/* ---------- Historial ---------- */
let wk=0,sel=null;
function weekStart(off){const d=new Date();d.setHours(0,0,0,0);const dow=(d.getDay()+6)%7;d.setDate(d.getDate()-dow+off*7);return d}
function rHist(){
  const ws=weekStart(wk),today=dayKey(Date.now()),has=new Set(db.hist.map(h=>dayKey(h.d)));
  const days=[...Array(7)].map((_,i)=>{const d=new Date(ws);d.setDate(ws.getDate()+i);return d});
  const we=days[6];
  const label=ws.getMonth()===we.getMonth()?ws.toLocaleDateString('es-CL',{month:'long',year:'numeric'}):ws.toLocaleDateString('es-CL',{month:'short'})+' – '+we.toLocaleDateString('es-CL',{month:'short',year:'numeric'});
  let list=db.hist;if(sel)list=list.filter(h=>dayKey(h.d)===sel);
  const groups=[];list.forEach(h=>{const k=dayKey(h.d);let g=groups[groups.length-1];if(!g||g.k!==k){g={k,d:h.d,items:[]};groups.push(g)}g.items.push(h)});
  $('#hist').innerHTML=`
  <div class="large">${thBtn()}<div class="date">${db.hist.length} sesion${db.hist.length===1?'':'es'} registrada${db.hist.length===1?'':'s'}</div><h1>Historial</h1></div>
  <div class="card wkcard" style="padding:10px 10px 6px">
    <div class="week"><button data-a="wk" data-v="-1" aria-label="Semana anterior">${ic('back')}</button><b>${label}</b><button data-a="wk" data-v="1" ${wk>=0?'disabled':''} aria-label="Semana siguiente">${ic('chev')}</button></div>
    <div class="days">${days.map(d=>{const k=dayKey(d),fut=d>new Date();return `<button class="day${has.has(k)?' on':''}${k===today?' today':''}${k===sel?' sel':''}${fut?' fut':''}" data-a="day" data-v="${k}" ${fut?'disabled':''}><small>${'LMMJVSD'[(d.getDay()+6)%7]}</small><span>${d.getDate()}</span><i></i></button>`}).join('')}</div>
  </div>
  ${sel?`<p class="foot">Mostrando solo ese día · <button class="add-feel" data-a="day" data-v="${sel}">Ver todo</button></p>`:''}
  ${groups.length?groups.map(g=>`<div class="hdr">${new Date(g.d).toLocaleDateString('es-CL',{weekday:'long',day:'numeric',month:'long'})}</div><div class="group">${g.items.map(histRow).join('')}</div>`).join('')
  :`<div class="empty">${sel?'No entrenaste ese día.':'Aún no hay sesiones. Cuando termines una, aparece aquí.'}</div>`}`;
}
// Minutos entrenados (en la sesión libre no cuenta el rato entre ejercicios)
const durMin=h=>Math.max(1,Math.round((h.dur||(h.end-h.d))/60000));
function histRow(h){const n=h.ex.reduce((s,e)=>s+e.sets.length,0),min=durMin(h);
  const what=h.ex.length<=2?h.ex.map(e=>esc(e.n)).join(' + '):h.ex.length+' ejercicios';
  const r=h.feel&&h.feel.r;
  return `<button class="rowi hrow" data-a="det" data-v="${h.id}"><span class="fe ${r||''}">${r?FEEL[r][1]:ic('dumb')}</span><div class="t"><b>${esc(h.name)}</b><span>${what} · ${n} series · ${min} min</span>${h.feel?'':'<em>Agregar sensaciones</em>'}</div>${ic('chev','chev')}</button>`}
const rCur=()=>tab==='home'?rHome():tab==='cfg'?rCfg():rHist();
const tplFrom=h=>({id:uid(),name:h.name,ex:h.ex.map(e=>({n:e.n,t:e.t,ss:!!e.ss,sets:e.sets.length,reps:e.t==='r'?e.goal:10,dur:e.t==='t'?e.goal:30,rest:e.rest==null?60:e.rest}))});
let sheetAt=0;
function openSheet(html){const was=$('#sheetBg').hidden;if(was)sheetAt=Date.now();$('#sheet').innerHTML='<div class="grab"></div>'+html;$('#sheetBg').hidden=false;if(was)$('#sheet').scrollTop=0;document.body.classList.add('lock')}
function closeSheet(){$('#sheetBg').hidden=true;$('#sheet').innerHTML='';if($('#player').hidden)document.body.classList.remove('lock')}
// Detalle de una sesión: resumen, cada ejercicio con su progreso, sensaciones y acciones
const nf=v=>Math.round(v).toLocaleString('es-CL');
const shortD=d=>new Date(d).toLocaleDateString('es-CL',{day:'numeric',month:'short'}).replace('.','');
function exInfo(e,before){const tm=e.t==='t',reps=tm?0:e.sets.reduce((s,v)=>s+v,0),secs=tm?e.sets.reduce((s,v)=>s+v,0):0;
  const vol=(e.kg||[]).reduce((s,k,j)=>s+(k!=null?k*e.sets[j]:0),0),ok=e.sets.filter(v=>v>=e.goal).length;
  let bj=0;e.sets.forEach((v,j)=>{const kb=e.kg?e.kg[bj]||0:0,kj=e.kg?e.kg[j]||0:0;if(kj>kb||(kj===kb&&v>e.sets[bj]))bj=j});
  const best=tm?mmss(e.sets[bj]):e.sets[bj]+(e.kg&&e.kg[bj]!=null?' × '+kgTxt(e.kg[bj]):' reps');
  return {tm,reps,secs,vol,ok,best,cmp:cmpEx(e,lastFor(e.n,before),bestKg(e.n,before))}}
function detail(id){const h=db.hist.find(x=>x.id===id);if(!h)return;
  const info=h.ex.map(e=>exInfo(e,h.d)),series=h.ex.reduce((s,e)=>s+e.sets.length,0),reps=info.reduce((s,x)=>s+x.reps,0),vol=info.reduce((s,x)=>s+x.vol,0);
  let fd=new Date(h.d).toLocaleDateString('es-CL',{weekday:'long',day:'numeric',month:'short'}).replace(',','').replace('.','');fd=fd[0].toUpperCase()+fd.slice(1);
  const hr=new Date(h.d).toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit',hour12:false});
  const stat=(n,l)=>`<div><b>${n}</b><small>${l}</small></div>`;
  const exHtml=(e,i)=>{const x=info[i],c=x.cmp;
    return `<div class="dex"><div class="dexh"><b>${esc(e.n)}</b><em class="cmp ${c.c}">${c.t}${c.L&&c.c!=='new'?` <small>vs ${shortD(c.L.d)}</small>`:''}</em></div>
    <div class="sets">${e.sets.map((v,j)=>`<span class="${v<e.goal?'lo':v>e.goal?'hi':''}">${x.tm?mmss(v):v}${e.kg&&e.kg[j]!=null?`<i>${kgTxt(e.kg[j])}</i>`:''}</span>`).join('')}</div>
    <div class="dexf">Objetivo ${x.tm?mmss(e.goal):e.goal+' reps'} · <b>${x.ok} de ${e.sets.length}</b> completas · Mejor ${x.best}${x.tm?' · '+mmss(x.secs)+' en total':x.vol?' · '+nf(x.vol)+' kg':''}</div></div>`};
  // Agrupa las superseries en un bloque con la barra turquesa
  let body='',i=0;while(i<h.ex.length){if(h.ex[i].ss){let j=i;let g='';while(j<h.ex.length){g+=exHtml(h.ex[j],j);if(!h.ex[j].ss){j++;break}j++}body+=`<div class="ssg"><span class="ssl">${ic('link')}Superserie</span>${g}</div>`;i=j}else{body+=exHtml(h.ex[i],i);i++}}
  const colors=h.ex.some(e=>e.sets.some(v=>v!==e.goal));
  openSheet(`<label class="dnamef">${ic('edit')}<input class="dname" id="dName" value="${esc(h.name)}" aria-label="Nombre de la sesión" enterkeyhint="done"></label>
  <p class="dmeta">${fd} · ${hr} · ${durMin(h)} min</p>
  <div class="dsum">${stat(h.ex.length,'ejercicio'+(h.ex.length>1?'s':''))}${stat(series,'series')}${reps?stat(nf(reps),'reps'):''}${vol?stat(nf(vol),'kg levantados'):stat(durMin(h),'min')}</div>
  <div class="card dcard">${body}</div>
  ${colors?'<p class="dlegend"><i class="lo"></i>bajo el objetivo<i class="hi"></i>sobre el objetivo</p>':''}
  <div class="hdr" style="margin-left:4px">Sensaciones</div>${feelForm(h)}
  <button class="btn" data-a="feelSave" data-v="${h.id}" style="margin-top:14px">Guardar cambios</button>
  <div class="acts"><button data-a="repeat" data-v="${h.id}">${ic('play')}Repetir</button><button data-a="toTpl" data-v="${h.id}">${ic('save')}Plantilla</button><button class="del" data-a="delSess" data-v="${h.id}">${ic('trash')}Eliminar</button></div>`)}
function confirmSheet(title,msg,btns){openSheet(`<h2>${title}</h2><p>${msg}</p><div class="stack">${btns.map((b,i)=>`<button class="btn ${b.c||''}" data-a="cf" data-i="${i}">${b.t}</button>`).join('')}</div>`);confirmSheet.fns=btns.map(b=>b.fn)}

/* ---------- Toques ---------- */
/* ---------- Mantener presionado + / − para que el valor corra ---------- */
const REP=['inc','dec','dInc','dDec','xinc','xdec','askInc','askDec','kStep','rInc','rDec'];
let hold=null;
document.addEventListener('pointerdown',e=>{const b=e.target.closest('[data-a]');if(!b||!REP.includes(b.dataset.a))return;
  // Se vuelve a buscar el botón en cada paso porque la pantalla se redibuja
  const sel=['a','i','f','s','d','v'].filter(k=>b.dataset[k]!==undefined).map(k=>`[data-${k}="${b.dataset[k]}"]`).join('');
  clearTimeout(hold&&hold.t);hold={sel,n:0};
  hold.t=setTimeout(function run(){if(!hold)return;const el=document.querySelector(hold.sel);if(!el)return;hold.n++;el.click();hold.t=setTimeout(run,hold.n>8?55:110)},420)});
const endHold=()=>{if(hold){clearTimeout(hold.t);if(!hold.n)hold=null;else hold.end=Date.now()}};
['pointerup','pointercancel'].forEach(t=>document.addEventListener(t,endHold));

document.addEventListener('click',ev=>{
  // El clic que llega al soltar después de mantener presionado no debe sumar uno más
  if(hold&&hold.end){const late=Date.now()-hold.end<400;hold=null;if(late&&ev.isTrusted){ev.preventDefault();return}}
  if(ev.target.id==='sheetBg'){if(Date.now()-sheetAt>450)closeSheet();return} // ignora el "toque fantasma" justo al abrir
  const b=ev.target.closest('[data-a]');if(!b)return;
  const a=b.dataset.a,i=+b.dataset.i,v=b.dataset.v;
  if(!$('#player').hidden)unlockAudio();
  switch(a){
    case 'tab':show(v);break;
    case 'thOpen':themeSheet();break;
    case 'theme':db.theme=v;save();applyTheme();closeSheet();rCur();toast('Apariencia: '+THEMES[v][0]);break;
    case 'new':openEditor(null);break;
    case 'tpl':openEditor(db.tpl[i],db.tpl[i].id);break;
    case 'resume':openPlayer();break;
    case 'sugPick':pickSug(v,b.dataset.t);break;
    case 'tplGo':{const p=db.tpl[i];begin({name:p.name,ex:clone(p.ex)});break}
    case 'back':ed=null;show(tab);break;
    case 'type':{const q=b.dataset.s==='q';(q?qx:ed.ex[i]).t=v;q?rQuick():rEdit();break}
    case 'inc':case 'dec':{const q=b.dataset.s==='q',f=b.dataset.f,[lo,hi,st]=LIM[f],e=q?qx:ed.ex[i];e[f]=Math.max(lo,Math.min(hi,e[f]+(a==='inc'?st:-st)));q?rQuick():rEdit();break}
    case 'loose':openQuick('new');break;
    case 'qAdd':openQuick('add');break;
    case 'qCancel':closeSheet();break;
    case 'chip':qx.n=v;qx.t=b.dataset.t;rQuick();break;
    case 'qGo':{const add=qMode==='add'&&A,e=Object.assign({},qx,{n:(qx.n||'').trim()||'Ejercicio '+(add?A.s.ex.length+1:1)});closeSheet();
      if(add){A.s.ex.push(e);A.log.push([]);A.kg.push([]);setPh('ready',{i:A.s.ex.length-1,k:0})}else begin({name:'Sesión libre',ex:[e],loose:true});break}
    case 'endS':finish();break;
    case 'xinc':case 'xdec':db.extra[i]=Math.max(5,Math.min(120,db.extra[i]+(a==='xinc'?5:-5)));save();rCfg();break;
    case 'dInc':case 'dDec':{const f=b.dataset.f,[lo,hi,st]=LIM[f],d=db.cfg.def;d[f]=Math.max(lo,Math.min(hi,d[f]+(a==='dInc'?st:-st)));save();rCfg();break}
    case 'askInc':case 'askDec':db.cfg.askAt=Math.max(0,Math.min(30,db.cfg.askAt+(a==='askInc'?5:-5)));save();rCfg();break;
    case 'tog':db.cfg[v]=!db.cfg[v];save();rCfg();break;
    case 'thSet':db.theme=v;save();applyTheme();rCfg();break;
    case 'exp':exportData();break;
    case 'inst':installSheet();break;
    case 'instOk':db.cfg.installSeen=true;save();closeSheet();break;
    case 'copyLink':try{navigator.clipboard.writeText(location.href).then(()=>toast('Link copiado'),()=>toast(location.href,4000))}catch(e){toast(location.href,4000)}break;
    case 'imp':$('#impFile').value='';$('#impFile').click();break;
    case 'wipe':confirmSheet('¿Borrar todos tus datos?','Se eliminan tu historial, tus plantillas y tus ajustes. No se puede deshacer. Si quieres, exporta un respaldo antes.',[
      {t:'Borrar todo',c:'danger',fn:()=>{db={tpl:[],hist:[],extra:[10,15,30],act:null,cfg:clone0(CFG0),theme:'auto'};save();applyTheme();rCfg();toast('Datos borrados')}},{t:'Cancelar',c:'sec'}]);break;
    case 'addEx':{ed.ex.push(newEx());/* parte con los valores de Ajustes → Ejercicio nuevo */rEdit();setTimeout(()=>{const ins=document.querySelectorAll('[data-in="n"]');ins[ins.length-1].scrollIntoView({behavior:'smooth',block:'center'})},50);break}
    case 'link':ed.ex[i].ss=!ed.ex[i].ss;rEdit();break;
    case 'delEx':ed.ex.splice(i,1);rEdit();break;
    case 'saveTpl':{const s=cleanSession();if(ed.tid){const p=db.tpl.find(x=>x.id===ed.tid);if(p)Object.assign(p,s)}else{ed.tid=uid();db.tpl.push(Object.assign({id:ed.tid},s))}ed.name=s.name;save();rEdit();toast('Plantilla guardada');break}
    // Eliminar sin preguntar, con "Deshacer" unos segundos
    case 'delTpl':{const idx=db.tpl.findIndex(x=>x.id===ed.tid);if(idx<0){ed=null;show('home');break}const p=db.tpl.splice(idx,1)[0];save();ed=null;show('home');
      snack('Plantilla eliminada','Deshacer',()=>{db.tpl.splice(idx,0,p);save();rCur()});break}
    case 'start':begin(cleanSession());break;
    // reproductor
    case 'go':setPh('set');break;
    case 'setDone':setPh('reps',{val:ex().reps});break;
    case 'kStep':{const k=A.nx&&A.nx.i===i?A.nx.k:A.k;let w=Math.round(((curKg(i,k)||0)+(+b.dataset.d))*10)/10;if(w<=0)w=null;
      (A.kw=A.kw||{})[i]=w;save();const inp=document.querySelector(`[data-kw="${i}"]`);if(inp)inp.value=kgVal(w);break}
    case 'rInc':A.val++;$('#sec').textContent=A.val;save();break;
    case 'rDec':A.val=Math.max(0,A.val-1);$('#sec').textContent=A.val;save();break;
    case 'rOk':{const w=curKg(A.i,A.k);(A.kw=A.kw||{})[A.i]=w;logSet(A.val,w);break}
    // Un toque: hiciste exactamente lo planeado
    case 'quickOk':{const w=curKg(A.i,A.k);(A.kw=A.kw||{})[A.i]=w;logSet(ex().reps,w);break}
    case 'kgOpen':A.kgx=true;if(A.ph==='rest')rCtlRest();else{rP()}setTimeout(()=>{const inp=document.querySelector('[data-kw]');if(inp&&curKg(+inp.dataset.kw)==null)inp.focus()},50);break;
    case 'work':setPh('work',{end:Date.now()+ex().dur*1000,dur:ex().dur});break;
    case 'workEnd':workEnd(false);break;
    case 'minus10':{A.end-=10000;save();if(A.end<=Date.now()){restEnd(false)}else{lastSec=null}break}
    case 'restEnd':restEnd(false);break;
    case 'add':{const x=+v;A.end+=x*1000;A.dur+=x;A.askOpen=false;if((A.end-Date.now())/1000>10)A.asked=false;(A.okc=A.okc||{})[A.i]=0;save();rCtlRest();break}
    // Si dos veces seguidas dices "Está bien" en un ejercicio, no se vuelve a preguntar en ese ejercicio
    case 'askOk':{A.askOpen=false;const o=A.okc=A.okc||{};o[A.i]=(o[A.i]||0)+1;if(o[A.i]>=2){(A.mute=A.mute||{})[A.i]=true;toast('No te vuelvo a preguntar en este ejercicio')}save();rCtlRest();break}
    case 'quit':if(!A){closePlayer();show('hist');break}confirmSheet('¿Salir de la sesión?','Puedes terminarla ahora y guardar lo que llevas, o seguir entrenando.',[
      {t:'Seguir entrenando'},
      {t:'Terminar y guardar',c:'sec',fn:()=>finish()},
      {t:'Descartar sesión',c:'danger',fn:()=>{db.act=null;save();closePlayer();show(tab);toast('Sesión descartada')}}]);break;
    case 'feelNow':{const id=$('#pEnd').dataset.id,r=db.hist.find(h=>h.id===id);$('#pEnd').innerHTML=`<h2 style="margin-bottom:16px">¿Cómo te sentiste?</h2>${feelForm(r)}<div class="stack" style="margin-top:16px"><button class="btn" data-a="feelEnd" data-v="${id}">Guardar</button></div>`;break}
    case 'feelEnd':saveFeel(v);closePlayer();show('hist');toast('Sensaciones guardadas');break;
    case 'feelLater':closePlayer();show('hist');toast('Puedes anotarlas desde el historial');break;
    // historial
    case 'wk':wk=Math.min(0,wk+ +v);rHist();break;
    case 'day':sel=sel===v?null:v;rHist();break;
    case 'det':detail(v);break;
    case 'fchip':{const was=b.getAttribute('aria-pressed')==='true';b.parentNode.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed','false'));b.setAttribute('aria-pressed',String(!was));break}
    case 'feelSave':{saveFeel(v);const r=db.hist.find(h=>h.id===v),nm=($('#dName').value||'').trim();if(r&&nm)r.name=nm;save();closeSheet();rCur();toast('Cambios guardados');break}
    case 'repeat':{const h=db.hist.find(x=>x.id===v);closeSheet();openEditor(tplFrom(h));break}
    case 'toTpl':{const h=db.hist.find(x=>x.id===v);db.tpl.push(tplFrom(h));save();closeSheet();rCur();toast('Guardada en plantillas');break}
    case 'delSess':{const idx=db.hist.findIndex(x=>x.id===v);if(idx<0)break;const h=db.hist.splice(idx,1)[0];save();closeSheet();rCur();
      snack('Sesión eliminada','Deshacer',()=>{db.hist.splice(idx,0,h);save();rCur()});break}
    case 'snack':{const fn=snackFn;snackFn=null;$('#snack').classList.remove('on');if(fn)fn();break}
    case 'stepBack':stepBack();break;
    case 'cf':{const fn=confirmSheet.fns[i];closeSheet();if(fn)fn();break}
  }
});
function begin(s){const go=()=>{ed=null;show('home');startSession(s)};
  if(db.act)confirmSheet('Ya hay una sesión en curso','Si empiezas otra, la anterior se guarda con las series que alcanzaste a hacer.',[{t:'Guardar la anterior y empezar',fn:()=>{A=db.act;finishSilent();go()}},{t:'Cancelar',c:'sec'}]);else go()}
// Guarda sin mostrar pantalla final (cuando se empieza otra sesión encima)
function finishSilent(){const a=db.act,ex2=buildEx(a);db.act=null;if(ex2.length)saveRec(a,ex2);save();A=null}

/* ---------- Sugerencias de nombres de ejercicio ---------- */
// '*' al final = se hace por tiempo
const LIB={
  'Pecho':'Press banca|Press banca inclinado|Press con mancuernas|Aperturas con mancuernas|Cruce de poleas|Pec deck|Fondos en paralelas|Flexiones de brazos',
  'Espalda':'Dominadas|Jalón al pecho|Remo con barra|Remo con mancuerna|Remo en polea baja|Peso muerto|Pullover|Hiperextensiones',
  'Piernas':'Sentadilla|Sentadilla búlgara|Sentadilla goblet|Prensa de piernas|Zancadas|Peso muerto rumano|Extensión de cuádriceps|Curl femoral|Hip thrust|Puente de glúteos|Elevación de talones|Step up|Abducción de cadera|Sentadilla isométrica en pared*',
  'Hombros':'Press militar|Press Arnold|Elevaciones laterales|Elevaciones frontales|Pájaros|Face pull|Encogimientos de hombros',
  'Brazos':'Curl de bíceps|Curl martillo|Curl concentrado|Curl con barra Z|Extensión de tríceps en polea|Press francés|Fondos en banco|Patada de tríceps',
  'Core':'Plancha*|Plancha lateral*|Abdominales crunch|Elevación de piernas|Russian twist|Rueda abdominal|Bicho muerto|Hollow hold*|Mountain climbers*',
  'Cardio':'Burpees|Kettlebell swing|Saltar la cuerda*|Jumping jacks*|Bicicleta*|Trote*|Remo en máquina*'};
const LIBX=Object.keys(LIB).flatMap(g=>LIB[g].split('|').map(s=>({n:s.replace('*',''),g,t:s.endsWith('*')?'t':'r'})));
const norm=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();
function usedEx(){const m=new Map();
  db.hist.forEach(h=>h.ex.forEach(e=>{if(!m.has(norm(e.n)))m.set(norm(e.n),{n:e.n,t:e.t,mine:1})}));
  db.tpl.forEach(p=>p.ex.forEach(e=>{if(!m.has(norm(e.n)))m.set(norm(e.n),{n:e.n,t:e.t,mine:1})}));
  return [...m.values()].filter(x=>!/^ejercicio \d+$/.test(norm(x.n)))}
let sugIn=null;
function showSug(inp){hideSug();sugIn=inp;const q=norm(inp.value),mine=usedEx(),mk=new Set(mine.map(x=>norm(x.n)));
  let list=mine.concat(LIBX.filter(x=>!mk.has(norm(x.n))));
  if(q)list=list.filter(x=>norm(x.n).includes(q)).sort((a,b)=>(norm(b.n).startsWith(q)-norm(a.n).startsWith(q))||(b.mine||0)-(a.mine||0));
  list=list.slice(0,q?7:8);
  if(!list.length||(list.length===1&&norm(list[0].n)===q))return;
  const hl=n=>{if(!q)return esc(n);const i=norm(n).indexOf(q);return esc(n.slice(0,i))+'<mark>'+esc(n.slice(i,i+q.length))+'</mark>'+esc(n.slice(i+q.length))};
  const d=document.createElement('div');d.className='sug';d.id='sug';
  d.innerHTML=list.map(x=>`<button data-a="sugPick" data-v="${esc(x.n)}" data-t="${x.t}"><span>${hl(x.n)}</span>${x.t==='t'?'<small class="tm">Tiempo</small>':''}<small${x.mine?' class="mine"':''}>${x.mine?'Tuyo':x.g}</small></button>`).join('')
    +'<p>O escribe el nombre que quieras</p>';
  inp.parentNode.appendChild(d)}
function hideSug(){const s=$('#sug');if(s)s.remove()}
function pickSug(name,t){const inp=sugIn;hideSug();if(!inp)return;const q=inp.dataset.s==='q',e=q?qx:ed.ex[+inp.dataset.i];
  inp.value=name;e.n=name;
  if(t&&e.t!==t){e.t=t;q?rQuick():rEdit()}else inp.blur()}
document.addEventListener('focusin',e=>{if(e.target.dataset&&e.target.dataset.in==='n')showSug(e.target)});
document.addEventListener('input',e=>{if(e.target.dataset.in==='n')showSug(e.target)});
document.addEventListener('focusout',e=>{if(e.target.dataset&&e.target.dataset.in==='n')setTimeout(()=>{if(document.activeElement!==sugIn)hideSug()},180)});
document.addEventListener('mousedown',e=>{if(e.target.closest('#sug'))e.preventDefault()});

/* ---------- Deslizar hacia los lados ---------- */
let tx=null;
document.addEventListener('touchstart',e=>{if(e.touches.length!==1){tx=null;return}const t=e.touches[0];tx={x:t.clientX,y:t.clientY,t:Date.now(),el:e.target}},{passive:true});
document.addEventListener('touchend',e=>{if(!tx)return;const s=tx,t=e.changedTouches[0],dx=t.clientX-s.x,dy=t.clientY-s.y;tx=null;
  if(Math.abs(dx)<60||Math.abs(dy)>Math.abs(dx)*.6||Date.now()-s.t>700)return;
  if(!$('#sheetBg').hidden||!$('#player').hidden||s.el.closest('input,textarea'))return;
  if(s.el.closest('.wkcard')){if(dx<0&&wk<0){wk++;rHist()}else if(dx>0){wk--;rHist()}return}
  if(!$('#edit').hidden){if(dx>0){ed=null;show(tab,'l')}return}
  const T=['home','hist','cfg'],p=T.indexOf(tab);
  if(dx<0&&p<T.length-1)show(T[p+1],'r');else if(dx>0&&p>0)show(T[p-1],'l');
},{passive:true});

document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&A){wake(true);if(A.ph==='rest'||A.ph==='work'){lastSec=null;loop()}}});

/* ---------- Apariencia: automático / claro / oscuro ---------- */
const THEMES={auto:['Automático','auto','Sigue el modo de tu iPhone'],light:['Claro','sun','Siempre de día'],dark:['Oscuro','moon','Siempre de noche']};
const thBtn=()=>`<button class="thm" data-a="thOpen" aria-label="Apariencia: ${THEMES[db.theme||'auto'][0]}">${ic(THEMES[db.theme||'auto'][1])}</button>`;
function applyTheme(){const t=db.theme||'auto',r=document.documentElement;
  if(t==='auto')r.removeAttribute('data-theme');else r.setAttribute('data-theme',t);
  document.querySelectorAll('meta[name="theme-color"]').forEach(m=>{const dk=m.media.includes('dark');m.content=t==='auto'?(dk?'#000000':'#F2F3F5'):t==='dark'?'#000000':'#F2F3F5'})}
function themeSheet(){const cur=db.theme||'auto';
  openSheet(`<h2>Apariencia</h2><p>Elige cómo se ve la app.</p><div class="group">${Object.keys(THEMES).map(k=>`<button class="chk" data-a="theme" data-v="${k}" aria-pressed="${k===cur}"><i>${ic('check')}</i><span class="thi">${ic(THEMES[k][1])}</span><div class="t"><b>${THEMES[k][0]}</b><span>${THEMES[k][2]}</span></div></button>`).join('')}</div>`)}

/* ---------- Instalación en la pantalla de inicio ---------- */
const ENV=(()=>{const ua=navigator.userAgent,ios=/iPhone|iPad|iPod/.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  return {ios,iphone:/iPhone|iPod/.test(ua),safari:ios&&!/CriOS|FxiOS|EdgiOS|GSA|OPiOS/.test(ua),android:/Android/.test(ua),
    mobile:ios||/Android|Mobi/.test(ua),standalone:navigator.standalone===true||matchMedia('(display-mode: standalone)').matches}})();
function installSheet(){
  const step=(n,html)=>`<li><span class="n">${n}</span><div>${html}</div></li>`,chip=(i,t)=>`<span class="ichip">${ic(i)}${t}</span>`;
  let body;
  if(ENV.standalone)body=`<p>¡Listo! Ya estás usando la app instalada. Ábrela siempre desde el ícono de tu pantalla de inicio.</p>`;
  else if(ENV.ios&&!ENV.safari)body=`<p>En iPhone, para instalarla tienes que abrirla en <b>Safari</b>.</p><ol class="isteps">
    ${step(1,'Copia el link de la app.')}${step(2,'Abre <b>Safari</b> y pégalo en la barra de direcciones.')}${step(3,'Ahí te aparecerán los pasos para instalarla.')}</ol>
    <button class="btn" data-a="copyLink">Copiar link</button>`;
  else if(ENV.ios)body=`<p>Instálala para usarla a pantalla completa, sin la barra de Safari y con acceso desde un ícono.</p><ol class="isteps">
    ${step(1,`Toca ${chip('share','Compartir')} en la barra de Safari${ENV.iphone?', abajo al centro':', arriba a la derecha'}.`)}
    ${step(2,`Baja en la lista y toca ${chip('addsq','Agregar a pantalla de inicio')}.`)}
    ${step(3,'Deja activado <b>Abrir como app web</b> (así se abre a pantalla completa) y toca <b>Agregar</b>.')}
    ${step(4,'Abre <b>Series</b> desde el ícono nuevo en tu pantalla de inicio.')}</ol>
    <div class="inote"><b>Importante:</b> lo que registres aquí en Safari no pasa a la app instalada (el iPhone las guarda por separado). Instálala antes de empezar a entrenar.</div>`;
  else if(ENV.android)body=`<p>Instálala para usarla a pantalla completa y con acceso desde un ícono.</p><ol class="isteps">
    ${step(1,'Toca el menú <b>⋮</b> de Chrome, arriba a la derecha.')}${step(2,'Elige <b>Instalar app</b> o <b>Agregar a pantalla principal</b>.')}${step(3,'Confirma y abre <b>Series</b> desde el ícono.')}</ol>`;
  else body=`<p>Esta app está pensada para el celular. Abre este link en tu iPhone, con <b>Safari</b>, y te aparecerán los pasos para instalarla.</p>
    <button class="btn" data-a="copyLink">Copiar link</button>`;
  openSheet(`<div class="qhead"><span class="qic">${ic('phone')}</span><div><h2>Instala Series</h2><p>Toma menos de un minuto</p></div><button class="qx" data-a="instOk" aria-label="Cerrar">${ic('x')}</button></div>
    ${body}<button class="btn ${ENV.ios&&ENV.safari&&!ENV.standalone?'sec':''}" data-a="instOk" style="margin-top:12px">${ENV.standalone?'Listo':'Entendido'}</button>
    ${ENV.ios&&ENV.safari&&ENV.iphone&&!ENV.standalone?`<div class="iarrow">Compartir está aquí abajo<span>${ic('back')}</span></div>`:''}`)}

/* ---------- Ajustes ---------- */
const sw=(k,t,sub)=>`<button class="rowi swr" data-a="tog" data-v="${k}" role="switch" aria-checked="${!!db.cfg[k]}"><div class="t"><b>${t}</b><span>${sub}</span></div><i class="sw"></i></button>`;
function rCfg(){const c=db.cfg,d=c.def,th=db.theme||'auto',n=db.hist.length,p=db.tpl.length;
  const dm=(f,l)=>{const v=d[f],tm=f==='dur'||f==='rest';return `<div class="met m-${f}"><small>${l}</small><b>${tm?(v===0?'Sin':mmss(v)):v}</b><div><button data-a="dDec" data-f="${f}" aria-label="Menos ${l}">−</button><button data-a="dInc" data-f="${f}" aria-label="Más ${l}">+</button></div></div>`};
  $('#cfg').innerHTML=`
  <div class="large"><div class="date">Personaliza tu entrenamiento</div><h1>Ajustes</h1></div>

  <div class="hdr">Ejercicio nuevo</div>
  <div class="card"><div class="mets m2">${dm('sets','Series')}${dm('reps','Reps')}${dm('dur','Duración')}${dm('rest','Descanso')}</div></div>
  <p class="foot">Con estos valores parte cada ejercicio que agregas. La duración se usa en los ejercicios por tiempo.</p>

  <div class="hdr">Descanso</div>
  <div class="card extras">${db.extra.map((v,k)=>`<div class="xb"><b>+${v} s</b><div><button data-a="xdec" data-i="${k}" aria-label="Menos">−</button><button data-a="xinc" data-i="${k}" aria-label="Más">+</button></div></div>`).join('')}</div>
  <div class="card" style="margin-top:10px;padding:4px 16px"><div class="stp"><span>Aviso “¿Te basta?”</span><div><button data-a="askDec" aria-label="Menos">−</button><b>${c.askAt?c.askAt+' s':'Nunca'}</b><button data-a="askInc" aria-label="Más">+</button></div></div></div>
  <p class="foot">${c.askAt?`A los ${c.askAt} segundos del final del descanso aparecen los botones de tiempo extra.`:'Nunca se te preguntará si quieres alargar el descanso.'}</p>

  <div class="hdr">Sonido y pantalla</div>
  <div class="group">${sw('sound','Sonido al terminar el descanso','Tres tonos cuando se acaba el tiempo')}${sw('tick','Cuenta regresiva','Un tic en los últimos 3 segundos')}${sw('wake','Mantener la pantalla encendida','Mientras entrenas, para no perder el reloj')}</div>
  <p class="foot">Si el iPhone está en silencio, los sonidos no se escuchan.</p>

  <div class="hdr">Apariencia</div>
  <div class="seg seg3">${Object.keys(THEMES).map(k=>`<button data-a="thSet" data-v="${k}" aria-pressed="${k===th}">${ic(THEMES[k][1])}${THEMES[k][0]}</button>`).join('')}</div>

  <div class="hdr">App</div>
  <div class="group"><button class="rowi" data-a="inst"><span class="rico">${ic('phone')}</span><div class="t"><b>Cómo instalarla</b><span>${ENV.standalone?'Ya está instalada en este teléfono ✓':'Agrégala a tu pantalla de inicio'}</span></div>${ic('chev','chev')}</button></div>


  <div class="hdr">Tus datos</div>
  <div class="group">
    <button class="rowi" data-a="exp"><span class="rico">${ic('down')}</span><div class="t"><b>Exportar respaldo</b><span>${c.lastExport?'Último: '+new Date(c.lastExport).toLocaleDateString('es-CL',{day:'numeric',month:'short',year:'numeric'}):'Aún no has hecho uno'}</span></div>${ic('chev','chev')}</button>
    <button class="rowi" data-a="imp"><span class="rico">${ic('up')}</span><div class="t"><b>Importar respaldo</b><span>Recupera tus datos desde un archivo</span></div>${ic('chev','chev')}</button>
    <button class="rowi" data-a="wipe"><span class="rico red">${ic('trash')}</span><div class="t"><b style="color:var(--red)">Borrar todo</b><span>Historial, plantillas y ajustes</span></div></button>
  </div>
  <p class="foot">Tienes ${n} sesion${n===1?'':'es'} y ${p} plantilla${p===1?'':'s'}. Tus datos viven solo en este teléfono: exporta un respaldo de vez en cuando y guárdalo en Archivos o iCloud.</p>
  <p class="foot" style="text-align:center;margin-top:28px;opacity:.7">Series · versión 1</p>`;
}
function exportData(){
  const now=new Date(),data={app:'series',v:1,fecha:now.toISOString(),datos:{tpl:db.tpl,hist:db.hist,extra:db.extra,cfg:db.cfg,theme:db.theme||'auto'}};
  const name=`series-respaldo-${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}.json`;
  const blob=new Blob([JSON.stringify(data)],{type:'application/json'});
  const done=()=>{db.cfg.lastExport=Date.now();save();rCfg()};
  try{const file=new File([blob],name,{type:'application/json'});
    if(navigator.canShare&&navigator.canShare({files:[file]})){navigator.share({files:[file],title:'Respaldo de Series'}).then(()=>{done();toast('Respaldo guardado')}).catch(()=>{});return}}catch(e){}
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000);done();toast('Respaldo descargado')}
$('#impFile').addEventListener('change',e=>{const f=e.target.files&&e.target.files[0];if(!f)return;const r=new FileReader();
  r.onload=()=>{let d;try{d=JSON.parse(r.result)}catch(x){return toast('Ese archivo no es un respaldo válido')}
    const x=d&&d.app==='series'&&d.datos;if(!x||!Array.isArray(x.hist)||!Array.isArray(x.tpl))return toast('Ese archivo no es un respaldo de Series');
    confirmSheet('¿Reemplazar tus datos?',`El respaldo del ${new Date(d.fecha).toLocaleDateString('es-CL',{day:'numeric',month:'long',year:'numeric'})} tiene ${x.hist.length} sesion${x.hist.length===1?'':'es'} y ${x.tpl.length} plantilla${x.tpl.length===1?'':'s'}. Reemplazará lo que tienes ahora en este teléfono.`,[
      {t:'Reemplazar',fn:()=>{db.tpl=x.tpl;db.hist=x.hist;if(Array.isArray(x.extra))db.extra=x.extra;db.cfg=Object.assign(clone0(CFG0),x.cfg||{});db.cfg.def=Object.assign({},CFG0.def,db.cfg.def);db.theme=x.theme||'auto';db.act=null;save();applyTheme();rCfg();toast('Respaldo importado')}},
      {t:'Cancelar',c:'sec'}])};
  r.readAsText(f)});

applyTheme();
show('home');
if(db.act)openPlayer();
// Primera vez en el celular sin instalar: mostrar cómo instalarla
else if(!ENV.standalone&&ENV.mobile&&!db.cfg.installSeen)setTimeout(()=>{if($('#sheetBg').hidden&&$('#player').hidden)installSheet()},600);
// Modo sin internet + aviso cuando se publica una versión nueva
if('serviceWorker' in navigator&&location.protocol==='https:'){
  const had=!!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').catch(()=>{});
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(had)snack('Hay una versión nueva de Series','Actualizar',()=>location.reload(),0)})}

// Barra superior: aparece al deslizar con el título de la pantalla visible (como Piso Pélvico)
function topbarSync(){const tb=$('#topbar');if(!tb)return;const scr=[...document.querySelectorAll('.app .screen')].find(x=>!x.hidden),h=scr&&scr.querySelector('.large h1');
  $('#topTitle').textContent=h?h.textContent:'';tb.classList.toggle('on',window.scrollY>24)}
addEventListener('scroll',topbarSync,{passive:true});new MutationObserver(()=>requestAnimationFrame(topbarSync)).observe($('.app'),{attributes:true,subtree:true,attributeFilter:['hidden']});topbarSync();

// Acceso para test.html (la prueba automática); no cambia nada en la app
window.T={get A(){return A},get db(){return db},get ed(){return ed},get qx(){return qx},save:()=>save()};


