RC OTA 0.7.0: local HTML in an external Android browser, backed by an Android BLE foreground service.

Install the APK, open RC OTA and select Start bridge and open Chrome. Grant Nearby devices. The launcher opens Chrome on http://127.0.0.1:18764 with a per-service authorization token; the HTML interface does not use Web Bluetooth. On a TV without Chrome, Open TV browser explicitly uses installed TV Bro. No browser is silently installed or made default.

Supports already-paired SHARP RCU and SHARP SOLAR RCU. The remembered supported remote or sole supported remote reconnects directly without scanning or bonding. Multiple paired supported devices are selected in HTML. New devices must first be paired through Android settings. The foreground notification stops the bridge. No boot autostart and no firmware writes.

The bridge binds only to loopback. BLE/OTA routes require a bearer token, exact Host and same Origin when present. Tokens are stored in browser sessionStorage after removal from the URL fragment; no cross-origin API access is enabled. Page refresh retains the native connection. OTA metadata requests use the existing fixed-host native client.

Hardware validation on SHARP Google TV (Android 14) over ADB and UART COM7 115200: native GATT discovery, four standard reads, display in TV Bro with Web Bluetooth absent, disconnect/reconnect and page reload. Tested remote model AN2101A-20UM021-001, firmware/software V0.0.3. Its model catalogue request returned HTTP 404, shown as unknown rather than no update. SHARP SOLAR RCU selection is unit-tested; physical Solar remote and phone Chrome testing remain outstanding.

Automated validation: 41 JavaScript tests, 20 native selection checks, 14 HTTP transport checks. APK alignment and signature verified.
