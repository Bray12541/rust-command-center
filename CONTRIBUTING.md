# Contributing

## Setup

Use Node.js 24+ and npm 11+ on Windows:

```powershell
npm install
npm run dev
```

The native SQLite module is rebuilt for the installed Electron version during `postinstall`. Keep the repository path free of unusual filesystem permission restrictions.

## Required checks

Every functional change must pass:

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

Use `npm run test:e2e` when a Playwright flow exists for the changed surface. Run `npm audit` during dependency changes and before release packaging.

## Architecture rules

- Renderer features never import main-process code or another feature's private components.
- Credentials, SQLite, filesystem, sockets, notifications, and integrations stay in main.
- Add Zod schemas for every IPC request and response; never add a generic invoke channel.
- Translate provider payloads into application events before feature services consume them.
- Store UTC ISO timestamps internally and format local time only in the renderer.
- Keep external IDs separate from local UUIDs.
- Do not add a control unless it works, is explicitly experimental, or is disabled with an explanation.
- Do not use sample/live-looking data outside the development simulator, and always retain the simulation source label.

## Database migrations

Schema declarations live in `src/main/database/schema.ts`; committed migrations live in `src/main/database/sql`. Create an additive numbered migration and include it in `migrations.ts`. Never edit an already released migration. Test migrations against a temporary or in-memory database.

## Rust+ providers

Implement protocol behavior behind `RustPlusProvider`. Do not let library response shapes escape the adapter. Respect upstream request budgets, handle absent optional fields, sanitize fixture captures, and document verified/unsupported capabilities in `docs/RUST_PLUS_CAPABILITIES.md`.

## Commits and pull requests

Keep commits scoped by service or feature. Describe security boundary changes, migration effects, failure behavior, and verification evidence in the pull request. Never commit real pairing credentials, server addresses, Discord tokens, logs, database files, or support bundles.
