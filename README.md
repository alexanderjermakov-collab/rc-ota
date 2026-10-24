# RC OTA

Mobile-first, read-only Bluetooth remote diagnostics. Development version 0.3.0.

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

