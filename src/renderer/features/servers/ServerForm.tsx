import { useState, type FormEvent } from "react";
import { FlaskConical, LockKeyhole, Server } from "lucide-react";
import { Button } from "../../design-system/Button";
import type { CreateServerRequest } from "../../../shared/schemas/server";
import { useAppStore } from "../../stores/appStore";

const INITIAL_FORM: CreateServerRequest = {
  name: "",
  address: "",
  port: 28017,
  playerId: "",
  playerToken: "",
  provider: "live",
  favorite: true,
  autoConnect: true,
};

export function ServerForm({ onCreated, compact = false }: { onCreated?(): void; compact?: boolean }) {
  const [form, setForm] = useState<CreateServerRequest>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const mockEnabled = useAppStore((state) => state.mockProviderEnabled);
  const upsertServer = useAppStore((state) => state.upsertServer);
  const setError = useAppStore((state) => state.setError);

  const useSimulation = () => setForm({
    name: "Training server",
    address: "simulation.invalid",
    port: 28017,
    playerId: "76561198000000000",
    playerToken: "0",
    provider: "mock",
    favorite: true,
    autoConnect: true,
  });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const server = await window.rcc.createServer(form);
      upsertServer(server);
      setForm(INITIAL_FORM);
      onCreated?.();
    } catch (error) {
      setError(error instanceof Error ? error.message.replace(/^Error invoking remote method '[^']+': /, "") : "Could not add server");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className={`server-form ${compact ? "server-form-compact" : ""}`} onSubmit={submit}>
      <div className="form-intro">
        <div className="form-icon"><Server size={19} /></div>
        <div><strong>Manual Rust+ pairing</strong><span>Enter values from a trusted Rust+ pairing notification.</span></div>
      </div>
      {form.provider === "mock" && (
        <div className="simulation-notice"><FlaskConical size={16} /><span>This profile uses generated training telemetry. It is visibly labeled and cannot be enabled in packaged builds.</span></div>
      )}
      <div className="form-grid">
        <label className="field field-wide"><span>Local server name</span><input required maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Rustoria US Main" /></label>
        <label className="field"><span>Address</span><input required value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value, provider: form.provider === "mock" ? "live" : form.provider })} placeholder="server.example.com" /></label>
        <label className="field"><span>Rust+ port</span><input required type="number" min={1} max={65535} value={form.port} onChange={(e) => setForm({ ...form, port: Number(e.target.value) })} /></label>
        <label className="field"><span>Steam ID</span><input required inputMode="numeric" value={form.playerId} onChange={(e) => setForm({ ...form, playerId: e.target.value })} placeholder="7656119…" /></label>
        <label className="field"><span>Player token</span><input required type="password" inputMode="numeric" value={form.playerToken} onChange={(e) => setForm({ ...form, playerToken: e.target.value })} placeholder="Pairing token" /></label>
      </div>
      <div className="form-security"><LockKeyhole size={14} /><span>Pairing credentials are encrypted with Windows and remain in the main process.</span></div>
      <div className="form-options">
        <label><input type="checkbox" checked={form.favorite} onChange={(e) => setForm({ ...form, favorite: e.target.checked })} /> Favorite</label>
        <label><input type="checkbox" checked={form.autoConnect} onChange={(e) => setForm({ ...form, autoConnect: e.target.checked })} /> Connect on launch</label>
      </div>
      <div className="form-actions">
        {mockEnabled && <Button type="button" variant="ghost" onClick={useSimulation}><FlaskConical size={15} /> Use training simulation</Button>}
        <Button type="submit" variant="primary" disabled={submitting}>{submitting ? "Pairing…" : form.provider === "mock" ? "Start simulation" : "Save & connect"}</Button>
      </div>
    </form>
  );
}
