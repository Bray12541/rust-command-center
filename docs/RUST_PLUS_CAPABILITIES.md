# Rust+ Capabilities

RCC uses the unofficial maintained [`@rustwirebot/rustplus.js`](https://github.com/rik8181/rustwirebot-rustplus.js) protocol adapter. Rust+ behavior can change with game updates, so all network fields are treated as optional and untrusted.

## Exposed in 0.3

| Capability | RCC behavior |
| --- | --- |
| Server info/time | Normalized identity, population, queue, map, wipe, clock, sunrise/sunset, and latency |
| Map | Cached JPEG map, dimensions, ocean margin, monuments, coordinates, local annotations |
| Map markers | Players/events/vending markers with sell orders when returned |
| Team | Leader, roster, online/alive state, positions, timestamps, notes, promotion request |
| Team chat | History, live broadcasts, search, templates, export, and rate-limited send |
| Clan | MOTD, roles, members, invites, clan chat, send, and permission-enforced MOTD request |
| Entities | Switch/alarm/storage state, item contents, protection fields, broadcasts, and verified set value |
| Cameras | Manual IDs, reconstructed PNG frames, PTZ move/zoom, and snapshots |

The provider serializes requests through a local 25-token budget replenished at three tokens per second. Map requests cost five; team chat sends cost two. Static maps are cached per connection and configured entity polls are bounded.

## Known limits

- Rust+ must be paired and the server Companion port must be reachable.
- Missing protocol fields remain unknown; RCC does not fabricate them.
- Camera frames are reconstructed samples, not conventional video.
- Camera IDs cannot be universally discovered.
- Turret fire/reload is intentionally not exposed.
- Rust+ does not reveal enemy positions, building health, raid attribution, arbitrary inventories, or RCON powers.
