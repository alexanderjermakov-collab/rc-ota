# RC OTA

Mobile-first, read-only Bluetooth remote diagnostics. Development version 0.2.0.

## Open the app

https://alexanderjermakov-collab.github.io/rc-ota/

On Android, open the HTTPS page directly in Chrome, enable Bluetooth, keep the remote awake, and select **Connect remote**. If the remote requires pairing or a discoverable mode, follow its instructions. A remote already connected to a TV may not accept a second central connection. Browser and device support varies.

## Available now

- Select a BLE device and connect over Web Bluetooth.
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
