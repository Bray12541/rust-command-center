# Connected services

Every connected service is opt-in. Tokens and passphrases are encrypted with Electron `safeStorage` on Windows and never returned to the renderer after saving.

## Discord bot

Create a bot in the Discord Developer Portal, enable the Message Content intent, invite it with View Channels, Send Messages, and Read Message History permissions, then enter its application, guild, channel, and role IDs. RCC supports:

- outgoing connection and alert messages;
- `!rcc status`, `!rcc ping`, and `!rcc help`;
- an allowlist of Discord role IDs;
- server-owner access even when no role is listed;
- disabled mentions in bot replies and alerts.

RCC never asks for a Discord account password. The bot token is the only Discord secret stored.

## Encrypted profile synchronization

Choose a folder controlled by the player, such as a OneDrive, Dropbox, NAS, or removable-drive folder. A push writes `rust-command-center-profile.rccsync` using AES-256-GCM, a random salt and IV, and a key derived with scrypt. The file contains application preferences, live server profiles, Rust+ credentials, and local workspaces. A pull decrypts and restores missing profiles and their workspaces.

Use the same passphrase on each PC. Losing it makes the synchronized file unrecoverable.

## Mobile dashboard

The mobile dashboard is a read-only PWA served directly by RCC. `This PC only` binds to `127.0.0.1`; `Local network` binds to all interfaces and displays a LAN URL. The access token is embedded in the displayed URL and is required for API reads.

Do not port-forward this HTTP service to the public internet. Use a trusted VPN or a TLS reverse proxy if remote access is required.

## Shared workspace API

RCC calls this user-controlled contract:

```text
HEAD /workspaces/{workspaceId}  -> connectivity test
GET  /workspaces/{workspaceId}  -> { "workspace": WorkspaceDocument }
PUT  /workspaces/{workspaceId}  <- { "format": "rcc-shared-workspace", "version": 1, "workspace": {...}, "updatedAt": "..." }
Authorization: Bearer <configured token>
Content-Type: application/json
```

The base URL must use HTTPS. Pulls are always explicit because this version intentionally does not invent conflict-resolution behavior.

## Analytics and crash reports

Analytics and crash reports have separate consent toggles. Both remain off by default. The generic HTTPS collector receives only application/platform identifiers, timestamps, connection-state categories, and sanitized error names/messages/stacks. File paths and Steam-sized identifiers are redacted. RCC excludes tokens, chat, server addresses, map notes, RCON commands, and workspace content.

## Community extensions and themes

Extensions are declarative JSON manifests placed under RCC's Extensions folder. Arbitrary JavaScript is not loaded. A manifest may request these permissions:

- `theme`
- `open-external`
- `read-server-summary`
- `read-workspace`

All requested permissions must be approved before the extension can be enabled. See `resources/examples/extension/manifest.json`.
