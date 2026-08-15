import { useState } from "react";
import { Archive, Cable, Plus, RefreshCw, Server, Star, Trash2, Unplug } from "lucide-react";
import { Button } from "../../design-system/Button";
import { EmptyState } from "../../design-system/EmptyState";
import { Panel } from "../../design-system/Panel";
import { StatusBadge } from "../../design-system/StatusBadge";
import { useAppStore } from "../../stores/appStore";
import { PageHeading } from "../common/PageHeading";
import { ServerForm } from "./ServerForm";

export function ServersPage() {
  const [adding, setAdding] = useState(false);
  const servers = useAppStore((state) => state.servers);
  const upsert = useAppStore((state) => state.upsertServer);
  const remove = useAppStore((state) => state.removeServer);
  const selectServer = useAppStore((state) => state.selectServer);
  const selected = useAppStore((state) => state.settings?.selectedServerId);
  const setError = useAppStore((state) => state.setError);
  const [working, setWorking] = useState<string | null>(null);

  const run = async (id: string, action: () => Promise<void>) => {
    setWorking(id); setError(null);
    try { await action(); } catch (error) { setError(error instanceof Error ? error.message.replace(/^Error invoking remote method '[^']+': /, "") : "Server action failed"); }
    finally { setWorking(null); }
  };

  const deleteServer = async (id: string, name: string) => {
    if (!window.confirm(`Remove ${name} and its encrypted pairing credentials? Local telemetry for this profile will also be removed.`)) return;
    await run(id, async () => { await window.rcc.deleteServer(id); remove(id); });
  };

  return (
    <div className="page-stack">
      <PageHeading eyebrow="MULTI-SERVER CONTROL" title="Server Manager" description="Each profile reconnects independently. Pairing credentials are never displayed after saving." actions={<Button variant="primary" onClick={() => setAdding((value) => !value)}><Plus size={15} /> Add server</Button>} />
      {adding && <Panel title="Pair a Rust+ server" eyebrow="NEW PROFILE"><ServerForm onCreated={() => setAdding(false)} /></Panel>}
      <Panel title="Active profiles" eyebrow={`${servers.length} CONFIGURED`}>
        {servers.length === 0 ? <EmptyState icon={Server} title="No server profiles" description="Add a live Rust+ pairing or use the development-only training simulation." /> : <div className="server-list">{servers.map((server) => (
          <article key={server.id} className={`server-row ${selected === server.id ? "selected" : ""}`}>
            <button className="server-row-main" onClick={() => void selectServer(server.id)}>
              <div className="server-avatar">{server.name.slice(0, 2).toUpperCase()}</div>
              <div className="server-identity"><strong>{server.name}</strong><span>{server.address}:{server.port} · {server.provider === "mock" ? "training provider" : "Rust+ live provider"}</span></div>
              <StatusBadge status={server.status} simulation={server.provider === "mock"} />
            </button>
            <div className="server-row-meta"><span>Last packet</span><strong>{server.lastPacketAt ? new Date(server.lastPacketAt).toLocaleString() : "Never"}</strong></div>
            <div className="server-row-actions">
              <Button compact variant="ghost" onClick={() => void run(server.id, async () => upsert(await window.rcc.favoriteServer(server.id, !server.favorite)))} disabled={working === server.id} title={server.favorite ? "Remove favorite" : "Make favorite"}><Star size={14} fill={server.favorite ? "currentColor" : "none"} /></Button>
              {server.status === "CONNECTED" ? <Button compact onClick={() => void run(server.id, async () => upsert(await window.rcc.disconnectServer(server.id)))} disabled={working === server.id}><Unplug size={14} /> Disconnect</Button> : <Button compact onClick={() => void run(server.id, async () => upsert(await window.rcc.connectServer(server.id)))} disabled={working === server.id}>{server.status === "ERROR" ? <RefreshCw size={14} /> : <Cable size={14} />} Connect</Button>}
              <Button compact variant="ghost" onClick={() => void run(server.id, async () => upsert(await window.rcc.archiveServer(server.id, true)))} disabled={working === server.id}><Archive size={14} /> Archive</Button>
              <Button compact variant="danger" onClick={() => void deleteServer(server.id, server.name)} disabled={working === server.id}><Trash2 size={14} /></Button>
            </div>
          </article>
        ))}</div>}
      </Panel>
    </div>
  );
}
