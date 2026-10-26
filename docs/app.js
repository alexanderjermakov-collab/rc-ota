'use strict';
const $=id=>document.getElementById(id),entries=[];
const optionalServices=['device_information','battery_service','4169726f-6861-4446-5553-657276696365','00010203-0405-0607-0809-0a0b0c0d1912','0000d0ff-3c17-d293-8e48-14fe2e4da212','0000fef6-0000-1000-8000-00805f9b34fb','0000ffd4-0000-1000-8000-00805f9b34fb'];
let port=window.RcLocalBridge?.port||null,device=null,metadata={},services=[],connected=false,busy=false,revision=0;
let permittedDevice=null,lastReadMetadata={},readAt=0;
let freshFields=new Set();
let savedId='';try{savedId=localStorage.getItem('rcota-device-id')||''}catch{}
function remember(remote){if(!remote?.id)return;savedId=remote.id;try{localStorage.setItem('rcota-device-id',savedId)}catch{}}
let restoreDiagnostic={getDevicesSupported:false,permittedCount:null,sharpCount:null,reason:'Not checked'};
async function savedRemote(){
 if(permittedDevice){log('Reusing remote permission from this open page.');return permittedDevice}
 restoreDiagnostic.getDevicesSupported=typeof navigator.bluetooth?.getDevices==='function';
 if(!restoreDiagnostic.getDevicesSupported){restoreDiagnostic.reason='This Chrome does not expose previously permitted devices. Choose the remote once to reconnect; site permission is separate from system pairing.';log(restoreDiagnostic.reason);return null}
 const devices=await timed(navigator.bluetooth.getDevices(),5000,'Saved device lookup timed out.');
 const sharp=devices.filter(d=>/sharp/i.test(d.name||''));
 restoreDiagnostic.permittedCount=devices.length;restoreDiagnostic.sharpCount=sharp.length;
 const previous=devices.find(d=>savedId&&d.id===savedId)|| (sharp.length===1?sharp[0]:null);
 restoreDiagnostic.reason=previous?'Previously permitted remote found':sharp.length>1?'Several permitted SHARP remotes found. Choose the remote to use.':'Chrome has no matching remote permission for this site. Android pairing alone does not grant website access. Choose the remote once.';
 log(`Browser permission lookup: ${devices.length} permitted, ${sharp.length} SHARP. ${restoreDiagnostic.reason}`);
 return previous;
}
function pairing(value){$('pairing').textContent=value}

function log(message){entries.push({time:new Date().toISOString(),message});if(entries.length>200)entries.shift();$('log').textContent=entries.map(e=>`${e.time.slice(11,19)}  ${e.message}`).join('\n');console.info('[RCOTA]',message)}
function state(value,message){if(!value)window.dispatchEvent?.(new CustomEvent('rcota-metadata',{detail:{}}));connected=value;$('connection').textContent=value?'GATT verified':busy?'Connecting…':'Disconnected';$('connect').disabled=value||busy;$('disconnect').disabled=!value&&!busy;$('status').textContent=message;log(message);if(readAt)render()}
function render(){for(const key of ['name','model','firmware','software','hardware','manufacturer','address'])$(key).textContent=metadata[key]||'—';$('level').textContent=Number.isFinite(metadata.level)?metadata.level+'%':'—';
 const historical=Object.keys(metadata).some(key=>!['name','address'].includes(key)&&!freshFields.has(key));
 $('readTime').textContent=readAt?(connected&&!historical?'Live read · ':'Last read data; some values may be historical · ')+new Date(readAt).toLocaleString():'No remote parameters have been read.';
 for(const key of ['model','firmware','software','hardware','manufacturer'])$(key).title=metadata[key]&&!freshFields.has(key)?'Retained from an earlier read':'';
 $('level').title=Number.isFinite(metadata.level)&&!freshFields.has('level')?'Retained from an earlier read':'';
}
function showServices(value){services=value;$('services').textContent=value.length?value.map(s=>s.uuid+'\n'+s.characteristics.map(c=>'  '+c.uuid+'  '+c.properties).join('\n')).join('\n\n'):'No permitted services were returned.';log(`${value.length} permitted GATT services discovered`)}
function receive(event){try{const m=JSON.parse(event.data);if(m.type==='status'){pairing(m.bondState==='bonded'?'Paired in Android':m.bondState==='bonding'?'Android pairing in progress':m.bondState==='none'?'Not paired in Android':'Pairing state unavailable');if(typeof m.oemAvailable==='boolean')$('original').hidden=!m.oemAvailable;busy=!!m.connecting;state(!!m.connected,m.message);if(m.connected)window.dispatchEvent?.(new CustomEvent('rcota-metadata',{detail:{...metadata}}))}else if(m.type==='metadata'){metadata=m.value||{};render();log('Device information received.')}else if(m.type==='services')showServices(m.value);else if(m.type==='ota-result')window.dispatchEvent?.(new CustomEvent('rcota-ota-result',{detail:m}))}catch(e){log('Invalid bridge response: '+e.message)}}
window.addEventListener('message',event=>{if(location.origin!=='https://appassets.androidplatform.net'||(event.origin!==location.origin&&event.origin!==''&&event.origin!=='null')||(event.source!==window&&event.source!==null)||event.data!=='rcota-native-v1'||!event.ports?.[0])return;port?.close();port=event.ports[0];port.onmessage=receive;port.start();port.postMessage(JSON.stringify({type:'hello'}));$('transport').textContent='Android BLE Bridge';$('original').hidden=false;log('Native BLE bridge ready')});
async function timed(promise,ms,message){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(message)),ms)})])}finally{clearTimeout(timer)}}
function current(id){if(id!==revision)throw new Error('Connection attempt cancelled.')}
// Serialize GATT operations: a timeout does not cancel a Windows Bluetooth request.
async function gattStep(operation, id, description) {
 current(id);
 log(description);
 try {
  const value=await timed(operation(),8000,description+' timed out.');
  current(id);
  return value;
 } catch(error) {
  current(id);
  if (/timed out/.test(error.message)) {
   error.gattTimeout=true;
   throw error;
  }
  if (!device?.gatt.connected) throw error;
  throw error;
 }
}
function recordRead(key,value) {
 metadata[key]=value;freshFields.add(key);readAt=Date.now();lastReadMetadata={...metadata};render();
}
async function readInfo(server,id) {
 let liveReads=0;
 // Battery first: it is independently useful even when Device Information is absent.
 try {
  const service=await gattStep(()=>server.getPrimaryService('battery_service'),id,'Finding Battery service');
  const characteristic=await gattStep(()=>service.getCharacteristic('battery_level'),id,'Finding battery level');
  const value=await gattStep(()=>characteristic.readValue(),id,'Reading battery level');
  if(value.byteLength&&value.getUint8(0)<=100){recordRead('level',value.getUint8(0));liveReads++;}
  else log('Battery value is empty or outside 0–100%.');
 } catch(error) {
  current(id);log('Battery information unavailable: '+error.message);
  if(error.gattTimeout||!device?.gatt.connected)throw error;
 }
 try {
  const service=await gattStep(()=>server.getPrimaryService('device_information'),id,'Finding Device Information service');
  for(const [key,name] of [['model','model_number_string'],['firmware','firmware_revision_string'],['software','software_revision_string'],['hardware','hardware_revision_string'],['manufacturer','manufacturer_name_string']]) {
   try {
    const characteristic=await gattStep(()=>service.getCharacteristic(name),id,'Finding '+key);
    const value=await gattStep(()=>characteristic.readValue(),id,'Reading '+key);
    const text=new TextDecoder().decode(value).replace(/\0/g,'').trim();
    if(text){recordRead(key,text);liveReads++;}else log(key+' returned an empty value.');
   } catch(error) {
    current(id);log(key+' unavailable: '+error.message);
    if(error.gattTimeout||!device?.gatt.connected)throw error;
   }
  }
 } catch(error) {
  current(id);log('Device information unavailable: '+error.message);
  if(error.gattTimeout||!device?.gatt.connected)throw error;
 }
 return liveReads;
}
async function discover(server,id) {
 const result=[];
 try {
  for(const service of await gattStep(()=>server.getPrimaryServices(),id,'Listing permitted services')) {
   try {
    const chars=await gattStep(()=>service.getCharacteristics(),id,'Listing characteristics for '+service.uuid);
    result.push({uuid:service.uuid,characteristics:chars.map(c=>({uuid:c.uuid,properties:['read','write','writeWithoutResponse','notify','indicate'].filter(k=>c.properties[k]).join(', ')}))});
   }catch(error){current(id);if(error.gattTimeout||!device?.gatt.connected)throw error;log('Service unavailable: '+error.message);}
  }
 }catch(error){current(id);showServices(result);if(error.gattTimeout||!device?.gatt.connected)throw error;log('Some permitted services could not be listed: '+error.message);}
 current(id);showServices(result);
}
async function connectRemote(forceChooser=false,preselected=null){if(port){port.postMessage(JSON.stringify({type:forceChooser?'choose':'connect'}));return}if(busy||connected)return;if(!isSecureContext||!navigator.bluetooth){state(false,'Bluetooth is unavailable in this browser. On Android, open this HTTPS page directly in Chrome.');return}const id=++revision;let selected;busy=true;freshFields.clear();services=[];render();state(false,'Choose your SHARP remote, not this phone. Device selection is not a completed GATT connection.');try{selected=preselected||(!forceChooser?await savedRemote():null);current(id);if(selected)log('Reusing previously permitted remote without reopening the chooser.');if(!selected)selected=await navigator.bluetooth.requestDevice($('allDevices').checked?{acceptAllDevices:true,optionalServices}:{filters:[{namePrefix:'SHARP'},{namePrefix:'Sharp'},{namePrefix:'sharp'}],optionalServices});current(id);if(permittedDevice&&selected!==permittedDevice&&(!selected.id||selected.id!==permittedDevice.id)){metadata={};lastReadMetadata={};readAt=0;}permittedDevice=selected;remember(selected);pairing('Browser access allowed · system pairing is managed by your operating system');device=selected;device.addEventListener('gattserverdisconnected',()=>{if(id!==revision)return;revision++;busy=false;lastReadMetadata={...metadata};freshFields.clear();render();services=[];$('services').textContent='Remote disconnected.';state(false,'Remote GATT disconnected. Displayed data is from the last read. Press Connect remote to reconnect without selecting again while this page stays open.')},{once:true});state(false,'Connecting. Keep the remote awake.');const attempt=selected.gatt.connect();attempt.then(()=>{if(id!==revision)selected.gatt.disconnect()},()=>{});const server=await timed(attempt,25000,'Connection timed out. Wake the remote and reconnect.');current(id);metadata={...metadata,name:device.name||'Unnamed device',address:'Not exposed by Web Bluetooth'};render();state(false,'GATT link open. Verifying the remote and reading its services…');const liveReads=await readInfo(server,id);current(id);await discover(server,id);current(id);if(!selected.gatt.connected)throw new Error('GATT link closed during device verification.');if(!services.length)throw new Error('No readable GATT services were confirmed. Remote connection is not verified.');const recognized=/sharp/i.test(metadata.name)&&!!(metadata.model||metadata.firmware||metadata.software)||services.some(s=>optionalServices.slice(2).includes(s.uuid.toLowerCase()));if(!recognized)throw new Error('This device is not recognized as a supported remote. Select the remote, not a phone.');if(!liveReads)throw new Error('No live read was confirmed. GATT connection is not verified. Wake the remote and reconnect.');busy=false;remember(selected);render();state(true,'Remote GATT verified. No firmware was written. System pairing cannot be confirmed by this browser.');window.dispatchEvent?.(new CustomEvent('rcota-metadata',{detail:Object.fromEntries(Object.entries(metadata).filter(([key])=>freshFields.has(key)||['name','address'].includes(key)))}))}catch(e){if(id!==revision){if(selected?.gatt?.connected)selected.gatt.disconnect();return}revision++;busy=false;if(selected?.gatt?.connected)selected.gatt.disconnect();device=null;lastReadMetadata={...metadata};freshFields.clear();services=[];render();$('services').textContent='Connect a remote to discover its permitted services.';state(false,e.name==='NotFoundError'?'Device selection cancelled.':'Connection failed: '+e.message+(e.gattTimeout?' GATT discovery/read stalled in this browser. On Windows, use the local Windows bridge.':''))}}
$('connect').onclick=()=>connectRemote();
$('choose').onclick=()=>connectRemote(true);
$('disconnect').onclick=()=>{if(port){port.postMessage(JSON.stringify({type:'disconnect'}));return}revision++;busy=false;device?.gatt.disconnect();device=null;lastReadMetadata={...metadata};freshFields.clear();services=[];render();$('services').textContent='Remote disconnected.';state(false,'Disconnected. If a Bluetooth chooser is still open, close it.')};
$('original').onclick=()=>port?.postMessage(JSON.stringify({type:'oem'}));
$('file').onchange=async()=>{const f=$('file').files[0];if(!f)return;if(f.size>16*1024*1024){$('fileInfo').textContent='Choose a firmware file smaller than 16 MiB.';return}try{const bytes=await f.arrayBuffer(),hash=await crypto.subtle.digest('SHA-256',bytes);$('fileInfo').textContent=`${f.name}\n${f.size.toLocaleString()} bytes\nSHA-256: ${Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('')}\nCompatibility: not established. File stays on this device.`;log('Local firmware inspected; no upload or BLE write performed.')}catch(e){$('fileInfo').textContent='Could not inspect file: '+e.message}};
$('export').onclick=()=>{const data={version:'0.11.0',transport:port?'Android BLE Bridge':navigator.bluetooth?'Web Bluetooth':'Unavailable',secureContext:isSecureContext,userAgent:navigator.userAgent,connected,pairingState:$('pairing').textContent,savedDeviceAvailable:!!savedId,inPagePermissionAvailable:!!permittedDevice,lastReadMetadata,readAt,browserRestore:restoreDiagnostic,metadata,services,entries,connectionMeaning:'GATT services verified; Android bond state not exposed by Web Bluetooth'};if(port){port.postMessage(JSON.stringify({type:'export',value:data}));return}const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='rc-ota-diagnostics.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
window.RcNative={available:()=>!!port,send:message=>port?.postMessage(JSON.stringify(message))};
$('transport').textContent=navigator.bluetooth&&isSecureContext?'Web Bluetooth available':'Web Bluetooth unavailable';$('environment').textContent=`Version 0.11.0 · Secure connection: ${isSecureContext?'yes':'no'} · Web Bluetooth: ${navigator.bluetooth?'available':'unavailable'}`;render();pairing('System pairing status is not exposed by Web Bluetooth');
async function restore(){if(location.origin==='https://appassets.androidplatform.net'||port||busy||connected)return;const attemptRevision=revision;try{const previous=await savedRemote();if(port||busy||connected||revision!==attemptRevision)return;if(previous)await connectRemote(false,previous);else state(false,restoreDiagnostic.reason)}catch(e){log('Automatic reconnect unavailable: '+e.message)}}
if(window.RcLocalBridge){$('environment').textContent='Local Android connection';const startLocal=()=>window.RcLocalBridge.start(receive);if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startLocal,{once:true});else startLocal();}else setTimeout(restore,0);
window.addEventListener('pagehide',()=>{revision++;device?.gatt.disconnect();port?.close()});
document.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)||['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;const nodes=[...document.querySelectorAll('button:not(:disabled):not([hidden]),input')],current=nodes.indexOf(document.activeElement);if(current<0){nodes[0]?.focus();event.preventDefault();return}const direction=['ArrowRight','ArrowDown'].includes(event.key)?1:-1;nodes[(current+direction+nodes.length)%nodes.length]?.focus();event.preventDefault()});
