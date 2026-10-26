"""Package the public web demo; the APK serves its authenticated local copy."""
from pathlib import Path
import re
import hashlib
import base64
import zipfile
import json

root = Path(__file__).resolve().parents[1]
version = json.loads((root / 'docs/version.json').read_text(encoding='utf-8'))['version']
out = root / 'build'
out.mkdir(exist_ok=True)
html = (root / 'docs/index.html').read_text(encoding='utf-8')
css = (root / 'docs/style.css').read_text(encoding='utf-8')
hashes = []

def digest(value):
    return "'sha256-" + base64.b64encode(hashlib.sha256(value.encode('utf-8')).digest()).decode() + "'"

html = re.sub(r'<link rel="stylesheet" href="style.css[^\"]*">', lambda _: '<style>' + css + '</style>', html)

def inline(match):
    code = (root / 'docs' / match.group(1)).read_text(encoding='utf-8')
    assert '</script' not in code.lower()
    hashes.append(digest(code))
    return '<script>' + code + '</script>'

html = re.sub(r'<script src="([^?\"]+)(?:\?[^\"]*)?"></script>', inline, html)
csp = "default-src 'self'; style-src " + digest(css) + "; script-src " + ' '.join(hashes) + "; connect-src 'self' https://firmware.umc-poland.com; img-src 'self' blob:; object-src 'none'; frame-src 'none'"
html = re.sub(r'(<meta http-equiv="Content-Security-Policy" content=")[^\"]*', lambda match: match.group(1) + csp, html)
standalone = out / f'RC-OTA-{version}.html'
standalone.write_text(html, encoding='utf-8', newline='\n')
readme = f'''RC OTA HTML {version}
This archive contains the public download page and read-only browser diagnostics.
Firmware installation requires the separate Windows app. The Android 0.7.0 release remains a separate diagnostics bridge.
Standalone HTML / HTTPS hosting uses Web Bluetooth; it does not install a native bridge or flash a remote.
'''
archive = out / f'RC-OTA-HTML-{version}.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as output:
    output.write(standalone, standalone.name)
    output.writestr('README.txt', readme)
    for name in ['index.html', 'style.css', 'customer-ui.js', 'local-bridge.js', 'app.js', 'ota.js', 'ota-client.js', 'version.json']:
        output.write(root / 'docs' / name, 'web/' + name)
with zipfile.ZipFile(archive) as output:
    assert output.testzip() is None
assert len(hashes) == 5 and '<script src=' not in html
print('HTML and ZIP verified:', version)
