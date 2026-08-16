# Server Owner mode

Server Owner mode is a separate, disabled-by-default administrator workspace. It does not turn ordinary Rust+ pairing into administrator access. Each owner profile requires an RCON address, port, and password belonging to a server the user controls.

## RCON and moderation

RCC uses Rust WebRCON over a direct WebSocket. The console retains the latest 500 lines in memory. Quick actions cover saves, announcements, plugin status, `serverinfo`, delayed restarts, kick, ban, and unban. Moderation accepts only a 15–20 digit Steam ID, strips command separators from reasons, and requires user confirmation.

## Local configuration and backups

The local-server folder field points to the directory containing `server.cfg`. Saving the editor first copies the old file to a timestamped `.bak`, writes a temporary file, and atomically renames it.

Full backups recursively copy the configured live-server folder into a timestamped directory. The destination must be outside the source tree. Backups are copies; RCC never removes the source.

## Scheduling and wipe preparation

Schedules can save, back up, restart, or prepare for a wipe once, daily, or weekly. Restart schedules announce at 30, 10, 5, and 1 minute when RCON remains connected. Wipe preparation performs a backup, saves the server, and announces completion. It deliberately does not delete world or player files; a human administrator must perform that irreversible step.

## Fleet and performance

The fleet combines RCON state with an optional linked Rust+ profile. The Performance action runs `serverinfo`; JSON responses containing framerate, memory, entity count, uptime, or players become in-session sparkline samples.

## uMod/Oxide bridge

The bridge listens on a separate token-protected HTTP endpoint. The included `resources/examples/RccBridge.cs` plugin sends server, death, authorization, raid, and performance events.

```text
POST /api/events
Authorization: Bearer <bridge token>
Content-Type: application/json

{
  "profileId": "optional-owner-profile-uuid",
  "type": "raid|death|authorization|plugin|performance|server|custom",
  "severity": "info|warning|critical",
  "title": "Short title",
  "message": "Human-readable event",
  "metadata": {}
}
```

Keep the bridge on a private network or behind an authenticated TLS reverse proxy. The health endpoint is `GET /health`.
