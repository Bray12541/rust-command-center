# Rust+ Capabilities

RCC uses an unofficial protocol implementation. Facepunch does not publish a supported public SDK for this desktop application. Protocol behavior can change when Rust updates.

The current adapter is based on [`@rustwirebot/rustplus.js`](https://www.npmjs.com/package/@rustwirebot/rustplus.js), a maintained fork of [`@liamcottle/rustplus.js`](https://github.com/liamcottle/rustplus.js). The upstream project documents server address/app port plus player ID/token pairing, server info, Rust time, map and markers, team data/chat, entity state/control, and camera frames.

## Implemented and exposed

| Capability | Service status | UI status |
| --- | --- | --- |
| Direct server connection | Implemented | Server Manager |
| Independent reconnect/backoff | Implemented | Status and Diagnostics |
| Server name/population/queue/map size | Implemented when returned | Dashboard |
| Rust in-game time | Implemented when returned | Dashboard |
| Rust+ request latency | Implemented | Dashboard; explicitly not in-game ping |
| Manual pairing value entry | Implemented | Onboarding and Server Manager |
| FCM registration/listening | External upstream CLI | Documented; not claimed as in-app |

Null or missing protocol fields remain unavailable. RCC does not infer population, queue, wipe time, or Rust time.

## Supported upstream but not yet exposed

- map image and coordinate data
- map markers, including vending markers and dynamic events
- team membership, position, and chat
- entity subscriptions, smart switches, alarms, and storage monitors
- Rust+ camera frame/control protocol

These capabilities require typed adapters, request scheduling, persistence, and UI verification before RCC enables them.

## Known limitations

- Rust+ connection and per-player request limits apply. The upstream project documents token-bucket limits; future polling must centralize priority, coalescing, and backoff.
- Queue information and individual fields may be absent on a server.
- Camera frames are not a conventional video stream and RCC will not present them as one.
- Team presence must remain unknown unless the protocol provides enough evidence.
- Device actions must be confirmed by a protocol response and, where possible, a subsequent state observation before UI reports success.
- Pairing credentials can expire or change after a server wipe/re-pair.

The library adapter is isolated because dependencies, schemas, and optional fields have historically changed. Protocol responses are treated as untrusted network input.
