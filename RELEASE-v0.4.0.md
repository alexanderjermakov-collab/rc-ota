RC OTA 0.4.0 — saved remote and Android pairing

Android APK:
- Reuses existing Android pairing without creating a new bond.
- For a new remote, waits for Android to confirm pairing before opening GATT.
- Reconnects the last verified remote; a single already-paired SHARP remote can be reused on first launch.
- Separates pairing from connection and requires a live read before reporting GATT verified.

Web page:
- Reuses a saved browser-permitted remote when getDevices() is supported.
- Provides Choose another remote and displays Android pairing as unknown instead of claiming pairing succeeded.
- Retains the model-specific OTA server panel.

19 automated tests passed. APK compilation, alignment and development signature verified. Native pairing and the remote LED behavior need a physical Android retest; no Android device was attached at release time.

Firmware transfer is still not implemented. This is a development-signed diagnostic build for Android 9+.
