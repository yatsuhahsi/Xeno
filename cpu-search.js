// Two-player imperfect-information rollouts. Input: public snapshot + own private snapshot + observations only.
import {counts,model,rank,decideWeak,random,newMemory,observe} from './cpu.js?v=2.5';
import {act,views,timeout} from './engine.js?v=2.5';
const sum=a=>a.reduce((a,b)=>a+b,0), clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const seq=()=>Array.from({length:10},(_,i)=>i+1);
const sample=(w,r)=>{let x=r()*sum(w);for(let i=1;i<11;i++){x-=w[i]||0;if(x<0)return i}return w.findLastIndex(x=>x>0)};
const shuffle=(a,r)=>{for(let i=a.length-1;i>0;i--){let j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const value=[0,.6,2,2.8,3.6,4.4,5.3,6.4,7.3,8.7,10];
const copy=a=>a.slice();
const rngFrom=seed=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296};
function world(pub,priv,u,mem,r){
 const other=pub.order.find(x=>x!==u), ps=[pub.players[u],pub.players[other]], pool=counts.slice(), disc=Array(11).fill(0);
 for(const p of ps)for(const n of p.discard){disc[n]++;pool[n]--}
 const own=priv.hand.map(c=>c.n),choices=copy(priv.choices||[]);for(const n of [...own,...choices])pool[n]--;
 const cards=ps[1].hand, hand=cards.map(c=>c.n||mem.known[c.id]||0);for(const n of hand)if(n)pool[n]--;
 const mix=mem.otherMix||[];if(hand.length===2&&mix.length&&hand.every(n=>!n)){const slots=shuffle([0,1],r);for(let j=0;j<Math.min(2,mix.length);j++){const n=mix[j];if(pool[n]<=0)return null;hand[slots[j]]=n;pool[n]--;}}
 if(pool.some(n=>n<0))return null;
 for(let i=0;i<hand.length;i++)if(!hand[i]){const b=mem.belief?.[cards[i].id],w=pool.map((n,j)=>n*(b?.[j]??1));const k=sample(sum(w)>0?w:pool,r);if(k<1)return null;hand[i]=k;pool[k]--}
 const deck=[];for(let n=1;n<=10;n++)for(let j=0;j<pool[n];j++)deck.push(n);shuffle(deck,r);
 const reserve=pub.reserve?deck.pop():0;if(deck.length!==pub.remaining)return null;
 // knowledge[owner][card index] tells whether the opposing player has legitimately seen that card.
 const known=[priv.hand.map(c=>!!mem.exposed?.[c.id]||!!ps[0].hand.find(x=>x.id===c.id)?.n),cards.map(c=>!!(c.n||mem.known[c.id]))];
 const beliefs=[priv.hand.map(c=>mem.signal?.id===c.id?mem.signal.n:0),cards.map(()=>0)];
 return {h:[own,hand],known,beliefs,mixes:[copy(mem.ownMix||[]),copy(mem.otherMix||[])],deck,reserve,disc,guard:ps.map(p=>p.guard),sage:ps.map(p=>p.sage),alive:[true,true],turn:pub.turn===u?0:1,phase:pub.phase,effect:pub.effect,choices,noble:pub.options.noble,rev:pub.options.revolution,style:r(),r,rounds:0};
}
function dist(s,a){const w=counts.map((n,i)=>Math.max(0,n-s.disc[i]));for(const n of s.h[a])w[n]=Math.max(0,w[n]-1);for(const n of s.choices||[])if(s.phase==='sage'&&s.turn===a)w[n]=Math.max(0,w[n]-1);return w;}
function estimate(s,a,i=0){const b=1-a;if(s.known[b][i]){const w=Array(11).fill(0);w[s.h[b][i]]=1;return w}const w=dist(s,a);for(let j=0;j<s.h[b].length;j++)if(j!==i&&s.known[b][j])w[s.h[b][j]]=Math.max(0,w[s.h[b][j]]-1);
 // Some opponents take a guess as evidence the guesser does not hold that number. Others ignore it.
 if(s.h[b].length===2&&s.mixes[b]?.length){const ks=s.mixes[b];const total=sum(w)||1;for(let n=1;n<=10;n++)w[n]=w[n]*(2-ks.length)/2+total*ks.filter(k=>k===n).length/2;}
 const g=s.beliefs[b][i];if(g)w[g]*=a===1?(s.style<.25?1:s.style<.75?.23:.65):.65;
 return w;}
function avg(w,f){let z=0,t=0;for(let n=1;n<=10;n++){z+=w[n];t+=w[n]*f(n)}return z?t/z:0;}
const compare=(n,m)=>n>m?1:n===m?.5:0;
function score(s,a,n,k,w){const left=s.deck.length, end=!left,b=1-a,win=avg(w,x=>compare(k,x)),base=end?win*18:value[k];if([1,2,3,5,6,8,9].includes(n)&&s.guard[b])return base;
 if(n===1&&!s.disc[1]||[1,5,9].includes(n)&&end)return base;
 if(n===4)return base+(end?0:2.4);if(n===7)return base+(end||left===1?0:1.5);if(n===3)return base+(end||w.filter(x=>x>0).length===1?0:1.4);
 if(n===8)return end?(1-win)*18:avg(w,x=>value[x])+.35;
 if(n===2){let h=0;const z=sum(w)||1;for(let x=1;x<=10;x++)h=Math.max(h,w[x]/z*(x===10&&s.reserve?.25:1));return base+h*(end?18-base:9)}
 if(n===6){if(s.noble&&!s.disc[6])return base+(end?0:1.2);return avg(w,x=>k>x?(x===10&&s.reserve?base+1:20):k===x?9:k===10&&s.reserve?5:-10)}
 if(n===5||n===9||n===1){return base+(n===5?.65:1.65)+(n===9?avg(w,x=>x===10?7:0):n===1&&s.rev?avg(w,x=>x===9?7:0):0)}return base;
}
function choosePlay(s,a){const h=s.h[a],w=estimate(s,a);let best=-Infinity,idx=0;for(let i=0;i<h.length;i++){if(h[i]===10)continue;const v=score(s,a,h[i],h[1-i],w);if(v>best){best=v;idx=i}}return idx;}
function guess(s,a){const w=estimate(s,a);let best=-1,n=1;for(let i=1;i<=10;i++){const v=w[i]*(i===10&&s.reserve?.25:1);if(v>best){best=v;n=i}}return n;}
function pickCard(s,a,n){const b=1-a,k=s.h[a][0];let best=-Infinity,idx=0;for(let i=0;i<s.h[b].length;i++){const w=estimate(s,a,i),v=estimate(s,a,1-i);const score=avg(w,x=>{if(n===9&&x===10||n===1&&s.rev&&x===9||!s.reserve&&x===10)return 22;if(x===10&&s.reserve)return s.deck.length?11:avg(dist(s,a),z=>compare(k,z))*18;return s.deck.length?value[x]-avg(v,y=>value[y])*.2:avg(v,y=>compare(k,y))*18+value[x]*.001});if(score>best){best=score;idx=i}}return idx;}
function remove(s,a,i){const n=s.h[a].splice(i,1)[0];s.known[a].splice(i,1);s.beliefs[a].splice(i,1);s.disc[n]++;if(s.mixes[a]?.length&&s.h[a].length===1){const k=s.mixes[a].slice(),j=k.indexOf(n);if(j>=0)k.splice(j,1);if(k.length===1&&s.h[a][0]===k[0])s.known[a][0]=true;s.mixes[a]=[];}return n;}
function add(s,a,n){s.h[a].push(n);s.known[a].push(false);s.beliefs[a].push(0)}
function clear(s,a){while(s.h[a].length)remove(s,a,0)}
function lose(s,a,cause,hero=s.h[a].includes(10)){clear(s,a);if(hero&&cause!==9&&s.reserve){add(s,a,s.reserve);s.reserve=0}else s.alive[a]=false;}
function hide(s,a){const h=s.h[a];s.mixes[a]=s.known[a].some(Boolean)?h.filter((_,i)=>s.known[a][i]):(s.mixes[a]||[]);if(h.length===2&&s.r()<.5)[h[0],h[1]]=[h[1],h[0]];s.known[a]=h.map(()=>false);s.beliefs[a]=h.map(()=>0);}
function force(s,a,i,n){const x=remove(s,a,i);if(x===10)lose(s,a,n,true);else if(n===1&&s.rev&&x===9)lose(s,a,9,false);}
function guessEffect(s,a,n){const b=1-a;if(s.h[b][0]===n)lose(s,b,2);else if(s.h[a].length===1&&!s.known[a][0])s.beliefs[a][0]=n;}
function duel(s,a){const b=1-a;s.known[a][0]=s.known[b][0]=true;if(s.noble&&s.disc[6]===1)return;const x=s.h[a][0],y=s.h[b][0];if(x<=y)lose(s,a,6);if(y<=x)lose(s,b,6);}
function effect(s,a,n){const b=1-a;if(n===4){s.guard[a]=true;return}if(n===7){s.sage[a]=true;return}if(n===1&&s.disc[1]===1||s.guard[b])return;
 if(n===2)return guessEffect(s,a,guess(s,a));if(n===3){s.known[b][0]=true;return}if(n===6)return duel(s,a);if(n===8){[s.h[a],s.h[b]]=[s.h[b],s.h[a]];s.known[a]=[true];s.known[b]=[true];s.beliefs[a]=[0];s.beliefs[b]=[0];s.mixes[a]=[];s.mixes[b]=[];return}
 if([1,5,9].includes(n)&&s.deck.length){add(s,b,s.deck.shift());if(n===5)hide(s,b);else s.known[b]=[true,true];force(s,b,pickCard(s,a,n),n)}
}
function play(s,a,i){const n=remove(s,a,i);effect(s,a,n)}
function sage(s,a,i){const n=s.choices.splice(i,1)[0];s.deck=shuffle(s.deck.concat(s.choices),s.r);s.choices=[];add(s,a,n);s.phase='play';}
function chooseSage(s,a){let best=-Infinity,idx=0,k=s.h[a][0],w=estimate(s,a);for(let i=0;i<s.choices.length;i++){const n=s.choices[i],v=Math.max(n===10?-Infinity:score(s,a,n,k,w),k===10?-Infinity:score(s,a,k,n,w));if(v>best){best=v;idx=i}}return idx;}
function outcome(s){if(!s.alive[0]||!s.alive[1])return s.alive[0]===s.alive[1]?.5:s.alive[0]?1:0;if(!s.deck.length)return compare(s.h[0][0],s.h[1][0]);return null;}
function rollout(s,a,pub,priv,u){const other=pub.order.find(x=>x!==u);switch(a.type){case 'play':play(s,0,priv.hand.findIndex(c=>c.id===a.id));break;case 'shuffle':hide(s,0);play(s,0,s.h[0].indexOf(a.playNumber));break;case 'guess':guessEffect(s,0,a.n);break;case 'pick':force(s,1,pub.players[other].hand.findIndex(c=>c.id===a.id),s.effect);break;case 'shuffleAnswer':if(a.yes)hide(s,0);force(s,0,pickCard(s,1,5),5);break;case 'sage':sage(s,0,a.index);play(s,0,choosePlay(s,0));break;default:return .5;}
 let result=outcome(s);if(result!==null)return result;let turn=1-s.turn;
 for(let j=0;j<24;j++,turn=1-turn){s.turn=turn;s.guard[turn]=false;if(s.sage[turn]){s.sage[turn]=false;s.choices=s.deck.splice(0,3);s.phase='sage';sage(s,turn,chooseSage(s,turn))}else{add(s,turn,s.deck.shift());s.phase='play'}
 // Strong and cautious simulated opponents sometimes erase known-card tracking.
 if(s.known[turn].some(Boolean)&&(turn===0||s.style>.4))hide(s,turn);
 play(s,turn,choosePlay(s,turn));result=outcome(s);if(result!==null)return result;}
 return compare(s.h[0][0],s.h[1][0]);}
export function decideStrong(pub,priv,u,mem,r=random,iterations=512,diagnostic=null){
 const weak=()=>decideWeak(pub,priv,u,mem,r);if(pub.order.length!==2)return decideMulti(pub,priv,u,mem,r,iterations);if(!['play','guess','pick','shuffleAsk','sage'].includes(pub.phase))return weak();
 let candidates=rank(pub,priv,u,mem).map(x=>x.action);
 // Compare hiding the visible card identity with playing immediately. A shuffle
 // candidate includes a planned play, but the real CPU re-evaluates after shuffling.
 if(pub.phase==='play'&&pub.remaining>0&&mem.shuffleToken!==pub.token&&priv.hand.length===2&&priv.hand.some(c=>mem.exposed?.[c.id]||mem.signal?.id===c.id)){
  candidates.push(...[...new Set(priv.hand.filter(c=>c.n!==10).map(c=>c.n))].map(n=>({type:'shuffle',playNumber:n})));
 }
 if(pub.phase==='guess'){
 const likely=model(pub,priv,u,mem).of(pub.players[pub.target].hand[0]);const held=priv.hand[0]?.n,known=!!mem.exposed?.[priv.hand[0]?.id];
 // Zero-hit guesses are useful only as a signal about the card we actually retain,
 // when the opponent will have another opportunity to act and does not already know it.
 candidates=seq().filter(n=>likely.some(x=>x.n===n&&x.p>0)||(!mem.disableBluff&&pub.remaining>0&&!known&&n===held)).map(n=>({type:'guess',n}));
 }if(candidates.length<=1)return candidates.length?{...candidates[0],token:pub.token}:weak();
 const wins=candidates.map(()=>0);let valid=0;for(let i=0;i<iterations;i++){const seed=(r()*4294967296)>>>0;let good=true;const results=[];for(const c of candidates){const w=world(pub,priv,u,mem,rngFrom(seed));if(!w){good=false;break}results.push(rollout(w,c,pub,priv,u))}if(good){valid++;for(let j=0;j<wins.length;j++)wins[j]+=results[j]}}
 if(!valid)return weak();const scores=wins.map(n=>n/valid);let best=0;const baseline=weak(),base=candidates.findIndex(c=>JSON.stringify({...c,token:pub.token})===JSON.stringify(baseline));if(base>=0)best=base;
 // A deliberate zero-hit guess needs a real predicted benefit, not just Monte Carlo noise.
 const d=pub.phase==='guess'?model(pub,priv,u,mem).of(pub.players[pub.target].hand[0]):null;
 for(let j=0;j<scores.length;j++){const bluff=d&&!d.some(x=>x.n===candidates[j].n&&x.p>0),margin=bluff?.012:candidates[j].type==='shuffle'?.005:0;if(scores[j]>scores[best]+margin+1e-9)best=j}
 if(diagnostic)Object.assign(diagnostic,{valid,scores,candidates,best});return candidates[best].type==='shuffle'?{type:'shuffle',token:pub.token}:{...candidates[best],token:pub.token};
}

// 3–4 player rollouts using the real game engine on sampled, fictional worlds.
function multiWorld(pub,priv,u,mem,r){
 const pool=counts.slice(),players={};const take=n=>{pool[n]--;};
 for(const [v,p] of Object.entries(pub.players)){for(const n of p.discard)take(n);const hand=v===u?priv.hand.map(c=>({...c})):p.hand.map(c=>({...c,n:c.n||mem.known[c.id]||0}));for(const c of hand)if(c.n)take(c.n);players[v]={...p,hand,discard:[...p.discard]};}
 const choices=[...(priv.choices||[])];for(const n of choices)take(n);if(pool.some(n=>n<0))return null;
 for(const [v,p] of Object.entries(players))if(v!==u)for(const c of p.hand)if(!c.n){const w=pool.map((n,i)=>n*(mem.belief?.[c.id]?.[i]??1));const n=sample(sum(w)>0?w:pool,r);if(n<1||pool[n]<=0)return null;c.n=n;take(n);}
 const deck=[];for(let n=1;n<=10;n++)for(let j=0;j<pool[n];j++)deck.push(n);shuffle(deck,r);const reserve=pub.reserve?deck.pop():null;if(deck.length!==pub.remaining)return null;
 return {...structuredClone(pub),players,deck,reserve,choices,peek:{},ack:{...pub.ack},events:[],event:null,log:[],deadline:0,options:{...pub.options,seconds:0}};
}
function multiRoll(s,u,a,mem,r){
 const memories=Object.fromEntries(s.order.map(v=>[v,v===u?structuredClone(mem):newMemory()]));
 // Known-to-opponent signals are a model, never the actual opponent's beliefs.
 const signals={};if(mem.signal)signals[u]=mem.signal.n;
 let v=views(s);for(const id of s.order){if(id!==u)memories[id].round=s.round;if(id!==u)for(const c of s.players[u].hand)if(mem.exposed?.[c.id])memories[id].known[c.id]=c.n;observe(memories[id],v.public,v.private[id],id)}
 let tick=1;const step=(id,action)=>{act(s,id,{...action,token:s.token},++tick);if(action.type==='guess'&&s.event?.type==='guessResult'&&!s.event.hit)signals[id]=action.n;};
 step(u,a);
 for(let i=0;i<100;i++){
  if(s.phase==='end')return s.winner===u?1:!s.winner&&s.players[u].alive?.5:0;
  if(!s.players[u].alive)return 0;
  if(['aftermath','guessResult','effectResult'].includes(s.phase)){timeout(s,Math.max(++tick,s.deadline));continue;}
  v=views(s);for(const id of s.order)observe(memories[id],v.public,v.private[id],id);
  const id=s.phase==='duel'?[s.turn,s.target].find(x=>!s.ack?.[x]):s.actor;if(!id)return 0;
  let next=decideWeak(v.public,v.private[id],id,memories[id],r);
  if(s.phase==='guess'&&id!==u&&signals[s.target]){const held=signals[s.target],d=model(v.public,v.private[id],id,memories[id]).of(v.public.players[s.target].hand[0]);const style=r();if(style>.25&&d.length>1){let best=-1;for(const q of d){const score=q.p*(q.n===held?.3:1)*(q.n===10&&v.public.reserve?.28:1);if(score>best){best=score;next={type:'guess',n:q.n}}}}}
  if(!next)return 0;step(id,next);
 }
 return 0;
}
function decideMulti(pub,priv,u,mem,r,iterations){
 const weak=()=>decideWeak(pub,priv,u,mem,r);if(!['play','target','guess','pick','shuffleAsk','sage'].includes(pub.phase))return weak();
 let candidates=rank(pub,priv,u,mem).map(x=>x.action);if(pub.phase==='guess'&&pub.remaining>0&&!mem.exposed?.[priv.hand[0]?.id]&&priv.hand[0]&&!candidates.some(a=>a.n===priv.hand[0].n))candidates.push({type:'guess',n:priv.hand[0].n});
 if(pub.phase==='play'&&pub.remaining>0&&mem.shuffleToken!==pub.token&&priv.hand.some(c=>mem.exposed?.[c.id]))candidates.push({type:'shuffle'});
 if(candidates.length<2)return candidates.length?{...candidates[0],token:pub.token}:weak();
 let totals=candidates.map(()=>0),valid=0;for(let i=0;i<Math.min(iterations,64);i++){const seed=(r()*4294967296)>>>0;const w=multiWorld(pub,priv,u,mem,rngFrom(seed));if(!w)continue;try{const results=candidates.map(a=>multiRoll(structuredClone(w),u,a,mem,rngFrom(seed)));for(let j=0;j<results.length;j++)totals[j]+=results[j];valid++;}catch{}}
 if(!valid)return weak();const baseline=weak();let best=candidates.findIndex(a=>JSON.stringify({...a,token:pub.token})===JSON.stringify(baseline));if(best<0)best=0;for(let i=0;i<totals.length;i++)if(totals[i]>totals[best]+(candidates[i].type==='guess'?Math.max(1,valid*.02):0))best=i;return {...candidates[best],token:pub.token};
}
