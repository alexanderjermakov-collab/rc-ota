(function(root){
'use strict';
function create(env){
 let sharing=false;
 const status=key=>env.RcSimpleUI?.diagnosticStatus?.(key);
 function build(){
  const now=new env.Date(),pad=n=>String(n).padStart(2,'0');
  const stamp=now.getFullYear()+pad(now.getMonth()+1)+pad(now.getDate())+'_'+pad(now.getHours())+pad(now.getMinutes())+pad(now.getSeconds());
  const data=env.RcDiagnosticSnapshot();
  return {name:'RC-OTA-Diagnostics_'+stamp+'.json',text:JSON.stringify(data,null,2)};
 }
 function save(report){
  const blob=new env.Blob([report.text],{type:'application/json'}),url=env.URL.createObjectURL(blob),a=env.document.createElement('a');
  try{a.href=url;a.download=report.name;a.click();}finally{env.setTimeout(()=>env.URL.revokeObjectURL(url),1000);}
  status('diagnosticSaved');return true;
 }
 function download(){try{return save(build());}catch(error){status('diagnosticError');return false;}}
 async function share(){
  if(sharing)return false;
  sharing=true;const button=env.document.getElementById('shareDiagnostic');if(button)button.disabled=true;
  let report;
  try{
   // Build synchronously: navigator.share must retain this button's user activation.
   report=build();const nav=env.navigator||{};
   if(typeof nav.share!=='function')return save(report);
   let files;
   if(typeof env.File==='function'&&typeof nav.canShare==='function'){
    const file=new env.File([report.text],report.name,{type:'application/json'});
    if(nav.canShare({files:[file]}))files=[file];
    else{
     const textFile=new env.File([report.text],report.name.replace(/\.json$/,'.txt'),{type:'text/plain'});
     if(nav.canShare({files:[textFile]}))files=[textFile];
    }
   }
   await nav.share(files?{files,title:'RC OTA diagnostics'}:{title:'RC OTA diagnostics',text:report.text});
   status('diagnosticShared');return true;
  }catch(error){
   if(error.name==='AbortError'){status('diagnosticCancelled');return false;}
   if(report)try{return save(report);}catch(ignored){}
   status('diagnosticError');return false;
  }finally{sharing=false;if(button)button.disabled=false;}
 }
 return {download,share};
}
if(typeof module!=='undefined'&&module.exports)module.exports=create;
else{root.RcDiagnostics=create(root);root.document.getElementById('shareDiagnostic').onclick=()=>root.RcDiagnostics.share();}
})(typeof window==='undefined'?globalThis:window);
