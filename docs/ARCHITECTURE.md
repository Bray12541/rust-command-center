# Architecture

## Process boundaries

RCC uses three security and responsibility boundaries:

1. `src/main` owns Electron lifecycle, SQLite, encrypted credentials, Rust+ sockets, connection recovery, structured logs, diagnostics, and the system tray.
2. `src/preload` exposes only the frozen `RustCommandCenterApi`. It does not expose Node.js, Electron primitives, filesystem access, or arbitrary IPC.
3. `src/renderer` renders validated application state. It never receives a player token and cannot open sockets or files directly.

`contextIsolation`, renderer sandboxing, and disabled Node integration are mandatory window settings.

## Shared contracts

`src/shared` contains Zod schemas, DTOs, IPC channel names, branding, and normalized application events. Main handlers validate incoming data. Preload validates returned data and event payloads before delivering them to React.

Feature services communicate through `AppEventBus`; protocol messages do not drive React directly. Current normalized events cover server status, telemetry, and settings. New features should add narrow discriminated events rather than broadcast a complete application snapshot.

## Persistence

The main process opens one better-sqlite3 connection with foreign keys, WAL, busy timeout, and normal synchronous mode. Migrations are explicit SQL files tracked in `_migrations`. Drizzle provides typed queries; migrations are not generated or applied from the renderer.

Core tables currently include settings, server profiles, telemetry envelopes, and audit entries. Credentials are deliberately absent. External identifiers remain strings where JavaScript number precision is unsafe.

## Rust+ service

`RustPlusProvider` is the anti-corruption boundary around protocol libraries. The live provider adapts the maintained RustWire fork. The mock provider exists only in unpackaged development and stamps every observation with `source: "simulation"`.

`RustPlusConnectionManager` owns one session per server. Sessions have independent status, heartbeat, exponential retry, jitter, telemetry, and cleanup. A failing profile cannot tear down another profile. The next core increment should add centralized prioritized polling and durable protocol event normalization before map, chat, or device features consume the provider.

## Renderer modules

Navigation is metadata-driven. Implemented Phase 3 modules register real routes. Later modules render a shared unavailable state with a technical prerequisite. Private components are not imported across feature folders; common UI belongs in `design-system` or `features/common`.

Zustand stores transient renderer state plus validated copies of main-process data. Persistent settings remain authoritative in SQLite.

## Startup order

1. Acquire the single-instance lock.
2. Open structured logging.
3. Open SQLite and apply migrations.
4. Construct repositories, vault, providers, and connection manager.
5. Create the secure window, tray, and IPC handlers.
6. Restore auto-connect server sessions asynchronously.
7. Lazy-load feature data when screens request it.

## Packaging

TypeScript compiles main and preload to CommonJS in `dist/main`; Vite builds the renderer into `dist/renderer`. electron-builder unpacks the native SQLite module and copies SQL migrations into application resources. NSIS and portable targets share the same hardened application bundle.

The main-process update service owns GitHub release checks and `electron-updater`; the renderer receives only validated update state and narrowly scoped check, download, install, and releases-page IPC methods. Installed NSIS builds support differential in-app updates. Portable builds never attempt self-replacement.
