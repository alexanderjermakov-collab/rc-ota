const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const T=require('../docs/telink-ota.js'),RcOta=require('../docs/ota.js');
const model='AN2303B-2UM-001';
function setup({native=false,properties={read:true,writeWithoutResponse:true},server=false,mac='',target='0.0.16',restart=false,applyUpdate=true,reconnectError=false,store,pro=false,allowModelMismatch=false,confirmation=true,sourceModel=model,localFilename,renameAfter,catalogue=model,fetchOverride}={}){
 const nodes=new Map(),writes=[],locks=[],requests=[],handlers={},resumed=[],confirmations=[],infos=[];let version='V0.0.15',metadataFirmware=version,currentModel=sourceModel,level=100,disconnects=0,reconnects=0;
 const node=id=>{if(!nodes.has(id))nodes.set(id,{hidden:false,disabled:false,checked:false,textContent:'',value:'',files:[]});return nodes.get(id)};
 const bytes=new Uint8Array(145),filename=localFilename||sourceModel+'_V'+target+'.bin';node('proModelOverride').checked=allowModelMismatch;node('webFirmware').files=[{name:filename,size:bytes.length,arrayBuffer:async()=>bytes.buffer}];
 const ota={properties,writeValueWithoutResponse:async b=>{writes.push(Buffer.from(b));if(b[0]===2&&b[1]===255){if(applyUpdate){version='V'+target;if(renameAfter)currentModel=renameAfter;}if(restart){device.gatt.connected=false;handlers['rcota-metadata']?.({detail:{}});}}},readValue:async()=>new DataView(new ArrayBuffer(0))};
 const encoded=text=>new DataView(new TextEncoder().encode(text).buffer);
 let device={name:'SHARP SOLAR RCU',gatt:{connected:true,disconnect(){disconnects++;this.connected=false;handlers['rcota-metadata']?.()},connect:async function(){reconnects++;if(reconnectError){const error=Error('Authentication failed');error.name='SecurityError';throw error;}this.connected=true;return this},getPrimaryService:async service=>service===T.SERVICE?{getCharacteristic:async()=>ota}:service==='battery_service'?{getCharacteristic:async()=>({readValue:async()=>new DataView(new Uint8Array([level]).buffer)})}:{getCharacteristic:async name=>({readValue:async()=>encoded(name==='model_number_string'?currentModel:version)})}}};
 const window={RcSimpleUI:{upgrade(){},serverInfo:value=>infos.push(value),isPro:()=>pro,confirmModelOverride:async(file,actual)=>{confirmations.push({file,actual});return confirmation;}},RcTelink:T,RcFirmwareStore:store,RcWebRemote:{context:()=>({native,connected:device.gatt.connected,device,metadata:{model:currentModel,firmware:metadataFirmware}}),lock:v=>locks.push(v),resumeAfterUpgrade:(remote,value)=>{resumed.push(value);metadataFirmware=value.firmware;return remote===device}},addEventListener:(name,fn)=>handlers[name]=fn};
 const fetch=async url=>{requests.push(url);if(fetchOverride){const value=await fetchOverride(url);if(value!==undefined)return value;}if(!server)throw Error('unexpected network');const base='https://firmware.umc-poland.com/'+catalogue+'/';if(url===base)return new Response(base+filename+' '+base+'ota_info.txt',{headers:{'content-type':'text/html'}});if(url.endsWith('.txt'))return new Response('name: '+filename+'\nversion: '+target+'\nmd5sum: '+T.md5(bytes)+(mac?'\nmac: '+mac:''));return new Response(bytes,{headers:{'content-type':'application/octet-stream'}})};
 vm.runInNewContext(fs.readFileSync('docs/web-upgrade.js','utf8'),{window,document:{getElementById:node},RcOta,TextDecoder,Uint8Array,URL,TypeError,fetch,AbortController,setTimeout:(fn,ms)=>setTimeout(fn,ms===3000?1:ms),clearTimeout,console});
 return {node,writes,locks,requests,window,handlers,confirmations,infos,setPro:value=>{pro=value},get device(){return device},resumed,disconnects:()=>disconnects,reconnects:()=>reconnects,async manualReconnect(){await device.gatt.connect();metadataFirmware=version;handlers['rcota-metadata']?.({detail:{model:currentModel,firmware:version,level}});},async nextUnit(options={}){device.gatt.connected=false;handlers['rcota-next-remote']?.();currentModel=options.model||model;version=metadataFirmware=options.version||'V0.0.15';level=options.level??100;device={...device,gatt:{...device.gatt,connected:true}};handlers['rcota-metadata']?.({detail:{model:currentModel,firmware:version}});await waitFor(()=>window.RcWebUpgrade.diagnostics().state!=='preparing');}};
}
async function waitFor(predicate){const until=Date.now()+2000;while(!predicate()&&Date.now()<until)await new Promise(setImmediate);assert.ok(predicate(),'Expected asynchronous preparation to finish');}

test('server lookup can inspect a renamed catalogue without a BLE connection in normal mode and Pro',async()=>{
 for(const pro of [false,true]){
  const s=setup({server:true,pro,catalogue:'AN4512E-20UM021-008',localFilename:'AN4512E-20UM021-008_V0.0.16.bin'});
  s.device.gatt.connected=false;s.node('serverModel').value='AN4512E-20UM021-008';
  await s.node('webPrepareServer').onclick();const info=s.infos.at(-1);
  assert.equal(info.status,'otaReady');assert.match(info.text,/name: AN4512E-20UM021-008/);
  assert.equal(info.filename,'AN4512E-20UM021-008_V0.0.16.bin');
  assert.equal(info.binaryUrl,'https://firmware.umc-poland.com/AN4512E-20UM021-008/AN4512E-20UM021-008_V0.0.16.bin');
  assert.equal(s.requests.length,1);assert.equal(s.writes.length,0);
 }
});

test('server 404 is reported as a missing catalogue with no fabricated BIN or file chooser',async()=>{
 const s=setup({server:true,fetchOverride:async()=>new Response('Not found',{status:404})});
 await s.node('webPrepareServer').onclick();assert.equal(s.infos.at(-1).status,'otaNotFound');
 assert.equal(s.infos.at(-1).binaryUrl,undefined);assert.equal(s.writes.length,0);
 assert.equal(s.node('webDownloadServer').disabled,true);
});

test('binary fetch failure keeps the TXT, filename and real direct download URL visible',async()=>{
 const s=setup({server:true,fetchOverride:async url=>{if(url.endsWith('.bin'))throw new TypeError('Failed to fetch')}});
 await s.node('webPrepareServer').onclick();await s.node('webDownloadServer').onclick();
 const info=s.infos.at(-1);assert.equal(info.status,'otaBinBlocked');assert.match(info.text,/md5sum:/);
 assert.ok(info.binaryUrl.endsWith('.bin'));assert.match(info.filename,/\.bin$/);
 assert.equal(s.writes.length,0);assert.equal(s.node('webInstall').disabled,true);
});

test('a catalogue-specific TXT filename is discovered from the listing only when the default TXT is missing',async()=>{
 const base='https://firmware.umc-poland.com/'+model+'/',filename=model+'_V0.0.16.bin';
 const s=setup({server:true,fetchOverride:async url=>{
  if(url===base+'ota_info.txt')return new Response('Not found',{status:404});
  if(url===base)return new Response(base+filename+' '+base+'Release_Info.txt');
 }});
 await s.node('webPrepareServer').onclick();assert.equal(s.requests.length,3);
 assert.equal(s.infos.at(-1).url,base+'Release_Info.txt');assert.equal(s.writes.length,0);
});

test('normal mode can inspect another server model but preparing it requires explicit Pro override',async()=>{
 for(const pro of [false,true]){
  const s=setup({server:true,sourceModel:'AN4512D-2UM-019',catalogue:'AN4512E-20UM021-008',localFilename:'AN4512E-20UM021-008_V0.0.16.bin',pro,allowModelMismatch:pro});
  s.node('serverModel').value='AN4512E-20UM021-008';await s.node('webPrepareServer').onclick();
  assert.equal(s.infos.at(-1).status,'otaReady');await s.node('webDownloadServer').onclick();
  assert.equal(s.writes.length,0);assert.equal(s.window.RcWebUpgrade.diagnostics().state,pro?'ready':'error');
  if(pro){assert.equal(s.window.RcWebUpgrade.diagnostics().package.modelOverride,true);assert.equal(s.window.RcWebUpgrade.diagnostics().package.fileModel,'AN4512E-20UM021-008');}
 }
});

test('malicious metadata cannot turn the direct BIN link into another host or a path traversal',async()=>{
 const s=setup({server:true,fetchOverride:async url=>url.endsWith('.txt')?new Response('name: ../../other.bin\nversion: 0.0.16\nmd5sum: '+'0'.repeat(32)):undefined});
 await s.node('webPrepareServer').onclick();assert.equal(s.infos.at(-1).binaryUrl,undefined);assert.equal(s.node('webDownloadServer').disabled,true);
 assert.equal(s.writes.length,0);
});

test('file chooser stays available before connection and a local selection is retained visibly without writes',async()=>{
 const s=setup();s.device.gatt.connected=false;s.handlers['rcota-metadata']({detail:{}});
 assert.equal(s.node('webChooseFile').disabled,false);assert.equal(s.node('webFirmware').disabled,false);
 await s.window.RcWebUpgrade.selectLocalFile();
 assert.equal(s.window.RcWebUpgrade.diagnostics().state,'local-selected');
 assert.match(s.window.RcWebUpgrade.diagnostics().chosenFilename,/\.bin$/);
 assert.equal(s.writes.length,0);assert.equal(s.node('webInstall').disabled,true);
});

test('Pro alone does not bypass a different model filename; the explicit override is required',async()=>{
 for(const config of [{pro:false,allowModelMismatch:true},{pro:true,allowModelMismatch:false}]){
  const s=setup({...config,sourceModel:'AN4512D-2UM-019',localFilename:'AN4512E-20UM021-008_V0.0.16.bin'});
  await s.node('webPrepareLocal').onclick();
  assert.equal(s.window.RcWebUpgrade.diagnostics().state,'error');assert.equal(s.writes.length,0);
  assert.match(s.window.RcWebUpgrade.diagnostics().chosenFilename,/AN4512E/);
 }
});

test('Pro rename prepares without writes and cancellation of the model warning sends no packets',async()=>{
 const s=setup({pro:true,allowModelMismatch:true,confirmation:false,sourceModel:'AN4512D-2UM-019',localFilename:'AN4512E-20UM021-008_V0.0.16.bin'});
 await s.node('webPrepareLocal').onclick();assert.equal(s.window.RcWebUpgrade.diagnostics().state,'ready');
 assert.equal(s.writes.length,0);s.node('webConfirm').checked=true;
 await s.node('webInstall').onclick();assert.equal(s.confirmations.length,1);assert.equal(s.writes.length,0);
 assert.equal(s.confirmations[0].actual,'AN4512D-2UM-019');
 assert.equal(s.confirmations[0].file.fileModel,'AN4512E-20UM021-008');
});

test('confirmed Pro rename verifies the renamed model on the same device after transfer',async()=>{
 const s=setup({pro:true,allowModelMismatch:true,sourceModel:'AN4512D-2UM-019',localFilename:'AN4512E-20UM021-008_V0.0.16.bin',renameAfter:'AN4512E-20UM021-008'});
 await s.node('webPrepareLocal').onclick();s.node('webConfirm').checked=true;await s.node('webInstall').onclick();
 assert.equal(s.confirmations.length,1);assert.ok(s.writes.length>0);
 assert.equal(s.window.RcWebUpgrade.diagnostics().state,'installed');
 assert.equal(s.resumed[0].model,'AN4512E-20UM021-008');
 assert.equal(s.window.RcWebUpgrade.diagnostics().batchApproved,false);
 assert.ok(s.window.RcWebUpgrade.diagnostics().events.some(e=>e.type==='model-override-confirmed'));
});

test('leaving Pro after preparation blocks a different-name image without opening the warning or writing',async()=>{
 const s=setup({pro:true,allowModelMismatch:true,localFilename:'OTHER_V0.0.16.bin'});
 await s.node('webPrepareLocal').onclick();s.node('webConfirm').checked=true;s.setPro(false);
 await s.node('webInstall').onclick();assert.equal(s.writes.length,0);assert.equal(s.confirmations.length,0);
});

test('engineering BINs and their approval are not saved for automatic restoration',async()=>{
 const saved=[],store={load:async()=>null,clear:async()=>{},save:async v=>saved.push(v)};
 const s=setup({pro:true,allowModelMismatch:true,localFilename:'OTHER_V0.0.16.bin',store});
 await s.node('webPrepareLocal').onclick();s.node('webConfirm').checked=true;s.node('webConfirm').onchange();
 await s.window.RcWebUpgrade.storageIdle();assert.equal(saved.length,0);
 assert.equal(s.window.RcWebUpgrade.diagnostics().batchApproved,false);
});

test('Pro can rebind retained local bytes to another live model without retaining approval or starting transfer',async()=>{
 const s=setup({pro:true,allowModelMismatch:true,sourceModel:'AN4512D-2UM-019',localFilename:'AN4512E-20UM021-008_V0.0.16.bin'});
 await s.node('webPrepareLocal').onclick();s.node('webConfirm').checked=true;s.node('webConfirm').onchange();
 s.node('webFirmware').files=[];await s.nextUnit({model:'AN4512F-20UM021-008'});
 const d=s.window.RcWebUpgrade.diagnostics();assert.equal(d.state,'ready');
 assert.equal(d.package.model,'AN4512F-20UM021-008');assert.equal(d.package.modelOverride,true);
 assert.equal(d.batchApproved,false);assert.equal(s.writes.length,0);
});

test('a disconnect while the user considers the Pro warning prevents all firmware writes',async()=>{
 const s=setup({pro:true,allowModelMismatch:true,localFilename:'OTHER_V0.0.16.bin'});
 await s.node('webPrepareLocal').onclick();s.node('webConfirm').checked=true;
 s.window.RcSimpleUI.confirmModelOverride=async()=>{s.device.gatt.disconnect();return true;};
 await s.node('webInstall').onclick();assert.equal(s.writes.length,0);
});
test('Chrome shows prepare actions after live read; preparing local BIN makes no BLE writes or server requests',async()=>{const s=setup();assert.equal(s.node('webPrepareLocal').disabled,false);await s.node('webPrepareLocal').onclick();assert.deepEqual(s.writes,[]);assert.deepEqual(s.requests,[]);assert.equal(s.node('webReview').hidden,false);assert.equal(s.node('webInstall').disabled,true);assert.match(s.node('webPackage').textContent,/AN2303B/);assert.deepEqual(s.locks,[true,false])});
test('only explicit checked Install starts a transfer; fresh target read is needed for success',async()=>{const s=setup();await s.node('webPrepareLocal').onclick();await s.node('webInstall').onclick();assert.equal(s.writes.length,0);s.node('webConfirm').checked=true;s.node('webConfirm').onchange();await s.node('webInstall').onclick();assert.ok(s.writes.length>0);assert.equal(s.window.RcWebUpgrade.diagnostics().state,'installed');assert.match(s.node('webUpgradeStatus').textContent,/V0.0.16/);assert.equal(s.node('webConfirm').checked,true);assert.equal(s.window.RcWebUpgrade.diagnostics().batchApproved,true)});
test('changing file or losing connection invalidates preparation and consent',async()=>{const s=setup();await s.node('webPrepareLocal').onclick();s.node('webConfirm').checked=true;s.node('webFirmware').onchange();await s.node('webInstall').onclick();assert.equal(s.writes.length,0);assert.equal(s.node('webConfirm').checked,false);await s.node('webPrepareLocal').onclick();s.device.gatt.disconnect();assert.equal(s.node('webReview').hidden,true);assert.equal(s.node('webPrepareLocal').disabled,true)});
test('native diagnostics do not enable firmware writes; server metadata lookup stays independent',async()=>{const s=setup({native:true});assert.equal(s.node('webPrepareServer').disabled,false);await s.node('webPrepareLocal').onclick();assert.equal(s.writes.length,0);assert.equal(s.locks.length,0)});
test('wrong OTA properties block file preparation without any write',async()=>{const s=setup({properties:{read:true,writeWithoutResponse:false}});await s.node('webPrepareLocal').onclick();assert.equal(s.writes.length,0);assert.match(s.node('webUpgradeStatus').textContent,/unavailable/);assert.equal(s.node('webReview').hidden,true)});
test('From server loads TXT first and waits for a separate explicit BIN action',async()=>{const s=setup({server:true});await s.node('webPrepareServer').onclick();assert.equal(s.requests.length,1);assert.ok(s.requests[0].endsWith('/ota_info.txt'));assert.equal(s.node('webReview').hidden,true);assert.equal(s.writes.length,0);await s.node('webDownloadServer').onclick();assert.equal(s.requests.length,2);assert.equal(s.writes.length,0);assert.equal(s.node('webReview').hidden,false);assert.match(s.node('webUpgradeStatus').textContent,/ready for this remote/)});
test('MAC restricted metadata can be read, but its BIN is not loaded for installation',async()=>{const s=setup({server:true,mac:'AA:BB:CC:DD:EE:FF'});await s.node('webPrepareServer').onclick();assert.equal(s.requests.length,1);await s.node('webDownloadServer').onclick();assert.equal(s.requests.length,1);assert.equal(s.writes.length,0);assert.match(s.node('webUpgradeStatus').textContent,/MAC restriction/)});
test('same-version reinstall is sent but never claimed independently verified; disconnect retains the result',async()=>{const s=setup({target:'0.0.15'});await s.node('webPrepareLocal').onclick();s.node('webConfirm').checked=true;await s.node('webInstall').onclick();assert.ok(s.writes.length>0);assert.equal(s.window.RcWebUpgrade.diagnostics().state,'installation-unconfirmed');s.handlers['rcota-metadata']({detail:{}});assert.match(s.node('webUpgradeStatus').textContent,/version alone/)});
test('successful OTA retains a healthy connection and returns current information to the app',async()=>{const s=setup();await s.node('webPrepareLocal').onclick();s.node('webConfirm').checked=true;await s.node('webInstall').onclick();assert.equal(s.disconnects(),0);assert.equal(s.device.gatt.connected,true);assert.equal(s.resumed[0].firmware,'V0.0.16');assert.equal(s.window.RcWebUpgrade.diagnostics().events.at(-1).forcedDisconnect,false)});
test('after reboot there are zero automatic reconnects; an explicit reconnect verifies the same unit',async()=>{const s=setup({restart:true});await s.node('webPrepareLocal').onclick();s.node('webConfirm').checked=true;await s.node('webInstall').onclick();assert.equal(s.reconnects(),0);assert.equal(s.device.gatt.connected,false);assert.equal(s.window.RcWebUpgrade.diagnostics().state,'awaiting-reconnect');await s.manualReconnect();assert.equal(s.reconnects(),1);assert.equal(s.window.RcWebUpgrade.diagnostics().state,'installed');assert.equal(s.window.RcWebUpgrade.diagnostics().actualFirmware,'V0.0.16');assert.equal(s.window.RcWebUpgrade.diagnostics().batchApproved,true)});
test('an existing healthy link is read once; an old version never triggers reconnect attempts',async()=>{const s=setup({applyUpdate:false});await s.node('webPrepareLocal').onclick();s.node('webConfirm').checked=true;await s.node('webInstall').onclick();assert.equal(s.window.RcWebUpgrade.diagnostics().state,'awaiting-reconnect');assert.equal(s.window.RcWebUpgrade.diagnostics().actualFirmware,'V0.0.15');assert.equal(s.resumed[0].firmware,'V0.0.15');assert.equal(s.disconnects(),0);assert.equal(s.reconnects(),0);assert.equal(s.window.RcWebUpgrade.diagnostics().events.filter(e=>e.type==='live-readback').length,1)});
test('post-transfer flow never tries automatic authentication on a closed link',async()=>{const s=setup({restart:true,reconnectError:true});await s.node('webPrepareLocal').onclick();s.node('webConfirm').checked=true;await s.node('webInstall').onclick();const report=s.window.RcWebUpgrade.diagnostics();assert.equal(report.state,'awaiting-reconnect');assert.equal(s.reconnects(),0);assert.equal(s.disconnects(),0);assert.ok(report.events.some(e=>e.type==='manual-reconnect-required'));assert.equal(report.systemBondState,'Not observable in Web Bluetooth')});

test('batch preserves approved bytes across remotes; selecting the second remote never starts a write',async()=>{const s=setup();await s.node('webPrepareLocal').onclick();s.node('webConfirm').checked=true;s.node('webConfirm').onchange();await s.node('webInstall').onclick();const firstCount=s.writes.length,hash=s.window.RcWebUpgrade.diagnostics().package.sha256;s.node('webFirmware').files=[];await s.nextUnit();assert.equal(s.window.RcWebUpgrade.diagnostics().state,'ready');assert.equal(s.node('webInstall').disabled,false);assert.equal(s.node('webReview').hidden,true);assert.equal(s.writes.length,firstCount);assert.equal(s.window.RcWebUpgrade.diagnostics().package.sha256,hash);await s.node('webInstall').onclick();assert.equal(s.writes.length,firstCount*2);assert.equal(s.requests.length,0);assert.equal(s.window.RcWebUpgrade.diagnostics().package.filename,model+'_V0.0.16.bin')});
test('wrong-model and low-battery units cannot use the batch approval, while a later matching unit can',async()=>{const s=setup();await s.node('webPrepareLocal').onclick();s.node('webConfirm').checked=true;s.node('webConfirm').onchange();await s.nextUnit({model:'AN2101A-20UM021-001'});assert.equal(s.node('webInstall').disabled,true);await s.node('webInstall').onclick();assert.equal(s.writes.length,0);assert.equal(s.window.RcWebUpgrade.diagnostics().package.model,model);await s.nextUnit({level:20});assert.equal(s.node('webInstall').disabled,true);assert.match(s.node('webUpgradeStatus').textContent,/30%/);await s.nextUnit();assert.equal(s.node('webInstall').disabled,false);assert.equal(s.node('webReview').hidden,true)});
test('selecting another BIN revokes the old batch consent, even when the bytes are identical',async()=>{const s=setup();await s.node('webPrepareLocal').onclick();s.node('webConfirm').checked=true;s.node('webConfirm').onchange();assert.equal(s.window.RcWebUpgrade.diagnostics().batchApproved,true);s.node('webFirmware').onchange();await s.node('webPrepareLocal').onclick();assert.equal(s.window.RcWebUpgrade.diagnostics().batchApproved,false);assert.equal(s.node('webConfirm').checked,false);assert.equal(s.node('webInstall').disabled,true)});
test('forget clears only the remote binding and keeps the approved BIN for the next unit',async()=>{const s=setup();await s.node('webPrepareLocal').onclick();s.node('webConfirm').checked=true;s.node('webConfirm').onchange();s.device.gatt.disconnect();s.handlers['rcota-remote-forgotten']();assert.equal(s.window.RcWebUpgrade.diagnostics().state,'retained');assert.equal(s.window.RcWebUpgrade.diagnostics().batchApproved,true);await s.nextUnit();assert.equal(s.node('webInstall').disabled,false);assert.equal(s.requests.length,0)});
function memoryStore(){let saved=null;return {load:async()=>saved,save:async value=>{saved=structuredClone(value);return true},clear:async()=>{saved=null},corrupt(){saved.bytes[0]^=1},get saved(){return saved}}}
test('a page reload restores the BIN and its hash-bound consent without a file input selection',async()=>{const store=memoryStore(),first=setup({store});await first.node('webPrepareLocal').onclick();first.node('webConfirm').checked=true;first.node('webConfirm').onchange();await first.window.RcWebUpgrade.storageIdle();assert.ok(store.saved);const restored=setup({store});restored.node('webFirmware').files=[];await waitFor(()=>restored.window.RcWebUpgrade.diagnostics().storage==='restored'&&restored.window.RcWebUpgrade.diagnostics().state==='ready');assert.equal(restored.node('webInstall').disabled,false);assert.equal(restored.node('webReview').hidden,true);assert.equal(restored.writes.length,0);assert.equal(restored.requests.length,0)});
test('corrupted saved bytes cannot restore batch consent',async()=>{const store=memoryStore(),first=setup({store});await first.node('webPrepareLocal').onclick();first.node('webConfirm').checked=true;first.node('webConfirm').onchange();await first.window.RcWebUpgrade.storageIdle();store.corrupt();const second=setup({store});await waitFor(()=>second.window.RcWebUpgrade.diagnostics().events?.some(e=>e.type==='firmware-restore-error'));assert.equal(second.node('webInstall').disabled,true);assert.equal(second.window.RcWebUpgrade.diagnostics().batchApproved,false);assert.equal(second.writes.length,0)});
test('blocked local storage preserves the in-page batch and reports session-only retention',async()=>{const s=setup({store:{load:async()=>null,save:async()=>{throw Error('quota')},clear:async()=>{}}});await s.node('webPrepareLocal').onclick();s.node('webConfirm').checked=true;s.node('webConfirm').onchange();await s.window.RcWebUpgrade.storageIdle();assert.equal(s.window.RcWebUpgrade.diagnostics().storage,'session-only');await s.nextUnit();assert.equal(s.node('webInstall').disabled,false);assert.equal(s.writes.length,0)});
test('server batch reuses downloaded bytes but still rejects a unit with newer installed firmware',async()=>{const s=setup({server:true});await s.node('webPrepareServer').onclick();await s.node('webDownloadServer').onclick();s.node('webConfirm').checked=true;s.node('webConfirm').onchange();assert.equal(s.requests.length,2);await s.nextUnit();assert.equal(s.node('webInstall').disabled,false);assert.equal(s.requests.length,2);await s.nextUnit({version:'V0.1.0'});assert.equal(s.node('webInstall').disabled,true);assert.equal(s.requests.length,2);assert.equal(s.writes.length,0);assert.equal(s.window.RcWebUpgrade.diagnostics().batchApproved,true)});
