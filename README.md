# RC OTA

Mobile-first, read-only Bluetooth remote diagnostics. Development version 0.5.0.

## Open the app

https://alexanderjermakov-collab.github.io/rc-ota/

On Android, open the HTTPS page directly in Chrome, enable Bluetooth, keep the remote awake, and select **Connect remote**. If the remote requires pairing or a discoverable mode, follow its instructions. A remote already connected to a TV may not accept a second central connection. Browser and device support varies.

## Available now

- Default the device chooser to SHARP remotes; show all BLE devices only when explicitly selected.
- Confirm permitted GATT services and remote identity before reporting a verified connection; device selection and opening a GATT link are not sufficient.
- Read available standard model, firmware, software and battery characteristics.
- List permitted services and characteristics; the browser only exposes services requested by this page, not every service on the device.
- Inspect a local BIN/ZIP file and calculate SHA-256 without uploading it.
- Export a diagnostic JSON file for troubleshooting.
- Responsive phone and TV interface.

**Firmware transfer, automatic/server OTA, signature verification, and recovery are not implemented.** The page does not write BLE characteristics. A selected firmware file is not sent to the remote. This is an inspection prototype, not a complete replacement for RemoteUpdate.

## Privacy

No application backend, telemetry, or analytics. Bluetooth readings and selected files are processed locally. Diagnostic exports can contain device details: inspect them before sharing. GitHub Pages serves the page and handles normal web requests.

## Android TV bridge

The UI retains support for the separate locally packaged RC OTA Android BLE Bridge. The public website does not install a bridge or gain native Bluetooth access by itself. Native bridge messages are accepted only under the packaged appassets HTTPS origin. The manufacturer's app shortcut is shown only inside that native app. This repository contains the web test version; extracted OEM APKs, firmware binaries, and device logs are excluded.

## Development

Static site: `docs/`. No build step or external dependencies.

Run tests with Node.js:

```sh
node --check docs/app.js
node --test tests/bridge.test.cjs
```

GitHub Pages serves the `docs` directory on the `main` branch. Tests use simulated Bluetooth and MessagePort objects; they do not replace a physical Android phone or remote test.

## OTA server metadata

Version 0.3 adds a model-specific OTA panel for firmware.umc-poland.com. It reads the two-URL listing and the name/version/md5sum/scenario/mac metadata format recovered from RemoteUpdate. It displays the server version, installed version, comparison and source when the server actually responds. No firmware binary is fetched. Plain HTTP URLs are upgraded to HTTPS; the website does not bypass HTTPS, CORS, server authorization or redirects. An unavailable server or missing model is shown as Unknown, never as no update or a fabricated firmware version. A root-directory probe returned HTTP 403; this does not establish the status of any model-specific directory. A firmware model number is required to confirm a real available version.

Android bond/pairing state is not exposed by Web Bluetooth. This app verifies a GATT session and does not represent it as completion of the Android system pairing flow. Physical phone/remote behavior still requires a hardware retest.



## Version 0.4.0: saved pairing and Android app

Download the development-signed APK from https://github.com/alexanderjermakov-collab/rc-ota/releases/tag/v0.4.0 . Android 9 or later is required. Allow Nearby devices (or Location on older Android); confirm Android system pairing if requested. A phone is the host and the SHARP remote is the device to choose.

- Android checks getBondState(), skips createBond() when BOND_BONDED, and otherwise waits for ACTION_BOND_STATE_CHANGED before starting GATT. It does not automatically confirm a PIN or bypass a system pairing dialog.
- Successful device selection, stored pairing, GATT link, service discovery and live reads are separate stages. GATT verified requires a successful live characteristic read.
- The last successfully read paired remote is saved locally and reconnected on reopening the app. On first use a single already-paired SHARP remote is reused; if several are paired the user chooses one.
- The browser saves the permitted device ID after successful verification and uses getDevices() to reconnect without a new chooser where supported. It cannot initiate or confirm Android system bonding; this is displayed explicitly. Use Choose another remote to change devices.
- A sleeping or unavailable remote is never labelled connected just because it is saved or paired.

Validation: 19 automated web/OTA tests passed; APK compiled, aligned and signature verified. No Android device was attached during this release, so the pairing flow, LED behavior and native radio reconnect require physical validation. Firmware flashing remains unimplemented.

Native source is in android/. To reproduce the Windows development APK build, point RCOTA_ANDROID_TOOLS to a directory containing android.jar (API 34), java/<JDK17>/, r8-8.3.37.jar, apktool_3.0.3.jar, uber-apk-signer-1.3.0.jar, and framework/. Run android/build.py with Python and Pillow installed. Tool binaries and signing keys are not included in this repository.

## Version 0.5.0: automatic OTA availability

After a verified remote reconnects and its exact model is read, the application automatically checks firmware.umc-poland.com for model-specific metadata and sends a HEAD request to the listed BIN file. The UI shows the installed version, server version, comparison, binary availability, source URLs, MD5 listed by the server, scenario and MAC restriction. It does not fetch the firmware body or flash the remote. Missing model, HTTP errors and unsupported HEAD checks remain Unknown or Could not verify rather than being reported as no update.

The Android bridge uses the fixed manufacturer HTTP/HTTPS host and the original RemoteUpdate catalogue format. Cleartext networking is permitted only for firmware.umc-poland.com, as used by the original application; all other cleartext domains are disabled. Redirects are limited to the same host, and HTTPS downgrades are rejected. This is the manufacturer's web interface, not an implemented FTP client. The web page uses HTTPS and may be limited by CORS. No server credentials are embedded.

Automatic requests are deduplicated per verified remote/model/version, and disconnection invalidates pending results. Pairing is reused as in 0.4.0; it is never equated with a live connection. Validation: 24 automated tests passed; Android APK compiled and signature verified. Physical Android pairing and real model-specific server availability still require device testing.


## Version 0.5.1: Chrome reconnect

Web restoration enumerates previously granted devices even when local storage has no successful connection ID. A single permitted SHARP remote is reused; multiple devices require selection. The selected ID is remembered before connection, so a sleeping remote does not erase its browser permission. Diagnostics show getDevices support and permission counts. System pairing and site permission remain separate. This is a website-only release; APK v0.5.0 remains available.
