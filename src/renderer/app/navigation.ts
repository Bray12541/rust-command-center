import {
  Activity, BellRing, Bot, Boxes, Calculator, Camera, ChartNoAxesCombined, CircleHelp,
  Clock3, CloudCog, Cog, DatabaseZap, Gauge, Map, MapPinned, MessageSquare, RadioTower,
  ScrollText, Server, ShieldAlert, ShoppingCart, Siren, SquareKanban, Users, Workflow,
  type LucideIcon,
} from "lucide-react";

export interface NavigationItem {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  phase: number;
  capability?: string;
}

export const navigation: NavigationItem[] = [
  { id: "dashboard", label: "Dashboard", path: "/", icon: Gauge, phase: 3 },
  { id: "map", label: "Map", path: "/map", icon: Map, phase: 4, capability: "Live map requires server map data" },
  { id: "team", label: "Team", path: "/team", icon: Users, phase: 5, capability: "Team data requires a live Rust+ connection" },
  { id: "chat", label: "Chat", path: "/chat", icon: MessageSquare, phase: 5, capability: "Team chat requires a live Rust+ connection and team membership" },
  { id: "bases", label: "Bases", path: "/bases", icon: Boxes, phase: 6, capability: "Logical base management is scheduled for Phase 6" },
  { id: "devices", label: "Devices", path: "/devices", icon: RadioTower, phase: 6, capability: "Pair a smart device before device controls are available" },
  { id: "cameras", label: "Cameras", path: "/cameras", icon: Camera, phase: 6, capability: "Camera support is limited to frames exposed by Rust+" },
  { id: "alerts", label: "Alerts", path: "/alerts", icon: BellRing, phase: 7, capability: "Alert routing is scheduled for Phase 7" },
  { id: "raids", label: "Raid Center", path: "/raids", icon: ShieldAlert, phase: 7, capability: "Possible Raid Detection requires configured alarm zones" },
  { id: "automation", label: "Automation", path: "/automation", icon: Workflow, phase: 8, capability: "The safeguarded automation engine is scheduled for Phase 8" },
  { id: "shops", label: "Shops", path: "/shops", icon: ShoppingCart, phase: 10, capability: "Shop intelligence requires vending markers from a connected server" },
  { id: "players", label: "Player Intel", path: "/players", icon: MapPinned, phase: 10, capability: "Local intelligence notebooks are scheduled for Phase 10" },
  { id: "wipe", label: "Wipe Planner", path: "/wipe-planner", icon: SquareKanban, phase: 11, capability: "Wipe planning is scheduled for Phase 11" },
  { id: "calculators", label: "Calculators", path: "/calculators", icon: Calculator, phase: 12, capability: "Calculators require a versioned game-data dataset" },
  { id: "analytics", label: "Analytics", path: "/analytics", icon: ChartNoAxesCombined, phase: 13, capability: "Charts appear only after real local telemetry exists" },
  { id: "discord", label: "Discord", path: "/discord", icon: Bot, phase: 9, capability: "Discord is optional and is not configured" },
  { id: "integrations", label: "Integrations", path: "/integrations", icon: CloudCog, phase: 10, capability: "No external integrations are configured" },
  { id: "servers", label: "Servers", path: "/servers", icon: Server, phase: 3 },
  { id: "diagnostics", label: "Diagnostics", path: "/diagnostics", icon: Activity, phase: 3 },
  { id: "logs", label: "Logs", path: "/logs", icon: ScrollText, phase: 3, capability: "Log export and redacted viewing are being hardened" },
  { id: "settings", label: "Settings", path: "/settings", icon: Cog, phase: 3 },
  { id: "help", label: "Help", path: "/help", icon: CircleHelp, phase: 3 },
];

export const commandItems = [
  ...navigation.filter((item) => item.phase <= 3).map((item) => ({ label: `Open ${item.label}`, path: item.path, icon: item.icon })),
  { label: "Connection diagnostics", path: "/diagnostics", icon: DatabaseZap },
  { label: "Manage paired servers", path: "/servers", icon: Server },
  { label: "Application settings", path: "/settings", icon: Cog },
  { label: "Rust+ pairing help", path: "/help", icon: CircleHelp },
  { label: "Review connection activity", path: "/diagnostics", icon: Clock3 },
  { label: "Alert readiness", path: "/alerts", icon: Siren },
];
