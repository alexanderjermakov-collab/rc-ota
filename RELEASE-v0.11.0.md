# RC OTA 0.11.0 — customer interface and Windows app

The updater now follows three steps: choose the paired remote, choose recommended or local firmware, then review and install. The model, installed version and battery are shown first. Hashes, Bluetooth services, manual model lookup and logs are under Technical details. Local files still support upgrade, downgrade and same-version reinstall; server updates still require a newer version.

The Windows ZIP contains RC OTA.exe and its supporting files. Extract the entire ZIP and open the EXE; Python does not need to be installed. The source ZIP retains the Python launcher for development. Runtime session credentials, firmware caches, private device exports, manufacturer APKs and extracted OEM sources are excluded.

The public GitHub Pages page provides the Windows download and separate read-only browser diagnostics. Firmware installation uses the local Windows app; GitHub Pages does not provide native Windows Bluetooth access or flash the remote itself. The existing Android 0.7.0 release remains a separate diagnostics bridge.

Hardware validation before this UI release: server update V0.0.2 → V0.0.3 and local downgrade V0.0.3 → V0.0.2 were confirmed on the same AN2101A-20UM021-001 by fresh firmware/software reads. This remains a preview release tested on one remote. The existing model, battery, checksum and explicit-installation checks are retained.

The packaged app uses a per-user local runtime directory. Its API is loopback-only and requires a random session token. Exit is disabled while a transfer is in progress. Closing the browser tab leaves the app running; use Exit to stop it.
