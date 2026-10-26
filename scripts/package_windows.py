"""Build reproducible source and optional self-contained Windows release ZIPs."""
from pathlib import Path
import argparse
import re
import subprocess
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[1]
VERSION = re.search(r"^VERSION = '([^']+)'", (ROOT/'windows/bridge.py').read_text(encoding='utf-8'), re.M)[1]
FILES = ['windows/bridge.py','windows/read-remote.ps1','windows/telink-transport.ps1',
         'windows/Start RC OTA.cmd','windows/README.md','RELEASE-v0.11.0.md',
         'docs/local/index.html','docs/local/app.js','docs/local/style.css','docs/ota.js','docs/customer-ui.js']


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--output',type=Path,default=ROOT/'build/releases')
    parser.add_argument('--build-exe',action='store_true')
    args=parser.parse_args();args.output.mkdir(parents=True,exist_ok=True)
    source=args.output/f'RC-OTA-Windows-{VERSION}-source.zip'
    with ZipFile(source,'w',ZIP_DEFLATED) as archive:
        for name in FILES:archive.write(ROOT/name,f'RC-OTA-Windows-{VERSION}/'+name)
    print('Source archive:',source)
    if args.build_exe:
        import sys
        command=[sys.executable,'-m','PyInstaller','--noconfirm','--onedir','--noconsole',
                 '--name','RC OTA','--distpath',str(ROOT/'build/windows-dist'),
                 '--workpath',str(ROOT/'build/windows-work'),'--specpath',str(ROOT/'build/windows-spec'),
                 '--add-data',str(ROOT/'docs')+';docs',
                 '--add-data',str(ROOT/'windows/read-remote.ps1')+';windows',
                 '--add-data',str(ROOT/'windows/telink-transport.ps1')+';windows',str(ROOT/'windows/bridge.py')]
        subprocess.run(command,check=True,cwd=ROOT)
        bundle=ROOT/'build/windows-dist/RC OTA'
        binary=args.output/f'RC-OTA-Windows-{VERSION}.zip'
        with ZipFile(binary,'w',ZIP_DEFLATED) as archive:
            for file in sorted(bundle.rglob('*')):
                if file.is_file() and '.runtime' not in file.parts:archive.write(file,'RC OTA/'+file.relative_to(bundle).as_posix())
            archive.writestr('RC OTA/START HERE.txt',f'RC OTA {VERSION}\n\n1. Extract this entire ZIP.\n2. Open RC OTA.exe.\n3. Pair your remote in Windows Bluetooth settings, then follow the three steps in the browser.\n\nNo Python installation is required. Firmware installation is supported for AN2101A-20UM021-001. The app stays running when its browser tab is closed; use Exit in the app to stop it. Installation is a preview feature tested on one remote. Source and release notes: https://github.com/alexanderjermakov-collab/rc-ota/releases/tag/v{VERSION}\n')
        print('Windows archive:',binary)
    for file in args.output.glob(f'*{VERSION}*.zip'):
        with ZipFile(file) as archive:
            if archive.testzip():raise RuntimeError('Archive validation failed: '+str(file))
            if any('/.runtime/' in name for name in archive.namelist()):raise RuntimeError('Runtime data must not be published.')


if __name__=='__main__':main()
