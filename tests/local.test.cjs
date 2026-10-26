const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const turn=()=>new Promise(resolve=>setImmediate(resolve));
function setup(options={}){
 const elements=new Map(),events={},documentEvents={},requests=[],timers=new Map(),storage=new Map(Object.entries(options.storage||{}));let nextTimer=1,replaced='',download='';
 function element(id){if(!elements.has(id))elements.set(id,{id,textContent:'',value:'',disabled:false,hidden:true,children:[],files:[],append(child){this.children.push(child)},replaceChildren(){this.children=[];this.value=''},click(){download=this.download}});return elements.get(id)}
 const document={hidden:false,getElementById:element,createElement:()=>({value:'',textContent:'',click(){download=this.download}}),addEventListener:(name,fn)=>documentEvents[name]=fn};
 let state={version:'0.7.0',transport:'Local Android BLE Bridge',serviceRunning:true,connectPermission:true,bluetoothEnabled:true,bluetoothAvailable:true,stage:'paired',devices:[{name:'SHARP RCU',address:'one'}],metadata:{},ota:{},services:[],trace:[]};
 const window={addEventListener:(name,fn)=>events[name]=fn};
 const context={window,document,navigator:{userAgent:'test browser'},location:{hash:options.hash??'#token=secret-test-session',pathname:'/',search:''},history:{replaceState:(a,b,url)=>replaced=url},sessionStorage:{getItem:key=>storage.get(key),setItem:(key,val)=>storage.set(key,val)},URLSearchParams,URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},Blob,btoa,AbortController,isSecureContext:true,crypto:require('node:crypto').webcrypto,RcOta:require('../docs/ota.js'),setTimeout:(fn,delay)=>{const id=nextTimer++;timers.set(id,{fn,delay});return id},clearTimeout:id=>timers.delete(id),fetch:async(path,params)=>{requests.push({path,params});if(options.fetch)return options.fetch(path,params);return {ok:true,json:async()=>state}}};
 vm.createContext(context);vm.runInContext(fs.readFileSync('docs/local/app.js','utf8'),context);
 return {el:element,context,document,events,documentEvents,requests,timers,storage,setState:value=>state={...state,...value},run:code=>vm.runInContext(code,context),get replaced(){return replaced},get download(){return download}};
}
test('local UI uses authenticated native API without Web Bluetooth',async()=>{const s=setup();await turn();assert.equal(s.requests[0].path,'/api/state');assert.equal(s.requests[0].params.headers.Authorization,'Bearer secret-test-session');assert.equal(s.el('transport').textContent,'Local Android BLE Bridge');assert.equal(s.el('remote').value,'one');assert.equal(s.el('connect').disabled,false)});
test('session fragment is removed and reload reuses session storage',async()=>{const s=setup();await turn();assert.equal(s.replaced,'/');assert.equal(s.storage.get('rcota-local-token'),'secret-test-session');const reload=setup({hash:'',storage:Object.fromEntries(s.storage)});await turn();assert.equal(reload.requests[0].params.headers.Authorization,'Bearer secret-test-session')});
test('missing authorization explains how to open the app without probing Bluetooth',async()=>{const s=setup({hash:''});await turn();assert.equal(s.requests.length,0);assert.match(s.el('bridgeError').textContent,/Open.*RC OTA/);assert.equal(s.el('connect').disabled,true)});
test('two paired remotes require selection and selected address is sent as JSON',async()=>{const s=setup();await turn();s.setState({devices:[{name:'SHARP RCU',address:'one'},{name:'SHARP SOLAR RCU',address:'two'}]});s.el('remote').value='';await s.run('poll()');assert.equal(s.el('remote').value,'');s.el('remote').value='two';s.el('remote').onchange();await s.el('connect').onclick();const request=s.requests.find(r=>r.path==='/api/connect');assert.equal(JSON.parse(request.params.body).address,'two');assert.equal(request.params.method,'POST')});
test('pairing and GATT do not report verified data before a successful read',async()=>{const s=setup();await turn();s.setState({bondState:'bonded',stage:'reading',gattConnected:true,verified:false});await s.run('poll()');assert.match(s.el('paired').textContent,/paired in Android/);assert.equal(s.el('gatt').textContent,'GATT: connected');assert.equal(s.el('verified').textContent,'Live data: unverified');assert.equal(s.el('connect').disabled,true)});
test('permission denial and Bluetooth off disable connect with distinct explanations',async()=>{const s=setup();await turn();s.setState({connectPermission:false,bluetoothEnabled:false});await s.run('poll()');assert.equal(s.el('connect').disabled,true);assert.match(s.el('permissions').textContent,/permission required/);assert.match(s.el('permissions').textContent,/Bluetooth: off/)});
test('disconnect keeps last metadata with a timestamp and permits reconnect',async()=>{const s=setup();await turn();s.setState({stage:'disconnected',gattConnected:false,verified:false,dataStale:true,readAt:1700000000000,metadata:{model:'TEST',firmware:'V0.0.11',level:74}});await s.run('poll()');assert.equal(s.el('model').textContent,'TEST');assert.equal(s.el('level').textContent,'74%');assert.match(s.el('readTime').textContent,/Last read data/);assert.equal(s.el('connect').disabled,false)});
test('hidden page stops polling and returning refreshes immediately',async()=>{const s=setup();await turn();s.document.hidden=true;s.documentEvents.visibilitychange();assert.equal([...s.timers.values()].filter(t=>t.delay===1000).length,0);const calls=s.requests.length;await s.run('poll()');assert.equal(s.requests.length,calls);s.document.hidden=false;s.documentEvents.visibilitychange();await turn();assert.equal(s.requests.length,calls+1)});
test('bridge stopping marks cached data stale and disables commands',async()=>{let stopped=false;const s=setup({fetch:async()=>{if(stopped)throw new TypeError('Failed to fetch');return {ok:true,json:async()=>({transport:'Local Android BLE Bridge',stage:'verified',connectPermission:true,bluetoothEnabled:true,verified:true,metadata:{model:'TEST'},readAt:1700000000000,devices:[],trace:[]})}}});await turn();stopped=true;await s.run('poll()');assert.equal(s.el('connection').textContent,'Bridge unavailable');assert.equal(s.el('connect').disabled,true);assert.equal(s.el('model').textContent,'TEST');assert.match(s.el('readTime').textContent,/Last read data/)});
test('expired token response asks user to authorize from the launcher',async()=>{const s=setup({fetch:async()=>({ok:false,json:async()=>({error:'Open RC OTA and select Open in Chrome to authorize this tab.'})})});await turn();assert.match(s.el('bridgeError').textContent,/authorize this tab/);assert.equal(s.el('connect').disabled,true)});
test('native OTA results compare firmware only for the same exact model',async()=>{const s=setup();await turn();const result={state:'complete',model:'TEST',checkedAt:1700000000000,value:{version:'V0.0.12',binaryAvailable:true}};s.setState({metadata:{model:'TEST',firmware:'V0.0.11'},ota:result});await s.run('poll()');assert.equal(s.el('otaVersion').textContent,'V0.0.12');assert.equal(s.el('otaBinary').textContent,'Available on server');assert.equal(s.el('otaComparison').textContent,'Newer version listed');s.setState({ota:{...result,model:'OTHER'}});await s.run('poll()');assert.match(s.el('otaComparison').textContent,/Different model/)});
test('diagnostic export contains native stages and no session token',async()=>{const s=setup();await turn();const text=s.run('JSON.stringify(diagnostics())');assert.equal(text.includes('secret-test-session'),false);assert.match(text,/connectPermission/);s.el('export').onclick();assert.equal(s.download,'rc-ota-diagnostics-0.7.0.json')});

test('Windows renders all remote fields and keeps stop enabled between native read sessions',async()=>{
 const s=setup();await turn();s.setState({platform:'Windows',stage:'verified',autoRead:true,gattConnected:false,verified:true,readAt:1700000000000,metadata:{model:'TEST',manufacturer:'Maker',hardware:'V00',level:0}});await s.run('poll()');
 assert.equal(s.el('hardware').textContent,'V00');assert.equal(s.el('manufacturer').textContent,'Maker');assert.equal(s.el('level').textContent,'0%');
 assert.match(s.el('paired').textContent,/paired remotes available/);assert.equal(s.el('gatt').textContent,'GATT: read session closed');assert.equal(s.el('disconnect').disabled,false);
 await s.el('refresh').onclick();assert.equal(s.requests.at(-1).path,'/api/refresh');
});

test('Install on remote requires the review checkbox and sends the exact verified package identity',async()=>{
 const s=setup();await turn();s.setState({platform:'Windows',selectedAddress:'one',verified:true,dataStale:false,metadata:{model:'TEST',firmware:'V0.0.2'},upgrade:{state:'package-verified',transferAvailable:true,address:'one',installed:'V0.0.2',package:{model:'TEST',version:'0.0.3',sha256:'a'.repeat(64)}}});await s.run('poll()');
 assert.equal(s.el('installReview').hidden,false);assert.equal(s.el('firmwareInstall').disabled,true);
 s.el('confirmInstall').checked=true;s.el('confirmInstall').onchange();assert.equal(s.el('firmwareInstall').disabled,false);
 await s.el('firmwareInstall').onclick();const request=s.requests.at(-1);assert.equal(request.path,'/api/upgrade/start');assert.deepEqual(JSON.parse(request.params.body),{confirmed:true,address:'one',sha256:'a'.repeat(64)});
});

test('changing the verified package clears installation confirmation',async()=>{
 const s=setup();await turn();s.setState({platform:'Windows',selectedAddress:'one',verified:true,dataStale:false,metadata:{model:'TEST'},upgrade:{state:'package-verified',transferAvailable:true,address:'one',package:{sha256:'a'.repeat(64)}}});await s.run('poll()');s.el('confirmInstall').checked=true;
 s.setState({upgrade:{state:'package-verified',transferAvailable:true,address:'one',package:{sha256:'b'.repeat(64)}}});await s.run('poll()');assert.equal(s.el('confirmInstall').checked,false);assert.equal(s.el('firmwareInstall').disabled,true);
});

test('local BIN preparation sends its bytes to loopback without querying the server or starting transfer',async()=>{
 const s=setup();await turn();s.setState({platform:'Windows',selectedAddress:'one',verified:true,dataStale:false,metadata:{model:'TEST',firmware:'V0.0.3'}});await s.run('poll()');
 const bytes=Uint8Array.from({length:64},(_,index)=>index);s.el('file').files=[{name:'TEST_V0.0.2.bin',size:bytes.length,arrayBuffer:async()=>bytes.buffer}];await s.el('file').onchange();
 assert.equal(s.el('localVersion').value,'0.0.2');assert.equal(s.el('prepareLocal').disabled,false);await s.el('prepareLocal').onclick();
 const request=s.requests.at(-1),body=JSON.parse(request.params.body);assert.equal(request.path,'/api/upgrade/local');assert.equal(body.filename,'TEST_V0.0.2.bin');assert.equal(body.version,'0.0.2');assert.deepEqual(Buffer.from(body.content,'base64'),Buffer.from(bytes));assert.match(body.sha256,/^[a-f0-9]{64}$/);
 assert.equal(s.requests.some(request=>request.path==='/api/upgrade/start'),false);
});

test('changing the local target version disables installation until that file is prepared again',async()=>{
 const s=setup();await turn();s.setState({platform:'Windows',selectedAddress:'one',verified:true,dataStale:false,metadata:{model:'TEST',firmware:'V0.0.3'}});await s.run('poll()');
 const bytes=Uint8Array.from({length:32},(_,index)=>index);s.el('file').files=[{name:'firmware.bin',size:32,arrayBuffer:async()=>bytes.buffer}];await s.el('file').onchange();s.el('localVersion').value='0.0.2';
 const sha=require('node:crypto').createHash('sha256').update(bytes).digest('hex');s.setState({upgrade:{state:'package-verified',transferAvailable:true,address:'one',package:{source:'local',version:'0.0.2',sha256:sha}}});await s.run('poll()');
 s.el('confirmInstall').checked=true;s.el('confirmInstall').onchange();assert.equal(s.el('firmwareInstall').disabled,false);
 s.el('localVersion').value='0.0.1';s.el('localVersion').oninput();s.el('confirmInstall').checked=true;s.el('confirmInstall').onchange();assert.equal(s.el('firmwareInstall').disabled,true);
});

test('preparing even the same package clears the previous installation consent',async()=>{
 const s=setup();await turn();s.setState({platform:'Windows',selectedAddress:'one',verified:true,dataStale:false,metadata:{model:'TEST'},upgrade:{state:'package-verified',transferAvailable:true,address:'one',package:{source:'server',version:'0.0.3',sha256:'a'.repeat(64)}}});await s.run('poll()');
 s.el('confirmInstall').checked=true;await s.el('firmwareUpgrade').onclick();assert.equal(s.el('confirmInstall').checked,false);assert.equal(s.el('firmwareInstall').disabled,true);
});
