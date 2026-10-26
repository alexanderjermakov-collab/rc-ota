import importlib.util
import json
import hashlib
import io
import tempfile
import subprocess
import base64
from types import SimpleNamespace
from pathlib import Path
import threading
import time
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen

spec = importlib.util.spec_from_file_location('windows_bridge', Path(__file__).parents[1] / 'windows/bridge.py')
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


def fixture():
    return dict(paired=True, name='SHARP RCU', readings=[
        dict(field='model', value='TEST-MODEL', status='Success'),
        dict(field='battery', value=83, status='Success'),
        dict(field='hardware', value='V00', status='Success'),
        dict(field='manufacturer', value='TEST MANUFACTURER', status='Success')], services=['info'])


class BridgeTests(unittest.TestCase):
    def make_bridge(self, reader=None):
        bridge = mod.Bridge(reader=reader or (lambda *args: fixture()), checker=lambda model: dict(version='V0.0.2'))
        bridge.state['devices'] = [dict(name='SHARP RCU', address='AABBCCDDEEFF'), dict(name='SHARP SOLAR RCU', address='112233445566')]
        return bridge

    def wait_read(self, bridge):
        until = time.monotonic() + 2
        while bridge.busy and time.monotonic() < until:
            time.sleep(.005)
        self.assertFalse(bridge.busy)

    def test_real_values_mark_read_verified_but_not_persistent_gatt(self):
        bridge = self.make_bridge()
        bridge.connect('AABBCCDDEEFF'); self.wait_read(bridge)
        state = bridge.snapshot()
        self.assertEqual(state['metadata']['level'], 83)
        self.assertEqual(state['metadata']['hardware'], 'V00')
        self.assertTrue(state['verified']); self.assertFalse(state['gattConnected'])
        self.assertTrue(state['autoRead'])

    def test_failure_keeps_previous_values_and_marks_stale(self):
        bridge = self.make_bridge()
        bridge.connect('AABBCCDDEEFF'); self.wait_read(bridge)
        def fail(*args): raise RuntimeError('unreachable')
        bridge.reader = fail
        bridge.connect('AABBCCDDEEFF'); self.wait_read(bridge)
        self.assertEqual(bridge.state['metadata']['model'], 'TEST-MODEL')
        self.assertTrue(bridge.state['dataStale']); self.assertFalse(bridge.state['verified'])

    def test_cancelled_result_cannot_restore_verified_status(self):
        release = threading.Event()
        def delayed(*args): release.wait(1); return fixture()
        bridge = self.make_bridge(delayed)
        bridge.connect('AABBCCDDEEFF'); bridge.disconnect(); release.set(); self.wait_read(bridge)
        self.assertEqual(bridge.state['stage'], 'disconnected')
        self.assertFalse(bridge.state['verified']); self.assertFalse(bridge.active)

    def test_other_remote_does_not_inherit_old_model(self):
        bridge = self.make_bridge()
        bridge.connect('AABBCCDDEEFF'); self.wait_read(bridge)
        bridge.reader = lambda *args: dict(paired=True, name='SHARP SOLAR RCU', readings=[dict(field='battery',value=50,status='Success')])
        bridge.connect('112233445566'); self.wait_read(bridge)
        self.assertNotIn('model', bridge.state['metadata'])
        self.assertEqual(bridge.state['metadata']['level'], 50)

    def test_invalid_unpaired_selection_rejected(self):
        bridge = self.make_bridge()
        with self.assertRaises(ValueError): bridge.connect('not paired')

    def test_metadata_urls_cannot_escape_manufacturer_host(self):
        for url in ['https://example.com/fw.bin', 'https://firmware.umc-poland.com@evil.test/fw.bin', 'https://firmware.umc-poland.com:444/fw.bin']:
            with self.assertRaises(ValueError): mod.manufacturer_url(url, '.bin')

    def test_binary_404_is_unavailable_not_a_successful_update(self):
        def request(url, method='GET'):
            if method == 'HEAD':
                raise HTTPError(url, 404, 'Not Found', {}, None)
            if url.endswith('.txt'):
                return 'name:FW.bin\nversion:0.0.3\nmd5sum:' + 'a'*32
            return 'https://firmware.umc-poland.com/TEST/FW.bin https://firmware.umc-poland.com/TEST/info.txt'
        with patch.object(mod, 'request_metadata', side_effect=request):
            result = mod.ota_check('TEST')
        self.assertFalse(result['binaryAvailable'])
        self.assertEqual(result['version'], '0.0.3')

    def test_package_download_verifies_checksum_before_saving(self):
        data=b'test firmware bytes'
        info=dict(name='FW_V0.0.3.bin',version='0.0.3',firmwareUrl='https://firmware.umc-poland.com/TEST/FW_V0.0.3.bin',md5sum=hashlib.md5(data).hexdigest())
        response=io.BytesIO(data);response.status=200;response.headers={'Content-Length':str(len(data)),'Content-Type':'application/octet-stream'}
        with tempfile.TemporaryDirectory() as directory, patch.object(mod,'build_opener',return_value=SimpleNamespace(open=lambda *args,**kwargs:response)):
            result=mod.verify_package('TEST',info,directory)
            self.assertTrue(result['md5Verified']);self.assertEqual(result['bytes'],len(data))
            self.assertEqual(len(list(Path(directory).glob('*.bin'))),1)

    def test_mismatched_catalogue_name_is_rejected_without_download(self):
        info=dict(name='FW_V0.0.3.bin',firmwareUrl='https://firmware.umc-poland.com/TEST/FW_v0.0.3.bin',md5sum='a'*32)
        with patch.object(mod,'build_opener') as opener:
            with self.assertRaisesRegex(ValueError,'do not match exactly'):mod.verify_package('TEST',info,'unused')
            opener.assert_not_called()

    def test_checksum_failure_does_not_save_a_package(self):
        response=io.BytesIO(b'bad firmware');response.status=200;response.headers={}
        info=dict(name='FW.bin',firmwareUrl='https://firmware.umc-poland.com/TEST/FW.bin',md5sum='a'*32)
        with tempfile.TemporaryDirectory() as directory,patch.object(mod,'build_opener',return_value=SimpleNamespace(open=lambda *args,**kwargs:response)):
            with self.assertRaisesRegex(ValueError,'MD5 does not match'):mod.verify_package('TEST',info,directory)
            self.assertEqual(list(Path(directory).iterdir()),[])

    def test_preparation_never_claims_a_firmware_transfer(self):
        bridge=self.make_bridge();bridge.verifier=lambda *args:dict(md5Verified=True,bytes=100)
        bridge.connect('AABBCCDDEEFF');self.wait_read(bridge);bridge.prepare_upgrade()
        until=time.monotonic()+2
        while bridge.state['upgrade']['state']=='checking' and time.monotonic()<until:time.sleep(.005)
        self.assertEqual(bridge.state['upgrade']['state'],'package-verified')
        self.assertFalse(bridge.state['upgrade']['transferAvailable']);self.assertIn('Nothing was installed',bridge.state['upgrade']['message'])

    def test_api_requires_token_and_same_origin_and_does_not_leak_token(self):
        bridge = self.make_bridge()
        server = mod.make_server(bridge, 'test-session-token')
        threading.Thread(target=server.serve_forever, daemon=True).start()
        base = 'http://127.0.0.1:' + str(server.server_port)
        try:
            for headers, expected in [({}, 401), ({'Authorization':'Bearer test-session-token','Origin':'https://evil.test'},403), ({'Authorization':'Bearer test-session-token','Host':'evil.test'},403)]:
                with self.assertRaises(HTTPError) as error: urlopen(Request(base+'/api/state',headers=headers))
                self.assertEqual(error.exception.code, expected)
                error.exception.close()
            with urlopen(Request(base+'/api/state',headers={'Authorization':'Bearer test-session-token'})) as response:
                self.assertNotIn('test-session-token', response.read().decode())
            with urlopen(base+'/') as response:
                html=response.read().decode()
                self.assertIn('id="stopBridge"',html); self.assertIn('id="manufacturer"',html)
            with self.assertRaises(HTTPError) as error: urlopen(base+'/../windows/.runtime/session.json')
            self.assertEqual(error.exception.code,404)
            error.exception.close()
        finally:
            server.shutdown();server.server_close()

    def test_telink_crc_uses_the_known_modbus_vector_and_partial_packet_padding(self):
        self.assertEqual(mod.telink_crc(b'123456789'),0x4b37)
        firmware=bytes(range(17));packet=mod.telink_packet(firmware,1)
        self.assertEqual(len(packet),20);self.assertEqual(packet[:3],b'\x01\x00\x10')
        self.assertEqual(packet[3:18],b'\xff'*15)
        self.assertEqual(mod.telink_end(1)[:6],bytes.fromhex('02ff0100feff'))

    def test_native_dry_run_matches_packet_reference_without_opening_bluetooth(self):
        data=bytes(range(33));sha=hashlib.sha256(data).hexdigest();md5=hashlib.md5(data).hexdigest()
        folder=mod.ROOT/'windows/.runtime/firmware';folder.mkdir(parents=True,exist_ok=True)
        file=folder/(sha+'.bin');file.write_bytes(data)
        try:
            result=subprocess.run(['powershell.exe','-NoProfile','-NonInteractive','-File',str(mod.ROOT/'windows/telink-transport.ps1'),'-Action','dry-run','-FirmwarePath',str(file),'-ExpectedSha256',sha,'-ExpectedMd5',md5],capture_output=True,encoding='utf-8-sig',timeout=20)
            self.assertEqual(result.returncode,0,result.stderr+result.stdout)
            report=json.loads(result.stdout)
            self.assertEqual(report['packets'],3);self.assertEqual(report['first'],mod.telink_packet(data,0).hex());self.assertEqual(report['last'],mod.telink_packet(data,2).hex());self.assertEqual(report['end'],mod.telink_end(2).hex())
        finally:file.unlink(missing_ok=True)

    def test_transfer_requires_confirmation_and_newer_version(self):
        bridge=self.make_bridge()
        with self.assertRaises(ValueError):bridge.start_transfer({})
        self.assertIn('No upgrade',bridge.transfer_blocker(mod.SUPPORTED_OTA_MODEL,'V0.0.2',dict(version='0.0.2',bytes=100)))
        self.assertIn('No upgrade',bridge.transfer_blocker(mod.SUPPORTED_OTA_MODEL,'V0.0.3',dict(version='0.0.2',bytes=100)))

    def test_transfer_success_requires_post_install_live_version_read(self):
        address='AABBCCDDEEFF';model=mod.SUPPORTED_OTA_MODEL;events=[]
        bridge=mod.Bridge(reader=lambda *args:dict(readings=[dict(field='model',value=model,status='Success'),dict(field='firmware',value='V0.0.3',status='Success')]),writer=lambda *args:events.append(args[:4]))
        bridge.verify_delay=0
        bridge.state.update(selectedAddress=address,verified=True,dataStale=False,metadata=dict(model=model,firmware='V0.0.2'))
        package=dict(model=model,version='0.0.3',bytes=100,sha256='a'*64,md5='b'*32)
        bridge.state['upgrade']=dict(state='package-verified',transferAvailable=True,address=address,installed='V0.0.2',package=package)
        bridge.start_transfer(dict(confirmed=True,address=address,sha256='a'*64));self.wait_read(bridge)
        self.assertEqual(len(events),1);self.assertEqual(bridge.state['upgrade']['state'],'installed');self.assertEqual(bridge.state['metadata']['firmware'],'V0.0.3')

    def test_sent_frames_without_new_live_version_are_not_reported_as_installed(self):
        address='AABBCCDDEEFF';model=mod.SUPPORTED_OTA_MODEL
        bridge=mod.Bridge(reader=lambda *args:dict(readings=[dict(field='model',value=model,status='Success'),dict(field='firmware',value='V0.0.2',status='Success')]),writer=lambda *args:None)
        bridge.verify_delay=0
        bridge.state.update(selectedAddress=address,verified=True,dataStale=False,metadata=dict(model=model,firmware='V0.0.2'))
        bridge.state['upgrade']=dict(state='package-verified',transferAvailable=True,address=address,installed='V0.0.2',package=dict(version='0.0.3',bytes=100,sha256='a'*64))
        bridge.start_transfer(dict(confirmed=True,address=address,sha256='a'*64));self.wait_read(bridge)
        self.assertEqual(bridge.state['upgrade']['state'],'installation-unconfirmed');self.assertFalse(bridge.state['verified'])

    def test_local_version_policy_allows_older_same_newer_and_unknown_without_changing_server_policy(self):
        for version in ('0.0.1','0.0.3','0.0.9',''):
            package=dict(source='local',version=version,bytes=32)
            self.assertEqual(mod.Bridge.transfer_blocker(mod.SUPPORTED_OTA_MODEL,'V0.0.3',package),'')
        for version in ('0.0.1','0.0.3'):
            self.assertIn('No upgrade',mod.Bridge.transfer_blocker(mod.SUPPORTED_OTA_MODEL,'V0.0.3',dict(source='server',version=version,bytes=32)))

    def test_local_file_hash_and_named_model_are_checked(self):
        data=bytes(range(32));encoded=base64.b64encode(data).decode();sha=hashlib.sha256(data).hexdigest()
        with tempfile.TemporaryDirectory() as directory:
            package=mod.local_package(mod.SUPPORTED_OTA_MODEL+'_V0.0.2.bin',encoded,sha,mod.SUPPORTED_OTA_MODEL,'',directory)
            self.assertEqual(package['source'],'local');self.assertEqual(package['version'],'0.0.2');self.assertTrue(package['sha256Verified']);self.assertFalse(package['md5Verified'])
            self.assertEqual((Path(directory)/(sha+'.bin')).read_bytes(),data)
            with self.assertRaisesRegex(ValueError,'changed during upload'):mod.local_package('firmware.bin',encoded,'a'*64,mod.SUPPORTED_OTA_MODEL,'',directory)
            with self.assertRaisesRegex(ValueError,'different remote model'):mod.local_package('OTHER_V0.0.2.bin',encoded,sha,mod.SUPPORTED_OTA_MODEL,'',directory)
            with self.assertRaisesRegex(ValueError,'disagrees'):mod.local_package(mod.SUPPORTED_OTA_MODEL+'_V0.0.2.bin',encoded,sha,mod.SUPPORTED_OTA_MODEL,'0.0.3',directory)
            with self.assertRaisesRegex(ValueError,'BIN'):mod.local_package('firmware.zip',encoded,sha,mod.SUPPORTED_OTA_MODEL,'',directory)

    def test_local_downgrade_uses_no_catalogue_and_verifies_the_lower_version_after_transfer(self):
        model=mod.SUPPORTED_OTA_MODEL;address='AABBCCDDEEFF';data=bytes(range(32));writes=[]
        def never_check(*args):self.fail('Local installation must not query the OTA catalogue')
        with tempfile.TemporaryDirectory() as directory:
            bridge=mod.Bridge(checker=never_check,prober=lambda *args:dict(state='probe-ok',writesPerformed=0),
                writer=lambda *args:writes.append(args[:4]),cache_dir=directory,
                reader=lambda *args:dict(readings=[dict(field='model',value=model,status='Success'),dict(field='firmware',value='V0.0.2',status='Success')]))
            bridge.verify_delay=0;bridge.state.update(selectedAddress=address,verified=True,dataStale=False,metadata=dict(model=model,firmware='V0.0.3'))
            bridge.prepare_local(dict(filename=model+'_V0.0.2.bin',content=base64.b64encode(data).decode(),sha256=hashlib.sha256(data).hexdigest(),version=''))
            until=time.monotonic()+2
            while bridge.state['upgrade']['state']=='checking' and time.monotonic()<until:time.sleep(.005)
            self.assertTrue(bridge.state['upgrade']['transferAvailable']);self.assertEqual(writes,[])
            bridge.start_transfer(dict(confirmed=True,address=address,sha256=hashlib.sha256(data).hexdigest()));self.wait_read(bridge)
            self.assertEqual(len(writes),1);self.assertEqual(bridge.state['upgrade']['state'],'installed');self.assertEqual(bridge.state['metadata']['firmware'],'V0.0.2')

    def test_same_version_local_reinstall_is_allowed_without_false_installation_confirmation(self):
        model=mod.SUPPORTED_OTA_MODEL;address='AABBCCDDEEFF'
        bridge=mod.Bridge(reader=lambda *args:dict(readings=[dict(field='model',value=model,status='Success'),dict(field='firmware',value='V0.0.3',status='Success')]),writer=lambda *args:None)
        bridge.verify_delay=0;bridge.state.update(selectedAddress=address,verified=True,dataStale=False,metadata=dict(model=model,firmware='V0.0.3'))
        bridge.state['upgrade']=dict(state='package-verified',transferAvailable=True,address=address,installed='V0.0.3',package=dict(source='local',version='0.0.3',bytes=100,sha256='a'*64))
        bridge.start_transfer(dict(confirmed=True,address=address,sha256='a'*64));self.wait_read(bridge)
        self.assertEqual(bridge.state['upgrade']['state'],'transfer-complete');self.assertIn('cannot be independently confirmed',bridge.state['upgrade']['message'])

    def test_unknown_local_target_version_returns_actual_readback_without_false_success(self):
        model=mod.SUPPORTED_OTA_MODEL;address='AABBCCDDEEFF'
        bridge=mod.Bridge(reader=lambda *args:dict(readings=[dict(field='model',value=model,status='Success'),dict(field='firmware',value='V0.0.1',status='Success')]),writer=lambda *args:None)
        bridge.verify_delay=0;bridge.state.update(selectedAddress=address,verified=True,dataStale=False,metadata=dict(model=model,firmware='V0.0.3'))
        bridge.state['upgrade']=dict(state='package-verified',transferAvailable=True,address=address,installed='V0.0.3',package=dict(source='local',version='',bytes=100,sha256='a'*64))
        bridge.start_transfer(dict(confirmed=True,address=address,sha256='a'*64));self.wait_read(bridge)
        self.assertEqual(bridge.state['upgrade']['state'],'transfer-complete');self.assertIn('V0.0.1',bridge.state['upgrade']['message']);self.assertEqual(bridge.state['metadata']['firmware'],'V0.0.1')

    def test_local_api_accepts_a_bin_larger_than_the_normal_command_limit(self):
        model=mod.SUPPORTED_OTA_MODEL;data=bytes(range(256))*32
        with tempfile.TemporaryDirectory() as directory:
            bridge=mod.Bridge(prober=lambda *args:dict(state='probe-ok'),cache_dir=directory)
            bridge.state.update(selectedAddress='AABBCCDDEEFF',verified=True,dataStale=False,metadata=dict(model=model,firmware='V0.0.3'))
            server=mod.make_server(bridge,'local-test-token');threading.Thread(target=server.serve_forever,daemon=True).start()
            base='http://127.0.0.1:'+str(server.server_port)
            body=json.dumps(dict(filename=model+'_V0.0.2.bin',content=base64.b64encode(data).decode(),sha256=hashlib.sha256(data).hexdigest())).encode()
            try:
                with urlopen(Request(base+'/api/upgrade/local',data=body,headers={'Authorization':'Bearer local-test-token','Content-Type':'application/json'})) as response:self.assertEqual(response.status,200)
                until=time.monotonic()+2
                while bridge.state['upgrade']['state']=='checking' and time.monotonic()<until:time.sleep(.005)
                self.assertEqual(bridge.state['upgrade']['package']['bytes'],8192);self.assertTrue(bridge.state['upgrade']['transferAvailable'])
            finally:server.shutdown();server.server_close()


if __name__ == '__main__':
    unittest.main()
