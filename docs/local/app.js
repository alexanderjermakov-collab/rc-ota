'use strict';
const $=id=>document.getElementById(id);
let token='',latest=null,timer=null,polling=false,online=false,commandBusy=false,optionKey='',confirmationKey='',modelEdited=false,lastModel='';
let localFileReady=false,localFileHash='',localFileRevision=0,localPreparing=false;
function localTargetVersion(){return $('localVersion').value.trim()||($('file').files[0]?.name.match(/_[vV](\d+(?:\.\d+)*)\.bin$/i)?.[1]||'')}
try{const fragment=new URLSearchParams(location.hash.slice(1));token=fragment.get('token')||sessionStorage.getItem('rcota-local-token')||'';if(fragment.has('token')){sessionStorage.setItem('rcota-local-token',token);history.replaceState(null,'',location.pathname+location.search)}}catch{showError('Session storage is unavailable. Allow site storage, then open this page from RC OTA again.');}
function showError(message){$('bridgeError').textContent=message;$('bridgeError').hidden=!message;}
async function api(path,value){
 if(!token)throw new Error('Open RC OTA using its launcher to authorize this tab.');
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),7000);
 try{const options={method:value===undefined?'GET':'POST',headers:{Authorization:'Bearer '+token},cache:'no-store',credentials:'omit',redirect:'error',signal:controller.signal};if(value!==undefined){options.headers['Content-Type']='application/json';options.body=JSON.stringify(value)}
 const response=await fetch(path,options),body=await response.json();if(!response.ok)throw new Error(body.error||'Bridge returned HTTP '+response.status);return body;
 }finally{clearTimeout(timeout)}
}
function buttons(){const s=latest||{},connecting=['connecting','discovering','reading'].includes(s.stage);$('connect').disabled=!online||commandBusy||!s.connectPermission||!s.bluetoothEnabled||!$('remote').value||connecting||!!s.workerBusy;$('disconnect').disabled=!online||commandBusy||(!s.gattConnected&&!connecting&&!s.autoRead);$('checkOta').disabled=!online||commandBusy||s.ota?.state==='checking';$('export').disabled=!latest;$('refresh').disabled=polling||commandBusy;$('firmwareUpgrade').disabled=!online||commandBusy||s.platform!=='Windows'||!s.verified||s.dataStale||!s.metadata?.model||$('remote').value!==s.selectedAddress||!!s.workerBusy||s.upgrade?.state==='checking';
 const upgrade=s.upgrade||{};
 const localSelected=upgrade.package?.source==='local'&&!!$('file').files[0];
 const localChanged=localSelected&&(!localFileReady||localFileHash!==upgrade.package.sha256||localTargetVersion().replace(/^[vV]/,'')!==(upgrade.package.version||'').replace(/^[vV]/,''));
 $('firmwareInstall').disabled=!online||commandBusy||!upgrade.transferAvailable||!$('confirmInstall').checked||s.workerBusy||!s.verified||s.dataStale||$('remote').value!==s.selectedAddress||localChanged;
 $('prepareLocal').disabled=!online||commandBusy||localPreparing||!localFileReady||s.platform!=='Windows'||!s.verified||s.dataStale||!!s.workerBusy||s.upgrade?.state==='checking'||$('remote').value!==s.selectedAddress;
 $('localVersion').disabled=!!s.transferBusy||localPreparing;
 $('file').disabled=!!s.transferBusy||localPreparing;
 if(s.transferBusy){$('refresh').disabled=true;$('checkOta').disabled=true;const stop=document.getElementById('stopBridge');if(stop)stop.disabled=true;}
 else {const stop=document.getElementById('stopBridge');if(stop)stop.disabled=false;}
}
function render(s){
 latest=s;const metadata=s.metadata||{},ota=s.ota||{};
 $('transport').textContent=s.transport;$('status').textContent=s.message;
 const platform=s.platform||'Android';
 if(platform==='Windows'){
  $('intro').textContent='Read your paired SHARP remote through Windows. Upgrade Firmware checks the package first; installation requires your separate confirmation.';
  $('otaNotice').textContent='Experimental Windows OTA. A verified newer package and a supported remote are required before Install on remote becomes available.';
 }
 $('upgradePanel').hidden=platform!=='Windows';
 $('localInstallControls').hidden=platform!=='Windows';
 $('chooseLocalFirmware').hidden=platform!=='Windows';
 const upgrade=s.upgrade||{},packageInfo=upgrade.package;
 const localSource=packageInfo?.source==='local';
 const packageKey=[packageInfo?.sha256||'',upgrade.address||'',packageInfo?.source||'server',packageInfo?.version||''].join('|');
 if(packageKey!==confirmationKey){confirmationKey=packageKey;$('confirmInstall').checked=false;}
 $('upgradeStatus').textContent=upgrade.message||'Select Upgrade Firmware in the OTA server panel to download and verify the package.';
 const badgeLabels={'checking':'Checking package','package-verified':upgrade.transferAvailable?'Ready for review':'Package checked',starting:'Starting transfer',transferring:'Transferring', 'transfer-sent':'Checking installation','verifying-installation':'Checking installation',installed:'Installation verified','transfer-complete':'Transfer completed · version read','installation-unconfirmed':'Not confirmed',error:'Check failed',cancelled:'Cancelled'};
 $('upgradeBadge').textContent=badgeLabels[upgrade.state]||'Package check';
 $('installReview').hidden=!upgrade.transferAvailable;
 $('upgradeProgress').hidden=!s.transferBusy&&!['installed','transfer-complete'].includes(upgrade.state);
 $('upgradeProgress').value=upgrade.progress||0;
 $('upgradeDetails').textContent=packageInfo?['Model: '+packageInfo.model,'Installed before transfer: '+(upgrade.installed||metadata.firmware||'Unknown'),'Target version: '+(packageInfo.version||'Not supplied'),'File: '+packageInfo.filename,'Size: '+packageInfo.bytes+' bytes','MD5: '+packageInfo.md5+(localSource?' · computed locally':' · verified against server'),'SHA-256: '+packageInfo.sha256+(localSource?' · local upload verified':''),'Source: '+(localSource?'Local file on this PC':packageInfo.url),...(localSource?['Version policy: upgrade, downgrade and same-version installation allowed.']:[]),...(upgrade.probe?.characteristic?['OTA service verified: '+upgrade.probe.service,'OTA characteristic: '+upgrade.probe.characteristic]:[])].join('\n'):'';
 $('installConsentText').textContent=localSource?'I confirm this local BIN is compatible with the selected remote and want to install it, including a downgrade if selected.':'I want to install this verified server package on the selected remote.';
 $('platformIntro').textContent=platform==='Windows'?'HTML in Chrome · native Windows Bluetooth':'HTML in Chrome · native Android Bluetooth';
 if(platform==='Windows')$('connect').textContent=s.readAt?'Read again':'Read remote';
 const labels={idle:'No paired remote',paired:'Paired in Android',connecting:'Connecting…',discovering:'GATT connected',reading:'Reading live data…',verified:'GATT data verified','gatt-connected':'GATT connected · data unverified',disconnected:platform==='Windows'?'Automatic reads stopped':'Disconnected',error:'Connection error'};
 $('connection').textContent=platform==='Windows'&&s.stage==='verified'?'Parameters read successfully':(labels[s.stage]||s.stage).replace('Android',platform);
 const devices=s.devices||[],key=JSON.stringify(devices);
 if(key!==optionKey){const previous=$('remote').value;optionKey=key;$('remote').replaceChildren();if(!devices.length){const empty=document.createElement('option');empty.value='';empty.textContent='No paired SHARP remotes found';$('remote').append(empty)}else{const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Choose a paired remote';$('remote').append(placeholder);for(const d of devices){const option=document.createElement('option');option.value=d.address;option.textContent=d.name+' · '+d.address;$('remote').append(option)}$('remote').value=devices.some(d=>d.address===previous)?previous:devices.some(d=>d.address===s.selectedAddress)?s.selectedAddress:devices.length===1?devices[0].address:''}}
 $('paired').textContent='Pairing: '+(s.bondState==='bonded'?'paired in '+platform:devices.length?'paired remotes available':'not confirmed');$('gatt').textContent='GATT: '+(s.gattConnected?'connected':s.platform==='Windows'?'read session closed':'disconnected');$('verified').textContent=(platform==='Windows'?'Read result: ':'Live data: ')+(s.verified?'verified':'unverified');
 $('permissions').textContent=(platform==='Windows'?'Windows Bluetooth access: ':'Nearby devices: ')+(s.connectPermission?'allowed':'permission required')+' · Bluetooth: '+(s.bluetoothEnabled?'on':s.bluetoothAvailable?'off':'unavailable');
 $('readTime').textContent=s.readAt?(s.dataStale?'Last read data · ':'Verified read · ')+new Date(s.readAt).toLocaleString()+(s.staleFields?.length?' · Earlier values retained: '+s.staleFields.join(', '):''):'No remote data has been read.';
 for(const name of ['name','model','firmware','software','hardware','manufacturer','address'])$(name).textContent=metadata[name]||'—';$('level').textContent=Number.isFinite(metadata.level)?metadata.level+'%':'—';
 if(metadata.model&&metadata.model!==lastModel){lastModel=metadata.model;modelEdited=false;$('otaModel').value=metadata.model}
 $('otaCurrent').textContent=metadata.firmware||metadata.software||'Unknown';
 const matches=!modelEdited||$('otaModel').value.trim()===ota.model;
 $('otaStatus').textContent=!matches?'Model changed. Select Check server.':ota.state==='checking'?'Checking manufacturer OTA server…':ota.state==='complete'?'Server check complete for '+ota.model+'. No firmware was installed.':ota.state==='error'?ota.error:ota.state==='cancelled'?'Server check cancelled after disconnection. Select Check server to retry.':'The server check starts after the remote model is read.';
 const value=matches&&ota.state==='complete'?ota.value:null;
 $('otaVersion').textContent=value?.version||'Unknown';$('otaBinary').textContent=value?value.binaryAvailable===true?'Available on server':value.binaryAvailable===false?'Unavailable':'Could not verify':'Not checked';
 $('otaComparison').textContent=value?(ota.model===metadata.model?RcOta.comparison(metadata.firmware||metadata.software||'',value.version):'Different model · not compared'):'Not checked';
 $('otaDetails').textContent=value?['Model: '+ota.model,'Firmware: '+value.name,'Metadata: '+value.metadataUrl,'Binary: '+value.firmwareUrl,'File check: '+value.binaryStatus,'Server MD5 (file contents not verified): '+value.md5sum,'Scenario: '+(value.scenario||'Not specified'),'MAC restriction: '+(value.mac||'Not specified'),'Checked: '+new Date(ota.checkedAt).toLocaleString()].join('\n'):'No server metadata loaded for this model.';
 $('services').textContent=s.services?.length?s.services.map(service=>service.uuid+'\n'+service.characteristics.map(c=>'  '+c.uuid+' · properties '+c.properties).join('\n')).join('\n\n'):'No GATT services discovered.';
 $('log').textContent=(s.trace||[]).map(entry=>new Date(entry.timeMillis).toLocaleTimeString()+'  '+entry.message).join('\n')||'Ready.';buttons();
}
function unavailable(error){online=false;$('transport').textContent='Local bridge unavailable';$('connection').textContent='Bridge unavailable';showError(error.name==='AbortError'?'Bridge response timed out. Open RC OTA and check that the bridge is running.':error.message||'Cannot reach the local bridge. Open RC OTA and select Open in Chrome.');if(latest?.readAt)$('readTime').textContent='Last read data · '+new Date(latest.readAt).toLocaleString();buttons();}
async function poll(){
 clearTimeout(timer);if(document.hidden||polling)return;polling=true;buttons();
 try{const s=await api('/api/state');online=true;showError('');render(s)}catch(error){unavailable(error)}finally{polling=false;buttons();if(!document.hidden)timer=setTimeout(poll,1000)}
}
async function command(path,value){if(commandBusy)return;commandBusy=true;buttons();try{const s=await api(path,value);online=true;showError('');render(s)}catch(error){showError(error.name==='AbortError'?'Command timed out. Refresh to check bridge status.':error.message)}finally{commandBusy=false;buttons();}}
function diagnostics(){return {...latest,exportedAt:new Date().toISOString(),browser:{userAgent:navigator.userAgent,secureContext:isSecureContext},connectionMeaning:'Android bond, GATT link and verified live data are reported separately. Last read data can remain after disconnection.'};}
function download(text,name,type){const blob=new Blob([text],{type}),a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function inspectLocalFile(){
 const revision=++localFileRevision,file=$('file').files[0];localFileReady=false;localFileHash='';$('confirmInstall').checked=false;buttons();
 if(!file){$('fileInfo').textContent='No file selected.';return}
 const windows=latest?.platform==='Windows';
 if(windows&&(!/\.bin$/i.test(file.name)||file.size<16||file.size>1048576)){$('fileInfo').textContent='Choose a BIN file between 16 bytes and 1 MiB for local installation.';return}
 if(file.size>16*1024*1024){$('fileInfo').textContent='Choose a firmware file smaller than 16 MiB.';return}
 try{
  const bytes=await file.arrayBuffer(),hash=await crypto.subtle.digest('SHA-256',bytes);
  if(revision!==localFileRevision)return;
  localFileHash=Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');localFileReady=true;
  $('fileInfo').textContent=file.name+'\n'+file.size.toLocaleString()+' bytes\nSHA-256: '+localFileHash+'\nInspected on this PC. Nothing has been written to the remote.';
  $('localVersion').value=file.name.match(/_[vV](\d+(?:\.\d+)*)\.bin$/i)?.[1]||'';
 }catch(error){if(revision===localFileRevision)$('fileInfo').textContent='Could not inspect file: '+error.message}
 finally{buttons()}
}
async function prepareLocalFile(){
 if(localPreparing||!localFileReady)return;
 const file=$('file').files[0],revision=localFileRevision,hash=localFileHash;if(!file)return;
 localPreparing=true;$('confirmInstall').checked=false;buttons();
 try{
  const bytes=new Uint8Array(await file.arrayBuffer());if(revision!==localFileRevision)return;
  let binary='';for(let offset=0;offset<bytes.length;offset+=32768)binary+=String.fromCharCode(...bytes.subarray(offset,offset+32768));
  await command('/api/upgrade/local',{filename:file.name,content:btoa(binary),sha256:hash,version:$('localVersion').value.trim()});
  $('upgradePanel').scrollIntoView?.({behavior:'smooth',block:'start'});
 }catch(error){showError(error.message)}finally{localPreparing=false;buttons()}
}
function start(){
 $('remote').onchange=buttons;$('connect').onclick=()=>command('/api/connect',{address:$('remote').value});$('disconnect').onclick=()=>command('/api/disconnect',{});$('refresh').onclick=()=>latest?.platform==='Windows'?command('/api/refresh',{}):poll();
 $('firmwareUpgrade').onclick=()=>{$('confirmInstall').checked=false;const result=command('/api/upgrade/prepare',{});$('upgradePanel').scrollIntoView?.({behavior:'smooth',block:'start'});return result};
 $('confirmInstall').onchange=buttons;
 $('firmwareInstall').onclick=()=>command('/api/upgrade/start',{confirmed:!!$('confirmInstall').checked,address:latest?.selectedAddress,sha256:latest?.upgrade?.package?.sha256});
 const stop=document.getElementById('stopBridge');if(stop)stop.onclick=()=>command('/api/stop',{});
 $('otaModel').oninput=()=>{modelEdited=true;if(latest)render(latest)};$('checkOta').onclick=()=>command('/api/ota',{model:$('otaModel').value.trim()});
 $('export').onclick=()=>{if(latest)download(JSON.stringify(diagnostics(),null,2),'rc-ota-diagnostics-'+(latest.version||'0.7.0')+'.json','application/json')};
 $('file').onchange=inspectLocalFile;$('prepareLocal').onclick=prepareLocalFile;
 $('localVersion').oninput=()=>{$('confirmInstall').checked=false;buttons()};
 $('chooseLocalFirmware').onclick=()=>{$('localFirmwarePanel').scrollIntoView?.({behavior:'smooth',block:'start'});$('file').focus?.()};
 document.addEventListener('visibilitychange',()=>{clearTimeout(timer);if(!document.hidden)poll()});window.addEventListener('pageshow',poll);window.addEventListener('pagehide',()=>clearTimeout(timer));poll();
}
start();
