const test=require('node:test'),assert=require('node:assert/strict');
const modulePromise=import('../server/firmware-proxy_20261113.mjs');
const ORIGIN='https://alexanderjermakov-collab.github.io';
const request=(path,opts={})=>new Request('https://proxy.example/firmware/'+path,{headers:{Origin:ORIGIN},...opts});
test('proxy serves only the fixed manufacturer catalogue with CORS for the existing app',async()=>{
 const {proxyFetch}=await modulePromise;let target,options;
 const response=await proxyFetch(request('AN4512E-20UM021-008/ota_info.txt'),async(url,opts)=>{target=url;options=opts;return new Response('name: test.bin')});
 assert.equal(target,'https://firmware.umc-poland.com/AN4512E-20UM021-008/ota_info.txt');
 assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');
 assert.equal(response.headers.get('Access-Control-Allow-Origin'),ORIGIN);assert.equal(await response.text(),'name: test.bin');
});
test('proxy refuses other origins, methods, query destinations and encoded traversal without contacting upstream',async()=>{
 const {proxyFetch}=await modulePromise;let calls=0;const fetcher=async()=>{calls++;throw Error()};
 for(const req of [request('MODEL/ota_info.txt',{headers:{Origin:'https://other.example'}}),request('MODEL/a.bin',{method:'POST'}),request('MODEL/a.bin?url=https://other.example'),request('MODEL/%2e%2e%2fsecret.txt'),request('MODEL/credentials.json')])assert.ok((await proxyFetch(req,fetcher)).status>=400);
 assert.equal(calls,0);
});
test('proxy rejects oversized and HTML binary responses',async()=>{
 const {proxyFetch}=await modulePromise;
 const tooLarge=await proxyFetch(request('MODEL/a.bin'),async()=>new Response('x',{headers:{'Content-Length':'1044481'}}));assert.equal(tooLarge.status,413);
 const html=await proxyFetch(request('MODEL/a.bin'),async()=>new Response('<html>',{headers:{'Content-Type':'text/html'}}));assert.equal(html.status,502);
});
test('proxy preserves missing catalogue status and never fabricates metadata',async()=>{
 const {proxyFetch}=await modulePromise;const r=await proxyFetch(request('AN4512D-2UM-019/'),async()=>new Response('Not found',{status:404}));
 assert.equal(r.status,404);assert.match(await r.text(),/HTTP 404/);
});
