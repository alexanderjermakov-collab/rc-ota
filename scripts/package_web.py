"""Package the public web demo; the APK serves its authenticated local copy."""
from pathlib import Path
import re
import hashlib
import base64
import zipfile

root = Path(__file__).resolve().parents[1]
version = re.search(r'android:versionName="([^"]+)"', (root / 'android/AndroidManifest.xml').read_text(encoding='utf-8')).group(1)
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
For native paired-remote access: install RC-OTA-{version}.apk, launch RC OTA, Start bridge and open Chrome. The APK serves HTML and a token-protected API at http://127.0.0.1:18764/. On a TV without Chrome use Open TV browser (TV Bro).
Standalone HTML / HTTPS hosting uses Web Bluetooth; it does not install a native bridge. Opening a downloaded file directly cannot enumerate Android system bonds. Firmware transfer is not implemented.
'''
archive = out / f'RC-OTA-HTML-{version}.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as output:
    output.write(standalone, standalone.name)
    output.writestr('README.txt', readme)
    for name in ['index.html', 'style.css', 'local-bridge.js', 'app.js', 'ota.js', 'ota-client.js']:
        output.write(root / 'docs' / name, 'web/' + name)
with zipfile.ZipFile(archive) as output:
    assert output.testzip() is None
assert len(hashes) == 4 and '<script src=' not in html
print('HTML and ZIP verified:', version)
