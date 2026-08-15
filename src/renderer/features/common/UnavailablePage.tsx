import { LockKeyhole, RadioTower } from "lucide-react";
import { useLocation } from "react-router-dom";
import { navigation } from "../../app/navigation";
import { EmptyState } from "../../design-system/EmptyState";
import { Panel } from "../../design-system/Panel";
import { useSelectedServer } from "../../stores/appStore";
import { PageHeading } from "./PageHeading";

export function UnavailablePage() {
  const location = useLocation();
  const server = useSelectedServer();
  const item = navigation.find((candidate) => candidate.path === location.pathname);
  const title = item?.label ?? "Module";
  const reason = item?.capability ?? "This capability is unavailable.";
  return (
    <div className="page-stack">
      <PageHeading eyebrow={`ROADMAP · PHASE ${item?.phase ?? "—"}`} title={title} description={reason} />
      <Panel>
        <EmptyState
          icon={server ? RadioTower : LockKeyhole}
          title={server ? `${title} is not active yet` : "Pair or select a server first"}
          description={server ? `No controls are shown until the ${title.toLowerCase()} service is implemented and its Rust+ capability is verified.` : "This screen will only use data returned by a paired server. It will never substitute sample data for live information."}
        />
      </Panel>
    </div>
  );
}
