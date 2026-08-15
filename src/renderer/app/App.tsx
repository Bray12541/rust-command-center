import { useEffect } from "react";
import { AlertTriangle, LoaderCircle, X } from "lucide-react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "../layouts/AppShell";
import { useAppStore } from "../stores/appStore";
import { Dashboard } from "../features/dashboard/Dashboard";
import { DiagnosticsPage } from "../features/diagnostics/DiagnosticsPage";
import { HelpPage } from "../features/help/HelpPage";
import { Onboarding } from "../features/onboarding/Onboarding";
import { ServersPage } from "../features/servers/ServersPage";
import { SettingsPage } from "../features/settings/SettingsPage";

export function App() {
  const ready = useAppStore((state) => state.ready);
  const settings = useAppStore((state) => state.settings);
  const initialize = useAppStore((state) => state.initialize);
  const error = useAppStore((state) => state.error);
  const setError = useAppStore((state) => state.setError);

  useEffect(() => { let unsubscribe: () => void = () => undefined; void initialize().then((cleanup) => { unsubscribe = cleanup; }); return () => unsubscribe(); }, [initialize]);
  useEffect(() => {
    if (!settings) return;
    document.documentElement.dataset.theme = settings.theme;
    document.documentElement.dataset.density = settings.compactDensity ? "compact" : "comfortable";
    document.documentElement.style.setProperty("--ui-scale", String(settings.uiScale));
    document.documentElement.classList.toggle("streamer-mode", settings.streamerMode);
  }, [settings]);

  if (!ready) return <div className="boot-screen"><div className="boot-mark"><LoaderCircle size={25} /></div><strong>RUST COMMAND CENTER</strong><span>Initializing secure services…</span></div>;
  if (!settings) return <div className="fatal-screen"><AlertTriangle size={28} /><h1>Application services unavailable</h1><p>{error ?? "The renderer could not establish a validated IPC session."}</p></div>;
  if (!settings.onboardingComplete) return <><Onboarding />{error && <ErrorToast message={error} onClose={() => setError(null)} />}</>;

  const operationsPaths = ["map", "team", "chat", "devices", "alerts", "cameras", "automation", "shops", "bases", "raids", "players", "wipe-planner", "calculators", "analytics", "integrations"];
  return <><Routes><Route element={<AppShell />}><Route index element={<Dashboard />} />{operationsPaths.map((path) => <Route key={path} path={path} element={<Dashboard />} />)}<Route path="servers" element={<ServersPage />} /><Route path="settings" element={<SettingsPage />} /><Route path="diagnostics" element={<DiagnosticsPage />} /><Route path="help" element={<HelpPage />} /><Route path="logs" element={<DiagnosticsPage />} /><Route path="*" element={<Navigate to="/" replace />} /></Route></Routes>{error && <ErrorToast message={error} onClose={() => setError(null)} />}</>;
}

function ErrorToast({ message, onClose }: { message: string; onClose(): void }) { return <div className="error-toast" role="alert"><AlertTriangle size={17} /><span>{message}</span><button onClick={onClose} aria-label="Dismiss error"><X size={15} /></button></div>; }
