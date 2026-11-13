(function(){
'use strict';
const $=id=>document.getElementById(id),T=window.RcTelink;
if(!$('webUpgrade')||!T)return;
let prepared=null,pendingCheck=null,retained=null,approval='',running=false,preparing=false,generation=0,fileRevision=0,verificationDeadline=0,report={state:'idle'},storageQueue=Promise.resolve(),serverEntry=null,serverInfoState=null,serverEpoch=0;
const context=()=>window.RcWebRemote?.context();
const key=file=>file?[file.sha256,file.model,file.filename,file.version,file.source].join('|'):'';
const proOverride=()=>window.RcSimpleUI?.isPro?.()===true&&$('proModelOverride').checked===true;
const approved=()=>!!retained&&!retained.modelOverride&&approval===key(retained);
const summary=()=>retained?{filename:retained.filename,model:retained.model,version:retained.version,source:retained.source,sha256:retained.sha256,batchApproved:approved(),modelOverride:!!retained.modelOverride,fileModel:retained.fileModel||''}:null;
function record(type,details={}){report.events=report.events||[];report.events.push({time:new Date().toISOString(),type,...details});if(report.events.length>60)report.events.shift();window.RcWebRemote?.logEvent?.('OTA '+type+': '+JSON.stringify(details));}
function status(message,state='idle'){report={...report,state,message,package:summary()};$('webUpgradeStatus').textContent=message;window.RcSimpleUI?.upgrade(report,report.package);}
function render(){const c=context(),ready=!!c?.connected&&!c.native&&!!c.metadata.model;
 $('webSolarDownload').hidden=true;
 $('webPrepareLocal').disabled=running||preparing||!ready;
 $('webPrepareServer').disabled=running||preparing;
 $('serverLookup').disabled=running||preparing;
 $('serverReadInfo').disabled=running||preparing;
 $('serverModel').disabled=running||preparing;
 $('webDownloadServer').disabled=running||preparing||!serverEntry;
 if(serverInfoState)window.RcSimpleUI?.serverInfo?.({...serverInfoState,canLoad:!!serverEntry&&!running&&!preparing,busy:running||preparing});
 $('webFirmware').disabled=running||preparing;
 $('webChooseFile').disabled=running||preparing;
 $('proModelOverride').disabled=running||preparing;
 if(approved())$('webConfirm').checked=true;
 $('webConfirm').disabled=running||preparing||!prepared;
 $('webInstall').disabled=running||preparing||!prepared||!ready||(!approved()&&!$('webConfirm').checked)||(prepared?.file.modelOverride&&!proOverride());
 $('webReview').hidden=!prepared||approved();report.package=summary();window.RcSimpleUI?.upgrade(report,report.package);
}
function store(action){const api=window.RcFirmwareStore;if(!api){report.storage='session-only';return;}
 storageQueue=storageQueue.then(()=>action(api)).catch(error=>{report.storage='session-only';record('firmware-storage-error',{message:error.message});});
}
function save(){if(!retained)return;if(retained.modelOverride){report.storage='session-only-pro';return;}const value={format:1,bytes:new Uint8Array(retained.bytes),sha256:retained.sha256,approval,options:{model:retained.model,filename:retained.filename,version:retained.version,source:retained.source,installed:retained.installed,md5:retained.md5,catalogueModel:retained.catalogueModel}};
 store(async api=>{report.storage=await api.save(value)?'saved-locally':'session-only';});
}
function invalidate(){generation++;prepared=null;if(!running){$('webProgress').hidden=true;$('webProgress').value=0;}
 $('webConfirm').checked=approved();if(!running)status(retained?'BIN retained. Connect the next remote of the same model.':'Connect and read your remote, then choose firmware.',retained?'retained':'idle');render();
}
function clearFile(){report.chosenFilename=$('webFirmware').files[0]?.name||'';pendingCheck=null;fileRevision++;retained=null;approval='';store(api=>api.clear());invalidate();}
function confirm(){if(prepared&&$('webConfirm').checked){approval=retained.modelOverride?'':key(retained);save();record(retained.modelOverride?'engineering-file-selected':'batch-file-approved',{model:retained.model,sha256:retained.sha256});}else if(!$('webConfirm').checked){approval='';save();}render();}
async function bounded(operation,device,ms=15000){if(verificationDeadline){const left=verificationDeadline-Date.now();if(left<=0)throw Error('Post-transfer verification time limit reached.');ms=Math.min(ms,left);}let timer;try{return await Promise.race([operation(),new Promise((_,reject)=>{timer=setTimeout(()=>{record('gatt-timeout',{duringVerification:!!verificationDeadline});device?.gatt.disconnect();reject(Error('Bluetooth operation timed out. Reconnect and prepare the file again.'));},ms)})])}finally{clearTimeout(timer)}}
async function live(device){if(!device.gatt.connected)throw Error('Remote disconnected. Connect and read it again.');const service=await bounded(()=>device.gatt.getPrimaryService('device_information'),device);async function text(name){const c=await bounded(()=>service.getCharacteristic(name),device);return new TextDecoder().decode(await bounded(()=>c.readValue(),device)).replace(/\0/g,'').trim()}
 const model=await text('model_number_string'),firmware=await text('firmware_revision_string'),battery=await bounded(()=>device.gatt.getPrimaryService('battery_service'),device),level=await bounded(()=>battery.getCharacteristic('battery_level'),device),value=await bounded(()=>level.readValue(),device);return {name:device.name,model,firmware,level:value.byteLength?value.getUint8(0):NaN};}
async function ota(device){const s=await bounded(()=>device.gatt.getPrimaryService(T.SERVICE),device),c=await bounded(()=>s.getCharacteristic(T.CHARACTERISTIC),device);if(!c.properties.read||!c.properties.writeWithoutResponse||typeof c.writeValueWithoutResponse!=='function')throw Error('Compatible Telink Legacy OTA characteristic is unavailable.');return {properties:c.properties,writeValueWithoutResponse:bytes=>bounded(()=>c.writeValueWithoutResponse(bytes),device),readValue:()=>bounded(()=>c.readValue(),device)};}
async function download(url,max,binary=false){const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),30000);try{const r=await fetch(url,{signal:abort.signal,redirect:'error',credentials:'omit',cache:'no-store'});if(!r.ok)throw Error('Server returned HTTP '+r.status);if(binary&&/text\/html/i.test(r.headers.get('content-type')||''))throw Error('Server returned HTML instead of firmware metadata/binary.');const reader=r.body.getReader(),chunks=[];let size=0;try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max)throw Error('Server response is too large.');chunks.push(value)}}catch(e){await reader.cancel().catch(()=>{});throw e}const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length}return bytes;}finally{clearTimeout(timer)}}
async function inspectRemote(c){const identity=await live(c.device);T.identity(identity,{model:c.metadata.model,firmware:c.metadata.firmware});return identity;}
function showPrepared(file,device){delete report.expectedModel;delete report.detectedModel;prepared={file,device};$('webPackage').textContent=[file.filename,'Model: '+file.model,'Installed: '+file.installed,'Target: '+(file.version||'not specified'),'SHA-256: '+file.sha256].join('\n');$('webConfirm').checked=approved();status('Firmware ready for this remote. No firmware has been written.','ready');}
async function bindRetained(){const c=context();if(!retained||running||preparing||!c?.connected||c.native)return;const cached=retained,id=generation;preparing=true;window.RcWebRemote.lock(true);status('Checking the retained BIN for this remote…','preparing');render();
 try{const rebind=proOverride();if(c.metadata.model!==cached.model&&!rebind){report.expectedModel=cached.model;report.detectedModel=c.metadata.model;const error=Error('Saved BIN: '+cached.model+'; connected remote: '+c.metadata.model+'. Choose firmware for the connected model.');error.modelMismatch=true;throw error;}if(cached.modelOverride&&!proOverride())throw Error('Enable the model override in Pro to use this engineering BIN.');const identity=await inspectRemote(c);await ota(c.device);
  const file=await T.prepare(cached.bytes,{...cached,model:identity.model,installed:identity.firmware,allowModelMismatch:rebind});if(id!==generation||cached!==retained||!c.device.gatt.connected)throw Error('Connection changed. Read the remote again.');
  if(file.model!==cached.model||file.modelOverride){retained=file;approval='';save();}showPrepared(file,c.device);record('retained-file-bound',{model:file.model,installed:file.installed,approved:approved()});
 }catch(error){prepared=null;status(error.message,error.modelMismatch?'model-mismatch':'error');}finally{preparing=false;window.RcWebRemote.lock(false);render();}
}
function catalogueBase(model){if(!/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(model))throw Error('Enter the exact server catalogue model.');return 'https://'+RcOta.HOST+'/'+encodeURIComponent(model)+'/';}
function showServer(value){serverInfoState=value;window.RcSimpleUI?.serverInfo?.(value);}
function parseServerInfo(raw,model,metadataUrl){
 const base=catalogueBase(model),info=RcOta.info(raw);
 if(!/^[A-Za-z0-9][A-Za-z0-9_.-]*\.bin$/i.test(info.name)||info.name.includes('..'))throw Error('The server metadata contains an invalid BIN filename.');
 return {model,metadataUrl,firmwareUrl:base+encodeURIComponent(info.name),info,raw};
}
async function readIndexedMetadata(indexText,model,indexUrl,epoch,imported=false){
 const base=catalogueBase(model),links=RcOta.manifest(indexText,base);
 const actualModel=decodeURIComponent(new URL(links.firmwareUrl).pathname.split('/')[1]||'');
 catalogueBase(actualModel);
 if(!new URL(links.metadataUrl).pathname.startsWith('/'+actualModel+'/'))throw Error('The index BIN and TXT must belong to the same catalogue.');
 const filename=decodeURIComponent(new URL(links.firmwareUrl).pathname.split('/').pop());
 if(!/^[A-Za-z0-9][A-Za-z0-9_.-]*\.bin$/i.test(filename)||filename.includes('..'))throw Error('Invalid BIN filename in the server index.');
 if(epoch!==serverEpoch)return;
 showServer({model:actualModel,indexUrl,indexText,indexImported:imported,url:links.metadataUrl,filename,binaryUrl:links.firmwareUrl,status:'otaLoading'});
 // The direct BIN link is usable as soon as the index is parsed, even if TXT fetch fails.
 await readMetadata(links.metadataUrl,actualModel,epoch,links.firmwareUrl);
 record('server-info-loaded',{model:actualModel,indexUrl,filename,metadataUrl:links.metadataUrl,indexImported:imported});
}
async function readMetadata(url,model,epoch,expectedBinary){
 showServer({...serverInfoState,model,url,text:'',error:'',directView:false,status:'otaLoading'});
 record('server-info-request',{url});
 let raw;try{raw=new TextDecoder().decode(await download(url,65536));}
 catch(error){if(error instanceof TypeError&&epoch===serverEpoch)showServer({...serverInfoState,directView:true});throw error;}
 if(epoch!==serverEpoch)return;
 // Keep the received TXT visible even if metadata validation fails afterwards.
 showServer({...serverInfoState,text:raw,status:'otaInvalid'});
 const entry=parseServerInfo(raw,model,url);
 if(expectedBinary&&entry.firmwareUrl!==expectedBinary)throw Error('The index BIN URL does not match OTA Info TXT.');
 serverEntry=entry;
 showServer({...serverInfoState,text:raw,filename:entry.info.name,binaryUrl:entry.firmwareUrl,version:entry.info.version,status:'otaReady'});
 status('OTA Info TXT loaded. Review it, then load or save the BIN.','server-info');
}
async function readInfoOnly(){
 if(running||preparing)return;
 const model=$('serverModel').value.trim()||context()?.metadata?.model||'';
 let base;try{base=catalogueBase(model);}catch(error){showServer({model,status:'otaEnterModel',error:error.message});return;}
 const previous=serverInfoState?.model===model?serverInfoState:null;
 const url=previous?.url||base+'ota_info.txt',epoch=++serverEpoch;
 serverEntry=null;clearFile();report.chosenFilename='';$('webFirmware').value='';preparing=true;showServer({...previous,model,url,status:'otaLoading'});render();
 try{await readMetadata(url,model,epoch,previous?.binaryUrl);}
 catch(error){showServer({...serverInfoState,status:'otaBlocked',error:error.message});record('server-info-error',{url,message:error.message});status('Could not read OTA Info TXT: '+error.message,'server-info-error');}
 finally{preparing=false;render();}
}
async function readServer(){
 if(running||preparing)return;
 const model=$('serverModel').value.trim()||context()?.metadata?.model||'';
 const epoch=++serverEpoch;serverEntry=null;clearFile();report.chosenFilename='';$('webFirmware').value='';
 if(!model){showServer({model:'',status:'otaEnterModel'});render();return;}
 let base;try{base=catalogueBase(model);}catch(error){showServer({model,status:'otaEnterModel',error:error.message});render();return;}
 preparing=true;showServer({model,indexUrl:base,status:'otaIndexLoading'});status('Loading the server index…','server-loading');render();
 try{
  let indexText,indexUrl=base;
  try{indexText=new TextDecoder().decode(await download(indexUrl,65536));}
  catch(error){
   if(/HTTP 403|HTTP 404/.test(error.message)){
    try{indexUrl=base+'index.html';indexText=new TextDecoder().decode(await download(indexUrl,65536));}
    catch(fallback){record('server-index-error',{url:indexUrl,message:fallback.message});}
   }else record('server-index-error',{url:indexUrl,message:error.message});
  }
  if(indexText===undefined){
   // Restore the pre-index reader when the listing cannot be fetched.
   // A directory error must not prevent reading the conventional TXT endpoint.
   await readMetadata(base+'ota_info.txt',model,epoch);return;
  }
  await readIndexedMetadata(indexText,model,indexUrl,epoch);
 }catch(error){if(epoch===serverEpoch){serverEntry=null;showServer({...serverInfoState,status:/HTTP 404/.test(error.message)?'otaNotFound':'otaBlocked',error:error.message});status('Could not read the server index or OTA Info TXT: '+error.message,'server-info-error');}}
 finally{preparing=false;render();}
}
async function importServerIndex(indexText){
 if(running||preparing)return;
 const epoch=++serverEpoch;serverEntry=null;clearFile();report.chosenFilename='';
 const links=RcOta.manifest(indexText),model=decodeURIComponent(new URL(links.firmwareUrl).pathname.split('/')[1]||'');
 const base=catalogueBase(model);preparing=true;
 try{await readIndexedMetadata(indexText,model,base,epoch,true);}
 catch(error){serverEntry=null;showServer({...serverInfoState,status:'otaBlocked',error:error.message});status('Index opened; automatic TXT reading failed. The direct links remain available.','server-info-error');}
 finally{preparing=false;render();}
}
function importServerInfo(raw){
 if(running||preparing)return;
 const model=$('serverModel').value.trim(),base=catalogueBase(model),previous=serverInfoState;
 serverEpoch++;serverEntry=null;
 showServer({...previous,model,text:raw,status:'otaInvalid'});
 const entry=parseServerInfo(raw,model,previous?.url||base+'ota_info.txt');
 if(previous?.binaryUrl&&previous.binaryUrl!==entry.firmwareUrl)throw Error('The imported TXT does not match the BIN link in the index.');
 serverEntry=entry;showServer({...previous,model,url:entry.metadataUrl,text:raw,status:'otaLocal',filename:entry.info.name,version:entry.info.version,binaryUrl:entry.firmwareUrl});render();
}

async function prepare(source){
 if(source==='server')return readServer();
 if(running||preparing)return;const c=context();if(!c?.connected||c.native)return;
 clearFile();const id=generation;preparing=true;render();window.RcWebRemote.lock(true);status('Reading the remote and checking firmware…','preparing');
 try{const identity=await inspectRemote(c);await ota(c.device);const input=$('webFirmware').files[0];if(!input)throw Error('Choose a local BIN first.');if(input.size>T.MAX)throw Error('The firmware file is too large.');
  const file=await T.prepare(await input.arrayBuffer(),{source:'local',model:identity.model,installed:identity.firmware,filename:input.name,allowModelMismatch:proOverride()});
  if(id!==generation||!c.device.gatt.connected)throw Error('Connection changed. Prepare the firmware again.');retained=file;approval='';save();showPrepared(file,c.device);
 }catch(error){prepared=null;status(error.message,'error');}finally{preparing=false;window.RcWebRemote.lock(false);render();}
}
async function loadServerBin(){
 if(running||preparing||!serverEntry)return;
 const entry=serverEntry,c=context();clearFile();report.chosenFilename=entry.info.name;
 const id=generation;preparing=true;render();window.RcWebRemote?.lock(true);status('Downloading the BIN from the server…','server-downloading');
 try{
  if(entry.info.mac)throw Error('This update has a MAC restriction that Web Bluetooth cannot verify.');
  const bytes=await download(entry.firmwareUrl,T.MAX,true);
  if(T.md5(bytes)!==entry.info.md5sum.toLowerCase())throw Error('The downloaded firmware does not match the server MD5.');
  if(id!==generation||serverEntry!==entry)throw Error('The selected server package changed. Read OTA Info TXT again.');
  if(!c?.connected||c.native)throw Error('BIN downloaded and checksum checked. Connect and read the remote, then load the BIN for updating. You can also save it to your phone.');
  const identity=await inspectRemote(c);await ota(c.device);
  const file=await T.prepare(bytes,{source:'server',model:identity.model,installed:identity.firmware,catalogueModel:entry.model,allowModelMismatch:proOverride(),filename:entry.info.name,version:entry.info.version,md5:entry.info.md5sum});
  if(id!==generation||!c.device.gatt.connected)throw Error('Connection changed. Load the BIN again.');
  retained=file;approval='';save();showPrepared(file,c.device);record('server-bin-loaded',{model:entry.model,filename:entry.info.name,bytes:bytes.length});
 }catch(error){
  if(error instanceof TypeError){showServer({...serverInfoState,status:'otaBinBlocked',error:error.message});status('The browser could not read the BIN (network/CORS). Use the displayed Save BIN to phone link.','server-download-error');}
  else status(error.message,'error');
 }finally{preparing=false;window.RcWebRemote?.lock(false);render();}
}

async function verify(device,file){
 // One read on an existing connection. Never reconnect or retry automatically after OTA.
 verificationDeadline=Date.now()+15000;report.verificationStrategy='one-read-no-reconnect';
 try{await new Promise(resolve=>setTimeout(resolve,3000));if(!device.gatt.connected){record('manual-reconnect-required',{model:file.model});return null;}
  const actual=await live(device);record('live-readback',{automaticRead:true,model:actual.model,firmware:actual.firmware,battery:actual.level});
  if(!readbackModelMatches(file,actual))throw Error('Remote model changed.');return actual;
 }catch(error){record('readback-error',{name:error.name,message:error.message});return null;}
 finally{verificationDeadline=0;}
}
function readbackModelMatches(file,actual){return actual&&(actual.model===file.model||file.modelOverride&&file.fileModel&&actual.model===file.fileModel);}
function applyReadback(actual){
 if(!pendingCheck)return false;report.actualFirmware=actual?.firmware||'';
 const expected=pendingCheck;
 if(readbackModelMatches(expected,actual)&&expected.version&&T.compare(actual.firmware,expected.version)===0&&T.compare(expected.version,expected.installed)!==0){pendingCheck=null;status('Installation verified. Remote firmware: '+actual.firmware,'installed');return true;}
 if(readbackModelMatches(expected,actual)&&(!expected.version||T.compare(expected.version,expected.installed)===0)){pendingCheck=null;status('Transfer sent. Remote reports '+actual.firmware+'. A same-version or unknown-version file cannot be verified by version alone.','installation-unconfirmed');return true;}
 window.RcWebRemote?.requireSelection?.('post-upgrade');status('Transfer sent. Wake/pair the remote with Back + Home for 3 seconds, then press Connect and read the installed version.','awaiting-reconnect');return false;
}
async function install(){if(running||preparing||!prepared||(!approved()&&!$('webConfirm').checked))return;const selected=prepared,c=context();if(!c?.connected||c.device!==selected.device){invalidate();return;}
 if(selected.file.modelOverride){
  if(!proOverride())return;
  const accepted=await window.RcSimpleUI?.confirmModelOverride?.(selected.file,c.metadata.model);
  const latest=context();
  if(!accepted||!proOverride()||prepared!==selected||!latest?.connected||latest.device!==selected.device)return;
  record('model-override-confirmed',{model:selected.file.model,fileModel:selected.file.fileModel,filename:selected.file.filename,sha256:selected.file.sha256});
 }
 if(!approved())confirm();report.actualFirmware='';running=true;window.RcWebRemote.lock(true);render();$('webProgress').hidden=false;status('Installing. Keep this page open and the remote nearby.','transferring');
 try{record('transfer-start',{model:selected.file.model,installed:selected.file.installed,target:selected.file.version,modelOverride:!!selected.file.modelOverride,fileModel:selected.file.fileModel});await T.transfer(selected.file,{readIdentity:()=>live(selected.device),characteristic:()=>ota(selected.device),progress:p=>{$('webProgress').value=p;report.progress=p;window.RcSimpleUI?.upgrade(report,report.package);}});
  record('transfer-sent',{bytes:selected.file.bytes.length});pendingCheck={device:selected.device,model:selected.file.model,version:selected.file.version,installed:selected.file.installed,modelOverride:!!selected.file.modelOverride,fileModel:selected.file.fileModel};status('File sent. Reading the version once if the connection stays open…','verifying');const actual=await verify(selected.device,selected.file);
  if(actual&&selected.device.gatt.connected){const resumed=window.RcWebRemote?.resumeAfterUpgrade?.(selected.device,actual,selected.file.modelOverride?{expectedModel:selected.file.model,renamedModel:selected.file.fileModel}:undefined);record('connection-retained',{connected:selected.device.gatt.connected,uiResumed:!!resumed});}
  applyReadback(actual);
 }catch(error){status(error.message+(error.writesMayHaveStarted?' Transfer may be incomplete; reconnect and read the remote before retrying.':''),'error');}
 finally{record('transfer-finished',{connected:selected.device.gatt.connected,forcedDisconnect:false,state:report.state});running=false;prepared=null;$('webConfirm').checked=approved();window.RcWebRemote.lock(false);render();}
}
async function restoreFile(){const api=window.RcFirmwareStore;if(!api)return;const epoch=fileRevision;
 try{const saved=await api.load();if(!saved||saved.format!==1||saved.options?.allowModelMismatch)return;const file=await T.prepare(saved.bytes,saved.options);if(file.sha256!==saved.sha256)throw Error('The saved BIN checksum changed.');if(fileRevision!==epoch||retained)return;retained=file;approval=saved.approval===key(file)?saved.approval:'';report.storage='restored';status('Saved BIN restored. Connect the next remote.','retained');render();await bindRetained();}
 catch(error){record('firmware-restore-error',{message:error.message});if(fileRevision===epoch&&!retained)store(api=>api.clear());}
}
$('webPrepareServer').onclick=readServer;$('serverLookup').onclick=readServer;$('serverReadInfo').onclick=readInfoOnly;$('webDownloadServer').onclick=loadServerBin;$('serverModel').oninput=()=>{serverEpoch++;serverEntry=null;showServer({model:$('serverModel').value,status:'otaEnterModel'});render();};$('webPrepareLocal').onclick=()=>prepare('local');$('webFirmware').onchange=clearFile;$('webConfirm').onchange=confirm;$('webInstall').onclick=install;
window.addEventListener('rcota-metadata',event=>{if(running)return;const previous=report,c=context(),values=event?.detail;invalidate();
 if(values?.model){const same=pendingCheck&&(c?.device===pendingCheck.device||(c?.device?.id&&c.device.id===pendingCheck.device?.id));if(same){record('manual-readback',{model:values.model,firmware:values.firmware});applyReadback(values);render();return;}if(retained)void bindRetained();else if($('webFirmware').files[0])void prepare('local');}
 else if(['installed','installation-unconfirmed','awaiting-reconnect','model-mismatch','error'].includes(previous.state)){report=previous;status(previous.message,previous.state);}});
for(const name of ['rcota-remote-forgotten','rcota-next-remote'])window.addEventListener(name,()=>{if(!running){serverEpoch++;serverEntry=null;showServer(null);pendingCheck=null;invalidate();}});
window.RcWebUpgrade={importServerInfo,importServerIndex,selectLocalFile(){if(running||preparing)return;clearFile();if(context()?.connected) return prepare('local');status('BIN selected. Connect and read the remote to prepare it.','local-selected');},modeChanged(){if(running||preparing)return;if(retained?.modelOverride&&!proOverride()){clearFile();}if($('webFirmware').files[0])void prepare('local');},diagnostics:()=>({...report,server:serverInfoState,package:summary(),profile:'telink-legacy',batchApproved:approved(),systemBondState:'Not observable in Web Bluetooth',postTransferDisconnect:'No automatic disconnect; a healthy link is retained'}),bindRetained,storageIdle:()=>storageQueue};render();void restoreFile();
})();
