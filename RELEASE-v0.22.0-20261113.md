# 0.22.0 — Index-first direct server workflow and one diagnostic action

Help now exposes only Share Diagnostic. The existing system share operation and downloadable-report fallback are retained; the duplicate Save diagnostics button and its app handler have been removed.

From server first reads the manufacturer's index, then follows its explicit OTA Info TXT URL. It no longer starts by guessing ota_info.txt. The supplied index.html and index(1).html examples contain two bare URLs; these are parsed directly, including blank lines and the HTTP links in the AN4512E example. HTTP manufacturer links are upgraded to HTTPS for the HTTPS application. HTML anchor indexes, including relative links with a known base URL, are supported without executing markup. Multiple ambiguous BIN/TXT candidates are rejected.

As soon as the index is read, the app displays its text, the BIN filename, direct BIN URL and explicit TXT URL. Those direct links remain available if subsequent TXT reading fails. Automatic preparation still requires valid TXT metadata and checksum verification. Open downloaded index allows the same HTML app to parse a locally saved manufacturer index, determine its catalogue, and then attempt TXT reading directly. Normal and Pro share this workflow. No proxy service is deployed or referenced by this release.

Reading an index is separate from browser permission to read a different origin. This implementation does not bypass the browser's same-origin/CORS rules. Fully automatic cross-origin reading requires suitable responses from the manufacturer server, or hosting the application on the same origin. Direct browser links and local index/TXT imports remain available when fetch is blocked. No unverified BIN filename is invented.

The provided diagnostic reports AN4512E-20UM021-008 at V0.0.7, whereas the supplied index lists V0.0.6. That is a downgrade and is distinct from a network/download failure. Existing firmware version policy has not been changed.
