(function(){
'use strict';
const byId=id=>document.getElementById(id);
const text=(id,value)=>{const node=byId(id);if(node)node.textContent=value};
let source='server';
function selectSource(value){
 source=value;
 const server=byId('serverSource'),local=byId('localFirmwarePanel');
 if(server)server.hidden=value!=='server';if(local)local.hidden=value!=='local';
 for(const [id,selected] of [['serverMode',value==='server'],['localMode',value==='local']]){
  const node=byId(id);if(node){node.classList.toggle('selected',selected);node.setAttribute('aria-selected',String(selected));}
 }
}
function version(value){const normalized=String(value||'').replace(/^[FWVv]+/,'');return /^\d+(?:\.\d+)*$/.test(normalized)?normalized.split('.').map(BigInt):null}
function actionLabel(installed,target){const a=version(installed),b=version(target);if(!a||!b)return 'Install';for(let i=0;i<Math.max(a.length,b.length);i++){if((a[i]||0n)!==(b[i]||0n))return (b[i]||0n)<(a[i]||0n)?'Downgrade':'Update'}return 'Reinstall'}
function friendlyError(message){
 if(/do not match exactly|filename/i.test(message))return 'The server’s file listing is inconsistent. Try again later or use a local firmware file.';
 if(/md5|checksum|changed during upload/i.test(message))return 'The file check failed. Choose the correct firmware file and try again.';
 if(/403|404|HTTP|network|timed out/i.test(message))return 'The update server could not be read. Try again later, or use a local firmware file.';
 return message;
}
window.RcCustomerUI={render(s){
 const metadata=s.metadata||{},upgrade=s.upgrade||{},file=upgrade.package,ota=s.ota||{};
 const windows=s.platform==='Windows';
 text('customerVersion',s.version||'');text('transport',windows?'Windows app':'Android diagnostics');
 text('intro','Choose your remote, prepare the firmware, then install when you are ready.');
 text('otaNotice','Server updates install a newer version only. Use a local file to downgrade or reinstall.');
 const labels={verified:'Ready',reading:'Reading…',connecting:'Connecting…',discovering:'Connecting…',disconnected:'Paused',error:'Needs attention',paired:'Paired',idle:'Choose a remote'};
 text('connection',s.transferBusy?'Installing…':labels[s.stage]||s.stage);
 if(s.transferBusy)text('status','Installing firmware. Keep the remote powered and nearby.');
 else if(s.verified&&!s.dataStale)text('status','Your remote is ready.');
 else if(s.stage==='reading')text('status','Reading your remote’s information…');
 else if(s.stage==='error')text('status','The remote could not be read. Wake it and try Read remote again.');
 else if(s.stage==='disconnected')text('status','Automatic checks are paused. Your last read is shown below.');
 if(s.readAt)text('readTime',(s.dataStale?'Last read: ':'Last checked: ')+new Date(s.readAt).toLocaleString());
 const remote=byId('remote');if(remote?.options){for(const option of remote.options){const device=(s.devices||[]).find(item=>item.address===option.value);if(device){const duplicate=(s.devices||[]).filter(item=>item.name===device.name).length>1;option.textContent=device.name+(duplicate?' · '+device.address.replace(/:/g,'').slice(-4):'');}}}
 if(file){
  text('customerFilename',file.filename||'Firmware file');
  const label=actionLabel(upgrade.installed,file.version);
  text('customerTarget',(file.version?label+' to '+file.version:'Install local firmware')+' · '+Math.round((file.bytes||0)/1024)+' KB · File check passed');
  text('firmwareInstall',file.version?label+' to '+file.version:'Install this file');
  text('installConsentText',file.source==='local'?'This file is intended for my remote. I want to install it.':'I want to install this update on my remote.');
 }
 const summary=byId('customerPackage');if(summary)summary.hidden=!file;
 const state=upgrade.state;
 if(state==='checking')text('upgradeStatus','Checking the firmware file and your remote. This usually takes a few seconds.');
 else if(state==='package-verified'&&upgrade.transferAvailable)text('upgradeStatus','The file is ready. Review the version below and confirm when you want to install.');
 else if(state==='package-verified'&&/same as, or older/.test(upgrade.message||''))text('upgradeStatus','Your remote is up to date with this server. You can still use a local file.');
 else if(state==='starting')text('upgradeStatus','Starting installation…');
 else if(state==='transferring')text('upgradeStatus','Installing firmware — '+(upgrade.progress||0)+'%. Keep the remote nearby.');
 else if(state==='verifying-installation'||state==='transfer-sent')text('upgradeStatus','The file has been sent. Checking the installed firmware version…');
 else if(state==='installed')text('upgradeStatus','Done. Your remote is running '+(metadata.firmware||file?.version||'the selected firmware')+'.');
 else if(state==='error')text('upgradeStatus',friendlyError(upgrade.message||'The file could not be prepared.'));
 text('customerSupport',upgrade.message||'');
 if(ota.state==='error')text('otaStatus',friendlyError(ota.error||''));
 const comparison=byId('otaComparison');if(comparison){const labels={'Newer version listed':'Update available','Same version':'Up to date','Server version is older':'Older server version'};comparison.textContent=labels[comparison.textContent]||comparison.textContent;}
 if(!windows){const tab=byId('localMode');if(tab)tab.hidden=true;text('otaNotice','This Android bridge provides diagnostics. Use the Windows app for firmware installation.');}
 selectSource(source);
}};
const server=byId('serverMode'),local=byId('localMode');
if(server)server.addEventListener('click',()=>selectSource('server'));
if(local)local.addEventListener('click',()=>selectSource('local'));
const shortcut=byId('chooseLocalFirmware');if(shortcut)shortcut.addEventListener('click',()=>{selectSource('local');byId('localFirmwarePanel')?.scrollIntoView({behavior:'smooth',block:'start'})});
if(typeof location!=='undefined'&&location.hash==='#browserTools'){const tools=byId('browserTools');if(tools)tools.open=true;}
const browser=byId('openBrowserTools');if(browser)browser.addEventListener('click',()=>{const tools=byId('browserTools');if(tools)tools.open=true;});
})();
