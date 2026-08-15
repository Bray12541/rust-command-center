# Rust Command Center

See [CHANGELOG.md](CHANGELOG.md) for release history.

Rust Command Center (RCC) is a local-first Windows operations desktop for one or more Rust+ servers. It is an original, unofficial project and is not affiliated with Facepunch Studios.

The repository currently contains the production foundation and the first usable Rust+ vertical slice:

- Electron main/preload/renderer isolation with a strict IPC allowlist
- React, TypeScript, Vite, Tailwind CSS, Zustand, and Zod
- SQLite WAL persistence through Drizzle ORM and versioned SQL migrations
- Windows-encrypted Rust+ pairing credentials
- independent live Rust+ connection sessions with heartbeat, retry, backoff, and jitter
- a maintained Rust+ protocol adapter and a visibly labeled development simulator
- onboarding, server management, server switching, dashboard telemetry, diagnostics, settings, and tray lifecycle
- an original map-first desktop workspace with compact navigation, server/device context, map controls, and a local event console
- NSIS and portable Windows build targets
- In-app update checks, download progress, and restart-to-install for installed builds

Map, team, devices, alerts, raid correlation, automations, Discord, vending intelligence, wipe planning, and analytics are later phases. Their navigation surfaces explicitly report that they are unavailable; they do not display fabricated data or nonfunctional controls.

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

Install the NSIS build once to receive future releases inside the app. Installed builds check the public GitHub release feed, let the player download an update, display progress, and ask before restarting to install it.

Portable executables cannot safely replace themselves while running, so portable mode links to the GitHub Releases page instead. Use the installer for the no-redownload update experience.

Release builds generate `latest.yml` and an installer block map beside the executables. Push a version tag such as `v0.2.0` to run the Windows release workflow. It creates a draft GitHub release; review the matching section in [CHANGELOG.md](CHANGELOG.md), add signing credentials when available, and publish the draft. Players receive the release only after it is published.

## Architecture

The renderer is UI-only. Rust+ sockets, credentials, SQLite, logs, lifecycle, and tray services stay in the Electron main process. The preload publishes a small frozen API, and both sides validate shared contracts.

See:

- [Architecture](docs/ARCHITECTURE.md)
- [Rust+ capabilities](docs/RUST_PLUS_CAPABILITIES.md)
- [Security and threat model](docs/SECURITY.md)
- [Implementation status](docs/IMPLEMENTATION_STATUS.md)
- [Contributing](CONTRIBUTING.md)

## Privacy

RCC requires no product account and sends no application analytics. Pairing credentials are encrypted with the operating system. Crash dumps are not uploaded. Live Rust+ traffic still goes to the paired Rust server, and optional integrations added later will have their own explicit disclosures.

## Screenshots

Release screenshots belong in `docs/screenshots/`. No placeholder screenshots are presented as product output.
