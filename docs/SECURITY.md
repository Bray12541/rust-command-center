# Security

## Current controls

- `contextIsolation: true`, `nodeIntegration: false`, and renderer sandboxing
- deny-by-default permission handlers, popup denial, and navigation restrictions
- strict CSP with no remote renderer content
- fixed IPC allowlist with Zod validation and per-renderer rate limiting
- small frozen preload API; no raw Electron or Node handles
- Windows-backed Electron `safeStorage` encryption for Rust+, Discord, synchronization, telemetry, mobile, RCON, and bridge secrets
- no secrets in SQLite server profiles or renderer DTOs
- structured Pino logging with credential/token/password redaction
- atomic credential-vault writes and no arbitrary renderer-selected paths
- single-instance application lifecycle
- development-only simulator rejected in packaged builds
- no remote product telemetry or sanitized error reporting without an explicit HTTPS endpoint and independent consent
- local mobile and plugin-bridge HTTP listeners are disabled by default, token protected, payload limited, and intended only for loopback/private LAN use
- no shell command automation, game injection, or anti-cheat interaction

## Threat model

### Malicious renderer content

A renderer compromise could invoke only the exposed API. Schema validation, rate limits, narrow DTOs, sandboxing, and main-process authorization reduce impact. No browser permissions are granted and popup/navigation attempts are denied.

### Leaked Rust+ or integration tokens

Tokens stay encrypted at rest and out of renderer state/logs. A local attacker running as the same Windows user may still access the application or invoke Windows decryption; an optional session lock is a later defense. Credential rotation should replace one integration without resetting unrelated data.

### Malicious import or attachment

Import and attachment workflows are not implemented. Before enabling them, RCC must validate versioned schemas, cap archive expansion, protect against path traversal, copy only user-selected files into managed storage, and preview changes before commit.

### Untrusted URLs and strings

Current windows deny popups and external navigation. A future URL-opening service must accept only explicit `https` URLs, show the actual hostname when appropriate, and apply an allowlist or confirmation. External strings must render as text, never HTML.

### Compromised third-party service or Rust server

Protocol payloads are untrusted. Provider responses are normalized before persistence/UI. Services should enforce payload size and recursion limits as protocol coverage expands. Optional Discord/BattleMetrics failures must not affect Rust+ core services.

### Dangerous automation loops and owner actions

Player automation is guarded by cooldowns, quiet hours, a global pause, narrow typed actions, and Rust+ request limits. Server Owner schedules are separately enabled, use fixed operation types, require an active saved owner profile, and never execute arbitrary local shell commands. Wipe preparation does not delete files.

### Supply chain

`npm audit` is part of release review. RCC upgraded to a current Electron line and the maintained RustWire protocol fork. Some moderate advisories may remain in development tooling or optional image/CLI transitive dependencies; review `npm audit` before every release and do not publish while a relevant high/critical production vulnerability remains.

## Code signing

No certificate or fake signing identity is committed. CI/release infrastructure should provide `CSC_LINK` and `CSC_KEY_PASSWORD` (or a hardware-backed signing configuration) to electron-builder. Secrets must live in the release environment, not repository files.

## Reporting

Until a private security channel exists, do not publish exploitable credential-handling details in a public issue. Maintainers should establish a security contact before public distribution.
