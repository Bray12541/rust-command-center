# Rust Command Center

See [CHANGELOG.md](CHANGELOG.md) for release history.

Rust Command Center (RCC) is a local-first Windows operations desktop for one or more Rust+ servers. It is an original, unofficial project and is not affiliated with Facepunch Studios.

The repository contains a usable, map-focused Rust+ operations workspace:

- Electron main/preload/renderer isolation with a strict IPC allowlist
- React, TypeScript, Vite, Tailwind CSS, Zustand, and Zod
- SQLite WAL persistence through Drizzle ORM and versioned SQL migrations
- Windows-encrypted Rust+ pairing credentials
- independent live Rust+ connection sessions with heartbeat, retry, backoff, and jitter
- a maintained Rust+ protocol adapter and a visibly labeled development simulator
- onboarding, server management, favorites, fast switching, combined status, diagnostics, settings, and tray lifecycle
- live map/monuments/world events, teams, team and clan chat, vending intelligence, devices, storage, and CCTV/PTZ support
- local pins/routes/zones, team tasks, notes, checklists, shopping, calculators, event history, and JSON backup/import
- guarded automation with native notifications, chat/device actions, quiet hours, cooldowns, and HTTPS webhooks
- a single collapsible sidebar, full map canvas, bottom operations dock, and contextual drawers
- NSIS and portable Windows build targets
- in-app update checks, channels, release information, download progress, and restart-to-install for installed builds
- opt-in Discord alerts and role-gated status commands, encrypted profile sync, local mobile PWA, and shared workspace synchronization
- permission-gated declarative community extensions and themes with no arbitrary plugin JavaScript
- a separately enabled Server Owner workspace for WebRCON, fleet health, moderation, local configuration/backups, schedules, performance, and uMod/Oxide events

RCC displays only fields returned by Rust+, explicitly configured Server Owner connections, authenticated plugin events, or data intentionally created in the local workspace. It does not turn player pairing into administrator access or infer unavailable live data.

## Requirements

- Windows 10 or 11
- Node.js 24 or newer for development
- npm 11 or newer
- Google Chrome only when using the upstream FCM pairing CLI

## Development

```powershell
npm install
npm run dev
```

The development build enables an opt-in training server. It generates deterministic simulation telemetry and labels it everywhere. Packaged builds reject simulation profiles.

Pair a live server with the maintained upstream flow:

```powershell
npx @rustwirebot/rustplus.js fcm-register
npx @rustwirebot/rustplus.js fcm-listen
```

Then enter the pairing notification's server address, app port, Steam ID, and player token in RCC. RCC never requests a Steam password.

## Quality commands

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

## Windows packages

```powershell
npm run package
```

Outputs go to `release/`. The builder produces an assisted NSIS installer and a portable executable. Signing is intentionally not configured; see [Security](docs/SECURITY.md) before distribution.

## In-app updates

Install the NSIS build once to receive future releases inside the app. Installed builds check the public GitHub release feed, support stable/beta preferences and skipped versions, display release information and progress, and ask before restarting to install it.

Portable executables cannot safely replace themselves while running, so portable mode links to the GitHub Releases page instead. Use the installer for the no-redownload update experience.

Release builds generate `latest.yml` and an installer block map beside the executables. For each version, create a matching GitHub release and upload the installer, installer block map, portable executable, and `latest.yml`. Review the matching section in [CHANGELOG.md](CHANGELOG.md), add signing credentials when available, and publish the release. Players receive the release only after it is published.

## Architecture

The renderer is UI-only. Rust+ sockets, credentials, SQLite, logs, lifecycle, and tray services stay in the Electron main process. The preload publishes a small frozen API, and both sides validate shared contracts.

See:

- [Architecture](docs/ARCHITECTURE.md)
- [Rust+ capabilities](docs/RUST_PLUS_CAPABILITIES.md)
- [Security and threat model](docs/SECURITY.md)
- [Implementation status](docs/IMPLEMENTATION_STATUS.md)
- [Connected services](docs/CONNECTED_SERVICES.md)
- [Server Owner mode](docs/SERVER_OWNER.md)
- [Contributing](CONTRIBUTING.md)

## Privacy

RCC requires no product account. Pairing and integration secrets are encrypted with the operating system. Analytics and sanitized error reporting are independently disabled by default and require an explicit endpoint and consent. Live Rust+ traffic goes to the paired Rust server; Discord, synchronization, webhooks, mobile access, RCON, and plugin bridging run only when the player configures and enables them.

## Screenshots

Release screenshots belong in `docs/screenshots/`. No placeholder screenshots are presented as product output.
