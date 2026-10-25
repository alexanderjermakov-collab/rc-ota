RC OTA 0.5.0 — automatic reconnect, read and OTA availability

Install the APK on the Android phone running the app. The paired device is the SHARP remote.

- Reuse saved Android pairing without pairing again; reconnect and verify live GATT reads.
- Automatically read model, firmware/software and battery data where available.
- Automatically check firmware.umc-poland.com after the verified model is read.
- Display server version, installed version, comparison and active BIN availability.
- Native server requests use the original manufacturer web interface and are not subject to browser CORS restrictions.
- Prevent duplicate requests and discard stale results after disconnection.

24 automated tests passed. Android APK compiled, aligned and signature verified. Live pairing, remote LED behavior and real model-specific server availability have not been verified on a physical Android phone for this release.

No firmware flashing is implemented. No full firmware binary is downloaded. This is a development-signed Android 9+ diagnostic build.
