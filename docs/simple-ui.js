(function(){
'use strict';
const $=id=>document.getElementById(id);
if(!$('aboutDialog'))return;
const strings={
 "en": {
  "serverErrorMessage": "See the server details above. Check the catalogue model or use the displayed direct link.",
  "serverDownloading": "Downloading the listed BIN from the server…",
  "serverInfo": "Review OTA Info TXT, then choose Load BIN from server or Save BIN to phone.",
  "serverLoading": "Loading OTA Info TXT…",
  "otaBinBlocked": "The browser could not load the BIN (network or server access/CORS). Its direct Save BIN to phone link remains available.",
  "otaNotFound": "The server catalogue was not found (HTTP 404). Check the model name; a renamed model may use a different folder.",
  "otaReady": "OTA Info TXT loaded. Review its contents and the BIN filename below.",
  "otaEnterModel": "Enter the server catalogue model and press Read OTA Info TXT. After a model rename, use its new server name.",
  "serverBinInstructions": "Load BIN from server downloads and checks the listed file in this app. Save BIN to phone opens its direct server link. No installation starts until you confirm Update remote.",
  "loadServerBin": "Load BIN from server",
  "saveServerBin": "Save BIN to phone",
  "serverBinLabel": "BIN listed in OTA Info TXT",
  "readOtaInfo": "Read OTA Info TXT",
  "serverModelLabel": "Server catalogue model",
  "serverFirmware": "Server firmware",
  "diagnosticError": "Could not prepare the diagnostic report. Try Save diagnostics.",
  "diagnosticSaved": "Diagnostic JSON saved. Attach it to an email or send it with another app.",
  "diagnosticCancelled": "Sharing cancelled.",
  "diagnosticShared": "Diagnostics handed to the selected sharing app.",
  "shareDiagnostic": "Share Diagnostic",
  "proChecksHelp": "Pro retains battery, BIN size and hash, OTA service and live-device checks. The operator is responsible for hardware and firmware compatibility.",
  "proMacHelp": "Web Bluetooth does not expose the physical MAC address. In the web app this field is unavailable; it is not reconstructed from the browser device ID. VID and PID appear when the remote provides them.",
  "proDataHelp": "Pro shows additional information: MAC address (when available), VID (Vendor ID), PID (Product ID), software version and OTA server metadata. VID and PID are displayed in hexadecimal and decimal.",
  "proModelHelp": "Normal mode requires a BIN filename matching the connected model. In Pro, enable Allow a different model name (BIN) to bypass filename or server-catalogue matching. A separate warning and confirmation are shown before each overridden installation.",
  "proVersionHelp": "Local BINs can upgrade, downgrade or reinstall the same version without a newer-version restriction. This is also available for local BINs in normal mode. Server updates still require a newer version in both modes.",
  "modeComparison": "Normal mode and Pro",
  "proHelpIntro": "Pro is an engineering mode for firmware testing and model renaming.",
  "proHelpTitle": "Help — Pro",
  "proOverride": "Allow a different model name (BIN)",
  "proOverrideHint": "For engineering use after a model rename. Confirm hardware compatibility before installing.",
  "overrideTitle": "Different model name",
  "overrideWarning": "This BIN filename does not match the connected model. An incompatible image can leave the remote unusable. Continue only if you have verified hardware and firmware compatibility.",
  "binModel": "Model in BIN filename",
  "selectedBin": "Selected BIN",
  "cancelOverride": "Cancel",
  "approveOverride": "Yes, install this BIN",
  "unknownFileModel": "Not identified from the filename",
  "confirmProFile": "I selected this engineering BIN. Ask me to confirm the model override before installation.",
  "localSelected": "BIN selected. Connect and read the remote to prepare it.",
  "overrideReady": "Engineering BIN ready. Update remote will ask you to confirm the different model name.",

  "language": "Language",
  "help": "Help",
  "pairFallback": "For remotes whose instructions specify Back + Home, hold them together for 3 seconds until the red LED flashes. Otherwise use the pairing procedure for your model. Then press Connect on this page.",
  "pairReset": "If pressing MIC does not put the remote into pairing mode, perform a factory reset following the instructions for your remote model, then try pairing again.",
  "pairMissing": "If Android pairing succeeds but this page cannot connect, remove only this remote from Android Bluetooth settings. Activate its pairing mode, press Connect on this page and confirm the Android pairing request. Do not re-enter pairing mode between reading and updating.",
  "password": "Password",
  "wrongPassword": "Incorrect password.",
  "unlockPro": "Unlock Pro",
  "softwareVersion": "Software version",
  "macUnavailable": "MAC is not exposed by Web Bluetooth",
  "openBridge": "Open Android BLE Bridge",
  "downloadBridge": "Download Android app",
  "openWebUpgrade": "Connect for firmware",
  "pairedRemote": "Paired remote",
  "lastRead": "Showing the last values read from this remote.",
  "partialRead": "Some fields could not be refreshed. The Bluetooth link is still open.",
  "openOta": "Open OTA Info.txt",
  "loadOta": "Open downloaded TXT",
  "otaLoading": "Loading OTA Info TXT…",
  "otaBlocked": "The browser could not read OTA Info TXT. Open the direct TXT link below to check access. If necessary, download that TXT and open it here.",
  "otaInvalid": "Could not open this TXT. Select an OTA Info.txt file up to 64 KB.",
  "otaLocal": "From the selected TXT file. For display only.",
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
  "downloadBin": "Download BIN {version}",
  "connected": "Connected",
  "disconnected": "Not connected",
  "connecting": "Connecting…",
  "reading": "Reading the selected remote…",
  "start": "",
  "choose": "Information read. Choose firmware.",
  "historical": "Remote disconnected. Showing the last information read.",
  "preparing": "Preparing the file… Nothing is being installed.",
  "ready": "File ready. Confirm your choice and press Update remote.",
  "transferring": "Updating — {progress}%. Keep this page open.",
  "verifying": "Reading the installed version once…",
  "installed": "Done. Remote firmware: {version}",
  "unconfirmed": "Transfer finished. Read the remote to confirm its installed version.",
  "cors": "Download the BIN from the server, then select it with From phone.",
  "lowBattery": "The remote needs at least 30% battery.",
  "wrongModel": "Choose a BIN for the exact model shown on this screen.",
  "noNewer": "No newer server version. You can still select a local file.",
  "badFile": "The file is damaged or changed. Download and select it again.",
  "cancelled": "Selection cancelled. Press Connect to try again.",
  "browser": "Open this app in Chrome on Android and turn on Bluetooth.",
  "retry": "Could not connect. See Help → Troubleshooting.",
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
  "reconnectHelp": "Forget does not delete Android pairing. After Forget, Connect opens a fresh device chooser. If Android pairing is stale, remove only that remote in Android Bluetooth settings and repeat steps 1–4.",
  "support": "Troubleshooting",
  "diagnosticsHint": "Save or share a JSON report containing remote information, firmware checks and the activity log. Choose the recipient in your sharing app.",
  "saveDiagnostics": "Save diagnostics",
  "next": "Next remote",
  "retained": "BIN retained. Connect the next remote of the same model.",
  "batchReady": "Saved BIN ready. Press Update remote.",
  "approved": "approved for this model",
  "forgotten": "Site access forgotten. Android pairing is managed in Bluetooth settings.",
  "forgetLimited": "Connection closed. Remove pairing in Android Bluetooth settings if required.",
  "forgetHelp": "Forget closes the connection and revokes this website’s permission when Chrome supports it. It cannot remove Android system pairing: use Android Bluetooth settings for that. Chrome requires you to select each new physical remote once.",
  "pairingTitle": "Pair the remote with the phone",
  "fileTitle": "Select the firmware",
  "upgradeTitle": "Upgrade the remote",
  "pair1": "Turn on Bluetooth and open this HTTPS page directly in Chrome on your phone. No Android app is required.",
  "pair2": "Wake the remote. If it has not been paired, activate pairing using the instructions for your remote model.",
  "pair3": "Press Connect on this page, choose SHARP RCU or SHARP SOLAR RCU and allow access. Confirm any Android Pair request, including a pairing notification.",
  "pair4": "Wait for the exact model, firmware and battery. Keep this page open: firmware preparation and transfer use the same browser connection. An existing Android pairing can be kept if it works.",
  "file1": "Press From phone and choose the BIN for the exact displayed model. AN2303-2UM-001 and AN2303B-2UM-001 require different files.",
  "file2": "Or press From server. Review OTA Info TXT and the listed filename, then press Load BIN from server. Save BIN to phone opens a direct download link. The same server workflow is available in normal mode and Pro.",
  "file3": "Wait until the file is ready. Confirm it once. The BIN and confirmation are kept for the next units of the same model.",
  "upgrade1": "Press Update remote. Keep the remote powered and nearby; leave this page open.",
  "upgrade2": "Wait for the transfer to finish. At 100% the bytes have been sent; that alone does not confirm installation.",
  "upgrade3": "If the remote restarts and disconnects, wake it and press Reconnect. Select the same remote to read its installed version. If pairing fails, see Troubleshooting.",
  "upgrade4": "For another unit, press Next remote and repeat steps 1–4. The retained matching BIN is prepared automatically; press Update remote.",
  "reconnect": "Reconnect",
  "awaitingReconnect": "Transfer sent. No automatic reconnect. Wake/pair the remote, then press Reconnect or Read to check its version.",
  "unconfirmedRead": "Remote version read: {version}. Same-version or unknown-version installation cannot be verified by version alone.",
  "modelMismatch": "Remote: {actual}. Saved BIN: {expected}. Choose a file for {actual}.",
  "webPairingRecovery": "Android closed the Bluetooth connection before verification. Confirm any pairing notification. If it repeats, remove only this remote in Android Bluetooth settings, enter its pairing mode, then select it with Connect on this page. See Help.",
  "permissionError": "Allow this remote in Chrome and confirm any Android pairing request or notification."
 },
 "pl": {
  "serverErrorMessage": "Zobacz szczegóły serwera powyżej. Sprawdź model katalogu lub użyj bezpośredniego linku.",
  "serverDownloading": "Pobieranie wskazanego BIN z serwera…",
  "serverInfo": "Sprawdź OTA Info TXT, a następnie wczytaj BIN z serwera lub zapisz go w telefonie.",
  "serverLoading": "Pobieranie OTA Info TXT…",
  "otaBinBlocked": "Nie udało się wczytać BIN (sieć lub dostęp do serwera/CORS). Bezpośredni link Zapisz BIN w telefonie jest nadal dostępny.",
  "otaNotFound": "Nie znaleziono katalogu (HTTP 404). Sprawdź nazwę modelu; po zmianie nazwy katalog może być inny.",
  "otaReady": "Odczytano OTA Info TXT. Sprawdź treść i nazwę BIN poniżej.",
  "otaEnterModel": "Wpisz model katalogu i naciśnij Odczytaj OTA Info TXT. Po zmianie nazwy modelu użyj nowej nazwy na serwerze.",
  "serverBinInstructions": "Wczytaj BIN z serwera pobiera i sprawdza wskazany plik w aplikacji. Zapisz BIN w telefonie otwiera jego bezpośredni adres. Instalacja rozpoczyna się dopiero po potwierdzeniu Aktualizuj pilot.",
  "loadServerBin": "Wczytaj BIN z serwera",
  "saveServerBin": "Zapisz BIN w telefonie",
  "serverBinLabel": "BIN wskazany w OTA Info TXT",
  "readOtaInfo": "Odczytaj OTA Info TXT",
  "serverModelLabel": "Model katalogu na serwerze",
  "serverFirmware": "Oprogramowanie z serwera",
  "diagnosticError": "Nie udało się przygotować raportu. Spróbuj zapisać diagnostykę.",
  "diagnosticSaved": "Zapisano plik JSON diagnostyki. Dołącz go do wiadomości e-mail lub wyślij inną aplikacją.",
  "diagnosticCancelled": "Anulowano udostępnianie.",
  "diagnosticShared": "Przekazano diagnostykę do wybranej aplikacji.",
  "shareDiagnostic": "Udostępnij diagnostykę",
  "proChecksHelp": "Pro zachowuje kontrolę baterii, rozmiaru i skrótu BIN, usługi OTA oraz danych podłączonego urządzenia. Operator odpowiada za zgodność sprzętu i oprogramowania.",
  "proMacHelp": "Web Bluetooth nie udostępnia fizycznego adresu MAC. W aplikacji webowej to pole jest niedostępne; nie jest odtwarzane z identyfikatora urządzenia przeglądarki. VID i PID są widoczne, gdy pilot je udostępnia.",
  "proDataHelp": "Pro pokazuje dodatkowe informacje: adres MAC (gdy dostępny), VID (identyfikator producenta), PID (identyfikator produktu), wersję oprogramowania oraz metadane serwera OTA. VID i PID są wyświetlane szesnastkowo i dziesiętnie.",
  "proModelHelp": "Tryb normalny wymaga zgodności nazwy pliku BIN z podłączonym modelem. W Pro włącz Zezwól na inną nazwę modelu (BIN), aby pominąć dopasowanie nazwy pliku lub katalogu serwera. Przed każdą taką instalacją pojawia się osobne ostrzeżenie i potwierdzenie.",
  "proVersionHelp": "Lokalny BIN umożliwia aktualizację, obniżenie wersji i ponowną instalację tej samej wersji bez wymogu nowszej wersji. Dotyczy to także lokalnych BIN w trybie normalnym. Aktualizacje z serwera w obu trybach nadal wymagają nowszej wersji.",
  "modeComparison": "Tryb normalny i Pro",
  "proHelpIntro": "Pro to tryb inżynierski do testowania oprogramowania i zmiany nazwy modelu.",
  "proHelpTitle": "Pomoc — Pro",
  "proOverride": "Zezwól na inną nazwę modelu (BIN)",
  "proOverrideHint": "Do prac inżynierskich po zmianie nazwy modelu. Przed instalacją sprawdź zgodność sprzętu.",
  "overrideTitle": "Inna nazwa modelu",
  "overrideWarning": "Nazwa tego pliku BIN nie odpowiada modelowi podłączonego pilota. Niezgodny obraz może uniemożliwić działanie pilota. Kontynuuj tylko po sprawdzeniu zgodności sprzętu i oprogramowania.",
  "binModel": "Model w nazwie pliku BIN",
  "selectedBin": "Wybrany BIN",
  "cancelOverride": "Anuluj",
  "approveOverride": "Tak, zainstaluj ten BIN",
  "unknownFileModel": "Nie rozpoznano w nazwie pliku",
  "confirmProFile": "Wybrałem ten inżynierski BIN. Poproś o potwierdzenie zmiany modelu przed instalacją.",
  "localSelected": "Wybrano BIN. Połącz i odczytaj pilot, aby przygotować plik.",
  "overrideReady": "Inżynierski BIN gotowy. Aktualizacja wymaga potwierdzenia innej nazwy modelu.",

  "language": "Język",
  "help": "Pomoc",
  "pairFallback": "Dla pilotów, których instrukcja wskazuje Back + Home, przytrzymaj je jednocześnie przez 3 sekundy, aż czerwona dioda zacznie migać. Dla innych użyj procedury parowania danego modelu. Następnie naciśnij Połącz na tej stronie.",
  "pairReset": "Jeśli naciśnięcie MIC nie włącza trybu parowania, przywróć ustawienia fabryczne zgodnie z instrukcją danego modelu pilota i spróbuj ponownie.",
  "pairMissing": "Jeśli parowanie w Androidzie działa, ale strona nie może się połączyć, usuń tylko ten pilot w ustawieniach Bluetooth Androida. Włącz parowanie pilota, naciśnij Połącz na tej stronie i potwierdź żądanie parowania Androida. Nie włączaj ponownie parowania między odczytem a aktualizacją.",
  "password": "Hasło",
  "wrongPassword": "Nieprawidłowe hasło.",
  "unlockPro": "Odblokuj Pro",
  "softwareVersion": "Wersja oprogramowania",
  "macUnavailable": "MAC nie jest udostępniany przez Web Bluetooth",
  "openBridge": "Otwórz mostek Android BLE",
  "downloadBridge": "Pobierz aplikację na Androida",
  "openWebUpgrade": "Połącz w celu aktualizacji",
  "pairedRemote": "Sparowany pilot",
  "lastRead": "Wyświetlono ostatnie wartości odczytane z tego pilota.",
  "partialRead": "Nie udało się odświeżyć części danych. Połączenie Bluetooth nadal działa.",
  "openOta": "Otwórz OTA Info.txt",
  "loadOta": "Otwórz pobrany TXT",
  "otaLoading": "Pobieranie OTA Info TXT…",
  "otaBlocked": "Przeglądarka nie odczytała OTA Info TXT. Otwórz bezpośredni adres TXT poniżej, aby sprawdzić dostęp. W razie potrzeby pobierz TXT i otwórz go tutaj.",
  "otaInvalid": "Nie można otworzyć pliku. Wybierz OTA Info.txt o rozmiarze do 64 KB.",
  "otaLocal": "Z wybranego pliku TXT. Tylko do wyświetlenia.",
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
  "downloadBin": "Pobierz BIN {version}",
  "connected": "Połączony",
  "disconnected": "Niepołączony",
  "connecting": "Łączenie…",
  "reading": "Odczytywanie wybranego pilota…",
  "start": "",
  "choose": "Dane odczytane. Wybierz oprogramowanie.",
  "historical": "Pilot rozłączony. Wyświetlono ostatnio odczytane dane.",
  "preparing": "Przygotowywanie pliku… Instalacja nie została rozpoczęta.",
  "ready": "Plik gotowy. Potwierdź wybór i naciśnij Aktualizuj pilot.",
  "transferring": "Aktualizacja — {progress}%. Nie zamykaj strony.",
  "verifying": "Jednorazowy odczyt zainstalowanej wersji…",
  "installed": "Gotowe. Wersja pilota: {version}",
  "unconfirmed": "Transfer zakończony. Odczytaj pilot, aby potwierdzić zainstalowaną wersję.",
  "cors": "Pobierz BIN z serwera, a następnie wybierz go przyciskiem Z telefonu.",
  "lowBattery": "Poziom baterii pilota musi wynosić co najmniej 30%.",
  "wrongModel": "Wybierz BIN dla dokładnego modelu widocznego na ekranie.",
  "noNewer": "Brak nowszej wersji na serwerze. Możesz wybrać plik lokalny.",
  "badFile": "Plik jest uszkodzony lub zmieniony. Pobierz go i wybierz ponownie.",
  "cancelled": "Anulowano wybór. Naciśnij Połącz, aby spróbować ponownie.",
  "browser": "Otwórz aplikację w Chrome na Androidzie i włącz Bluetooth.",
  "retry": "Nie udało się połączyć. Zobacz Pomoc → Rozwiązywanie problemów.",
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
  "reconnectHelp": "Zapomnij nie usuwa parowania Androida. Po tej operacji Połącz otwiera nowy wybór urządzenia. Jeśli parowanie Androida jest nieaktualne, usuń tylko ten pilot w ustawieniach Bluetooth i powtórz kroki 1–4.",
  "support": "Rozwiązywanie problemów",
  "diagnosticsHint": "Zapisz lub udostępnij raport JSON z danymi pilota, kontrolą oprogramowania i dziennikiem działania. Odbiorcę wybierasz w aplikacji do udostępniania.",
  "saveDiagnostics": "Zapisz diagnostykę",
  "next": "Następny pilot",
  "retained": "BIN zachowany. Połącz następny pilot tego samego modelu.",
  "batchReady": "Zapisany BIN gotowy. Naciśnij Aktualizuj pilot.",
  "approved": "zatwierdzony dla tego modelu",
  "forgotten": "Usunięto dostęp strony. Parowaniem Androida zarządzasz w ustawieniach Bluetooth.",
  "forgetLimited": "Połączenie zamknięte. W razie potrzeby usuń parowanie w ustawieniach Bluetooth Androida.",
  "forgetHelp": "Zapomnij zamyka połączenie i cofa uprawnienia strony, jeśli Chrome to obsługuje. Nie usuwa parowania systemowego Androida — zrób to w ustawieniach Bluetooth. Każdy nowy fizyczny pilot trzeba raz wybrać w Chrome.",
  "pairingTitle": "Sparuj pilot z telefonem",
  "fileTitle": "Wybierz oprogramowanie",
  "upgradeTitle": "Zaktualizuj pilot",
  "pair1": "Włącz Bluetooth i otwórz tę stronę HTTPS bezpośrednio w Chrome na telefonie. Aplikacja Android nie jest wymagana.",
  "pair2": "Obudź pilot. Jeśli nie jest sparowany, włącz parowanie zgodnie z instrukcją danego modelu pilota.",
  "pair3": "Naciśnij Połącz na tej stronie, wybierz SHARP RCU lub SHARP SOLAR RCU i zezwól na dostęp. Potwierdź żądanie Paruj w Androidzie, także w powiadomieniu.",
  "pair4": "Poczekaj na dokładny model, wersję i baterię. Pozostaw stronę otwartą: przygotowanie i przesyłanie oprogramowania używa tego samego połączenia przeglądarki. Zachowaj istniejące parowanie Androida, jeśli działa.",
  "file1": "Naciśnij Z telefonu i wybierz BIN dla dokładnego modelu na ekranie. AN2303-2UM-001 i AN2303B-2UM-001 wymagają różnych plików.",
  "file2": "Lub naciśnij Z serwera. Sprawdź OTA Info TXT oraz nazwę pliku i naciśnij Wczytaj BIN z serwera. Zapisz BIN w telefonie otwiera bezpośredni link pobierania. Procedura jest taka sama w trybie normalnym i Pro.",
  "file3": "Poczekaj na gotowość pliku i zatwierdź go raz. BIN i zgoda zostają zachowane dla kolejnych pilotów tego samego modelu.",
  "upgrade1": "Naciśnij Aktualizuj pilot. Trzymaj włączony pilot w pobliżu i nie zamykaj strony.",
  "upgrade2": "Poczekaj na zakończenie transferu. 100% oznacza wysłanie danych, a nie potwierdzenie instalacji.",
  "upgrade3": "Jeśli pilot uruchomi się ponownie i rozłączy, wybudź go i naciśnij Połącz ponownie. Wybierz ten sam pilot, aby odczytać wersję. W razie problemów z parowaniem zobacz sekcję Rozwiązywanie problemów.",
  "upgrade4": "Dla kolejnego urządzenia naciśnij Następny pilot i powtórz kroki 1–4. Zachowany zgodny BIN przygotuje się automatycznie; naciśnij Aktualizuj pilot.",
  "reconnect": "Połącz ponownie",
  "awaitingReconnect": "Dane wysłane. Brak automatycznych prób łączenia. Wybudź lub sparuj pilot i naciśnij Połącz ponownie lub Odczytaj, aby sprawdzić wersję.",
  "unconfirmedRead": "Odczytana wersja: {version}. Instalacji tej samej lub nieznanej wersji nie można potwierdzić samym odczytem.",
  "modelMismatch": "Pilot: {actual}. Zapisany BIN: {expected}. Wybierz plik dla {actual}.",
  "webPairingRecovery": "Android zamknął połączenie Bluetooth przed weryfikacją. Potwierdź powiadomienie o parowaniu. Jeśli błąd się powtarza, usuń tylko ten pilot w ustawieniach Bluetooth Androida, włącz jego parowanie i wybierz go przyciskiem Połącz na tej stronie. Zobacz Pomoc.",
  "permissionError": "Zezwól na dostęp do pilota w Chrome i potwierdź żądanie lub powiadomienie o parowaniu w Androidzie."
 }
};
let language='en';try{if(localStorage.getItem('rcota-language')==='pl')language='pl';}catch{}
let remote=window.RcWebRemote?.context()||{},upgrade={},file=null,pro=false,serverInfo=null;
const t=(key,values={})=>Object.entries(values).reduce((text,[name,value])=>text.replaceAll('{'+name+'}',String(value)),strings[language][key]??strings.en[key]??key);
function setLanguage(value){language=value==='pl'?'pl':'en';document.documentElement.lang=language;$('language').value=language;try{localStorage.setItem('rcota-language',language);}catch{}
 for(const node of document.querySelectorAll('[data-i18n]'))node.textContent=t(node.getAttribute('data-i18n'));
 for(const node of document.querySelectorAll('[data-i18n-aria]'))node.setAttribute('aria-label',t(node.getAttribute('data-i18n-aria')));
 render();
}
function renderPro(){
 const metadata=remote.metadata||{};
 const fields=['vid','pid','software'];
 const hasPrevious=fields.some(key=>metadata[key]!=null&&!remote.freshFields?.includes(key));
 const field=key=>metadata[key];
 const id=key=>Number.isInteger(field(key))?'0x'+field(key).toString(16).toUpperCase().padStart(4,'0')+' ('+field(key)+')':'—';
 $('proButton').setAttribute('aria-pressed',String(pro));
 $('normalHelp').hidden=pro;$('proHelp').hidden=!pro;$('helpHeading').textContent=t(pro?'proHelpTitle':'help');
 $('proRemote').hidden=!pro;
 $('proFirmware').hidden=!pro;
 $('proButton').disabled=!!remote.locked;
 $('proBridgeLinks').hidden=true;
 $('bridgeUpgradeLink').hidden=!remote.native;
 $('nativeForget').hidden=!remote.native||!remote.hasDevice||!!remote.busy||!!remote.locked;
 $('disconnect').hidden=!!remote.native&&!$('nativeForget').hidden;
 $('proMac').textContent=/^(?:[0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(metadata.address||'')?metadata.address:!remote.native?t('macUnavailable'):'—';
 $('proVid').textContent=id('vid');
 $('proPid').textContent=id('pid');
 $('proSoftware').textContent=field('software')||'—';
 $('proReadNote').hidden=!pro||remote.native||!hasPrevious;
 $('proReadNote').textContent=t('lastRead');
 const info=serverInfo;
 $('proOta').hidden=!info;
 $('serverError').hidden=!info?.error;$('serverError').textContent=info?.error||'';
 $('serverBinary').hidden=!info?.binaryUrl;
 $('serverBinaryName').textContent=info?.filename||'';
 $('serverBinaryVersion').textContent=info?.version?t('version')+' '+info.version:'';
 $('webDownloadServer').disabled=!info?.canLoad;
 if(info?.binaryUrl){$('serverBinaryLink').href=info.binaryUrl;$('serverBinaryLink').setAttribute('download',info.filename||'firmware.bin');}
 $('proOtaStatus').textContent=info?.status?t(info.status):'';
 $('proOtaText').textContent=info?.text||'';
 $('proOtaText').hidden=!info?.text;
 $('proOtaLink').hidden=!info?.url;
 if(info?.url)$('proOtaLink').href=info.url;
 $('proOtaImport').hidden=info?.status!=='otaBlocked'&&info?.status!=='otaInvalid'&&info?.status!=='otaLocal';
}
function render(){
 renderPro();
 const connected=!!remote.connected,blocked=!!remote.busy||!!remote.locked;const download=$('webSolarDownload').querySelector?.('a');if(download)download.textContent=t('downloadBin',{version:download.getAttribute('data-version')||'0.1.0'});
 $('connectionState').textContent=t(connected?'connected':remote.busy?'connecting':'disconnected');$('connectionState').classList.toggle('connected',connected);$('readRemote').disabled=!connected||blocked;$('connect').textContent=t(connected||remote.nextSelection?'next':upgrade.state==='awaiting-reconnect'||remote.hasDevice&&remote.readAt?'reconnect':'connect');$('connect').disabled=blocked;$('disconnect').disabled=blocked||!(connected||remote.hasDevice);
 $('selectedFilename').textContent=file?.filename||upgrade.chosenFilename||t('noFile');
 $('webConfirmLabel').textContent=t(file?.modelOverride?'confirmProFile':'confirm');
 $('selectedVersion').textContent=file?(file.version?t('version')+' '+file.version:t('localVersion'))+' · '+t(file.source==='local'?'sourcePhone':'sourceServer')+(file.batchApproved?' · '+t('approved'):''):t('chooseSource');
 let message=t(remote.busy?'reading':connected?'choose':remote.readAt?'historical':'start');
 const states={'server-loading':()=>t('serverLoading'),'server-info':()=>t('serverInfo'),'server-downloading':()=>t('serverDownloading'),'server-info-error':()=>t('serverErrorMessage'),'server-download-error':()=>t('serverErrorMessage'),'local-selected':()=>t('localSelected'),retained:()=>t('retained'),preparing:()=>t('preparing'),ready:()=>t(file?.modelOverride?'overrideReady':file?.batchApproved?'batchReady':'ready'),transferring:()=>t('transferring',{progress:upgrade.progress||0}),verifying:()=>t('verifying'),installed:()=>t('installed',{version:upgrade.actualFirmware||file?.version||'—'}),'installation-unconfirmed':()=>upgrade.actualFirmware?t('unconfirmedRead',{version:upgrade.actualFirmware}):t('unconfirmed'),'awaiting-reconnect':()=>t('awaitingReconnect'),'model-mismatch':()=>t('modelMismatch',{actual:upgrade.detectedModel||remote.metadata?.model||'—',expected:upgrade.expectedModel||file?.model||'—'}),error:()=>errorMessage(upgrade.message)};
 if(states[upgrade.state])message=states[upgrade.state]();else if(/Site access revoked/i.test(remote.message||''))message=t('forgotten');else if(/Browser forget|Native connection closed/i.test(remote.message||''))message=t('forgetLimited');else if(/failed|unavailable|cancelled|timed out/i.test(remote.message||''))message=errorMessage(remote.message);
 if(['retained','idle'].includes(upgrade.state)){if(/Site access revoked/i.test(remote.message||''))message=t('forgotten');else if(/Browser forget|Native connection closed/i.test(remote.message||''))message=t('forgetLimited');}
 if(remote.busy&&!['transferring','verifying'].includes(upgrade.state))message=t('reading');else if(remote.connectionError?.pairingRecovery)message=t('webPairingRecovery');else if(remote.connectionError?.name==='SecurityError')message=t('permissionError');else if(!connected&&!remote.locked&&/Remote.*disconnected/i.test(remote.message||'')&&!['installed','installation-unconfirmed','awaiting-reconnect'].includes(upgrade.state))message=t(remote.readAt?'historical':'retry');
 if(remote.native)message=remote.message||message;
 if(/partially refreshed/i.test(remote.message||'')&&!blocked)message=t('partialRead');
 $('screenMessage').hidden=!message;$('screenMessage').textContent=message;$('screenMessage').classList.toggle('error',['error','model-mismatch'].includes(upgrade.state));$('screenMessage').classList.toggle('success',upgrade.state==='installed');$('webInstall').textContent=t(upgrade.state==='transferring'?'updating':'update');
}
function errorMessage(message=''){
 for(const [pattern,key] of [[/CORS|could not read the manufacturer|Failed to fetch/i,'cors'],[/30%|battery/i,'lowBattery'],[/exact model|filename|different.*model|model.*changed/i,'wrongModel'],[/newer|No upgrade/i,'noNewer'],[/MD5|file changed|checksum/i,'badFile'],[/cancelled/i,'cancelled'],[/unavailable.*browser|Bluetooth is unavailable/i,'browser'],[/disconnected|timed out|Connection failed|link lost/i,'retry']])if(pattern.test(message))return t(key);
 return t('error');
}
window.RcSimpleUI={diagnosticStatus(key){$('diagnosticStatus').textContent=t(key);$('diagnosticStatus').hidden=false;},isPro:()=>pro,confirmModelOverride(selected,model){if(!pro||!$('proModelOverride').checked)return Promise.resolve(false);$('overrideRemoteModel').textContent=model;$('overrideFileModel').textContent=selected.fileModel||t('unknownFileModel');$('overrideFilename').textContent=selected.filename;return new Promise(resolve=>{pendingOverride=resolve;$('modelOverrideDialog').showModal();});},serverInfo(value){serverInfo=value;if(value&&typeof value.model==='string')$('serverModel').value=value.model;renderPro()},remote(value){remote=value;render()},upgrade(value,selected){upgrade=value;file=selected||null;render()}};
for(const name of ['about','help']){const dialog=$(name+'Dialog');$(name+'Button').onclick=()=>dialog.showModal();$('close'+name[0].toUpperCase()+name.slice(1)).onclick=()=>dialog.close();dialog.addEventListener('click',event=>{if(event.target===dialog){const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)dialog.close();}});}
const proDialog=$('proDialog'),password=$('proPassword');
$('proButton').onclick=()=>{
 if(pro){pro=false;$('proModelOverride').checked=false;finishModelOverride(false);window.RcWebUpgrade?.modeChanged?.();renderPro();return;}
 $('proError').hidden=true;
 proDialog.showModal();
};
$('closePro').onclick=()=>proDialog.close();
proDialog.addEventListener('close',()=>{password.value='';});
$('proForm').onsubmit=event=>{
 event.preventDefault();
 if(password.value!=='1111'){$('proError').hidden=false;return;}
 pro=true;
 proDialog.close();
 window.RcWebUpgrade?.modeChanged?.();
 renderPro();
};
$('proOtaFile').onchange=async event=>{
 const input=event.target,selected=input.files[0],info=serverInfo;
 input.value='';
 if(!selected||!info)return;
 try{
  if(!/\.txt$/i.test(selected.name)||selected.size>65536)throw Error();
  const text=await selected.text();
  if(serverInfo===info)window.RcWebUpgrade?.importServerInfo(text);
 }catch{
  if(serverInfo===info)serverInfo={...info,text:'',status:'otaInvalid'};
 }
 renderPro();
};
$('enableWebFirmware').onclick=()=>window.RcLocalBridge?.enableFirmware();
$('language').onchange=event=>setLanguage(event.target.value);
$('readRemote').onclick=()=>window.RcWebRemote?.read();
$('connect').onclick=()=>window.RcWebRemote?.context()?.connected?window.RcWebRemote.next():window.RcWebRemote?.connect();
$('disconnect').onclick=()=>window.RcWebRemote?.forget();
$('webChooseFile').onclick=()=>{if(!$('webChooseFile').disabled)$('webFirmware').click();};
$('webFirmware').addEventListener('change',()=>{if($('webFirmware').files[0])window.RcWebUpgrade?.selectLocalFile();});
$('proModelOverride').onchange=()=>window.RcWebUpgrade?.modeChanged?.();
let pendingOverride=null;
function finishModelOverride(accepted){const resolve=pendingOverride;pendingOverride=null;if(resolve)resolve(accepted&&pro&&$('proModelOverride').checked);$('modelOverrideDialog').close();}
$('cancelModelOverride').onclick=()=>finishModelOverride(false);
$('approveModelOverride').onclick=()=>finishModelOverride(true);
$('modelOverrideDialog').addEventListener('close',()=>{if(pendingOverride)finishModelOverride(false);});
setLanguage(language);
})();
