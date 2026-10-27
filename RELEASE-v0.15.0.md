# Remote Control Software Upgrade 0.15.0 — sequential remote updates

The phone interface replaces Disconnect with Forget. Forget closes the current connection, clears the application's selected-device reference, and invokes BluetoothDevice.forget() where supported to revoke the website's device permission. It does not claim to remove Android OS bonding. Chrome without forget() receives an explicit limitation message; full OS unpairing remains an Android Bluetooth-settings action. Forget is blocked during a firmware operation.

The selected BIN now survives completion, disconnect, Forget and a change of remote. Where IndexedDB is available, its bytes and metadata are retained locally across page reloads. There is no firmware upload to a backend. A failed storage write falls back to in-page retention. Restored bytes must match their saved SHA-256 before they can be used.

The first compatibility confirmation is bound to exact SHA-256, model, filename, version and source. The same approved BIN is automatically prepared for each subsequent remote of that exact model; no file chooser, download or checkbox is repeated. Each remote still requires an explicit Update remote press. Live model, installed firmware, battery, OTA characteristic and unchanged bytes are rechecked for every unit. Wrong-model and low-battery units are blocked without discarding the retained BIN. Choosing another BIN clears the previous approval. Server packages must still be newer for each unit; local upgrade/downgrade/reinstall policy is unchanged.

Once connected, Connect becomes Next remote. It releases the old GATT link without forgetting its permission, then opens Chrome's chooser for the next remote. Chrome requires a user gesture and per-device permission; a website cannot silently select an unknown physical remote. After the required selection, preparation uses the retained file automatically.

Successful post-update readback remains on screen and a healthy connection remains open. The application never calls forget automatically after OTA. Web Bluetooth cannot read, back up or restore Android/remote bonding keys, so this change cannot guarantee preservation of keys if firmware resets them. No physical remote was flashed during this work.

Specification: https://webbluetoothcg.github.io/web-bluetooth/ — forget() revokes origin access; requestDevice() grants access via a user choice. Neither is an Android OS unpair API.
