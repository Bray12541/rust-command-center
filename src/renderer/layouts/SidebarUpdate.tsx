import { Check, Download, ExternalLink, RefreshCw, RotateCw } from "lucide-react";
import { useEffect, useState } from "react";
import type { UpdateState } from "../../shared/contracts/update";

const initialState: UpdateState = {
  phase: "idle",
  currentVersion: "",
  availableVersion: null,
  progress: null,
  message: "Ready to check for updates",
  canAutoUpdate: false,
  releaseNotes: null,
};

export function SidebarUpdate({ collapsed }: { collapsed: boolean }) {
  const [state, setState] = useState(initialState);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    let active = true;
    void window.rcc.getUpdateState().then((next) => active && setState(next));
    const unsubscribe = window.rcc.onUpdateState((next) => active && setState(next));
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const act = async () => {
    if (working || ["checking", "downloading"].includes(state.phase)) return;
    setWorking(true);
    try {
      if (state.phase === "available") setState(await window.rcc.downloadUpdate());
      else if (state.phase === "downloaded") await window.rcc.installUpdate();
      else if (!state.canAutoUpdate) await window.rcc.openReleases();
      else setState(await window.rcc.checkForUpdates());
    } finally {
      setWorking(false);
    }
  };

  const Icon = state.phase === "downloaded"
    ? RotateCw
    : state.phase === "available" || state.phase === "downloading"
      ? Download
      : state.phase === "up-to-date"
        ? Check
        : state.canAutoUpdate
          ? RefreshCw
          : ExternalLink;
  const label = state.phase === "available"
    ? `Download v${state.availableVersion}`
    : state.phase === "downloaded"
      ? "Restart to update"
      : state.phase === "downloading"
        ? `Downloading ${state.progress ?? 0}%`
        : state.phase === "checking"
          ? "Checking…"
          : state.canAutoUpdate
            ? "Check for updates"
            : "View releases";

  return (
    <button className={`sidebar-update update-${state.phase}`} onClick={() => void act()} disabled={working || ["checking", "downloading"].includes(state.phase)} title={state.releaseNotes ?? (collapsed ? state.message : undefined)}>
      <span className="sidebar-update-icon"><Icon size={17} className={["checking", "downloading"].includes(state.phase) ? "spin" : ""} /></span>
      {!collapsed && <span className="sidebar-update-copy"><strong>{label}</strong><small>{state.message}</small>{state.phase === "downloading" && <i style={{ width: `${state.progress ?? 0}%` }} />}</span>}
      {!collapsed && state.phase === "available" && <span className="update-dot" />}
    </button>
  );
}
