# 0.18.0 — Web connection flow, 2026-11-13

The existing HTML application continues to run directly in Android Chrome over HTTPS using Web Bluetooth. APK download and BLE Bridge launch links have been removed from its Pro panel. The firmware reader, file selection, server preparation, exact-model checks, battery checks, explicit installation confirmation and transfer protocol are retained.

Opening the page now restores browser permissions without automatically opening a GATT connection. Connect starts the connection when the user is ready. Android connection/read deadlines allow time for system pairing confirmation (45/30 seconds). An early disconnect preserves connection-error diagnostics and displays recovery guidance in English and Polish instead of losing the error to the cancelled asynchronous attempt. Chrome reconnects use the retained permission unless a security error requires a fresh chooser.

Help describes pairing initiated from the page, Android pairing notifications, use of an existing working pairing, and recovery when Android pairing works but Chrome fails. Back + Home instructions are explicitly conditional on the remote's own model instructions.

AN4512D-2UM-019: the user confirmed that the native BLE Bridge can read its model and software version. Recorded Chrome attempts failed with a remote key missing/encryption error. The web changes improve user control, consent timing and diagnosis; they do not establish that the underlying key problem is fixed. HTML cannot manage Android's stored bond keys or replace Chrome's Bluetooth implementation. Hardware validation of the web connection and OTA compatibility remains required. No firmware was flashed during development.
