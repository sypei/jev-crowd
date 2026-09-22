const dilemma=document.querySelector("#dilemma");
const statusEl=document.querySelector("#status");
const modeBadge=document.querySelector("#modeBadge");
const crowdEl=document.querySelector("#crowd");
const arena=document.querySelector("#arena");
const resultMessage=document.querySelector("#resultMessage");
const resultMessageTitle=document.querySelector("#resultMessageTitle");
const resultMessageDetail=document.querySelector("#resultMessageDetail");

const presets={
  trolley:"A runaway trolley will kill five people unless you pull a lever that redirects it onto another track where it will kill one person. Do you pull the lever?",
  medicine:"A pharmacist has a medicine that would save a stranger's life, but the patient cannot afford it and the pharmacist refuses to lower the price. Is it right to steal the medicine to save the person?",
  promise:"You promised a close friend you would never reveal their secret. Later you learn that revealing it would prevent serious harm to a stranger. Do you break the promise?",
  lifeboat:"A lifeboat is overloaded and will sink unless one passenger leaves. If nobody volunteers, is it right for the group to choose one person to remove so everyone else survives?"
};

const PEOPLE=50,people=[];
let debounceTimer=null,requestId=0,lastFrame=performance.now();
const reduceMotion=window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function rand(seed){
  const x=Math.sin(seed*91.73+17.11)*43758.5453;
  return x-Math.floor(x);
}

function makePerson(i){
  const el=document.createElement("div");
  el.className="person";
  el.innerHTML='<span class="head"></span><span class="body"></span><span class="leg a"></span><span class="leg b"></span>';
  crowdEl.appendChild(el);
  const camp=i%2===0?"act":"dont_act";
  people.push({
    el,camp,
    x:arena.clientWidth*.5+(rand(i+1)-.5)*40,
    y:arena.clientHeight*.5+(rand(i+101)-.5)*40,
    tx:0,ty:0,
    speed:42+rand(i+201)*34,
    wanderAt:0,
    seed:i+1
  });
}
for(let i=0;i<PEOPLE;i++)makePerson(i);

function campPoint(camp,p,wandering=false){
  const w=arena.clientWidth,h=arena.clientHeight,mobile=w<620;
  const cx=camp==="act"?w*(mobile?.24:.20):w*(mobile?.76:.80);
  const cy=h*(mobile?.66:.60);
  const spreadX=w*(mobile?.18:.16);
  const spreadY=h*.22;
  const salt=wandering?performance.now()*.0003:0;
  const jx=rand(p.seed*3.1+salt)-.5;
  const jy=rand(p.seed*7.7+salt*1.7)-.5;
  return{
    x:Math.max(18,Math.min(w-18,cx+jx*spreadX)),
    y:Math.max(58,Math.min(h-54,cy+jy*spreadY))
  };
}

function setDestination(p,wandering=false){
  const t=campPoint(p.camp,p,wandering);
  p.tx=t.x;p.ty=t.y;
  p.wanderAt=performance.now()+900+rand(p.seed+performance.now()*.001)*1800;
}

function normalize(p){
  const out={
    act:Math.max(0,Number(p?.act||0)),
    dont_act:Math.max(0,Number(p?.dont_act||0))
  };
  const s=out.act+out.dont_act||1;
  out.act/=s;
  out.dont_act/=s;
  return out;
}

function desiredCounts(probs){
  const act=Math.round(probs.act*PEOPLE);
  return{act,dont_act:PEOPLE-act};
}

function assignPeople(probs){
  const counts=desiredCounts(probs);
  const by={act:[],dont_act:[]};
  people.forEach(p=>by[p.camp].push(p));

  const surplus=[];
  for(const camp of ["act","dont_act"]){
    while(by[camp].length>counts[camp])surplus.push(by[camp].pop());
  }

  for(const camp of ["act","dont_act"]){
    while(by[camp].length<counts[camp]&&surplus.length){
      const p=surplus.shift();
      p.camp=camp;
      by[camp].push(p);
      setDestination(p,false);
    }
  }

  people.forEach(p=>{
    if(!Number.isFinite(p.tx)||!Number.isFinite(p.ty)||(!p.tx&&!p.ty))setDestination(p,false);
  });
}

function setScores(p){
  document.querySelector("#score-act").textContent=`${Math.round(p.act*100)}%`;
  document.querySelector("#score-dont_act").textContent=`${Math.round(p.dont_act*100)}%`;
}

function showBanner(title,detail){
  resultMessageTitle.textContent=title;
  resultMessageDetail.textContent=detail;
  resultMessage.hidden=false;
}

function hideBanner(){
  resultMessage.hidden=true;
}

function animate(now){
  const dt=Math.min(.04,(now-lastFrame)/1000||0);
  lastFrame=now;

  for(const p of people){
    if(!p.tx&&!p.ty)setDestination(p,false);

    let dx=p.tx-p.x,dy=p.ty-p.y;
    let dist=Math.hypot(dx,dy);

    if(dist<5){
      p.el.classList.remove("walking");
      if(now>=p.wanderAt){
        setDestination(p,true);
        dx=p.tx-p.x;dy=p.ty-p.y;dist=Math.hypot(dx,dy);
      }
    }

    if(dist>=5){
      p.el.classList.add("walking");
      p.el.classList.toggle("facing-left",dx<0);
      if(reduceMotion){
        p.x=p.tx;p.y=p.ty;
      }else{
        const step=Math.min(dist,p.speed*dt);
        p.x+=dx/dist*step;
        p.y+=dy/dist*step;
      }
    }

    p.el.style.transform=`translate3d(${p.x}px,${p.y}px,0) translate(-50%,-50%)`;
  }

  requestAnimationFrame(animate);
}

async function classify(text){
  const id=++requestId;
  hideBanner();
  statusEl.textContent="Jev is deciding…";
  try{
    const response=await fetch("/api/classify",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({text})});
    const data=await response.json();
    if(id!==requestId)return;
    if(!response.ok)throw new Error(data.error||"Classification failed.");

    modeBadge.textContent=data.mode==="jev"?"LIVE JEV":"PREVIEW";
    if(!data.allowed){
      showBanner("Not classified","This prompt appears outside the fictional-dilemma scope. Real-world harm plans, wrongdoing instructions, self-harm, political persuasion, targeted hate or harassment, and judgments about identifiable people aren't classified. The crowd still shows the last result.");
      statusEl.textContent="This prompt appears to be outside the playground's scope.";
      return;
    }

    const probs=normalize(data.probabilities);
    setScores(probs);
    assignPeople(probs);
    hideBanner();
    statusEl.textContent=data.mode==="jev"?"Live Jev result.":"Preview mode.";
  }catch(err){
    if(id===requestId){
      showBanner("Could not classify","The crowd still shows the last result. Please try again or choose another example.");
      statusEl.textContent=err.message||"Could not classify right now.";
    }
  }
}

function schedule(){
  clearTimeout(debounceTimer);
  requestId++;
  const text=dilemma.value.trim();
  if(!text){
    hideBanner();
    statusEl.textContent="Type to probe Jev.";
    return;
  }
  hideBanner();
  debounceTimer=setTimeout(()=>classify(text),180);
}

dilemma.addEventListener("input",schedule);
document.querySelectorAll("[data-preset]").forEach(button=>button.addEventListener("click",()=>{
  dilemma.value=presets[button.dataset.preset];
  dilemma.focus();
  schedule();
}));

window.addEventListener("resize",()=>{
  for(const p of people)setDestination(p,false);
});

people.forEach(p=>setDestination(p,false));
requestAnimationFrame(animate);
dilemma.value=presets.trolley;
classify(dilemma.value);
