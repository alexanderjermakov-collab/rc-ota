# RC OTA 0.10.0 experimental — local firmware install

Adds **Local BIN upgrade / downgrade** and **Prepare local firmware**. A compatible local BIN can install an older, newer or identical firmware version. It does not require an OTA catalogue lookup or a newer server version. The existing server upgrade retains its newer-version rule.

Choose a BIN, review the SHA-256 and optional target version, prepare it, then explicitly confirm **Install on remote**. The existing Telink OTA sender, live model/service/battery checks, cached-file hash checks, progress display and post-reconnect readback are reused. The file is transferred only to the local Windows bridge. Runtime credentials and cached firmware are excluded from this archive.

Standard model/version filenames are interpreted automatically; other names allow an optional version. Filenames identifying another model are rejected. The 16-bit Telink packet sequence limits local files to 1 MiB. Only AN2101A-20UM021-001 currently has Windows transfer enabled.

For a known target version different from the starting version, successful installation is confirmed by a matching live firmware read on the same remote. An unknown target or same-version reinstall cannot prove image identity using a version read; the interface states that limit while reporting the actual firmware read back.

Physical validation: server upgrade V0.0.2 → V0.0.3 and a user-initiated local downgrade V0.0.3 → V0.0.2 were confirmed by fresh firmware and software reads on the same remote. Automated tests do not flash hardware. 53 JavaScript tests and 23 Windows tests cover source-specific version rules, confirmation, upload integrity, no catalogue dependency for local preparation and post-transfer readback.

Start: unzip the complete archive and open `windows/Start RC OTA.cmd`. Requires Python 3.10+ and Windows PowerShell 5.1. Existing transfers must finish before the launcher replaces an older running bridge.
