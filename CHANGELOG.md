# Changelog

All notable changes to Rust Command Center are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses [Semantic Versioning](https://semver.org/).

## [0.2.0] - 2026-08-15

### Added

- Added an in-app update center for installed Windows builds with update checks, download progress, and restart-to-install controls.
- Added automatic background update checks against GitHub Releases.
- Added a direct releases link for portable builds, which cannot safely replace themselves while running.

### Changed

- Replaced the dense icon rail and separate operations panel with one collapsible navigation sidebar.
- Simplified the map toolbar and moved secondary capabilities behind a single More menu.
- Collapsed the local activity console by default to keep the map as the primary workspace.

## [0.1.1] - 2026-08-15

### Fixed

- Corrected the production renderer path and generated relative asset URLs so packaged and portable Windows builds load the application instead of showing a black screen.
- Added packaged-renderer load diagnostics and a window-display fallback for failed startup navigation.

### Changed

- Rebuilt the Windows installer and portable executable with the corrected production startup path.

## [0.1.0] - 2026-08-15

### Added

- Map-first Rust operations dashboard with server, team, monument, shop, death, and device views.
- Secure Electron main/preload/renderer separation with context isolation and validated IPC boundaries.
- Local SQLite persistence for server profiles, settings, event history, and device state.
- Rust+ companion connection service foundation, structured logs, hotkey controls, and Windows packaging.
- NSIS installer and standalone portable Windows builds.

[0.1.1]: https://github.com/Bray12541/rust-command-center/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/Bray12541/rust-command-center/releases/tag/v0.1.0
[0.2.0]: https://github.com/Bray12541/rust-command-center/compare/v0.1.1...v0.2.0
