# RC OTA 0.12.0 — SHARP Telink Legacy and Android Chrome updater

The website now includes visible server/local preparation and an explicit Install firmware button for Chrome Web Bluetooth, including Android Chrome. A separate confirmation is required; connecting, checking the server and preparing files never write firmware. Local BIN files support upgrade, downgrade and reinstall. Server packages must be newer, match the exact model directory/filename and pass the catalogue MD5. Browser network/CORS restrictions can prevent server downloads; exact-model local BINs are an alternative.

Windows no longer restricts OTA to AN2101A-20UM021-001. Both transports require a live exact SHARP model, at least 30% battery and the OEM Telink Legacy service 1912/characteristic 2b12 with read and write-without-response. New-model local filenames must identify the exact remote, for example AN2303B-2UM-001_V0.0.15.bin or AN2303B-2UM-001.bin. Firmware for another SHARP model is not interchangeable.

This implements the shared Legacy transport used by the OEM SHARP updater, not every Telink chip/protocol. Extended OTA and Secure Boot are unsupported. The same GATT UUID alone cannot establish chip, flash layout, bootloader or image compatibility. The final compatibility confirmation remains required. Metadata with a MAC restriction is blocked in the browser because Web Bluetooth does not expose the address.

AN2101A Windows hardware validation from earlier releases remains the baseline. AN2303B-2UM-001 successfully exposed the Telink service, model, version V0.0.15 and battery in the supplied Android report; no AN2303B firmware transfer has been physically validated. Browser installation success is only shown after a fresh model/version read matches a known target; otherwise the result remains unconfirmed. Unknown-version files cannot receive version-based installation confirmation.

The browser uses OEM 20-byte Legacy frames, CRC16, flow-control reads every eight non-final packets and a 300-second transfer limit. Timed-out browser operations disconnect rather than issuing further writes. Packet indices reserved for OTA commands cannot be used as firmware data. SHA-256 binds the review to the exact downloaded/selected bytes. No manufacturer binaries, runtime session credentials or private support reports are included.

Protocol reference: https://doc.telink-semi.cn/doc/en/software/res/sdk/ble/b80_ble_single_connection_en/b80_ble_single_connection_en/

Live manufacturer check on 27 October 2026: AN2303B-2UM-001_V0.1.0.bin responds HTTP 200 (94,932 bytes). The binary response has no Access-Control-Allow-Origin header, so direct cross-origin browser preparation is currently blocked. The browser offers an exact-model manual download link followed by local-file preparation; Windows can download the server package natively.
