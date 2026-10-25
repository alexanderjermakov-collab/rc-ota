Android BLE Bridge for SHARP RCU and SHARP SOLAR RCU. The HTML interface runs inside the Android APK; ordinary Chrome remains subject to its Web Bluetooth limitations.

On bridge handshake the app reads Android bonded devices and directly connects to the remembered supported remote, or the sole supported bonded remote. With two supported remotes and no valid saved selection, it asks the user to choose. Names are case-insensitive and whitespace-normalized. Existing bonds skip scanning and createBond. Stale saved addresses fall back to current supported bonded devices.

Restoration waits for both resumed Activity and HTML handshake, fixing the early-start/page-load disconnect race. Android 12+ Connect permission is sufficient for bonded remotes; scan permission is requested separately for discovering new remotes. Standard live information/battery reads include Android 13+ value callbacks. Diagnostics include native stages, read status and permission availability. No firmware flashing is implemented. Manufacturer OTA metadata checks remain model-dependent and run after verified reads.

Validation: 32 automated browser/bridge/OTA tests; 20 native selection/lifecycle policy checks; APK compiled, aligned and signature verified. No physical phone or TV was connected for radio validation. Install the APK and launch RC OTA rather than the Chrome shortcut.
