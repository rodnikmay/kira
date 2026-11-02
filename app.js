/* ============================================================
   app.js — движок игр, озвучка, пятёрки, дневник
   ============================================================ */
'use strict';

/* ------------------------------ утилиты ------------------------------ */
const $  = s => document.querySelector(s);
const $$ = s => Array.prototype.slice.call(document.querySelectorAll(s));
function rnd(n){ return Math.floor(Math.random()*n); }
function pick(a){ return a[rnd(a.length)]; }
function shuffle(a){ const r=a.slice(); for(let i=r.length-1;i>0;i--){ const j=rnd(i+1); const t=r[i]; r[i]=r[j]; r[j]=t; } return r; }
function pickN(a,n){ return shuffle(a).slice(0,n); }
function fmt(t){ return String(t).replace(/\{name\}/g, state.name); }
function cap(s){ return s.charAt(0).toUpperCase()+s.slice(1); }
function todayKey(){ const d=new Date(); return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); }
function dateLabel(iso){ const d=new Date(iso); return ('0'+d.getDate()).slice(-2)+'.'+('0'+(d.getMonth()+1)).slice(-2); }

/* ------------------------------ состояние ------------------------------ */
const KEY='kira_prep_school_v1';
const DEF={ name:'Кира', sound:true, diff:'средний', limit:true, restNag:true, speakForeign:false, sparkles:true, voiceName:'',
            voiceRate:0.93,
            stars:0, hearts:0, grades:[], stickers:[], medals:[], chestN:0, chestOpens:0,
            skills:{}, best:{}, day:null, dayRounds:0,
            xp:0, streak:0, streakGap:0, lastDay:null, daily:{date:'',game:'',done:false},
            ui:{ theme:'auto', fs:1 } };
let state = loadState();
function loadState(){
  try{
    const s=JSON.parse(localStorage.getItem(KEY)||'null');
    const st=Object.assign({},DEF,s||{});
    st.ui=Object.assign({theme:'auto', fs:1}, (s && s.ui) || {});
    migrate(st);
    return st;
  } catch(e){ return Object.assign({},DEF); }
}
/* старые сохранения: наклейки были просто значками без «блеска», медалей и сердечек не было */
function migrate(st){
  st.stickers=(st.stickers||[]).map(s=> (typeof s==='string') ? {e:s,tier:'common'} : s);
  st.medals=st.medals||[]; st.hearts=st.hearts||0; st.chestN=st.chestN||0; st.chestOpens=st.chestOpens||0;
  st.streakGap=st.streakGap||0; st.best=st.best||{}; st.skills=st.skills||{}; st.grades=st.grades||[];
}
function save(){ try{ localStorage.setItem(KEY, JSON.stringify(state)); }catch(e){} }

/* ------------------------------ тема и размер текста ------------------------------ */
/* «auto» повторяет тему устройства, light/dark — выбраны вручную.
   Размер текста задаётся переменной --fs: весь текст в странице считается от неё. */
function prefersDark(){ try{ return window.matchMedia('(prefers-color-scheme: dark)').matches; }catch(e){ return false; } }
function isDark(){ const t=(state.ui && state.ui.theme) || 'auto'; return t==='dark' || (t==='auto' && prefersDark()); }
function fsVal(){ return Number(state.ui && state.ui.fs) || 1; }
function fsWord(f){
  const x=Number(f)||1;
  if(x<=0.88) return 'мельче';
  if(x<1.05)  return 'обычный';
  if(x<1.2)   return 'крупный';
  return 'очень крупный';
}
function applyUI(){
  document.documentElement.dataset.theme = isDark() ? 'dark' : 'light';
  document.documentElement.style.setProperty('--fs', String(fsVal()));
  const bt=$('#btn-theme');
  if(bt) bt.textContent = isDark() ? '🌙 Тёмная' : '☀️ Светлая';
  const sl=$('#font-slider'); if(sl) sl.value=String(fsVal());
  const fv=$('#font-val'); if(fv) fv.textContent=fsWord(fsVal());
  const sl2=$('#set-font'); if(sl2) sl2.value=String(fsVal());
  const fv2=$('#font-val2'); if(fv2) fv2.textContent=fsWord(fsVal());
  const th=$('#set-theme'); if(th) th.value=(state.ui && state.ui.theme) || 'auto';
}
function setTheme(t){ state.ui.theme=t; save(); applyUI(); }
function setFs(v){
  const x=Number(v); if(!x) return;
  state.ui.fs=Math.min(1.35, Math.max(0.85, x)); save(); applyUI();
}
(function wireUIControls(){
  const bt=$('#btn-theme');
  if(bt) bt.addEventListener('click',()=>{ setTheme(isDark() ? 'light' : 'dark'); });
  const sl=$('#font-slider');
  if(sl){ sl.addEventListener('input',e=>setFs(e.target.value)); }
  const th=$('#set-theme');
  if(th){ th.addEventListener('change',e=>{ setTheme(e.target.value||'auto'); }); }
  const sl2=$('#set-font');
  if(sl2){ sl2.addEventListener('input',e=>setFs(e.target.value)); }
  /* тема устройства поменялась сама — следим за «auto» */
  try{
    const mq=window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener && mq.addEventListener('change',()=>{ if(state.ui.theme==='auto') applyUI(); });
  }catch(e){}
})();

/* календарь слов -> картинка */
const EMOJI_BY_WORD={};
READ_WORDS.forEach(x=>EMOJI_BY_WORD[x.w]=x.e);
SYL_WORDS.forEach(x=>EMOJI_BY_WORD[x.w]=x.e);
SYL_COUNT.forEach(x=>EMOJI_BY_WORD[x.w]=x.e);
EMOJI_BY_WORD['ПАРТА']='🪑';

/* уровень сложности: что доступно */
function LV(){
  const d = LETTER_LEVELS[state.diff] ? state.diff : 'средний';
  return {
    letters: LETTER_LEVELS[d],
    opts: d==='лёгкий'?3:4,
    max:  d==='лёгкий'?5:(d==='средний'?7:10),
    words: d==='лёгкий'?BUILD_EASY:BUILD_HARD,
    trace: d==='лёгкий'?['А','О','У']:(d==='средний'?['А','О','М','С']:['С','Т','К','Н','Р','Л'])
  };
}
/* склонение имени для фразы «Пятёрка КИРЕ» */
function dative(name){
  const n=String(name||'Кира').trim();
  if(/ь$/i.test(n)) return n;
  const last=n.slice(-1).toLowerCase();
  if(last==='а'||last==='я') return n.slice(0,-1)+'е';
  return n;
}

/* ------------------------------ озвучка ------------------------------ */
let voices=[], keepAlive=0, voicePolls=0, refreshingVoices=false;
function refreshVoices(){
  if(refreshingVoices) return voices;   /* защита от круга: fillVoiceList → ruVoices → refreshVoices → … */
  refreshingVoices=true;
  try{ if('speechSynthesis' in window) voices=window.speechSynthesis.getVoices()||[]; }catch(e){}
  try{ if(document.getElementById('set-voice')) fillVoiceList(); }catch(e){}
  refreshingVoices=false;
  return voices;
}
/* Android и iPad отдают список голосов не сразу — слушаем событие и подсраховываемся опросом */
function watchVoices(){
  if(!('speechSynthesis' in window)) return;
  refreshVoices();
  try{ window.speechSynthesis.addEventListener('voiceschanged', refreshVoices); }catch(e){}
  try{ window.speechSynthesis.onvoiceschanged = refreshVoices; }catch(e){}
  const poll=()=>{ voicePolls++; refreshVoices(); if(voices.length<3 && voicePolls<14) setTimeout(poll, 400); };
  setTimeout(poll, 250);
}
const GOOD_RU=/(milena|katya|alena|alenka|irina|tatyana|tatiana|elena|arina|daria|nika|pavla|kolya|maxim|yuri|ruslan|svetlana|natalia|olga|google|yandex|salikhov|antonok|speech5|natural|online|neural|русск|голос)/i;
function vScore(v){
  const lang=(v.lang||'').toLowerCase(), name=v.name||'';
  let s=0;
  if(lang.indexOf('ru')===0) s+=100;
  if(/online|natural|neural/i.test(name)) s+=45;
  if(/online/i.test(name)) s+=6;
  if(/google/i.test(name)) s+=32;
  if(GOOD_RU.test(name)) s+=26;
  if(/female|женск/i.test(name)) s+=8;
  if(/espeak|sapi|novell|compact/i.test(name)) s-=18;
  return s;
}
function allVoices(){ if(!voices.length) refreshVoices(); return voices.slice(); }
function ruVoices(){ return allVoices().filter(v=>/^ru/i.test(v.lang||'')); }
function pickVoice(){
  if(state.voiceName){
    const hit=allVoices().filter(v=>v.name===state.voiceName)[0];
    if(hit) return hit;
  }
  const ru=ruVoices();
  if(ru.length) return ru.slice().sort((a,b)=>vScore(b)-vScore(a))[0];
  if(state.speakForeign){ const all=allVoices(); return all.length? all.slice().sort((a,b)=>vScore(b)-vScore(a))[0] : null; }
  return null;
}
function caption(text){
  const c=$('#caption'); if(!c) return;
  c.textContent='🗣 '+text;
  c.classList.add('show');
  clearTimeout(caption._t);
  caption._t=setTimeout(()=>c.classList.remove('show'), 7000);
}
/* длинные фразы Chrome и Android обрывают — режем по предложениям */
function chunkText(t){
  const s=String(t).replace(/\s+/g,' ').trim();
  if(s.length<=160) return [s];
  const parts=s.match(/[^.!?…]+[.!?…]*/g)||[s]; const out=[]; let cur='';
  parts.forEach(p=>{ if((cur+p).trim().length>160){ if(cur.trim()) out.push(cur.trim()); cur=p; } else cur+=p; });
  if(cur.trim()) out.push(cur.trim());
  return out;
}
/* Интонация по типу фразы: вопрос идёт вверх, похвала — выше и чуть медленнее,
     середина длинного текста — ровно, конец — чуть вниз. Голос звучивает живее. */
function prosody(part, idx, n, slow){
  const base = Number(state.voiceRate)||0.93;
  let rate = slow ? Math.max(0.55, base-0.18) : base;
  let pitch = 1.06;
  const t = String(part).trim();
  if(/\?\s*$/.test(t))       { pitch = 1.26; rate += 0.03; }
  else if(/[!…]\s*$/.test(t)){ pitch = 1.28; rate -= 0.05; }
  else if(n>1 && idx===n-1)  { pitch = 1.00; rate -= 0.02; }
  if(n>1 && idx===0 && pitch<1.2) pitch += 0.06;
  if(/(?:пят[ёе]рка|молодец|умница|отлично|такой успех|так держать)/i.test(t)) pitch += 0.06;
  return { rate: Math.min(1.3, Math.max(0.5, rate)), pitch: Math.min(1.6, Math.max(0.7, pitch)) };
}
function speak(text, slow){
  if(!state.sound || !text) return;
  caption(text);
  if(!('speechSynthesis' in window)) return;
  const v=pickVoice();
  if(!v && !state.speakForeign) return;   /* русского голоса нет — молчим, показываем субтитр */
  const ss=window.speechSynthesis;
  try{
    ss.cancel();
    clearInterval(keepAlive);
    const parts=chunkText(text);
    parts.forEach((part,i)=>{
      const pr=prosody(part, i, parts.length, slow);
      const u=new SpeechSynthesisUtterance(i>0 ? ' '+part : part);
      u.lang='ru-RU';
      if(v) u.voice=v;
      u.rate = pr.rate; u.pitch = pr.pitch; u.volume=1;
      ss.speak(u);
    });
    try{ ss.resume(); }catch(e){}
    /* Chrome/Android иногда «засыпают» посреди фразы — периодически будим движок */
    keepAlive=setInterval(()=>{ try{ ss.resume(); }catch(e){} }, 5000);
    setTimeout(()=>clearInterval(keepAlive), 25000);
  }catch(e){}
}
function speechPlatform(){
  const ua=navigator.userAgent||'';
  if(/iPad|iPhone|iPod/.test(ua) || (navigator.platform==='MacIntel' && (navigator.maxTouchPoints||0)>1)) return 'ipad';
  if(/Android/.test(ua)) return 'android';
  if(/Windows/.test(ua)) return 'windows';
  if(/Mac/.test(ua)) return 'mac';
  return 'other';
}
const HOWTO={
  ipad:'Планшет iPad: 1) Настройки → Универсальный доступ → Устное содержание → Голоса → «Русский» → скачать Милена (или Катя) — без скачивания голос может не появиться. 2) Проверьте, что не включён «Бесшумный режим»: переключатель сбоку планшета или значок колокольчика в Пункте управления — на планшете он глушит и озвучку тоже. 3) Прибавьте громкость кнопками сбоку. 4) Вернитесь на сайт и нажмите «Найти голоса заново».',
  android:'Планшет Android: Настройки → Система → Язык и ввод → Текст в речь (TTS) → движок «Google Text-to-Speech» → Языки → скачать «Русский». Затем полностью закройте Chrome и откройте снова (или нажмите «Найти голоса заново»). Самый красивый голос — «Google русский».',
  windows:'Windows/Edge: Параметры → Время и язык → Язык и регион → Русский → «…» → Скачать «Голосовой синтез». В Edge лучше всего звучат онлайн-голоса: выберите в списке выше «Microsoft Katya Online (Natural)» или «Microsoft Irina Online (Natural)».',
  mac:'macOS: Системные настройки → Универсальный доступ → Устное содержание → Настройки → Русский → скачать Milena или Katya, затем обновить страницу.',
  other:'Если русского голоса нет: скачайте голосовой синтез в настройках языка системы, затем нажмите «Найти голоса заново».'
};
function voiceInfoText(){
  const p=speechPlatform();
  if(!('speechSynthesis' in window)) return '🔉 В этом браузере нет голосового движка — задания будут только текстом и субтитрами. Откройте сайт в Chrome, Edge или Safari.';
  const ru=ruVoices(), v=pickVoice();
  if(!voices.length) return '🔉 Голоса ещё не загрузились. Нажмите «Найти голоса заново».'+ (HOWTO[p]?' '+HOWTO[p]:'');
  if(!ru.length) return '🔉 Русский голос в системе не найден (всего голосов: '+voices.length+', все — других языков), поэтому задание показывается субтитром. '+HOWTO[p]+' Можно включить озвучку чужим голосом ниже — будет громко, но непонятно.';
  return '🔉 Озвучка: '+ (v?('«'+v.name+'» ('+v.lang+')'):'нет') +
    '. Русских голосов в системе: '+ru.length+
    '. Нажмите «Послушать этот голос», чтобы проверить, нравится ли он Кире.';
}
function fillVoiceList(){
  const sel=$('#set-voice'); if(!sel) return;
  const cur=state.voiceName||'';
  const ru=ruVoices().sort((a,b)=>vScore(b)-vScore(a));
  const others=allVoices().filter(v=>!/^ru/i.test(v.lang||'')).sort((a,b)=>vScore(b)-vScore(a));
  sel.innerHTML='<option value="">Авто — самый красивый русский</option>';
  const opt=v=>{
    const o=document.createElement('option');
    o.value=v.name;
    o.textContent='⭐ '+v.name+' · '+v.lang;
    sel.appendChild(o);
  };
  ru.forEach(opt);
  if(others.length){
    const g=document.createElement('optgroup'); g.label='другие языки (звучат непонятно)';
    others.slice(0,12).forEach(v=>{
      const o=document.createElement('option'); o.value=v.name; o.textContent=v.name+' · '+v.lang; g.appendChild(o);
    });
    sel.appendChild(g);
  }
  sel.value=cur;
  if(sel.value!==cur) sel.value='';
}

/* ---------------- живой голос: записанные фразы вместо синтеза ----------------
   Синтез на планшете хороший, но самый тёплый голос для пятилетки — мамин.
   Фразы можно записать один раз прямо на планшете (нужен микрофон и адрес https://),
   дальше сайт будет хвалить Киру этим голосом, а не роботом. */
const CLIPS={
  pyaterka:{ text:'Кире, пятёрка!',        use:'самая важная похвала в конце игры' },
  good:    { text:'Умница! Отлично получилось!', use:'за правильный ответ' },
  near:    { text:'Почти правильно! Давай ещё разок.', use:'за ответ рядом с верным' },
  four:    { text:'Кира получила четвёрку! Молодец! Ещё чуть-чуть старания, и будет пятёрка.', use:'за четвёрку' },
  three:   { text:'Тройка, но Кира большая молодец, что старалась. Давай повторим, и будет пятёрка!', use:'за тройку' },
  level:   { text:'Кира получила новый уровень! Так держать!', use:'новый уровень' },
  rest:    { text:'Хватит играть, глазкам нужен отдых. Завтра будет ещё больше пятёрок!', use:'напоминание об отдыхе' }
};
let clipStore={}, recordingId=null, rec=null;
const CLIP_DB='kiraVoiceClips', CLIP_STORE='clips';
function openClipDB(){ return new Promise(res=>{
  try{ const r=indexedDB.open(CLIP_DB,1);
    r.onupgradeneeded=()=>{ try{ r.result.createObjectStore(CLIP_STORE); }catch(e){} };
    r.onsuccess=()=>res(r.result); r.onerror=()=>res(null); }catch(e){ res(null); }
}); }
function clipReq(p){ return new Promise(res=>{ if(!p){ res(null); return; } p.onsuccess=()=>res(p.result); p.onerror=()=>res(null); }); }
async function loadClips(){
  const db=await openClipDB(); if(!db) return;
  try{
    const st=db.transaction(CLIP_STORE,'readonly').objectStore(CLIP_STORE);
    const keys=await clipReq(st.getAllKeys()), vals=await clipReq(st.getAll());
    (keys||[]).forEach((k,i)=>{ clipStore[k]=vals[i]; });
  }catch(e){}
  paintClipList();
}
async function clipSave(id,dataUrl){
  clipStore[id]=dataUrl;
  const db=await openClipDB();
  if(db){ try{ const tx=db.transaction(CLIP_STORE,'readwrite'); tx.objectStore(CLIP_STORE).put(dataUrl,id);
    await new Promise(res=>{ tx.oncomplete=res; tx.onerror=res; tx.onabort=res; }); }catch(e){} }
  else{ try{ localStorage.setItem('clip:'+id, dataUrl); }catch(e){} }
  paintClipList();
}
async function clipDelete(id){
  delete clipStore[id];
  const db=await openClipDB();
  if(db){ try{ const tx=db.transaction(CLIP_STORE,'readwrite'); tx.objectStore(CLIP_STORE).delete(id);
    await new Promise(res=>{ tx.oncomplete=res; tx.onerror=res; tx.onabort=res; }); }catch(e){} }
  try{ localStorage.removeItem('clip:'+id); }catch(e){}
  paintClipList();
}
function playClip(id){
  const url=clipStore[id]; if(!url) return false;
  try{ const a=new Audio(url); a.volume=1; const p=a.play(); if(p&&p.catch) p.catch(()=>{}); return true; }catch(e){ return false; }
}
/* похвала: сначала мамин голос, если записан, иначе синтез */
function say(id, fallback){
  if(!state.sound) return;
  if(playClip(id)){ caption(CLIPS[id].text); return; }
  speak(fallback);
}
function clipMsg(text){ const el=$('#clip-msg'); if(el) el.textContent=text; }
function paintClipList(){
  const box=$('#clip-list'); if(!box) return;
  box.innerHTML='';
  Object.keys(CLIPS).forEach(id=>{
    const c=CLIPS[id], has=!!clipStore[id], rec_now=recordingId===id;
    const row=document.createElement('div'); row.className='clip-row'+(has?' has':'');
    row.innerHTML='<div class="clip-txt"><b>'+c.text+'</b><small>'+c.use+'</small></div>';
    const btns=document.createElement('div'); btns.className='clip-btns';
    const bRec=document.createElement('button'); bRec.className='btn small'+(rec_now?' primary':'');
    bRec.textContent = rec_now ? '⏹ Стоп' : (has?'🎙 Переписать':'🎙 Записать');
    bRec.addEventListener('click',()=>{ rec_now? stopRecord() : startRecord(id); });
    btns.appendChild(bRec);
    if(has && !rec_now){
      const bPlay=document.createElement('button'); bPlay.className='btn small ghost'; bPlay.textContent='▶ Прослушать';
      bPlay.addEventListener('click',()=>{ ac(); if(!playClip(id)) clipMsg('Запись не играет — перезагрузите страницу.'); });
      btns.appendChild(bPlay);
      const bDel=document.createElement('button'); bDel.className='btn small ghost'; bDel.textContent='✖';
      bDel.addEventListener('click',async()=>{ await clipDelete(id); clipMsg('Запись удалена: «'+c.text+'»'); });
      btns.appendChild(bDel);
    }
    row.appendChild(btns);
    const mark=document.createElement('div'); mark.className='clip-mark'; mark.textContent = rec_now?'🔴 идёт запись…' : (has?'✅ записано':'—');
    row.appendChild(mark);
    box.appendChild(row);
  });
}
function startRecord(id){
  if(recordingId) stopRecord();
  const md=navigator.mediaDevices;
  if(!md || !md.getUserMedia || typeof MediaRecorder==='undefined'){
    clipMsg('Браузер не умеет записывать звук. Попробуйте Chrome на Android или Safari на iPad, адрес сайта при этом должен начинаться с https://');
    return;
  }
  md.getUserMedia({audio:true}).then(stream=>{
    let chunks=[];
    let mr;
    try{ mr=new MediaRecorder(stream); }catch(e){
      clipMsg('Не удалось начать запись: '+e.message); stream.getTracks().forEach(t=>t.stop()); return;
    }
    mr.ondataavailable=e=>{ if(e.data && e.data.size) chunks.push(e.data); };
    mr.onstop=()=>{
      stream.getTracks().forEach(t=>t.stop());
      const blob=new Blob(chunks,{type:(chunks[0]&&chunks[0].type)||'audio/webm'});
      const fr=new FileReader();
      fr.onload=async()=>{ await clipSave(id, fr.result); clipMsg('Записано: «'+CLIPS[id].text+'» ('+Math.max(1,Math.round(blob.size/1024))+' КБ). Можно проверить кнопкой «Прослушать».'); };
      fr.onerror=()=>clipMsg('Запись не сохранилась: браузер не смог прочитать звук.');
      fr.readAsDataURL(blob);
      recordingId=null; paintClipList();
    };
    rec=mr; recordingId=id; mr.start(250);
    ac();
    clipMsg('Говорите в микрофон планшета спокойно и близко: «'+CLIPS[id].text+'». Потом нажмите «Стоп».');
    paintClipList();
  }).catch(e=>{
    recordingId=null; paintClipList();
    clipMsg('Микрофон недоступен: '+(e && e.message ? e.message : 'разрешите доступ к микрофону в настройках браузера')+'.');
  });
}
function stopRecord(){ if(rec && recordingId){ try{ rec.stop(); }catch(e){} } rec=null; }

/* ------------------------------ звуки ------------------------------ */
let AC=null;
function ac(){
  if(!AC){ try{ AC=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){ AC=null; } }
  if(AC && AC.state==='suspended'){ try{ AC.resume(); }catch(e){} }
  return AC;
}
function tone(f,dur,type,vol,delay){
  if(!state.sound) return;
  const c=ac(); if(!c) return;
  try{
    const o=c.createOscillator(), g=c.createGain();
    o.type=type||'sine'; o.frequency.value=f; g.gain.value=0;
    o.connect(g); g.connect(c.destination);
    const t=c.currentTime+(delay||0);
    g.gain.setValueAtTime(0.0001,t);
    g.gain.linearRampToValueAtTime(vol||.15, t+.02);
    g.gain.exponentialRampToValueAtTime(.0001, t+dur);
    o.start(t); o.stop(t+dur+.06);
  }catch(e){}
}
function sndOk(){ tone(659,.14,'sine',.16,0); tone(880,.2,'sine',.15,.09); }
function sndBad(){ tone(233,.16,'triangle',.1,0); tone(185,.2,'triangle',.09,.13); }
function sndStar(){ tone(1046,.1,'sine',.11,0); tone(1318,.12,'sine',.09,.06); }
function sndFanfare(){ [523,659,784,1046,1318].forEach((f,i)=>tone(f,.24,'sine',.15,i*.13)); }

/* ------------------------------ конфетти ------------------------------ */
const conf=$('#confetti'), cctx=conf.getContext('2d');
let parts=[], confRAF=null;
function sizeConf(){ conf.width=window.innerWidth; conf.height=window.innerHeight; }
window.addEventListener('resize', sizeConf); sizeConf();
function reducedMotion(){ try{ return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){ return false; } }
const CONF_COLORS=['#ff6f91','#ff9ac4','#ffd36e','#ffe066','#2fa84f','#4b8ef1','#7a54d6','#00c2a8','#f97316','#c084fc'];
const CONF_SHAPES=['rect','rect','circle','star','heart'];
function confetti(n){
  if(reducedMotion()) n=Math.min(n, 28);
  const cx=window.innerWidth/2, cy=window.innerHeight*0.34;
  for(let i=0;i<n;i++){
    parts.push({ x:cx+(Math.random()-.5)*window.innerWidth*.7, y:cy+(Math.random()-.5)*80,
      vx:(Math.random()-.5)*8, vy:-7-Math.random()*8, r:5+Math.random()*8,
      c:CONF_COLORS[rnd(CONF_COLORS.length)], shape:CONF_SHAPES[rnd(CONF_SHAPES.length)],
      a:Math.random()*Math.PI, spin:(Math.random()-.5)*.35, life:80+Math.random()*60 });
  }
  if(!confRAF) tickConf();
}
function drawPart(p){
  const r=p.r;
  cctx.save(); cctx.translate(p.x,p.y); cctx.rotate(p.a); cctx.fillStyle=p.c;
  if(p.shape==='circle'){ cctx.beginPath(); cctx.arc(0,0,r*.55,0,Math.PI*2); cctx.fill(); }
  else if(p.shape==='star'){
    cctx.beginPath();
    for(let i=0;i<10;i++){ const rad=(i%2)?r*.42:r*.95, a=i*Math.PI/5; cctx.lineTo(Math.cos(a)*rad, Math.sin(a)*rad); }
    cctx.closePath(); cctx.fill();
  } else if(p.shape==='heart'){
    const s=r*.7;
    cctx.beginPath(); cctx.moveTo(0,s*.8);
    cctx.bezierCurveTo(-s*1.2,-s*.2,-s*.5,-s*1.1,0,-s*.4);
    cctx.bezierCurveTo(s*.5,-s*1.1,s*1.2,-s*.2,0,s*.8);
    cctx.fill();
  } else cctx.fillRect(-r/2,-r/2,r,r*.62);
  cctx.restore();
}
function tickConf(){
  confRAF=requestAnimationFrame(tickConf);
  cctx.clearRect(0,0,conf.width,conf.height);
  parts.forEach(p=>{ p.vy+=.2; p.vx*=.995; p.x+=p.vx; p.y+=p.vy; p.a+=p.spin; p.life--; });
  parts=parts.filter(p=>p.life>0 && p.y<conf.height+60);
  parts.forEach(drawPart);
  if(!parts.length){ cancelAnimationFrame(confRAF); confRAF=null; cctx.clearRect(0,0,conf.width,conf.height); }
}

/* ------------------------------ вкладки ------------------------------ */
function showView(v){
  $$('.view').forEach(s=>s.classList.toggle('active', s.id==='view-'+v));
  $$('.tab').forEach(t=>t.classList.toggle('active', t.dataset.view===v));
  try{ window.scrollTo({top:0,behavior:'smooth'}); }catch(e){ window.scrollTo(0,0); }
}
$$('.tab').forEach(t=>t.addEventListener('click',()=>{
  ac();
  if(t.dataset.view==='diary') renderDiary();
  if(t.dataset.view==='adults') renderAdults();
  if(t.dataset.view==='hub') renderHub();
  showView(t.dataset.view);
}));

/* ------------------------------ главная ------------------------------ */
function allGames(){ const out=[]; SUBJECTS.forEach(s=>s.games.forEach(g=>out.push({s:s,g:g}))); return out; }
function subjectOf(id){ return SUBJECTS.filter(s=>s.games.some(g=>g.id===id))[0]; }
function gameOf(id){ let r=null; SUBJECTS.forEach(s=>s.games.forEach(g=>{ if(g.id===id) r=g; })); return r; }

/* фильтр тем в хабe: all | pet (только по Петерсон) | plain (обычные) */
let hubFilter='all';

/* Как игра устроена — короткая подпись на карточке, чтобы ребёнок
   сразу понял, что надо делать: выбрать, разложить, собрать, обвести. */
function kindHint(kind){
  return ({choice:'🅰️ выбери вариант', sort:'🧺 разложи по корзинкам', tiles:'🔠 собери из кубиков',
           trace:'✍️ обведи и напиши', pairs:'🃏 найди пары', action:'🤸 зарядка'})[kind] || '🅰️ выбери вариант';
}
/* Описание для детской карточки: ссылки на тетради уже в строке 📚 */
function kidDesc(g){
  const raw=(g.desc||'').trim();
  const parts=raw.split('.').map(s=>s.trim()).filter(Boolean);
  const clean=parts.filter(p=>!/занятие|занятий|занят|страниц|с\. ?\d|по мотивам|продолжение|петерсон|ФОП/i.test(p));
  let text=clean.join('. ') || raw;
  if(!text) text=raw;
  if(text.length>116) text=text.slice(0,116).replace(/[^ ]*$/,'').trim()+'…';
  return text.endsWith('.')?text:text+'.';
}

function renderHub(){
  $('#kid-name-top').textContent=state.name;
  $('#kid-name-hero').textContent=state.name;
  const fives=state.grades.filter(g=>g.grade===5).length;
  const shinies=(state.stickers||[]).filter(s=>s.tier==='rare').length;
  const legends=(state.stickers||[]).filter(s=>s.tier==='legend').length;
  const toChest=Math.max(0, 3-(state.chestN||0));
  $('#hero-level').innerHTML =
    '<span class="badge">🎯 Уровень: <b>'+state.diff+'</b></span>'+
    '<span class="badge">🔥 Серия: <b>'+(state.streak||0)+' дн.</b></span>'+
    '<span class="badge">Пятёрок: <b>'+fives+'</b></span>'+
    '<span class="badge">Звёздочек: <b>'+state.stars+'</b></span>'+
    '<span class="badge">Сердечек: <b>'+(state.hearts||0)+'</b></span>'+
    '<span class="badge">Наклеек: <b>'+state.stickers.length+'</b></span>'+
    '<span class="badge">Медалей: <b>'+(state.medals||[]).length+'</b></span>';
  const bestCount=Object.keys(state.best).length;
  const totalGames=allGames().length;
  $('#hero-summary').innerHTML =
    'Сыграно игр: <b>'+state.grades.length+'</b><br>'+
    'Игр, где Кира уже получала оценку: <b>'+bestCount+' из '+totalGames+'</b><br>'+
    'Коллекция наклеек: <b>'+state.stickers.length+'</b> (блестящих ✨ '+shinies+', сказочных 👑 '+legends+')<br>'+
    (toChest>0 ? ('До сундучка 🎁: ещё <b>'+toChest+'</b> пятёрк'+(toChest===1?'а':(toChest<5?'и':''))+' — он откроется сам')
               : 'Сундучок 🎁 как раз открылся!')+
    (fives>=3?'<br>Настоящая отличница! 🏆':'<br>Впереди ещё много пятёрок!');
  medalShelf($('#hero-medals'), true);

  paintLevel();
  renderQuick();
  const dailyId=(state.daily && state.daily.date===todayKey() && !state.daily.done)?state.daily.game:'';
  const box=$('#subjects'); box.innerHTML='';
  /* фильтр по автору: обычные игры и игры по методике Петерсон */
  const bar=document.createElement('div'); bar.className='hub-filter';
  const F=[['all','💗 Все игры'],['pet','👣 Только по Петерсон'],['plain','Без Петерсон']];
  const petTotal=allGames().filter(x=>x.g.pet).length;
  bar.innerHTML='<span class="hf-label">Игр по методике Л. Г. Петерсон: <b>'+petTotal+'</b> — помечены значком 👣</span>'+
    F.map(f=>'<button type="button" class="hf'+(hubFilter===f[0]?' on':'')+'" data-f="'+f[0]+'">'+f[1]+'</button>').join('');
  box.appendChild(bar);
  bar.addEventListener('click',e=>{ const b=e.target.closest('.hf'); if(!b) return; hubFilter=b.dataset.f; renderHub(); });
  SUBJECTS.forEach(sub=>{
    const shown=sub.games.filter(g=>hubFilter==='all'?true:(hubFilter==='pet'?!!g.pet:!g.pet));
    if(!shown.length) return;
    const petN=sub.games.filter(g=>g.pet).length;
    const played=sub.games.filter(g=>state.best[g.id]).length;
    const pct=Math.round(played/sub.games.length*100);
    const sec=document.createElement('section');
    sec.className='subject'; sec.style.setProperty('--c',sub.color);
    const h=document.createElement('h2');
    h.innerHTML='<span class="s-emoji">'+sub.emoji+'</span><span class="s-title">'+sub.title+'</span>'+
      (petN?'<span class="s-pet" title="Игр по методике Л. Г. Петерсон в этой теме">👣 '+petN+'</span>':'')+
      '<span class="s-progress"><span class="s-bar" style="width:'+Math.max(4,pct)+'%"></span>'+
      '<span class="s-bar-txt">'+played+' / '+sub.games.length+'</span></span>';
    const d=document.createElement('p'); d.className='subject-desc'; d.textContent=sub.desc;
    const grid=document.createElement('div'); grid.className='games';
    shown.forEach(g=>{
      const b=state.best[g.id];
      const card=document.createElement('button');
      card.className='game-card'+(g.id===dailyId?' daily-hot':'')+(g.pet?' pet-card':''); card.type='button';
      card.innerHTML=
        '<span class="g-emoji">'+g.emoji+'</span>'+
        (g.pet?'<span class="g-pet">👣 по Петерсон</span>':'')+
        '<span class="g-kind">'+kindHint(g.kind)+'</span>'+
        '<span class="g-title">'+g.title+'</span>'+
        '<span class="g-desc">'+kidDesc(g)+'</span>'+
        '<span class="g-book">📚 '+g.book+'</span>'+
        '<span class="g-foot">'+
          '<span class="mini-grade '+(b?('g'+b.grade):'none')+'">'+(b?b.grade:'?')+'</span>'+
          '<span class="mini-stars">'+(b?('⭐'.repeat(Math.min(5,b.stars||0))):'ещё не играла')+'</span>'+
        '</span>';
      card.addEventListener('click',()=>{ ac(); startGame(sub,g); });
      grid.appendChild(card);
    });
    sec.appendChild(h); sec.appendChild(d); sec.appendChild(grid);
    box.appendChild(sec);
  });
}

/* ------------------------------ генераторы заданий ------------------------------ */
const GEN={};

/* ---- азбука ---- */
GEN['abc.find']=function(){
  const L=LV().letters, used={};
  return function(){
    let target,tries=0; do{ target=pick(L); tries++; }while(used[target]&&tries<25); used[target]=1;
    const rest=pickN(L.filter(x=>x!==target), LV().opts-1);
    const opts=shuffle([target].concat(rest));
    return { speak:'Найди букву '+target.toLowerCase()+'. Нажми на неё.',
      prompt:'Где спряталась буква «'+target+'»?',
      options:opts.map(o=>({t:o,cls:'big-letter'})), answer:opts.indexOf(target),
      hint:'Буква «'+target+'» выглядит так.' };
  };
};
GEN['abc.firstSound']=function(){
  const L=LV().letters, pool=FIRST_SOUND.filter(x=>L.indexOf(x.l)>=0), used={};
  return function(){
    let it,tries=0; do{ it=pick(pool.length?pool:FIRST_SOUND); tries++; }while(used[it.w]&&tries<30); used[it.w]=1;
    /* обманки — только из букв текущего уровня, иначе ребёнку предлагают непройденные буквы */
    const cand=FIRST_SOUND.filter(x=>x.l!==it.l && L.indexOf(x.l)>=0);
    const back=FIRST_SOUND.filter(x=>x.l!==it.l);
    const others=(cand.length>=LV().opts-1 ? cand : back).slice()
      .sort(()=>Math.random()-.5).slice(0, LV().opts-1).map(x=>x.l);
    const opts=shuffle([it.l].concat(others));
    return { speak:'Послушай слово '+it.w+'. Какая буква стоит в слове первой?',
      prompt:'Первая буква в слове:', picture:it.e, pictureWord:cap(it.w),
      options:opts.map(o=>({t:o,cls:'big-letter'})), answer:opts.indexOf(it.l),
      hint:'Слово «'+cap(it.w)+'» начинается на звук «'+it.l.toLowerCase()+'».' };
  };
};
GEN['abc.syllables']=function(){
  const used={};
  return function(){
    let it,tries=0; do{ it=pick(SYL_COUNT); tries++; }while(used[it.w]&&tries<30); used[it.w]=1;
    const opts=shuffle([it.n].concat(pickN([1,2,3].filter(n=>n!==it.n),2)));
    /* делим слово на слоги по гласным — ребёнок хлопает по частям */
    const parts=it.w.toLowerCase().match(/[^аеёиоуыэюя]*[аеёиоуыэюя][^аеёиоуыэюя]*/g) || [it.w.toLowerCase()];
    return { speak:'Слово '+it.w.toLowerCase()+'. Сколько в нём слогов? Хлопни в ладоши столько раз.',
      prompt:'Сколько слогов в слове:', picture:it.e, pictureWord:cap(it.w),
      options:opts.map(o=>({t:String(o),cls:'text'})), answer:opts.indexOf(it.n),
      hint:'Повтори слово по частям и хлопай: '+parts.join(' / ')+'. Получилось '+it.n+' '+((it.n===1)?'слог':(it.n<5?'слога':'слогов'))+'.' };
  };
};
GEN['abc.vowels']=function(){
  const L=LV().letters, vow=L.filter(l=>VOWELS.indexOf(l)>=0), cons=L.filter(l=>VOWELS.indexOf(l)<0);
  const bag=shuffle(vow.map(l=>({t:l,cat:'a'})).concat(cons.map(l=>({t:l,cat:'b'}))));
  let i=0;
  return function(){
    let it;
    if(i<bag.length) it=bag[i++];
    else { i=0; it=shuffle(vow.map(l=>({t:l,cat:'a'})).concat(cons.map(l=>({t:l,cat:'b'}))))[0] || {t:'А',cat:'a'}; }
    /* значок предмета нейтральный: 🎵 и 🧱 заранее выдавали, в какую корзинку класть */
    return { speak:'Куда положить букву '+it.t.toLowerCase()+'? В зелёную корзинку — если букву можно пропеть, в синюю — если пропеть нельзя.',
      item:{t:it.t, cat:it.cat, emoji:'🅰️'},
      bins:[{id:'a',label:'Гласные · поём',emoji:'🟢'},{id:'b',label:'Согласные · язычок мешает',emoji:'🔵'}],
      hint: it.cat==='a' ? ('Букву «'+it.t.toLowerCase()+'» можно пропеть длинно: «'+it.t.toLowerCase()+'-а-а» — она в зелёную корзинку.'+
              ('АУИЫЭО'.indexOf(it.t)>=0 ? ' Эта буква звенит особенно долго.' : ''))
                          : 'Букву «'+it.t.toLowerCase()+'» пропеть нельзя — язычок ей мешает. Она в синюю корзинку.' };
  };
};
GEN['abc.buildWord']=function(){
  const pool=LV().words, used={};
  return function(){
    let w,tries=0; do{ w=pick(pool); tries++; }while(used[w]&&tries<30); used[w]=1;
    const letters=w.split('');
    const extra = state.diff==='сложный' ? pickN('АОВГНСРТОУИМКСШЛ'.split(''),1) : [];
    return { speak:'Собери из кубиков слово «'+w.toLowerCase()+'».',
      prompt:'Собери слово', picture:EMOJI_BY_WORD[w]||'❔', pictureWord:'',
      answer:letters, tiles:shuffle(letters.concat(extra)),
      hint:'Первая буква слова — «'+letters[0]+'». Слово из '+letters.length+' букв.' };
  };
};

/* ---- математика ---- */
function numOptions(n,max,k){
  const set={}; set[n]=1; const out=[n];
  let guard=0;
  while(out.length<k && guard<200){
    guard++;
    let v=n+pick([1,2,3,-1,-2,-3,10,-10,4,-4]);
    if(v<0) v=0; if(v>max+3) v=max;
    if(v===0 && n!==0) continue;
    if(!set[v]){ set[v]=1; out.push(v); }
  }
  while(out.length<k){ const v=out.length+n; if(!set[v]){set[v]=1;out.push(v);} else break; }
  return out;
}
GEN['math.count']=function(){
  const m=LV().max;
  return function(){
    const n=1+rnd(m);
    const em=pick(COUNT_EMOJIS);
    const opts=shuffle(numOptions(n,m,LV().opts));
    return { speak:'Посчитай картинки на экране. Сколько их? Выбери нужную цифру.',
      promptHtml:'<div class="q-count">'+('<span>'+em+'</span>').repeat(n)+'</div>',
      options:opts.map(o=>({t:String(o),cls:'text'})), answer:opts.indexOf(n),
      hint:'Считай по порядку, показывая пальчиком: один, два, три…' };
  };
};
GEN['math.compare']=function(){
  const m=LV().max;
  return function(){
    let a=1+rnd(m), b=1+rnd(m);
    if(a===b) b = b<m? b+1 : b-1;
    const hard = state.diff==='сложный' || (state.diff==='средний' && Math.random()<.5);
    const em=pick(COUNT_EMOJIS);
    if(hard){
      /* иногда числа равны — иначе знак «=» никогда не верный и только путает */
      if(Math.random()<.25) b=a;
      const sign = a>b ? '>' : (a<b ? '<' : '=');
      const opts=shuffle(['>','<','=']);
      return { speak:'Сравни числа '+a+' и '+b+'. Что между ними: больше, меньше или равно?',
        prompt:'Какой знак нужен между '+a+' и '+b+'?',
        promptHtml:'<div class="op-line">'+a+' &nbsp;?&nbsp; '+b+'</div>',
        options:opts.map(o=>({t:o,cls:'sign'})), answer:opts.indexOf(sign),
        hint: sign==='=' ? ('Числа одинаковые, значит знак «=»: '+a+' равно '+b+'.')
                         : ('Ротик открыт к большему числу: '+Math.max(a,b)+' больше, чем '+Math.min(a,b)+' — нужен знак '+sign+'.') };
    }
    const askMore=Math.random()<.5;
    const opts=shuffle([a,b]);
    return { speak:'Посчитай картинки слева и справа: чего '+(askMore?'больше':'меньше')+'?',
      prompt:(askMore?'Где больше? Выбери большее число.':'Где меньше? Выбери меньшее число.'),
      promptHtml:'<div class="cmp"><div><b>'+a+'</b><br>'+em.repeat(a)+'</div><div><b>'+b+'</b><br>'+em.repeat(b)+'</div></div>',
      options:opts.map(o=>({t:String(o),cls:'text'})), answer:opts.indexOf(askMore?Math.max(a,b):Math.min(a,b)),
      hint:'Посчитай: слева '+a+', справа '+b+'. '+(askMore?'Больше':'Меньше')+' — '+ (askMore?Math.max(a,b):Math.min(a,b)) +'.' };
  };
};
GEN['math.ops']=function(){
  const m=LV().max;
  return function(){
    const em=pick(COUNT_EMOJIS);
    let a,b,ans,sign;
    if(Math.random()<.55){ a=1+rnd(m-1); b=1+rnd(m-a); ans=a+b; sign='+'; }
    else { a=1+rnd(m-1); b=1+rnd(a); ans=a-b; sign='−'; }
    const opts=shuffle(numOptions(ans,m+2,LV().opts));
    return { speak:'Реши пример: '+a+' '+(sign==='+'?'плюс':'минус')+' '+b+'. Сколько получится?',
      promptHtml:'<div class="op-emoji">'+a+' '+em+' '+sign+' '+b+' '+em+'</div><div class="op-line">'+a+' '+sign+' '+b+' = ?</div>',
      options:opts.map(o=>({t:String(o),cls:'text'})), answer:opts.indexOf(ans),
      hint:'Всего '+a+', '+ (sign==='+' ? 'добавь ещё '+b : 'убери '+b) +'. Получится '+ans+'.' };
  };
};
GEN['math.sequence']=function(){
  const m=LV().max;
  return function(){
    /* шаг подбираем так, чтобы весь ряд и ответ помещались в 1…m */
    const steps=[1,-1]; if(m>=9){ steps.push(2,-2); }
    const d=pick(steps);
    let first;
    if(d>0){ first=1+rnd(Math.max(1,m-4*d)); }
    else   { first=m-rnd(Math.max(1,m-1-4*(-d))); }
    const shown=[first];
    for(let i=0;i<3;i++){ shown.push(shown[shown.length-1]+d); }
    let ans=shown[3]+d;                       /* ровно следующее число за последним показанным */
    if(ans<1||ans>m){ shown=[1,2,3,4]; ans=5; }
    const opts=shuffle(numOptions(ans,m+8,LV().opts));
    return { speak:'Продолжи ряд: '+shown.join(', ')+'. Какое число дальше?',
      promptHtml:'<div class="op-line">'+shown.join(' · ')+' · ?</div>',
      options:opts.map(o=>({t:String(o),cls:'text'})), answer:opts.indexOf(ans),
      hint:'Числа '+ (d>0?'растут на '+d:'уменьшаются на '+(-d)) +'. После '+shown[3]+' идёт '+ans+'.' };
  };
};
GEN['math.shapes']=function(){
  return function(){
    const mode = state.diff==='лёгкий' ? 'find' : (Math.random()<.55?'find':'name');
    if(mode==='find'){
      const target=pick(SHAPES);
      const opts=shuffle([target].concat(pickN(SHAPES.filter(s=>s.n!==target.n), LV().opts-1)));
      return { speak:'Покажи фигуру, которая называется «'+target.n+'».',
        prompt:'Найди фигуру:', big:'«'+target.n+'»',
        options:opts.map(o=>({html:o.svg, label:o.n})), answer:opts.indexOf(target),
        hint:'«'+target.n+'» — вот эта фигура.' };
    }
    const target=pick(SHAPES);
    const opts=shuffle([target].concat(pickN(SHAPES.filter(s=>s.n!==target.n), LV().opts-1)));
    return { speak:'Как называется эта фигура?',
      prompt:'Как зовут эту фигуру?', promptHtml:'<div class="shape-show">'+target.svg+'</div>',
      options:opts.map(o=>({t:cap(o.n),cls:'text'})), answer:opts.indexOf(target),
      hint:'У неё '+(target.n==='круг'?'нет уголков':'есть уголки')+'. Это '+target.n+'.' };
  };
};

/* ---- логика ---- */
GEN['logic.odd']=function(){
  const used={};
  return function(){
    let it,tries=0; do{ it=pick(ODD_OUT); tries++; }while(used[it.items.join()]&&tries<30); used[it.items.join()]=1;
    const opts=shuffle(it.items.slice());
    return { speak:'Что тут лишнее? Нажми на лишний предмет.',
      prompt:'Что лишнее?',
      promptHtml:'<div class="q-count row4">'+it.items.map(x=>'<span>'+x+'</span>').join('')+'</div>',
      options:opts.map(o=>({t:o,cls:'emoji-opt'})), answer:opts.indexOf(it.odd),
      hint:cap(it.why) };
  };
};
GEN['logic.pattern']=function(){
  const used={};
  return function(){
    let it,tries=0; do{ it=pick(PATTERNS); tries++; }while(used[it.seq.join()]&&tries<30); used[it.seq.join()]=1;
    const opts=shuffle(it.opts.slice());
    return { speak:'Посмотри на ряд. Что должно быть следующим?',
      prompt:'Продолжи ряд:',
      promptHtml:'<div class="op-line seq">'+it.seq.join(' ')+' <b>?</b></div>',
      options:opts.map(o=>({t:o,cls:'emoji-opt'})), answer:opts.indexOf(it.ans),
      hint:'Ряд повторяется. Дальше будет '+it.ans+'.' };
  };
};
GEN['logic.size']=function(){
  const used={};
  return function(){
    let it,tries=0; do{ it=pick(SIZE_ASK); tries++; }while(used[it.items.join()]&&tries<30); used[it.items.join()]=1;
    const opts=shuffle(it.items.slice());
    return { speak:cap(it.ask), prompt:it.ask,
      promptHtml:'<div class="cmp big">'+it.items.map(x=>'<div>'+x+'</div>').join('')+'</div>',
      options:opts.map(o=>({t:o,cls:'emoji-opt'})), answer:opts.indexOf(it.ans),
      hint:it.ans+' больше, чем '+it.other+'.' };
  };
};
GEN['logic.memory']=function(){ return function(){ return null; }; };

/* ---- мир вокруг ---- */
GEN['world.alive']=function(){
  const bag=shuffle(ALIVE.map(x=>({t:x.t,emoji:x.e,cat:'a'})).concat(NOT_ALIVE.map(x=>({t:x.t,emoji:x.e,cat:'b'}))));
  let i=0;
  return function(){
    let it;
    if(i<bag.length) it=bag[i++]; else { i=1; it=bag[0]; }
    return { speak:'Что это: живое или неживое? '+it.t+'. Нажми на нужную корзинку.',
      prompt:'Это живое или неживое?',
      item:{t:cap(it.t), cat:it.cat, emoji:it.emoji},
      bins:[{id:'a',label:'Живое · растёт, дышит',emoji:'🌱'},{id:'b',label:'Неживое · не растёт',emoji:'❄️'}],
      hint: it.cat==='a' ? (cap(it.t)+' живёт: растёт, дышит, нуждается в уходе — в зелёную корзинку.')
                         : (cap(it.t)+' не живое: оно не растёт и не дышит — в синюю корзинку.') };
  };
};
GEN['world.homes']=function(){
  const used={};
  return function(){
    let it,tries=0; do{ it=pick(HOMES); tries++; }while(used[it.w]&&tries<30); used[it.w]=1;
    const opts=shuffle(it.opts.map(cap));
    return { speak:'Где живёт '+it.w+'?', picture:it.a, pictureWord:cap(it.w),
      prompt:'Где живёт?', options:opts.map(o=>({t:o,cls:'text'})), answer:opts.indexOf(cap(it.home)),
      hint:cap(it.w)+' живёт в месте: '+it.home+'.' };
  };
};
GEN['world.seasons']=function(){
  const used={};
  return function(){
    let it,tries=0; do{ it=pick(SEASONS); tries++; }while(used[it.q]&&tries<30); used[it.q]=1;
    const opts=shuffle(it.opts.map(cap));
    return { speak:it.q+' Выбери время года.', picture:it.e,
      prompt:it.q, options:opts.map(o=>({t:o,cls:'text'})), answer:opts.indexOf(cap(it.ans)),
      hint:'Это '+it.ans+'.' };
  };
};
GEN['world.times']=function(){
  const used={};
  return function(){
    let it,tries=0; do{ it=pick(TIMES); tries++; }while(used[it.q]&&tries<30); used[it.q]=1;
    const opts=shuffle(it.opts.map(cap));
    return { speak:it.q, picture:it.e, prompt:'Какое это время суток?',
      options:opts.map(o=>({t:o,cls:'text'})), answer:opts.indexOf(cap(it.ans)),
      hint:'Это '+it.ans+'.' };
  };
};
GEN['world.materials']=function(){
  const used={};
  return function(){
    let it,tries=0; do{ it=pick(MATERIALS); tries++; }while(used[it.w]&&tries<30); used[it.w]=1;
    const opts=shuffle(it.opts.map(cap));
    return { speak:'Из чего сделан предмет: '+it.w+'?', picture:it.e, pictureWord:cap(it.w),
      prompt:'Из чего это сделано?', options:opts.map(o=>({t:o,cls:'text'})), answer:opts.indexOf(cap(it.ans)),
      hint:cap(it.w)+' сделан из материала: '+it.ans+'.' };
  };
};
GEN['world.safety']=function(){
  const used={};
  return function(){
    let it,tries=0; do{ it=pick(SAFETY); tries++; }while(used[it.q]&&tries<30); used[it.q]=1;
    const opts=shuffle(it.opts.slice());
    return { speak:it.q+' Что правильно?', picture:it.e, prompt:it.q,
      options:opts.map(o=>({t:o,cls:'long'})), answer:opts.findIndex(o=>o===it.ans),
      hint:'Правильно: '+it.ans+'.' };
  };
};

/* ---- чтение ---- */
function readPool(){ return state.diff==='лёгкий' ? READ_WORDS.filter(w=>w.w.length<=4) : READ_WORDS; }
GEN['read.wordPic']=function(){
  const pool=readPool(), used={};
  return function(){
    let it,tries=0; do{ it=pick(pool); tries++; }while(used[it.w]&&tries<30); used[it.w]=1;
    const others=pickN(pool.filter(x=>x.e!==it.e), LV().opts-1);
    const opts=shuffle([it].concat(others));
    return { speak:'Прочитай слово: '+it.w+'. Какая это картинка?',
      prompt:'Прочитай:', big:it.w.split('').join(' · '),
      options:opts.map(o=>({t:o.e,cls:'emoji-opt'})), answer:opts.findIndex(o=>o.e===it.e),
      hint:'Это '+it.w.toLowerCase()+'.' };
  };
};
GEN['read.picWord']=function(){
  const pool=readPool(), used={};
  return function(){
    let it,tries=0; do{ it=pick(pool); tries++; }while(used[it.w]&&tries<30); used[it.w]=1;
    const others=pickN(pool.filter(x=>x.w!==it.w), LV().opts-1);
    const opts=shuffle([it].concat(others));
    return { speak:'Посмотри на картинку. Какое это слово?',
      picture:it.e, prompt:'Какое слово подходит?',
      options:opts.map(o=>({t:o.w.split('').join(' '),cls:'word-opt'})), answer:opts.findIndex(o=>o.w===it.w),
      hint:'Это '+it.w.toLowerCase()+'.' };
  };
};
GEN['read.syllables']=function(){
  const pool = state.diff==='лёгкий' ? SYL_WORDS.filter(w=>w.syl.length===2) : SYL_WORDS;
  const used={};
  return function(){
    let it,tries=0; do{ it=pick(pool.length?pool:SYL_WORDS); tries++; }while(used[it.w]&&tries<30); used[it.w]=1;
    return { speak:'Собери слово из слогов: '+it.w+'.',
      prompt:'Собери слово из слогов', picture:it.e, pictureWord:'',
      answer:it.syl.slice(), tiles:shuffle(it.syl.slice()),
      hint:'Первый слог — «'+it.syl[0]+'». В слове '+it.syl.length+' '+((it.syl.length===1)?'слог':(it.syl.length<5?'слога':'слогов'))+'.' };
  };
};

/* ---- прописи (данные для раунда) ---- */
function traceLettersRound(n){
  const L=LV().trace;
  const out=[]; for(let i=0;i<n;i++) out.push(L[i%L.length]);
  return shuffle(out).slice(0,n);
}
/* ---- зарядка ---- */
GEN['health.warmup']=function(){
  let bag=shuffle(WARMUP), i=0;
  return function(){
    const s = (i>=bag.length) ? (bag=shuffle(WARMUP), i=0, bag[i++]) : bag[i++];
    return { emoji:s.e, text:s.t, sub:s.s, speak:s.s };
  };
};
GEN['health.eyes']=function(){
  let bag=shuffle(EYE_GAME), i=0;
  return function(){
    const s = (i>=bag.length) ? (bag=shuffle(EYE_GAME), i=0, bag[i++]) : bag[i++];
    return { emoji:s.e, text:s.t, sub:s.s, speak:s.s };
  };
};

/* ------------------------------ раунд ------------------------------ */
let R=null;
const QUESTIONS=5;

function startGame(sub,g){
  /* дневное ограничение */
  if(state.day!==todayKey()){ state.day=todayKey(); state.dayRounds=0; save(); }
  if(restPolicy()==='modal' && !state._extra){ showRest(); return; }

  const factory = GEN[g.gen] ? GEN[g.gen]() : null;
  R={ sub:sub, game:g, kind:g.kind, qs:[], i:0, results:[], stars:0, hints:0, perfect:0, got:null, max:QUESTIONS, finished:false };
  $('#game-title').innerHTML=g.emoji+' '+g.title+' <small class="gt-sub">'+(g.pet?('👣 по методике Л. Г. Петерсон · '+sub.title):sub.title)+'</small>';
  setMood('🙂');

  if(g.kind==='pairs'){ startPairs(); }
  else if(g.kind==='action'){
    for(let i=0;i<5;i++) R.qs.push(factory());
    R.max=5; renderAction();
  }
  else if(g.kind==='trace'){
    R.max=3;
    if(g.id==='petDict'){
      R.items=shuffle(DICTATIONS).slice(0,3).map(d=>({kind:'grid', d:d, title:d.name, speak:dictSpeak(d)}));
    }
    else if(g.id==='tracePath'){
      R.paths=shuffle(TRACE_PATTERNS).slice(0,3);
      R.items=R.paths.map(p=>({kind:'path', id:p.id, title:p.name, speak:p.speak}));
    } else {
      const ls=traceLettersRound(3);
      R.items=ls.map(l=>({kind:g.id==='letterWrite'?'write':'letter', letter:l, title:'буква '+l.toLowerCase(), speak:'Обведи букву '+l.toLowerCase()+'. Старательно, по пунктиру.'}));
      if(g.id==='letterWrite') R.items.forEach(it=>{ it.speak='Напиши букву '+it.letter.toLowerCase()+' самостоятельно, на память.'; });
    }
    R.idx=0; renderTrace();
  }
  else {
    for(let i=0;i<QUESTIONS;i++) R.qs.push(factory()); if(g.kind==='tiles') nextWordQuestion(); else nextQuestion();
  }
  renderProgress(); renderRoundStars();
  $('#btn-hint').style.display = (g.kind==='pairs') ? 'none':'';
  $('#btn-repeat').style.display = (g.kind==='pairs'||g.kind==='action') ? 'none':'';
  showView('game');
}

$('#btn-home').addEventListener('click',()=>{ stopTrace(); renderHub(); showView('hub'); });

function renderProgress(){
  const total = R.kind==='trace'?R.items.length:(R.kind==='pairs'?R.total:R.qs.length);
  let done = R.kind==='trace'?R.idx:(R.kind==='pairs'?R.matched:R.i);
  let html='';
  for(let i=0;i<total;i++){
    let cls='dot';
    if(i<done){ const v=R.results[i]; cls += (v===undefined || v===1) ? ' done' : ' half'; }
    html+='<span class="'+cls+'"></span>';
  }
  $('#progress').innerHTML=html;
}
function renderRoundStars(){ $('#round-stars').innerHTML='⭐'.repeat(R.stars)||'<span class="muted"></span>'; }

function currentSpeak(){
  if(!R) return '';
  if(R.kind==='trace') return R.items[R.idx] ? R.items[R.idx].speak : '';
  if(R.kind==='action') return R.qs[R.i] ? R.qs[R.i].speak : '';
  return R.qs[R.i] ? R.qs[R.i].speak : '';
}
$('#btn-repeat').addEventListener('click',()=>{ if(R) speak(currentSpeak(), R.sub && R.sub.id==='read'); });
$('#btn-hint').addEventListener('click',()=>{ if(!R) return; giveHint(); });

function giveHint(){
  if(R.kind==='choice'||R.kind==='sort'){
    const q=R.qs[R.i]; if(!q) return;
    R.hints++; if(R.qs && R.qs[R.i]) R.qs[R.i]._hint=true;
    speak(q.hint);
    $$('#stage .glow').forEach(x=>x.classList.remove('glow'));
    if(R.kind==='choice'){ const el=$$('#stage .opt')[q.answer]; if(el) el.classList.add('glow'); }
    else { const el=$('#stage .bin[data-id="'+ (q.item.cat) +'"]'); if(el) el.classList.add('glow'); }
    feedback('💡 '+q.hint,'hint');
  } else if(R.kind==='tiles'){
    const q=R.qs[R.i]; if(!q) return; R.hints++; if(R.qs && R.qs[R.i]) R.qs[R.i]._hint=true;
    const need=R.answerGot||0;
    const want=q.answer[need];
    $$('#stage .glow').forEach(x=>x.classList.remove('glow'));
    const el=$$('#stage .tile').filter(t=>!t.classList.contains('used') && t.dataset.v===want)[0];
    if(el) el.classList.add('glow');
    speak(q.hint); feedback('💡 '+q.hint,'hint');
  } else if(R.kind==='trace'){
    R.hints++; if(R.qs && R.qs[R.i]) R.qs[R.i]._hint=true; speak(R.items[R.idx].speak);
    if(R.items[R.idx].kind==='write'){ showTraceGuide(); }
  } else if(R.kind==='action'){
    speak(R.qs[R.i].speak);
  }
}

/* ---------- обычный выбор ---------- */
/* Рамка задания: заголовок-подсказка, вопрос, картинка-стимул, варианты.
   Так ребёнку сразу видно, что надо сделать, а не только кнопки. */
function qKicker(chip, extra){
  return '<div class="q-kicker"><span class="kq">'+chip+'</span>'+
         (extra?'<span class="kq kq-soft">'+extra+'</span>':'')+'</div>';
}
function qStim(inner){
  return inner ? '<div class="q-stim">'+inner+'</div>' : '';
}
function optionsHtml(q){
  if(!q.options) return '';
  return '<div class="options">'+q.options.map((o,i)=>
    '<button class="opt '+(o.cls||'')+'" data-i="'+i+'">'+(o.html!==undefined?o.html:o.t)+
    (o.label?'<span class="opt-label">'+o.label+'</span>':'')+
    '<span class="opt-tap">нажми</span></button>').join('')+'</div>';
}
function nextQuestion(){
  R.i = R.results.length;
  if(R.i>=R.qs.length){ finishRound(); return; }
  const q=R.qs[R.i]; q._tried=false; q._hint=false;
  const stim=[];
  if(q.picture) stim.push('<div class="q-picture">'+q.picture+(q.pictureWord?'<div class="q-pw">'+q.pictureWord+'</div>':'')+'</div>');
  if(q.big)     stim.push('<div class="q-big">'+q.big+'</div>');
  if(q.promptHtml) stim.push(q.promptHtml);
  if(q.item){
    stim.push('<div class="sort-item"><span class="si-emoji">'+q.item.emoji+'</span>'+q.item.t+'</div>');
  }
  /* вопрос всегда виден текстом: если генератор дал только озвучку, показываем её */
  const question = q.prompt || q.speak || R.game.title;
  let html = qKicker('Вопрос '+(R.i+1)+' из '+R.qs.length, R.game.title);
  html += '<div class="q-prompt">'+question+'</div>';
  html += qStim(stim.join(''));
  if(q.bins){
    html+='<div class="bins">'+q.bins.map(b=>'<button class="bin" data-id="'+b.id+'"><span class="bin-emoji">'+b.emoji+'</span>'+b.label+'</button>').join('')+'</div>';
  }
  html += optionsHtml(q);
  $('#stage').innerHTML='<div class="q-card">'+html+'</div>';
  feedback('Выбери правильный вариант — ошибиться не страшно','soft');
  renderProgress();
  if(q.memorize){ startMemorize(q); } else { speak(q.speak || question); }
}

$('#stage').addEventListener('click',e=>{
  if(!R||R.finished) return;
  const opt=e.target.closest('.opt');
  if(opt && R.kind==='choice'){ answerChoice(+opt.dataset.i, opt); return; }
  const bin=e.target.closest('.bin');
  if(bin && R.kind==='sort'){ answerSort(bin); return; }
  const tile=e.target.closest('.tile');
  if(tile && R.kind==='tiles'){ tileAdd(tile); return; }
  const cell=e.target.closest('.cell.filled');
  if(cell && R.kind==='tiles'){ tileBack(cell); return; }
});
document.addEventListener('keydown',e=>{
  if(!R||R.finished||R.kind!=='choice') return;
  if(!document.getElementById('view-game').classList.contains('active')) return;
  const n=parseInt(e.key,10);
  if(n>=1&&n<=9){ const el=$$('#stage .opt')[n-1]; if(el) answerChoice(n-1, el); }
});

function answerChoice(i,el){
  const q=R.qs[R.i];
  if(el.classList.contains('right')) return;
  if(i===q.answer){
    el.classList.add('right');
    $$('#stage .opt').forEach(o=>{ if(o!==el) o.classList.add('dim'); });
    sndOk();
    scoreQuestion(q);
    feedback('🎉 '+fmt(pick(PRAISE)),'good');
    say('good', fmt(pick(PRAISE)));
    setTimeout(nextQuestion, 1250);
  } else {
    q._tried=true;
    el.classList.add('wrong'); sndBad();
    setTimeout(()=>el.classList.remove('wrong'),600);
    if(!q._saidNear){ q._saidNear=true; say('near', fmt(pick(NEAR))); }
    feedback('🤔 '+fmt(pick(NEAR)),'soft'); setMood('🤔');
  }
}
function answerSort(bin){
  const q=R.qs[R.i];
  if(bin.classList.contains('right')) return;
  if(bin.dataset.id===q.item.cat){
    bin.classList.add('right'); sndOk(); scoreQuestion(q);
    feedback('🎉 '+fmt(pick(PRAISE)),'good'); say('good', fmt(pick(PRAISE)));
    setTimeout(nextQuestion,1150);
  } else {
    q._tried=true; bin.classList.add('wrong'); sndBad();
    setTimeout(()=>bin.classList.remove('wrong'),600);
    if(!q._saidNear){ q._saidNear=true; say('near', fmt(pick(NEAR))); }
    feedback('🤔 '+fmt(pick(NEAR)),'soft'); setMood('🤔');
  }
}
function scoreQuestion(q){
  /* Щадящая шкала ответа: с первого раза — 1, после ошибки — 0.85, с подсказкой — 0.75.
     Звёздочка теперь за каждый верный ответ; если Кира сама исправила ошибку — ей сердечко. */
  const val = q._hint ? 0.75 : (q._tried ? 0.85 : 1);
  R.results.push(val);
  R.stars++;
  if(val===1){ R.perfect=(R.perfect||0)+1; sndStar(); setMood('😍'); sparkleBurst(8); }
  else if(q._tried){ state.hearts=(state.hearts||0)+1; sparkleBurst(4); setMood('🥰'); }
  renderProgress(); renderRoundStars();
  updateHeaderStats();
}

/* ---------- конструктор слова ---------- */
function nextWordQuestion(){
  R.i=R.results.length;
  if(R.i>=R.qs.length){ finishRound(); return; }
  const q=R.qs[R.i]; q._tried=false; q._hint=false;
  R.answerGot=0;
  let html = qKicker('Слово '+(R.i+1)+' из '+R.qs.length, 'нажми кубики по порядку');
  const stim=[];
  if(q.picture) stim.push('<div class="q-picture">'+q.picture+'</div>');
  if(q.prompt)  stim.push('<div class="q-prompt">'+q.prompt+'</div>');
  html += qStim(stim.join(''));
  html+='<div class="answer-line" id="answer-line"></div>';
  html+='<div class="tiles">'+q.tiles.map((t,i)=>'<button class="tile" data-v="'+t+'" data-k="'+i+'">'+t+'</button>').join('')+'</div>';
  $('#stage').innerHTML='<div class="q-card">'+html+'</div>';
  renderAnswerLine();
  feedback('Кубики — это буквы слова. Нажимай их по порядку, слово соберётся само','soft');
  renderProgress();
  speak(q.speak || q.prompt);
}
function renderAnswerLine(){
  const q=R.qs[R.i], line=$('#answer-line'); if(!q||!line) return;
  let html='';
  for(let i=0;i<q.answer.length;i++){
    html+= i<R.answerGot
      ? '<span class="cell filled" data-i="'+i+'">'+R.gotLetters[i]+'</span>'
      : '<span class="cell empty">·</span>';
  }
  line.innerHTML=html;
}
function tileAdd(tile){
  const q=R.qs[R.i]; if(!R.gotLetters) R.gotLetters=[];
  if(!q || tile.classList.contains('used') || R.answerGot>=q.answer.length) return;
  tile.classList.add('used'); tile.classList.remove('glow');
  R.gotLetters[R.answerGot]=tile.dataset.v;
  R.answerGot++;
  renderAnswerLine(); tone(520+80*R.answerGot,.09,'sine',.1,0);
  if(R.answerGot===q.answer.length){
    const ok=q.answer.every((L,i)=>R.gotLetters[i]===L);
    if(ok){
      sndOk(); scoreQuestion(q);
      feedback('🎉 '+cap(q.answer.join(''))+'! '+fmt(pick(PRAISE)),'good');
      speak(fmt(pick(PRAISE))+' Слово '+q.answer.join('').toLowerCase()+'.');
      setTimeout(nextWordQuestion,1300);
    } else {
      q._tried=true; sndBad();
      const line=$('#answer-line'); if(line) line.classList.add('shake-it');
      setTimeout(()=>{ if(line) line.classList.remove('shake-it'); },500);
      speak(fmt(pick(NEAR)));
      feedback('🤔 '+fmt(pick(NEAR)),'soft'); setMood('🤔');
      setTimeout(()=>{
        $$('#stage .tile').forEach(t=>{ t.classList.remove('used'); t.classList.remove('glow'); });
        R.answerGot=0; R.gotLetters=[]; renderAnswerLine();
      },900);
    }
  }
}
function tileBack(cell){
  const i=+cell.dataset.i; const val=R.gotLetters[i];
  const tile=$$('#stage .tile').filter(t=>t.dataset.v===val && t.classList.contains('used')).pop();
  if(tile) tile.classList.remove('used');
  for(let k=i;k<R.answerGot;k++) R.gotLetters[k]=R.gotLetters[k+1];
  R.answerGot--; renderAnswerLine();
}
/* ---------- pairs (память) ---------- */
function startPairs(){
  const n = state.diff==='лёгкий'?4:(state.diff==='средний'?5:6);
  const deck=shuffle(pickN(PAIRS_POOL,n).flatMap(e=>[e,e]));
  R.deck=deck; R.open=[]; R.matched=0; R.mistakes=0; R.total=n; R.lock=false;
  R.max=5;
  $('#stage').innerHTML='<div class="q-card">'+qKicker('Игра на память', n+' пар')
    +'<div class="q-prompt">Переворачивай карточки и находи одинаковые пары</div>'
    +'<div class="pairs">'+deck.map((e,i)=>
      '<div class="card" data-i="'+i+'"><div class="face back">❔</div><div class="face front">'+e+'</div></div>').join('')+'</div></div>';
  feedback('Найди '+n+' пар. Ошибок не бойся — карточки просто переворачиваются обратно','soft');
  renderProgress();
  speak('Игра на память. Открывай карточки и находили одинаковые. Всего пар — '+n+'.');
  $('#stage').onclick=ev=>{
    const c=ev.target.closest('.card'); if(!c||R.lock) return;
    const i=+c.dataset.i;
    if(c.classList.contains('open')||c.classList.contains('matched')) return;
    c.classList.add('open'); tone(600,.08,'sine',.08,0);
    R.open.push(i);
    if(R.open.length===2){
      R.lock=true;
      const [a,b]=R.open;
      if(R.deck[a]===R.deck[b]){
        setTimeout(()=>{
          $$('#stage .card')[a].classList.add('matched'); $$('#stage .card')[b].classList.add('matched');
          R.matched++; sndOk(); R.stars=Math.min(5,n-Math.floor(R.mistakes/3));
          renderRoundStars(); renderProgress(); feedback('Пара! '+R.deck[a],'good');
          R.open=[]; R.lock=false;
          if(R.matched===R.total) finishPairs();
        },350);
      } else {
        R.mistakes++; sndBad();
        setTimeout(()=>{ $$('#stage .card')[a].classList.remove('open'); $$('#stage .card')[b].classList.remove('open');
          R.open=[]; R.lock=false; feedback('Не совпало. Запоминай, где какая карточка.','soft'); },800);
      }
    }
  };
}
function finishPairs(){
  R.got=Math.max(1, 5 - R.mistakes*0.35);
  R.max=5;
  finishRound(true);
}

/* ---------- зарядка ---------- */
function renderAction(){
  R.i=R.results.length;
  if(R.i>=R.qs.length){ finishRound(); return; }
  const q=R.qs[R.i];
  $('#stage').innerHTML='<div class="q-card">'+qKicker('Шаг '+(R.i+1)+' из '+R.qs.length, 'зарядка')
    +'<div class="action-box"><span class="a-emoji">'+q.emoji+'</span><div class="a-text">'+q.text+'</div>'+
    '<div class="action-steps">'+q.sub+'</div></div>'+
    '<div class="action-next"><button class="btn primary" id="act-next">Готово, дальше ▶</button></div></div>';
  feedback('Сделай это движение, потом нажми «Готово»','soft');
  renderProgress();
  speak(q.speak);
  $('#act-next').onclick=()=>{ R.results.push(1); R.stars=Math.min(5,R.results.length); sndStar(); renderProgress(); renderRoundStars(); renderAction(); };
}

/* ---------- прописи ---------- */
let T=null;
function renderTrace(){
  const it=R.items[R.idx];
  if(!it){ finishRound(); return; }
  const head = it.kind==='grid'
    ? '<div class="q-prompt">📓 Диктант по клеточкам: «'+it.title+'» — веди линию по клеточкам</div><div class="dict-steps">'+dictSteps(it.d)+'</div>'
    : it.kind==='path'
    ? '<div class="q-prompt">〰️ '+it.title+'</div>'
    : '<div class="q-prompt">'+(it.kind==='write'?'✍️ Напиши сам: ':'✍️ Обведи по пунктиру: ')+'<b class="trace-head-letter">'+it.letter+'</b></div>';
  $('#stage').innerHTML='<div class="q-card">'+qKicker(
      (it.kind==='grid'?'Дорожка':(it.kind==='path'?'Узор':'Буква'))+' '+(R.idx+1)+' из '+R.items.length,
      it.kind==='write'?'на память':'по пунктиру')+
    '<div class="trace-wrap">'+head+
    '<canvas class="trace" id="trace-canvas" width="560" height="300"></canvas>'+
    '<div class="trace-tools">'+
      '<button class="btn small" id="trace-clear">🧽 Стереть</button>'+
      '<button class="btn primary small" id="trace-done">Готово ✓</button>'+
      '<span class="trace-hint">Веди пальчиком или мышкой по пунктиру, не отрываясь</span>'+
    '</div></div></div>';
  feedback(it.kind==='write'?'Напиши букву на память — обводить не надо':'Веди линию по пунктиру, потом «Готово»','soft');
  renderProgress();
  setupTrace(it);
  speak(it.speak);
}
function setupTrace(it){
  const cv=$('#trace-canvas'); if(!cv) return;
  const W=560,H=300;
  const off=document.createElement('canvas'); off.width=W; off.height=H;
  const oc=off.getContext('2d');
  oc.fillStyle='#000';
  oc.textAlign='center'; oc.textBaseline='alphabetic';
  const top=80, bottom=250, marginX=60;
  const cx=(marginX+W)/2;
  if(it.kind==='grid'){
    oc.lineWidth=24; oc.strokeStyle='#000'; oc.lineCap='round'; oc.lineJoin='round';
    drawGridPath(oc, it.d);
  }
  else if(it.kind==='path'){
    oc.lineWidth=26; oc.strokeStyle='#000'; oc.lineCap='round'; oc.lineJoin='round';
    drawPattern(oc,it.id,W,H,top,bottom,marginX);
  } else {
    const size=(bottom-top)/0.72;
    oc.font='700 '+Math.floor(size)+'px "Segoe UI", Arial, sans-serif';
    oc.fillText(it.letter, cx, bottom-2);
  }
  const img=oc.getImageData(0,0,W,H).data;
  const mask=new Uint8Array(W*H); let maskCount=0;
  for(let p=3;p<img.length;p+=4){ if(img[p]>60){ const i=(p-3)/4; mask[i]=1; maskCount++; } }

  const ctx=cv.getContext('2d');
  cv.width=W; cv.height=H;
  T={ cv:cv, ctx:ctx, W:W, H:H, mask:mask, maskCount:maskCount, covered:new Uint8Array(W*H), coveredCount:0,
      drawn:0, onTrack:0, drawing:false, guide:false, it:it, top:top, bottom:bottom, marginX:marginX, cx:cx };
  paintTraceBase();
  drawGuide();

  const toXY=e=>{ const r=cv.getBoundingClientRect();
    const cxp=(e.touches?e.touches[0].clientX:e.clientX)-r.left;
    const cyp=(e.touches?e.touches[0].clientY:e.clientY)-r.top;
    return { x:cxp*(W/r.width), y:cyp*(H/r.height) }; };

  const down=e=>{ e.preventDefault(); ac(); T.drawing=true; const p=toXY(e); T.last=p; mark(p); strokeTo(p,p); };
  const move=e=>{ if(!T.drawing) return; e.preventDefault(); const p=toXY(e); strokeTo(T.last,p); mark(p); T.last=p; };
  const up=()=>{ T.drawing=false; };
  cv.addEventListener('pointerdown',down);
  cv.addEventListener('pointermove',move);
  window.addEventListener('pointerup',up);
  T.off=[[cv,'pointerdown',down],[cv,'pointermove',move],[window,'pointerup',up]];
  $('#trace-clear').onclick=()=>{ paintTraceBase(); drawGuide(); T.covered=new Uint8Array(W*H); T.coveredCount=0; T.drawn=0; T.onTrack=0; };
  $('#trace-done').onclick=()=>gradeTrace();
}
function paintTraceBase(){
  const {ctx,W,H,top,bottom,marginX}=T;
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,W,H);
  if(T.it.kind==='grid'){ drawPaper(ctx,W,H); return; }
  ctx.strokeStyle='#cfe0f5'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(16,top); ctx.lineTo(W-16,top); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(16,bottom); ctx.lineTo(W-16,bottom); ctx.stroke();
  const mid=(top+bottom)/2;
  ctx.setLineDash([7,7]); ctx.strokeStyle='#e3e9f2';
  ctx.beginPath(); ctx.moveTo(16,mid); ctx.lineTo(W-16,mid); ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle='#f3b6c2'; ctx.beginPath(); ctx.moveTo(marginX,18); ctx.lineTo(marginX,H-18); ctx.stroke();
  /* для «напиши сам» показываем очень бледную букву-образец: ребёнок видит, куда писать */
  if(T.it.kind==='write'){
    ctx.save(); ctx.globalAlpha=.14; ctx.fillStyle='#6b6480';
    ctx.textAlign='center'; ctx.textBaseline='alphabetic';
    const size=(bottom-top)/0.72;
    ctx.font='700 '+Math.floor(size)+'px "Segoe UI", Arial, sans-serif';
    ctx.fillText(T.it.letter,(marginX+W)/2,bottom-2);
    ctx.restore();
  }
}
function drawGuide(){
  if(!T) return;
  const {ctx,W,mask,maskCount,it}=T;
  if(it.kind==='write'){ return; }
  ctx.fillStyle='#c8c3d9';
  const step = it.kind==='path'?11:7;
  for(let y=0;y<T.H;y+=step){
    for(let x=0;x<W;x+=step){
      if(mask[y*W+x]){ ctx.beginPath(); ctx.arc(x,y,2.1,0,6.283); ctx.fill(); }
    }
  }
  T.guide=true;
}
function showTraceGuide(){ if(T) drawGuideSoft(); }
function drawGuideSoft(){
  if(!T) return;
  const {ctx,W,mask,it}=T;
  if(it.kind==='write'){
    /* подсказка: образец становится заметнее, но всё равно прозрачнее написанного */
    ctx.save(); ctx.globalAlpha=.42; ctx.fillStyle='#4b8ef1';
    const size=(T.bottom-T.top)/0.72;
    ctx.textAlign='center'; ctx.textBaseline='alphabetic';
    ctx.font='700 '+Math.floor(size)+'px "Segoe UI", Arial, sans-serif';
    ctx.fillText(it.letter, T.cx, T.bottom-2);
    ctx.restore();
  } else drawGuide();
}
function strokeTo(a,b){
  const {ctx}=T;
  ctx.strokeStyle='#2f6fd0'; ctx.lineWidth=9; ctx.lineCap='round'; ctx.lineJoin='round';
  ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
}
function mark(p){
  const {W,H,mask,covered}=T;
  const r=9;
  T.drawn++;
  let near=false;
  const x0=Math.max(0,Math.floor(p.x-r-14)), x1=Math.min(W-1,Math.ceil(p.x+r+14));
  const y0=Math.max(0,Math.floor(p.y-r-14)), y1=Math.min(H-1,Math.ceil(p.y+r+14));
  for(let y=y0;y<=y1;y++){
    for(let x=x0;x<=x1;x++){
      const dx=x-p.x, dy=y-p.y, d2=dx*dx+dy*dy;
      if(d2>r*r) continue;
      const i=y*W+x;
      if(mask[i] && !covered[i]){ covered[i]=1; T.coveredCount++; }
    }
    /* рядом с буквой — проверяется ниже */
  }
  /* рядом с линией буквы? (в расширенной зоне) */
  const ax0=Math.max(0,Math.floor(p.x-r-16)), ax1=Math.min(W-1,Math.ceil(p.x+r+16));
  const ay0=Math.max(0,Math.floor(p.y-r-16)), ay1=Math.min(H-1,Math.ceil(p.y+r+16));
  outer:
  for(let y=ay0;y<=ay1;y++){
    for(let x=ax0;x<=ax1;x++){
      if(mask[y*W+x]){ near=true; break outer; }
    }
  }
  if(near) T.onTrack++;
}
function gradeTrace(){
  if(!T) return;
  const cov = T.maskCount? T.coveredCount/T.maskCount : 0;
  const acc = T.drawn? T.onTrack/T.drawn : 0;
  if(T.drawn<10){ feedback('Проведи линию по букве, потом нажми «Готово»','soft'); speak('Проведи по букве, потом нажми готово'); return; }
  const val = (cov>=0.5 && acc>=0.55)?1 : ((cov>=0.3 || acc>=0.8)?0.6:0);
  const what = (T.it.kind==='grid') ? 'линия' : (T.it.kind==='path' ? 'дорожка' : 'буква');
  const verb = (T.it.kind==='grid'||T.it.kind==='path') ? 'проведи' : 'обведи';
  R.results.push(val);
  if(val===1){
    R.stars++; R.perfect=(R.perfect||0)+1; sndOk(); confetti(30); setMood('😍');
    feedback('Отлично! '+cap(what)+' почти целиком — '+Math.round(cov*100)+'%','good');
    say('good', fmt(pick(PRAISE)));
  } else if(val>=0.6){
    /* неполная, но старательная линия — тоже звезда и сердечко за старание */
    R.stars++; state.hearts=(state.hearts||0)+1; sndStar(); sparkleBurst(5); setMood('🥰');
    feedback('Хорошо! Закрыто '+Math.round(cov*100)+'% '+what+'. Веди линию чуть плотнее — и будет отлично.','soft');
    speak('Неплохо! Давай ещё раз, старательно.');
  } else {
    tone(523,.16,'sine',.1,0); tone(659,.18,'sine',.09,.13); setMood('🙂');
    feedback('Получилось '+Math.round(cov*100)+'%. '+cap(verb)+' '+what+' ещё разок — у тебя получится!','soft');
    speak('Почти! Попробуй '+verb+' '+what+' ещё разок, '+dative(state.name)+'.');
  }
  renderProgress(); renderRoundStars(); updateHeaderStats();
  stopTrace();
  T=null;
  setTimeout(()=>{
    R.idx++;
    if(R.idx>=R.items.length) finishRound();
    else renderTrace();
  },1300);
}
function stopTrace(){
  if(!T||!T.off) return;
  T.off.forEach(o=>{ try{ o[0].removeEventListener(o[1],o[2]); }catch(e){} });
}

/* ---------- дорожки-узоры ---------- */
function drawPattern(c,id,W,H,top,bottom,marginX){
  const x0=marginX+30, x1=W-30, mid=(top+bottom)/2, amp=(bottom-top)/2-22;
  c.beginPath();
  if(id==='wave'){
    c.moveTo(x0,mid);
    for(let x=x0;x<=x1;x+=2){ const y=mid+Math.sin((x-x0)/34)*amp; c.lineTo(x,y); }
  } else if(id==='zigzag'){
    const steps=8, w=(x1-x0)/steps;
    c.moveTo(x0,top+18);
    for(let i=1;i<=steps;i++){ c.lineTo(x0+w*i, i%2? bottom-18 : top+18); }
  } else if(id==='loops'){
    const loops=5, w=(x1-x0)/loops;
    c.moveTo(x0,bottom-24);
    for(let i=0;i<loops;i++){
      const bx=x0+w*i;
      c.bezierCurveTo(bx+w*0.15, bottom-24-amp*1.4, bx+w*0.55, bottom-24-amp*1.9, bx+w*0.62, mid-amp*0.4);
      c.bezierCurveTo(bx+w*0.66, bottom-24-amp*0.2, bx+w*0.9, bottom-24, bx+w, bottom-24);
    }
  } else { /* hills — верхние горки */
    const n=4, w=(x1-x0)/n;
    c.moveTo(x0,bottom-24);
    for(let i=0;i<n;i++){
      const bx=x0+w*i;
      c.lineTo(bx+w*0.2,bottom-24);
      c.bezierCurveTo(bx+w*0.3,top+16, bx+w*0.7,top+16, bx+w*0.8,bottom-24);
      c.lineTo(bx+w,bottom-24);
    }
  }
  c.stroke();
}

/* ============================================================
    Щадящая система наград: наклейки трёх цветов, сердечки,
    сундучок сюрпризов и полка медалей
    ============================================================ */
const TIER_CLS={ common:'', rare:'tier-rare', legend:'tier-legend' };
const TIER_NAME={ common:'наклейка в дневник 🏅', rare:'блестящая наклейка ✨', legend:'сказочная наклейка 👑' };
/* Пятёрка — наклейка всегда; четвёрка — часто; тройка — сердечки за старание.
   «Чистый» круг (без ошибок и подсказок) даёт блестящие и сказочные наклейки. */
function rollSticker(grade, clean){
  if(grade===3) return null;
  if(grade===4 && Math.random()>0.55) return null;
  const r=Math.random();
  let tier='common';
  if(grade===5){
    if(clean && r<0.28) tier='legend';
    else if(clean && r<0.65) tier='rare';
    else if(r<0.3) tier='rare';
  } else if(r<0.18) tier='rare';
  return { e:pick(STICKERS), tier:tier };
}

/* Сундучок открывается сам после каждой третьей пятёрки — всегда с сюрпризом */
const CHEST=[
  {e:'🎈', t:'Букет шариков!',           stars:4},
  {e:'🍭', t:'Сладкий сюрприз!',         stars:3},
  {e:'🦄', t:'Маленький единорог прискакал!', stars:5},
  {e:'🌟', t:'Звёздный дождик!',         stars:6},
  {e:'🌈', t:'Радуга — блестящая наклейка сверху!', stars:2, sticker:'rare'},
  {e:'🎀', t:'Бантик для Киры!',         stars:2, sticker:'rare'},
  {e:'👑', t:'Сказочная наклейка!',      stars:4, sticker:'legend'},
  {e:'🍓', t:'Ягодка за старание!',      stars:3},
  {e:'🐝', t:'Пчёлка принесла капельку мёда!', stars:3},
  {e:'💗', t:'Три сердечка за старание!', stars:1, hearts:3}
];
function bumpChest(){
  state.chestN=(state.chestN||0)+1;
  if(state.chestN<3) return null;
  state.chestN=0; state.chestOpens=(state.chestOpens||0)+1;
  const s=pick(CHEST);
  state.stars += (s.stars||0);
  if(s.hearts) state.hearts=(state.hearts||0)+s.hearts;
  if(s.sticker) state.stickers.push({ e:pick(STICKERS), tier:s.sticker });
  return s;
}

/* ---------- медали: их нельзя потерять, они остаются навсегда ---------- */
function n5(s){ return s.grades.filter(g=>g.grade===5).length; }
function nClean(s){ return s.grades.filter(g=>g.clean).length; }
function playedSubject(s, sid, min){
  const title=(SUBJECTS.filter(x=>x.id===sid)[0]||{}).title||'';
  return s.grades.some(g=>g.grade>=(min||1) && (g.sid===sid || g.subject===title));
}
const MEDALS=[
  {id:'first5',   e:'🌟', t:'Первая пятёрка',        d:'Кира получила первую пятёрку',              tier:'common', ok:s=>n5(s)>=1},
  {id:'five5',    e:'🏅', t:'Пять пятёрок',          d:'В дневнике 5 пятёрок',                      tier:'common', ok:s=>n5(s)>=5},
  {id:'ten5',     e:'🥇', t:'Десять пятёрок',        d:'В дневнике 10 пятёрок',                     tier:'rare',   ok:s=>n5(s)>=10},
  {id:'twenty5',  e:'🏆', t:'Двадцать пятёрок',      d:'В дневнике 20 пятёрок',                     tier:'legend', ok:s=>n5(s)>=20},
  {id:'clean',    e:'💎', t:'Без единой ошибки',     d:'Круг заданий без ошибок и без подсказок',   tier:'rare',   ok:s=>nClean(s)>=1},
  {id:'clean5',   e:'👑', t:'Пять чистых кругов',    d:'5 кругов без ошибок',                       tier:'legend', ok:s=>nClean(s)>=5},
  {id:'streak3',  e:'🔥', t:'Три дня подряд',        d:'Занимается 3 дня подряд',                   tier:'common', ok:s=>(s.streak||0)>=3},
  {id:'streak7',  e:'🔥', t:'Целая неделя занятий',  d:'Занимается 7 дней подряд',                  tier:'rare',   ok:s=>(s.streak||0)>=7},
  {id:'stars30',  e:'⭐', t:'30 звёздочек',          d:'В копилке 30 звёздочек',                    tier:'common', ok:s=>s.stars>=30},
  {id:'stars100', e:'🌠', t:'100 звёздочек',         d:'В копилке 100 звёздочек',                   tier:'rare',   ok:s=>s.stars>=100},
  {id:'hearts20', e:'💗', t:'20 сердечек',           d:'За старание собрано 20 сердечек',           tier:'common', ok:s=>(s.hearts||0)>=20},
  {id:'fixer',    e:'🛠', t:'Исправляешь ошибки',    d:'Сама исправила ошибки в 5 кругах',          tier:'common', ok:s=>s.grades.filter(g=>g.grade>=4 && g.hints>0).length>=5},
  {id:'stickers8',e:'🏆', t:'8 наклеек',             d:'На стене 8 наклеек',                        tier:'common', ok:s=>s.stickers.length>=8},
  {id:'shiny',    e:'✨', t:'Блестящая наклейка',    d:'В коллекции есть блестящая наклейка',       tier:'rare',   ok:s=>s.stickers.some(x=>x.tier==='rare')},
  {id:'legend',   e:'🦄', t:'Сказочная наклейка',    d:'В коллекции есть сказочная наклейка',       tier:'legend', ok:s=>s.stickers.some(x=>x.tier==='legend')},
  {id:'chest',    e:'🎁', t:'Сундучок открыт',       d:'Три пятёрки открыли сундучок',              tier:'common', ok:s=>(s.chestOpens||0)>=1},
  {id:'chest3',   e:'🎁', t:'Три сундучка',          d:'Открыто 3 сундучка с сюрпризами',           tier:'rare',   ok:s=>(s.chestOpens||0)>=3},
  {id:'reader',   e:'📖', t:'Читательница',          d:'Чтение: оценка 4 или 5',                    tier:'common', ok:s=>playedSubject(s,'read',4)},
  {id:'mathgirl', e:'🔢', t:'Математичка',           d:'Математика: оценка 4 или 5',                tier:'common', ok:s=>playedSubject(s,'math',4)},
  {id:'writer',   e:'✍️', t:'Аккуратные буквы',      d:'Прописи и рука: оценка 4 или 5',            tier:'common', ok:s=>playedSubject(s,'write',4)},
  {id:'pet',      e:'👣', t:'По ступенькам Петерсон',d:'Игра по методике Петерсон: оценка 4 или 5', tier:'rare',   ok:s=>s.grades.some(g=>g.pet && g.grade>=4)},
  {id:'sport',    e:'🤸', t:'Зарядка-чемпион',       d:'Сыграны зарядка или гимнастика для глазок', tier:'common', ok:s=>playedSubject(s,'health',3)},
  {id:'allthemes',e:'🌈', t:'Все темы сыграны',      d:'Кира сыграла во всех разделах',             tier:'legend', ok:s=>SUBJECTS.every(sub=>playedSubject(s,sub.id,1))},
  {id:'top',      e:'👑', t:'Почти первоклассница',  d:'Достигла верхнего уровня',                  tier:'legend', ok:s=>levelInfo().cur.xp>=LEVELS[LEVELS.length-1].xp}
];
function medalById(id){ return MEDALS.filter(m=>m.id===id)[0]; }
function checkMedals(){
  const got=[];
  MEDALS.forEach(m=>{
    if(state.medals.indexOf(m.id)>=0) return;
    let ok=false; try{ ok=m.ok(state); }catch(e){ ok=false; }
    if(ok){ state.medals.push(m.id); got.push(m); }
  });
  if(got.length) save();
  return got;
}
function celebrateMedals(list){
  if(!list.length) return;
  list.forEach(m=> toast('Новая медаль: '+m.t+' — '+m.d, m.e, 'medal'));
  confetti(80); sndFanfare(); setMood('🥳');
  speak('Кира получила новую медаль: '+list[0].t+'! Поздравляем, '+state.name+'!');
}

/* ------------------------------ итог раунда ------------------------------ */
/* Щадящая шкала оценки: пятёрка не требует «все пять с первого раза».
   Двойки нет вообще: тройка — это «старалась, давай повторим». */
function gradeFromPct(pct){
  if(pct>=0.85) return 5;
  if(pct>=0.6)  return 4;
  return 3;
}
function finishRound(preset){
  if(R.finished) return;
  R.finished=true;
  const got = (R.got!==null? R.got : R.results.reduce((a,b)=>a+b,0));
  const max = R.max || QUESTIONS;
  const pct = got/max;
  const grade = gradeFromPct(pct);
  /* «чистый» круг — всё с первого раза и без подсказок: за него блестящие и сказочные наклейки */
  const clean = R.hints===0 && (R.perfect||0)>=R.results.length && pct>=0.9 && R.results.length>0;
  const record={ d:new Date().toISOString(), subject:R.sub.title, game:R.game.title, grade:grade,
                 stars:R.stars, hints:R.hints, kind:R.kind, sid:R.sub.id, pet:!!R.game.pet, clean:clean };
  state.grades.push(record);
  state.stars += R.stars;
  state.stickers = state.stickers||[];

  const sticker = rollSticker(grade, clean);
  if(sticker) state.stickers.push(sticker);
  const hearts = grade===3 ? 2 : (clean ? 2 : 1);
  state.hearts=(state.hearts||0)+hearts;
  const chest = grade===5 ? bumpChest() : null;

  const best=state.best[R.game.id];
  if(!best || best.grade<grade || (best.grade===grade && (best.stars||0)<R.stars)) state.best[R.game.id]={grade:grade,stars:R.stars};
  if(state.day!==todayKey()){ state.day=todayKey(); state.dayRounds=0; }
  state.dayRounds++; state._extra=false;
  bumpStreak(); addXp(xpForGrade(grade, R.stars)); checkDaily(grade);
  const newMedals = checkMedals();
  save(); updateHeaderStats();

  /* озвучка и показ */
  const dg=dative(state.name);
  const gEl=$('#res-grade'); gEl.textContent=grade;
  gEl.className='biggrade'+(grade===5?'':(grade===4?' g4':' g3'));
  if(grade===5){
    $('#res-title').textContent = dg+', пятёрка!';
    $('#res-text').textContent = clean
      ? 'Ни одной ошибки и без подсказок — это настоящая отличница! ✨'
      : 'Ты справилась'+(R.hints?' и сама всё проверила по подсказке':' и исправила ошибки')+
        ' — так учатся настоящие ученики. В дневник приклеена наклейка.';
    sndFanfare(); confetti(clean?200:150); sparkleBurst(clean?18:10); setMood('🤩');
    say('pyaterka', dg+', пятёрка! Умница, '+state.name+'! Так держать!');
  } else if(grade===4){
    $('#res-title').textContent = 'Четвёрка! Молодец, '+state.name+'!';
    $('#res-text').textContent = 'Хороший результат: до пятёрки всего один-два верных ответа. Ты уже очень близко!';
    confetti(70); tone(659,.2,'sine',.15,0); tone(880,.22,'sine',.13,.15); setMood('😃');
    say('four', 'Кира получила четвёрку! Молодец! Ещё чуть-чуть старания, и будет пятёрка.');
  } else {
    $('#res-title').textContent = 'Тройка — и это уже успех!';
    $('#res-text').textContent = 'Кира старалась и не бросила задание — за это '+hearts+' сердечка 💗 в копилку. '+
      'Давай повторим это же: в следующий раз получится больше. Ошибки — это нормально, так учатся все.';
    tone(523,.18,'sine',.12,0); tone(659,.2,'sine',.11,.14); setMood('😊');
    say('three', 'Тройка, но Кира большая молодец, что старалась. Давай повторим, и будет пятёрка!');
  }
  $('#res-stars').innerHTML = '⭐'.repeat(Math.min(5,R.stars)) + (hearts ? ' ' + '💗'.repeat(hearts) : '');
  const stEl=$('#res-sticker');
  stEl.innerHTML = sticker
    ? '<span class="sticker '+TIER_CLS[sticker.tier]+'">'+sticker.e+'</span><span class="note">'+TIER_NAME[sticker.tier]+'</span>'
    : '<span class="note">За пятёрку и четвёрку в дневник попадает наклейка 🏅 — ещё чуть-чуть, и она будет!</span>';
  const chEl=$('#res-chest');
  if(chest){
    chEl.classList.remove('hidden');
    chEl.textContent='🎁 Сундучок открылся: '+chest.t+'  +'+(chest.stars||0)+' ⭐'+(chest.hearts?('  +'+chest.hearts+' 💗'):'');
    confetti(90); sndFanfare(); toast('Сундучок: '+chest.t, '🎁', 'chest');
  } else chEl.classList.add('hidden');
  const mdEl=$('#res-medals');
  if(newMedals.length){
    mdEl.innerHTML=newMedals.map(m=>'<span class="medal-mini got'+(m.tier==='legend'?' legend':'')+'" title="'+m.d+'">'+m.e+' '+m.t+'</span>').join('');
    celebrateMedals(newMedals);
  } else mdEl.innerHTML='';
  $('#result').classList.remove('hidden');
  R._lastGrade=grade;
}
$('#res-close').addEventListener('click',()=>{ closeResult(); renderDiary(); showView('diary'); afterResultRest(); });
$('#res-next').addEventListener('click',()=>{ closeResult(); renderHub(); showView('hub'); afterResultRest(); });
$('#res-again').addEventListener('click',()=>{ const sub=R.sub,g=R.game; closeResult(); startGame(sub,g); });
function closeResult(){ $('#result').classList.add('hidden'); }
/* что делать, когда сыграно 4 игры: показать окно отдыха или не мешать вовсе */
function restPolicy(){
  if(!state.limit) return 'none';
  if(state.dayRounds<4) return 'none';
  return (state.restNag===false) ? 'quiet' : 'modal';
}
function afterResultRest(){
  if(restPolicy()==='modal') showRest();
}
$('#btn-sound').addEventListener('click',()=>{
  state.sound=!state.sound; save(); paintSoundBtn();
  if(state.sound){ ac(); sndStar(); speak('Звук включён. Учимся дальше, '+state.name+'!'); }
  else { try{ window.speechSynthesis.cancel(); }catch(e){} }
});
function paintSoundBtn(){ $('#btn-sound').textContent = state.sound?'🔊 Звук вкл.':'🔇 Звук выкл.'; }

function showRest(){
  const fives=state.grades.filter(g=>g.grade===5).length;
  $('#rest-title').textContent=state.name+' сегодня большая молодец!';
  $('#rest-text').textContent='Сыграно игр сегодня: '+state.dayRounds+', пятёрок у Киры уже '+fives+
    ', сердечек за старание '+(state.hearts||0)+'. Глазкам нужен отдых: попрыгай, попей водички, порисуй. '+
    'Завтра будет ещё больше пятёрок!';
  $('#rest').classList.remove('hidden');
  say('rest', 'Хватит играть, глазкам нужен отдых. Завтра будет ещё больше пятёрок!');
}
$('#rest-ok').addEventListener('click',()=>{ $('#rest').classList.add('hidden'); renderHub(); showView('hub'); });
$('#rest-more').addEventListener('click',()=>{ state._extra=true; $('#rest').classList.add('hidden'); renderHub(); showView('hub'); });

/* ------------------------------ дневник ------------------------------ */
function updateHeaderStats(){
  $('#stars-count').textContent=state.stars;
  const h=$('#hearts-count'); if(h) h.textContent=(state.hearts||0);
  $('#sticker-count').textContent=(state.stickers||[]).length;
}
/* стена наклеек по цветам «блеска»: обычные, блестящие, сказочные */
function stickerGroups(){
  return [['common','Обычные'],['rare','Блестящие ✨'],['legend','Сказочные 👑']].map(pair=>{
    const tier=pair[0], label=pair[1];
    const items=(state.stickers||[]).filter(s=>((s && s.tier)||'common')===tier);
    if(!items.length) return '';
    return '<div class="sticker-group"><span class="sg-title">'+label+' · '+items.length+'</span>'+
      items.map(s=>'<span class="sticker '+TIER_CLS[tier]+'">'+s.e+'</span>').join('')+'</div>';
  }).join('');
}
/* полка медалей: в дневнике — все медали (полученные и те, что ещё ждут),
   на главной — только полученные */
function medalShelf(el, onlyGot){
  if(!el) return;
  const got=state.medals||[];
  if(onlyGot){
    el.innerHTML = got.length
      ? '<span class="hm-label">Медали Киры:</span>'+got.map(id=>{
          const m=medalById(id); if(!m) return '';
          return '<span class="medal-mini got'+(m.tier==='legend'?' legend':'')+'" title="'+m.d+'">'+m.e+' '+m.t+'</span>';
        }).join('')
      : '<span class="hm-empty">Медали появятся за первые успехи — медаль «Первая пятёрка» уже совсем близко 🌟</span>';
    return;
  }
  el.innerHTML = MEDALS.map(m=>{
    const has=got.indexOf(m.id)>=0;
    return '<div class="medal-chip'+(has?' got':'')+(m.tier==='legend'?' legend':'')+'">'+
      '<span class="m-e">'+(has?m.e:'🔒')+'</span><span class="m-t">'+m.t+'</span>'+
      '<span>'+m.d+'</span></div>';
  }).join('');
}
function renderDiary(){
  updateHeaderStats();
  const gs=state.grades;
  const fives=gs.filter(g=>g.grade===5).length, fours=gs.filter(g=>g.grade===4).length;
  const avg = gs.length? (gs.reduce((a,b)=>a+b.grade,0)/gs.length).toFixed(2) : '—';
  $('#diary-stats').innerHTML=
    stat(gs.length,'иг сыграно')+stat(fives,'пятёрок')+stat(fours,'четвёрок')+
    stat(state.stars,'звёздочек ⭐','gold')+stat((state.hearts||0),'сердечек 💗')+
    stat((state.stickers||[]).length,'наклеек 🏅','mint')+
    stat((state.medals||[]).length+' из '+MEDALS.length,'медалей 🏆','sky')+
    stat(avg,'средняя оценка');
  medalShelf($('#medal-shelf'), false);
  const wall=$('#sticker-wall');
  const groups=stickerGroups();
  wall.innerHTML = groups ||
    '<div class="sticker-empty">Наклейки появятся, когда Кира получит первую пятёрку — они бывают обычные, блестящие ✨ и сказочные 👑.</div>';
  const t=$('#diary-table');
  if(!gs.length){ t.innerHTML='<tr><td class="empty-note">Пока пусто. Сыграй в любую игру — и сюда поставят оценку.</td></tr>'; return; }
  const rows=gs.slice().reverse().map(g=>
    '<tr><td>'+dateLabel(g.d)+'</td><td>'+g.subject+'</td><td>'+g.game+'</td>'+
    '<td class="grade g'+g.grade+'">'+g.grade+'</td><td>'+(g.stars?'⭐'.repeat(Math.min(5,g.stars)):'')+'</td>'+
    '<td>'+(g.clean?'без ошибок ✨':(g.hints?('подсказок: '+g.hints):'старалась'))+'</td></tr>').join('');
  t.innerHTML='<tr><th>Дата</th><th>Раздел</th><th>Игра</th><th>Оценка</th><th>Звёзды</th><th>Как старалась</th></tr>'+rows;
}
function stat(v,l,cls){
  return '<div class="stat'+(cls?(' '+cls):'')+'"><div class="stat-val">'+v+'</div><div class="stat-lbl">'+l+'</div></div>';
}
$('#btn-print').addEventListener('click',()=>{ renderDiary(); showView('diary'); setTimeout(()=>window.print(),250); });
$('#btn-clear-diary').addEventListener('click',()=>{
  if(!confirm('Удалить все оценки, наклейки, сердечки и медали? Звёздочки и уровень тоже обнулятся.')) return;
  state.grades=[]; state.stickers=[]; state.best={}; state.stars=0; state.hearts=0;
  state.medals=[]; state.chestN=0; state.chestOpens=0;
  state.xp=0; state.streak=0; state.streakGap=0; state.lastDay=null; state.daily={date:'', game:'', done:false};
  save(); updateHeaderStats(); paintLevel(); renderDiary(); renderHub();
});

/* ------------------------------ взрослым ------------------------------ */
function renderAdults(){
  $('#set-name').value=state.name;
  $('#set-diff').value=state.diff;
  $('#set-sound').checked=!!state.sound;
  $('#set-limit').checked=!!state.limit;
  const restChk=$('#set-restnag'); if(restChk) restChk.checked = state.restNag!==false;
  const limitLbl = restChk && restChk.closest('.check');
  if(limitLbl) limitLbl.previousElementSibling.style.opacity = (state.restNag===false)?'.62':'1';
  $('#set-foreign').checked=!!state.speakForeign;
  $('#set-sparkle').checked=!!state.sparkles;
  fillVoiceList();
  paintClipList();
  const rl=$('#set-rate'); if(rl) rl.value=Number(state.voiceRate)||0.93;
  const rv=$('#rate-val'); if(rv) rv.textContent=rateWord(state.voiceRate);
  $('#voice-info').textContent=voiceInfoText();
  applyUI();
  $('#plan-table').innerHTML='<tr><th>День</th><th>Занятие 1</th><th>Занятие 2</th><th>Занятие 3</th></tr>'+
    PLAN.map(r=>'<tr>'+r.map((c,i)=>'<td>'+c+'</td>').join('')+'</tr>').join('');
  $('#book-table').innerHTML='<tr><th>Пособие</th><th>Чему учит</th><th>Игра на сайте</th></tr>'+
    BOOKS.map(r=>'<tr><td>'+r[0]+'<br><small style="color:#8a7fb0">'+(r[3]||'')+'</small></td><td>'+r[1]+'</td><td>'+r[2]+'</td></tr>').join('');
  $('#bookmap-table').innerHTML='<tr><th>Занятия книги</th><th>Страницы</th><th>Чему учит занятие</th><th>Игры на сайте</th></tr>'+
    BOOK_MAP.map(r=>'<tr><td><b>'+r[0]+'</b></td><td>с. '+r[1]+'</td><td>'+r[2]+'</td><td>'+r[3]+'</td></tr>').join('');
  const bm=$('#bookmap-table');
  if(bm && bm.parentNode && !document.getElementById('pet-note')){
    const p=document.createElement('p'); p.id='pet-note'; p.className='pet-note';
    p.textContent='Игры по методике Л. Г. Петерсон разложены по обычным темам: 🔢 Математика, 🧠 Логика и память, 🔤 Азбука и грамотея, 🌍 Мир вокруг, ✍️ Прописи и рука и 📐 Линии, фигуры и углы. Все эти игры помечены значком 👣 «по Петерсон» — их '+allGames().filter(x=>x.g.pet).length+', и на главной есть фильтр «Только по Петерсон».';
    bm.parentNode.insertBefore(p, bm);
  }
  /* вторая карта книги: тетрадь «Игралочка», часть 3 (данные в data4.js) */
  const ig=$('#igmap-table');
  if(ig && typeof IGR_MAP !== 'undefined'){
    ig.innerHTML='<tr><th>Занятия тетради</th><th>Страницы</th><th>Чему учит занятие</th><th>Игры на сайте</th></tr>'+
      IGR_MAP.map(r=>'<tr><td><b>'+r[0]+'</b></td><td>с. '+r[1]+'</td><td>'+r[2]+'</td><td>'+r[3]+'</td></tr>').join('');
  }
  const sk=$('#skills-list');
  sk.innerHTML=SKILLS.map((s,i)=>
    '<label class="check"><input type="checkbox" data-i="'+i+'" '+(state.skills[i]?'checked':'')+'> '+s+'</label>').join('');
  sk.querySelectorAll('input').forEach(inp=>inp.addEventListener('change',()=>{
    state.skills[inp.dataset.i]=inp.checked; save();
  }));
}
$('#set-name').addEventListener('input',e=>{
  state.name=(e.target.value||'Кира').trim()||'Кира';
  $('#kid-name-top').textContent=state.name; $('#kid-name-hero').textContent=state.name; save();
});
$('#set-diff').addEventListener('change',e=>{ state.diff=e.target.value; save(); renderHub(); speak('Уровень: '+state.diff); });
$('#set-sound').addEventListener('change',e=>{ state.sound=e.target.checked; save(); paintSoundBtn(); });
$('#set-limit').addEventListener('change',e=>{ state.limit=e.target.checked; save(); });
$('#set-restnag').addEventListener('change',e=>{
  state.restNag=e.target.checked; save();
  $('#set-limit').closest('.check').style.opacity = state.restNag? '1' : '.62';
  const info=$('#voice-info');
  if(info) info.textContent = state.restNag
    ? '🔉 Напоминание об отдыхе включено: после 4 игр подряд Кира увидит окно «глазкам нужен отдых» и услышит голосок.'
    : '🙂 Напоминание об отдыхе выключено: окно после 4 игр появляться не будет. Ограничение «не больше 4 игр» при этом можно оставить включённым — счётчик игр в дневнике продолжает работать.';
});
$('#set-foreign').addEventListener('change',e=>{ state.speakForeign=e.target.checked; save(); });
function rateWord(r){
  const x=Number(r)||0.93;
  if(x<=0.7) return 'совсем медленно';
  if(x<=0.85) return 'медленно';
  if(x<=1.0) return 'обычным темпом';
  return 'быстро';
}
function unlockSpeech(){ try{ window.speechSynthesis.resume(); }catch(e){} }
$('#btn-voice-test').addEventListener('click',()=>{
  ac(); unlockSpeech(); state.sound=true; save(); paintSoundBtn();
  const cb=$('#set-sound'); if(cb) cb.checked=true;
  speak('Кире, пятёрка! Умница, '+state.name+'!', true);
  if(!pickVoice()){
    $('#voice-info').textContent='🔉 Русский голос не найден: прозвучал только субтитр «Кире, пятёрка!». '+
      (HOWTO[speechPlatform()]||'')+' Либо включите галочку «Озвучивать даже без русского голоса».';
  }
});
(function wireVoiceControls(){
  const sel=$('#set-voice');
  if(sel){
    sel.addEventListener('change',e=>{
      state.voiceName=e.target.value||''; save(); unlockSpeech();
      $('#voice-info').textContent=voiceInfoText();
      ac(); state.sound=true; save(); paintSoundBtn();
      const cb=$('#set-sound'); if(cb) cb.checked=true;
      speak('Кире, пятёрка! Тебе нравится, как я говорю?', true);
    });
  }
  const rl=$('#set-rate');
  if(rl){
    rl.addEventListener('input',e=>{ state.voiceRate=Number(e.target.value)||0.93; save();
      const rv=$('#rate-val'); if(rv) rv.textContent=rateWord(state.voiceRate); });
    rl.addEventListener('change',()=>{ ac(); unlockSpeech(); speak('Привет, '+state.name+'! Кире, пятёрка!', true); });
  }
  const pv=$('#btn-voice-preview');
  if(pv) pv.addEventListener('click',()=>{
    ac(); unlockSpeech(); state.sound=true; save(); paintSoundBtn();
    const cb=$('#set-sound'); if(cb) cb.checked=true;
    speak('Кире, пятёрка! Молодец, '+state.name+'! Солнышко светит, а мы учимся дальше.', true);
    $('#voice-info').textContent=voiceInfoText();
  });
  const rf=$('#btn-voice-refresh');
  if(rf) rf.addEventListener('click',()=>{
    voicePolls=0; watchVoices();
    setTimeout(()=>{ $('#voice-info').textContent=voiceInfoText(); }, 900);
  });
})();
$('#btn-reset').addEventListener('click',()=>{
  if(!confirm('Сбросить весь прогресс: оценки, звёздочки, наклейки, сердечки, медали и галочки умений?')) return;
  const keep={ name:state.name, sound:state.sound, diff:state.diff, limit:state.limit,
               restNag:state.restNag, speakForeign:state.speakForeign, sparkles:state.sparkles,
               voiceName:state.voiceName, voiceRate:state.voiceRate,
               ui:Object.assign({}, DEF.ui, state.ui||{}) };
  state=Object.assign({},DEF,keep);
  state.stickers=[]; state.medals=[]; state.grades=[]; state.best={}; state.skills={};
  save(); applyUI(); updateHeaderStats(); paintLevel(); renderAdults(); renderDiary(); renderHub();
});

/* ------------------------------ старт ------------------------------ */
function feedback(text,cls){
  const f=$('#feedback'); f.textContent=text; f.className='feedback '+(cls||'');
}
/* запуск программы — в самом конце файла, когда объявлены все данные */

/* ============================================================
   ДОПОЛНЕНИЕ: программа Петерсон, новые игры, уровни, блёстки
   ============================================================ */

/* ---------- уровни и опыт ----------
   Уровни наступают чаще и никогда не откатываются назад: опыт только растёт. */
const LEVELS=[
  {xp:0,    name:'🌱 Новенькая',            medal:'🌱'},
  {xp:25,   name:'🌸 Ученица',              medal:'🌸'},
  {xp:60,   name:'💗 Хорошая ученица',      medal:'💗'},
  {xp:110,  name:'⭐ Звёздочка',            medal:'⭐'},
  {xp:180,  name:'🦄 Умница-единорог',      medal:'🦄'},
  {xp:260,  name:'🌈 Волшебница',           medal:'🌈'},
  {xp:360,  name:'👑 Почти первоклассница', medal:'👑'}
];
function levelInfo(){
  let cur=LEVELS[0], next=null, idx=0;
  for(let i=0;i<LEVELS.length;i++){ if(state.xp>=LEVELS[i].xp){ cur=LEVELS[i]; next=LEVELS[i+1]||null; idx=i; } }
  return {cur:cur, next:next, idx:idx};
}
function yesterdayKey(){ const d=new Date(); d.setDate(d.getDate()-1); return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); }
function parseDay(k){ const p=String(k).split('-'); return new Date(Number(p[0]), Number(p[1])-1, Number(p[2])); }
function dayDiff(aKey,bKey){ return Math.round((parseDay(bKey)-parseDay(aKey))/86400000); }
function paintLevel(){
  const li=levelInfo();
  const nm=$('#level-name'), xpT=$('#level-xp'), fill=$('#xp-fill'), medal=$('#hero-medal');
  if(nm) nm.textContent=li.cur.name+' · уровень '+(li.idx+1)+' из '+LEVELS.length;
  if(medal) medal.textContent=li.cur.medal;
  if(li.next){
    const span=li.next.xp-li.cur.xp, done=state.xp-li.cur.xp;
    if(xpT) xpT.textContent=done+' / '+span+' XP · до «'+li.next.name+'»';
    if(fill){ fill.style.width=Math.max(3, Math.min(100, Math.round(done/span*100)))+'%'; fill.classList.remove('full'); }
  } else {
    if(xpT) xpT.textContent='Все уровни получены! '+state.xp+' XP';
    if(fill){ fill.style.width='100%'; fill.classList.add('full'); }
  }
}
function addXp(n, why){
  const before=levelInfo().cur;
  state.xp=(state.xp||0)+n;
  const after=levelInfo().cur;
  if(after.xp>before.xp){
    confetti(140); sndFanfare(); sparkleBurst(14);
    toast('Новый уровень: '+after.name+'! (+'+(after.xp-before.xp)+' XP)', '🎉');
    say('level', 'Кира получила новый уровень: '+after.name.replace(/^\S+\s/,'')+'! Так держать!');
    setMood('🤩');
  }
  paintLevel();
}
/* Щадящая серия дней: один день отдыха не сжигает серию, она «замораживается» на 🛡 */
function bumpStreak(){
  const k=todayKey();
  if(state.lastDay===k) return;
  if(!state.lastDay){ state.streak=1; state.streakGap=0; }
  else if(state.lastDay===yesterdayKey()){ state.streak=(state.streak||0)+1; state.streakGap=0; }
  else if(state.streakGap<1 && dayDiff(state.lastDay,k)<=2){
    state.streakGap=1;
    toast('Серия не сгорела: вчера Кира отдыхала 🛡 Серия '+(state.streak||1)+' дн.', '🔥');
  } else { state.streak=1; state.streakGap=0; }
  state.lastDay=k;
  if(state.streak>=3){ toast('Серия дней: '+state.streak+'! Кира занимается каждый день', '🔥'); }
  save();
}

/* ---------- тосты (мелкие приятные сообщения) ---------- */
function toast(text, emoji, cls){
  const box=$('#toasts'); if(!box) return;
  const t=document.createElement('div'); t.className='toast'+(cls?(' '+cls):'');
  t.innerHTML='<span>'+(emoji||'💗')+'</span> '+text;
  box.appendChild(t);
  setTimeout(()=>{ t.classList.add('out'); setTimeout(()=>t.remove(),400); }, 3600);
}

/* ---------- блёстки под курсором ---------- */
const SPK=['✨','💗','⭐','🌸','💫','🎀','🦋'];
let spkLast=0;
document.addEventListener('pointermove', e=>{
  if(!state.sparkles) return;
  const now=Date.now(); if(now-spkLast<80) return; spkLast=now;
  const box=$('#sparkles'); if(!box) return;
  const s=document.createElement('span'); s.className='spk'; s.textContent=SPK[rnd(SPK.length)];
  s.style.left=(e.clientX+(Math.random()*22-11))+'px';
  s.style.top=(e.clientY+(Math.random()*22-11))+'px';
  s.style.fontSize=(13+Math.random()*14)+'px';
  box.appendChild(s);
  setTimeout(()=>s.remove(),1000);
},{passive:true});
function sparkleBurst(n){
  if(!state.sparkles) return;
  const box=$('#sparkles'); if(!box) return;
  const cx=window.innerWidth/2, cy=window.innerHeight*0.42;
  for(let i=0;i<(n||10);i++){
    const s=document.createElement('span'); s.className='spk burst'; s.textContent=SPK[rnd(SPK.length)];
    s.style.left=(cx+(Math.random()*260-130))+'px';
    s.style.top=(cy+(Math.random()*180-90))+'px';
    s.style.fontSize=(16+Math.random()*18)+'px';
    box.appendChild(s);
    setTimeout(()=>s.remove(),1200);
  }
}

/* ---------- настроение Киры ---------- */
function setMood(em){
  const m=$('#mood'); if(!m) return;
  m.textContent=em;
  m.classList.remove('pop'); void m.offsetWidth; m.classList.add('pop');
}

/* ============================================================
   Генераторы: математика по программе Л. Г. Петерсон
   ============================================================ */
GEN['pet.signs']=function(){
  let n=0;
  return function(){
    const attrs=['цвет','форма','размер'];
    const attr=attrs[n%3]; n++;
    const shapes4=P_SHAPES.filter(s=>s!=='овал');
    const colKeys=Object.keys(P_COLORS);
    let group, odd;
    if(attr==='цвет'){
      const col=pick(colKeys), sh=pickN(shapes4,4);
      group=[{shape:sh[0],color:col,big:true},{shape:sh[1],color:col,big:true},{shape:sh[2],color:col,big:true}];
      odd={shape:sh[3],color:pick(colKeys.filter(c=>c!==col)),big:true};
    } else if(attr==='форма'){
      const sh=pick(shapes4), cols=pickN(colKeys,4);
      group=[{shape:sh,color:cols[0],big:true},{shape:sh,color:cols[1],big:true},{shape:sh,color:cols[2],big:true}];
      odd={shape:pick(shapes4.filter(s=>s!==sh)),color:cols[3],big:true};
    } else {
      const sh=pickN(shapes4,4), col=pick(colKeys);
      group=[{shape:sh[0],color:col,big:true},{shape:sh[1],color:col,big:true},{shape:sh[2],color:col,big:true}];
      odd={shape:sh[3],color:col,big:false};
    }
    const items=group.concat([odd]);
    const opts=shuffle(items);
    const attrD = attr==='цвет' ? 'цвету' : (attr==='форма' ? 'форме' : 'размеру');
    return { speak:'Смотри на фигурки. По признаку «'+attr+'» три фигурки подходят друг другу, а одна — не подходит. Нажми на лишнюю фигурку.',
      prompt:'Что лишнее по '+attrD+'?',
      options:opts.map(o=>({html:pSvg(o.shape,o.color,o.big?96:58), cls:'pic-opt'})), answer:opts.indexOf(odd),
      hint:'Сравни фигурки только по '+attrD+': у трёх он одинаковый, а у этой — другой.' };
  };
};
GEN['pet.group']=function(){
  let bag=[]; let i=0;
  const refill=()=>{
    const which=Math.random()<.5;
    const a=shuffle(PET_ROUND).slice(0,3).map(x=>({t:x.t, emoji:x.e, cat:'a'}));
    const b=shuffle(PET_SQUARE).slice(0,3).map(x=>({t:x.t, emoji:x.e, cat:'b'}));
    bag=shuffle(a.concat(b)); i=0;
  };
  refill();
  return function(){
    if(i>=bag.length) refill();
    const it=bag[i++];
    return { speak:'Куда положить предмет: '+it.t+'? Если он круглый, без уголков — в первую корзинку. Если у него 4 уголка — во вторую.',
      item:{t:it.t, cat:it.cat, emoji:it.emoji},
      bins:[{id:'a',label:'Круглое · без уголков',emoji:'⭕'},{id:'b',label:'С углами · 4 уголка',emoji:'🟦'}],
      hint:'У предмета «'+it.t+'» '+(it.cat==='a'?'форма круглая, уголков нет — первая корзинка':'форма квадратная или прямоугольная, 4 уголка — вторая корзинка')+'.' };
  };
};
GEN['pet.space']=function(){
  const used={};
  return function(){
    let row,tries=0;
    do{ row=pick(PET_ROWS); tries++; }while(used[row.join()]&&tries<20); used[row.join()]=1;
    const r=shuffle(row.slice());
    const kinds=['справа','слева','между'];
    const kind=pick(kinds);
    let answer, prompt, speak, optsIdx;
    const rowHtml='<div class="pet-row big">'+r.map(x=>'<span>'+x+'</span>').join('')+'</div>';
    if(kind==='между'){
      const s=rnd(r.length-2);
      answer=r[s+1];
      prompt='Кто стоит между '+r[s]+' и '+r[s+2]+'?';
      speak='Рассмотри ряд предметов. Кто стоит между '+r[s]+' и '+r[s+2]+'? Тот, кто стоит сразу после одного и сразу перед другим.';
    } else {
      const anchorIdx = kind==='справа' ? rnd(r.length-1) : 1+rnd(r.length-1);
      const anchor=r[anchorIdx];
      answer = kind==='справа' ? r[anchorIdx+1] : r[anchorIdx-1];
      /* объясняем, где «право» и «лево»: ряд на экране читают как стоящий перед нами */
      prompt='Кто стоит '+kind+' от '+anchor+'? Право и лево смотрим на экране: самая левая картинка — слева.';
      speak='Рассмотри ряд предметов. Кто стоит '+kind+' от '+anchor+'? Лево и право считаем на экране: вот самая левая картинка, вот самая правая.';
    }
    const opts=shuffle([answer].concat(pickN(r.filter(x=>x!==answer), 2)));
    return { promptHtml:rowHtml,
      prompt:prompt, speak:speak,
      options:opts.map(o=>({t:o,cls:'emoji-opt'})), answer:opts.indexOf(answer),
      hint:'Считаем глазами: вот '+r.join(' '), hintRow:r };
  };
};
GEN['pet.ordinal']=function(){
  return function(){
    const r=shuffle(pick(PET_ROWS).slice());
    const idx=rnd(r.length);
    const askNumber=Math.random()<.5;
    if(askNumber){
      const opts=shuffle([idx+1].concat(pickN([1,2,3,4,5,6].filter(x=>x!==idx+1),2)));
      return { promptHtml:'<div class="pet-row big">'+r.map(x=>'<span>'+x+'</span>').join('')+'</div>',
        prompt:'Какой по счёту '+r[idx]+', если считать слева направо?',
        speak:'Какой по счёту предмет '+r[idx]+', если считать слева направо? Первый — это самый левый.',
        options:opts.map(o=>({t:String(o),cls:'text'})), answer:opts.indexOf(idx+1),
        hint:'Считаем слева: '+r.map((x,i)=>(i+1)+'-'+x).join(',  ')+'.' };
    }
    const opts=shuffle([r[idx]].concat(pickN(r.filter(x=>x!==r[idx]),2)));
    return { promptHtml:'<div class="pet-row big">'+r.map((x,i)=>'<span>'+(i===idx?'👉':'')+x+'</span>').join('')+'</div>',
      prompt:'Кто стоит '+ordName(idx+1)+', если считать слева направо?',
      speak:'Кто стоит '+ordName(idx+1)+', если считать слева направо? Первый — это самый левый.',
      options:opts.map(o=>({t:o,cls:'emoji-opt'})), answer:opts.indexOf(r[idx]),
      hint:ordName(idx+1)+' в этом ряду — это '+r[idx]+'.' };
  };
};
function ordName(n){ return ['первым','вторым','третьим','четвёртым','пятым','шестым'][n-1]||('номер '+n); }
GEN['pet.neighbors']=function(){
  const max=state.diff==='лёгкий'?10:20;
  return function(){
    const n=2+rnd(max-3);
    const before=Math.random()<.5;
    const ans=before? n-1 : n+1;
    const cands=[before? n+1 : n-1, n+2, n-2, ans+2, ans-2].filter(v=>v>=1&&v<=max&&v!==ans);
    const uniq=[]; cands.forEach(v=>{ if(uniq.indexOf(v)<0) uniq.push(v); });
    const opts=shuffle([ans].concat(pickN(uniq,2)));
    const words=(before?'до':'после')+' числа '+n;
    const lo=Math.max(1,n-2), hi=Math.min(max,n+2);
    const line=[]; for(let v=lo;v<=hi;v++) line.push(v===n?'('+n+')':v);
    return { prompt:'Какое число живёт '+words+'?',
      promptHtml:'<div class="numline">'+(before?'<b>?</b> <span class="nn-arrow">→</span> <b>'+n+'</b>':'<b>'+n+'</b> <span class="nn-arrow">→</span> <b>?</b>')+'</div>',
      speak:'Какое число живёт '+words+'? '+n+(before?' минус 1':' плюс 1')+'.',
      options:opts.map(o=>({t:String(o),cls:'text'})), answer:opts.indexOf(ans),
      hint:'Ряд рядом с '+n+': '+line.join(', ')+'. Стрелка '+(before?'идёт назад — это число перед '+n:'идёт вперёд — это число после '+n)+'. Числа от '+lo+' до '+hi+'.' };
  };
};
/* вариант ответа из трёх разных чисел (без повторов) */
function numOpts(ans, cands){
  const list=[ans];
  for(const c of cands){ if(list.length>=3) break; if(c>=0 && c!==ans && list.indexOf(c)<0) list.push(c); }
  let k=1;
  while(list.length<3){ const c=ans+k; if(c>0 && list.indexOf(c)<0) list.push(c); k++; }
  return shuffle(list);
}
GEN['pet.bonds']=function(){
  const max=state.diff==='лёгкий'?5:(state.diff==='средний'?7:10);
  return function(){
    const total=3+rnd(max-2);
    const a=1+rnd(total-2);
    const ans=total-a;
    const opts=numOpts(ans,[total, a, ans+1, ans+2, ans-1, ans+3]);
    const em=pick(COUNT_EMOJIS);
    return { prompt:'Сколько спряталось: '+total+' — это '+a+' и ещё сколько?',
      promptHtml:'<div class="bond"><span class="bwhole">'+total+'</span><span class="bplus">=</span><span class="bpart">'+a+'</span><span class="bplus">+</span><span class="bpart q">?</span></div>',
      speak:'Сколько спряталось? Число '+total+' — это '+a+' и ещё сколько?',
      options:opts.map(o=>({t:String(o),cls:'text'})), answer:opts.indexOf(ans),
      hint:'Всего '+total+', видно '+a+', значит спряталось '+ans+'.' };
  };
};
GEN['pet.diff']=function(){
  const max=state.diff==='лёгкий'?6:(state.diff==='средний'?8:10);
  return function(){
    let a=2+rnd(max-1), b=1+rnd(a-1);
    const diff=a-b;
    const askMore=Math.random()<.7;
    const ansNum=diff;   /* и в вопросе «на сколько больше», и в вопросе «на сколько меньше» ответ — разница */
    /* обманки держим около разницы: без чисел a и b, иначе ответ виден на картинке */
    const opts=numOpts(diff,[diff+1,diff-1,diff+2,diff-2,diff+3]);
    const em=pick(COUNT_EMOJIS), em2=pick(COUNT_EMOJIS);
    return { promptHtml:'<div class="cmp"><div><b>'+a+'</b><br>'+em.repeat(a)+'</div><div><b>'+b+'</b><br>'+em2.repeat(b)+'</div></div>',
      prompt: askMore? 'На сколько '+a+' больше, чем '+b+'?' : 'На сколько '+b+' меньше, чем '+a+'?',
      speak: askMore? 'На сколько '+a+' больше, чем '+b+'?' : 'На сколько '+b+' меньше, чем '+a+'?',
      options:opts.map(o=>({t:String(o),cls:'text'})), answer:opts.indexOf(ansNum),
      hint:'Считаем по одному: '+b+' из '+a+' убрали поровну — осталось '+diff+'. Значит '+a+' больше на '+diff+'.' };
  };
};
GEN['pet.parts']=function(){
  return function(){
    const shape=pick(['круг','квадрат']);
    const parts=Math.random()<.55?2:4;
    const colored=parts===4?1:1;
    const kind=state.diff==='лёгкий' ? 'parts' : (Math.random()<.6?'parts':'name');
    if(kind==='parts'){
      const opts=shuffle([parts].concat(pickN([2,3,4].filter(x=>x!==parts),2)));
      return { promptHtml:'<div class="shape-show">'+pDivided(shape,parts,'розовый',190)+'</div>',
        prompt:'На сколько равных частей разделили '+shape+'?',
        speak:'На сколько равных частей разделили '+shape+'? Части должны быть одинаковыми.',
        options:opts.map(o=>({t:String(o),cls:'text'})), answer:opts.indexOf(parts),
        hint:'Посчитай одинаковые части: их '+parts+'.' };
    }
    const name=parts===2?'половина':'четверть';
    const opts=shuffle([name].concat(pickN(['целое','половина','четверть','три части'].filter(x=>x!==name),2)));
    return { promptHtml:'<div class="shape-show">'+pDivided(shape,parts,'розовый',190)+'</div>',
      prompt:'Как называется закрашенная часть '+shape+'а?',
      speak:'Как называется закрашенная часть '+shape+'а?',
      options:opts.map(o=>({t:o,cls:'long'})), answer:opts.indexOf(name),
      hint:'Закрашена '+name+' — одна из '+parts+' равных частей.' };
  };
};
GEN['pet.table']=function(){
  return function(){
    const shapes=pickN(P_SHAPES.filter(s=>s!=='овал'),3);
    const colors=pickN(Object.keys(P_COLORS),3);
    const cells=[];
    for(let r=0;r<3;r++) for(let c=0;c<3;c++) cells.push({shape:shapes[r], color:colors[c]});
    const missing=8;
    const answer=cells[missing];
    const wrong=[{shape:shapes[0],color:colors[2]},{shape:shapes[2],color:colors[0]},{shape:shapes[1],color:colors[1]}]
      .filter(x=>!(x.shape===answer.shape&&x.color===answer.color));
    const opts=shuffle([answer].concat(pickN(wrong,2)));
    return { promptHtml:'<div class="pet-table">'+cells.map((x,i)=>
        '<div class="pc'+(i===missing?' emptycell':'')+'">'+(i===missing?'❔':pSvg(x.shape,x.color,52))+'</div>').join('')+'</div>',
      prompt:'Какая фигура пропущена в волшебном квадрате?',
      speak:'Рассмотри волшебный квадрат: в каждой строчке все фигурки одной формы, а в каждой колонке — одного цвета. Какая фигурка пропущена?',
      options:opts.map(o=>({html:pSvg(o.shape,o.color,68),cls:'pic-opt'})), answer:opts.indexOf(answer),
      hint:'Пустая клеточка — в нижней строчке справа. По строчкам форма одна: '+shapes[2]+'. По колонкам цвет один: '+colors[2]+'. Значит, пропущена '+colors[2]+' '+shapes[2]+'.' };
  };
};
GEN['pet.measure']=function(){
  /* мерка всегда короче ленты и берётся по несколько раз: 2, 3, 4 или 5 раз.
     Лента не длиннее 10 клеток — иначе полоса не помещается на экране. */
  const steps=[[2,4],[2,6],[2,8],[2,10],[3,6],[3,9],[4,8],[5,10]];
  const kl=n=>(n===1?'клетка':(n<5?'клетки':'клеток'));
  return function(){
    const st=pick(steps), unit=st[0], total=st[1];
    const ans=total/unit;
    /* НЕ берём в варианты число клеток мерки и число клеток ленты:
       пятилетка тыкнет в то, что видит на картинке, а не отмерит. */
    const cands=[];
    for(let d=1; d<=4; d++){ [ans+d, ans-d].forEach(v=>{
      if(v>0 && v!==ans && v!==unit && v!==total && cands.indexOf(v)<0) cands.push(v);
    }); }
    const opts=shuffle([ans].concat(pickN(cands,2)));
    return { promptHtml:'<div class="ruler"><div class="ruler-strip" style="--cells:'+total+'"></div>'+
             '<div class="ruler-unit" style="--cells:'+unit+'">мерка = '+unit+' '+kl(unit)+'</div></div>',
      prompt:'Сколько раз мерка укладывается в розовую ленту?',
      speak:'Сколько раз мерка длиной в '+unit+' '+kl(unit)+' укладывается в ленту длиной в '+total+' '+kl(total)+'?',
      options:opts.map(o=>({t:String(o),cls:'text'})), answer:opts.indexOf(ans),
      hint:'Отмеряй мерку по очереди, начиная с левого края ленты: '+Array.from({length:ans},(_,i)=>unit*(i+1)).join(', ')+'. Всего '+ans+' '+(ans===1?'раз':(ans<=4?'раза':'раз'))+'.' };
  };
};
GEN['pet.time']=function(){
  const used={};
  return function(){
    let it,tries=0; do{ it=pick(TIME_ORDER); tries++; }while(used[it.q]&&tries<30); used[it.q]=1;
    const opts=shuffle([it.a,it.b]);
    return { promptHtml:'<div class="cmp big">'+opts.map(x=>'<div>'+x+'</div>').join('')+'</div>',
      prompt:it.q, speak:it.q+' Нажми на то, что было раньше.',
      options:opts.map(o=>({t:o,cls:'emoji-opt big2'})), answer:opts.indexOf(it.ans),
      hint:'Сначала было '+it.ans+', потом — другое.' };
  };
};
GEN['pet.dictation']=function(){ return function(){ return null; }; };

/* ============================================================
   Генераторы: новые игры в остальных разделах
   ============================================================ */
GEN['abc.lastSound']=function(){
  const used={};
  return function(){
    /* берём только слова, чья последняя буква уже пройдена в этом уровне сложности */
    const L=LV().letters;
    const pool=LAST_SOUND.filter(x=>L.indexOf(x.l)>=0);
    let it,tries=0; do{ it=pick(pool.length?pool:LAST_SOUND); tries++; }while(used[it.w]&&tries<30); used[it.w]=1;
    const otherLetters=[];
    pool.forEach(x=>{ if(x.l!==it.l && otherLetters.indexOf(x.l)<0) otherLetters.push(x.l); });
    LAST_SOUND.forEach(x=>{ if(otherLetters.length<LV().opts && x.l!==it.l && otherLetters.indexOf(x.l)<0) otherLetters.push(x.l); });
    const others=pickN(otherLetters, LV().opts-1);
    const opts=shuffle([it.l].concat(others));
    return { picture:it.e, pictureWord:cap(it.w), prompt:'Последняя буква в слове:',
      speak:'Послушай слово '+it.w+'. Какая буква стоит в конце?',
      options:opts.map(o=>({t:o,cls:'big-letter'})), answer:opts.indexOf(it.l),
      hint:'Слово «'+cap(it.w)+'» заканчивается на «'+it.l.toLowerCase()+'».' };
  };
};
GEN['abc.lookalike']=function(){
  const used={};
  return function(){
    /* обе буквы пары должны быть пройдены в текущем уровне */
    const L=LV().letters;
    const pool=LOOKALIKE.filter(p=>L.indexOf(p.a)>=0 && L.indexOf(p.b)>=0);
    let it,tries=0; do{ it=pick(pool.length?pool:LOOKALIKE); tries++; }while(used[it.a+it.b]&&tries<30); used[it.a+it.b]=1;
    const flip=Math.random()<.5;
    const target=flip?it.b:it.a, twin=flip?it.a:it.b;
    /* показываем обе буквы строчными — так ребёнок узнаёт их так же, как в азбуке */
    const opts=shuffle([target, twin].map(x=>x.toLowerCase()));
    return { prompt:'Найди букву «'+target.toLowerCase()+'» — она похожа на «'+twin.toLowerCase()+'», но это не она!',
      speak:'Найди букву «'+target.toLowerCase()+'». Рядом есть очень похожая буква — будь внимательна.',
      options:opts.map(o=>({t:o,cls:'big-letter'})), answer:opts.indexOf(target.toLowerCase()),
      hint:'Нужная буква «'+target.toLowerCase()+'» — вот эта, а «'+twin.toLowerCase()+'» — похожая, но не она.' };
  };
};
GEN['math.angles']=function(){
  /* число углов есть у каждой фигуры из SHAPES — включая новые ромб,
     пятиугольник и шестиугольник из тетрадей Петерсон */
  const ANG={'круг':0,'квадрат':4,'треугольник':3,'прямоугольник':4,'овал':0,
             'ромб':4,'пятиугольник':5,'шестиугольник':6};
  return function(){
    const sh=pick(SHAPES);
    const n=ANG[sh.n];
    const opts=shuffle([n].concat(pickN([1,2,3,4,5,6,0].filter(x=>x!==n),2)));
    return { promptHtml:'<div class="shape-show">'+sh.svg+'</div>',
      prompt:'Сколько у фигуры «'+sh.n+'» углов?',
      speak:'Сколько у фигуры '+sh.n+' углов?',
      options:opts.map(o=>({t:String(o),cls:'text'})), answer:opts.indexOf(n),
      hint: n===0?'У круга и у овала нет ни одного уголка — они округлые, края гладкие.':
            ('Это '+sh.n+'. В нём ровно '+n+' '+(n===1?'угол':(n<5?'угла':'углов'))+'. Считай уголки по краю фигуры.') };
  };
};
GEN['read.letterPos']=function(){
  const used={};
  return function(){
    let it,tries=0; do{ it=pick(LETTER_POS); tries++; }while(used[it.w+it.l]&&tries<30); used[it.w+it.l]=1;
    const opts=shuffle([it.pos].concat(pickN([1,2,3,4,5].filter(x=>x!==it.pos&&x<=it.w.length),2)));
    /* буквы в клеточках с номерами: ребёнок считает вслух 1, 2, 3… и сразу видит счёт */
    const cells=it.w.split('').map((c,i)=>'<b class="wc"><span class="wc-num">'+(i+1)+'</span>'+c+'</b>').join('');
    return { promptHtml:'<div class="word-cells">'+cells+'</div>',
      prompt:'На котором месте стоит буква «'+it.l+'»? Считай буквы слева направо.',
      speak:'Прочитай слово '+it.w+'. На котором месте стоит буква '+it.l.toLowerCase()+'?',
      options:opts.map(o=>({t:String(o),cls:'text'})), answer:opts.indexOf(it.pos),
      hint:'Считаем слева направо: '+it.w.split('').map((c,i)=>(i+1)+') '+c).join(', ')+
           ' — буква «'+it.l.toLowerCase()+'» стоит на месте '+it.pos+'.' };
  };
};
GEN['world.jobs']=function(){
  const used={};
  return function(){
    let it,tries=0; do{ it=pick(JOBS); tries++; }while(used[it.who]&&tries<30); used[it.who]=1;
    const opts=shuffle(it.opts.slice());
    return { picture:it.e, pictureWord:cap(it.who), prompt:it.q,
      speak:it.q, options:opts.map(o=>({t:o,cls:'long'})), answer:opts.indexOf(it.ans),
      hint:cap(it.who)+' '+it.ans+'.' };
  };
};
GEN['world.transport']=function(){
  let bag=[], i=0;
  const refill=()=>{
    const a=shuffle(TRANSPORT_GROUND).slice(0,3).map(x=>({t:x.t, emoji:x.e, cat:'a'}));
    const b=shuffle(TRANSPORT_AIR).slice(0,3).map(x=>({t:x.t, emoji:x.e, cat:'b'}));
    const c=shuffle(TRANSPORT_WATER).slice(0,3).map(x=>({t:x.t, emoji:x.e, cat:'c'}));
    bag=shuffle(a.concat(b).concat(c)); i=0;
  };
  refill();
  const where=cat => cat==='a'?'ездит по земле':(cat==='b'?'летает по воздуху':'плывёт по воде');
  return function(){
    if(i>=bag.length) refill();
    const it=bag[i++];
    return { speak:'Где ездит '+it.t+'? По земле, по воздуху или по воде — нажми на нужную корзинку.',
      prompt:'Где ездит этот транспорт?',
      item:{t:it.t, cat:it.cat, emoji:it.emoji},
      bins:[{id:'a',label:'По земле',emoji:'🛣️'},{id:'b',label:'По воздуху',emoji:'🌤️'},{id:'c',label:'По воде',emoji:'🌊'}],
      hint:cap(it.t)+' '+where(it.cat)+'.' };
  };
};
GEN['logic.countShapes']=function(){
  return function(){
    const d=makeCountShapes();
    const opts=shuffle([d.n].concat(pickN([d.n+1,d.n+2,d.n-1,d.n-2].filter(v=>v>0&&v!==d.n),2)));
    return { promptHtml:'<div class="pet-row big mixed">'+d.row.map(x=>'<span>'+x.g+'</span>').join('')+'</div>',
      prompt:'Сколько тут фигурок «'+d.target+'»?',
      speak:'Считаем только то, что называется «'+d.target+'». Сколько таких фигурок?',
      options:opts.map(o=>({t:String(o),cls:'text'})), answer:opts.indexOf(d.n),
      hint:'Обведи глазами все '+d.plural+': их '+d.n+'.' };
  };
};
GEN['logic.memseq']=function(){
  const used={};
  return function(){
    let seq,tries=0; do{ seq=pick(SEQ_SETS); tries++; }while(used[seq.join()]&&tries<30); used[seq.join()]=1;
    const r=seq.slice();
    const pos=1+rnd(r.length-1);
    const answer=r[pos-1];
    const opts=shuffle([answer].concat(pickN(r.filter(x=>x!==answer),2)));
    return { memorize:r,
      promptHtml:'<div class="pet-row big seqrow">'+r.map(x=>'<span>'+x+'</span>').join('')+'</div>',
      prompt:'Какой предмет стоял '+ordName(pos)+'?',
      speak:'Запоминай порядок! ... А теперь: какой предмет стоял '+ordName(pos)+'?',
      options:opts.map(o=>({t:o,cls:'emoji-opt'})), answer:opts.indexOf(answer),
      hint:'Порядок был такой: '+r.join(' ') };
  };
};

/* ============================================================
   Колесо игр, задание дня, «запомни порядок», диктант по клеточкам
   ============================================================ */
/* Опыт стал щедрее: каждый верный ответ даёт звёздочки, и оценка за старание тоже */
function xpForGrade(grade, stars){ return stars*2 + (grade===5?10:(grade===4?7:5)); }
function checkDaily(grade){
  const k=todayKey();
  if(!state.daily || state.daily.date!==k || !R || !R.game) return;
  if(state.daily.game===R.game.id && !state.daily.done){
    state.daily.done=true;
    state.stars+=3; state.hearts=(state.hearts||0)+1; addXp(8);
    toast('Задание дня выполнено! +3 ⭐ и сердечко 💗 сверху', '💗');
    confetti(70); sparkleBurst(10);
    save(); updateHeaderStats();
  }
}
function hashStr(s){ let h=7; for(let i=0;i<s.length;i++){ h=(h*31+s.charCodeAt(i))>>>0; } return h; }
function dailyGame(){
  const k=todayKey();
  if(!state.daily || state.daily.date!==k || !state.daily.game || !gameOf(state.daily.game)){
    const all=allGames();
    state.daily={date:k, game:all[hashStr(k)%all.length].g.id, done:false};
    save();
  }
  return gameOf(state.daily.game);
}
function renderQuick(){
  const box=$('#quick-row'); if(!box) return;
  const dg=dailyGame();
  const done=state.daily && state.daily.date===todayKey() && state.daily.done;
  const shinies=(state.stickers||[]).filter(s=>s.tier==='rare').length;
  const legends=(state.stickers||[]).filter(s=>s.tier==='legend').length;
  const toChest=Math.max(0, 3-(state.chestN||0));
  box.innerHTML=
    '<div class="qcard wheel-card">'+
      '<div class="qcard-emoji wheel-emoji">🎡</div>'+
      '<div class="qcard-body">'+
        '<h3>Кручу-верчу — какую игру выбрать?</h3>'+
        '<p class="hint-text">Нажми на колесо — игра выберется сама. Иногда очень полезно начать с сюрприза!</p>'+
        '<div class="wheel-strip"><span class="wheel-now" data-id="">нажми «Крутить»</span></div>'+
        '<div class="qcard-btns"><button class="btn primary" id="btn-wheel">🎡 Крутить!</button> '+
        '<button class="btn hidden" id="btn-wheel-go">Играть ▶</button></div>'+
      '</div>'+
    '</div>'+
    '<div class="qcard daily-card'+(done?' done':'')+'">'+
      '<div class="qcard-emoji">'+(done?'✅':(dg?dg.emoji:'🎀'))+'</div>'+
      '<div class="qcard-body">'+
        '<h3>Задание дня '+(done?'выполнено':'с двойным бонусом')+'</h3>'+
        '<p class="hint-text">'+(done
            ?'Кира справилась! Завтра розовая ленточка приготовит новую игру. Бонус получен: ⭐⭐⭐ и 💗'
            :('Учительница сегодня спрятала в дневнике игру «'+(dg?dg.title:'—')+'». Сыграй в неё — и получишь ещё 3 звёздочки и сердечко сверху.'))+'</p>'+
        '<div class="qcard-btns">'+(done
            ?'<span class="chip stars">Бонус получен ⭐⭐⭐💗'
            :'<button class="btn primary" id="btn-daily">💗 Играть задание дня</button>')+'</div>'+
      '</div>'+
    '</div>'+
    '<div class="qcard collect-card">'+
      '<div class="qcard-emoji">🏆</div>'+
      '<div class="qcard-body">'+
        '<h3>Коллекция Киры</h3>'+
        '<p class="hint-text">Наклеек: <b>'+state.stickers.length+'</b> — обычных, блестящих ✨ ('+shinies+') и сказочных 👑 ('+legends+'). '+
        'Медалей: <b>'+(state.medals||[]).length+' из '+MEDALS.length+'</b>. Сердечек за старание: <b>'+(state.hearts||0)+'</b>. '+
        (toChest>0?('До сундучка 🎁: ещё '+toChest+' пятёрк'+(toChest===1?'а':'и')+'.'):'Сундучок 🎁 готов открыться!')+'</p>'+
        '<div class="qcard-btns"><button class="btn" id="btn-to-diary">📔 Открыть дневник</button></div>'+
      '</div>'+
    '</div>';
  const bw=$('#btn-wheel'); if(bw) bw.addEventListener('click',()=>{ ac(); spinWheel(); });
  const bd=$('#btn-daily'); if(bd) bd.addEventListener('click',()=>{ ac(); const g=dailyGame(); if(g) startGame(subjectOf(g.id), g); });
  const btd=$('#btn-to-diary'); if(btd) btd.addEventListener('click',()=>{ ac(); renderDiary(); showView('diary'); });
}
function spinWheel(){
  const all=allGames();
  const nowEl=document.querySelector('.wheel-now'), goBtn=$('#btn-wheel-go'), wheelEm=document.querySelector('.wheel-emoji');
  const bw=$('#btn-wheel');
  if(!nowEl||!goBtn) return;
  nowEl.textContent='крутим…'; nowEl.dataset.id='';
  bw.classList.add('hidden'); goBtn.classList.add('hidden');
  let left=16+rnd(8), delay=60;
  const step=()=>{
    const g=all[rnd(all.length)].g;
    nowEl.textContent=g.emoji+' '+g.title;
    nowEl.dataset.id=g.id;
    if(wheelEm) wheelEm.textContent=g.emoji;
    tone(340+left*24,.05,'square',.04,0);
    left--;
    if(left>0){ delay*=1.09; setTimeout(step, delay); }
    else {
      goBtn.classList.remove('hidden'); bw.classList.remove('hidden');
      goBtn.onclick=()=>{ const gg=gameOf(nowEl.dataset.id); if(gg) startGame(subjectOf(gg.id), gg); };
      tone(880,.16,'sine',.12,0);
    }
  };
  step();
}

/* ---- запоминаем порядок (игра на внимание) ---- */
function startMemorize(q){
  const row=document.querySelector('#stage .seqrow');
  const opts=$$('#stage .opt');
  opts.forEach(o=>{ o.disabled=true; o.classList.add('pending'); });
  if(row) row.classList.add('mem-on');
  feedback('Запоминай порядок! 🔎','good');
  speak('Запоминай порядок: '+q.memorize.join(', ')+'. Запомнила? Сейчас я всё спрячу!');
  setTimeout(()=>{
    if(row){ row.classList.add('mem-off'); row.innerHTML=q.memorize.map(()=>'<span class="hide">❔</span>').join(''); }
    opts.forEach(o=>{ o.disabled=false; o.classList.remove('pending'); });
    feedback('Вспомни: '+q.prompt,'soft');
    speak(q.prompt);
  }, 4200);
}

/* ---- графический диктант по клеточкам ---- */
const GRID={cell:34, ox:44, oy:16};
function gridXY(pt){ return [GRID.ox + pt[0]*GRID.cell, GRID.oy + pt[1]*GRID.cell]; }
function drawGridPath(c,d){
  const pts=d.pts, a=gridXY(pts[0]);
  c.beginPath(); c.moveTo(a[0],a[1]);
  for(let i=1;i<pts.length;i++){ const b=gridXY(pts[i]); c.lineTo(b[0],b[1]); }
  c.stroke();
}
function drawPaper(c,W,H){
  c.strokeStyle='#cfe3f7'; c.lineWidth=1;
  for(let x=GRID.ox%GRID.cell; x<W; x+=GRID.cell){ c.beginPath(); c.moveTo(x+0.5,0); c.lineTo(x+0.5,H); c.stroke(); }
  for(let y=GRID.oy%GRID.cell; y<H; y+=GRID.cell){ c.beginPath(); c.moveTo(0,y+0.5); c.lineTo(W,y+0.5); c.stroke(); }
  c.fillStyle='#ff8fb8';
  for(let x=GRID.ox; x<W; x+=GRID.cell){ for(let y=GRID.oy; y<H; y+=GRID.cell){ c.beginPath(); c.arc(x,y,1.5,0,6.283); c.fill(); } }
}
function dictMoves(d){
  const out=[];
  for(let i=1;i<d.pts.length;i++){
    const a=d.pts[i-1], b=d.pts[i];
    const dx=b[0]-a[0], dy=b[1]-a[1];
    const n=Math.abs(dx||dy);
    const word='на '+n+' '+(n===1?'клетку':(n<=4?'клетки':'клеток'));
    if(dx>0) out.push({ar:'→', w:'вправо '+word});
    else if(dx<0) out.push({ar:'←', w:'влево '+word});
    else if(dy>0) out.push({ar:'↓', w:'вниз '+word});
    else out.push({ar:'↑', w:'вверх '+word});
  }
  return out;
}
function dictSteps(d){ return dictMoves(d).map((m,i)=>'<span class="dstep"><b>'+(i+1)+'</b> '+m.ar+' '+m.w+'</span>').join(''); }
function dictSpeak(d){
  return 'Рисуем по клеточкам дорожку. Слушай инструкции: '+dictMoves(d).map(m=>m.w).join(', ')+'. Веди линию по клеточкам, не отрывая карандаш.';
}

/* ---- настройка блёсток ---- */
$('#set-sparkle').addEventListener('change',e=>{ state.sparkles=e.target.checked; save(); });

/* ============================================================
   Игры по книге Л. Г. Петерсон, Н. П. Холиной
   «Раз — ступенька, два — ступенька», часть 1 (data3.js).
   Каждое задание снято с конкретного занятия книги.
   ============================================================ */
function bBag(arr){ const bag=shuffle(arr.slice()); let i=0;
  return function(){ if(i>=bag.length){ i=0; } return bag[i++]; }; }
/* варианты-числа только в диапазоне lo..hi (чтобы на лесенке не появлялось «0») */
function bRangeOpts(ans, lo, hi){
  const cand=[]; for(let v=lo;v<=hi;v++){ if(v!==ans) cand.push(v); }
  return shuffle([ans].concat(shuffle(cand).slice(0,2)));
}
/* «Сколько пар?»: неправильные ответы держим рядом с верным (k±1, k±2) —
   так ребёнок именно считает пары, а не угадывает далёкое число */
function bPairsOpts(k){
  const cand=[]; [k+1,k-1,k+2,k-2].forEach(v=>{ if(v>=1&&v<=8&&v!==k) cand.push(v); });
  return shuffle([k].concat(shuffle(cand).slice(0,2)));
}
/* «Пропущенные цифры»: два набора-обманки, похожих на верный (сдвиг на 1 или на 2),
   чтобы вариант был один-единственный верный и при этом нечитаемый «на глаз» */
function bGapsAlts(good, mx){
  const txt=good.slice().sort((a,b)=>a-b).join(' и ');
  const shift=(arr,d)=>{
    const s=arr.map(v=>v+d);
    if(s.some(v=>v<1||v>mx)) return '';
    const t=s.sort((a,b)=>a-b).join(' и ');
    return t===txt?'':t;
  };
  const out=[];
  [1,-1,2,-2].forEach(d=>{ const t=shift(good,d); if(t && out.indexOf(t)<0) out.push(t); });
  return out.slice(0,2);
}
const B_PLURAL = {'круг':'круги','квадрат':'квадраты','треугольник':'треугольники','овал':'овалы','прямоугольник':'прямоугольники'};
const B_GENIT  = {'красный':'красного','синий':'синего','зелёный':'зелёного','жёлтый':'жёлтого',
                  'розовый':'розового','фиолетовый':'фиолетового','голубой':'голубого'};
const ORD_FEM = ['первая','вторая','третья','четвёртая','пятая','шестая','седьмая'];
function ordFem(n){ return ORD_FEM[n-1] || ('номер '+n); }

/* 1. «Четвёртый лишний» — зан. 7, 25, 27, 29 */
GEN['book.fourth']=function(){
  const next=bBag(B_FOURTH);
  return function(){
    const it=next(), order=shuffle([0,1,2,3]);
    return { speak:'Посмотри на четыре картинки. Три из них называют одним словом: '+it.g+'. Какая лишняя?',
      prompt:'Что лишнее? Три картинки — это '+it.g+'.',
      options:order.map(i=>({t:it.its[i], cls:'emoji-opt'})),
      answer:order.indexOf(it.odd),
      hint:'Лишняя картинка — '+it.its[it.odd]+': '+it.why+'.' };
  };
};

/* 2. «Что изменилось?» — зан. 4, 5, 8 */
GEN['book.changed']=function(){
  return function(){
    const attr=pick(B_ATTRS);
    const cols=pickN(Object.keys(P_COLORS),2);
    const shs=pickN(P_SHAPES.filter(s=>s!=='овал'),2);
    let s1=shs[0], c1=cols[0], big1=true, s2=s1, c2=c1, big2=true;
    if(attr==='цвет'){ c2=cols[1]; } else if(attr==='форма'){ s2=shs[1]; } else { big2=false; }
    const row='<div class="pet-row big seqrow"><span>'+pSvg(s1,c1,big1?96:58)+'</span>'+
              '<span class="ch-arrow">→</span><span>'+pSvg(s2,c2,big2?96:58)+'</span></div>';
    const os=shuffle(B_ATTRS.slice());
    return { promptHtml:row, prompt:'Что изменилось у фигурки?',
      speak:'Сравни две фигурки. Что в них изменилось: цвет, форма или размер?',
      options:os.map(o=>({t:o, cls:'text'})), answer:os.indexOf(attr),
      hint:'Было: '+s1+' '+c1+(big1?' большой':' маленький')+'. Стало: '+s2+' '+c2+(big2?' большой':' маленький')+
           '. Значит, изменилось: '+attr+'.' };
  };
};

/* 3. «Разложи по признаку» — зан. 8, 15 */
GEN['book.attr']=function(){
  return function(){
    const K=Object.keys(P_COLORS), byColor=Math.random()<.5;
    if(byColor){
      const c1=pick(K), c2=pick(K.filter(c=>c!==c1));
      const sa=pick(P_SHAPES), sb=pick(P_SHAPES.filter(s=>s!==sa));
      const bins=[{id:'a',emoji:pSvg(sa,c1,40)+pSvg(sb,c1,40),label:'все '+B_GENIT[c1]+' цвета'},
                  {id:'b',emoji:pSvg(sa,c2,40)+pSvg(sb,c2,40),label:'все '+B_GENIT[c2]+' цвета'}];
      const cat=Math.random()<.5?'a':'b';
      const col=(cat==='a')?c1:c2, sh=pick(P_SHAPES);
      return { prompt:'Клади в мешок так, чтобы в нём всё было ОДНОГО ЦВЕТА',
        speak:'Разложи фигурки по мешкам так, чтобы в мешке всё было одного цвета. В какой мешок положить '+col+' '+sh+'?',
        item:{cat:cat, t:col+' '+sh, emoji:pSvg(sh,col,66)}, bins:bins,
        hint:'Смотри на цвет, а не на форму: фигурка '+col+' '+sh+' — в мешок «'+bins[cat==='a'?0:1].label+'».' };
    }
    const s1=pick(P_SHAPES), s2=pick(P_SHAPES.filter(s=>s!==s1));
    const ca=pick(K), cb=pick(K.filter(c=>c!==ca));
    const bins=[{id:'a',emoji:pSvg(s1,ca,40)+pSvg(s1,cb,40),label:'все — '+B_PLURAL[s1]},
                {id:'b',emoji:pSvg(s2,ca,40)+pSvg(s2,cb,40),label:'все — '+B_PLURAL[s2]}];
    const cat=Math.random()<.5?'a':'b';
    const sh=(cat==='a')?s1:s2, col=pick(K);
    return { prompt:'Клади в мешок так, чтобы в нём всё было ОДНОЙ ФОРМЫ',
      speak:'Разложи фигурки по мешкам так, чтобы в мешке всё было одной формы. В какой мешок положить '+col+' '+sh+'?',
      item:{cat:cat, t:col+' '+sh, emoji:pSvg(sh,col,66)}, bins:bins,
      hint:'Смотри на форму, а не на цвет: это '+sh+' — в мешок «'+bins[cat==='a'?0:1].label+'».' };
  };
};

/* 4. «Какая фигура дальше?» — зан. 5, 21, 29 */
GEN['book.seq']=function(){
  return function(){
    const attr=pick(['цвет','форма','размер']);
    const cols=pickN(Object.keys(P_COLORS),2);
    const shs=pickN(P_SHAPES.filter(s=>s!=='овал'),2);
    const flipColor=o=>({shape:o.shape, color:o.color===cols[0]?cols[1]:cols[0], big:o.big});
    const flipShape =o=>({shape:o.shape===shs[0]?shs[1]:shs[0], color:o.color, big:o.big});
    const flipSize  =o=>({shape:o.shape, color:o.color, big:!o.big});
    const flip = attr==='цвет'?flipColor : (attr==='форма'?flipShape:flipSize);
    const seq=[{shape:shs[0], color:cols[0], big:true}];
    for(let i=1;i<3;i++) seq.push(flip(seq[i-1]));
    const ans=flip(seq[2]);
    let wrong=[flipColor(ans), flipShape(ans)];
    if(wrong[1].shape===ans.shape) wrong[1]=flipSize(ans);
    if(wrong[0].color===ans.color) wrong[0]=flipSize(ans);
    const all=shuffle([ans].concat(wrong));
    const row='<div class="pet-row big seqrow">'+seq.map(o=>'<span>'+pSvg(o.shape,o.color,o.big?78:50)+'</span>').join('')+
              '<span class="qmark">❔</span></div>';
    return { promptHtml:row, prompt:'Какая фигура будет следующей?',
      speak:'Посмотри на ряд фигур: что-то в них меняется по очереди. Какая фигура будет следующей?',
      options:all.map(o=>({html:pSvg(o.shape,o.color,o.big?82:54), cls:'pic-opt'})), answer:all.indexOf(ans),
      hint:'В этом ряду каждый раз меняется '+attr+'. Следующая фигура — '+ans.shape+' '+ans.color+(ans.big?' большой':' маленький')+'.' };
  };
};

/* 5. «Ступеньки» — зан. 6 */
function bStairs(n, mark){
  const stepW=54, stepH=40, padL=16, padB=14, padT=20;
  const W=padL+n*stepW+14, H=padT+n*stepH+padB;
  let out='';
  for(let i=0;i<n;i++){
    const y=H-padB-(i+1)*stepH, w=(i+1)*stepW;
    out+='<rect x="'+padL+'" y="'+y+'" width="'+w+'" height="'+stepH+'" fill="#fff0f6" stroke="#ff9bbd" stroke-width="3"/>'+
         '<text x="'+(padL+w-stepW/2)+'" y="'+(y+stepH/2+9)+'" text-anchor="middle" font-size="26" font-weight="700" fill="#b5527d">'+(i+1)+'</text>';
  }
  if(mark){ const i=mark-1, w=(i+1)*stepW;
    out+='<text x="'+(padL+w-stepW/2)+'" y="'+(H-padB-(i+1)*stepH-4)+'" text-anchor="middle" font-size="30">🐤</text>'; }
  return '<div class="pet-row"><svg viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'">'+out+'</svg></div>';
}
GEN['book.stairs']=function(){
  let n=0;
  return function(){
    const steps=4+(n%3); n++;
    const kind=pick(['who','top','jump']);
    if(kind==='who'){
      const m=1+rnd(steps);
      const os=bRangeOpts(m,1,steps);
      return { promptHtml:bStairs(steps,m), prompt:'На какой ступеньке сидит цыплёнок?',
        speak:'Ступеньки считают снизу вверх. На какой ступеньке сидит цыплёнок?',
        options:os.map(o=>({t:String(o),cls:'text'})), answer:os.indexOf(m),
        hint:'Считаем снизу: первая, вторая… цыплёнок на ступеньке '+m+'.' };
    }
    if(kind==='top'){
      const from=2+rnd(Math.min(3,steps-2));
      const ans=steps-from+1;
      const os=bRangeOpts(ans,1,steps);
      return { promptHtml:bStairs(steps,0), prompt:'Какая ступенька '+ordFem(from)+' сверху?',
        speak:'Ступеньки считают снизу, а теперь посчитай сверху. Какая ступенька '+ordFem(from)+' сверху?',
        options:os.map(o=>({t:String(o),cls:'text'})), answer:os.indexOf(ans),
        hint:'Считаем сверху: '+ordFem(1)+' — это '+steps+', '+ordFem(2)+' — '+(steps-1)+'… значит '+ordFem(from)+' сверху — это '+ans+'.' };
    }
    const a=1+rnd(steps-2), b=a+1+rnd(steps-a-1<1?1:steps-a-1);
    const diff=b-a;
    const os=bRangeOpts(diff,1,steps-1);
    return { promptHtml:bStairs(steps,0), prompt:'Сколько ступенек вверх от '+a+' до '+b+'?',
      speak:'Поднимемся по лесенке: сколько ступенек вверх нужно пройти от '+a+' до '+b+'?',
      options:os.map(o=>({t:String(o),cls:'text'})), answer:os.indexOf(diff),
      hint:'Считаем шажки: '+Array.from({length:diff},(_,i)=>a+i+1).join(', ')+'. Всего '+diff+' ступеньки вверх.' };
  };
};

/* 6. «Поставь знак» — зан. 29, 30 */
GEN['book.sign']=function(){
  return function(){
    const maxN=state.diff==='лёгкий'?5:(state.diff==='средний'?8:10);
    const eq=Math.random()<.3;
    let a=1+rnd(maxN), b=a;
    if(!eq){ b=1+rnd(maxN); if(b===a) b=(a%maxN)+1; }
    const sh=pick(P_SHAPES), col=pick(Object.keys(P_COLORS));
    const setOf=k=>'<span class="setrow">'+Array.from({length:k},()=>pSvg(sh,col,30)).join('')+'</span>';
    const row='<div class="cmp"><div>'+setOf(a)+'<b>'+a+'</b></div><div>'+setOf(b)+'<b>'+b+'</b></div></div>';
    let os, ans;
    if(eq){ os=['=','>','<']; ans='='; }
    else  { os=['>','<','=']; ans=(a>b)?'>':'<'; }
    return { promptHtml:row, prompt:'Какой знак нужно поставить?',
      speak:'Посчитай фигурки слева и справа. Какой знак нужно поставить: равно, больше или меньше?',
      options:os.map(o=>({t:o,cls:'sign'})), answer:os.indexOf(ans),
      hint: eq ? 'Фигурок одинаково: '+a+' и '+b+'. Значит, ставим знак «равно».'
               : 'Где фигурок больше — туда знак и открыт. Их больше там, где '+Math.max(a,b)+', значит нужен знак '+ans+'.' };
  };
};

/* 7. «Внутри и снаружи» — зан. 17 */
GEN['book.inside']=function(){
  const next=bBag(B_SCENES);
  const CX=190, CY=150, RX=100, RY=70, W=380, H=300, HALO=27, GAP=40;
  /* Каждый предмет ставим на фиксированном расстоянии от розовой границы:
     внутри или снаружи — всегда заметно, линия не «слипается» с картинкой. */
  const place=(it)=>{
    const a=Math.atan2(it.y-115, it.x-175);
    const localR=1/Math.sqrt(Math.pow(Math.cos(a)/RX,2)+Math.pow(Math.sin(a)/RY,2));
    const d=it.in ? (localR-GAP) : (localR+GAP);
    const x=Math.round(Math.max(34, Math.min(W-34, CX+d*Math.cos(a))));
    const y=Math.round(Math.max(38, Math.min(H-38, CY+d*Math.sin(a))));
    return {x:x, y:y};
  };
  return function(){
    const sc=next(), it=pick(sc.items);
    const pos=sc.items.map(o=>({e:o.e, t:o.t, in:o.in, p:place(o)}));
    const tgt=pos.filter(o=>o.t===it.t)[0];
    const W=380, H=260;
    const half=Math.round(it.t.length*7.9)+9;
    let lx=Math.max(half+4, Math.min(W-half-4, tgt.p.x));
    let below=tgt.p.y+40 <= H-10;
    let ly=below ? tgt.p.y+40 : tgt.p.y-34;
    let svg='<svg viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'">'+
      '<ellipse cx="'+CX+'" cy="'+CY+'" rx="'+RX+'" ry="'+RY+'" fill="#fff0f6" stroke="#e0245e" stroke-width="7"/>'+
      '<circle cx="'+tgt.p.x+'" cy="'+tgt.p.y+'" r="'+HALO+'" fill="#ffe6a6" stroke="#e0a100" stroke-width="3"/>'+
      pos.map(o=>'<text x="'+o.p.x+'" y="'+(o.p.y+10)+'" font-size="'+(o===tgt?31:26)+'" text-anchor="middle">'+o.e+'</text>').join('')+
      '<rect x="'+(lx-half)+'" y="'+(ly-15)+'" width="'+(half*2)+'" height="21" rx="9" fill="#ffffff" opacity=".86"/>'+
      '<text x="'+lx+'" y="'+ly+'" font-size="15" font-weight="700" fill="#7a3a52" text-anchor="middle">'+it.t+'</text>'+
      '</svg>';
    return { promptHtml:'<div class="pet-row">'+svg+'</div>'+
        '<div class="io-legend">🌸 Розовый овал — это граница, как заборчик. Смотрим, где предмет: <b>внутри</b> овала или <b>снаружи</b>.</div>',
      prompt:'Где '+it.t+' — внутри розовой линии или снаружи?',
      speak:'Посмотри на картинку: тут '+sc.name+'. Большая розовая линия — это граница, как заборчик. '+cap(it.t)+' стоит внутри этой линии или снаружи неё?',
      options:[{t:'Внутри линии', cls:'text'},{t:'Снаружи линии', cls:'text'}],
      answer:(tgt.in?0:1),
      hint: it.in ? 'Розовая линия обнимает «'+it.t+'» — он внутри овала, за линией.'
                  : '«'+it.t+'» стоит за розовой линией — он снаружи, вне овала.' };
  };
};

/* 8. «Линии: прямая, кривая, отрезок, луч, ломаная» — зан. 19–21 */
const B_LINE_HINT={'прямая':'Прямая идёт ровно-ровно, без изгибов, и у неё нет концов.',
  'отрезок':'Отрезок — это кусочек прямой: у него есть два конца (точки).',
  'луч':'У луча только один конец, а в другую сторону он идёт долго-долго.',
  'кривая':'Кривая линия изогнута, как дорожка или волна.',
  'ломаная':'Ломаная состоит из палочек-звеньев, которые поворачивают.'};
GEN['book.line']=function(){
  const names=['прямая','отрезок','луч','кривая','ломаная'];
  const used={};
  return function(){
    let nm,tries=0; do{ nm=pick(names); tries++; }while(used[nm]&&tries<25); used[nm]=1;
    const os=shuffle(names.filter(x=>x!==nm).concat(nm)).slice(0,3);
    if(!os.some(o=>o===nm)) os[2]=nm;
    const shuffled=shuffle(os);
    /* винительный падеж: «найди прямую», а не «найди на прямая» */
    const ACC={'прямая':'прямую','отрезок':'отрезок','луч':'луч','кривая':'кривую','ломаная':'ломаную'};
    if(Math.random()<.5){
      return { promptHtml:'<div class="pet-row">'+bLineSvg(nm,250)+'</div>',
        prompt:'Как называется эта линия?', speak:'Как называется эта линия?',
        options:shuffled.map(o=>({t:o,cls:'text'})), answer:shuffled.indexOf(nm),
        hint:nm+': '+B_LINE_HINT[nm] };
    }
    return { prompt:'Найди '+ACC[nm]+' — нажми на эту линию', speak:'Найди '+ACC[nm]+' — нажми на эту линию.',
      options:shuffled.map(o=>({html:bLineSvg(o,190), cls:'pic-opt line-opt'})), answer:shuffled.indexOf(nm),
      hint:nm+': '+B_LINE_HINT[nm] };
  };
};

/* 9. «Замкнутая линия или нет?» — зан. 22–23 */
GEN['book.closed']=function(){
  let n=0;
  return function(){
    const yes=(n%2===0); n++;
    const os=['замкнутая','незамкнутая'];
    return { promptHtml:'<div class="pet-row">'+bClosedSvg(yes,240)+'</div>',
      prompt:'Линия замкнутая или незамкнутая?',
      speak:'Проведи пальцем по линии. Если вернулся туда, где начал, — она замкнутая. Если остались концы — незамкнутая.',
      options:os.map(o=>({t:o,cls:'text'})), answer:yes?0:1,
      hint: yes?'Веди пальцем по всей линии: концов нет, ты возвращаешься на старт — она замкнутая.'
               :'У этой линии видны два конца — её не замкнули, она незамкнутая.' };
  };
};

/* 10. «Какой это угол?» — зан. 25 */
const B_ANGLE_HINT='Прямой угол — квадратный, как уголок тетради. Острый — меньше прямого, он колючий. Тупой — больше прямого, он раскрыт широко.';
GEN['book.angle']=function(){
  const names=['прямой','острый','тупой'];
  const bag=shuffle(B_ANGLE_SCENES.slice()); let bi=0;
  return function(){
    let nm, pic, what='';
    if(Math.random()<.55 || bi>=bag.length){
      nm=pick(names); pic='<div class="pet-row">'+bAngleSvg(nm,240)+'</div>';
    } else {
      const sc=bag[bi++]; nm=sc.kind; what=sc.t;
      const parts=sc.svg();
      pic='<div class="pet-row"><svg viewBox="0 0 220 170" width="240" height="'+Math.round(240*170/220)+'">'+
          parts.body+parts.rays+'</svg></div>';
    }
    const os=shuffle(names.slice());
    return { promptHtml:pic,
      prompt: what ? 'Какой угол нарисован: прямой, острый или тупой?' : 'Какой это угол?',
      speak: what ? 'Посмотри на картинку: '+what+'. Какой там нарисован угол: прямой, острый или тупой?'
                  : 'Бывает прямой угол — как уголок тетради, острый — меньше него, тупой — больше. Какой это угол?',
      options:os.map(o=>({t:o,cls:'text'})), answer:os.indexOf(nm),
      hint:'Этот угол — '+nm+' '+((what?('в «'+what+'»'):''))+': '+
           (nm==='прямой' ? 'он квадратный, как уголок тетради — стороны идут ровно вниз и вправо.'
            : nm==='острый' ? 'он меньше прямого, стороны раскрыты узко.'
            : 'он больше прямого, стороны раскрыты широко.')+' сверь с уголком тетради.' };
  };
};

/* 11. «Сколько пар?» — зан. 15, 17–18 */
GEN['book.pairs']=function(){
  const next=bBag(B_PAIRS);
  return function(){
    const it=next(), k=2+rnd(4);
    const row='<div class="q-count pairs-row">'+Array.from({length:k},()=>'<span class="pairbox">'+it.e+it.e+'</span>').join('')+'</div>';
    const os=bPairsOpts(k);
    return { promptHtml:row, prompt:'Сколько тут пар?',
      speak:'Пара — это два одинаковых предмета рядом: '+it.one+' и '+it.one+' — это одна пара. Посчитай, сколько получилось пар.',
      options:os.map(o=>({t:String(o),cls:'text'})), answer:os.indexOf(k),
      hint:'Соединяем по двое: '+Array.from({length:k},(_,i)=>i+1).join(', ')+'. Всего пар — '+k+'.' };
  };
};

/* 12. «Пропущенные цифры» — зан. 16–28 */
GEN['book.gaps']=function(){
  return function(){
    const mx=pick(B_GAP_MAX);
    const cnt=(state.diff==='лёгкий'||mx<=5)?1:2;
    const pos=[];
    let guard=0;
    while(pos.length<cnt && guard<60){ guard++; const p=1+rnd(mx-3); if(pos.indexOf(p)<0) pos.push(p); }
    pos.sort((a,b)=>a-b);
    const seq=[]; for(let i=0;i<mx;i++) seq.push(pos.indexOf(i)<0 ? (i+1) : 0);
    const good=pos.map(p=>p+1);
    const txt=good.join(' и ');
    const row='<div class="numline num-cells">'+seq.map(v=>v?'<span class="ncell">'+v+'</span>':'<span class="ncell empty">❔</span>').join('')+'</div>';
    const nx=v=>v===mx?v-1:v+1, pv=v=>v===1?v+1:v-1, nn=v=>v<=mx-2?v+2:v-2;
    const jn=a=>a.slice().sort((x,y)=>x-y).join(' и ');
    let uniq=[];
    [jn(good.map(nx)), jn(good.map(pv)), jn(good.map(nn))]
      .filter(t2=>t2!==txt && t2.split(' и ').every(v=>+v>=1 && +v<=mx))
      .forEach(t2=>{ if(uniq.indexOf(t2)<0) uniq.push(t2); });
    /* если ряд короткий (цифр 5) и обманок не хватает — берём сдвинутые наборы */
    if(uniq.length<2) bGapsAlts(good, mx).forEach(t2=>{ if(uniq.indexOf(t2)<0) uniq.push(t2); });
    const os=shuffle([txt].concat(uniq.slice(0,2)));
    return { promptHtml:row, prompt: cnt>1?'Какие цифры спрятались?':'Какая цифра спряталась?',
      speak:'Числа идут по порядку, но часть закрыта. Скажи, '+(cnt>1?'какие цифры спрятались':'какая цифра спряталась')+'.',
      options:os.map(o=>({t:o,cls: o.length>2?'long':'big-letter'})), answer:os.indexOf(txt),
      hint:'Считаем по порядку: '+seq.map(v=>v||'?').join(', ')+'. Спряталось: '+txt+'.' };
  };
};

/* 13. «Узор по клеточкам» — низ страниц книги */
GEN['book.cells']=function(){
  return function(){
    const k=2+(Math.random()<.5?1:0);
    const pat=pickN(B_CELLS,k);
    const cells=[]; for(let r=0;r<2;r++) pat.forEach(c=>cells.push(c));
    const ans=pat[0];
    const row='<div class="cellrow">'+cells.map(c=>'<span class="cellc" style="background:'+c.hex+'"></span>').join('')+
              '<span class="cellc next">❔</span></div>';
    /* НЕ берём «первые две» клетки из списка: так неправильные ответы
       всегда выглядели одинаково и угадывались без узора */
    const os=shuffle([ans].concat(pickN(B_CELLS.filter(c=>c.hex!==ans.hex),2)));
    return { promptHtml:row, prompt:'Какой цвет будет в следующей клеточке?',
      speak:'Это узор по клеточкам, как внизу страницы книги. Посмотри, какой цвет повторяется, и выбери цвет следующей клеточки.',
      options:os.map(o=>({html:'<span class="cellc" style="background:'+o.hex+'"></span>', label:o.name, cls:'color-opt'})),
      answer:os.indexOf(ans),
      hint:'Узор повторяется по кругу: '+pat.map(c=>c.name).join(', ')+'. Значит, следующая клеточка — '+ans.fem+'.' };
  };
};

/* 14. «Подбери заплатку» — зан. 2, 11 */
GEN['book.patch']=function(){
  const next=bBag(B_PATCH);
  return function(){
    const it=next();
    const os=shuffle(pickN(P_SHAPES.filter(s=>s!==it.shape),2).concat(it.shape));
    const col=pick(Object.keys(P_COLORS));
    return { picture:it.e, pictureWord:it.t,
      prompt:'Какая заплатка закроет дырку? '+it.g,
      speak:'Посмотри на картинку: это '+it.t+'. Дырка на предмете в форме «'+it.shape+'». Выбери заплатку такой же формы.',
      options:os.map(s=>({html:pSvg(s,col,74), cls:'pic-opt'})), answer:os.indexOf(it.shape),
      hint:'Заплатка должна быть такой же формы, как дырка, — это '+it.shape+'.' };
  };
};

/* 15. «Какая мерка подойдёт?» — зан. 28 */
GEN['book.measure']=function(){
  const next=bBag(B_MEASURE);
  return function(){
    const it=next();
    const os=shuffle([it.good].concat(it.bad));
    return { prompt:'🤔 '+it.q, speak:it.q+' Подумай, чем удобно это измерить.',
      options:os.map(o=>({t:o,cls:'long'})), answer:os.indexOf(it.good),
      hint:'Выбери то, чем удобно это сделать: «'+it.good+'».' };
  };
};

/* ------------------------------ ЗАПУСК ------------------------------ */
applyUI();
paintSoundBtn(); updateHeaderStats(); paintLevel();
/* медали за то, что уже достигнуто раньше: тихо, без праздничных сообщений */
try{ checkMedals(); }catch(e){}
renderHub();
document.addEventListener('pointerdown',function once(){
  ac();
  /* на планшете и телефоне голос можно «разбудить» только первым касанием */
  if('speechSynthesis' in window){
    try{
      window.speechSynthesis.resume();
      const warm=new SpeechSynthesisUtterance(' ');
      warm.volume=0; warm.lang='ru-RU';
      window.speechSynthesis.speak(warm);
    }catch(e){}
  }
  document.removeEventListener('pointerdown',once);
},{once:true});
watchVoices();
loadClips();
if('speechSynthesis' in window){
  setTimeout(()=>{ refreshVoices(); }, 1200);
  setTimeout(()=>{ refreshVoices(); }, 3000);
}
