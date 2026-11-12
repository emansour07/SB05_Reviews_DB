const assert=require('node:assert/strict'),C=require('./core.js');
const sdw='R05H02-C063-BCR-01-B02-SDW-AR-AR-10002.pdf';
for(const [name,type] of [[sdw,'drawing'],['Structural design report.pdf','report'],['Progress_Report_01.PDF','report'],['Fire drawings.pdf','unclassified'],['Method_statement.pdf','other'],['Specification.pdf','other'],['R05H02-C063-BCR-01-B02-REP-ST-ST-00001.pdf','unclassified'],['Attachment.pdf','unclassified'],[sdw.replace('.pdf','-report.pdf'),'drawing'],['model.rvt','nonPdf'],['report.pdf.tmp','nonPdf']])assert.equal(C.pdfType({name}),type,name);
assert.equal(C.pdfType({name:sdw,documentType:'Report'}),'drawing','Confirmed filename rule wins');
assert.equal(C.pdfType({name:'attachment.pdf',documentType:'SDW'}),'unclassified');
const t=10*C.DAY,make=(n)=>Array.from({length:n},()=>({name:sdw}));
const mixed={status:'OPEN',created:t-2*C.DAY,files:[...make(4),{name:'Design report.pdf'},{name:'Specification.pdf'},{name:'Attachment.pdf'},{name:'Model.rvt'}]};
const reportOnly={status:'CLOSED',created:0,finished:C.DAY,files:[{name:'Report.pdf'}]};
const metrics=C.drawingMetrics([mixed,reportOnly],t);
assert.equal(C.pdfCount(mixed),7);assert.equal(C.drawingCount(mixed),4);assert.equal(metrics.total,4);assert.equal(metrics.packages,1);assert.equal(metrics.noDrawingPackages,1);assert.equal(metrics.sizes['1–4'],1);assert.equal(metrics.sizes['5–10'],0);assert.equal(metrics.age['>1–2 days'],4);assert.deepEqual(metrics.pdfTypes,{drawing:4,report:2,other:1,unclassified:1});
assert.equal(C.workloadMatches(reportOnly,'document|report',t),true);assert.equal(C.workloadMatches(reportOnly,'state|Reviewed',t),false);assert.equal(C.workloadMatches(mixed,'document|unclassified',t),true);assert.equal(C.workloadMatches(reportOnly,'size|No drawings',t),true);
console.log('PASS document types: confirmed SDW, filename rules, reports, other/unknown PDFs, conflicting clues, report-only and mixed packages, drawing-only age/size totals and filters.');

const paired=[{name:'Generic-123.PDF'},{name:'generic-123.dwg'}];
assert.equal(C.pdfType(paired[0],paired),'drawing');assert.equal(C.drawingCount({files:paired}),1);
for(const ext of ['DXF','DGN'])assert.equal(C.pdfType({name:'plan.pdf'},[{name:'PLAN.'+ext}]),'drawing');
assert.equal(C.pdfType({name:'plan.pdf'},[{name:'other-plan.dwg'}]),'unclassified');
assert.equal(C.pdfType({name:'plan.pdf'},[{name:'plan.rvt'}]),'unclassified');
assert.equal(C.pdfType({name:'plan.pdf'},[]),'unclassified','Matching files in another package must not count');
assert.equal(C.pdfType({name:'Report.pdf'},[{name:'report.dwg'}]),'drawing','Matching CAD satisfies the confirmed drawing rule');
assert.equal(C.pdfType({name:'plan.pdf',documentType:'report'},[{name:'plan.dwg'}]),'drawing');
assert.equal(C.pdfType({name:'plan.pdf',documentType:'constructor'}),'unclassified');
console.log('PASS CAD pairing: matching base names, case-insensitivity, DWG/DXF/DGN, package scope, non-CAD exclusion and confirmed filename rules.');

for(const name of ['SDW-001.pdf','x_sdw_01.pdf','x-SDW.pdf'])assert.equal(C.pdfType({name}),'drawing',name);
for(const name of ['ASDW-001.pdf','x-SDW2.pdf','SDW-001.dwg'])assert.notEqual(C.pdfType({name}),'drawing',name);

const pairAndModels={status:'OPEN',created:0,files:[{name:'plan.pdf'},{name:'PLAN.dwg'},...['nwc','NWD','IFC','rvt'].map(ext=>({name:'Building.'+ext}))]};
assert.equal(C.documentType(pairAndModels.files[0],pairAndModels.files),'drawing');
assert.equal(C.documentType(pairAndModels.files[1],pairAndModels.files),'drawing');
for(const f of pairAndModels.files.slice(2))assert.equal(C.documentType(f,pairAndModels.files),'model');
assert.equal(C.modelCount(pairAndModels),4);assert.equal(C.drawingCount(pairAndModels),1);
assert.equal(C.drawingMetrics([pairAndModels],t).models,4);
assert.equal(C.workloadMatches(pairAndModels,'document|model',t),true);
assert.equal(C.workloadMatches(reportOnly,'document|model',t),false);
assert.notEqual(C.documentType({name:'model.ifc.pdf'}),'model');
assert.equal(C.drawingMetrics([{...pairAndModels,status:'VOID'}],t).models,0);
console.log('PASS document labels: CAD/PDF drawing pair, NWC/NWD/IFC/RVT models, single sheet count, model filters and void exclusion.');
