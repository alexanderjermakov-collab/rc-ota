const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup({saved='',denied=false}={}){const nodes=new Map(),translated=[],aria=[],storage=new Map([['rcota-language',saved]]);const node=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',value:'',checked:false,disabled:false,open:false,attributes:{},handlers:{},classList:{toggle(){}},getAttribute(k){return this.attributes[k]},setAttribute(k,v){this.attributes[k]=v},removeAttribute(k){delete this.attributes[k]},addEventListener(k,v){this.handlers[k]=v},showModal(){this.open=true},close(){this.open=false}});return nodes.get(id)};
 const html=fs.readFileSync('docs/index.html','utf8');let count=0;for(const match of html.matchAll(/<[a-z][^>]*\bdata-i18n(?:-aria)?="[^"]+"[^>]*>/g)){const tag=match[0],id=/\bid="([^"]+)"/.exec(tag)?.[1]||'static'+count++,n=node(id);for(const key of ['data-i18n','data-i18n-aria']){const value=new RegExp(key+'="([^"]+)"').exec(tag)?.[1];if(value)n.attributes[key]=value;}if(n.attributes['data-i18n'])translated.push(n);if(n.attributes['data-i18n-aria'])aria.push(n);}
 const document={getElementById:node,documentElement:{lang:'en'},querySelectorAll:selector=>selector==='[data-i18n]'?translated:aria};
 const window={RcWebRemote:{context:()=>({connected:false})}};vm.runInNewContext(fs.readFileSync('docs/simple-ui.js','utf8'),{window,document,localStorage:{getItem:k=>{if(denied)throw Error('denied');return storage.get(k)},setItem:(k,v)=>{if(denied)throw Error('denied');storage.set(k,v)}}});return {node,document,window,storage};}
test('English is the default, and switching to Polish translates static and current progress text',()=>{const s=setup();assert.equal(s.node('connect').textContent,'Connect');assert.equal(s.node('helpButton').textContent,'Help');s.window.RcSimpleUI.upgrade({state:'transferring',progress:65});s.node('language').onchange({target:{value:'pl'}});assert.equal(s.document.documentElement.lang,'pl');assert.equal(s.node('connect').textContent,'Połącz');assert.equal(s.node('helpButton').textContent,'Pomoc');assert.equal(s.node('shareDiagnostic').textContent,'Udostępnij diagnostykę');assert.match(s.node('screenMessage').textContent,/Aktualizacja.*65%/);assert.equal(s.storage.get('rcota-language'),'pl');});
test('saved Polish is restored; blocked language storage keeps the UI usable',()=>{assert.equal(setup({saved:'pl'}).node('connect').textContent,'Połącz');const s=setup({denied:true});assert.equal(s.node('connect').textContent,'Connect');s.node('language').onchange({target:{value:'pl'}});assert.equal(s.node('connect').textContent,'Połącz')});
test('switching language preserves the selected file and installation consent',()=>{const s=setup();s.window.RcSimpleUI.upgrade({state:'ready'},{filename:'AN2303B-2UM-001_V0.0.16.bin',version:'0.0.16',source:'local'});s.node('webConfirm').checked=true;s.node('language').onchange({target:{value:'pl'}});assert.equal(s.node('selectedFilename').textContent,'AN2303B-2UM-001_V0.0.16.bin');assert.equal(s.node('webConfirm').checked,true);assert.match(s.node('selectedVersion').textContent,/Wersja 0.0.16.*telefon/)});
test('Help and About open independently; only Help contains instructions and diagnostic export',()=>{const s=setup();s.node('helpButton').onclick();assert.equal(s.node('helpDialog').open,true);assert.equal(s.node('aboutDialog').open,false);s.node('closeHelp').onclick();s.node('aboutButton').onclick();assert.equal(s.node('aboutDialog').open,true);const html=fs.readFileSync('docs/index.html','utf8'),about=html.match(/<dialog id="aboutDialog"[\s\S]*?<\/dialog>/)[0],help=html.match(/<dialog id="helpDialog"[\s\S]*?<\/dialog>/)[0];assert.match(about,/Remote Control Software Upgrade/);assert.match(about,/Alexander Jermakov/);assert.match(about,/datetime="\d{4}-\d{2}-\d{2}"/);assert.equal(about.includes('id="export"'),false);assert.equal(about.includes('data-i18n="pair1"'),false);assert.doesNotMatch(help,/id="export"/);assert.match(help,/id="shareDiagnostic"/);assert.match(help,/data-i18n="pair1"/)});
test('numbered Help explains Back + Home for three seconds and a flashing red LED in both languages',()=>{const s=setup(),pairStep=()=>s.document.querySelectorAll('[data-i18n]').find(n=>n.getAttribute('data-i18n')==='pairFallback').textContent;assert.match(pairStep(),/Back.*Home.*3 seconds.*red LED/);s.node('language').onchange({target:{value:'pl'}});assert.match(pairStep(),/Back.*Home.*3 sekundy.*czerwona/);const html=fs.readFileSync('docs/index.html','utf8');for(const start of [1,5,8])assert.ok(html.includes('<ol start="'+start+'">'))});
test('a wrong-model BIN is shown distinctly from connection and cannot masquerade as failed pairing',()=>{const s=setup();s.window.RcSimpleUI.remote({connected:true,hasDevice:true,metadata:{model:'AN2303-2UM-001'}});s.window.RcSimpleUI.upgrade({state:'model-mismatch',detectedModel:'AN2303-2UM-001',expectedModel:'AN2303B-2UM-001'});assert.equal(s.node('connectionState').textContent,'Connected');assert.match(s.node('screenMessage').textContent,/Remote: AN2303-2UM-001.*Saved BIN: AN2303B-2UM-001/)});
test('Pro requires the password and shows fresh IDs and server metadata until locked',()=>{
 const s=setup(),submit=()=>s.node('proForm').onsubmit({preventDefault(){}});
 s.window.RcSimpleUI.remote({connected:true,freshFields:['pid','vid','software'],metadata:{model:'TEST',pid:16,vid:4660,software:'V1'}});
 s.window.RcSimpleUI.serverInfo({model:'TEST',text:'name: sample.bin'});
 assert.equal(s.node('proRemote').hidden,true);
 s.node('proButton').onclick();
 s.node('proPassword').value='1234';submit();
 assert.equal(s.node('proError').hidden,false);
 assert.equal(s.node('proOta').hidden,false);
 s.node('proPassword').value='1111';submit();
 assert.equal(s.node('proRemote').hidden,false);
 assert.equal(s.node('proPid').textContent,'0x0010 (16)');
 assert.equal(s.node('proVid').textContent,'0x1234 (4660)');
 assert.equal(s.node('proSoftware').textContent,'V1');
 assert.equal(s.node('proOtaText').textContent,'name: sample.bin');
 s.node('proButton').onclick();
 assert.equal(s.node('proOta').hidden,false);
});

test('the initial screen hides the empty pairing hint',()=>{const s=setup();assert.equal(s.node('screenMessage').hidden,true);assert.equal(s.node('screenMessage').textContent,'');});

test('Help has one diagnostic action, Share Diagnostic, with no duplicate Save button',()=>{
 const html=fs.readFileSync('docs/index.html','utf8'),help=html.match(/<dialog id="helpDialog"[\s\S]*?<\/dialog>/)[0];
 assert.equal((help.match(/id="shareDiagnostic"/g)||[]).length,1);assert.doesNotMatch(help,/id="export"|data-i18n="saveDiagnostics"/);
});

test('server TXT, filename and download actions have the same visibility in normal mode and Pro',()=>{
 const s=setup(),value={model:'AN4512E-20UM021-008',status:'otaReady',text:'name: AN4512E-20UM021-008_V0.0.6.bin',filename:'AN4512E-20UM021-008_V0.0.6.bin',version:'0.0.6',url:'https://firmware.umc-poland.com/AN4512E-20UM021-008/ota_info.txt',binaryUrl:'https://firmware.umc-poland.com/AN4512E-20UM021-008/AN4512E-20UM021-008_V0.0.6.bin',canLoad:true};
 s.window.RcSimpleUI.serverInfo(value);
 assert.equal(s.node('proOta').hidden,false);assert.equal(s.node('serverBinary').hidden,false);
 assert.equal(s.node('proOtaText').textContent,value.text);assert.equal(s.node('serverBinaryName').textContent,value.filename);
 assert.equal(s.node('serverBinaryLink').href,value.binaryUrl);assert.equal(s.node('webDownloadServer').disabled,false);
 s.node('proButton').onclick();s.node('proPassword').value='1111';s.node('proForm').onsubmit({preventDefault(){}});
 assert.equal(s.node('proOta').hidden,false);assert.equal(s.node('serverBinary').hidden,false);
 s.node('proButton').onclick();assert.equal(s.node('proOta').hidden,false);
});

test('Help switches between normal instructions and accurate Pro mode differences',()=>{
 const s=setup();assert.equal(s.node('normalHelp').hidden,false);assert.equal(s.node('proHelp').hidden,true);
 s.node('proButton').onclick();s.node('proPassword').value='1111';s.node('proForm').onsubmit({preventDefault(){}});
 s.node('helpButton').onclick();assert.equal(s.node('helpDialog').open,true);
 assert.equal(s.node('normalHelp').hidden,true);assert.equal(s.node('proHelp').hidden,false);assert.equal(s.node('helpHeading').textContent,'Help — Pro');
 const translated=key=>s.document.querySelectorAll('[data-i18n]').find(n=>n.getAttribute('data-i18n')===key).textContent;
 assert.match(translated('proVersionHelp'),/upgrade, downgrade.*same version.*Server updates still require a newer/);
 assert.match(translated('proModelHelp'),/enable Allow a different model name.*warning and confirmation/);
 assert.match(translated('proDataHelp'),/MAC.*VID.*PID.*hexadecimal and decimal/);
 assert.match(translated('proMacHelp'),/does not expose.*MAC/);
 assert.equal(s.node('shareDiagnostic').textContent,'Share Diagnostic');
 s.node('language').onchange({target:{value:'pl'}});
 assert.equal(s.node('helpHeading').textContent,'Pomoc — Pro');assert.equal(s.node('shareDiagnostic').textContent,'Udostępnij diagnostykę');
 s.node('proButton').onclick();assert.equal(s.node('normalHelp').hidden,false);assert.equal(s.node('proHelp').hidden,true);
});

test('diagnostic sharing feedback is shown in the selected language inside Help',()=>{
 const s=setup();s.window.RcSimpleUI.diagnosticStatus('diagnosticSaved');
 assert.equal(s.node('diagnosticStatus').hidden,false);assert.match(s.node('diagnosticStatus').textContent,/Attach it to an email/);
 s.node('language').onchange({target:{value:'pl'}});s.window.RcSimpleUI.diagnosticStatus('diagnosticCancelled');
 assert.equal(s.node('diagnosticStatus').textContent,'Anulowano udostępnianie.');
});

test('From phone opens the native picker synchronously, including before remote connection',()=>{
 const s=setup();let opens=0;s.node('webFirmware').click=()=>{opens++};
 s.node('webChooseFile').onclick();assert.equal(opens,1);
 s.node('webChooseFile').disabled=true;s.node('webChooseFile').onclick();assert.equal(opens,1);
 s.window.RcSimpleUI.upgrade({state:'error',message:'Choose a BIN named for this exact model',chosenFilename:'AN4512E-20UM021-008_V0.0.2.bin'});
 assert.equal(s.node('selectedFilename').textContent,'AN4512E-20UM021-008_V0.0.2.bin');
});

test('model override is visible only in unlocked Pro and its warning requires an explicit affirmative choice',async()=>{
 const s=setup(),file={filename:'AN4512E-20UM021-008_V0.0.2.bin',fileModel:'AN4512E-20UM021-008'};
 assert.equal(s.window.RcSimpleUI.isPro(),false);assert.equal(s.node('proFirmware').hidden,true);
 assert.equal(await s.window.RcSimpleUI.confirmModelOverride(file,'AN4512D-2UM-019'),false);
 s.node('proButton').onclick();s.node('proPassword').value='1111';s.node('proForm').onsubmit({preventDefault(){}});
 assert.equal(s.node('proFirmware').hidden,false);s.node('proModelOverride').checked=true;
 let pending=s.window.RcSimpleUI.confirmModelOverride(file,'AN4512D-2UM-019');
 assert.equal(s.node('modelOverrideDialog').open,true);
 assert.equal(s.node('overrideRemoteModel').textContent,'AN4512D-2UM-019');
 assert.equal(s.node('overrideFileModel').textContent,'AN4512E-20UM021-008');
 s.node('cancelModelOverride').onclick();assert.equal(await pending,false);
 pending=s.window.RcSimpleUI.confirmModelOverride(file,'AN4512D-2UM-019');
 s.node('approveModelOverride').onclick();assert.equal(await pending,true);
 s.node('proButton').onclick();assert.equal(s.node('proFirmware').hidden,true);assert.equal(s.node('proModelOverride').checked,false);
});

test('the model warning dismisses safely and translates to Polish',async()=>{
 const s=setup();s.node('proButton').onclick();s.node('proPassword').value='1111';s.node('proForm').onsubmit({preventDefault(){}});s.node('proModelOverride').checked=true;
 s.node('language').onchange({target:{value:'pl'}});
 assert.equal(s.node('approveModelOverride').textContent,'Tak, zainstaluj ten BIN');
 const pending=s.window.RcSimpleUI.confirmModelOverride({filename:'unknown.bin',fileModel:''},'AN4512D-2UM-019');
 s.node('modelOverrideDialog').handlers.close();assert.equal(await pending,false);
});

test('web connection recovery is translated and the public page does not require APK downloads',()=>{
 const s=setup();
 s.window.RcSimpleUI.remote({connected:false,busy:false,metadata:{},connectionError:{name:'NetworkError',pairingRecovery:true}});
 assert.match(s.node('screenMessage').textContent,/Android closed the Bluetooth connection/);
 s.node('language').onchange({target:{value:'pl'}});
 assert.match(s.node('screenMessage').textContent,/Android zamknął/);
 assert.equal(s.node('proBridgeLinks').hidden,true);
 assert.doesNotMatch(fs.readFileSync('docs/index.html','utf8'),/href="[^"]+\.apk"/);
});
test('Pro retains already read identifiers when the GATT link drops',()=>{
 const s=setup();
 s.node('proButton').onclick();
 s.node('proPassword').value='1111';
 s.node('proForm').onsubmit({preventDefault(){}});
 const metadata={model:'TEST',pid:16,vid:4660,software:'V1'};
 s.window.RcSimpleUI.remote({connected:true,hasDevice:true,readAt:1,metadata,freshFields:['pid','vid','software']});
 assert.equal(s.node('proReadNote').hidden,true);
 s.window.RcSimpleUI.remote({connected:false,hasDevice:true,readAt:1,metadata,freshFields:[],message:'Remote GATT disconnected.'});
 assert.equal(s.node('proPid').textContent,'0x0010 (16)');
 assert.equal(s.node('proSoftware').textContent,'V1');
 assert.equal(s.node('proReadNote').hidden,false);
 assert.equal(s.node('connect').textContent,'Reconnect');
});


test('blocked TXT gets a sandboxed HTTPS server view; receiving parsed text removes it',()=>{
 const s=setup(),url='https://firmware.umc-poland.com/M/ota_info.txt';
 s.window.RcSimpleUI.serverInfo({model:'M',url,directView:true,status:'otaBlocked'});
 assert.equal(s.node('serverInfoView').hidden,false);assert.equal(s.node('serverInfoView').getAttribute('src'),url);
 s.window.RcSimpleUI.serverInfo({model:'M',url,directView:true,text:'name: firmware.bin',status:'otaReady'});
 assert.equal(s.node('serverInfoView').hidden,true);assert.equal(s.node('serverInfoView').getAttribute('src'),undefined);
 const html=fs.readFileSync('docs/index.html','utf8');assert.match(html,/<iframe[^>]+sandbox=""[^>]+referrerpolicy="no-referrer"/);
});
