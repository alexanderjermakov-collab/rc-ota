(function(){
'use strict';
const $=id=>document.getElementById(id);
if(!$('aboutDialog'))return;
const strings={
 "en": {
  "language": "Language",
  "help": "Help",
  "about": "About",
  "close": "Close",
  "remote": "Your remote",
  "connect": "Connect",
  "read": "Read",
  "disconnect": "Forget",
  "model": "Model",
  "firmwareVersion": "Firmware version",
  "battery": "Battery",
  "firmware": "Firmware",
  "phone": "From phone",
  "server": "From server",
  "chooseFile": "Choose firmware from your phone",
  "noFile": "No file selected",
  "chooseSource": "Choose a firmware source",
  "version": "Version",
  "localVersion": "Local firmware file",
  "sourcePhone": "phone",
  "sourceServer": "server",
  "confirm": "Use this BIN for all remotes of this model. I confirm installation.",
  "update": "Update remote",
  "updating": "Updating…",
  "keepOpen": "Keep the remote nearby and this page open during the update.",
  "downloadBin": "Download BIN V0.1.0",
  "connected": "Connected",
  "disconnected": "Not connected",
  "connecting": "Connecting…",
  "reading": "Reading remote information…",
  "start": "Turn on Bluetooth and connect your remote to read its information.",
  "choose": "Information read. Choose firmware.",
  "historical": "Remote disconnected. Showing the last information read.",
  "preparing": "Preparing the file… Nothing is being installed.",
  "ready": "File ready. Confirm your choice and press Update remote.",
  "transferring": "Updating — {progress}%. Keep this page open.",
  "verifying": "Reconnecting to the remote… Attempt {attempt}/5.",
  "installed": "Done. Remote firmware: {version}",
  "unconfirmed": "Transfer finished. Read the remote to confirm its installed version.",
  "cors": "Download the BIN from the server, then select it with From phone.",
  "lowBattery": "The remote needs at least 30% battery.",
  "wrongModel": "Choose a BIN for the exact model shown on this screen.",
  "noNewer": "No newer server version. You can still select a local file.",
  "badFile": "The file is damaged or changed. Download and select it again.",
  "cancelled": "Selection cancelled. Press Connect to try again.",
  "browser": "Open this app in Chrome on Android and turn on Bluetooth.",
  "retry": "Wake the remote and press Connect again.",
  "error": "The action failed. Reconnect and retry. Save diagnostics in Help if needed.",
  "author": "Author",
  "releaseDate": "Release date",
  "instructions": "How to update your remote",
  "helpIntro": "Use Chrome on Android with Bluetooth enabled.",
  "step1": "Wake the first remote, press Connect and select it. Its model, firmware and battery are read automatically.",
  "step2": "Select a local BIN or a server update once. Confirm the file for this model and press Update remote. The BIN and confirmation are retained.",
  "step3": "After the update, the installed version is read back. Press Next remote, choose the next unit in Chrome, then press Update remote. No file selection or confirmation is needed again for the same model.",
  "step4": "Keep the remote nearby and this page open during an update. Read refreshes its information. A different model needs its own BIN.",
  "fileNote": "Battery: at least 30%. Local BINs allow upgrade, downgrade or reinstall; server firmware must be newer. The BIN is retained in this browser when local storage is available. Each remote still needs a separate Update remote press.",
  "reconnectHelp": "The app does not unpair devices after OTA. If a remote stops responding, wake it and press Connect. A website cannot preserve Bluetooth keys if the remote firmware resets them.",
  "support": "Troubleshooting",
  "diagnosticsHint": "Save a report with remote information and the activity log for support.",
  "saveDiagnostics": "Save diagnostics",
  "next": "Next remote",
  "retained": "BIN retained. Connect the next remote of the same model.",
  "batchReady": "Saved BIN ready. Press Update remote.",
  "approved": "approved for this model",
  "forgotten": "Site access forgotten. Android pairing is managed in Bluetooth settings.",
  "forgetLimited": "Connection closed. Remove pairing in Android Bluetooth settings if required.",
  "forgetHelp": "Forget closes the connection and revokes this website’s permission when Chrome supports it. It cannot remove Android system pairing: use Android Bluetooth settings for that. Chrome requires you to select each new physical remote once."
 },
 "pl": {
  "language": "Język",
  "help": "Pomoc",
  "about": "O programie",
  "close": "Zamknij",
  "remote": "Twój pilot",
  "connect": "Połącz",
  "read": "Odczytaj",
  "disconnect": "Zapomnij",
  "model": "Model",
  "firmwareVersion": "Wersja oprogramowania",
  "battery": "Bateria",
  "firmware": "Oprogramowanie",
  "phone": "Z telefonu",
  "server": "Z serwera",
  "chooseFile": "Wybierz plik oprogramowania z telefonu",
  "noFile": "Nie wybrano pliku",
  "chooseSource": "Wybierz źródło oprogramowania",
  "version": "Wersja",
  "localVersion": "Lokalny plik oprogramowania",
  "sourcePhone": "telefon",
  "sourceServer": "serwer",
  "confirm": "Używaj tego BIN dla wszystkich pilotów tego modelu. Potwierdzam instalację.",
  "update": "Aktualizuj pilot",
  "updating": "Aktualizacja…",
  "keepOpen": "Podczas aktualizacji trzymaj pilot w pobliżu i nie zamykaj strony.",
  "downloadBin": "Pobierz BIN V0.1.0",
  "connected": "Połączony",
  "disconnected": "Niepołączony",
  "connecting": "Łączenie…",
  "reading": "Odczytywanie danych pilota…",
  "start": "Włącz Bluetooth i połącz pilot, aby odczytać jego dane.",
  "choose": "Dane odczytane. Wybierz oprogramowanie.",
  "historical": "Pilot rozłączony. Wyświetlono ostatnio odczytane dane.",
  "preparing": "Przygotowywanie pliku… Instalacja nie została rozpoczęta.",
  "ready": "Plik gotowy. Potwierdź wybór i naciśnij Aktualizuj pilot.",
  "transferring": "Aktualizacja — {progress}%. Nie zamykaj strony.",
  "verifying": "Ponowne łączenie z pilotem… Próba {attempt}/5.",
  "installed": "Gotowe. Wersja pilota: {version}",
  "unconfirmed": "Transfer zakończony. Odczytaj pilot, aby potwierdzić zainstalowaną wersję.",
  "cors": "Pobierz BIN z serwera, a następnie wybierz go przyciskiem Z telefonu.",
  "lowBattery": "Poziom baterii pilota musi wynosić co najmniej 30%.",
  "wrongModel": "Wybierz BIN dla dokładnego modelu widocznego na ekranie.",
  "noNewer": "Brak nowszej wersji na serwerze. Możesz wybrać plik lokalny.",
  "badFile": "Plik jest uszkodzony lub zmieniony. Pobierz go i wybierz ponownie.",
  "cancelled": "Anulowano wybór. Naciśnij Połącz, aby spróbować ponownie.",
  "browser": "Otwórz aplikację w Chrome na Androidzie i włącz Bluetooth.",
  "retry": "Wybudź pilot i ponownie naciśnij Połącz.",
  "error": "Nie udało się wykonać działania. Połącz ponownie i spróbuj jeszcze raz. Diagnostykę zapiszesz w Pomocy.",
  "author": "Autor",
  "releaseDate": "Data wydania",
  "instructions": "Jak zaktualizować pilot",
  "helpIntro": "Użyj Chrome na Androidzie i włącz Bluetooth.",
  "step1": "Wybudź pierwszy pilot, naciśnij Połącz i wybierz go. Model, wersja i bateria zostaną odczytane automatycznie.",
  "step2": "Wybierz lokalny BIN lub aktualizację z serwera tylko raz. Zatwierdź plik dla tego modelu i naciśnij Aktualizuj pilot. Plik i zgoda zostaną zachowane.",
  "step3": "Po aktualizacji aplikacja odczyta wersję. Naciśnij Następny pilot, wybierz kolejne urządzenie w Chrome i naciśnij Aktualizuj pilot. Dla tego samego modelu nie wybierasz ani nie zatwierdzasz pliku ponownie.",
  "step4": "Podczas aktualizacji trzymaj pilot w pobliżu i nie zamykaj strony. Odczytaj odświeża dane. Inny model wymaga własnego BIN.",
  "fileNote": "Bateria: co najmniej 30%. Lokalny BIN umożliwia aktualizację, obniżenie wersji lub ponowną instalację; wersja z serwera musi być nowsza. BIN jest zachowywany w tej przeglądarce, gdy dostępna jest pamięć lokalna. Dla każdego pilota osobno naciskasz Aktualizuj pilot.",
  "reconnectHelp": "Aplikacja nie usuwa parowania po OTA. Jeśli pilot nie odpowiada, wybudź go i naciśnij Połącz. Strona nie może zachować kluczy Bluetooth, jeśli oprogramowanie pilota je resetuje.",
  "support": "Rozwiązywanie problemów",
  "diagnosticsHint": "Zapisz raport z danymi pilota i dziennikiem działania dla pomocy technicznej.",
  "saveDiagnostics": "Zapisz diagnostykę",
  "next": "Następny pilot",
  "retained": "BIN zachowany. Połącz następny pilot tego samego modelu.",
  "batchReady": "Zapisany BIN gotowy. Naciśnij Aktualizuj pilot.",
  "approved": "zatwierdzony dla tego modelu",
  "forgotten": "Usunięto dostęp strony. Parowaniem Androida zarządzasz w ustawieniach Bluetooth.",
  "forgetLimited": "Połączenie zamknięte. W razie potrzeby usuń parowanie w ustawieniach Bluetooth Androida.",
  "forgetHelp": "Zapomnij zamyka połączenie i cofa uprawnienia strony, jeśli Chrome to obsługuje. Nie usuwa parowania systemowego Androida — zrób to w ustawieniach Bluetooth. Każdy nowy fizyczny pilot trzeba raz wybrać w Chrome."
 }
};
let language='en';try{if(localStorage.getItem('rcota-language')==='pl')language='pl';}catch{}
let remote=window.RcWebRemote?.context()||{},upgrade={},file=null;
const t=(key,values={})=>Object.entries(values).reduce((text,[name,value])=>text.replaceAll('{'+name+'}',String(value)),strings[language][key]||strings.en[key]||key);
function setLanguage(value){language=value==='pl'?'pl':'en';document.documentElement.lang=language;$('language').value=language;try{localStorage.setItem('rcota-language',language);}catch{}
 for(const node of document.querySelectorAll('[data-i18n]'))node.textContent=t(node.getAttribute('data-i18n'));
 for(const node of document.querySelectorAll('[data-i18n-aria]'))node.setAttribute('aria-label',t(node.getAttribute('data-i18n-aria')));
 render();
}
function render(){
 const connected=!!remote.connected,blocked=!!remote.busy||!!remote.locked;
 $('connectionState').textContent=t(remote.busy?'connecting':connected?'connected':'disconnected');$('connectionState').classList.toggle('connected',connected);$('readRemote').disabled=!connected||blocked;$('connect').textContent=t(connected?'next':'connect');$('connect').disabled=blocked;$('disconnect').disabled=blocked||!(connected||remote.hasDevice);
 $('selectedFilename').textContent=file?file.filename:t('noFile');
 $('selectedVersion').textContent=file?(file.version?t('version')+' '+file.version:t('localVersion'))+' · '+t(file.source==='local'?'sourcePhone':'sourceServer')+(file.batchApproved?' · '+t('approved'):''):t('chooseSource');
 let message=t(remote.busy?'reading':connected?'choose':remote.readAt?'historical':'start');
 const states={retained:()=>t('retained'),preparing:()=>t('preparing'),ready:()=>t(file?.batchApproved?'batchReady':'ready'),transferring:()=>t('transferring',{progress:upgrade.progress||0}),verifying:()=>t('verifying',{attempt:upgrade.verificationAttempt||1}),installed:()=>t('installed',{version:upgrade.actualFirmware||file?.version||'—'}),'installation-unconfirmed':()=>t('unconfirmed'),error:()=>errorMessage(upgrade.message)};
 if(states[upgrade.state])message=states[upgrade.state]();else if(/Site access revoked/i.test(remote.message||''))message=t('forgotten');else if(/Browser forget|Native connection closed/i.test(remote.message||''))message=t('forgetLimited');else if(/failed|unavailable|cancelled|timed out/i.test(remote.message||''))message=errorMessage(remote.message);
 if(['retained','idle'].includes(upgrade.state)){if(/Site access revoked/i.test(remote.message||''))message=t('forgotten');else if(/Browser forget|Native connection closed/i.test(remote.message||''))message=t('forgetLimited');}
 $('screenMessage').textContent=message;$('screenMessage').classList.toggle('error',upgrade.state==='error');$('screenMessage').classList.toggle('success',upgrade.state==='installed');$('webInstall').textContent=t(upgrade.state==='transferring'?'updating':'update');
}
function errorMessage(message=''){
 for(const [pattern,key] of [[/CORS|could not read the manufacturer|Failed to fetch/i,'cors'],[/30%|battery/i,'lowBattery'],[/exact model|filename|different.*model|model.*changed/i,'wrongModel'],[/newer|No upgrade/i,'noNewer'],[/MD5|file changed|checksum/i,'badFile'],[/cancelled/i,'cancelled'],[/unavailable.*browser|Bluetooth is unavailable/i,'browser'],[/disconnected|timed out|Connection failed|link lost/i,'retry']])if(pattern.test(message))return t(key);
 return t('error');
}
window.RcSimpleUI={remote(value){remote=value;render()},upgrade(value,selected){upgrade=value;file=selected||null;render()}};
for(const name of ['about','help']){const dialog=$(name+'Dialog');$(name+'Button').onclick=()=>dialog.showModal();$('close'+name[0].toUpperCase()+name.slice(1)).onclick=()=>dialog.close();dialog.addEventListener('click',event=>{if(event.target===dialog){const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)dialog.close();}});}
$('language').onchange=event=>setLanguage(event.target.value);
$('readRemote').onclick=()=>window.RcWebRemote?.read();
$('connect').onclick=()=>window.RcWebRemote?.context()?.connected?window.RcWebRemote.next():window.RcWebRemote?.connect();
$('disconnect').onclick=()=>window.RcWebRemote?.forget();
$('webFirmware').addEventListener('change',()=>{if($('webFirmware').files[0])$('webPrepareLocal').onclick();});
setLanguage(language);
})();
