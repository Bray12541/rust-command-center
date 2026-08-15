import type { ConnectionState } from "../../shared/schemas/server";

export function StatusBadge({ status, simulation = false }: { status: ConnectionState; simulation?: boolean }) {
  const tone = status === "CONNECTED" ? "good" : status === "ERROR" ? "critical" : status === "DISCONNECTED" ? "muted" : "warning";
  return (
    <span className={`status-badge status-${tone}`}>
      <span className="status-dot" />
      {simulation ? "SIMULATION · " : ""}
      {status.replaceAll("_", " ")}
    </span>
  );
}
