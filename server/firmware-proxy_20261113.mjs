// Deployable Cloudflare Worker candidate. Not deployed or used by the public app yet.
// Public manufacturer files only; no arbitrary destination URLs or credentials.
const ORIGIN='https://alexanderjermakov-collab.github.io';
const HOST='https://firmware.umc-poland.com';
export async function proxyFetch(request,upstream=fetch){
 const headers=new Headers({'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Methods':'GET, HEAD, OPTIONS','Vary':'Origin','X-Content-Type-Options':'nosniff','Cache-Control':'no-store'});
 const error=(code,message)=>new Response(JSON.stringify({error:message}),{status:code,headers:new Headers([...headers,['Content-Type','application/json']])});
 const origin=request.headers.get('Origin');if(origin&&origin!==ORIGIN)return error(403,'Origin is not allowed.');
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(!['GET','HEAD'].includes(request.method))return error(405,'Read-only endpoint.');
 const url=new URL(request.url),parts=url.pathname.split('/');
 if(url.search||parts.length!==4||parts[1]!=='firmware'||!/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(parts[2]))return error(400,'Invalid catalogue path.');
 const model=parts[2],name=parts[3],binary=/\.bin$/i.test(name);
 if(name&&(!/^[A-Za-z0-9][A-Za-z0-9_.-]*\.(?:txt|bin)$/i.test(name)||name.includes('..')||name.length>255))return error(400,'Invalid filename.');
 const target=HOST+'/'+model+'/'+name,limit=binary?1044480:65536;
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
 try{
  const response=await upstream(target,{method:request.method,redirect:'error',credentials:'omit',signal:controller.signal});
  if(!response.ok)return error(response.status===404?404:502,'Manufacturer server returned HTTP '+response.status+'.');
  if(binary&&/text\/html/i.test(response.headers.get('Content-Type')||''))return error(502,'Manufacturer returned HTML instead of BIN.');
  if(Number(response.headers.get('Content-Length'))>limit)return error(413,'Manufacturer file is too large.');
  headers.set('Content-Type',binary?'application/octet-stream':'text/plain; charset=utf-8');
  if(binary)headers.set('Content-Disposition','attachment; filename="'+name+'"');
  if(request.method==='HEAD')return new Response(null,{headers});
  const reader=response.body.getReader(),chunks=[];let length=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>limit)throw Error('File too large.');chunks.push(value);}}
  catch(e){await reader.cancel().catch(()=>{});return error(502,'Manufacturer response exceeded its size limit.');}
  const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return new Response(bytes,{headers});
 }catch(e){return error(502,'Manufacturer request failed or timed out.');}
 finally{clearTimeout(timer);}
}
export default {fetch:request=>proxyFetch(request)};
