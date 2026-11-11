import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {mapFormaReview,listAPS,formaRoutes} from './forma.mjs';
const r={id:'uuid-1',sequenceId:23,name:'Structure test',status:'OPEN',currentStepId:'step1',currentStepDueDate:'2026-11-13T12:00:00Z',createdAt:'2026-11-09T12:00:00Z',createdBy:{name:'Initiator'},nextActionBy:{claimedBy:[{name:'Reviewer'}],candidates:{users:[{name:'Reviewer'}],roles:[{name:'B8_STR_DL'}]}}};
const w={name:'B8_STR',steps:[{id:'step1',name:'Initial Review'}]};
const mapped=mapFormaReview(r,w,[{urn:'urn:doc?version=2',name:'Drawing.pdf',approveStatus:{label:'Approved w/ comments',value:'APPROVED'}}]);
assert.equal(mapped.id,'23');assert.equal(mapped.discipline,'Structure');assert.equal(mapped.owner,'Reviewer, B8_STR_DL');assert.equal(mapped.files[0].status,'Approved w/ comments');assert.equal(mapped.files[0].version,'2');assert.equal(mapped.due,Date.parse(r.currentStepDueDate));assert.equal(mapped.round,'—');
let calls=0;const pages=await listAPS('/reviews','test',async path=>{calls++;return calls===1?{results:[{id:'a'}],pagination:{totalResults:2}}:{results:[{id:'b'}],pagination:{totalResults:2}};});assert.equal(pages.length,2);assert.equal(calls,2);
await assert.rejects(()=>listAPS('/reviews','test',async()=>({results:[],pagination:{totalResults:1}})),/Incomplete/);
await assert.rejects(()=>listAPS('/reviews','test',async()=>({results:[{id:'a'}],pagination:{totalResults:2}})),/duplicate/);
class Bucket{map=new Map();async get(k){let o=this.map.get(k);return o?{etag:o.etag,json:async()=>JSON.parse(o.body)}:null;}async put(k,body,opt={}){let o=this.map.get(k);if(opt.onlyIf?.etagMatches&&o?.etag!==opt.onlyIf.etagMatches)return null;if(opt.onlyIf instanceof Headers&&o)return null;let etag=crypto.randomUUID();this.map.set(k,{body,etag});return {etag};}}
const source=await fs.readFile(new URL('./dist/server/index.js',import.meta.url),'utf8');const worker=(await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).default;
const env={BUCKET:new Bucket(),SB05_UPLOADER_EMAIL:'owner@test.example',APS_CLIENT_ID:'fixture-client',APS_CLIENT_SECRET:'fixture-secret',APS_CALLBACK_URL:'https://site.test/api/forma/callback',APS_TOKEN_KEY:btoa('a'.repeat(32)),SB05_SYNC_SECRET:'fixture-sync'};
const headers={'oai-authenticated-user-id':'owner-id','oai-authenticated-user-email':env.SB05_UPLOADER_EMAIL,Origin:'https://site.test'};
const call=(path,method='GET',hdr=headers)=>worker.fetch(new Request('https://site.test'+path,{method,headers:hdr}),env);
const viewerHeaders={Origin:'https://emansour07.github.io'};
assert.equal((await call('/api/forma/refresh','POST',{})).status,403);
assert.equal((await call('/api/forma/refresh','POST',{Origin:'https://evil.test'})).status,403);
assert.equal((await call('/api/forma/refresh','GET',viewerHeaders)).status,403);
assert.equal((await call('/api/forma/connect','POST',viewerHeaders)).status,403);
const disconnected=await call('/api/forma/refresh','POST',viewerHeaders);assert.equal(disconnected.status,200);assert.equal((await disconnected.json()).available,false);
assert.equal((await call('/api/forma/connect','POST',{})).status,403);
assert.equal((await call('/api/forma/connect','POST',{...headers,Origin:'https://evil.test'})).status,403);
assert.equal((await call('/api/forma/sync','POST',{})).status,403);
const publicState=await (await call('/api/forma/status','GET',{})).json();assert.equal(publicState.connected,false);assert.equal(JSON.stringify(publicState).includes('fixture-secret'),false);assert.equal(publicState.callbackUrl,undefined);
const start=await (await call('/api/forma/connect','POST')).json(),oauth=new URL(start.url),state=oauth.searchParams.get('state');assert.equal(oauth.searchParams.get('scope'),'data:read');
assert.equal((await call('/api/forma/callback?state=bad&code=x')).status,400);
const originalFetch=globalThis.fetch;let tokenCalls=0;
globalThis.fetch=async(url,options)=>{
 assert.equal(options.redirect,'manual','Autodesk requests must use the edge-supported manual redirect mode');
 if(url.includes('/authentication/v2/token')){tokenCalls++;return Response.json({access_token:'fixture-access',refresh_token:'fixture-refresh',expires_in:3600});}
 if(url.includes('/reviews?'))return Response.json({results:[r,{id:'void-uuid',status:'VOID'}],pagination:{totalResults:2}});
 if(url.endsWith('/workflow'))return Response.json(w);
 if(url.includes('/versions?'))return Response.json({results:[{urn:'urn:doc?version=2',name:'Drawing.pdf',approveStatus:{label:'Revise and Re-submit'}}],pagination:{totalResults:1}});
 throw Error('Unexpected external request');
};
try{
 assert.equal((await call('/api/forma/callback?state='+state+'&code=test')).status,303);assert.equal(tokenCalls,1);
 assert.equal((await call('/api/forma/callback?state='+state+'&code=test')).status,400);assert.equal(tokenCalls,1);
 const savedTokens=env.BUCKET.map.get('sb05/forma/tokens').body;assert(!savedTokens.includes('fixture-access'));assert(!savedTokens.includes('fixture-refresh'));
 const sync=await call('/api/forma/sync','POST');assert.equal(sync.status,200);assert.equal((await sync.json()).reviewCount,1);
 let snapshot=await (await call('/api/snapshot','GET',{})).json();assert.equal(snapshot.current.source,'forma');assert.equal(snapshot.current.voidCount,1);assert.equal(snapshot.current.reviews[0].files[0].status,'Revise and Re-submit');
 const cached=await (await call('/api/forma/sync','POST')).json();assert.equal(cached.skipped,true);
 const recent=await call('/api/forma/refresh','POST',viewerHeaders);assert.equal(recent.headers.get('Access-Control-Allow-Origin'),viewerHeaders.Origin);assert.equal((await recent.json()).skipped,true);
 const realNow=Date.now,afterMinute=realNow()+61000;
 Date.now=()=>afterMinute;
 try{
  const fresh=await call('/api/forma/refresh','POST',viewerHeaders);assert.equal(fresh.status,200);assert.equal((await fresh.json()).ok,true);
  const latest=await (await call('/api/snapshot','GET',{})).json();assert.equal(latest.revision,snapshot.revision+1);snapshot=latest;
  assert.equal((await (await call('/api/forma/refresh','POST',viewerHeaders)).json()).skipped,true);
  await env.BUCKET.put('sb05/forma/lease',JSON.stringify({id:'another-viewer',until:Date.now()+10000}));
  assert.equal((await (await call('/api/forma/refresh','POST',viewerHeaders)).json()).updating,true);
  await env.BUCKET.put('sb05/forma/lease',JSON.stringify({id:'released',until:0}));
 }finally{Date.now=realNow;}
 const status=env.BUCKET.map.get('sb05/forma/status');const value=JSON.parse(status.body);value.nextAttemptAt=0;await env.BUCKET.put('sb05/forma/status',JSON.stringify(value));
 for(const failureStatus of [403,302]){
  const failureState=JSON.parse(env.BUCKET.map.get('sb05/forma/status').body);failureState.nextAttemptAt=0;await env.BUCKET.put('sb05/forma/status',JSON.stringify(failureState));
  globalThis.fetch=async(url,options)=>{assert.equal(options.redirect,'manual');return new Response('Denied',{status:failureStatus,headers:{Location:'https://unexpected.example/'}});};
  assert.equal((await call('/api/forma/sync','POST')).status,503);assert.deepEqual(await (await call('/api/snapshot','GET',{})).json(),snapshot);
  assert.equal((await (await call('/api/forma/refresh','POST',viewerHeaders)).json()).skipped,true,'Viewer refresh must respect failure backoff');
 }
 const cors=await call('/api/snapshot','GET',{Origin:'https://emansour07.github.io'});assert.equal(cors.headers.get('Access-Control-Allow-Origin'),'https://emansour07.github.io');
}finally{globalThis.fetch=originalFetch;}
console.log('PASS Forma: exact outcomes and dates, pagination completeness, owner/origin checks, OAuth replay rejection, encrypted tokens, void exclusion, publish, throttling, failure retention, GitHub read CORS. Live Autodesk access remains unverified.');

