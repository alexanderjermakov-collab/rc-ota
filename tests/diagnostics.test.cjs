const test=require('node:test'),assert=require('node:assert/strict');
const create=require('../docs/diagnostics.js');
const {File}=require('node:buffer');
function setup(nav={}){
 const shared=[],saved=[],statuses=[],button={disabled:false};
 const data={version:'0.20.0',mode:'pro',metadata:{model:'AN4512D-2UM-019',vid:4660,pid:16},entries:[{message:'Read model'}]};
 const env={Date,Blob,File,navigator:nav,RcDiagnosticSnapshot:()=>data,RcSimpleUI:{diagnosticStatus:key=>statuses.push(key)},
  URL:{createObjectURL:blob=>{saved.push({blob});return 'blob:diagnostics'},revokeObjectURL(){}},setTimeout:fn=>fn(),
  document:{getElementById:()=>button,createElement:()=>({click(){saved.at(-1).filename=this.download}})}};
 return {env,data,button,shared,saved,statuses,api:create(env)};
}
test('Share Diagnostic hands a dated JSON file with current remote data to the system share sheet',async()=>{
 let payload;const s=setup({canShare:()=>true,share:async p=>{payload=p}});
 assert.equal(await s.api.share(),true);assert.match(payload.files[0].name,/^RC-OTA-Diagnostics_\d{8}_\d{6}\.json$/);
 assert.deepEqual(JSON.parse(await payload.files[0].text()),s.data);assert.equal(s.saved.length,0);
 assert.equal(s.statuses.at(-1),'diagnosticShared');assert.equal(s.button.disabled,false);
});
test('text-only sharing includes the same JSON when file sharing is unsupported',async()=>{
 let payload;const s=setup({canShare:()=>false,share:async p=>{payload=p}});
 await s.api.share();assert.deepEqual(JSON.parse(payload.text),s.data);assert.equal(payload.files,undefined);assert.equal(s.saved.length,0);
});

test('a browser that rejects JSON attachments can share the same report as a plain-text attachment',async()=>{
 let payload;const s=setup({canShare:p=>p.files[0].type==='text/plain',share:async p=>{payload=p}});
 await s.api.share();assert.match(payload.files[0].name,/\.txt$/);assert.deepEqual(JSON.parse(await payload.files[0].text()),s.data);
 assert.equal(s.saved.length,0);
});
test('unsupported sharing saves a JSON attachment without a network request',async()=>{
 const s=setup();await s.api.share();assert.equal(s.saved.length,1);
 assert.match(s.saved[0].filename,/\.json$/);assert.deepEqual(JSON.parse(await s.saved[0].blob.text()),s.data);
 assert.equal(s.statuses.at(-1),'diagnosticSaved');
});
test('cancelling system sharing does not download or send another report',async()=>{
 const s=setup({share:async()=>{throw Object.assign(Error('cancelled'),{name:'AbortError'})}});
 assert.equal(await s.api.share(),false);assert.equal(s.saved.length,0);assert.equal(s.statuses.at(-1),'diagnosticCancelled');assert.equal(s.button.disabled,false);
});
test('a failed share falls back to a downloadable attachment',async()=>{
 const s=setup({share:async()=>{throw Error('Unavailable')}});await s.api.share();
 assert.equal(s.saved.length,1);assert.equal(s.statuses.at(-1),'diagnosticSaved');assert.equal(s.button.disabled,false);
});
test('duplicate taps cannot open overlapping share sheets',async()=>{
 let finish,calls=0;const s=setup({share:()=>{calls++;return new Promise(resolve=>{finish=resolve})}});
 const pending=s.api.share();assert.equal(s.button.disabled,true);assert.equal(await s.api.share(),false);assert.equal(calls,1);
 finish();await pending;assert.equal(s.button.disabled,false);
});
test('Save diagnostics uses the same report and date naming as sharing',async()=>{
 const s=setup();assert.equal(s.api.download(),true);assert.equal(s.saved.length,1);
 assert.match(s.saved[0].filename,/^RC-OTA-Diagnostics_\d{8}_\d{6}\.json$/);assert.deepEqual(JSON.parse(await s.saved[0].blob.text()),s.data);
});
