# 0.19.0 — Pro model rename and local file selection, 2026-11-13

From phone is now an explicit button that opens the file picker synchronously. A BIN can be selected before connecting a remote. Its filename remains visible even if preparation fails, and selection alone never starts installation. Selecting before connection prepares the file after a verified live read.

Unlocked Pro adds **Allow a different model name (local BIN)**. Normal mode retains its exact filename/model requirement. With this option enabled, engineering BIN names can differ from the live model or use an unrecognized naming convention. The BIN must still have a .bin extension and satisfy the existing size, battery, live identity, hash and Telink Legacy service/characteristic checks. No model aliases or hardware equivalences are inferred.

Before each overridden installation, a separate dialog shows the connected model, model parsed from the BIN name (if available), and full filename. The user must affirm installation after the incompatibility warning. Cancelling, dismissing the dialog, leaving Pro, or losing the connection prevents writes. No cross-model batch approval is persisted; overridden BINs remain only in the current session. Retained local bytes can be rebound to another live model in Pro, with new identity checks and confirmation. Server package matching is unchanged.

Transfer remains bound to the actual model and version read before preparation; a different device or changed identity cannot silently receive the prepared image. After transfer, the same remote may report either its previous model or the target model parsed from the filename. A known changed target version is still required to claim a verified installation. Unrecognized names or same/unknown versions do not prove an installed image's identity.

Example exercised with simulated GATT: source AN4512D-2UM-019 and filename AN4512E-20UM021-008_V0.0.16.bin. This is an engineering override, not a statement that those firmware images/hardware are compatible. No physical remote was flashed during development.
