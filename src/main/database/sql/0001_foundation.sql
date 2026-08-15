CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS servers (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  port INTEGER NOT NULL CHECK (port BETWEEN 1 AND 65535),
  steam_server_id TEXT,
  provider TEXT NOT NULL DEFAULT 'live' CHECK (provider IN ('live', 'mock')),
  favorite INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  auto_connect INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'DISCONNECTED',
  status_reason TEXT,
  last_connected_at TEXT,
  last_packet_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS servers_archived_idx ON servers (archived);
CREATE INDEX IF NOT EXISTS servers_favorite_idx ON servers (favorite);

CREATE TABLE IF NOT EXISTS server_telemetry (
  id TEXT PRIMARY KEY NOT NULL,
  server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  payload TEXT NOT NULL,
  observed_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS telemetry_server_time_idx
  ON server_telemetry (server_id, observed_at);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY NOT NULL,
  server_id TEXT REFERENCES servers(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  result TEXT NOT NULL,
  metadata TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS audit_created_idx ON audit_log (created_at);
