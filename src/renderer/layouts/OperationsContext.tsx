import { Cable, CircleHelp, RadioTower, Search, Server, Settings2, SlidersHorizontal, Unplug } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../design-system/Button";
import { StatusBadge } from "../design-system/StatusBadge";
import { useAppStore, useSelectedServer } from "../stores/appStore";

export function OperationsContext() {
  const navigate = useNavigate();
  const servers = useAppStore((state) => state.servers);
  const selected = useSelectedServer();
  const selectServer = useAppStore((state) => state.selectServer);
  const upsert = useAppStore((state) => state.upsertServer);
  const setError = useAppStore((state) => state.setError);
  const [working, setWorking] = useState(false);

  const toggleConnection = async () => {
    if (!selected || working) return;
    setWorking(true);
    try {
      const server = selected.status === "CONNECTED"
        ? await window.rcc.disconnectServer(selected.id)
        : await window.rcc.connectServer(selected.id);
      upsert(server);
    } catch (error) {
      setError(error instanceof Error ? error.message.replace(/^Error invoking remote method '[^']+': /, "") : "Connection action failed");
    } finally {
      setWorking(false);
    }
  };

  return (
    <aside className="operations-context">
      <section className="context-section server-section">
        <header><span>Servers</span><Link to="/servers">Manage</Link></header>
        {servers.length > 1 && (
          <label className="context-server-picker">
            <span className="sr-only">Selected server</span>
            <select value={selected?.id ?? ""} onChange={(event) => void selectServer(event.target.value || null)}>
              <option value="">Select a server</option>
              {servers.map((server) => <option key={server.id} value={server.id}>{server.name}</option>)}
            </select>
          </label>
        )}
        {selected ? (
          <article className="context-server-card">
            <div className="server-avatar">{selected.name.slice(0, 2).toUpperCase()}</div>
            <div className="context-server-copy"><strong>{selected.name}</strong><span>{selected.address}:{selected.port}</span></div>
            <StatusBadge status={selected.status} simulation={selected.provider === "mock"} />
            <Button variant={selected.status === "CONNECTED" ? "secondary" : "primary"} compact onClick={() => void toggleConnection()} disabled={working || ["CONNECTING", "AUTHENTICATING", "RECONNECTING"].includes(selected.status)}>
              {selected.status === "CONNECTED" ? <><Unplug size={13} /> Disconnect</> : <><Cable size={13} /> Connect</>}
            </Button>
          </article>
        ) : (
          <button className="context-empty-server" onClick={() => navigate("/servers")}><Server size={20} /><strong>Pair a server</strong><span>Add a Rust+ profile to begin.</span></button>
        )}
      </section>

      <section className="context-section connection-section">
        <header><span>Connection services</span><Link to="/diagnostics"><CircleHelp size={13} /></Link></header>
        <div className="service-row"><span className={`service-light ${selected?.status === "CONNECTED" ? "online" : ""}`} /><div><strong>Rust+ provider</strong><span>{selected ? selected.status.toLowerCase().replaceAll("_", " ") : "idle"}</span></div></div>
        <div className="service-row"><span className="service-light online" /><div><strong>Credential vault</strong><span>Windows encrypted</span></div></div>
      </section>

      <section className="context-section device-section">
        <header><span>Devices</span><small>0 items</small></header>
        <div className="context-filter-row">
          <label><Search size={14} /><input placeholder="Search devices…" disabled aria-label="Search devices" /></label>
          <button disabled title="Device filters become available after device pairing"><SlidersHorizontal size={15} /></button>
        </div>
        <div className="context-device-empty"><RadioTower size={25} /><strong>No devices paired</strong><span>Smart switches, alarms, and monitors will appear only after a verified Rust+ subscription.</span></div>
      </section>

      <footer className="context-footer">
        <Link to="/diagnostics" title="Diagnostics"><RadioTower size={16} /></Link>
        <Link to="/servers" title="Server Manager"><Server size={16} /></Link>
        <Link to="/settings" title="Settings"><Settings2 size={16} /></Link>
      </footer>
    </aside>
  );
}
