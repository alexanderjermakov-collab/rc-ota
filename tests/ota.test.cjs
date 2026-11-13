const test=require('node:test'),assert=require('node:assert/strict'),ota=require('../docs/ota.js');
test('manufacturer listing uses fixed server and HTTPS metadata',()=>{const x=ota.manifest('http://firmware.umc-poland.com/model/fw.bin\nhttp://firmware.umc-poland.com/model/info.txt');assert.equal(x.metadataUrl,'https://firmware.umc-poland.com/model/info.txt')});
test('rejects unexpected metadata hosts',()=>assert.throws(()=>ota.manifest('https://other.example/fw.bin https://other.example/info.txt')));
test('parses firmware version and colon-delimited MAC intact',()=>{const x=ota.info('name: fw.bin\nversion: V0.0.12\nmd5sum: 0123456789abcdef0123456789abcdef\nscenario: manual\nmac: 00:11:22:33:44:55');assert.equal(x.version,'V0.0.12');assert.equal(x.mac,'00:11:22:33:44:55')});
test('rejects malformed version metadata and MD5',()=>assert.throws(()=>ota.info('name: fw.bin\nversion: 1.2\nmd5sum: invalid')));
test('comparison follows original numeric revision convention',()=>{assert.equal(ota.comparison('V0.0.11','V0.0.12'),'Newer version listed');assert.equal(ota.comparison('V0.0.12','V0.0.12'),'Same version');assert.equal(ota.comparison('Unknown','V0.0.12'),'Unknown version format')});

test('both supplied index formats provide exact BIN and TXT URLs, including the HTTP rename example',()=>{
 const first=ota.manifest('http://firmware.umc-poland.com/AN4512E-20UM021-008/AN4512E-20UM021-008_V0.0.6.bin\n\nhttp://firmware.umc-poland.com/AN4512E-20UM021-008/ota_info.txt');
 assert.equal(first.firmwareUrl,'https://firmware.umc-poland.com/AN4512E-20UM021-008/AN4512E-20UM021-008_V0.0.6.bin');
 assert.equal(first.metadataUrl,'https://firmware.umc-poland.com/AN4512E-20UM021-008/ota_info.txt');
 const second=ota.manifest('https://firmware.umc-poland.com/AN2101A-20UM021-001/AN2101A-20UM021-001_V0.0.3.bin\n\nhttps://firmware.umc-poland.com/AN2101A-20UM021-001/ota_info.txt');
 assert.equal(second.firmwareUrl,'https://firmware.umc-poland.com/AN2101A-20UM021-001/AN2101A-20UM021-001_V0.0.3.bin');
});

test('HTML anchor indexes can use relative links without executing their markup',()=>{
 const result=ota.manifest('<html><a href="firmware.bin">BIN</a><a href="ota_info.txt">Info</a><script>neverExecute()</script></html>','https://firmware.umc-poland.com/MODEL/');
 assert.equal(result.firmwareUrl,'https://firmware.umc-poland.com/MODEL/firmware.bin');
 assert.equal(result.metadataUrl,'https://firmware.umc-poland.com/MODEL/ota_info.txt');
});

test('ambiguous indexes are rejected rather than choosing an arbitrary firmware',()=>{
 assert.throws(()=>ota.manifest('https://firmware.umc-poland.com/M/a.bin https://firmware.umc-poland.com/M/b.bin https://firmware.umc-poland.com/M/ota_info.txt'),/one BIN/);
});
