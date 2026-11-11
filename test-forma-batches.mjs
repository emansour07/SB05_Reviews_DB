import assert from 'node:assert/strict';
import {createHandler} from './worker.mjs';
class Bucket{map=new Map();async get(k){const o=this.map.get(k);return o?{etag:o.etag,json:async()=>JSON.parse(o.body)}:null;}async put(k,body,opt={}){const o=this.map.get(k);if(opt.onlyIf?.etagMatches&&o?.etag!==opt.onlyIf.etagMatches)return null;if(opt.onlyIf instanceof Headers&&o)return null;const etag=crypto.randomUUID();this.map.set(k,{body,etag});return {etag};}}
const initial={schema:1,name:'Initial',reportAt:Date.now(),reviews:[],warnings:[],voidCount:0};
const worker=createHandler('',initial),env={BUCKET:new Bucket(),SB05_UPLOADER_EMAIL:'owner@test.example',APS_CLIENT_ID:'fixture',APS_CLIENT_SECRET:'fixture',APS_CALLBACK_URL:'https://site.test/api/forma/callback',APS_TOKEN_KEY:btoa('a'.repeat(32)),FORMA_BATCHED:'true'};
const owner={Origin:'https://site.test','oai-authenticated-user-id':'owner','oai-authenticated-user-email':env.SB05_UPLOADER_EMAIL},viewer={Origin:'https://emansour07.github.io'};
const call=(path,method='GET',headers=viewer)=>worker.fetch(new Request('https://site.test'+path,{method,headers}),env);
const records=Array.from({length:38},(_,i)=>({id:'uuid-'+i,sequenceId:i+1,name:'Review '+i,status:'OPEN',createdAt:'2026-11-01T12:00:00Z',currentStepId:'s1'}));
const workflow={name:'B8_ARC',steps:[{id:'s1',name:'Review'}]};
let reads=0,fail=false;
const original=globalThis.fetch;
globalThis.fetch=async(url,options)=>{
 assert.equal(options.redirect,'manual');
 if(url.includes('/authentication/'))return Response.json({access_token:'fixture-access',refresh_token:'fixture-refresh',expires_in:3600});
 reads++;if(fail)return new Response('Denied',{status:403});
 if(url.includes('/reviews?'))return Response.json({results:records,pagination:{totalResults:38}});
 if(url.endsWith('/workflow'))return Response.json(workflow);
 if(url.includes('/versions?')){
  const count=url.includes('/uuid-0/')?120:1,offset=Number(new URL(url).searchParams.get('offset'));
  const files=Array.from({length:Math.max(0,Math.min(50,count-offset))},(_,i)=>({urn:'urn:file-'+(offset+i)+'?version=1',name:'Drawing '+(offset+i),approveStatus:{label:'Approved'}}));
  return Response.json({results:files,pagination:{totalResults:count}});
 }
 throw Error('Unexpected URL');
};
try{
 const start=await (await call('/api/forma/connect','POST',owner)).json(),state=new URL(start.url).searchParams.get('state');
 assert.equal((await call('/api/forma/callback?state='+state+'&code=fixture','GET',owner)).status,303);
 let attempts=0,response;
 do{
  reads=0;const r=await call('/api/forma/refresh','POST');assert.equal(r.status,200);response=await r.json();attempts++;
  assert(reads<=20,'A batch exceeded the free-plan provider read budget');
  if(response.updating)assert.equal((await (await call('/api/snapshot')).json()).revision,0,'Partial results must not be published');
  assert(attempts<10);
 }while(response.updating);
 assert(response.ok);assert(attempts>1);
 const published=await (await call('/api/snapshot')).json();assert.equal(published.current.reviews.length,38);assert.equal(published.current.reviews[0].files.length,120);assert.equal(published.revision,1);
 const recent=await (await call('/api/forma/refresh','POST')).json();assert(recent.skipped);
 const reset=async()=>{await env.BUCKET.put('sb05/forma/status',JSON.stringify({lastAttemptAt:0,nextAttemptAt:0,error:null}));};
 await reset();assert((await (await call('/api/forma/refresh','POST')).json()).updating);fail=true;
 assert.equal((await call('/api/forma/refresh','POST')).status,503);assert.deepEqual(await (await call('/api/snapshot')).json(),published);
 assert.equal((await (await env.BUCKET.get('sb05/forma/job')).json()).active,false);
 fail=false;await reset();assert((await (await call('/api/forma/refresh','POST')).json()).updating);
 const replacement={...published,revision:99};await env.BUCKET.put('sb05/shared-snapshot-v2.json',JSON.stringify(replacement));
 let result;for(let i=0;i<8;i++){result=await call('/api/forma/refresh','POST');if(result.status!==200||!(await result.json()).updating)break;}
 assert.equal(result.status,503);assert.equal((await (await call('/api/snapshot')).json()).revision,99,'A concurrent upload must win over an older staged job');
 console.log('PASS batched Forma: <=20 provider reads per request, paginated continuation, complete-only publication, cooldown, failure retention and upload conflicts.');
}finally{globalThis.fetch=original;}
