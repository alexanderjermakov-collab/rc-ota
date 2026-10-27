(function(){
'use strict';
const $=id=>document.getElementById(id);
if(!$('aboutDialog'))return;
let remote=window.RcWebRemote?.context()||{},upgrade={},file=null;
function render(){
 const connected=!!remote.connected,blocked=!!remote.busy||!!remote.locked;
 $('connectionState').textContent=remote.busy?'Подключение…':connected?'Подключён':'Не подключён';
 $('connectionState').classList.toggle('connected',connected);
 $('readRemote').disabled=!connected||blocked;
 if(file){$('selectedFilename').textContent=file.filename;$('selectedVersion').textContent=(file.version?'Версия '+file.version:'Версия из локального файла')+(file.source==='local'?' · с телефона':' · с сервера');}
 else{$('selectedFilename').textContent='Файл не выбран';$('selectedVersion').textContent='Выберите источник прошивки';}
 const active=['preparing','transferring','verifying','ready','installed','installation-unconfirmed','error'].includes(upgrade.state);
 let message='Включите Bluetooth. Подключите пульт, чтобы считать его данные.';
 if(remote.busy)message='Читаем данные пульта…';
 else if(connected)message='Данные прочитаны. Выберите прошивку.';
 else if(remote.readAt)message='Пульт отключён. Показаны последние считанные данные.';
 if(active){
  const states={preparing:'Подготавливаем файл… Ничего не устанавливается.',ready:'Файл готов. Подтвердите выбор и нажмите «Обновить пульт».',transferring:'Обновление — '+(upgrade.progress||0)+'%. Не закрывайте страницу.',verifying:'Файл передан. Ожидаем перезапуск пульта…',installed:'Готово! Версия пульта: '+(upgrade.actualFirmware||file?.version||'обновлена'), 'installation-unconfirmed':'Файл передан. Считайте данные пульта, чтобы увидеть установленную версию.'};
  message=states[upgrade.state]||errorMessage(upgrade.message);
 }else if(/failed|unavailable|cancelled|timed out/i.test(remote.message||''))message=errorMessage(remote.message);
 $('screenMessage').textContent=message;
 $('screenMessage').classList.toggle('error',upgrade.state==='error');
 $('screenMessage').classList.toggle('success',upgrade.state==='installed');
 $('webInstall').textContent=upgrade.state==='transferring'?'Обновление…':'Обновить пульт';
}
function errorMessage(message=''){
 if(/CORS|could not read the manufacturer|Failed to fetch/i.test(message))return 'Скачайте BIN с сервера, затем выберите его кнопкой «С телефона».';
 if(/30%|battery/i.test(message))return 'Заряд пульта должен быть не менее 30%.';
 if(/exact model|filename|different.*model|model.*changed/i.test(message))return 'Выберите BIN для модели, указанной на этом экране.';
 if(/newer|No upgrade/i.test(message))return 'На сервере нет более новой версии. Локальный файл можно установить отдельно.';
 if(/MD5|file changed|checksum/i.test(message))return 'Файл повреждён или изменён. Скачайте и выберите его заново.';
 if(/cancelled/i.test(message))return 'Выбор отменён. Нажмите «Подключить», чтобы повторить.';
 if(/unavailable.*browser|Bluetooth is unavailable/i.test(message))return 'Откройте приложение в Chrome на Android и включите Bluetooth.';
 if(/disconnected|timed out|Connection failed|link lost/i.test(message))return 'Разбудите пульт и подключите его снова.';
 return 'Не удалось выполнить действие. Подключите пульт и повторите. Диагностика доступна в About.';
}
window.RcSimpleUI={remote(value){remote=value;render()},upgrade(value,selected){upgrade=value;file=selected||null;render()}};
$('aboutButton').onclick=()=>$('aboutDialog').showModal();
$('closeAbout').onclick=()=>$('aboutDialog').close();
$('aboutDialog').addEventListener('click',event=>{if(event.target===$('aboutDialog')){const box=$('aboutDialog').getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)$('aboutDialog').close();}});
$('readRemote').onclick=()=>window.RcWebRemote?.read();
$('webFirmware').addEventListener('change',()=>{if($('webFirmware').files[0])$('webPrepareLocal').onclick();});
render();
})();
