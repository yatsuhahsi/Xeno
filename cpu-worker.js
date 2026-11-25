import {decideStrong} from './cpu-search.js?v=2.1';
self.onmessage=({data:d})=>{try{self.postMessage({id:d.id,action:decideStrong(d.pub,d.priv,d.u,d.mem,undefined,d.iterations||512)})}catch(e){self.postMessage({id:d.id,error:String(e)})}};
