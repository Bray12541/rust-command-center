import {
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Hexagon,
  Map,
  RadioTower,
  Server,
  Settings2,
  MessageSquare,
  Wrench,
} from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import { type NavigationItem } from "../app/navigation";
import { useAppStore, useSelectedServer } from "../stores/appStore";
import { SidebarUpdate } from "./SidebarUpdate";

const primaryItems: NavigationItem[] = [
  { id: "map-home", label: "Live map", path: "/", icon: Map, phase: 3 },
  { id: "comms-home", label: "Comms", path: "/chat", icon: MessageSquare, phase: 3 },
  { id: "assets-home", label: "Assets", path: "/devices", icon: RadioTower, phase: 3 },
  { id: "plan-home", label: "Plan", path: "/wipe-planner", icon: Wrench, phase: 3 },
];

export function Sidebar() {
  const settings = useAppStore((state) => state.settings)!;
  const updateSettings = useAppStore((state) => state.updateSettings);
  const selected = useSelectedServer();
  const collapsed = settings.sidebarCollapsed;

  const setCollapsed = (value: boolean) => {
    void updateSettings({ sidebarCollapsed: value });
  };

  return (
    <aside className={`sidebar unified-sidebar ${collapsed ? "sidebar-collapsed" : ""}`}>
      <div className="sidebar-brand">
        <div className="brand-mark"><Hexagon size={18} strokeWidth={2.3} /></div>
        {!collapsed && <div className="sidebar-brand-copy"><strong>RUST COMMAND</strong><span>Operations</span></div>}
        <button className="sidebar-collapse" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <Link to="/servers" className="sidebar-server" title={selected?.name ?? "Pair a server"}>
        <span className={`sidebar-server-avatar ${selected?.status === "CONNECTED" ? "connected" : ""}`}>
          {selected ? selected.name.slice(0, 2).toUpperCase() : <Server size={16} />}
        </span>
        {!collapsed && <span className="sidebar-server-copy"><strong>{selected?.name ?? "Pair a server"}</strong><small>{selected ? selected.status.toLowerCase().replaceAll("_", " ") : "No server selected"}</small></span>}
        {!collapsed && <ChevronRight size={14} />}
      </Link>

      <nav className="sidebar-navigation" aria-label="Primary navigation">
        {!collapsed && <span className="sidebar-section-label">Workspace</span>}
        {primaryItems.map((item) => <SidebarLink key={item.id} item={item} collapsed={collapsed} />)}
      </nav>

      <div className="sidebar-bottom">
        <SidebarUpdate collapsed={collapsed} />
        <nav aria-label="System navigation">
          <SidebarLink item={{ id: "servers-link", label: "Servers", path: "/servers", icon: Server, phase: 3 }} collapsed={collapsed} />
          <SidebarLink item={{ id: "settings-link", label: "Settings", path: "/settings", icon: Settings2, phase: 3 }} collapsed={collapsed} />
          <SidebarLink item={{ id: "help-link", label: "Help", path: "/help", icon: CircleHelp, phase: 3 }} collapsed={collapsed} />
        </nav>
      </div>
    </aside>
  );
}

function SidebarLink({ item, collapsed, secondary = false }: { item: NavigationItem; collapsed: boolean; secondary?: boolean }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.path}
      end={item.path === "/"}
      className={({ isActive }) => `sidebar-nav-item ${secondary ? "secondary" : ""} ${isActive ? "active" : ""}`}
      title={collapsed ? item.label : undefined}
    >
      <Icon size={secondary ? 15 : 18} strokeWidth={1.8} />
      <span>{item.label}</span>
    </NavLink>
  );
}
