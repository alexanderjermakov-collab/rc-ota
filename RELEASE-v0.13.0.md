# RC OTA 0.13.0 — one-screen phone interface

The phone website now opens directly into the updater. A single compact screen contains Bluetooth connection, a Read button, exact remote model, current firmware and battery, local/server firmware selection, confirmation and Update remote. Choosing a local file prepares it automatically; installing still requires explicit confirmation and a separate final button press.

About is the only secondary window. It contains the application version, short upgrade instructions and Save diagnostics. Raw services, logs, checksums, model lookup, Windows landing-page blocks and developer controls are removed from the customer view. Diagnostic exports retain the underlying readings and logs.

The shared Telink sender and installation checks from 0.12.0 are retained. This is a web-interface release; the Windows download remains at 0.12.0. Manufacturer CORS restrictions still apply to direct server preparation. For AN2303B the server-download fallback remains available; the saved BIN can be selected locally.
