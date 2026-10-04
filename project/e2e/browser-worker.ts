import * as http from 'node:http';
import { appendFileSync } from 'node:fs';
import { channelState, dispatchBrowser, type BrowserPort } from './browser-channel';

export async function startBrowserWorker(
  connect: (space: number) => Promise<{ ownership: string; page(label: string): Record<string, any> }>,
  config: {space:number;origin:string;token:string;adminToken:string;log:string},
) {
  const task=await connect(config.space); if(task.ownership!=='agent') throw Error('User or inactive browser control');
  const page=task.page('p1');
  const port: BrowserPort={
    invoke: (method,args)=>page[method](...args), events:()=>page.events(),
    control: async()=> (await connect(config.space)).ownership === 'agent',
    url:()=>page.url(),
  };
  const runtime={page:port,origin:config.origin,timeoutMs:15000,pause:(ms:number)=>new Promise<void>(r=>setTimeout(r,ms)),armDeadline:(ms:number,callback:()=>void)=>{const timer=setTimeout(callback,ms);return ()=>clearTimeout(timer);}};
  const state=channelState();
  let resolveClosed:()=>void;const closed=new Promise<void>(resolve=>{resolveClosed=resolve;});
  let heartbeat=Date.now();
  const shutdown=()=> {state.stopped='Browser channel closed by owner';clearInterval(watchdog);server.close(()=>resolveClosed());server.closeAllConnections();};
  const watchdog=setInterval(()=>{if(Date.now()-heartbeat>90000)shutdown();},5000);
  const server=http.createServer(async(req,res)=> {
    if(req.method==='POST' && req.headers.authorization===`Bearer ${config.adminToken}` && ['/close','/heartbeat'].includes(req.url??'')) {
      heartbeat=Date.now();res.writeHead(200);res.end('{}');if(req.url==='/close')setImmediate(shutdown);return;
    }
    if(req.method!=='POST' || req.url!=='/command' || req.headers.authorization!==`Bearer ${config.token}`) {res.writeHead(403);res.end();return;}
    let body='';
    try {
      for await(const chunk of req) {body+=chunk; if(body.length>65536) throw Error('Request too large');}
      const request=JSON.parse(body); const response=await dispatchBrowser(runtime,state,request);
      appendFileSync(config.log,JSON.stringify({channel:'browser-channel-v1',space:config.space,origin:config.origin,request,response})+'\n');
      res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(response));
    }catch(error){res.writeHead(400);res.end(JSON.stringify({status:'error',error:String(error)}));}
  });
  server.listen(0,'127.0.0.1',()=>appendFileSync(config.log,JSON.stringify({channelReady:`http://127.0.0.1:${(server.address() as {port:number}).port}`,workerPid:process.pid})+'\n'));
  await closed;
}
