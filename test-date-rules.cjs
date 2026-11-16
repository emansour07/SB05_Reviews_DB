const assert=require('node:assert/strict'),D=require('./date-rules.js'),C=require('./core.js');
assert.equal(D.workingDays('2026-11-12T12:00:00+03:00','2026-11-15T12:00:00+03:00'),2);
assert.equal(C.urgency({status:'OPEN',due:Date.parse('2026-11-15T12:00:00+03:00')},Date.parse('2026-11-12T12:00:00+03:00')),'Due within 2 working days');
assert.equal(D.inRange('2026-11-16T20:59:59Z','2026-11-16','2026-11-16'),true);
assert.equal(D.inRange('2026-11-16T21:00:00Z','2026-11-16','2026-11-16'),false);
console.log('Working calendar and inclusive date ranges passed.');
