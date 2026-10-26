# RC OTA 0.11.0 on Windows

Customer download: extract the entire Windows ZIP and open **RC OTA.exe**. Python is bundled. Source download: use **Start RC OTA.cmd** with Python 3.10+ and Windows PowerShell 5.1. Pair the remote in Windows before reading it; Chrome opens the interface automatically.

The local Windows bridge reads the standard Bluetooth Device Information and Battery characteristics through WinRT. It avoids the Chrome service-discovery failure observed on this PC. With one paired supported remote it reads automatically. With several, choose a remote and select **Read remote**.

The customer view shows model, firmware and battery. Software, hardware, manufacturer, address, services and logs are under Technical details. Reads refresh every 30 seconds while enabled. Every characteristic value comes from an uncached read; failures preserve earlier values, explicitly marked as historical. Native read sessions close after each read; the UI does not claim a continuously open GATT link.

**Stop automatic reads** stops further reads and preserves the last values. **Stop Windows bridge** closes the local server. Neither action removes Windows pairing or disconnects Windows HID usage. The packaged app runs without a console; use Exit to stop it. Source-console users can also close the launcher console. The browser page stops polling while hidden; the bridge itself continues its reads until stopped.

The HTTP server binds only to 127.0.0.1 on a dynamically selected port. API requests require a random per-launch bearer token, supplied via a URL fragment, removed from the address bar and kept in tab session storage. Host and Origin checks reject other sites and DNS rebinding; external origins receive no CORS access. Source-session state in `windows/.runtime/` and packaged-app state in the user's local application data directory are local; runtime data is excluded from Git and release archives. Do not share the authorization URL or session file.

Ordinary reads and server checks never write firmware. Server checks fetch manufacturer metadata and send HEAD requests to binary URLs, using HTTPS on the fixed manufacturer host. Unavailable metadata stays Unknown.

The **Upgrade Firmware** button prepares a package: it refreshes the exact model catalogue, requires the BIN URL and metadata filename to agree (including case), downloads up to 16 MiB and verifies the server MD5. Verified bytes are cached under `.runtime/firmware/` with a SHA-256 filename. A successful check does not establish a package signature's authenticity.

An experimental Windows Telink OTA sender is implemented for **AN2101A-20UM021-001**. It uses the protocol recovered from the OEM Android Device.java / OtaPacketParser.java: prepare 00ff, start 01ff, 16-byte payloads in 20-byte frames with a 16-bit sequence and CRC-16/MODBUS, a flow-control read every eight non-final packets, and the end frame with the final index and its complement. Packets are limited to a 1 MiB image. The overall transfer timeout is 300 seconds.

Server installation was verified on one physical AN2101A-20UM021-001: V0.0.2 → V0.0.3, with firmware and software versions confirmed by a fresh read. Local downgrade V0.0.3 → V0.0.2 was also confirmed on the same remote after the user initiated installation from the UI. Same-version reinstall logic is tested with simulated writes. The build remains experimental.

After successful preparation, a strictly newer server version, no unresolved MAC restriction, a supported model, at least 30% battery (the OEM Telink default), and a successful OTA-service probe are required. The UI then displays a review checkbox and **Install on remote**. Only that explicit, confirmed action invokes the writer. Immediately before writing, native code rechecks the live model, installed version, battery and cached file hashes. Ordinary reads and bridge-stop actions are disabled during transfer. Installation is reported successful only after a fresh post-reconnect read reports the target version on the same model. Sending packets alone is not installation confirmation. No pairing, Chrome flags or drivers are modified.

## Local BIN: upgrade, downgrade or reinstall

Select **Local BIN upgrade / downgrade**, choose a compatible `.bin` (16 bytes–1 MiB), then select **Prepare local firmware**. Standard `MODEL_V0.0.2.bin` filenames supply the target version automatically; for other filenames you can enter the intended version or leave it blank. Local files go only to the authenticated loopback bridge, never to the manufacturer server.

Local installation bypasses the newer-version rule: older, newer and identical versions are allowed. It still checks the live model, compatible OTA service, battery, file size and unchanged file hashes. A filename explicitly identifying a different model is rejected. SHA-256 verifies the uploaded bytes; the locally calculated MD5 is not presented as a manufacturer's checksum or proof of compatibility. Confirm that the raw BIN is for the selected model, then select **Install on remote**.

The same tested Telink sender handles both sources. Local preparation does not call the server catalogue. If the intended version is known and differs from the previous version, a matching live read confirms the result, including downgrades. With no known target version, or a same-version reinstall, the UI displays the actual version read back but does not claim that the exact image identity was independently verified. Server installation continues to require a newer version.

Development checks:

```
python -m unittest discover -s tests -p "test_windows*.py"
node --test tests/bridge.test.cjs tests/local.test.cjs tests/ota.test.cjs tests/ota-auto.test.cjs
```
