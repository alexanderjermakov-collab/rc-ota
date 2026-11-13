# 0.21.0 — Explicit server metadata and BIN download, 2026-11-13

From server now opens the same server workflow in normal mode and Pro. It reads OTA Info TXT first, displays the complete text, filename, version and direct BIN URL, then waits for a separate Load BIN from server action. Save BIN to phone opens the actual manufacturer BIN link independently of browser fetch access. Neither metadata reading nor BIN preparation starts firmware installation.

The catalogue model can be entered independently of the live remote name, including before BLE connection. In this session, direct browser navigation confirmed that the AN4512D-2UM-019 catalogue returns HTTP 404, while AN4512E-20UM021-008 exists and its TXT lists AN4512E-20UM021-008_V0.0.6.bin (MD5 9b3d747990f73e4d1125f6b2bcf1928d). No hardware/firmware equivalence or permanent alias is inferred. Normal mode still blocks preparation for a different live model; Pro's explicit model override allows it with the existing per-installation warning and live-device checks. Server version, hash and MAC-restriction checks remain enforced.

Metadata is requested directly at ota_info.txt. If that file is missing, a validated catalogue listing can advertise another TXT filename. Metadata parsing validates the BIN filename before constructing its manufacturer URL. Network or access errors preserve the TXT and BIN download link when known. A 404 explains that the catalogue may have moved after renaming. The optional downloaded-TXT import is available equally in both modes and is explicitly identified as imported text.

The public server panel is no longer hidden behind Pro. Diagnostics include the inspected catalogue, raw metadata and server errors. Browser access restrictions cannot be bypassed by HTML: direct TXT/BIN links remain available when cross-origin fetch is unavailable. The application does not invent a BIN filename when metadata cannot be read.

Validation uses simulated HTTP/GATT for the staged workflow, renamed catalogues, missing catalogues, alternate TXT names, rejected binary fetches, malformed paths, model override and retained package checks. Physical firmware installation was not performed.
