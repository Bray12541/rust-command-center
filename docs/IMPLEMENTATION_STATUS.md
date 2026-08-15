# Implementation Status

## Complete in 0.1 foundation

- Phase 1: Electron/React/TypeScript/Vite/Tailwind foundation
- secure main/preload/renderer separation and validated IPC
- SQLite WAL database and first migration
- Pino structured rotating-at-startup logs with redaction
- encrypted credential vault
- secure application window, single instance, tray, startup preference, and close-to-tray behavior
- Rust+ provider contract, maintained live provider, and development-only simulator
- independent multi-server sessions, connection states, heartbeats, reconnect/backoff/jitter
- onboarding, server profiles, server switching, dashboard telemetry, settings, diagnostics, help, and command palette
- original map-first operations shell with icon rail, server/device context, capability-aware map canvas, and searchable local event console
- NSIS and portable electron-builder targets
- unit, UI, schema, simulation, and SQL migration tests

## Next coherent increment

Phase 2 should be completed before building the map UI:

1. implement centralized priority polling with token budgets, deduplication, and coalescing;
2. normalize team, chat, map marker, and entity broadcasts into typed application events;
3. persist bounded connection/server telemetry and audit events;
4. add in-app FCM pairing or a carefully sandboxed helper workflow;
5. add provider contract tests against captured, sanitized protocol fixtures;
6. add Windows native notification routing for connection failures;
7. add secure support-bundle export.

## Not yet implemented

Phases 4–16 from the product brief remain roadmap work. Navigation states explain prerequisites and do not pretend those services exist. The first public release acceptance checklist is therefore not yet complete.
