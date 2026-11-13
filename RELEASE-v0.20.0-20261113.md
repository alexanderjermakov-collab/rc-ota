# 0.20.0 — Pro Help and Share Diagnostic, 2026-11-13

Help now switches content with the active mode. Normal mode retains its operating instructions. Pro Help explains version policy, the optional local model-name override and its confirmation, additional MAC/VID/PID/software/OTA information, and retained battery, file-integrity and live-device checks. The text distinguishes unrestricted local upgrade/downgrade/reinstall from the newer-version rule still applied to server packages in both modes. No firmware transfer rules were changed in this release.

The Pro Help explicitly notes that physical MAC addresses are not exposed by Web Bluetooth. The web interface displays unavailable rather than suggesting it can derive a MAC from Chrome's device ID. VID and PID depend on the remote's PnP data and are displayed in hexadecimal and decimal when available.

Help contains both Save diagnostics and Share Diagnostic. Sharing prepares the current JSON synchronously to preserve browser user activation, then invokes the system share sheet with a JSON file where supported, a plain-text attachment containing the same JSON when JSON attachments are rejected, or JSON text on text-only implementations. The user selects the destination; the application does not email a predefined recipient. Unsupported or failed sharing offers the JSON through the existing download mechanism. User cancellation does not trigger a second share or download. Concurrent taps cannot open multiple sheets.

Reports use dated filenames and include mode/override state alongside existing device, firmware, connection, service and event details. No firmware bytes are added to the report. English and Polish Help, action labels and result messages are provided.
