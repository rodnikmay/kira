/* ============================================================
   gen4.js — ГЕНЕРАТОРЫ новых заданий по книжкам из папки:
     • «Игралочка. Ступенька к школе», ч. 3 (5–6 лет)
     • «Раз — ступенька, два — ступенька», ч. 2 (6–7 лет) — только то,
       что уже по силам, остальное оставлено на следующий год.

   Файл подключается ПОСЛЕДНИМ: дописывает игры в SUBJECTS (сами игры
   и данные — в data4.js), добавляет генераторы в GEN, добавляет
   пособие в список и вторую карту книги во вкладку «Взрослым».

   Правила качества, которые здесь соблюдены:
   • у задания ровно один верный ответ (обманки близко к верному,
     но не подходят по условию);
   • в тексте задания объяснено правило — ребёнок понимает, что делать;
   • числа не выходят за диапазон уровня (лёгкий до 5–6, средний до 8,
     сложный до 10);
   • ни один тип задания не повторяет то, что уже есть в data.js,
     data2.js и data3.js.
   ============================================================ */

/* ---------- общие вспомогательные функции ---------- */
function igRus(n, one, few, many){
  const a=n%10, b=n%100;
  if(a===1 && b!==11) return one;
  if(a>=2&&a<=4 && !(b>=12&&b<=14)) return few;
  return many;
}
function igPl(n, one, few, many){ return n+' '+igRus(n, one, few, many); }
/* три разных числа (для сцены, чтобы сравнение было однозначным) */
function igDistinctCounts(mx){
  let guard=0, v=[0,0,0];
  while(guard++<60){
    v=[2+rnd(mx-1), 2+rnd(mx-1), 2+rnd(mx-1)];
    if(v[0]!==v[1] && v[1]!==v[2] && v[0]!==v[2]) return v;
  }
  return [2,3,4].map(x=>Math.min(x,mx));
}
/* варианты-числа рядом с верным (обманки «похожие», но не подходящие).
   вариант answer встречается ровно один раз — обманки не берутся из рядом
   идущих чисел, чтобы случайно не повторить верный ответ */
function igNear(ans, deltas, lo, hi){
  const out=igNearVals(ans,deltas,lo,hi);
  return shuffle([ans].concat(out.slice(0,2)));
}
/* только обманки (без верного ответа) — когда верный ответ подаётся картинкой,
   а не числом, иначе картинка верного ответа может повториться среди вариантов */
function igNearVals(ans, deltas, lo, hi){
  const out=[];
  deltas.forEach(d=>{ const v=ans+d; if(v>=lo && v<=hi && v!==ans && out.indexOf(v)<0) out.push(v); });
  let k=1;
  while(out.length<2 && ans-k>=lo){ const v=ans-k; if(out.indexOf(v)<0) out.push(v); k++; }
  k=1;
  while(out.length<2 && ans+k<=hi){ const v=ans+k; if(out.indexOf(v)<0) out.push(v); k++; }
  return out;
}

/* ---------- правильные русские формы слов для новых заданий ---------- */
/* родительный падеж фигур: «у пятиугольника 5 углов», «ключик в форме квадрата» */
const IG_FIG_GEN={'круг':'круга','квадрат':'квадрата','треугольник':'треугольника',
                  'прямоугольник':'прямоугольника','овал':'овала','ромб':'ромба',
                  'пятиугольник':'пятиугольника','шестиугольник':'шестиугольника'};
function igFigGen(n){ return IG_FIG_GEN[n]||n; }
/* множественное числа цвета: «вагоны слева — синие» */
const IG_COLOR_PL={'красный':'красные','синий':'синие','зелёный':'зелёные','жёлтый':'жёлтые',
                   'розовый':'розовые','фиолетовый':'фиолетовые','голубой':'голубые'};
/* монета: 1 монета, 2–4 монетки, 5 и больше — монет */
function igCoin(n){ return n+' '+igRus(n,'монета','монетки','монет'); }

/* ---------- картинки для разметки ---------- */
/* сколько точек в ряду: ряды по 3 точки, как на игральной кости (5 = 3+2) */
function igDotRows(k){
  const rows=[]; let left=k;
  while(left>3){ rows.push(3); left-=3; }
  if(left>0) rows.push(left);
  return rows;
}
/* карточка «домино»: число точек разбито на две части (слева и справа) —
   всего точек ровно столько, сколько число на карточке */
function igDominoSvg(rowsL, rowsR, w){
  const W=w||190, H=Math.round(W*0.52), half=W/2, step=half/3.4, R=W*0.030;
  const dots=(rows, offX)=>{
    let s=''; const k=rows.length, gap=H*0.26, y0=H/2-(k-1)*gap/2, cx0=offX+half/2;
    rows.forEach((cnt,ri)=>{
      for(let i=0;i<cnt;i++)
        s+='<circle cx="'+(cx0+(i-(cnt-1)/2)*step)+'" cy="'+(y0+ri*gap)+'" r="'+R+'" fill="#8c2f52"/>';
    });
    return s;
  };
  return '<svg viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'">'+
    '<rect x="3" y="3" width="'+(W-6)+'" height="'+(H-6)+'" rx="14" fill="#fff8fb" stroke="#e0245e" stroke-width="3"/>'+
    '<line x1="'+half+'" y1="12" x2="'+half+'" y2="'+(H-12)+'" stroke="#e0245e" stroke-width="2"/>'+
    dots(rowsL,6)+dots(rowsR,half+6)+'</svg>';
}
/* лента из клеток: измерение и сравнение длин */
function igRibbon(cells, color, w){
  const cell=w||34, W=cells*cell, col=color||'#e0245e', H=54;
  let out='<rect x="1" y="10" width="'+(W-2)+'" height="34" rx="8" fill="'+col+'" fill-opacity=".16" stroke="'+col+'" stroke-width="3"/>';
  for(let i=1;i<cells;i++) out+='<line x1="'+(i*cell)+'" y1="10" x2="'+(i*cell)+'" y2="44" stroke="'+col+'" stroke-width="2" stroke-opacity=".55"/>';
  return '<svg viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'">'+out+'</svg>';
}
/* ковёр-самолёт: сетка клеток и маршрут со стрелками */
function igGrid(rows, cols, items, path, opt){
  opt=opt||{};
  const cell=84, pad=18, W=cols*cell+pad*2, H=rows*cell+pad*2;
  const cx=i=>pad+(i%cols)*cell+cell/2, cy=i=>pad+Math.floor(i/cols)*cell+cell/2;
  let out='<rect x="'+(pad-4)+'" y="'+(pad-4)+'" width="'+(cols*cell+8)+'" height="'+(rows*cell+8)+'" rx="14" fill="#fff6fa" stroke="#ffd0e0" stroke-width="3"/>';
  for(let c=1;c<cols;c++) out+='<line x1="'+(pad+c*cell)+'" y1="'+(pad-4)+'" x2="'+(pad+c*cell)+'" y2="'+(pad+rows*cell+4)+'" stroke="#ffd0e0" stroke-width="2"/>';
  for(let r=1;r<rows;r++) out+='<line x1="'+(pad-4)+'" y1="'+(pad+r*cell)+'" x2="'+(pad+cols*cell+4)+'" y2="'+(pad+r*cell)+'" stroke="#ffd0e0" stroke-width="2"/>';
  items.forEach((it,i)=>{
    if(it===null) return;
    out+='<text x="'+cx(i)+'" y="'+(cy(i)+13)+'" font-size="36" text-anchor="middle">'+it+'</text>';
  });
  if(path && path.length>1){
    out+='<polyline points="'+path.map(i=>cx(i)+','+cy(i)).join(' ')+'" fill="none" stroke="#e0245e" stroke-width="6" stroke-linejoin="round" stroke-linecap="round" opacity=".75"/>';
    for(let s=1;s<path.length;s++){
      const a=path[s-1], b=path[s];
      const mx=(cx(a)+cx(b))/2, my=(cy(a)+cy(b))/2;
      const ang=Math.atan2(cy(b)-cy(a), cx(b)-cx(a))*180/Math.PI;
      out+='<polygon points="0,0 -15,-8 -15,8" fill="#e0245e" transform="translate('+mx+','+my+') rotate('+ang+')"/>';
    }
    const e=path[path.length-1], st=path[0];
    out+='<line x1="'+cx(e)+'" y1="'+(cy(e)-40)+'" x2="'+cx(e)+'" y2="'+(cy(e)-24)+'" stroke="#7a3a52" stroke-width="3"/>'+
         '<polygon points="'+cx(e)+','+(cy(e)-40)+' '+(cx(e)+18)+','+(cy(e)-35)+' '+cx(e)+','+(cy(e)-30)+'" fill="#ffb703"/>';
    out+='<circle cx="'+cx(st)+'" cy="'+cy(st)+'" r="38" fill="none" stroke="#4b8ef1" stroke-width="4" stroke-dasharray="7 6"/>';
  }
  if(opt.stepIdx!=null){
    out+='<circle cx="'+cx(opt.stepIdx)+'" cy="'+cy(opt.stepIdx)+'" r="40" fill="none" stroke="#2fa84f" stroke-width="5"/>';
  }
  return '<div class="pet-row"><svg viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'" style="max-width:100%">'+out+'</svg></div>';
}
/* числовой заборчик из дощечек */
function igFenceSvg(vals){
  const pw=96, gap=18, W=vals.length*(pw+gap)+30, H=140;
  let out='<line x1="12" y1="46" x2="'+(W-12)+'" y2="46" stroke="#c9a26b" stroke-width="6"/>'+
          '<line x1="12" y1="104" x2="'+(W-12)+'" y2="104" stroke="#c9a26b" stroke-width="6"/>';
  vals.forEach((v,i)=>{
    const x=18+i*(pw+gap);
    out+='<polygon points="'+x+',18 '+(x+pw)+',18 '+(x+pw)+',112 '+(x+pw/2)+',124 '+x+',112" fill="#fff3d6" stroke="#c9a26b" stroke-width="3"/>'+
         '<text x="'+(x+pw/2)+'" y="'+(v==='?'?88:80)+'" text-anchor="middle" font-size="'+(v==='?'?46:40)+'" font-weight="800" fill="'+(v==='?'?'#e0245e':'#7a3a52')+'">'+v+'</text>';
  });
  return '<div class="pet-row"><svg viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'" style="max-width:100%">'+out+'</svg></div>';
}
/* поезд: паровоз и вагоны (вагон i рисуем по цвету colors[i]) */
function igTrainSvg(colors, highlight){
  const w=66, gap=10, n=colors.length, W=130+n*(w+gap)+30, H=120;
  let out='<line x1="14" y1="98" x2="'+(W-14)+'" y2="98" stroke="#b9a48c" stroke-width="5"/>';
  out+='<rect x="22" y="44" width="76" height="48" rx="8" fill="#8c2f52"/>'+
       '<rect x="34" y="30" width="30" height="18" rx="4" fill="#8c2f52"/>'+
       '<circle cx="40" cy="94" r="12" fill="#7a3a52"/><circle cx="86" cy="94" r="12" fill="#7a3a52"/>'+
       '<text x="60" y="76" text-anchor="middle" font-size="24">🚂</text>';
  for(let i=0;i<n;i++){
    const x=130+i*(w+gap);
    out+='<rect x="'+x+'" y="48" width="'+w+'" height="44" rx="7" fill="'+colors[i]+'" stroke="#c86a86" stroke-width="3"/>'+
         '<circle cx="'+(x+16)+'" cy="94" r="9" fill="#7a3a52"/><circle cx="'+(x+w-16)+'" cy="94" r="9" fill="#7a3a52"/>'+
         '<text x="'+(x+w/2)+'" y="40" text-anchor="middle" font-size="16" font-weight="700" fill="#7a3a52">'+(i+1)+'</text>';
    if(highlight===i) out+='<rect x="'+(x-5)+'" y="43" width="'+(w+10)+'" height="54" rx="10" fill="none" stroke="#e0245e" stroke-width="4" stroke-dasharray="6 5"/>';
  }
  out+='<line x1="'+(130+2*(w+gap)+w/2)+'" y1="34" x2="'+(130+2*(w+gap)+w/2)+'" y2="104" stroke="#7a3a52" stroke-width="3" stroke-dasharray="5 5"/>';
  return '<div class="pet-row"><svg viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'" style="max-width:100%">'+out+'</svg></div>';
}
function igWagonSvg(color, num, w){
  const s=w||44, W=s, H=Math.round(s*0.72);
  return '<svg viewBox="0 0 66 48" width="'+W+'" height="'+H+'"><rect x="4" y="8" width="58" height="32" rx="6" fill="'+color+'" stroke="#c86a86" stroke-width="3"/>'+
    (num?'<text x="33" y="30" text-anchor="middle" font-size="19" font-weight="800" fill="#fff">'+num+'</text>':'')+'</svg>';
}
/* дверь домика в форме фигуры */
function igDoorSvg(fig, w){
  const W=w||150, H=Math.round(W*0.92);
  return '<svg viewBox="0 0 130 120" width="'+W+'" height="'+H+'">'+
    '<polygon points="8,44 65,8 122,44" fill="#ffe1ec" stroke="#e0245e" stroke-width="4"/>'+
    '<rect x="14" y="44" width="102" height="70" rx="7" fill="#fff6fa" stroke="#e0245e" stroke-width="4"/>'+
    fig.svg.replace(/<\/?svg[^>]*>/g,'')+
    '</svg>';
}

/* ============================================================
   1. Новые фигуры: ромб, пятиугольник, шестиугольник (зан. 26)
   ============================================================ */
GEN['ig.figures']=function(){
  const known=SHAPES.filter(s=>['круг','квадрат','треугольник','прямоугольник','овал'].indexOf(s.n)>=0);
  let n=0;
  return function(){
    const mode=(n%2===0)?'find':'count'; n++;
    const target=pick(IG_FIGURES);
    if(mode==='find'){
      const opts=shuffle([target].concat(pickN(known.filter(s=>s.n!==target.n), 2)));
      return { promptHtml:'<div class="shape-show">'+target.svg+'</div>',
        prompt:'Найди такую же фигуру',
        speak:'Это '+target.n+' — новая фигура из тетради. Найди и нажми на такую же фигуру.',
        options:opts.map(o=>({html:o.svg, label:o.n, cls:'pic-opt'})), answer:opts.indexOf(target),
        hint:'У '+igFigGen(target.n)+' '+igPl(target.corners,'угол','угла','углов')+'. Это '+target.n+'.' };
    }
    const opts=igNear(target.corners,[1,-1,2,-2],2,7);
    return { promptHtml:'<div class="shape-show">'+target.svg+'</div>',
      prompt:'Сколько у фигуры «'+target.n+'» углов?',
      speak:'Это '+target.n+'. Посчитай уголки по порядку: сколько их?',
      options:opts.map(o=>({t:String(o),cls:'text'})), answer:opts.indexOf(target.corners),
      hint:'Обводи фигуру пальчиком и считай уголки: '+igPl(target.corners,'угол','угла','углов')+'.' };
  };
};

/* ============================================================
   2. Дом для фигуры: ключик открывает дверь той же формы (зан. 26)
   ============================================================ */
GEN['ig.houses']=function(){
  const known=SHAPES.filter(s=>['круг','квадрат','треугольник','прямоугольник'].indexOf(s.n)>=0);
  return function(){
    const target=pick(IG_FIGURES.concat(known));
    const doors=shuffle([target].concat(pickN(IG_FIGURES.concat(known).filter(s=>s.n!==target.n), 2)));
    return { promptHtml:'<div class="pet-row ig-keyrow"><span class="ig-key">'+target.svg+'</span></div>'+
        '<div class="pet-row ig-doorrow">'+doors.map(d=>'<span class="ig-doorprev">'+igDoorSvg(d,110)+'</span>').join('')+'</div>',
      prompt:'К какой двери подойдёт этот ключик?',
      speak:'Кирочка строит башенку из фигур. Ключик в форме '+igFigGen(target.n)+' подходит только к такой же двери. Нажми на нужную дверь.',
      options:doors.map(d=>({html:igDoorSvg(d,120), label:d.n, cls:'pic-opt'})), answer:doors.indexOf(target),
      hint:'Дверь должна быть такой же формы, как ключик: это '+target.n+'.' };
  };
};

/* ============================================================
   3. Мешки по двум правилам (зан. 3–5 и 12: форма И цвет сразу)
   ============================================================ */
GEN['ig.tworules']=function(){
  return function(){
    const K=Object.keys(P_COLORS);
    const cA=pick(K), cB=pick(K.filter(c=>c!==cA));
    const shB=pick(P_SHAPES), shA=pick(P_SHAPES.filter(s=>s!==shB));
    const shC=pick(P_SHAPES.filter(s=>s!==shA&&s!==shB));
    /* правила не пересекаются: во второй мешок — все фигурки формы shB
       (любого цвета), в первый — фигурки цвета cA другой формы. Так ответ один. */
    const bins=[
      {id:'a', emoji:pSvg(shA,cA,32)+pSvg(shC,cA,32), label:'всё '+B_GENIT[cA]+' цвета'},
      {id:'b', emoji:pSvg(shB,cA,32)+pSvg(shB,cB,32), label:'все '+B_PLURAL[shB]}
    ];
    const inB=Math.random()<.5;
    const color=inB?cB:cA, shape=inB?shB:shA;
    return { prompt:'Клади фигурку по двум правилам',
      speak:'Играем по двум правилам сразу. Во второй мешок кладём все '+B_PLURAL[shB]+' — любого цвета. А в первый мешок кладём все фигуры '+B_GENIT[cA]+' цвета, но только не '+B_PLURAL[shB]+'. В какой мешок положить '+color+' '+shape+'?',
      item:{cat:(inB?'b':'a'), t:color+' '+shape, emoji:pSvg(shape,color,66)},
      bins:bins,
      hint: inB
        ? 'Это '+color+' '+shape+'. По форме это '+shape+', значит — второй мешок: в него кладём все '+B_PLURAL[shB]+', любого цвета.'
        : 'Это '+color+' '+shape+'. Он '+color+' по цвету и не '+shB+' по форме, значит — первый мешок: в него кладём всё '+B_GENIT[cA]+' цвета.' };
  };
};

/* ============================================================
   4. Пройди по стрелкам (зан. 16 «письма по адресам», лабиринты)
   ============================================================ */
GEN['ig.arrows']=function(){
  const ROWS=3, COLS=4;
  const DIRS={'вверх':[0,-COLS], 'вниз':[0,COLS], 'вправо':[1,0], 'влево':[-1,0]};
  const ARW={'вверх':'↑','вниз':'↓','вправо':'→','влево':'←'};
  const POOL=['🐰','🦊','🐸','🐵','🐷','🐮','🐥','🦔','🐝','🐞','🦋','🐢'];
  return function(){
    let path=null, words=null, guard=0;
    while(!path && guard<80){
      guard++;
      let pos=rnd(ROWS*COLS);
      const p=[pos], w=[], steps=3+(Math.random()<.4?1:0);
      let ok=true;
      for(let s=0;s<steps;s++){
        const cand=Object.keys(DIRS).filter(d=>{
          const nx=(pos%COLS)+DIRS[d][0], ny=Math.floor(pos/COLS)+DIRS[d][1];
          if(nx<0||nx>=COLS||ny<0||ny>=ROWS) return false;
          return p.indexOf(ny*COLS+nx)<0;
        });
        if(!cand.length){ ok=false; break; }
        const d=pick(cand); w.push(d);
        pos=pos+DIRS[d][1]*COLS+DIRS[d][0];
        p.push(pos);
      }
      if(ok && p.length===steps+1) path=p, words=w;
    }
    const items=shuffle(POOL.slice()).slice(0,ROWS*COLS);
    const askStep=Math.random()<.35 && path.length>=4;
    const targetIdx=askStep?path[2]:path[path.length-1];
    const answer=items[targetIdx];
    const opts=shuffle([answer].concat(pickN(items.filter(x=>x!==answer),2)));
    const sayWords=words.map((wd,k)=>(k?'':'по стрелкам: ')+wd+' '+ARW[wd]).join(', ');
    return { promptHtml:igGrid(ROWS,COLS,items,path,{stepIdx:askStep?targetIdx:null}),
      prompt: askStep ? 'На какой картинке Кира была на 3-м шаге?'
                      : 'На какой картинке Кира окажется в конце пути?',
      speak:'Клетки — как улицы, а стрелки показывают путь ('+sayWords+'). '+
            (askStep? 'Считай шаги: первый, второй, третий. На какой картинке Кира была на 3-м шаге?'
                    : 'Иди по стрелкам до флажка. На какой картинке Кира окажется в конце пути?'),
      options:opts.map(o=>({t:o,cls:'emoji-opt'})), answer:opts.indexOf(answer),
      hint:'Путь по шагам: '+path.map((i,k)=>(k+1)+'-й шаг — '+items[i]).join(', ')+'.' };
  };
};

/* ============================================================
   5. Чего не стало? (зан. 9–10: сравнение множеств, пропавший предмет)
   ============================================================ */
GEN['ig.missing']=function(){
  const used={};
  return function(){
    let set,tries=0;
    do{ set=pick(IG_OBJECTS); tries++; }while(used[set.join('')]&&tries<30); used[set.join('')]=1;
    const order=shuffle(set.slice()).slice(0, state.diff==='лёгкий'?3:4);
    const gone=pick(order);
    const pool=IG_OBJECTS.filter(s=>s!==set).reduce((a,s)=>a.concat(s),[]);
    const cand=[]; pool.forEach(x=>{ if(order.indexOf(x)<0 && cand.indexOf(x)<0) cand.push(x); });
    const opts=shuffle([gone].concat(pickN(cand,2)));
    return { memorize:order,
      /* картинки сначала показаны (движок сам спрячет их через несколько секунд) */
      promptHtml:'<div class="pet-row big seqrow">'+order.map(x=>'<span>'+x+'</span>').join('')+'</div>',
      prompt:'Кого не стало?',
      speak:'Запоминай картинки! ... Одну картинку спрятали. Кого из них не стало?',
      options:opts.map(o=>({t:o,cls:'emoji-opt'})), answer:opts.indexOf(gone),
      hint:'Были картинки: '+order.join(' ')+'.' };
  };
};

/* ============================================================
   6. Точки вместо числа (зан. 12–13: карточка с точками = число)
   ============================================================ */
GEN['ig.domino']=function(){
  /* карточка: всего n точек, разбиты на две части — так удобнее считать
     и видно целое и его части (зан. 12–16 «на клубке», «домино») */
  const card=n=>{ const l=Math.floor(n/2); return igDominoSvg(igDotRows(l), igDotRows(n-l), 190); };
  let n=0;
  return function(){
    const mode=(n++%3);
    const max=(state.diff==='лёгкий')?6:9;
    const it=pick(IG_DOMINO.filter(d=>d.n<=max));
    if(mode===0){
      const opts=igNear(it.n,[1,-1,2,-2],1,max);
      return { promptHtml:'<div class="pet-row">'+card(it.n)+'</div>',
        prompt:'Сколько точек на карточке?',
        speak:'На карточке точки вместо числа. Посчитай все точки вместе, слева и справа: сколько их?',
        options:opts.map(o=>({t:String(o),cls:'big-letter'})), answer:opts.indexOf(it.n),
        hint:'Считай точки по порядку, не сбиваясь: '+igPl(it.n,'точка','точки','точек')+'.' };
    }
    if(mode===1){
      const wrongs=IG_DOMINO.filter(d=>d.n!==it.n && d.n<=max+1);
      const chosen=pickN(wrongs,2);
      const opts=shuffle([it].concat(chosen));
      return { prompt:'Найди карточку, где ровно '+it.n+' '+igRus(it.n,'точка','точки','точек'),
        speak:'Найди карточку, на которой ровно '+it.n+' '+igRus(it.n,'точка','точки','точек')+'.',
        options:opts.map(o=>({html:card(o.n), cls:'pic-opt'})), answer:opts.indexOf(it),
        hint:'Посчитай точки на каждой карточке: нужная та, где '+igPl(it.n,'точка','точки','точек')+'.' };
    }
    const dPool=[1,2].filter(d=>it.n+d<=max+1);
    if(!dPool.length){
      const o2=igNear(it.n,[1,-1,2],1,max+1);
      return { promptHtml:'<div class="pet-row">'+card(it.n)+'</div>',
        prompt:'Сколько точек на карточке?',
        speak:'Посчитай все точки на карточке: сколько их?',
        options:o2.map(o=>({t:String(o),cls:'big-letter'})),
        answer:o2.indexOf(it.n), hint:'Считай точки по порядку: их '+it.n+'.' };
    }
    const d=pick(dPool), ans=it.n+d;
    const opts=igNear(ans,[1,-1,2,-2],1,max+1);
    return { promptHtml:'<div class="pet-row">'+card(it.n)+'</div><div class="op-line">'+it.n+' + '+d+' = ?</div>',
      prompt:'К точкам добавили ещё '+d+'. Сколько стало?',
      speak:'На карточке '+it.n+' '+igRus(it.n,'точка','точки','точек')+', к ним добавили ещё '+d+'. Сколько стало?',
      options:opts.map(o=>({t:String(o),cls:'big-letter'})), answer:opts.indexOf(ans),
      hint:'Было '+it.n+', стало на '+d+' больше: '+ans+'.' };
  };
};

/* ============================================================
   7. Числовой заборчик: число между двумя другими (зан. 10, 20)
   ============================================================ */
GEN['ig.fence']=function(){
  const mx=(state.diff==='лёгкий')?7:(state.diff==='средний'?9:10);
  return function(){
    /* три дощечки подряд: a, a+1, a+2 — одну из них прячем (на ней знак вопроса).
       так ответ всегда один и ребёнок видит, что числа идут подряд */
    const a=1+rnd(Math.max(1,mx-2));
    const row=[a,a+1,a+2];
    const hide=pick([0,1,2]);
    const ans=row[hide];
    const vals=row.map((v,i)=> i===hide ? '?' : v);
    /* обманки близко к верному, но не те числа, что уже видны на заборчике */
    const cand=[]; for(let v=Math.max(1,ans-3); v<=Math.min(mx,ans+3); v++) if(row.indexOf(v)<0) cand.push(v);
    const opts=shuffle([ans].concat(pickN(cand,2)));
    return { promptHtml:igFenceSvg(vals),
      prompt:'Какое число спряталось на дощечке?',
      speak:'Числовой заборчик: числа стоят по порядку, каждое следующее на один больше. На одной дощечке вместо числа знак вопроса. Какое число там спряталось?',
      options:opts.map(o=>({t:String(o),cls:'big-letter'})), answer:opts.indexOf(ans),
      hint:'Числа идут подряд: '+row.join(', ')+'. Значит, на дощечке со знаком вопроса стоит '+ans+'.' };
  };
};

/* ============================================================
   8. На сколько длиннее? (зан. 22: сравнение длин по клеткам)
   ============================================================ */
GEN['ig.jars']=function(){
  const PINK='#e0245e', BLUE='#2f7ae5';
  return function(){
    const maxCells=(state.diff==='лёгкий')?7:12;
    /* розовая лента всегда длиннее: её край выступает за край синей на d клеток.
       обе ленты начинаются у левой клеточки — так сравнение честно и наглядно */
    const d=1+rnd(3);
    const short=2+rnd(Math.max(1,maxCells-2-d));
    const long=short+d;
    const opts=igNear(d,[1,-1,2],1,maxCells);
    return { promptHtml:'<div class="pet-row ig-ribbons">'+igRibbon(long,PINK,32)+
        '<div class="ig-gap"></div>'+igRibbon(short,BLUE,32)+'</div>'+
        '<div class="ig-rib-note">Ленты начинаются у одной клеточки — посмотри на их правые края.</div>',
      prompt:'На сколько клеток розовая лента длиннее синей?',
      speak:'Две ленты лежат на клетках и начинаются у одной клеточки. На сколько клеток розовая лента длиннее синей?',
      options:opts.map(o=>({t:String(o),cls:'text'})), answer:opts.indexOf(d),
      hint:'Синяя лента занимает столько же клеток, сколько розовая, но розовая выступает за её край ровно на '+
           d+' '+igRus(d,'клетку','клетки','клеток')+'.' };
  };
};

/* ============================================================
   9. Вкусное сложение (зан. 12–13, 17–18: картинки вместо цифр)
   ============================================================ */
/* слова для озвучки лежат в data4.js (IG_WORDS): там только те картинки,
   у которых простые формы множественного числа, — фраза звучит правильно:
   «2 яблока и 3 груши», «5 груш» */
function igWord(e){ return (IG_WORDS[e]||['кружок','кружка','кружков'])[0]; }
function igWordN(n,e){
  const f=IG_WORDS[e]||['кружок','кружка','кружков'];
  const a=n%10, b=n%100;
  if(a===1 && b!==11) return n+' '+f[0];
  if(a>=2&&a<=4 && !(b>=12&&b<=14)) return n+' '+f[1];
  return n+' '+f[2];
}
GEN['ig.picmath']=function(){
  return function(){
    const set=pick(IG_PICSETS);
    const a=1+rnd((state.diff==='лёгкий')?3:5);
    const b=1+rnd((state.diff==='лёгкий')?2:4);
    const sum=a+b;
    const expr='<div class="pet-row ig-expr"><span class="ig-group">'+set[0].repeat(a)+'</span>'+
      '<span class="ig-op">+</span><span class="ig-group">'+set[1].repeat(b)+'</span>'+
      '<span class="ig-op">=</span><span class="ig-q">?</span></div>';
    if(state.diff==='лёгкий' || Math.random()<.6){
      const opts=igNear(sum,[1,-1,2,-2],1,12);
      return { promptHtml:expr, prompt:'Сколько всего?',
        speak:'Считай по картинкам: '+igWordN(a,set[0])+' и ещё '+igWordN(b,set[1])+'. Сколько всего?',
        options:opts.map(o=>({t:String(o),cls:'text'})), answer:opts.indexOf(sum),
        hint:'Было '+a+', добавили '+b+', всего '+sum+'.' };
    }
    /* ответ тоже картинками: ищем ряд, где предметов столько же */
    const right={n:sum, html:'<span class="ig-group">'+set[0].repeat(sum)+'</span>'};
    const wrongs=igNearVals(sum,[1,-1,2],2,12).slice(0,2).map(v=>({n:v, html:'<span class="ig-group">'+set[0].repeat(v)+'</span>'}));
    const opts=shuffle([right].concat(wrongs));
    return { promptHtml:expr, prompt:'Где столько же?',
      speak:'Посчитай по картинкам и выбери ряд, где предметов столько же, сколько получилось.',
      options:opts.map(o=>({html:o.html, cls:'emoji-opt ig-opt'})), answer:opts.indexOf(right),
      hint:'Получилось '+igWordN(sum,set[0])+'. Верный ряд тот, где ровно '+sum+'.' };
  };
};

/* ============================================================
   10. Магазин: цена, оплата, сдача (зан. 16: целое и части)
   ============================================================ */
GEN['ig.shop']=function(){
  const mx=(state.diff==='лёгкий')?7:10;
  let n=0;
  return function(){
    const mode=(n++%2);
    const g=pick(IG_GOODS);
    const price=1+rnd(mx-3);
    if(mode===0){
      const paid=price+1+rnd(Math.max(1,mx-price));
      const change=paid-price;
      const opts=igNear(change,[1,-1,2,-2],1,10);
      return { picture:g.e, pictureWord:cap(g.t),
        promptHtml:'<div class="op-line ig-coinrow">'+price+' <span class="ig-coin">🪙</span> &nbsp;→&nbsp; заплатила '+paid+' <span class="ig-coin">🪙</span> &nbsp;→&nbsp; сдача ?</div>',
        prompt:'Сколько сдачи?',
        speak:'Кира купила «'+g.t+'» за '+igCoin(price)+' и дала продавцу '+igCoin(paid)+'. Сколько монет продавец вернёт обратно — сколько это сдачи?',
        options:opts.map(o=>({t:String(o),cls:'big-letter'})), answer:opts.indexOf(change),
        hint:'Цена '+igCoin(price)+', Кира дала '+igCoin(paid)+', значит сдача — '+igCoin(change)+'.' };
    }
    const change=1+rnd(Math.max(1,Math.min(3,mx-price-1)));
    const paid=price+change;
    const opts=igNear(paid,[1,-1,2,-2],2,12);
    return { picture:g.e, pictureWord:cap(g.t),
      promptHtml:'<div class="op-line ig-coinrow">'+price+' <span class="ig-coin">🪙</span> &nbsp;+&nbsp; сдача '+change+' <span class="ig-coin">🪙</span> &nbsp;→&nbsp; заплатила ?</div>',
      prompt:'Сколько денег дала Кира?',
      speak:'«'+g.t+'» стоит '+igCoin(price)+', а сдача была '+igCoin(change)+'. Сколько монет Кира дала продавцу?',
      options:opts.map(o=>({t:String(o),cls:'big-letter'})), answer:opts.indexOf(paid),
      hint:'Цена и сдача вместе — это все деньги Киры: '+price+' + '+change+' = '+paid+', значит она дала '+igCoin(paid)+'.' };
  };
};

/* ============================================================
   11. Поезд: вагоны слева и справа от середины (зан. 20–21)
   ============================================================ */
GEN['ig.train']=function(){
  const COLORS=[['красный','#e0344f'],['синий','#2f7ae5'],['жёлтый','#f0a70c'],['зелёный','#22a55b'],['фиолетовый','#7c5cd6']];
  return function(){
    const cL=pick(COLORS), cR=pick(COLORS.filter(c=>c[0]!==cL[0]));
    /* 5 вагонов: №1 и №2 — левее середины, №4 и №5 — правее, №3 — посередине */
    const bins=[
      {id:'l', emoji:igWagonSvg(cL[1])+igWagonSvg(cL[1],0), label:'вагоны слева — '+IG_COLOR_PL[cL[0]] },
      {id:'r', emoji:igWagonSvg(cR[1])+igWagonSvg(cR[1],0), label:'вагоны справа — '+IG_COLOR_PL[cR[0]] }
    ];
    const side=(Math.random()<.5)?'l':'r';
    const num=(side==='l')?(1+rnd(2)):(4+rnd(2));
    const col=(side==='l')?cL:cR;
    return { prompt:'Правило: слева и справа от середины',
      promptHtml:igTrainSvg([cL[1],cL[1],'#ffffff',cR[1],cR[1]], num-1),
      speak:'Паровозик слева. Вагоны, которые левее середины, красим в '+cL[0]+' цвет, а вагоны правее середины — в '+cR[0]+'. А вагончик посередине остаётся белым. Вагончик номер '+num+' — куда его положить?',
      item:{cat:side, t:'вагончик номер '+num, emoji:igWagonSvg(col[1],num,66)},
      bins:bins,
      hint:'Считаем вагоны слева направо: 1, 2, 3, 4, 5. Середина — вагон 3. Вагон '+num+' стоит '+(num<3?'левее середины':'правее середины')+', значит он '+col[0]+'.' };
  };
};

/* ============================================================
   12. Дни недели и число 7 (зан. 20)
   ============================================================ */
GEN['ig.days']=function(){
  function row(show){
    return '<div class="pet-row ig-days">'+IG_DAYS.map((d,i)=>
      show[i] ? '<span class="ig-day">'+d+'</span>' : '<span class="ig-day ig-day-q">?</span>').join('')+'</div>';
  }
  let n=0;
  return function(){
    const mode=(n++%3);
    if(mode===0){
      const i=rnd(5), ans=IG_DAYS[i+1];
      const opts=shuffle([ans].concat(pickN(IG_DAYS.filter(d=>d!==ans),2)));
      return { promptHtml:row(IG_DAYS.map((d,k)=>k<=i)),
        prompt:'Какой день идёт сразу за '+IG_DAYS_INS[i]+'?',
        speak:'Неделя начинается с понедельника, и в неделе семь дней. Какой день идёт сразу за '+IG_DAYS_INS[i]+'?',
        options:opts.map(o=>({t:o,cls:'long'})), answer:opts.indexOf(ans),
        hint:'Дни недели по порядку: '+IG_DAYS.join(', ')+'.' };
    }
    if(mode===1){
      const k=1+rnd(5), ans=IG_DAYS[k];
      const opts=shuffle([ans].concat(pickN(IG_DAYS.filter(d=>d!==ans),2)));
      return { promptHtml:row(IG_DAYS.map((d,i)=>i!==k)),
        prompt:'Какой день спрятался?',
        speak:'Дни недели идут по порядку, но один день спрятали. Какой день пропущен?',
        options:opts.map(o=>({t:o,cls:'long'})), answer:opts.indexOf(ans),
        hint:'В неделе семь дней: '+IG_DAYS.join(', ')+'.' };
    }
    const i=1+rnd(5), ans=IG_DAYS[i-1];
    const opts=shuffle([ans].concat(pickN(IG_DAYS.filter(d=>d!==ans&&d!==IG_DAYS[i+1]),2)));
    return { promptHtml:row(IG_DAYS.map((d,k)=> k!==i-1)),
      prompt:'Какой день был сразу перед '+IG_DAYS_INS[i]+'?',
      speak:'Неделя начинается с понедельника. Какой день был сразу перед '+IG_DAYS_INS[i]+'?',
      options:opts.map(o=>({t:o,cls:'long'})), answer:opts.indexOf(ans),
      hint:'Дни недели по порядку: '+IG_DAYS.join(', ')+'.' };
  };
};

/* ============================================================
   13. Сосчитай в сцене (зан. 19: считаем множество и сравниваем)
   ============================================================ */
/* формы слов сцены (pl — именительный множ. для подписей, gen — родительный для вопроса)
   лежат в data4.js рядом со сценами: IG_NOUNS и IG_WORDS */
function igPlOf(t){ return (IG_NOUNS[t]&&IG_NOUNS[t].pl)||t; }
function igGenOf(t){ return (IG_NOUNS[t]&&IG_NOUNS[t].gen)||t; }
GEN['ig.scene']=function(){
  return function(){
    const sc=pick(IG_SCENES);
    const mx=(state.diff==='лёгкий')?6:8;
    const counts=igDistinctCounts(mx);
    /* подписи без числа: иначе ответ виден сразу в подписи */
    const html='<div class="ig-scene"><div class="ig-scene-title">'+cap(sc.name)+'</div>'+
      sc.its.map((it,i)=>'<div class="ig-scene-row"><span class="ig-scene-emo">'+it.e.repeat(counts[i])+'</span>'+
        '<span class="ig-scene-lab">'+cap(igPlOf(it.t))+'</span></div>').join('')+'</div>';
    const pair=pick([[0,1],[1,2],[0,2]]);
    const A=sc.its[pair[0]], B=sc.its[pair[1]];
    const ca=counts[pair[0]], cb=counts[pair[1]];
    /* всегда спрашиваем про те виды, где количество действительно отличается */
    const big=(ca>cb)?A:B, small=(ca>cb)?B:A;
    const nBig=Math.max(ca,cb), nSmall=Math.min(ca,cb), d=nBig-nSmall;
    if(Math.random()<.5){
      const opts=shuffle([big.t, small.t, sc.its[pair[0]===0?2:0].t].filter((v,i,arr)=>arr.indexOf(v)===i));
      return { promptHtml:html, prompt:'Кого больше: '+igPlOf(big.t)+' или '+igPlOf(small.t)+'?',
        speak:'Посчитай, сколько '+igGenOf(big.t)+', а сколько '+igGenOf(small.t)+'. Кого больше?',
        options:opts.map(o=>({t:cap(igPlOf(o)),cls:'long'})), answer:opts.indexOf(big.t),
        hint:cap(igGenOf(big.t))+' — '+nBig+', а '+igGenOf(small.t)+' — '+nSmall+
             '. Значит, больше тех, кого '+nBig+': '+cap(igPlOf(big.t))+'.' };
    }
    const opts=igNear(d,[1,-1,2],1,mx);
    return { promptHtml:html,
      prompt:'На сколько '+igGenOf(big.t)+' больше, чем '+igGenOf(small.t)+'?',
      speak:'Посчитай, сколько '+igGenOf(big.t)+' и сколько '+igGenOf(small.t)+'. На сколько '+igGenOf(big.t)+' больше, чем '+igGenOf(small.t)+'?',
      options:opts.map(o=>({t:String(o),cls:'text'})), answer:opts.indexOf(d),
      hint:cap(igGenOf(big.t))+' — '+nBig+', '+igGenOf(small.t)+' — '+nSmall+'. Разница — '+
           igPl(d,'предмет','предмета','предметов')+'.' };
  };
};

/* ============================================================
   14. Читаю числа (зан. 14–16: числа и цифры вместо букв)
   ============================================================ */
GEN['ig.readnum']=function(){
  const mx=(state.diff==='лёгкий')?5:(state.diff==='средний'?8:10);
  return function(){
    const k=2+rnd(mx-2);
    const em=pick(COUNT_EMOJIS);
    if(Math.random()<.5){
      const opts=igNear(k,[1,-1,2,-2],1,mx+1);
      return { promptHtml:'<div class="op-line ig-numread">'+k+'</div>',
        prompt:'Прочитай число: сколько это предметов?',
        speak:'Прочитай число '+k+'. Выбери ряд, где предметов ровно столько.',
        options:opts.map(o=>({html:'<span class="ig-group">'+em.repeat(o)+'</span>', cls:'emoji-opt ig-opt'})),
        answer:opts.indexOf(k),
        hint:'Число '+k+' — это ровно '+k+' предметов.' };
    }
    const opts=igNear(k,[1,-1,2,-2],1,mx+1);
    return { promptHtml:'<div class="pet-row"><span class="ig-group">'+em.repeat(k)+'</span></div>',
      prompt:'Сколько предметов? Выбери число',
      speak:'Посчитай предметы и найди нужное число.',
      options:opts.map(o=>({t:String(o),cls:'big-letter'})), answer:opts.indexOf(k),
      hint:'Предметов '+k+', значит это число '+k+'.' };
  };
};

/* карта тетради «Игралочка» нарисована прямо в index.html (таблица #igmap-table),
   а её содержимое подставляет app.js в панели «Для взрослых».
   Сами игры и список пособий вклеены в data4.js — он грузится до app.js,
   поэтому главная сразу показывает все игры и верное их число в каждой теме. */
