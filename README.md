# RC OTA

Firmware updates and diagnostics for SHARP remote controls.

**Website:** https://alexanderjermakov-collab.github.io/rc-ota/

**[Download for Windows](https://github.com/alexanderjermakov-collab/rc-ota/releases/download/v0.12.0/RC-OTA-Windows-0.12.0.zip)** · [Release notes](RELEASE-v0.12.0.md)

## Use the app

1. Extract the complete Windows ZIP and open **RC OTA.exe**. Python is included; no separate Python installation is needed.
2. Pair your remote in Windows Bluetooth settings and keep it nearby and awake. The app reads its model, installed firmware and battery.
3. Choose **Recommended update** or **Use a local file**, prepare the package, then review and confirm installation.

Server updates require a newer version. Compatible local BIN files support upgrade, downgrade and same-version reinstall. Local files stay on your PC and go only to the local Windows app. Technical details and support reports are available in a collapsible section. Closing the browser tab leaves the app running; use **Exit** to stop it. Exit is unavailable during transfer.

## Supported hardware

Windows and supported Android Chrome browsers can install firmware on SHARP remotes exposing the OEM **Telink Legacy** OTA read/write service. This includes the AN2303B-2UM-001 preparation/transfer path; it has not yet been hardware validated. Extended OTA and Secure Boot are unsupported. A matching service does not prove firmware-image or bootloader compatibility. **AN2101A-20UM021-001** remains the hardware-tested baseline. A server upgrade **V0.0.2 → V0.0.3** and local downgrade **V0.0.3 → V0.0.2** were confirmed on one physical remote by fresh firmware/software reads. This is a preview release; broader hardware compatibility has not been established.

Before writing, the app checks the live model, installed version, battery (at least 30%, matching the OEM Telink default), supported service and cached file hashes. After transmission it reconnects and reads the firmware version. An unchanged or unknown target version cannot independently prove the installed image's identity; the app reports that limit.

The website includes **Update in Chrome**: connect the remote in a supported Android Chrome browser, prepare a server update or a local BIN, check the compatibility confirmation and press **Install firmware**. Web Bluetooth writes directly to the selected remote. Server downloads require browser HTTPS/CORS access. Local filenames must identify the exact model, for example `AN2303B-2UM-001_V0.0.15.bin`; local files stay on the device. Windows users can use the native Windows app. The [Android 0.7.0 bridge](https://github.com/alexanderjermakov-collab/rc-ota/releases/tag/v0.7.0) is a separate diagnostics app.

## Privacy and network access

No application backend, telemetry or analytics. Windows reads run locally through WinRT. The API binds only to 127.0.0.1, requires a random token and validates Host/Origin. Packaged builds store runtime files under the user's local application data directory. Source runs use `windows/.runtime/`; runtime files and firmware caches are excluded from Git and release archives.

Server checks contact firmware.umc-poland.com over HTTPS. Firmware is downloaded during explicit preparation and checked against the supplied MD5; SHA-256 identifies cached bytes. MD5 matching is an integrity check, not a signature or proof of compatibility. Browser diagnostics can be limited by Bluetooth support, HTTPS and CORS. Support exports may contain device details; review them before sharing.

## Develop and build

The source ZIP runs with Python 3.10+ and Windows PowerShell 5.1 using `windows/Start RC OTA.cmd`; no runtime Python packages are required. See [Windows details](windows/README.md).

Checks from the repository root on Windows:

```text
node --test tests/*.test.cjs
python -m unittest discover -s tests -p "test_windows*.py"
```

Tests use simulated transfers and a native dry-run that does not open or write Bluetooth. Ordinary tests never flash a remote.

To build the Windows download, install PyInstaller (0.11.0 was built with 6.22.3), then run:

```text
python scripts/package_windows.py --build-exe
```

Outputs go to `build/releases/`. GitHub Pages serves `docs/` from `main`. This release does not replace the Android APK. The Windows preview is not code-signed; managed PCs may require their normal IT approval.
