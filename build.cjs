const fs=require('fs');
const config=JSON.parse(fs.readFileSync('frontend-config.json','utf8'));
const apiOrigin=process.env.SB05_API_ORIGIN||config.apiOrigin;
if(process.argv.includes('--pages')&&(!apiOrigin||!/^https:\/\//.test(apiOrigin)))throw Error('Configure the Cloudflare API origin in frontend-config.json before publishing.');
let html=fs.readFileSync('template.html','utf8');
for(const [token,file,mime] of [['ARX_LOGO','arx.svg','image/svg+xml']])html=html.replace('/*'+token+'*/','data:'+mime+';base64,'+fs.readFileSync('assets/'+file).toString('base64'));
for(const [token,file] of [['STYLES','style.css'],['XLSX','vendor/xlsx.full.min.js'],['CORE','core.js'],['APP','app.js']])html=html.replace('/*'+token+'*/',()=>fs.readFileSync(file,'utf8').replace(/<\/script/gi,'<\\/script'));
const initial=fs.existsSync('source-data.json')?JSON.parse(fs.readFileSync('source-data.json','utf8')):{schema:1,name:'Awaiting first report',reportAt:Date.now(),reviews:[],voidCount:0,warnings:['No report is loaded.']};
html=html.replace('/*FORMA_ICON*/','data:image/x-icon;base64,'+fs.readFileSync('assets/forma.ico').toString('base64'));
fs.mkdirSync('dist/server',{recursive:true});fs.mkdirSync('dist/.openai',{recursive:true});
fs.writeFileSync('dist/server/index.js',fs.readFileSync('forma.mjs','utf8')+'\n'+fs.readFileSync('worker.mjs','utf8').replace("import {formaRoutes} from './forma.mjs';",'')+'\nconst appHandler=createHandler('+JSON.stringify(html)+','+JSON.stringify(initial)+');\nexport default {async fetch(request,env){const response=await appHandler.fetch(request,env);const u=new URL(request.url);if(((request.method===\'GET\'&&[\'/api/snapshot\',\'/api/session\',\'/api/forma/status\'].includes(u.pathname))||(request.method===\'POST\'&&u.pathname===\'/api/forma/refresh\'))&&request.headers.get(\'Origin\')===\'https://emansour07.github.io\'){const headers=new Headers(response.headers);headers.set(\'Access-Control-Allow-Origin\',\'https://emansour07.github.io\');headers.set(\'Vary\',\'Origin\');return new Response(response.body,{status:response.status,headers});}return response;}};\n');
if(fs.existsSync('.openai/hosting.json'))fs.copyFileSync('.openai/hosting.json','dist/.openai/hosting.json');
if(fs.existsSync('dist/index.html'))fs.unlinkSync('dist/index.html');
console.log('Built shared dashboard Worker.');
if(process.argv.includes('--pages')){fs.mkdirSync('pages',{recursive:true});fs.writeFileSync('pages/index.html',html.replace('<script>','<script>window.SB05_API_ORIGIN='+JSON.stringify(apiOrigin.replace(/\/$/,''))+';</script><script>'));fs.writeFileSync('pages/.nojekyll','');console.log('Built GitHub Pages frontend.');}

