import { Cable, ChevronUp, Clock3, Layers3, Map, RadioTower, Search, Users, WifiOff } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../design-system/Button";
import { useAppStore, useSelectedServer } from "../../stores/appStore";

interface ActivityEntry {
  time: string;
  source: string;
  message: string;
}

export function Dashboard() {
  const server = useSelectedServer();
  const telemetry = useAppStore((state) => server ? state.telemetry[server.id] : undefined);
  const upsert = useAppStore((state) => state.upsertServer);
  const setError = useAppStore((state) => state.setError);
  const [filter, setFilter] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const activity = useMemo<ActivityEntry[]>(() => {
    const rows: ActivityEntry[] = [
      { time: new Date().toLocaleTimeString(), source: "Core", message: "Local command workspace ready" },
      { time: new Date().toLocaleTimeString(), source: "Database", message: "SQLite persistence and migrations active" },
    ];
    if (server) rows.push({
      time: server.updatedAt ? new Date(server.updatedAt).toLocaleTimeString() : new Date().toLocaleTimeString(),
      source: "Rust+",
      message: `${server.name}: ${server.status.toLowerCase().replaceAll("_", " ")}${server.statusReason ? ` — ${server.statusReason}` : ""}`,
    });
    if (telemetry) rows.push({
      time: new Date(telemetry.observedAt).toLocaleTimeString(),
      source: telemetry.source === "simulation" ? "Simulation" : "Rust+",
      message: `Confirmed server telemetry received${telemetry.players == null ? "" : ` · population ${telemetry.players}/${telemetry.maxPlayers ?? "?"}`}`,
    });
    return rows.filter((entry) => `${entry.source} ${entry.message}`.toLowerCase().includes(filter.toLowerCase()));
  }, [filter, server, telemetry]);

  const connect = async () => {
    if (!server) return;
    setConnecting(true);
    try {
      upsert(await window.rcc.connectServer(server.id));
    } catch (error) {
      setError(error instanceof Error ? error.message.replace(/^Error invoking remote method '[^']+': /, "") : "Connection failed");
    } finally {
      setConnecting(false);
    }
  };

  const connected = server?.status === "CONNECTED";
  return (
    <div className="map-workspace">
      <section className="map-stage" aria-label="Live map workspace">
        <div className="map-grid-overlay" />
        <div className="map-status-strip">
          <div><span className={`stage-light ${connected ? "online" : ""}`} /><strong>{server?.name ?? "No server selected"}</strong></div>
          <div><Users size={13} /><span>Team</span><strong>— / —</strong></div>
          <div><Clock3 size={13} /><span>Rust time</span><strong>{telemetry?.rustTime ?? "—"}</strong></div>
          <button disabled title="Map layers become available after live map data is implemented"><Layers3 size={14} /> Monuments</button>
        </div>

        <div className="map-empty-card">
          <div className="map-empty-icon">{server ? connected ? <Map size={27} /> : <WifiOff size={27} /> : <RadioTower size={27} />}</div>
          <h1>{!server ? "Pair a server to begin" : connected ? "Live map adapter not active yet" : "Ready to open the operations map?"}</h1>
          <p>{!server
            ? "Create a Rust+ profile in Server Manager. No map or player data is generated locally."
            : connected
              ? "The server connection is real, but RCC will keep this canvas empty until the map protocol, coordinate transform, and marker validation are complete."
              : "Connect the selected Rust+ profile to request confirmed server telemetry."}</p>
          {!server
            ? <Link to="/servers"><Button variant="primary"><RadioTower size={15} /> Open Server Manager</Button></Link>
            : !connected && <Button variant="primary" disabled={connecting || ["CONNECTING", "AUTHENTICATING", "RECONNECTING"].includes(server.status)} onClick={() => void connect()}><Cable size={15} /> {connecting ? "Connecting…" : "Connect"}</Button>}
        </div>

        <div className="map-corner-controls" aria-label="Map controls">
          <button disabled title="Map controls require a loaded map">+</button>
          <button disabled title="Map controls require a loaded map">−</button>
          <button disabled title="Fit map requires a loaded map"><Map size={15} /></button>
        </div>
      </section>

      <section className={`event-console ${expanded ? "expanded" : ""}`}>
        <header>
          <div className="console-title"><span className="console-live" /><strong>Local event console</strong><span>{activity.length} entries</span></div>
          <button onClick={() => setExpanded((value) => !value)}><ChevronUp size={14} className={expanded ? "rotated" : ""} /> {expanded ? "Collapse" : "Expand"}</button>
        </header>
        {expanded && <><label className="console-filter"><Search size={14} /><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter local events…" /></label>
          <div className="console-log" role="log">
            {activity.map((entry, index) => <div key={`${entry.time}-${entry.source}-${index}`}><time>[{entry.time}]</time><span>[{entry.source}]</span><p>{entry.message}</p></div>)}
            {activity.length === 0 && <div className="console-no-results">No local event matches “{filter}”.</div>}
          </div></>}
      </section>
    </div>
  );
}
