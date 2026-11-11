import {DurableObject} from 'cloudflare:workers';
import {createHandler,stored,validateSnapshot} from '../worker.mjs';
import {syncForma} from '../forma.mjs';
import {SQLiteStore} from './store.mjs';
import {isOwner,validAdminKey,sessionCookie,readLoginKey,loginPage} from './auth.mjs';
import dashboardHtml from '../dist/cloudflare/admin.html';
const FRONTEND='https://emansour07.github.io/SB05_Reviews_DB/';
const app=createHandler(dashboardHtml,{schema:1,name:'Awaiting first update',reportAt:946684800000,reviews:[],voidCount:0,warnings:[]});
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const redirect=path=>new Response(null,{status:303,headers:{Location:path,'Cache-Control':'no-store'}});

function security(response,referrerPolicy='same-origin'){const headers=new Headers(response.headers);headers.set('Cache-Control','no-store');headers.set('X-Content-Type-Options','nosniff');headers.set('Referrer-Policy',referrerPolicy);headers.set('X-Frame-Options','DENY');return new Response(response.body,{status:response.status,headers});}
function cors(request,response){
  const path=new URL(request.url).pathname;
  if(request.headers.get('Origin')==='https://emansour07.github.io'&&((request.method==='GET'&&['/api/snapshot','/api/session','/api/forma/status'].includes(path))||(request.method==='POST'&&path==='/api/forma/refresh'))){
    const headers=new Headers(response.headers);headers.set('Access-Control-Allow-Origin','https://emansour07.github.io');headers.set('Vary','Origin');return new Response(response.body,{status:response.status,headers});
  }
  return response;
}
export class SB05State extends DurableObject {
  constructor(ctx,env){super(ctx,env);this.runtime={...env,BUCKET:new SQLiteStore(ctx.storage)};}
  async fetch(request){
    const env=this.runtime;
    const url=new URL(request.url);
    try{
      if(url.pathname==='/')return redirect(FRONTEND);
      if(url.pathname==='/admin/login'){
        if(request.method==='GET')return security(new Response(loginPage(),{headers:{'Content-Type':'text/html; charset=utf-8'}}));
        if(request.method!=='POST'||request.headers.get('Origin')!==url.origin)return security(reply({error:'Sign-in request not accepted.'},403));
        if(!await validAdminKey(await readLoginKey(request),env.SB05_ADMIN_KEY))return security(new Response(loginPage(true),{status:403,headers:{'Content-Type':'text/html; charset=utf-8'}}));
        return security(new Response(null,{status:303,headers:{Location:'/admin','Set-Cookie':await sessionCookie(env.SB05_ADMIN_KEY,url.origin)}}));
      }
      const owner=await isOwner(request,env.SB05_ADMIN_KEY);
      if(url.pathname==='/admin'&&!owner)return redirect('/admin/login');
      const headers=new Headers(request.headers);
      for(const name of [...headers.keys()])if(name.toLowerCase().startsWith('oai-'))headers.delete(name);
      if(owner){headers.set('oai-authenticated-user-id','sb05-owner');headers.set('oai-authenticated-user-email',env.SB05_UPLOADER_EMAIL);}
      // Sites identity headers from the public internet are never trusted.
      if(url.pathname==='/admin')url.pathname='/';
      const forwarded=new Request(url,request);const safeRequest=new Request(forwarded,{headers});
      const response=await app.fetch(safeRequest,env);
      if(new URL(request.url).pathname==='/api/forma/callback'&&response.status===303){
        const h=new Headers(response.headers),location=h.get('Location');if(location?.startsWith('/?forma='))h.set('Location','/admin'+location.slice(1));
        return security(new Response(response.body,{status:response.status,headers:h}),'no-referrer');
      }
      return security(cors(request,response));
    }catch{return security(cors(request,reply({error:'Unable to update right now. Please try again shortly.'},503)));}
  }
  async tick(){
    if(this.runtime.FORMA_SYNC_ENABLED!=='true')return;
    await syncForma(this.runtime,stored,validateSnapshot).catch(()=>{});
  }
}
const state=env=>env.REVIEW_STATE.get(env.REVIEW_STATE.idFromName('sb05'));
export default {
  fetch(request,env){return state(env).fetch(request);},
  scheduled(event,env,ctx){ctx.waitUntil(state(env).tick());}
};
