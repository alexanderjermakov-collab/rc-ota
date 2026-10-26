# RC OTA 0.9.0 experimental — Windows

This local Windows release adds a prominent **Upgrade Firmware** button next to Check server. The button downloads and verifies the exact model package, then opens a review area. An eligible newer package and an explicit review checkbox expose **Install on remote**, which invokes the experimental Telink OTA sender. The interface shows progress and verifies installation by rereading the firmware version after reconnect.

The sender is enabled only for AN2101A-20UM021-001 with the OEM Telink service/characteristic, a newer version, sufficient battery and verified file hashes. A matching catalogue URL and ota_info.txt filename are required; differences are displayed with the exact two names. Same-version reinstalls and downgrades are not offered.

Validation: 50 JavaScript tests and 17 Windows tests passed. The packet CRC was checked against a known MODBUS vector; the PowerShell sender's offline dry-run matched the packet reference including partial padding and the end frame. A read-only physical probe found service 00010203-0405-0607-0809-0a0b0c0d1912 and characteristic 00010203-0405-0607-0809-0a0b0c0d2b12 with Read and WriteWithoutResponse support. It reported zero writes.

**Experimental limitation:** no firmware transfer has been executed on physical hardware. Successful installation cannot be claimed from the offline and read-only tests. The UI explains this before offering the final install action. The public website and Android APK are separate and were not published as part of this Windows ZIP.

Unzip the complete archive, then open `windows/Start RC OTA.cmd`. Python 3.10+ and Windows PowerShell 5.1 are required; no Python packages are installed. Runtime tokens and firmware caches are excluded from the archive.
