(function(root){
'use strict';
const DAY=86400000, clean=v=>v==null?'':String(v).trim(), norm=v=>clean(v).toLowerCase().replace(/[^a-z0-9]/g,'');
function date(v){
 if(v==null||v===''||v==='--')return null;
 if(typeof v==='number')return Math.round((v-25569)*DAY)-3*3600000;
 if(v instanceof Date)return v.getTime();
 let s=clean(v).replace(/,\s*(\d{1,2}:)/,' $1').replace(/UTC\+03:00/i,'+03:00');
 if(!/(?:Z|[+-]\d\d:\d\d)$/.test(s))s+=' +03:00';
 const t=Date.parse(s);return Number.isFinite(t)?t:null;
}
function discipline(w){const s=clean(w).toUpperCase();if(/(?:^|_)ARC?(?:_|$)/.test(s))return 'Architecture';if(/(?:^|_)STR?(?:_|$)/.test(s))return 'Structure';if(/(?:^|_)MECH?(?:_|$)|(?:^|_)MEC(?:_|$)/.test(s))return 'Mechanical';if(/(?:^|_)ELEC?(?:_|$)/.test(s))return 'Electrical';if(/(?:^|_)CIV(?:_|$)/.test(s))return 'Civil';return clean(w)||'Unmapped';}
function parseWorkbook(wb,XLSX,name){
 const matrices=wb.SheetNames.map(n=>({name:n,rows:XLSX.utils.sheet_to_json(wb.Sheets[n],{header:1,defval:null,raw:true})}));
 let sheet,hi=-1;
 for(const s of matrices){const i=s.rows.findIndex(r=>r.map(norm).includes('reviewname')&&r.map(norm).includes('id')&&r.map(norm).includes('status'));if(i>=0){sheet=s;hi=i;break;}}
 if(!sheet)throw Error('No review table found. Load the original Reviews Excel export with Status, ID and Review name columns.');
 const headers=sheet.rows[hi].map(norm), col=n=>headers.indexOf(norm(n));
 const required=['Status','ID','Review name','Workflow','Next action due','Created on','Finished on','File name','Review status'];
 const missing=required.filter(n=>col(n)<0);if(missing.length)throw Error('Missing columns: '+missing.join(', ')+'. The current dashboard has been kept.');
 const groups=new Map();let rawRows=0,skipped=0;
 for(const row of sheet.rows.slice(hi+1)){
  if(!row.some(v=>clean(v)))continue;const get=n=>row[col(n)],id=clean(get('ID'));if(!id){skipped++;continue;}rawRows++;
  const round=Number(get('Current round'))||1,status=clean(get('Status')).toUpperCase();
  if(!status)throw Error('Review '+id+' has no status. Correct the log before loading it.');
  const old=groups.get(id);if(old&&round<old.round)continue;
  if(!old||round>old.round){groups.set(id,{id,round,status,name:clean(get('Review name')),workflow:clean(get('Workflow')),discipline:discipline(get('Workflow')),initiator:clean(get('Initiated by')),owner:clean(get('Next action by')),approver:clean(get('Approved by')),due:date(get('Next action due')),created:date(get('Created on')),finished:date(get('Finished on')),expectedFiles:Number(get('Total files'))||0,step:clean(get('Current step')).replace(/\n/g,' · '),steps:Number(get('Total steps'))||0,progress:clean(get('Progress')),files:[],_keys:new Set()});}
  const g=groups.get(id);if(g.status!==status)throw Error('Conflicting statuses for review '+id+' in round '+round+'. The current dashboard has been kept.');
  const filename=clean(get('File name'));if(filename){const key=[filename,clean(get('Path')),clean(get('Version'))].join('|');if(!g._keys.has(key)){g._keys.add(key);g.files.push({name:filename,path:clean(get('Path')),version:clean(get('Version')),status:clean(get('Review status')),description:clean(get('Description')),comments:clean(get('Comments'))});}}
 }
 if(!groups.size)throw Error('The report contains no review records.');
 const all=[...groups.values()].map(g=>{delete g._keys;return g;});
 const voids=all.filter(g=>/\bVOID(?:ED)?\b/.test(g.status));
 const reviews=all.filter(g=>!/\bVOID(?:ED)?\b/.test(g.status));
 let reportAt=null,project='',overviewTotal=null;
 for(const s of matrices.filter(s=>s!==sheet))for(const row of s.rows){const vals=row.filter(v=>v!=null&&clean(v));const label=norm(vals[0]);if(label==='createdon')reportAt=date(vals[1]);if(label==='totalreviews')overviewTotal=Number(vals[1]);if(!project&&vals.some(v=>/Madinah Superblock/i.test(clean(v))))project=clean(vals.find(v=>/Madinah Superblock/i.test(clean(v))));}
 const warnings=[];if(!reportAt)warnings.push('Report timestamp missing; upload time used as the snapshot cutoff.');if(skipped)warnings.push(skipped+' non-empty rows without review IDs skipped.');
 if(overviewTotal!=null&&overviewTotal!==all.length)warnings.push('Overview total ('+overviewTotal+') differs from unique review IDs ('+all.length+').');
 const mismatches=reviews.filter(r=>r.expectedFiles!==r.files.length);if(mismatches.length)warnings.push(mismatches.length+' reviews have a file count differing from Total files. Counts below use unique file entries in the latest round.');
 const unknown=reviews.filter(r=>!isOpen(r)&&!isClosed(r));if(unknown.length)warnings.push(unknown.length+' reviews have unrecognized statuses; see the register.');
 const missingDue=reviews.filter(r=>isOpen(r)&&r.due===null).length;if(missingDue)warnings.push(missingDue+' open reviews have no valid due date and cannot be assessed for lateness.');
 return {schema:1,name,project,reportAt:reportAt||Date.now(),loadedAt:Date.now(),reviews,voidCount:voids.length,rawRows,uniqueCount:all.length,warnings};
}
function isOpen(r){return /^OPEN(?:\b|\s|\()/.test(r.status);}
function isClosed(r){return r.status==='CLOSED';}
function outcome(f){return clean(f.status)||'Pending decision';}
function reviewOutcome(r){return [...new Set(r.files.map(outcome))].sort().join(' + ')||'Pending decision';}
function urgency(r,t){if(!isOpen(r))return isClosed(r)?'Closed':r.status;if(r.due===null)return 'No due date';if(r.due<t)return 'Overdue';if(r.due<=t+2*DAY)return 'Due in 48h';return 'On track';}
function stats(rows,t){const open=rows.filter(isOpen),closed=rows.filter(isClosed),files=rows.flatMap(r=>r.files),outcomes={};for(const f of files){const k=outcome(f);outcomes[k]=(outcomes[k]||0)+1;}const cycles=closed.filter(r=>r.created!==null&&r.finished!==null&&r.finished>=r.created).map(r=>(r.finished-r.created)/DAY);return {total:rows.length,open:open.length,closed:closed.length,overdue:open.filter(r=>urgency(r,t)==='Overdue').length,dueSoon:open.filter(r=>urgency(r,t)==='Due in 48h').length,noDue:open.filter(r=>!r.due).length,files:files.length,outcomes,rework:closed.filter(r=>r.files.some(f=>/revise|re-submit|resubmit|reject/i.test(outcome(f)))).length,cycle:cycles.length?cycles.reduce((a,b)=>a+b,0)/cycles.length:null,cycleN:cycles.length,closeRate:rows.length?closed.length/rows.length:0};}
function compare(current,previous){if(!previous)return null;const a=new Map(previous.reviews.map(r=>[r.id,r])),b=new Map(current.reviews.map(r=>[r.id,r]));return {added:current.reviews.filter(r=>!a.has(r.id)),closed:current.reviews.filter(r=>a.has(r.id)&&isOpen(a.get(r.id))&&isClosed(r)),reopened:current.reviews.filter(r=>a.has(r.id)&&isClosed(a.get(r.id))&&isOpen(r)),removed:previous.reviews.filter(r=>!b.has(r.id)),changed:current.reviews.filter(r=>a.has(r.id)&&JSON.stringify(r)!==JSON.stringify(a.get(r.id)))};}
root.SB05={DAY,date,discipline,parseWorkbook,isOpen,isClosed,outcome,reviewOutcome,urgency,stats,compare};
if(typeof module!=='undefined')module.exports=root.SB05;
})(typeof window!=='undefined'?window:globalThis);
