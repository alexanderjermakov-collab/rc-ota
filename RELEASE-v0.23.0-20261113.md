# 0.23.0 — 2026-11-13

Restore direct OTA Info TXT reading when the catalogue index is inaccessible. Add a separate TXT-only retry using the exact indexed HTTPS URL. Retain received TXT on validation errors, without enabling an invalid firmware package.

When JavaScript cannot read TXT, show its HTTPS URL in a sandboxed server iframe inside the application. This is a direct view, not parsed metadata; binary loading remains disabled until metadata can be read and validated. No proxy is used. CSP frame access is limited to the manufacturer host.

Validation: automated regression tests for index failure, independent TXT retry, raw TXT retention and the restricted viewer. Live browser verification recorded separately; no physical firmware transfer performed.
