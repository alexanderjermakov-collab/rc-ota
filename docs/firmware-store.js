(function(root){
'use strict';
// One locally retained BIN. No device identifiers, permissions or Bluetooth keys are stored here.
function open(){return new Promise((resolve,reject)=>{if(!root.indexedDB){resolve(null);return;}const request=root.indexedDB.open('rcota-firmware',1);request.onupgradeneeded=()=>request.result.createObjectStore('packages');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);request.onblocked=()=>reject(Error('Firmware storage is busy.'));});}
async function run(mode,operation){const db=await open();if(!db)return null;return new Promise((resolve,reject)=>{const tx=db.transaction('packages',mode);let result=null;const request=operation(tx.objectStore('packages'));request.onsuccess=()=>{result=request.result};tx.oncomplete=()=>{db.close();resolve(result)};tx.onabort=tx.onerror=()=>{db.close();reject(tx.error||Error('Firmware storage failed.'))};});}
const api={load:()=>run('readonly',store=>store.get('active')),save:async value=>{const db=await open();if(!db)return false;return new Promise((resolve,reject)=>{const tx=db.transaction('packages','readwrite');tx.objectStore('packages').put(value,'active');tx.oncomplete=()=>{db.close();resolve(true)};tx.onabort=tx.onerror=()=>{db.close();reject(tx.error||Error('Firmware storage failed.'))};});},clear:()=>run('readwrite',store=>store.delete('active'))};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RcFirmwareStore=api;
})(typeof window==='undefined'?globalThis:window);
