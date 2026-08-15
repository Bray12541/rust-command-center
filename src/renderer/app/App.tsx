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
import { UnavailablePage } from "../features/common/UnavailablePage";
import { navigation } from "./navigation";

export function App() {
  const ready = useAppStore((state) => state.ready);
  const settings = useAppStore((state) => state.settings);
  const initialize = useAppStore((state) => state.initialize);
  const error = useAppStore((state) => state.error);
  const setError = useAppStore((state) => state.setError);

  useEffect(() => { let unsubscribe: () => void = () => undefined; void initialize().then((cleanup) => { unsubscribe = cleanup; }); return () => unsubscribe(); }, [initialize]);

  if (!ready) return <div className="boot-screen"><div className="boot-mark"><LoaderCircle size={25} /></div><strong>RUST COMMAND CENTER</strong><span>Initializing secure services…</span></div>;
  if (!settings) return <div className="fatal-screen"><AlertTriangle size={28} /><h1>Application services unavailable</h1><p>{error ?? "The renderer could not establish a validated IPC session."}</p></div>;
  if (!settings.onboardingComplete) return <><Onboarding />{error && <ErrorToast message={error} onClose={() => setError(null)} />}</>;

  return <><Routes><Route element={<AppShell />}><Route index element={<Dashboard />} /><Route path="map" element={<Dashboard />} /><Route path="servers" element={<ServersPage />} /><Route path="settings" element={<SettingsPage />} /><Route path="diagnostics" element={<DiagnosticsPage />} /><Route path="help" element={<HelpPage />} />{navigation.filter((item) => (item.phase > 3 && item.id !== "map") || item.id === "logs").map((item) => <Route key={item.id} path={item.path.slice(1)} element={<UnavailablePage />} />)}<Route path="*" element={<Navigate to="/" replace />} /></Route></Routes>{error && <ErrorToast message={error} onClose={() => setError(null)} />}</>;
}

function ErrorToast({ message, onClose }: { message: string; onClose(): void }) { return <div className="error-toast" role="alert"><AlertTriangle size={17} /><span>{message}</span><button onClick={onClose} aria-label="Dismiss error"><X size={15} /></button></div>; }
