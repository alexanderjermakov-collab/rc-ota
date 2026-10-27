(function(){
'use strict';
const $=id=>document.getElementById(id),T=window.RcTelink;
if(!$('webUpgrade')||!T)return;
let prepared=null,retained=null,approval='',running=false,preparing=false,generation=0,fileRevision=0,verificationDeadline=0,report={state:'idle'},storageQueue=Promise.resolve();
const context=()=>window.RcWebRemote?.context();
const key=file=>file?[file.sha256,file.model,file.filename,file.version,file.source].join('|'):'';
const approved=()=>!!retained&&approval===key(retained);
const summary=()=>retained?{filename:retained.filename,model:retained.model,version:retained.version,source:retained.source,sha256:retained.sha256,batchApproved:approved()}:null;
function record(type,details={}){report.events=report.events||[];report.events.push({time:new Date().toISOString(),type,...details});if(report.events.length>60)report.events.shift();window.RcWebRemote?.logEvent?.('OTA '+type+': '+JSON.stringify(details));}
function status(message,state='idle'){report={...report,state,message,package:summary()};$('webUpgradeStatus').textContent=message;window.RcSimpleUI?.upgrade(report,report.package);}
function render(){const c=context(),ready=!!c?.connected&&!c.native&&!!c.metadata.model;
 $('webSolarDownload').hidden=!ready||c.metadata.model!=='AN2303B-2UM-001'||report.state!=='error'||!/CORS|could not read the manufacturer|Failed to fetch/i.test(report.message||'');
 for(const id of ['webPrepareServer','webPrepareLocal'])$(id).disabled=running||preparing||!ready;
 $('webFirmware').disabled=running||preparing||!ready;
 if(approved())$('webConfirm').checked=true;
 $('webConfirm').disabled=running||preparing||!prepared;
 $('webInstall').disabled=running||preparing||!prepared||!ready||(!approved()&&!$('webConfirm').checked);
 $('webReview').hidden=!prepared||approved();report.package=summary();window.RcSimpleUI?.upgrade(report,report.package);
}
function store(action){const api=window.RcFirmwareStore;if(!api){report.storage='session-only';return;}
 storageQueue=storageQueue.then(()=>action(api)).catch(error=>{report.storage='session-only';record('firmware-storage-error',{message:error.message});});
}
function save(){if(!retained)return;const value={format:1,bytes:new Uint8Array(retained.bytes),sha256:retained.sha256,approval,options:{model:retained.model,filename:retained.filename,version:retained.version,source:retained.source,installed:retained.installed,md5:retained.md5}};
 store(async api=>{report.storage=await api.save(value)?'saved-locally':'session-only';});
}
function invalidate(){generation++;prepared=null;if(!running){$('webProgress').hidden=true;$('webProgress').value=0;}
 $('webConfirm').checked=approved();if(!running)status(retained?'BIN retained. Connect the next remote of the same model.':'Connect and read your remote, then choose firmware.',retained?'retained':'idle');render();
}
function clearFile(){fileRevision++;retained=null;approval='';store(api=>api.clear());invalidate();}
function confirm(){if(prepared&&$('webConfirm').checked){approval=key(retained);save();record('batch-file-approved',{model:retained.model,sha256:retained.sha256});}else if(!$('webConfirm').checked){approval='';save();}render();}
async function bounded(operation,device,ms=15000){if(verificationDeadline){const left=verificationDeadline-Date.now();if(left<=0)throw Error('Post-transfer verification time limit reached.');ms=Math.min(ms,left);}let timer;try{return await Promise.race([operation(),new Promise((_,reject)=>{timer=setTimeout(()=>{record('gatt-timeout',{duringVerification:!!verificationDeadline});device?.gatt.disconnect();reject(Error('Bluetooth operation timed out. Reconnect and prepare the file again.'));},ms)})])}finally{clearTimeout(timer)}}
async function live(device){if(!device.gatt.connected)throw Error('Remote disconnected. Connect and read it again.');const service=await bounded(()=>device.gatt.getPrimaryService('device_information'),device);async function text(name){const c=await bounded(()=>service.getCharacteristic(name),device);return new TextDecoder().decode(await bounded(()=>c.readValue(),device)).replace(/\0/g,'').trim()}
 const model=await text('model_number_string'),firmware=await text('firmware_revision_string'),battery=await bounded(()=>device.gatt.getPrimaryService('battery_service'),device),level=await bounded(()=>battery.getCharacteristic('battery_level'),device),value=await bounded(()=>level.readValue(),device);return {name:device.name,model,firmware,level:value.byteLength?value.getUint8(0):NaN};}
async function ota(device){const s=await bounded(()=>device.gatt.getPrimaryService(T.SERVICE),device),c=await bounded(()=>s.getCharacteristic(T.CHARACTERISTIC),device);if(!c.properties.read||!c.properties.writeWithoutResponse||typeof c.writeValueWithoutResponse!=='function')throw Error('Compatible Telink Legacy OTA characteristic is unavailable.');return {properties:c.properties,writeValueWithoutResponse:bytes=>bounded(()=>c.writeValueWithoutResponse(bytes),device),readValue:()=>bounded(()=>c.readValue(),device)};}
async function download(url,max,binary=false){const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),30000);try{const r=await fetch(url,{signal:abort.signal,redirect:'error',credentials:'omit',cache:'no-store'});if(!r.ok)throw Error('Server returned HTTP '+r.status);if(binary&&/text\/html/i.test(r.headers.get('content-type')||''))throw Error('Server returned HTML instead of firmware metadata/binary.');const reader=r.body.getReader(),chunks=[];let size=0;try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max)throw Error('Server response is too large.');chunks.push(value)}}catch(e){await reader.cancel().catch(()=>{});throw e}const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length}return bytes;}finally{clearTimeout(timer)}}
async function inspectRemote(c){const identity=await live(c.device);T.identity(identity,{model:c.metadata.model,firmware:c.metadata.firmware});return identity;}
function showPrepared(file,device){prepared={file,device};$('webPackage').textContent=[file.filename,'Model: '+file.model,'Installed: '+file.installed,'Target: '+(file.version||'not specified'),'SHA-256: '+file.sha256].join('\n');$('webConfirm').checked=approved();status('Firmware ready for this remote. No firmware has been written.','ready');}
async function bindRetained(){const c=context();if(!retained||running||preparing||!c?.connected||c.native)return;const cached=retained,id=generation;preparing=true;window.RcWebRemote.lock(true);status('Checking the retained BIN for this remote…','preparing');render();
 try{const identity=await inspectRemote(c);if(identity.model!==cached.model)throw Error('The retained BIN identifies a different remote model: '+cached.model);await ota(c.device);
  const file=await T.prepare(cached.bytes,{...cached,installed:identity.firmware});if(id!==generation||cached!==retained||!c.device.gatt.connected)throw Error('Connection changed. Read the remote again.');
  showPrepared(file,c.device);record('retained-file-bound',{model:file.model,installed:file.installed,approved:approved()});
 }catch(error){prepared=null;status(error.message,'error');}finally{preparing=false;window.RcWebRemote.lock(false);render();}
}
async function prepare(source){if(running||preparing)return;const c=context();if(!c?.connected||c.native)return;clearFile();const id=generation;preparing=true;render();window.RcWebRemote.lock(true);status('Reading the remote and checking firmware…','preparing');
 try{const identity=await inspectRemote(c);await ota(c.device);let bytes,options={source,model:identity.model,installed:identity.firmware};
  if(source==='local'){const input=$('webFirmware').files[0];if(!input)throw Error('Choose a local BIN first.');if(input.size>T.MAX)throw Error('The firmware file is too large.');bytes=await input.arrayBuffer();options.filename=input.name;}
  else{const base='https://'+RcOta.HOST+'/'+encodeURIComponent(identity.model)+'/',decode=b=>new TextDecoder().decode(b),links=RcOta.manifest(decode(await download(base,65536))),info=RcOta.info(decode(await download(links.metadataUrl,65536))),url=new URL(links.firmwareUrl);if(decodeURIComponent(url.pathname)!=='/'+identity.model+'/'+info.name)throw Error('The server filename or model folder does not match its metadata.');if(info.mac)throw Error('This update has a MAC restriction that Web Bluetooth cannot verify.');options={...options,filename:info.name,version:info.version,md5:info.md5sum};bytes=await download(links.firmwareUrl,T.MAX,true);}
  const file=await T.prepare(bytes,options);if(id!==generation||!c.device.gatt.connected)throw Error('Connection changed. Prepare the firmware again.');retained=file;approval='';save();showPrepared(file,c.device);
 }catch(error){prepared=null;status(error instanceof TypeError?'The browser could not read the manufacturer server (network/CORS). Use a local BIN.':error.message,'error');}finally{preparing=false;window.RcWebRemote.lock(false);render();}
}
async function verify(device,file){
 let lastRead=null;verificationDeadline=Date.now()+60000;
 try{for(let attempt=1;attempt<=5&&Date.now()<verificationDeadline;attempt++){
  report.verificationAttempt=attempt;record('reconnect-attempt',{attempt,connected:device.gatt.connected});status('Reconnecting to the remote ('+attempt+'/5)…','verifying');
  await new Promise(resolve=>setTimeout(resolve,3000));
  try{if(!device.gatt.connected)await bounded(()=>device.gatt.connect(),device);
   const actual=await live(device);record('live-readback',{attempt,model:actual.model,firmware:actual.firmware,battery:actual.level});
   if(actual.model!==file.model)throw Error('Remote model changed.');
   lastRead=actual;report.actualFirmware=actual.firmware;
   if(!file.version||T.compare(file.version,file.installed)===0||T.compare(actual.firmware,file.version)===0)return actual;
  }catch(error){record('readback-error',{attempt,name:error.name,message:error.message});}
 }}finally{verificationDeadline=0;}return lastRead;
}
async function install(){if(running||preparing||!prepared||(!approved()&&!$('webConfirm').checked))return;const selected=prepared,c=context();if(!c?.connected||c.device!==selected.device){invalidate();return;}
 if(!approved())confirm();running=true;window.RcWebRemote.lock(true);render();$('webProgress').hidden=false;status('Installing. Keep this page open and the remote nearby.','transferring');
 try{record('transfer-start',{model:selected.file.model,installed:selected.file.installed,target:selected.file.version});await T.transfer(selected.file,{readIdentity:()=>live(selected.device),characteristic:()=>ota(selected.device),progress:p=>{$('webProgress').value=p;report.progress=p;window.RcSimpleUI?.upgrade(report,report.package);}});
  record('transfer-sent',{bytes:selected.file.bytes.length});status('File sent. Checking the installed version…','verifying');const actual=await verify(selected.device,selected.file);
  if(actual&&selected.device.gatt.connected){const resumed=window.RcWebRemote?.resumeAfterUpgrade?.(selected.device,actual);record('connection-retained',{connected:selected.device.gatt.connected,uiResumed:!!resumed});}
  if(actual&&selected.file.version&&T.compare(actual.firmware,selected.file.version)===0&&T.compare(selected.file.version,selected.file.installed)!==0){report.actualFirmware=actual.firmware;status('Installation verified. Remote firmware: '+actual.firmware,'installed');}
  else status('File sent, but installation is NOT confirmed.'+(actual?' Remote reports '+actual.firmware+'. A same-version or unknown-version file cannot be verified by version alone.':' Wake the remote and press Connect to read its version.'),'installation-unconfirmed');
 }catch(error){status(error.message+(error.writesMayHaveStarted?' Transfer may be incomplete; reconnect and read the remote before retrying.':''),'error');}
 finally{record('transfer-finished',{connected:selected.device.gatt.connected,forcedDisconnect:false,state:report.state});running=false;prepared=null;$('webConfirm').checked=approved();window.RcWebRemote.lock(false);render();}
}
async function restoreFile(){const api=window.RcFirmwareStore;if(!api)return;const epoch=fileRevision;
 try{const saved=await api.load();if(!saved||saved.format!==1)return;const file=await T.prepare(saved.bytes,saved.options);if(file.sha256!==saved.sha256)throw Error('The saved BIN checksum changed.');if(fileRevision!==epoch||retained)return;retained=file;approval=saved.approval===key(file)?saved.approval:'';report.storage='restored';status('Saved BIN restored. Connect the next remote.','retained');render();await bindRetained();}
 catch(error){record('firmware-restore-error',{message:error.message});if(fileRevision===epoch&&!retained)store(api=>api.clear());}
}
$('webPrepareServer').onclick=()=>prepare('server');$('webPrepareLocal').onclick=()=>prepare('local');$('webFirmware').onchange=clearFile;$('webConfirm').onchange=confirm;$('webInstall').onclick=install;
window.addEventListener('rcota-metadata',event=>{if(running)return;const previous=report;invalidate();if(event?.detail?.model){if(retained)void bindRetained();}else if(['installed','installation-unconfirmed','error'].includes(previous.state)){report=previous;status(previous.message,previous.state);}});
for(const name of ['rcota-remote-forgotten','rcota-next-remote'])window.addEventListener(name,()=>{if(!running)invalidate();});
window.RcWebUpgrade={diagnostics:()=>({...report,package:summary(),profile:'telink-legacy',batchApproved:approved(),systemBondState:'Not observable in Web Bluetooth',postTransferDisconnect:'No automatic disconnect; a healthy link is retained'}),bindRetained,storageIdle:()=>storageQueue};render();void restoreFile();
})();
