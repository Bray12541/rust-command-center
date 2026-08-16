import { Cable, ChevronDown, Layers3, Search, Unplug } from "lucide-react";
import { useState } from "react";
import { useLocation } from "react-router-dom";
import { navigation } from "../app/navigation";
import { StatusBadge } from "../design-system/StatusBadge";
import { useAppStore, useSelectedServer } from "../stores/appStore";

export function TopBar({ onOpenCommands }: { onOpenCommands(): void }) {
  const location = useLocation();
  const servers = useAppStore((state) => state.servers);
  const selectServer = useAppStore((state) => state.selectServer);
  const upsert = useAppStore((state) => state.upsertServer);
  const setError = useAppStore((state) => state.setError);
  const server = useSelectedServer();
  const [working, setWorking] = useState(false);
  const isMap = !["/servers", "/settings", "/diagnostics", "/help", "/logs", "/integrations", "/server-owner"].includes(location.pathname);
  const pageName = isMap ? "Operations map" : navigation.find((item) => item.path === location.pathname)?.label ?? "Workspace";

  const toggleConnection = async () => {
    if (!server || working) return;
    setWorking(true);
    try {
      upsert(server.status === "CONNECTED" ? await window.rcc.disconnectServer(server.id) : await window.rcc.connectServer(server.id));
    } catch (error) {
      setError(error instanceof Error ? error.message.replace(/^Error invoking remote method '[^']+': /, "") : "Connection action failed");
    } finally {
      setWorking(false);
    }
  };

  return (
    <header className="topbar clean-topbar">
      <div className="topbar-page"><span>Workspace</span><strong>{pageName}</strong></div>
      <div className="topbar-divider" />
      <label className="clean-server-select">
        <select value={server?.id ?? ""} onChange={(event) => void selectServer(event.target.value || null)} aria-label="Selected server">
          <option value="">No server selected</option>
          {servers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <ChevronDown size={13} />
      </label>
      {server && <StatusBadge status={server.status} simulation={server.provider === "mock"} />}
      {server && (
        <button className="topbar-connect" onClick={() => void toggleConnection()} disabled={working || ["CONNECTING", "AUTHENTICATING", "RECONNECTING"].includes(server.status)}>
          {server.status === "CONNECTED" ? <Unplug size={14} /> : <Cable size={14} />}
          {server.status === "CONNECTED" ? "Disconnect" : "Connect"}
        </button>
      )}
      <div className="topbar-actions">
        {isMap && <span className="topbar-map-hint"><Layers3 size={14} /> Map tools are docked below</span>}
        <button className="command-trigger" onClick={onOpenCommands}><Search size={15} /><span>Search</span><kbd>Ctrl K</kbd></button>
      </div>
      {server?.provider === "mock" && <div className="toolbar-simulation">Training simulation</div>}
    </header>
  );
}
