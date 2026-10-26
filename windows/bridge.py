"""Loopback-only RC OTA bridge; writes require a verified package and explicit transfer confirmation."""
from __future__ import annotations

import argparse
import copy
import hmac
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
import threading
import time
import struct
import base64
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import quote, unquote, urlsplit
from urllib.error import HTTPError, URLError
from urllib.request import Request, build_opener, HTTPRedirectHandler

ROOT = Path(__file__).resolve().parent.parent
HOST = 'firmware.umc-poland.com'
VERSION = '0.10.0-experimental'
SUPPORTED_OTA_MODEL = 'AN2101A-20UM021-001'


def telink_crc(data):
    crc = 0xffff
    for byte in data:
        crc ^= byte
        for _ in range(8):
            crc = (crc >> 1) ^ (0xa001 if crc & 1 else 0)
    return crc


def telink_packet(firmware, index):
    if not 0 <= index < (len(firmware) + 15) // 16 or index > 65535:
        raise ValueError('Invalid Telink packet index.')
    body = struct.pack('<H', index) + firmware[index*16:(index+1)*16].ljust(16, b'\xff')
    return body + struct.pack('<H', telink_crc(body))


def telink_end(last_index):
    body = struct.pack('<HHH', 0xff02, last_index, (~last_index) & 0xffff)
    return body + struct.pack('<H', telink_crc(body))


def telink_command(action, address, model, package=None, installed=''):
    command = ['powershell.exe', '-NoProfile', '-NonInteractive', '-File',
               str(ROOT / 'windows/telink-transport.ps1'), '-Action', action,
               '-Address', address, '-ExpectedModel', model]
    if installed:
        command += ['-ExpectedCurrentFirmware', installed]
    if package:
        command += ['-FirmwarePath', str(ROOT / 'windows/.runtime/firmware' / (package['sha256'] + '.bin')),
                    '-ExpectedSha256', package['sha256'], '-ExpectedMd5', package['md5']]
    return command


def probe_telink(address, model, installed):
    result = subprocess.run(telink_command('probe', address, model, installed=installed), capture_output=True,
                            encoding='utf-8-sig', errors='replace', timeout=100,
                            creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    try:
        report = json.loads(result.stdout.strip())
    except ValueError:
        raise RuntimeError('Windows OTA probe failed: ' + result.stderr.strip()[-400:])
    if result.returncode or report.get('state') != 'probe-ok':
        raise RuntimeError(report.get('message', 'Windows OTA probe failed.'))
    return report


def write_telink(address, model, installed, package, on_progress):
    # Invoked only by the explicit, confirmed transfer endpoint, never by reads or preparation.
    process = subprocess.Popen(telink_command('flash', address, model, package, installed), stdout=subprocess.PIPE,
                               stderr=subprocess.PIPE, encoding='utf-8-sig', errors='replace',
                               creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    watchdog = threading.Timer(360, process.kill)
    watchdog.start()
    last = {}
    try:
        for line in process.stdout:
            try:
                event = json.loads(line)
            except ValueError:
                continue
            last = event
            on_progress(event)
        process.wait(timeout=5)
        if process.returncode or last.get('state') != 'transfer-sent':
            raise RuntimeError(last.get('message') or 'OTA transfer ended without confirmation.')
    finally:
        watchdog.cancel()
        if process.poll() is None:
            process.kill()
            process.wait(timeout=5)
        process.stdout.close()
        process.stderr.close()


def revision_number(value):
    normalized = re.sub(r'[FWVv.]', '', str(value))
    return int(normalized) if normalized.isdigit() else None


def local_package(filename, content, sha256, model, version, cache_dir):
    if (not isinstance(filename, str) or not filename.lower().endswith('.bin') or
            len(filename) > 180 or any(c in filename for c in '/\\\x00') or
            any(ord(c) < 32 for c in filename)):
        raise ValueError('Choose a BIN filename without a directory path.')
    if not isinstance(content, str) or len(content) > 1398104:
        raise ValueError('Local firmware must be between 16 bytes and 1 MiB.')
    try:
        body = base64.b64decode(content, validate=True)
    except (ValueError, TypeError):
        raise ValueError('The local file upload is not valid base64.')
    if not 16 <= len(body) <= 1048576:
        raise ValueError('Local firmware must be between 16 bytes and 1 MiB for Telink OTA.')
    if not isinstance(sha256, str) or not re.fullmatch(r'[a-fA-F0-9]{64}', sha256):
        raise ValueError('The selected file SHA-256 is required.')
    actual = hashlib.sha256(body).hexdigest()
    if not hmac.compare_digest(actual, sha256.lower()):
        raise ValueError('The local file changed during upload. Select it again.')
    if not isinstance(version, str) or (version and not re.fullmatch(r'[vV]?\d+(?:\.\d+)*', version)) or len(version) > 40:
        raise ValueError('Enter a numeric target version, such as V0.0.2, or leave it blank.')
    named = re.fullmatch(r'(.+)_[vV](\d+(?:\.\d+)*)\.bin', filename, flags=re.IGNORECASE)
    if named:
        if named[1].casefold() != model.casefold():
            raise ValueError('The BIN filename identifies a different remote model: '+named[1])
        if version and revision_number(version) != revision_number(named[2]):
            raise ValueError('The entered target version disagrees with the BIN filename.')
        version = version or named[2]
    cache_dir = Path(cache_dir)
    cache_dir.mkdir(parents=True, exist_ok=True)
    (cache_dir / (actual + '.bin')).write_bytes(body)
    return dict(source='local', filename=filename, model=model, version=version, bytes=len(body),
                sha256=actual, sha256Verified=True, md5=hashlib.md5(body).hexdigest(), md5Verified=False)


def native(action, address=''):
    command = ['powershell.exe', '-NoProfile', '-NonInteractive', '-File',
               str(ROOT / 'windows/read-remote.ps1'), '-Action', action]
    if address:
        command += ['-Address', address]
    result = subprocess.run(command, capture_output=True, encoding='utf-8-sig',
                            errors='replace', timeout=100, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    if result.returncode:
        raise RuntimeError('Windows Bluetooth reader failed: ' + result.stderr.strip()[-600:])
    data = json.loads(result.stdout)
    if data.get('error') and not any(item.get('status') == 'Success' and 'value' in item for item in data.get('readings', [])):
        raise RuntimeError(data['error'])
    return data


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        # The bridge never follows a server-provided URL to another host or HTTP.
        return None


def manufacturer_url(url, extension=None):
    parts = urlsplit(url)
    if (parts.scheme not in ('http', 'https') or parts.hostname != HOST or
            parts.port or parts.username or parts.password or parts.fragment or
            (extension and not parts.path.lower().endswith(extension))):
        raise ValueError('Unexpected manufacturer URL.')
    return parts._replace(scheme='https').geturl()


def request_metadata(url, method='GET'):
    url = manufacturer_url(url)
    with build_opener(NoRedirect).open(Request(url, method=method), timeout=12) as response:
        if method == 'HEAD':
            return 'text/html' not in response.headers.get('Content-Type', ''), response.status
        body = response.read(65537)
        if len(body) > 65536:
            raise ValueError('Manufacturer metadata is too large.')
        return body.decode('utf-8-sig')


def ota_check(model):
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_. -]{0,79}', model):
        raise ValueError('An exact model number is required.')
    fields = request_metadata('https://' + HOST + '/' + quote(model, safe='') + '/').split()
    if len(fields) != 2:
        raise ValueError('Manufacturer did not return a binary and metadata listing.')
    binary = manufacturer_url(fields[0], '.bin')
    metadata_url = manufacturer_url(fields[1], '.txt')
    values = {}
    for line in request_metadata(metadata_url).strip().splitlines():
        key, sep, value = line.partition(':')
        key = key.strip()
        if not sep or key not in ('name', 'version', 'md5sum', 'scenario', 'mac') or key in values:
            raise ValueError('Unexpected manufacturer metadata.')
        values[key] = value.strip()
    if not values.get('name') or not values.get('version') or not re.fullmatch(r'[A-Fa-f0-9]{32}', values.get('md5sum', '')):
        raise ValueError('Manufacturer metadata is incomplete.')
    values.update(firmwareUrl=binary, metadataUrl=metadata_url)
    try:
        available, status = request_metadata(binary, 'HEAD')
        values.update(binaryAvailable=available, binaryStatus='HTTP ' + str(status) + '; HEAD only')
    except HTTPError as error:
        values.update(binaryAvailable=False if error.code in (404, 410) else None, binaryStatus='HTTP ' + str(error.code) + '; HEAD only')
        error.close()
    except Exception as error:
        values.update(binaryAvailable=None, binaryStatus=str(error))
    return values


def verify_package(model, info, cache_dir):
    """Download an exact catalogue package, verify its bytes, and never write BLE."""
    url = manufacturer_url(info['firmwareUrl'], '.bin')
    parts = urlsplit(url)
    folder, _, filename = unquote(parts.path).rpartition('/')
    if folder != '/' + model or filename != info['name']:
        raise ValueError('Catalogue BIN URL and ota_info.txt filename do not match exactly: "'+filename+'" versus "'+str(info.get('name',''))+'". Synchronize the complete filenames in index.html and ota_info.txt.')
    expected = info.get('md5sum', '')
    if not re.fullmatch(r'[0-9a-fA-F]{32}', expected):
        raise ValueError('A valid server MD5 is required before package preparation.')
    limit = 16 * 1024 * 1024
    with build_opener(NoRedirect).open(Request(url, headers={'Cache-Control': 'no-cache'}), timeout=15) as response:
        if response.status != 200 or 'text/html' in response.headers.get('Content-Type', ''):
            raise ValueError('The server did not return a complete binary file.')
        declared = response.headers.get('Content-Length')
        if declared and (not declared.isdigit() or not 0 < int(declared) <= limit):
            raise ValueError('Firmware size is invalid or larger than 16 MiB.')
        body = response.read(limit + 1)
        if not body or len(body) > limit or (declared and len(body) != int(declared)):
            raise ValueError('Firmware download is empty, incomplete or too large.')
    actual = hashlib.md5(body).hexdigest()
    if not hmac.compare_digest(actual, expected.lower()):
        raise ValueError('Firmware MD5 does not match ota_info.txt. The package cannot be prepared.')
    sha = hashlib.sha256(body).hexdigest()
    cache_dir = Path(cache_dir)
    cache_dir.mkdir(parents=True, exist_ok=True)
    # Content-addressed names avoid using server-provided paths for local writes.
    (cache_dir / (sha + '.bin')).write_bytes(body)
    return dict(filename=filename, bytes=len(body), md5=actual, sha256=sha, url=url,
                version=info['version'], model=model, md5Verified=True)


class Bridge:
    def __init__(self, reader=native, checker=ota_check, verifier=verify_package, prober=probe_telink, writer=write_telink, cache_dir=None):
        self.reader, self.checker = reader, checker
        self.verifier = verifier
        self.prober, self.writer = prober, writer
        self.firmware_cache = Path(cache_dir) if cache_dir is not None else ROOT / 'windows/.runtime/firmware'
        self.transfer_busy = False
        self.verify_delay = 3
        self.lock = threading.RLock()
        self.generation = 0
        self.upgrade_generation = 0
        self.active = False
        self.busy = False
        self.closed = threading.Event()
        self.state = dict(version=VERSION, platform='Windows', transport='Local Windows BLE Bridge',
                          serviceRunning=True, connectPermission=True, bluetoothAvailable=True,
                          bluetoothEnabled=True, stage='idle', devices=[], selectedAddress='',
                          bondState='unknown', gattConnected=False, verified=False, metadata={},
                          readAt=0, dataStale=True, services=[], trace=[], ota={}, upgrade={}, message='Reading paired SHARP remotes…')

    def snapshot(self):
        with self.lock:
            return copy.deepcopy(dict(self.state, autoRead=self.active, workerBusy=self.busy, transferBusy=self.transfer_busy))

    def log(self, message):
        self.state['message'] = message
        self.state['trace'] = (self.state['trace'] + [dict(timeMillis=int(time.time() * 1000), message=message)])[-200:]

    def refresh(self, auto=False):
        try:
            devices = self.reader('list')['devices']
            with self.lock:
                self.state.update(devices=devices, connectPermission=True)
                selected = self.state['selectedAddress']
                if not selected and len(devices) == 1:
                    selected = devices[0]['address']
                    self.state['selectedAddress'] = selected
                self.log('Windows found ' + str(len(devices)) + ' paired SHARP remote(s).')
            if auto and selected and any(d['address'] == selected for d in devices):
                self.connect(selected)
        except Exception as error:
            with self.lock:
                self.state.update(stage='error', connectPermission=False)
                self.log(str(error))

    def connect(self, address):
        with self.lock:
            if self.busy:
                raise ValueError('A read is already running. Wait for completion.')
            if address not in [d['address'] for d in self.state['devices']]:
                raise ValueError('Choose a supported remote already paired in Windows.')
            if address != self.state['selectedAddress']:
                self.state.update(metadata={}, services=[], readAt=0, ota={}, upgrade={}, fieldReadAt={}, staleFields=[])
                self.upgrade_generation += 1
            self.generation += 1
            generation = self.generation
            self.active = self.busy = True
            self.state.update(selectedAddress=address, bondState='bonded', stage='reading', verified=False, dataStale=True)
            self.log('Reading live parameters through Windows. Existing values remain marked as historical until read.')
        threading.Thread(target=self._read, args=(address, generation), daemon=True).start()

    def _read(self, address, generation):
        try:
            report = self.reader('read', address)
            values = {}
            times = {}
            now = int(time.time() * 1000)
            for item in report.get('readings', []):
                if item.get('status') != 'Success' or item.get('error') or 'value' not in item:
                    continue
                key = 'level' if item['field'] == 'battery' else item['field']
                value = item['value']
                if key == 'level' and (not isinstance(value, int) or isinstance(value, bool) or not 0 <= value <= 100):
                    continue
                if isinstance(value, str) and not value:
                    continue
                values[key] = value
                times[key] = now
            if not report.get('paired') or not values:
                raise RuntimeError('No valid live parameters were read from the paired remote. Wake it and retry.')
            with self.lock:
                if generation != self.generation or self.closed.is_set():
                    return
                retained = self.state['metadata']
                retained.update(values, name=report['name'], address=':'.join(address[i:i+2] for i in range(0, 12, 2)))
                previous_times = self.state.get('fieldReadAt', {})
                previous_times.update(times)
                stale = [key for key in retained if key not in ('name', 'address') and key not in values]
                details = {s['uuid']: s for s in report.get('serviceDetails', [])}
                services = [details.get(uuid, dict(uuid=uuid, characteristics=[])) for uuid in report.get('services', [])]
                self.state.update(stage='verified', verified=True, gattConnected=False, readAt=now,
                                  dataStale=False, staleFields=stale, fieldReadAt=previous_times,
                                  services=services, lastReadReport=report)
                self.log('Windows live read verified. Native read session closed; values refresh every 30 seconds while enabled.')
                for item in report.get('readings', []):
                    if item.get('error') or item.get('status') != 'Success':
                        self.log(item['field'] + ' unavailable: ' + str(item.get('error') or item.get('status')))
                model = values.get('model')
                if model and self.state['ota'].get('model') != model:
                    self.start_ota(model, automatic=True)
        except Exception as error:
            with self.lock:
                if generation == self.generation:
                    self.state.update(stage='error', verified=False, dataStale=True, gattConnected=False)
                    self.log('Read failed; previous values are historical. ' + str(error))
        finally:
            with self.lock:
                self.busy = False

    def disconnect(self):
        with self.lock:
            if self.transfer_busy:
                raise ValueError('A firmware transfer is in progress. Wait for its result before stopping the bridge.')
            self.generation += 1
            self.upgrade_generation += 1
            self.active = False
            self.state.update(stage='disconnected', verified=False, gattConnected=False, dataStale=True)
            if self.state['ota'].get('state') == 'checking':
                self.state['ota']['state'] = 'cancelled'
            if self.state['upgrade']:
                self.state['upgrade'] = dict(state='cancelled', message='Reads stopped. Prepare again after a verified remote read.', transferAvailable=False)
            self.log('Automatic reads stopped. Last values retained. Windows system pairing is unchanged.')

    def start_ota(self, model, automatic=False):
        with self.lock:
            if self.state['ota'].get('state') == 'checking':
                if automatic:
                    return
                raise ValueError('A server check is already running.')
            generation = self.generation
            self.state['ota'] = dict(state='checking', model=model)
        def check():
            try:
                result = dict(state='complete', model=model, checkedAt=int(time.time()*1000), value=self.checker(model))
            except Exception as error:
                result = dict(state='error', model=model, error='Server version is unknown: ' + str(error))
            with self.lock:
                if generation == self.generation and not self.closed.is_set():
                    self.state['ota'] = result
        threading.Thread(target=check, daemon=True).start()

    def prepare_upgrade(self):
        with self.lock:
            state = self.state
            if self.busy or not state['verified'] or state['dataStale']:
                raise ValueError('Read the remote successfully before preparing Firmware Upgrade.')
            if state['upgrade'].get('state') == 'checking':
                raise ValueError('Firmware preparation is already running.')
            model = state['metadata'].get('model', '')
            if not model or 'model' in state.get('staleFields', []):
                raise ValueError('A live exact model number is required.')
            generation = self.upgrade_generation
            address = state['selectedAddress']
            installed = state['metadata'].get('firmware', '')
            state['upgrade'] = dict(state='checking', message='Checking the package, MD5 and remote OTA service…', transferAvailable=False)

        def prepare():
            try:
                info = self.checker(model)
                package = self.verifier(model, info, self.firmware_cache)
                package['source'] = 'server'
                info.update(binaryAvailable=True, binaryStatus='HTTP 200; complete package downloaded; MD5 verified')
                blocker = self.transfer_blocker(model, installed, package)
                if info.get('mac'):
                    blocker = 'The server lists a MAC restriction; Windows transfer requires confirmed compatibility with that restriction.'
                probe = {}
                if not blocker:
                    try:
                        probe = self.prober(address, model, installed)
                    except Exception as error:
                        blocker = str(error)
                result = dict(state='package-verified', package=package, address=address, installed=installed,
                              probe=probe, transferAvailable=not blocker,
                              message='Package verified. '+(blocker if blocker else 'Review the experimental OTA transfer details, then confirm installation.')+' Nothing was installed.')
            except Exception as error:
                result = dict(state='error', message=str(error), transferAvailable=False)
            with self.lock:
                if generation == self.upgrade_generation and not self.closed.is_set():
                    self.state['upgrade'] = result
                    if 'info' in locals():
                        self.state['ota'] = dict(state='complete', model=model, checkedAt=int(time.time()*1000), value=info)
        threading.Thread(target=prepare, daemon=True).start()

    def prepare_local(self, upload):
        with self.lock:
            state = self.state
            if self.busy or not state['verified'] or state['dataStale']:
                raise ValueError('Read the remote successfully before preparing a local firmware file.')
            if state['upgrade'].get('state') == 'checking':
                raise ValueError('Firmware preparation is already running.')
            model = state['metadata'].get('model', '')
            if not model or 'model' in state.get('staleFields', []):
                raise ValueError('A live exact model number is required.')
            package = local_package(upload.get('filename'), upload.get('content'), upload.get('sha256'),
                                    model, upload.get('version', '').strip() if isinstance(upload.get('version', ''), str) else None,
                                    self.firmware_cache)
            generation, address = self.upgrade_generation, state['selectedAddress']
            installed = state['metadata'].get('firmware', '')
            state['upgrade'] = dict(state='checking', message='Local BIN received unchanged. Checking the remote OTA service; no server lookup is required.', transferAvailable=False)

        def prepare():
            blocker = self.transfer_blocker(model, installed, package)
            probe = {}
            if not blocker:
                try:
                    probe = self.prober(address, model, installed)
                except Exception as error:
                    blocker = str(error)
            result = dict(state='package-verified', package=package, address=address, installed=installed,
                          probe=probe, transferAvailable=not blocker,
                          message='Local file verified by SHA-256. '+(blocker if blocker else 'Upgrade, downgrade and same-version installation are allowed. Review and confirm the selected BIN.')+' Nothing was installed.')
            with self.lock:
                if generation == self.upgrade_generation and not self.closed.is_set():
                    self.state['upgrade'] = result
        threading.Thread(target=prepare, daemon=True).start()

    @staticmethod
    def transfer_blocker(model, installed, package):
        if model != SUPPORTED_OTA_MODEL:
            return 'Windows OTA transfer is not enabled for this model.'
        if package.get('source') != 'local':
            current, available = revision_number(installed), revision_number(package.get('version', ''))
            if current is None or available is None:
                return 'Firmware versions could not be compared.'
            if available <= current:
                return 'The server version is the same as, or older than, the installed firmware. No upgrade is needed.'
        if not 16 <= package.get('bytes', 0) <= 1048576:
            return 'Firmware size is not supported by this Telink OTA packet format.'
        return ''

    def start_transfer(self, confirmation):
        with self.lock:
            state, upgrade = self.state, self.state['upgrade']
            package = upgrade.get('package', {})
            if (confirmation.get('confirmed') is not True or
                    confirmation.get('address') != state['selectedAddress'] or
                    confirmation.get('sha256') != package.get('sha256')):
                raise ValueError('Confirm the exact selected remote and verified package before installation.')
            if self.busy or self.transfer_busy or upgrade.get('state') != 'package-verified' or not upgrade.get('transferAvailable'):
                raise ValueError('Prepare an eligible verified package before starting transfer.')
            model = state['metadata'].get('model', '')
            installed = state['metadata'].get('firmware', '')
            blocker = self.transfer_blocker(model, installed, package)
            if blocker or not state['verified'] or state['dataStale'] or upgrade.get('address') != state['selectedAddress'] or upgrade.get('installed') != installed:
                raise ValueError(blocker or 'Remote data changed. Read and prepare the upgrade again.')
            address = state['selectedAddress']
            self.active = False
            self.busy = self.transfer_busy = True
            upgrade.update(state='starting', progress=0, message='Starting the confirmed experimental Telink OTA transfer.', transferAvailable=False)

        def transfer():
            failure = None
            def progress(event):
                with self.lock:
                    upgrade.update(state=event.get('state', 'transferring'), progress=event.get('progress', upgrade.get('progress', 0)),
                                   message=event.get('message', 'Transferring firmware to the remote…'))
            try:
                self.writer(address, model, installed, package, progress)
            except Exception as error:
                failure = str(error)
            # Sending the final frame is not proof of an installed firmware version.
            with self.lock:
                upgrade.update(state='verifying-installation', message='Reconnecting and checking the installed firmware version…')
            confirmed = False
            readback = None
            target_number = revision_number(package.get('version', ''))
            previous_number = revision_number(installed)
            for _ in range(3):
                if self.verify_delay:
                    time.sleep(self.verify_delay)
                try:
                    report = self.reader('read', address)
                    values = {item['field']:item['value'] for item in report.get('readings', []) if item.get('status') == 'Success' and 'value' in item and not item.get('error')}
                    actual_number = revision_number(values.get('firmware', ''))
                    target_matches = actual_number is not None and target_number is not None and actual_number == target_number
                    local_readback = package.get('source') == 'local' and not failure and (target_number is None or (target_number == previous_number and target_matches))
                    if values.get('model') == model and values.get('firmware') and (target_matches or local_readback):
                        confirmed = target_matches and target_number != previous_number
                        readback = values['firmware']
                        with self.lock:
                            self.state['metadata'].update(firmware=values['firmware'])
                            for key in ('software','hardware','manufacturer'):
                                if key in values:self.state['metadata'][key]=values[key]
                            if 'battery' in values:self.state['metadata']['level']=values['battery']
                            self.state.update(readAt=int(time.time()*1000), dataStale=False, verified=True, stage='verified')
                        break
                except Exception:
                    continue
            with self.lock:
                if confirmed:
                    upgrade.update(state='installed', progress=100, message='Installed firmware '+package['version']+' confirmed by a live read from the same remote.')
                elif readback and not failure and package.get('source') == 'local':
                    upgrade.update(state='transfer-complete', progress=100, message='Local BIN transfer completed. The remote reports '+readback+'. '+('The version is unchanged, so image identity cannot be independently confirmed by a version read.' if target_number == previous_number else 'No target version was supplied; exact installation cannot be independently confirmed.'))
                else:
                    upgrade.update(state='installation-unconfirmed', message='Installation could not be confirmed. '+(failure or 'Read the remote again before deciding whether to retry.'))
                    self.state.update(verified=False, dataStale=True)
                self.busy = self.transfer_busy = False
        threading.Thread(target=transfer, daemon=True).start()

    def start(self):
        def loop():
            self.refresh(auto=True)
            while not self.closed.wait(30):
                with self.lock:
                    address = self.state['selectedAddress'] if self.active and not self.busy else ''
                if address:
                    try:
                        self.connect(address)
                    except ValueError:
                        pass
        threading.Thread(target=loop, daemon=True).start()


def make_server(bridge, token, port=0):
    class Handler(BaseHTTPRequestHandler):
        protocol_version = 'HTTP/1.1'

        def log_message(self, *_):
            pass  # Do not log session credentials or URLs.

        def setup(self):
            super().setup()
            self.connection.settimeout(5)

        def reply(self, status, data, mime='application/json; charset=utf-8'):
            body = data if isinstance(data, bytes) else json.dumps(data).encode()
            self.send_response(status)
            for key, value in {'Content-Type': mime, 'Content-Length': str(len(body)), 'Connection': 'close',
                               'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer',
                               'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY',
                               'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"}.items():
                self.send_header(key, value)
            self.end_headers()
            self.wfile.write(body)
            self.close_connection = True

        def handle_request(self):
            expected_host = '127.0.0.1:' + str(self.server.server_port)
            origin = self.headers.get('Origin')
            if (self.headers.get('Host') != expected_host or
                    origin not in (None, 'http://' + expected_host) or
                    self.headers.get('Sec-Fetch-Site') == 'cross-site'):
                return self.reply(403, dict(error='Only this local application may access the bridge.'))
            if any(len(self.headers.get_all(key, [])) > 1 for key in ('Host', 'Authorization', 'Content-Length', 'Origin')):
                return self.reply(400, dict(error='Duplicate request headers.'))
            path = urlsplit(self.path).path
            if path.startswith('/api/'):
                supplied = self.headers.get('Authorization', '').encode()
                if not hmac.compare_digest(supplied, ('Bearer ' + token).encode()):
                    return self.reply(401, dict(error='Open RC OTA using the Windows launcher to authorize this tab.'))
                if self.command == 'GET' and path == '/api/state':
                    return self.reply(200, bridge.snapshot())
                if self.command != 'POST':
                    return self.reply(405, dict(error='Use POST for bridge commands.'))
                if self.headers.get('Transfer-Encoding') or self.headers.get_content_type() != 'application/json':
                    return self.reply(415, dict(error='A JSON request is required.'))
                try:
                    length = int(self.headers.get('Content-Length', '-1'))
                    limit = 1406296 if path == '/api/upgrade/local' else 4096
                    if not 0 <= length <= limit:
                        raise ValueError('Invalid request size.')
                    body = json.loads(self.rfile.read(length))
                    if not isinstance(body, dict):
                        raise ValueError('A JSON object is required.')
                    if path == '/api/connect':
                        bridge.connect(body.get('address', ''))
                    elif path == '/api/disconnect':
                        bridge.disconnect()
                    elif path == '/api/refresh':
                        threading.Thread(target=bridge.refresh, daemon=True).start()
                    elif path == '/api/ota':
                        model = body.get('model', '')
                        if not isinstance(model, str) or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_. -]{0,79}', model):
                            raise ValueError('An exact model number is required.')
                        bridge.start_ota(model)
                    elif path == '/api/upgrade/prepare':
                        bridge.prepare_upgrade()
                    elif path == '/api/upgrade/local':
                        bridge.prepare_local(body)
                    elif path == '/api/upgrade/start':
                        bridge.start_transfer(body)
                    elif path == '/api/stop':
                        bridge.disconnect()
                        bridge.closed.set()
                        self.reply(200, bridge.snapshot())
                        threading.Thread(target=self.server.shutdown, daemon=True).start()
                        return
                    else:
                        return self.reply(404, dict(error='Unknown bridge command.'))
                except (ValueError, TypeError) as error:
                    return self.reply(400, dict(error=str(error)))
                return self.reply(200, bridge.snapshot())
            if self.command != 'GET':
                return self.reply(405, dict(error='Method not allowed.'))
            assets = {'/': ('docs/local/index.html', 'text/html; charset=utf-8'),
                      '/local.js': ('docs/local/app.js', 'text/javascript; charset=utf-8'),
                      '/local.css': ('docs/local/style.css', 'text/css; charset=utf-8'),
                      '/ota.js': ('docs/ota.js', 'text/javascript; charset=utf-8')}
            if path not in assets:
                return self.reply(404, dict(error='Not found.'))
            file, mime = assets[path]
            data = (ROOT / file).read_bytes()
            if path == '/':
                html = data.decode().replace('0.7.0', VERSION).replace('Android', 'Windows')
                html = html.replace('Pair your remote in Windows Bluetooth settings, then keep it awake while connecting. The RC OTA bridge continues running while you use Chrome. Stop it from the RC OTA app or its notification.',
                                    'Reads your paired SHARP remote through Windows while this interface runs in Chrome. Values refresh every 30 seconds. No firmware is written.')
                html = html.replace('id="disconnect" disabled>Disconnect', 'id="disconnect" disabled>Stop automatic reads')
                html = html.replace('<button id="refresh">Refresh list</button>', '<button id="refresh">Refresh paired list</button><button id="stopBridge">Stop Windows bridge</button>')
                data = html.encode()
            self.reply(200, data, mime)

        do_GET = handle_request
        do_POST = handle_request

    return ThreadingHTTPServer(('127.0.0.1', port), Handler)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--open-browser', action='store_true')
    parser.add_argument('--port', type=int, default=0)
    args = parser.parse_args()
    runtime = ROOT / 'windows/.runtime'
    existing_url = None
    try:
        saved = json.loads((runtime / 'session.json').read_text(encoding='utf-8'))
        candidate = saved['url']
        if re.fullmatch(r'http://127\.0\.0\.1:[0-9]+/#token=[A-Za-z0-9_-]+', candidate):
            token = urlsplit(candidate).fragment.removeprefix('token=')
            request = Request(candidate.split('#')[0] + 'api/state', headers={'Authorization': 'Bearer ' + token})
            with build_opener().open(request, timeout=1) as response:
                running = json.load(response)
            if running.get('transport') == 'Local Windows BLE Bridge':
                if running.get('version') == VERSION:
                    existing_url = candidate
                elif running.get('transferBusy'):
                    raise RuntimeError('Wait for the running firmware transfer to finish before updating RC OTA.')
                else:
                    stop = Request(candidate.split('#')[0]+'api/stop', data=b'{}',
                                   headers={'Authorization':'Bearer '+token,'Content-Type':'application/json'})
                    with build_opener().open(stop, timeout=2):
                        pass
    except (OSError, ValueError, KeyError, URLError):
        pass
    if existing_url:
        if args.open_browser:
            open_browser(existing_url)
        return
    bridge = Bridge()
    token = secrets.token_urlsafe(32)
    server = make_server(bridge, token, args.port)
    runtime.mkdir(exist_ok=True)
    url = 'http://127.0.0.1:' + str(server.server_port) + '/#token=' + token
    # Fragment credentials never reach the HTTP request URL or remote servers.
    (runtime / 'session.json').write_text(json.dumps(dict(url=url, port=server.server_port, pid=os.getpid())), encoding='utf-8')
    bridge.start()
    if args.open_browser:
        open_browser(url)
    try:
        server.serve_forever(poll_interval=.25)
    except KeyboardInterrupt:
        pass
    finally:
        bridge.closed.set()
        server.server_close()


def open_browser(url):
    candidates = [Path(os.environ.get(key, '')) / 'Google/Chrome/Application/chrome.exe' for key in ('PROGRAMFILES', 'PROGRAMFILES(X86)', 'LOCALAPPDATA')]
    chrome = next((str(path) for path in candidates if path.is_file()), None)
    if chrome:
        subprocess.Popen([chrome, url])
    else:
        import webbrowser
        webbrowser.open(url)


if __name__ == '__main__':
    main()
