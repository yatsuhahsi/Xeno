import assert from 'node:assert/strict';
import {lobby,act,views,timeout,normalize} from './engine.js';
const a='host',b='guest';const mk=(opt={})=>{let s=lobby(a,'A',{noble:false,revolution:false,seconds:30,...opt});act(s,b,{type:'join',name:'B'});return s};
const op=(s,u,type,fields={})=>act(s,u,{type,token:s.token,...fields},1000);
function check(s){const all=[...s.deck,...(s.reserve==null?[]:[s.reserve]),...(s.choices||[]),...Object.values(s.players).flatMap(p=>[...p.hand.map(c=>c.n),...p.discard])];assert.equal(all.length,18);for(let n=1;n<=10;n++)assert.equal(all.filter(x=>x===n).length,n<=8?2:1);let v=views(s);for(let u of s.order){if(s.phase!=='end'&&!(s.phase==='pick'&&s.effect!==5&&s.target===u))assert(v.public.players[u].hand.every(c=>!('n'in c)));assert.deepEqual(v.private[u].hand,s.players[u].hand)}}
// randomized games, timeout exercises every selection and both rule variants
let counts={};for(let i=0;i<3000;i++){let s=mk({noble:i%2===0,revolution:i%3===0});for(let j=0;j<i%3;j++)act(s,'p'+j,{type:'join',name:'C'+j});op(s,a,'start');let k=0;while(s.phase!=='end'&&k++<150){check(s);counts[s.phase]=(counts[s.phase]||0)+1;assert(timeout(s,s.deadline+1));}assert.equal(s.phase,'end');check(s)}
// constructed scenarios for hidden IDs, revolution, and hero rebirth
function scenario(effect,hand,deck,extra={}){let s=mk(extra);Object.assign(s,{phase:'play',actor:a,turn:a,deck:[...deck],reserve:7,round:1,token:'t'});s.players[a].hand=[{id:'use',n:effect},{id:'keep',n:4}];s.players[b].hand=[{id:'old',n:hand}];return s}
let s=scenario(5,10,[9,2]);op(s,a,'play',{id:'use'});op(s,a,'target',{target:b});let old=s.players[b].hand.map(c=>c.id);assert.equal(s.phase,'shuffleAsk');op(s,b,'shuffleAnswer',{yes:true});assert(s.players[b].hand.every(c=>!old.includes(c.id)));assert.throws(()=>op(s,b,'shuffle'));op(s,a,'pick',{id:s.players[b].hand.find(c=>c.n===10).id});assert(s.players[b].alive);assert.equal(s.reserve,null);
s=scenario(1,9,[3,2],{revolution:true});s.players[b].discard=[1];op(s,a,'play',{id:'use'});op(s,a,'target',{target:b});op(s,a,'pick',{id:'old'});assert.equal(s.reason,'革命');assert.equal(s.winner,a);
s=scenario(9,10,[3,2]);op(s,a,'play',{id:'use'});op(s,a,'target',{target:b});op(s,a,'pick',{id:'old'});assert(!s.players[b].alive);assert.equal(s.reserve,7);
s=scenario(6,9,[3,2],{noble:true});op(s,a,'play',{id:'use'});op(s,a,'target',{target:b});op(s,b,'ack');assert.equal(s.phase,'duel');op(s,a,'ack');assert(s.players[a].alive&&s.players[b].alive);
console.log('3000 randomized games + targeted cases passed',counts);
