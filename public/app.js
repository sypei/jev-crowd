const dilemma=document.querySelector("#dilemma");
const statusEl=document.querySelector("#status");
const modeBadge=document.querySelector("#modeBadge");
const crowdEl=document.querySelector("#crowd");
const arena=document.querySelector("#arena");

const presets={
  trolley:"A runaway trolley will kill five people unless you pull a lever that redirects it onto another track where it will kill one person. Do you pull the lever?",
  medicine:"A pharmacist has a medicine that would save a stranger's life, but the patient cannot afford it and the pharmacist refuses to lower the price. Is it right to steal the medicine to save the person?",
  promise:"You promised a close friend you would never reveal their secret. Later you learn that revealing it would prevent serious harm to a stranger. Do you break the promise?",
  lifeboat:"A lifeboat is overloaded and will sink unless one passenger leaves. If nobody volunteers, is it right for the group to choose one person to remove so everyone else survives?"
};

const PEOPLE=50, people=[];
let debounceTimer=null,requestId=0;

function makePerson(i){
  const el=document.createElement("div");
  el.className="person";
  el.innerHTML='<span class="head"></span><span class="body"></span><span class="leg a"></span><span class="leg b"></span>';
  crowdEl.appendChild(el);
  people.push({el,camp:i%2===0?"act":"dont_act",x:50,y:50});
}
for(let i=0;i<PEOPLE;i++)makePerson(i);

function jitter(index,salt=0){
  const x=Math.sin((index+1)*91.73+salt*17.11)*43758.5453;
  return x-Math.floor(x);
}

function targetFor(camp,index){
  const w=arena.clientWidth,h=arena.clientHeight,mobile=w<620;
  const jx=jitter(index,1)-.5,jy=jitter(index,2)-.5;
  if(camp==="act")return{x:w*(mobile?.25:.20)+jx*w*.22,y:h*(mobile?.68:.61)+jy*h*.25};
  if(camp==="dont_act")return{x:w*(mobile?.75:.80)+jx*w*.22,y:h*(mobile?.68:.61)+jy*h*.25};
}

function normalize(p){
  const out={act:Math.max(0,Number(p?.act||0)),dont_act:Math.max(0,Number(p?.dont_act||0))};
  const s=out.act+out.dont_act+out.conflicted||1;
  Object.keys(out).forEach(k=>out[k]/=s);
  return out;
}

function desiredCounts(probs){
  const rows=Object.entries(probs).map(([key,value])=>({key,raw:value*PEOPLE,n:Math.floor(value*PEOPLE)}));
  let used=rows.reduce((s,r)=>s+r.n,0);
  rows.sort((a,b)=>(b.raw-b.n)-(a.raw-a.n));
  for(let i=0;used<PEOPLE;i++,used++)rows[i%rows.length].n++;
  return Object.fromEntries(rows.map(r=>[r.key,r.n]));
}

function assignPeople(probs){
  const counts=desiredCounts(probs);
  const by={act:[],dont_act:[]};
  people.forEach(p=>by[p.camp].push(p));
  const surplus=[];
  Object.keys(by).forEach(c=>{while(by[c].length>counts[c])surplus.push(by[c].pop())});
  ["act","dont_act"].forEach(c=>{
    while(by[c].length<counts[c]&&surplus.length){
      const p=surplus.shift();p.camp=c;by[c].push(p);
    }
  });
  people.forEach((p,i)=>{
    const t=targetFor(p.camp,i),dist=Math.hypot(t.x-p.x,t.y-p.y);
    p.el.classList.toggle("running",dist>24);
    p.el.style.transitionDuration=`${Math.max(.35,Math.min(1.05,dist/360+.28))}s`;
    p.el.style.left=`${t.x}px`;
    p.el.style.top=`${t.y}px`;
    p.x=t.x;p.y=t.y;
    setTimeout(()=>p.el.classList.remove("running"),1150);
  });
}

function setScores(p){
  document.querySelector("#score-act").textContent=`${Math.round(p.act*100)}%`;
  document.querySelector("#score-dont_act").textContent=`${Math.round(p.dont_act*100)}%`;
}

async function classify(text){
  const id=++requestId;
  statusEl.textContent="Jev is deciding…";
  try{
    const response=await fetch("/api/classify",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({text})});
    const data=await response.json();
    if(id!==requestId)return;
    if(!response.ok)throw new Error(data.error||"Classification failed.");

    modeBadge.textContent=data.mode==="jev"?"LIVE JEV":"PREVIEW";
    if(!data.allowed){
      const probs={act:.5,dont_act:.5};
      setScores(probs);
      assignPeople(probs);
      statusEl.textContent="Try a fictional moral dilemma.";
      return;
    }

    const probs=normalize(data.probabilities);
    setScores(probs);
    assignPeople(probs);
    statusEl.textContent=data.mode==="jev"?"Live Jev result.":"Preview mode.";
  }catch(err){
    if(id===requestId)statusEl.textContent=err.message||"Could not classify right now.";
  }
}

function schedule(){
  clearTimeout(debounceTimer);
  const text=dilemma.value.trim();
  if(!text){statusEl.textContent="Type to probe Jev.";return}
  debounceTimer=setTimeout(()=>classify(text),180);
}

dilemma.addEventListener("input",schedule);
document.querySelectorAll("[data-preset]").forEach(button=>button.addEventListener("click",()=>{
  dilemma.value=presets[button.dataset.preset];
  dilemma.focus();
  schedule();
}));

function layout(){
  people.forEach((p,i)=>{
    const t=targetFor(p.camp,i);
    p.x=t.x;p.y=t.y;
    p.el.style.left=`${t.x}px`;
    p.el.style.top=`${t.y}px`;
  });
}
window.addEventListener("resize",()=>requestAnimationFrame(layout));
requestAnimationFrame(layout);
