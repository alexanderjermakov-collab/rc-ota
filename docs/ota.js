(function(root){
'use strict';
const HOST='firmware.umc-poland.com';
function safeUrl(value,extension){const u=new URL(value);if(!['http:','https:'].includes(u.protocol)||u.hostname!==HOST||u.port||u.username||u.password||!u.pathname.toLowerCase().endsWith(extension))throw new Error('Unexpected OTA metadata URL.');u.protocol='https:';return u.href}
function manifest(text){const fields=text.trim().split(/\s+/);if(fields.length!==2)throw new Error('The server did not return a firmware URL and metadata URL.');return {firmwareUrl:safeUrl(fields[0],'.bin'),metadataUrl:safeUrl(fields[1],'.txt')}}
function info(text){const result={};for(const line of text.trim().split(/\r?\n/)){const pos=line.indexOf(':');if(pos<1)throw new Error('Invalid OTA metadata line.');const key=line.slice(0,pos).trim(),value=line.slice(pos+1).trim();if(!['name','version','md5sum','scenario','mac'].includes(key)||key in result)throw new Error('Unexpected or duplicate OTA metadata field.');result[key]=value}if(!result.name||!result.version||!/^[a-f0-9]{32}$/i.test(result.md5sum||''))throw new Error('Server metadata is missing a file name, version or valid MD5.');return result}
function comparison(installed,available){const number=v=>{const normalized=String(v||'').replace(/[FWVv.]/g,'');return /^\d+$/.test(normalized)?BigInt(normalized):null};const a=number(installed),b=number(available);if(a===null||b===null)return 'Unknown version format';return b>a?'Newer version listed':b===a?'Same version':'Server version is older'}
const api={manifest,info,comparison,HOST};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RcOta=api;
})(typeof window==='undefined'?globalThis:window);
