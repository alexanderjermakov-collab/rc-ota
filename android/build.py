from pathlib import Path
import subprocess,shutil,zipfile,time,os
from PIL import Image,ImageDraw,ImageFont
root=Path(__file__).resolve().parents[1];tools=Path(os.environ['RCOTA_ANDROID_TOOLS']);jdk=next((tools/'java').iterdir());w=root/'build'/str(time.time_ns());p=w/'project';(p/'res/drawable').mkdir(parents=True);classes=w/'classes';classes.mkdir()
def run(*args):subprocess.run([str(x) for x in args],check=True)
run(jdk/'bin/javac.exe','-encoding','UTF-8','-source','8','-target','8','-classpath',tools/'android.jar','-d',classes,*root.joinpath('android').glob('*.java'))
run(jdk/'bin/jar.exe','cf',w/'app.jar','-C',classes,'.');run(jdk/'bin/java.exe','-cp',tools/'r8-8.3.37.jar','com.android.tools.r8.D8','--min-api','28','--lib',tools/'android.jar','--output',w/'dex.zip',w/'app.jar')
shutil.copyfile(root/'android/AndroidManifest.xml',p/'AndroidManifest.xml');shutil.copytree(root/'docs',p/'assets/web')
im=Image.new('RGB',(320,180),'#123846');d=ImageDraw.Draw(im);d.text((160,85),'RC OTA',font=ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf',54),anchor='mm',fill='white');d.text((160,145),'Remote firmware',font=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',19),anchor='mm',fill='#74d8ce');im.save(p/'res/drawable/rcota.png')
(p/'apktool.yml').write_text('version: 3.0.3\napkFileName: RC-OTA.apk\nusesFramework:\n  ids:\n  - 1\nsdkInfo:\n  minSdkVersion: 28\n  targetSdkVersion: 34\nversionInfo:\n  versionCode: 4\n  versionName: 0.4.0\nresourcesInfo:\n  packageId: 127\ndoNotCompress:\n- arsc\n- dex\n- png\n',encoding='utf-8')
framework=w/'framework';shutil.copytree(tools/'framework',framework)
run(jdk/'bin/java.exe','-jar',tools/'apktool_3.0.3.jar','b',p,'-p',framework,'-o',w/'RC-OTA.apk')
with zipfile.ZipFile(w/'RC-OTA.apk','a') as z,zipfile.ZipFile(w/'dex.zip') as dex:z.writestr('classes.dex',dex.read('classes.dex'))
run(jdk/'bin/java.exe','-jar',tools/'uber-apk-signer-1.3.0.jar','--apks',w/'RC-OTA.apk','--out',w/'signed')
shutil.copyfile(w/'signed/RC-OTA-aligned-debugSigned.apk',root/'build/RC-OTA-0.4.0.apk')
print('RC OTA APK built')
