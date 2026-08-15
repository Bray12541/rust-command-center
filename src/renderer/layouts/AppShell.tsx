import { Hexagon } from "lucide-react";
import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { CommandPalette } from "../components/CommandPalette";
import { useAppStore } from "../stores/appStore";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

export function AppShell() {
  const [commandsOpen, setCommandsOpen] = useState(false);
  const location = useLocation();
  const appVersion = useAppStore((state) => state.appVersion);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandsOpen((current) => !current);
      }
      if (event.key === "Escape") setCommandsOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="app-shell">
      <header className="app-titlebar">
        <div className="titlebar-brand"><Hexagon size={14} /><strong>RUST COMMAND CENTER</strong><span>FREE · v{appVersion}</span></div>
      </header>
      <div className="app-workspace">
        <Sidebar />
        <div className="main-column">
          <TopBar onOpenCommands={() => setCommandsOpen(true)} />
          <main className={`content ${["/", "/map"].includes(location.pathname) ? "content-workspace" : ""}`}><Outlet /></main>
        </div>
      </div>
      <CommandPalette open={commandsOpen} onClose={() => setCommandsOpen(false)} />
    </div>
  );
}
