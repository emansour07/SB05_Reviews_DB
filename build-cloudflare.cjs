const fs=require('node:fs');
let html=fs.readFileSync('template.html','utf8');
html=html.replace('/*ARX_LOGO*/','data:image/svg+xml;base64,'+fs.readFileSync('assets/arx.svg').toString('base64'));
for(const [token,file] of [['STYLES','style.css'],['XLSX','vendor/xlsx.full.min.js'],['CORE','core.js'],['APP','app.js']])html=html.replace('/*'+token+'*/',()=>fs.readFileSync(file,'utf8').replace(/<\/script/gi,'<\\/script'));
html=html.replace('/signin-with-chatgpt?return_to=%2F','/admin/login');
html=html.replace('/*FORMA_ICON*/','data:image/x-icon;base64,'+fs.readFileSync('assets/forma.ico').toString('base64'));
fs.mkdirSync('dist/cloudflare',{recursive:true});fs.writeFileSync('dist/cloudflare/admin.html',html);
console.log('Built Cloudflare owner dashboard.');
