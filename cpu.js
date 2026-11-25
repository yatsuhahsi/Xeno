// CPU decision policy: only public view and its own private view enter this module.
// Strength is a heuristic, not a claim of game-theoretic optimality.
const counts=[0,2,2,2,2,2,2,2,2,1,1];
const random=()=>{const a=new Uint32Array(1);crypto.getRandomValues(a);return a[0]/4294967296};
const pick=(a,rng)=>a[Math.min(a.length-1,Math.floor(rng()*a.length))];
const sum=(a,f)=>a.reduce((t,x)=>t+f(x),0);
const dist=(pool)=>{const n=sum(pool,x=>x);return n?pool.map((v,i)=>({n:i,p:v/n})).filter(x=>x.p>0):Array.from({length:10},(_,i)=>({n:i+1,p:.1}))};
const val=n=>[0,0.6,2,2.8,3.6,4.4,5.3,6.4,7.3,8.7,10][n]||0;
export function newMemory(){return {round:-1,known:{},prev:null,lastEvent:'',belief:{},exposed:{},signal:null,shuffleToken:""}}
export function observe(mem,pub,priv,u){
 if(pub.order.length!==2)return observeMulti(mem,pub,priv,u);
 if(mem.round!==pub.round){mem.round=pub.round;mem.known={};mem.prev=null;mem.lastEvent='';mem.belief={};mem.exposed={};mem.signal=null;mem.shuffleToken="";mem.ownMix=[];mem.otherMix=[]}
 const old=mem.prev;const oldKnown={...mem.known},oldExposed={...mem.exposed};const ids=new Set(Object.values(pub.players).flatMap(p=>p.hand.map(c=>c.id)));
 for(const id of Object.keys(mem.known))if(!ids.has(id))delete mem.known[id];
 for(const [v,p] of Object.entries(pub.players))if(v!==u)for(const c of p.hand)if(c.n)mem.known[c.id]=c.n;
 if(['reveal','duel'].includes(pub.phase)&&priv.peek?.length){const t=pub.turn===u?pub.target:pub.turn;const h=pub.players[t]?.hand;if(h?.length===1)mem.known[h[0].id]=priv.peek[0].n;}
 // Exchange reveals the card given away by the CPU, even if the other player draws immediately.
 const events=pub.events||[],ix=events.findIndex(e=>e.id===mem.lastEvent),recent=mem.lastEvent&&ix>=0?events.slice(ix+1):[pub.event];
 if(old)for(const e of recent.filter(Boolean))if(e.type==='exchange'&&[e.from,e.to].includes(u)){
  const t=e.from===u?e.to:e.from;const usedCard=recent.find(x=>x?.type==='use'&&x.from===u);const given=old.hand.length===1?old.hand[0]:old.hand.find(c=>c.n!==usedCard?.n)||old.hand[0];const h=pub.players[t]?.hand||[];const drawn=new Set(recent.filter(x=>x?.type==='draw'&&x.to===t).map(x=>x.card));const existing=h.filter(c=>!drawn.has(c.id));if(given&&existing.length===1)mem.known[existing[0].id]=given.n;
 }
 // Only observations visible to the CPU are retained. IDs of shuffled cards are never linked.
 const weights=mem.belief??={};const exposed=mem.exposed??={};
 const me=pub.players[u];const other=pub.order.find(v=>v!==u);const oh=pub.players[other]?.hand||[];
 const ownIds=new Set(priv.hand.map(c=>c.id));
 for(const id of Object.keys(exposed))if(!ownIds.has(id))delete exposed[id];
 for(const c of me.hand)if(c.n)exposed[c.id]=c.n;
 for(const e of recent.filter(Boolean)){
  if(e.type==='peekReveal'&&e.to===u||e.type==='duelReveal'&&[e.from,e.to].includes(u))for(const c of priv.hand)exposed[c.id]=c.n;
  if(e.type==='shuffle'&&e.to===u){mem.shuffleToken=pub.token;mem.ownMix=pub.phase==='play'?Object.values(oldExposed):[];}
  if(e.type==='shuffle'&&e.to===other&&old){
   const ks=old.publicHand.map(c=>oldKnown[c.id]).filter(Boolean);mem.otherMix=pub.phase==='play'?ks:[];
   // The position is lost, but an already-seen value remains among the two cards.
   if(ks.length){const p=counts.slice();for(const q of Object.values(pub.players))for(const n of q.discard)p[n]--;for(const c of priv.hand)p[c.n]--;const total=p.reduce((a,b)=>a+Math.max(0,b),0);for(const c of oh)weights[c.id]=p.map((x,n)=>n?(.5+(x>0?ks.filter(k=>k===n).length*total/(2*x):0)):0);}
  }
  if(e.type==='use'&&e.from===u&&mem.ownMix?.length){let k=mem.ownMix.slice(),i=k.indexOf(e.n);if(i>=0)k.splice(i,1);if(k.length===1&&priv.hand.length===1&&priv.hand[0].n===k[0])exposed[priv.hand[0].id]=k[0];mem.ownMix=[];}
  if(e.type==='use'&&e.from===other&&mem.otherMix?.length){let k=mem.otherMix.slice(),i=k.indexOf(e.n);if(i>=0)k.splice(i,1);const drawn=new Set(recent.filter(x=>x?.type==='draw'&&x.to===other).map(x=>x.card));const remain=oh.filter(c=>!drawn.has(c.id));if(k.length===1&&remain.length===1)mem.known[remain[0].id]=k[0];mem.otherMix=[];}
  if(['exchange','rebirth'].includes(e.type)){mem.ownMix=[];mem.otherMix=[];}
  if(e.type==='exchange'&&[e.from,e.to].includes(u)){
   const drawn=new Set(recent.filter(x=>x?.type==='draw'&&x.to===u).map(x=>x.card));
   for(const c of priv.hand)if(!drawn.has(c.id))exposed[c.id]=c.n;
  }
  if(e.type==='use'&&e.from===other&&old){
   const before=old.publicHand||[];const kept=oh.filter(c=>before.some(b=>b.id===c.id));
   for(const c of kept){if(mem.known[c.id])continue;const w=weights[c.id]||Array(11).fill(1);
    weights[c.id]=w.map((x,n)=>n?(x===0?0:Math.max(.03,x*(n===10?1.9:n>e.n?1.28:n===e.n?1:.72))):0);
   }
  }
  if(e.type==='guessResult'&&!e.hit&&e.to===other){const h=oh[0];if(h){const w=weights[h.id]||Array(11).fill(1);w[e.n]=0;weights[h.id]=w;}}
  if(e.type==='guessResult'&&!e.hit&&e.from===other&&oh.length===1){const h=oh[0];const w=weights[h.id]||Array(11).fill(1);if(!mem.known[h.id])w[e.n]*=.75;weights[h.id]=w;}
  if(e.type==='guessResult'&&e.from===u&&!e.hit)mem.signal={id:priv.hand[0]?.id,n:e.n};
 }
 if(pub.phase!=='play'&&pub.phase!=='pick'&&pub.phase!=='shuffleAsk'){mem.ownMix=[];mem.otherMix=[];}
 for(const id of Object.keys(weights))if(!ids.has(id))delete weights[id];
 if(mem.signal&&!ownIds.has(mem.signal.id))mem.signal=null;
 mem.prev={hand:priv.hand.map(c=>({...c})),publicHand:oh.map(c=>({...c}))};mem.lastEvent=pub.event?.id||'';
}
// Multiplayer observations never use another player's private snapshot.
function observeMulti(mem,pub,priv,u){
 if(mem.round!==pub.round){Object.assign(mem,newMemory(),{round:pub.round});mem.ownMix=[];mem.otherMix=[];}
 const old=mem.prev, ids=new Set(Object.values(pub.players).flatMap(p=>p.hand.map(c=>c.id))), ownIds=new Set(priv.hand.map(c=>c.id));
 for(const id of Object.keys(mem.known))if(!ids.has(id))delete mem.known[id];
 for(const id of Object.keys(mem.belief))if(!ids.has(id))delete mem.belief[id];
 for(const id of Object.keys(mem.exposed))if(!ownIds.has(id))delete mem.exposed[id];
 for(const [v,p] of Object.entries(pub.players))for(const c of p.hand)if(c.n)(v===u?mem.exposed:mem.known)[c.id]=c.n;
 if(['reveal','duel'].includes(pub.phase)&&priv.peek?.length){const t=pub.turn===u?pub.target:pub.turn;const h=pub.players[t]?.hand;if(h?.length===1)mem.known[h[0].id]=priv.peek[0].n;}
 const events=pub.events||[],ix=events.findIndex(e=>e.id===mem.lastEvent),recent=mem.lastEvent&&ix>=0?events.slice(ix+1):[pub.event];
 for(const e of recent.filter(Boolean)){
  if((e.type==='peekReveal'&&e.to===u)||(e.type==='duelReveal'&&[e.from,e.to].includes(u)))for(const c of priv.hand)mem.exposed[c.id]=c.n;
  if(e.type==='shuffle'&&e.to===u)mem.shuffleToken=pub.token;
  if(e.type==='exchange'&&[e.from,e.to].includes(u)&&old){const t=e.from===u?e.to:e.from,drawn=new Set(recent.filter(x=>x?.type==='draw').map(x=>x.card)),used=recent.find(x=>x?.type==='use'&&x.from===u),given=old.hand.length===1?old.hand[0]:old.hand.find(c=>c.n!==used?.n);const h=pub.players[t]?.hand.filter(c=>!drawn.has(c.id));if(given&&h?.length===1)mem.known[h[0].id]=given.n;for(const c of priv.hand)if(!drawn.has(c.id))mem.exposed[c.id]=c.n;}
  if(e.type==='use'&&e.from!==u&&old){const before=old.hands?.[e.from]||[];for(const c of pub.players[e.from]?.hand||[])if(before.some(b=>b.id===c.id)&&!mem.known[c.id]){const w=mem.belief[c.id]||Array(11).fill(1);mem.belief[c.id]=w.map((x,n)=>n?x*(n===10?1.9:n>e.n?1.28:n===e.n?1:.72):0);}}
  if(e.type==='guessResult'&&!e.hit&&e.to!==u){const h=pub.players[e.to]?.hand[0];if(h){const w=mem.belief[h.id]||Array(11).fill(1);w[e.n]=0;mem.belief[h.id]=w;}}
  if(e.type==='guessResult'&&!e.hit&&e.from===u)mem.signal={id:priv.hand[0]?.id,n:e.n};
 }
 if(mem.signal&&!ownIds.has(mem.signal.id))mem.signal=null;
 mem.prev={hand:priv.hand.map(c=>({...c})),hands:Object.fromEntries(Object.entries(pub.players).map(([v,p])=>[v,p.hand.map(c=>({...c}))]))};mem.lastEvent=pub.event?.id||'';
}
function model(pub,priv,u,mem){const pool=counts.slice();const take=n=>{if(n)pool[n]=Math.max(0,pool[n]-1)};for(const p of Object.values(pub.players))for(const n of p.discard)take(n);for(const c of priv.hand)take(c.n);for(const n of priv.choices||[])take(n);for(const [v,p] of Object.entries(pub.players))if(v!==u)for(const c of p.hand)take(c.n||mem.known[c.id]);const d=dist(pool);return {pool,d,of:c=>{const n=c.n||mem.known[c.id];return n?[{n,p:1}]:d}}}
const prob=(d,f)=>sum(d,x=>x.p*(f(x.n)?1:0));
const avg=(d,f)=>sum(d,x=>x.p*f(x.n));
export function rank(pub,priv,u,mem){const p=pub.players[u],opp=pub.order.filter(v=>v!==u&&pub.players[v].alive),m=model(pub,priv,u,mem),ds=v=>m.of(pub.players[v].hand[0]||{}),used=n=>sum(Object.values(pub.players),p=>p.discard.filter(x=>x===n).length),last=pub.remaining===0;
 const heroSafe=n=>n===10&&pub.reserve;
 // Terminal comparison uses the visible/estimated opponent distribution, with ties worth half.
 const win=(n,d)=>avg(d,x=>n>x?1:n===x?.5:0);
 function playScore(n,keep,v,remaining=pub.remaining){const d=ds(v),guard=pub.players[v].guard,base=val(keep),end=remaining===0;const final=win(keep,d)*20;const baseline=end?final:base;const aliveHero=heroSafe(keep);if(guard&&![4,7].includes(n))return baseline;
  if(n===1&&used(1)===0)return baseline;
  if(n===4)return baseline+(end?0:3.0);
  if(n===7)return baseline+(end?0:1.6);
  if(n===3)return baseline+(end?0:1.8*(d.length>1?1:0));
  if(n===8)return end?avg(d,x=>win(x,[{n:keep,p:1}]))*20:avg(d,val)+.5;
  if(n===2){const hit=Math.max(...d.map(x=>x.p*(heroSafe(x.n)?.28:1)));return baseline+hit*(end?20-final:9);}
  if(n===6){if(pub.options.noble&&used(6)===0)return baseline+(end?0:1.5*(d.length>1?1:0));return avg(d,x=>{if(keep>x)return heroSafe(x)?baseline+2:20;if(keep===x)return aliveHero?10:heroSafe(x)?-12:0;return aliveHero?4:-16});}
  if([1,5,9].includes(n)){if(end)return baseline;const draw=m.d;return avg(d,x=>avg(draw,y=>{const result=z=>{const rest=z===x?y:x;const kill=(n===9&&z===10)||(n===1&&z===9&&pub.options.revolution)||(!pub.reserve&&z===10);if(kill)return 20;if(z===10&&pub.reserve)return remaining===1?avg(m.d,k=>win(keep,[{n:k,p:1}]))*20:base+3;return remaining===1?win(keep,[{n:rest,p:1}])*20:base+(val(x)+val(y))/2-val(rest)+.7;};return n===5?(result(x)+result(y))/2:Math.max(result(x),result(y))}));}
  return baseline;
 }
 const action=(type,fields,score)=>({action:{type,...fields},score});
 switch(pub.phase){case 'play':return priv.hand.filter(c=>c.n!==10).map(c=>{const keep=priv.hand.find(x=>x.id!==c.id)?.n||0;return action('play',{id:c.id},Math.max(...opp.map(v=>playScore(c.n,keep,v))))});
 case 'target':return opp.map(v=>{const keep=priv.hand[0]?.n||0; // current card is already in discards; correct first-card check below
   let score=playScore(pub.effect,keep,v);if(pub.effect===6&&pub.options.noble&&used(6)===1)score=pub.players[v].guard?0:ds(v).length>1?2:1;return action('target',{target:v},score)});
 case 'guess':{const d=ds(pub.target);return Array.from({length:10},(_,i)=>i+1).filter(n=>prob(d,x=>x===n)>0).map(n=>action('guess',{n},prob(d,x=>x===n)*(heroSafe(n)?.28:1)));}
 case 'shuffleAsk':return [action('shuffleAnswer',{yes:true},1),action('shuffleAnswer',{yes:false},0)];
 case 'pick':{const h=pub.players[pub.target].hand;const keep=priv.hand[0]?.n||0;return h.map(c=>{const other=h.find(x=>x.id!==c.id);const score=avg(m.of(c),n=>avg(m.of(other||{}),r=>{if((pub.effect===9&&n===10)||(pub.effect===1&&pub.options.revolution&&n===9)||(!pub.reserve&&n===10))return 30;if(n===10&&pub.reserve)return last?avg(m.d,z=>win(keep,[{n:z,p:1}]))*20:12;return last?win(keep,[{n:r,p:1}])*20+val(n)*.01:val(n)-val(r)*.25}));return action('pick',{id:c.id},score)});}
 case 'sage':return priv.choices.map((n,index)=>{const h=priv.hand[0]?.n||0;return action('sage',{index},Math.max(...opp.map(v=>Math.max(n===10?-Infinity:playScore(n,h,v),h===10?-Infinity:playScore(h,n,v)))))});
 case 'reveal':case 'duel':return [action('ack',{},0)];default:return [];
 }
}
export function decideWeak(pub,priv,u,mem,rng=random){const ranked=rank(pub,priv,u,mem).filter(x=>Number.isFinite(x.score));if(!ranked.length)return null;const best=Math.max(...ranked.map(x=>x.score)),good=ranked.filter(x=>x.score>=best-1e-9);return {...pick(good,rng).action,token:pub.token};}
export {counts,random,model};
