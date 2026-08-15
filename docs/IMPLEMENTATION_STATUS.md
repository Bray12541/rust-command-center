# Implementation Status

## Complete in 0.3

- secure Electron/React foundation, SQLite settings/workspaces, encrypted credentials, tray lifecycle, diagnostics, packaging, and installed-build updates
- independent multi-server Rust+ sessions with heartbeat, reconnect/backoff/jitter, favorites, switching, endpoint tests, and combined status
- serialized Rust+ token budgeting and typed operations snapshots
- server identity/population/wipe/day-night/quality telemetry
- live map image, grid, coordinates, monuments, notes, team, world events, vending shops, layers, pins, routes, measurements, export, mini window, and optional position heatmap
- team/clan rosters and chat, leader promotion, clan MOTD, templates, search, export, and pop-out chat
- smart switches, alarms, storage monitor contents, manual entity configuration, state verification, and action confirmations
- manual camera IDs, reconstructed frames, PTZ movement/zoom, snapshots, and safe omission of turret fire/reload
- event zones/history, native connection alerts, and guarded automations with cooldowns, quiet hours, emergency pause, chat/device actions, and HTTPS webhooks
- local team tasks, notes, checklists, shopping, basic calculators, JSON workspace backup/import, privacy mode, themes, scale, and compact density

## Protocol-dependent or intentionally bounded

- Rust+ fields remain unavailable when a server omits them or disables its Companion Server.
- Camera IDs are manually entered because Rust+ does not expose a universal discovery list.
- Calculators use explicitly labeled local values and should be checked after Rust balance updates.
- Position history is opt-in and bounded locally.
- “Raid” alerts can use alarms/explosion markers, but RCC cannot identify an attacker, explosive, target base, or damage from Rust+ alone.
- Enemy tracking, building health, arbitrary inventories, combat logs, and RCON administration are not claimed.
- Steam/FCM registration remains the maintained upstream helper flow; RCC supplies a guided manual form, encrypted storage, duplicate detection, and a Companion-port test.
