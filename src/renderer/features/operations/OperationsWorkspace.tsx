import {
  AlarmClock, BellRing, Box, Cable, Camera, Check, ChevronLeft, ChevronRight,
  CircleDot, Clock3, Download, Expand, ExternalLink, Eye, EyeOff, Focus, Gauge, Layers3,
  MapPin, MessageSquare, PackageSearch, PanelRightClose,
  Pause, PencilRuler, Pin, Play, Plus, RadioTower, RefreshCw, Route, Search, Send, Server,
  ShieldAlert, ShoppingCart, Sparkles, Star, Trash2, Upload, Users,
  Video, WifiOff, Workflow, Wrench, X, ZoomIn, ZoomOut, type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent, type WheelEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import type { MapMarker, OperationsSnapshot, RustPlusCommand, WorkspaceDocument } from "../../../shared/contracts/operations";
import type { ServerTelemetry } from "../../../shared/contracts/app";
import { Button } from "../../design-system/Button";
import { useAppStore, useSelectedServer, useSelectedWorkspace } from "../../stores/appStore";

type Drawer = "overview" | "events" | "team" | "chat" | "devices" | "shops" | "cameras" | "automation" | "tools";
type Layers = { grid: boolean; monuments: boolean; events: boolean; shops: boolean; team: boolean; notes: boolean; routes: boolean; heatmap: boolean };

const DRAWERS: Array<{ id: Drawer; label: string; icon: LucideIcon }> = [
  { id: "overview", label: "Overview", icon: Gauge }, { id: "events", label: "Events", icon: BellRing },
  { id: "team", label: "Team", icon: Users }, { id: "chat", label: "Comms", icon: MessageSquare },
  { id: "devices", label: "Devices", icon: RadioTower }, { id: "shops", label: "Shops", icon: ShoppingCart },
  { id: "cameras", label: "Cameras", icon: Camera }, { id: "automation", label: "Automation", icon: Workflow },
  { id: "tools", label: "Plan", icon: Wrench },
];

const ROUTE_DRAWERS: Record<string, Drawer> = {
  "/team": "team", "/chat": "chat", "/devices": "devices", "/alerts": "events", "/cameras": "cameras",
  "/automation": "automation", "/shops": "shops", "/bases": "tools", "/wipe-planner": "tools", "/calculators": "tools",
};

const ITEM_NAMES: Record<number, string> = {
  [-1581843485]: "Sulfur", [-1211166256]: "Assault Rifle", [-932201673]: "Gun Powder", [-2099697608]: "Metal Fragments",
  [-151838493]: "HQM", [-946369541]: "Wood", [-4031221]: "Low Grade Fuel", [69511070]: "Metal Ore", [-1157596551]: "Tech Trash",
};

const markerLabel: Record<MapMarker["type"], string> = {
  player: "Player", explosion: "Explosion", vending: "Vending machine", ch47: "CH47", cargo: "Cargo Ship",
  crate: "Locked Crate", radius: "Event zone", "patrol-heli": "Patrol Helicopter", unknown: "Unknown marker",
};

export function OperationsWorkspace() {
  const location = useLocation();
  const server = useSelectedServer();
  const telemetry = useAppStore((state) => server ? state.telemetry[server.id] : undefined);
  const operations = useAppStore((state) => server ? state.operations[server.id] : undefined);
  const workspace = useSelectedWorkspace();
  const settings = useAppStore((state) => state.settings)!;
  const saveWorkspace = useAppStore((state) => state.saveWorkspace);
  const upsertServer = useAppStore((state) => state.upsertServer);
  const setError = useAppStore((state) => state.setError);
  const cameraFrame = useAppStore((state) => server ? state.cameraFrames[server.id] : undefined);
  const [drawer, setDrawer] = useState<Drawer | null>(ROUTE_DRAWERS[location.pathname] ?? "overview");
  const [layersOpen, setLayersOpen] = useState(false);
  const [layers, setLayers] = useState<Layers>({ grid: true, monuments: true, events: true, shops: true, team: true, notes: true, routes: true, heatmap: false });
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState({ x: 512, y: 512 });
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const [addPin, setAddPin] = useState(false);
  const [measure, setMeasure] = useState<Array<{ x: number; y: number }>>([]);
  const [measureActive, setMeasureActive] = useState(false);
  const [routeDraft, setRouteDraft] = useState<Array<{ x: number; y: number }> | null>(null);
  const [monumentSearch, setMonumentSearch] = useState("");
  const [alwaysOnTop, setAlwaysOnTop] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const mapRef = useRef<SVGSVGElement>(null);
  const stageRef = useRef<HTMLElement>(null);
  const dragRef = useRef<{ clientX: number; clientY: number; centerX: number; centerY: number } | null>(null);
  const map = operations?.map;
  const mapWidth = map?.width ?? 1024;
  const mapHeight = map?.height ?? 1024;
  useEffect(() => {
    setCenter({ x: mapWidth / 2, y: mapHeight / 2 });
  }, [mapWidth, mapHeight]);
  useEffect(() => { if (ROUTE_DRAWERS[location.pathname]) setDrawer(ROUTE_DRAWERS[location.pathname]); }, [location.pathname]);

  const persist = useCallback((mutate: (next: WorkspaceDocument) => void) => {
    if (!server) return;
    const next = structuredClone(workspace);
    mutate(next);
    void saveWorkspace(server.id, next).catch((error) => setError(readError(error)));
  }, [server, workspace, saveWorkspace, setError]);

  useAutomationEngine(server?.id ?? null, operations, workspace, settings.desktopNotifications, persist);
  useEffect(() => {
    if (!settings.teamLocationHistory || !operations?.team || workspace.positionHistory.at(-1)?.observedAt === operations.observedAt) return;
    persist((next) => { next.positionHistory.push(...operations.team!.members.map((member) => ({ steamId: member.steamId, x: member.x, y: member.y, observedAt: operations.observedAt }))); next.positionHistory = next.positionHistory.slice(-10000); });
  }, [settings.teamLocationHistory, operations, workspace.positionHistory, persist]);

  const connected = server?.status === "CONNECTED";
  const visibleWidth = mapWidth / zoom;
  const visibleHeight = mapHeight / zoom;
  const viewBox = `${clamp(center.x - visibleWidth / 2, 0, Math.max(0, mapWidth - visibleWidth))} ${clamp(center.y - visibleHeight / 2, 0, Math.max(0, mapHeight - visibleHeight))} ${visibleWidth} ${visibleHeight}`;

  const connect = async () => {
    if (!server) return;
    setConnecting(true);
    try { upsertServer(await window.rcc.connectServer(server.id)); }
    catch (error) { setError(readError(error)); }
    finally { setConnecting(false); }
  };

  const mapPoint = (clientX: number, clientY: number) => {
    const svg = mapRef.current;
    if (!svg) return null;
    const point = svg.createSVGPoint(); point.x = clientX; point.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const result = point.matrixTransform(ctm.inverse());
    return { x: clamp(result.x, 0, mapWidth), y: clamp(mapHeight - result.y, 0, mapHeight) };
  };

  const onMapClick = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (dragRef.current || !map) return;
    const point = mapPoint(event.clientX, event.clientY);
    if (!point) return;
    if (addPin) {
      persist((next) => next.pins.push({ id: crypto.randomUUID(), label: `Pin ${next.pins.length + 1}`, category: "general", color: "#ef7548", x: point.x, y: point.y, note: "" }));
      setAddPin(false);
    } else if (routeDraft) setRouteDraft((current) => [...(current ?? []), point]);
    else if (measureActive && measure.length < 2) setMeasure((current) => [...current, point]);
    else if (measureActive) setMeasure([point]);
  };

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const point = mapPoint(event.clientX, event.clientY);
    setPointer(point);
    const drag = dragRef.current;
    if (!drag || !mapRef.current) return;
    const rect = mapRef.current.getBoundingClientRect();
    setCenter({
      x: clamp(drag.centerX - (event.clientX - drag.clientX) * (visibleWidth / rect.width), visibleWidth / 2, mapWidth - visibleWidth / 2),
      y: clamp(drag.centerY - (event.clientY - drag.clientY) * (visibleHeight / rect.height), visibleHeight / 2, mapHeight - visibleHeight / 2),
    });
  };

  const exportMap = async () => {
    if (!map) return;
    const image = new Image(); image.src = map.imageDataUrl; await image.decode();
    const canvas = document.createElement("canvas"); canvas.width = map.width; canvas.height = map.height;
    const context = canvas.getContext("2d"); if (!context) return;
    context.drawImage(image, 0, 0, map.width, map.height);
    context.font = "600 18px system-ui"; context.textAlign = "center";
    for (const marker of operations?.markers ?? []) { context.fillStyle = markerColor(marker.type); context.beginPath(); context.arc(marker.x, map.height - marker.y, 8, 0, Math.PI * 2); context.fill(); }
    for (const pin of workspace.pins) { context.fillStyle = pin.color; context.beginPath(); context.arc(pin.x, map.height - pin.y, 8, 0, Math.PI * 2); context.fill(); context.fillText(pin.label, pin.x, map.height - pin.y - 14); }
    const link = document.createElement("a"); link.download = `${server?.name ?? "rust"}-annotated-map.png`; link.href = canvas.toDataURL("image/png"); link.click();
  };

  const distance = measure.length === 2 ? Math.hypot(measure[1].x - measure[0].x, measure[1].y - measure[0].y) : null;

  return (
    <div className="operations-workspace">
      <section className="operations-map-stage" ref={stageRef}>
        {map ? (
          <svg
            ref={mapRef} className={`live-map ${addPin ? "placing-pin" : ""}`} viewBox={viewBox}
            onWheel={(event: WheelEvent<SVGSVGElement>) => { event.preventDefault(); setZoom((value) => clamp(value * (event.deltaY < 0 ? 1.22 : .82), 1, 8)); }}
            onPointerDown={(event) => { if (event.button === 0 && !addPin) { dragRef.current = { clientX: event.clientX, clientY: event.clientY, centerX: center.x, centerY: center.y }; event.currentTarget.setPointerCapture(event.pointerId); } }}
            onPointerMove={onPointerMove} onPointerUp={(event) => { if (dragRef.current && Math.hypot(event.clientX - dragRef.current.clientX, event.clientY - dragRef.current.clientY) < 4) { dragRef.current = null; onMapClick(event); } else dragRef.current = null; }}
            onPointerLeave={() => { setPointer(null); dragRef.current = null; }} aria-label="Interactive Rust map"
          >
            <image href={map.imageDataUrl} x="0" y="0" width={map.width} height={map.height} preserveAspectRatio="none" />
            {map.oceanMargin > 0 && <rect x={map.oceanMargin} y={map.oceanMargin} width={Math.max(0, map.width - map.oceanMargin * 2)} height={Math.max(0, map.height - map.oceanMargin * 2)} fill="none" stroke="rgba(99,199,222,.55)" strokeDasharray="8 6" vectorEffect="non-scaling-stroke" />}
            {layers.heatmap && (workspace.positionHistory.length ? workspace.positionHistory.slice(-600) : operations?.team?.members ?? []).map((member, index) => <circle key={`heat-${member.steamId}-${index}`} cx={member.x} cy={map.height - member.y} r={90 / zoom} className="map-heat" />)}
            {layers.grid && <MapGrid width={map.width} height={map.height} zoom={zoom} />}
            {layers.monuments && map.monuments.filter((monument) => prettyToken(monument.token).toLowerCase().includes(monumentSearch.toLowerCase())).map((monument) => <g key={`${monument.token}-${monument.x}`} className="map-monument"><circle cx={monument.x} cy={map.height - monument.y} r={6 / zoom} /><text x={monument.x} y={map.height - monument.y - 11 / zoom} fontSize={13 / zoom}>{prettyToken(monument.token)}</text></g>)}
            {layers.events && operations?.markers.filter((marker) => marker.type !== "vending" && marker.type !== "player").map((marker) => <MapMarkerGlyph key={marker.id} marker={marker} height={map.height} zoom={zoom} />)}
            {layers.shops && operations?.markers.filter((marker) => marker.type === "vending").map((marker) => <MapMarkerGlyph key={marker.id} marker={marker} height={map.height} zoom={zoom} />)}
            {layers.team && operations?.team?.members.map((member) => <g key={member.steamId} className={`map-team-member ${member.isOnline ? "online" : "offline"}`}><circle cx={member.x} cy={map.height - member.y} r={9 / zoom} /><text x={member.x} y={map.height - member.y - 15 / zoom} fontSize={12 / zoom}>{workspace.memberProfiles[member.steamId]?.nickname || member.name}</text></g>)}
            {layers.notes && workspace.pins.map((pin) => <g key={pin.id} className="map-local-pin"><circle cx={pin.x} cy={map.height - pin.y} r={8 / zoom} fill={pin.color} /><text x={pin.x} y={map.height - pin.y - 14 / zoom} fontSize={12 / zoom}>{pin.label}</text></g>)}
            {layers.notes && operations?.team?.mapNotes.map((note, index) => <circle key={`team-note-${index}`} cx={note.x} cy={map.height - note.y} r={7 / zoom} fill="#c792ea" stroke="#fff" vectorEffect="non-scaling-stroke" />)}
            {layers.notes && operations?.team?.leaderMapNotes.map((note, index) => <circle key={`leader-note-${index}`} cx={note.x} cy={map.height - note.y} r={8 / zoom} fill="#ffd166" stroke="#fff" vectorEffect="non-scaling-stroke" />)}
            {layers.routes && workspace.routes.flatMap((route) => route.points.length > 1 ? [<polyline key={route.id} points={route.points.map((point) => `${point.x},${map.height - point.y}`).join(" ")} fill="none" stroke={route.color} strokeWidth={3 / zoom} />] : [])}
            {measure.length > 0 && <g className="map-measure">{measure.length === 2 && <line x1={measure[0].x} y1={map.height - measure[0].y} x2={measure[1].x} y2={map.height - measure[1].y} strokeWidth={2 / zoom} />} {measure.map((point, index) => <circle key={index} cx={point.x} cy={map.height - point.y} r={5 / zoom} />)}</g>}
            {routeDraft && routeDraft.length > 0 && <polyline points={routeDraft.map((point) => `${point.x},${map.height - point.y}`).join(" ")} fill="none" stroke="#ef7548" strokeWidth={3 / zoom} strokeDasharray={`${8 / zoom} ${5 / zoom}`} />}
          </svg>
        ) : <EmptyMap server={server} connected={connected} connecting={connecting} onConnect={connect} />}

        <div className="map-floating-status">
          <span className={`stage-light ${connected ? "online" : ""}`} /><strong>{settings.streamerMode ? "Hidden server" : server?.name ?? "No server selected"}</strong>
          <span><Users size={13} />{operations?.team?.members.filter((member) => member.isOnline).length ?? 0}/{operations?.team?.members.length ?? 0}</span>
          <span><Clock3 size={13} />{telemetry?.rustTime ?? "—"}</span>
          {pointer && <span className="map-coordinate">{gridCoordinate(pointer.x, pointer.y, mapWidth, mapHeight)} · {Math.round(pointer.x)}, {Math.round(pointer.y)}</span>}
        </div>

        <div className="map-tool-stack">
          <button onClick={() => setZoom((value) => clamp(value * 1.25, 1, 8))} disabled={!map} title="Zoom in"><ZoomIn size={16} /></button>
          <button onClick={() => setZoom((value) => clamp(value / 1.25, 1, 8))} disabled={!map} title="Zoom out"><ZoomOut size={16} /></button>
          <button onClick={() => { setZoom(1); if (map) setCenter({ x: map.width / 2, y: map.height / 2 }); }} disabled={!map} title="Fit map"><Focus size={16} /></button>
          <button className={addPin ? "active" : ""} onClick={() => setAddPin((value) => !value)} disabled={!map} title="Place pin"><MapPin size={16} /></button>
          <button className={measureActive ? "active" : ""} onClick={() => { setMeasureActive((value) => !value); setMeasure([]); }} disabled={!map} title="Measure distance"><PencilRuler size={16} /></button>
          <button className={routeDraft ? "active" : ""} onClick={() => setRouteDraft((value) => value ? null : [])} disabled={!map} title="Draw route"><Route size={16} /></button>
          <button className={layersOpen ? "active" : ""} onClick={() => setLayersOpen((value) => !value)} disabled={!map} title="Map layers"><Layers3 size={16} /></button>
          <button onClick={() => void exportMap()} disabled={!map} title="Export annotated map"><Download size={16} /></button>
          <button onClick={() => void stageRef.current?.requestFullscreen()} title="Fullscreen map"><Expand size={16} /></button>
          <button onClick={() => void window.rcc.openPanelWindow("map")} title="Open compact map window"><ExternalLink size={16} /></button>
          <button className={alwaysOnTop ? "active" : ""} onClick={() => { const next = !alwaysOnTop; setAlwaysOnTop(next); void window.rcc.setAlwaysOnTop(next); }} title="Always on top"><Pin size={16} /></button>
        </div>

        {layersOpen && <LayerMenu layers={layers} onChange={setLayers} onClose={() => setLayersOpen(false)} monumentSearch={monumentSearch} onMonumentSearch={setMonumentSearch} />}
        {distance != null && <div className="map-distance"><Route size={14} /><strong>{Math.round(distance)} m</strong><span>straight-line estimate</span><button onClick={() => { setMeasure([]); setMeasureActive(false); }}><X size={13} /></button></div>}
        {routeDraft && <div className="map-route-draft"><Route size={14} /><strong>{routeDraft.length} points</strong><button disabled={routeDraft.length < 2} onClick={() => { persist((next) => next.routes.push({ id: crypto.randomUUID(), name: `Route ${next.routes.length + 1}`, color: "#ef7548", points: routeDraft })); setRouteDraft(null); }}>Save route</button><button onClick={() => setRouteDraft(null)}>Cancel</button></div>}

        <nav className="workspace-dock" aria-label="Operations tools">
          {DRAWERS.map((item) => <button key={item.id} className={drawer === item.id ? "active" : ""} onClick={() => setDrawer((current) => current === item.id ? null : item.id)} title={item.label}><item.icon size={17} /><span>{item.label}</span></button>)}
        </nav>
      </section>

      {drawer && <aside className="operations-drawer">
        <header><div><span>OPERATIONS</span><strong>{DRAWERS.find((item) => item.id === drawer)?.label}</strong></div><button onClick={() => setDrawer(null)}><PanelRightClose size={18} /></button></header>
        <div className="drawer-content">
          {drawer === "overview" && <OverviewPanel telemetry={telemetry} operations={operations} serverName={server?.name ?? null} />}
          {drawer === "events" && <EventsPanel operations={operations} workspace={workspace} persist={persist} />}
          {drawer === "team" && <TeamPanel operations={operations} workspace={workspace} persist={persist} execute={(command) => execute(server?.id, command, setError)} focus={(x, y) => { setCenter({ x, y: mapHeight - y }); setZoom(3); }} />}
          {drawer === "chat" && <ChatPanel operations={operations} workspace={workspace} persist={persist} execute={(command) => execute(server?.id, command, setError)} />}
          {drawer === "devices" && <DevicesPanel operations={operations} workspace={workspace} persist={persist} execute={(command) => execute(server?.id, command, setError)} />}
          {drawer === "shops" && <ShopsPanel operations={operations} workspace={workspace} persist={persist} />}
          {drawer === "cameras" && <CamerasPanel workspace={workspace} frame={cameraFrame} persist={persist} execute={(command) => execute(server?.id, command, setError)} />}
          {drawer === "automation" && <AutomationPanel workspace={workspace} persist={persist} />}
          {drawer === "tools" && <ToolsPanel serverId={server?.id ?? null} workspace={workspace} persist={persist} setError={setError} />}
        </div>
      </aside>}
    </div>
  );
}

function EmptyMap({ server, connected, connecting, onConnect }: { server: ReturnType<typeof useSelectedServer>; connected: boolean; connecting: boolean; onConnect(): void }) {
  return <div className="map-empty-card operations-empty"><div className="map-empty-icon">{!server ? <Server size={27} /> : connected ? <RefreshCw size={27} /> : <WifiOff size={27} />}</div><h1>{!server ? "Pair a server to begin" : connected ? "Loading live operations data…" : "Ready to open the map?"}</h1><p>{!server ? "Add a Rust+ profile. The app never invents live player or map data." : connected ? "The map, team, markers, shops, and chats are being requested from Rust+." : "Connect this paired profile to load its live map and operations feed."}</p>{!server ? <Link to="/servers"><Button variant="primary"><RadioTower size={15} /> Server Manager</Button></Link> : !connected && <Button variant="primary" onClick={onConnect} disabled={connecting}><Cable size={15} />{connecting ? "Connecting…" : "Connect"}</Button>}</div>;
}

function MapGrid({ width, height, zoom }: { width: number; height: number; zoom: number }) {
  const size = Math.max(width, height) / 8;
  return <g className="map-grid-lines">{Array.from({ length: 9 }, (_, index) => <line key={`v${index}`} x1={index * size} y1="0" x2={index * size} y2={height} strokeWidth={1 / zoom} />)}{Array.from({ length: 9 }, (_, index) => <line key={`h${index}`} x1="0" y1={index * size} x2={width} y2={index * size} strokeWidth={1 / zoom} />)}</g>;
}

function MapMarkerGlyph({ marker, height, zoom }: { marker: MapMarker; height: number; zoom: number }) {
  const y = height - marker.y;
  return <g className={`map-world-marker marker-${marker.type}`}><circle cx={marker.x} cy={y} r={marker.radius ? marker.radius : 10 / zoom} fill={markerColor(marker.type)} opacity={marker.radius ? .18 : .95} /><circle cx={marker.x} cy={y} r={4 / zoom} fill={markerColor(marker.type)} /><text x={marker.x} y={y - 15 / zoom} fontSize={12 / zoom}>{marker.name ?? markerLabel[marker.type]}</text></g>;
}

function LayerMenu({ layers, onChange, onClose, monumentSearch, onMonumentSearch }: { layers: Layers; onChange(value: Layers): void; onClose(): void; monumentSearch: string; onMonumentSearch(value: string): void }) {
  return <div className="layer-menu"><header><strong>Map layers</strong><button onClick={onClose}><X size={14} /></button></header><div className="layer-search"><Search size={13} /><input value={monumentSearch} onChange={(event) => onMonumentSearch(event.target.value)} placeholder="Filter monuments…" /></div>{Object.entries(layers).map(([key, value]) => <label key={key}><span>{value ? <Eye size={14} /> : <EyeOff size={14} />}{prettyToken(key)}</span><input type="checkbox" checked={value} onChange={() => onChange({ ...layers, [key]: !value })} /></label>)}</div>;
}

function OverviewPanel({ telemetry, operations, serverName }: { telemetry?: ServerTelemetry; operations?: OperationsSnapshot; serverName: string | null }) {
  const servers = useAppStore((state) => state.servers);
  const allTelemetry = useAppStore((state) => state.telemetry);
  const wipe = telemetry?.wipeTime ? new Date(telemetry.wipeTime) : null;
  const nextWipe = wipe ? nextMonthlyWipe(wipe) : null;
  const dayProgress = telemetry?.rustTimeDecimal == null || telemetry.sunrise == null || telemetry.sunset == null ? null : telemetry.rustTimeDecimal < telemetry.sunrise || telemetry.rustTimeDecimal > telemetry.sunset ? 0 : ((telemetry.rustTimeDecimal - telemetry.sunrise) / (telemetry.sunset - telemetry.sunrise)) * 100;
  return <div className="drawer-stack">
    {telemetry?.headerImage && <img className="server-header-image" src={telemetry.headerImage} alt="Server header" referrerPolicy="no-referrer" />}
    <section className="drawer-hero"><div>{telemetry?.logoImage ? <img src={telemetry.logoImage} alt="" /> : <Server size={23} />}</div><span>CONNECTED SERVER</span><h2>{telemetry?.name ?? serverName ?? "No telemetry"}</h2><p>{telemetry?.mapName ?? "Unknown map"} · {telemetry?.mapSize ? `${telemetry.mapSize}m` : "Unknown size"}{telemetry?.mapSeed != null ? ` · seed ${telemetry.mapSeed}` : ""}</p></section>
    <div className="metric-grid"><Metric label="Population" value={telemetry?.players == null ? "—" : `${telemetry.players}/${telemetry.maxPlayers ?? "?"}`} detail={`${telemetry?.queuedPlayers ?? 0} queued`} /><Metric label="Latency" value={telemetry?.latencyMs == null ? "—" : `${telemetry.latencyMs} ms`} detail={telemetry?.connectionQuality ?? "offline"} /><Metric label="Rust time" value={telemetry?.rustTime ?? "—"} detail={telemetry?.sunrise == null ? "Sun cycle unavailable" : `↑ ${formatRustTime(telemetry.sunrise)} · ↓ ${formatRustTime(telemetry.sunset)}`} /><Metric label="Team" value={`${operations?.team?.members.filter((member) => member.isOnline).length ?? 0}/${operations?.team?.members.length ?? 0}`} detail="online members" /></div>
    {dayProgress != null && <section className="day-cycle"><header><span>Daylight progress</span><strong>{Math.round(dayProgress)}%</strong></header><div><i style={{ width: `${dayProgress}%` }} /></div></section>}
    <section className="info-list"><Row label="Wiped" value={wipe ? `${relativeTime(wipe)} · ${wipe.toLocaleString()}` : "Unknown"} /><Row label="Expected next wipe" value={nextWipe ? `${relativeFuture(nextWipe)} · ${nextWipe.toLocaleDateString()}` : "Unknown"} /><Row label="Connected" value={telemetry?.connectedAt ? relativeTime(new Date(telemetry.connectedAt)) : "—"} /><Row label="Last update" value={telemetry?.observedAt ? relativeTime(new Date(telemetry.observedAt)) : "—"} /><Row label="Reconnects" value={String(telemetry?.reconnectCount ?? 0)} /></section>
    {telemetry?.websiteUrl && <button className="drawer-link" onClick={() => void window.rcc.openExternal(telemetry.websiteUrl!)}>Open server website <ChevronRight size={14} /></button>}
    {servers.length > 1 && <><div className="section-title"><span>All saved servers</span><strong>{servers.filter((item) => item.status === "CONNECTED").length} connected</strong></div><div className="compact-list">{servers.map((item) => <article key={item.id}><span className={`stage-light ${item.status === "CONNECTED" ? "online" : ""}`} /><div><strong>{item.name}{item.favorite ? " ★" : ""}</strong><span>{item.status.toLowerCase().replaceAll("_", " ")} · {allTelemetry[item.id]?.players ?? "—"}/{allTelemetry[item.id]?.maxPlayers ?? "—"} players</span></div></article>)}</div></>}
  </div>;
}

function EventsPanel({ operations, workspace, persist }: PanelProps) {
  const [search, setSearch] = useState("");
  const markers = (operations?.markers ?? []).filter((marker) => marker.type !== "vending" && `${markerLabel[marker.type]} ${marker.name ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="drawer-stack"><SearchBox value={search} onChange={setSearch} placeholder="Search current events…" /><div className="section-title"><span>Live world events</span><strong>{markers.length}</strong></div><div className="compact-list">{markers.map((marker) => <article key={marker.id}><span className="marker-dot" style={{ background: markerColor(marker.type) }} /><div><strong>{marker.name ?? markerLabel[marker.type]}</strong><span>{Math.round(marker.x)}, {Math.round(marker.y)} · live marker</span></div></article>)}{markers.length === 0 && <EmptyLine text="No matching world events are active." />}</div><div className="section-title"><span>Monitoring zones</span><button onClick={() => persist((next) => next.zones.push({ id: crypto.randomUUID(), name: `Zone ${next.zones.length + 1}`, x: 500, y: 500, radius: 150, eventTypes: ["explosion"], enabled: true }))}><Plus size={13} /> Add</button></div><div className="compact-list">{workspace.zones.map((zone) => <article key={zone.id}><CircleDot size={16} /><div><strong>{zone.name}</strong><span>{zone.radius}m · {zone.eventTypes.join(", ")}</span></div><button onClick={() => persist((next) => { next.zones = next.zones.filter((item) => item.id !== zone.id); })}><Trash2 size={13} /></button></article>)}<EmptyLine when={workspace.zones.length === 0} text="Add a zone to receive nearby-event warnings." /></div><div className="section-title"><span>Activity timeline</span><strong>{workspace.activity.length}</strong></div><div className="activity-list">{workspace.activity.slice(-30).reverse().map((entry) => <article key={entry.id} className={`severity-${entry.severity}`}><time>{new Date(entry.createdAt).toLocaleTimeString()}</time><div><strong>{entry.type}</strong><span>{entry.message}</span></div></article>)}<EmptyLine when={workspace.activity.length === 0} text="Event, automation, device, and team changes will be retained here." /></div></div>;
}

function TeamPanel({ operations, workspace, persist, execute, focus }: PanelProps & { execute(command: RustPlusCommand): void; focus(x: number, y: number): void }) {
  const [search, setSearch] = useState("");
  const members = (operations?.team?.members ?? []).filter((member) => `${member.name} ${workspace.memberProfiles[member.steamId]?.nickname ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="drawer-stack"><SearchBox value={search} onChange={setSearch} placeholder="Search team members…" /><div className="section-title"><span>Roster</span><strong>{members.filter((member) => member.isOnline).length} online</strong></div><div className="member-list">{members.map((member) => { const profile = workspace.memberProfiles[member.steamId]; return <article key={member.steamId}><button className="member-focus" onClick={() => focus(member.x, member.y)}><span className={`member-avatar ${member.isOnline ? "online" : ""}`}>{member.name.slice(0, 2).toUpperCase()}</span></button><div><strong>{profile?.nickname || member.name}{member.isLeader && <Star size={12} fill="currentColor" />}</strong><span>{member.isOnline ? "Online" : `Offline · ${member.deathTime ? `died ${relativeTime(new Date(member.deathTime))}` : "last known position"}`}</span><small>{Math.round(member.x)}, {Math.round(member.y)} · {profile?.role || "No local role"}</small></div><select value={profile?.role ?? ""} onChange={(event) => persist((next) => { next.memberProfiles[member.steamId] = { nickname: profile?.nickname ?? "", role: event.target.value, color: profile?.color ?? "#79b8ff" }; })}><option value="">Role</option><option>Builder</option><option>Farmer</option><option>Pilot</option><option>Roamer</option></select>{!member.isLeader && <button title="Promote to team leader" onClick={() => { if (confirm(`Promote ${member.name} to team leader?`)) execute({ type: "promote_to_leader", steamId: member.steamId }); }}><Star size={13} /></button>}</article>; })}<EmptyLine when={members.length === 0} text="Team data appears after joining a Rust team." /></div><TaskBoard workspace={workspace} persist={persist} /></div>;
}

function TaskBoard({ workspace, persist }: Pick<PanelProps, "workspace" | "persist">) {
  const [title, setTitle] = useState("");
  return <><div className="section-title"><span>Team tasks</span><strong>{workspace.tasks.filter((task) => task.status !== "done").length} open</strong></div><form className="inline-form" onSubmit={(event) => { event.preventDefault(); if (!title.trim()) return; persist((next) => next.tasks.push({ id: crypto.randomUUID(), title: title.trim(), assignee: "", status: "todo", dueAt: null })); setTitle(""); }}><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Add a task…" /><button><Plus size={14} /></button></form><div className="task-list">{workspace.tasks.map((task) => <article key={task.id} className={task.status === "done" ? "done" : ""}><button onClick={() => persist((next) => { const target = next.tasks.find((item) => item.id === task.id); if (target) target.status = target.status === "todo" ? "doing" : target.status === "doing" ? "done" : "todo"; })}>{task.status === "done" ? <Check size={14} /> : task.status === "doing" ? <Play size={14} /> : <CircleDot size={14} />}</button><span>{task.title}</span><button onClick={() => persist((next) => { next.tasks = next.tasks.filter((item) => item.id !== task.id); })}><Trash2 size={13} /></button></article>)}</div></>;
}

function ChatPanel({ operations, workspace, persist, execute }: PanelProps & { execute(command: RustPlusCommand): void }) {
  const [channel, setChannel] = useState<"team" | "clan">("team"); const [message, setMessage] = useState(""); const [search, setSearch] = useState("");
  const [motd, setMotd] = useState(operations?.clan?.motd ?? "");
  useEffect(() => setMotd(operations?.clan?.motd ?? ""), [operations?.clan?.motd]);
  const messages = (channel === "team" ? operations?.teamChat : operations?.clanChat) ?? [];
  const filtered = messages.filter((item) => `${item.name} ${item.message}`.toLowerCase().includes(search.toLowerCase()));
  const submit = (event: FormEvent) => { event.preventDefault(); if (!message.trim()) return; execute({ type: channel === "team" ? "send_team_message" : "send_clan_message", message: message.trim() }); setMessage(""); };
  return <div className="drawer-stack chat-panel"><div className="segmented"><button className={channel === "team" ? "active" : ""} onClick={() => setChannel("team")}>Team</button><button className={channel === "clan" ? "active" : ""} onClick={() => setChannel("clan")}>Clan</button><button title="Mute chat notifications" className={workspace.mutedChat ? "active" : ""} onClick={() => persist((next) => { next.mutedChat = !next.mutedChat; })}><BellRing size={13} /></button><button title="Pop out chat" onClick={() => void window.rcc.openPanelWindow("chat")}><ExternalLink size={13} /></button><button title="Export chat" onClick={() => exportChat(channel, messages)}><Download size={13} /></button></div>{channel === "clan" && operations?.clan && <section className="clan-summary"><header><div><span>CLAN</span><strong>{operations.clan.name}</strong></div><small>{operations.clan.members.filter((member) => member.online).length}/{operations.clan.members.length} online · max {operations.clan.maxMemberCount}</small></header><label>MOTD<textarea value={motd} onChange={(event) => setMotd(event.target.value)} maxLength={500} /></label><button disabled={!motd.trim() || motd === operations.clan.motd} onClick={() => { if (confirm("Update the clan MOTD? Rust+ will enforce your clan permissions.")) execute({ type: "set_clan_motd", message: motd.trim() }); }}>Update MOTD</button><div className="clan-roles">{operations.clan.roles.map((role) => <span key={role.roleId}>{role.name} · rank {role.rank}</span>)}</div>{operations.clan.invites.length > 0 && <small>{operations.clan.invites.length} pending clan invite(s)</small>}</section>}<SearchBox value={search} onChange={setSearch} placeholder="Search messages…" /><div className="message-list">{filtered.map((item) => <article key={item.id}><span className="chat-avatar" style={{ background: item.color ?? undefined }}>{item.name.slice(0, 1).toUpperCase()}</span><div><header><strong>{item.name}</strong><time>{new Date(item.sentAt).toLocaleTimeString()}</time></header><p>{highlightMentions(item.message)}</p></div></article>)}<EmptyLine when={filtered.length === 0} text={`No ${channel} messages available.`} /></div><div className="template-row">{workspace.chatTemplates.map((template) => <button key={template.id} onClick={() => setMessage(template.message)}>{template.label}</button>)}<button onClick={() => persist((next) => next.chatTemplates.push({ id: crypto.randomUUID(), label: "Callout", message: "Meet at my marker." }))}><Plus size={12} /></button></div><form className="chat-compose" onSubmit={submit}><input value={message} onChange={(event) => setMessage(event.target.value)} maxLength={500} placeholder={`Message ${channel}…`} /><button disabled={!message.trim()}><Send size={15} /></button></form></div>;
}

function DevicesPanel({ operations, workspace, persist, execute }: PanelProps & { execute(command: RustPlusCommand): void }) {
  const [entityId, setEntityId] = useState(""); const [name, setName] = useState("");
  const add = (event: FormEvent) => { event.preventDefault(); const id = Number(entityId); if (!Number.isInteger(id) || id <= 0 || workspace.devices.some((device) => device.entityId === id)) return; persist((next) => next.devices.push({ entityId: id, name: name.trim() || `Device ${id}`, kind: "unknown", group: "Base", icon: "radio", favorite: false, confirmActions: true, lowStockThreshold: null })); execute({ type: "refresh_entity", entityId: id }); setEntityId(""); setName(""); };
  return <div className="drawer-stack"><form className="device-add-form" onSubmit={add}><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Device name" /><input value={entityId} onChange={(event) => setEntityId(event.target.value.replace(/\D/g, ""))} placeholder="Entity ID" inputMode="numeric" /><button><Plus size={14} /> Pair</button></form><div className="section-title"><span>Paired devices</span><strong>{workspace.devices.length}</strong></div><div className="device-list">{workspace.devices.map((config) => { const live = operations?.devices.find((device) => device.entityId === config.entityId); return <article key={config.entityId}><div className={`device-icon ${live?.active ? "active" : ""}`}>{live?.kind === "alarm" ? <AlarmClock size={18} /> : live?.kind === "storage" ? <Box size={18} /> : <RadioTower size={18} />}</div><div><strong>{config.name}</strong><span>{live ? `${live.kind} · ${live.active ? "active" : "inactive"}` : "Waiting for entity data"}</span>{live?.capacity != null && <small>{live.items.reduce((sum, item) => sum + item.quantity, 0).toLocaleString()} items · {live.capacity} slots</small>}</div><button onClick={() => execute({ type: "refresh_entity", entityId: config.entityId })} title="Refresh"><RefreshCw size={13} /></button>{live && live.kind !== "storage" && <button className={live.active ? "device-toggle on" : "device-toggle"} onClick={() => { if (!config.confirmActions || confirm(`${live.active ? "Turn off" : "Turn on"} ${config.name}?`)) execute({ type: "set_entity_value", entityId: config.entityId, value: !live.active }); }}><span /></button>}<button onClick={() => persist((next) => { next.devices = next.devices.filter((item) => item.entityId !== config.entityId); })}><Trash2 size={13} /></button>{live?.items.length ? <div className="storage-items">{live.items.map((item) => <span key={`${item.itemId}-${item.isBlueprint}`}>{itemName(item.itemId)} <strong>{item.quantity.toLocaleString()}</strong>{item.isBlueprint ? " BP" : ""}</span>)}</div> : null}</article>; })}<EmptyLine when={workspace.devices.length === 0} text="Enter an in-game entity ID to monitor a switch, alarm, or storage monitor." /></div></div>;
}

function ShopsPanel({ operations, workspace, persist }: PanelProps) {
  const [search, setSearch] = useState(""); const [inStock, setInStock] = useState(true);
  const shops = (operations?.markers ?? []).filter((marker) => marker.type === "vending" && (!inStock || !marker.outOfStock) && `${marker.name ?? ""} ${marker.sellOrders.map((order) => itemName(order.itemId)).join(" ")}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="drawer-stack"><div className="filter-row"><SearchBox value={search} onChange={setSearch} placeholder="Search items or shops…" /><button className={inStock ? "active" : ""} onClick={() => setInStock((value) => !value)}><PackageSearch size={14} /></button></div><div className="section-title"><span>Vending machines</span><strong>{shops.length}</strong></div><div className="shop-list">{shops.map((shop) => <article key={shop.id}><header><div><strong>{shop.name ?? "Vending machine"}</strong><span>{Math.round(shop.x)}, {Math.round(shop.y)} · {shop.outOfStock ? "out of stock" : "in stock"}</span></div><button className={workspace.shopFavorites.includes(shop.id) ? "favorite" : ""} onClick={() => persist((next) => { next.shopFavorites = next.shopFavorites.includes(shop.id) ? next.shopFavorites.filter((id) => id !== shop.id) : [...next.shopFavorites, shop.id]; })}><Star size={14} fill={workspace.shopFavorites.includes(shop.id) ? "currentColor" : "none"} /></button></header>{shop.sellOrders.map((order, index) => <div className="sell-order" key={`${shop.id}-${index}`}><span>{itemName(order.itemId)}{order.itemIsBlueprint ? " BP" : ""}</span><strong>{order.quantity} for {order.costPerItem} {itemName(order.currencyId)}</strong><small>{order.amountInStock} available</small><button onClick={() => persist((next) => next.shoppingList.push({ id: crypto.randomUUID(), itemId: order.itemId, label: itemName(order.itemId), quantity: order.quantity, done: false }))}><Plus size={12} /></button></div>)}</article>)}<EmptyLine when={shops.length === 0} text="No matching vending-machine markers are available." /></div></div>;
}

function CamerasPanel({ workspace, frame, persist, execute }: Pick<PanelProps, "workspace" | "persist"> & { frame?: { cameraId: string; imageDataUrl: string; timestamp: string }; execute(command: RustPlusCommand): void }) {
  const [cameraId, setCameraId] = useState(""); const [active, setActive] = useState<string | null>(null);
  const open = (id: string) => { setActive(id); execute({ type: "camera_open", cameraId: id }); };
  return <div className="drawer-stack"><form className="inline-form" onSubmit={(event) => { event.preventDefault(); const id = cameraId.trim().toUpperCase(); if (!id || workspace.cameras.some((camera) => camera.id === id)) return; persist((next) => next.cameras.push({ id, name: id, favorite: false, lowRefresh: false })); setCameraId(""); }}><input value={cameraId} onChange={(event) => setCameraId(event.target.value)} placeholder="Camera ID, e.g. DOME1" /><button><Plus size={14} /></button></form>{active && <section className="camera-view"><header><span className="camera-live" /> <strong>{active}</strong><button onClick={() => { execute({ type: "camera_close" }); setActive(null); }}><X size={14} /></button></header>{frame?.cameraId === active ? <img src={frame.imageDataUrl} alt={`Frame from ${active}`} /> : <div className="camera-wait"><Video size={26} /><span>Waiting for reconstructed camera rays…</span></div>}<div className="camera-controls"><button onClick={() => execute({ type: "camera_move", x: -12, y: 0 })}><ChevronLeft size={15} /></button><button onClick={() => execute({ type: "camera_move", x: 0, y: -12 })}>↑</button><button onClick={() => execute({ type: "camera_move", x: 0, y: 12 })}>↓</button><button onClick={() => execute({ type: "camera_move", x: 12, y: 0 })}><ChevronRight size={15} /></button><button onClick={() => execute({ type: "camera_zoom" })}><ZoomIn size={15} /></button><a href={frame?.imageDataUrl} download={`${active}-${Date.now()}.png`}><Download size={15} /></a></div></section>}<div className="camera-list">{workspace.cameras.map((camera) => <article key={camera.id}><Camera size={17} /><div><strong>{camera.name}</strong><span>{camera.id}</span></div><button onClick={() => open(camera.id)}>{active === camera.id ? "Live" : "Open"}</button><button onClick={() => persist((next) => { next.cameras = next.cameras.filter((item) => item.id !== camera.id); })}><Trash2 size={13} /></button></article>)}<EmptyLine when={workspace.cameras.length === 0} text="Camera IDs are entered manually because Rust+ does not expose a discovery list." /></div><p className="safety-note"><ShieldAlert size={14} /> Turret firing and reload actions are intentionally disabled. Camera frames are reconstructed from Rust+ rays, not conventional video.</p></div>;
}

function AutomationPanel({ workspace, persist }: Pick<PanelProps, "workspace" | "persist">) {
  const addRule = () => persist((next) => next.automationRules.push({ id: crypto.randomUUID(), name: `Rule ${next.automationRules.length + 1}`, enabled: true, trigger: "cargo_appeared", triggerValue: "", action: "notification", actionValue: "", cooldownSeconds: 300, severity: "warning", lastRunAt: null }));
  return <div className="drawer-stack"><button className={`automation-kill ${workspace.automationPaused ? "paused" : ""}`} onClick={() => persist((next) => { next.automationPaused = !next.automationPaused; })}>{workspace.automationPaused ? <Play size={15} /> : <Pause size={15} />}<div><strong>{workspace.automationPaused ? "Resume all automation" : "Emergency pause"}</strong><span>{workspace.automationPaused ? "Rules are currently disabled" : "Immediately suspend every rule"}</span></div></button><section className="quiet-hours"><label><input type="checkbox" checked={workspace.quietHours.enabled} onChange={() => persist((next) => { next.quietHours.enabled = !next.quietHours.enabled; })} /> Quiet hours</label><input type="time" value={workspace.quietHours.start} onChange={(event) => persist((next) => { next.quietHours.start = event.target.value; })} /><span>to</span><input type="time" value={workspace.quietHours.end} onChange={(event) => persist((next) => { next.quietHours.end = event.target.value; })} /><small>Critical rules still run.</small></section><div className="section-title"><span>Safeguarded rules</span><button onClick={addRule}><Plus size={13} /> New rule</button></div><div className="rule-list">{workspace.automationRules.map((rule) => <article key={rule.id} className={!rule.enabled ? "disabled" : ""}><header><button className="rule-enabled" onClick={() => persist((next) => { const target = next.automationRules.find((item) => item.id === rule.id); if (target) target.enabled = !target.enabled; })}><span /></button><input value={rule.name} onChange={(event) => persist((next) => { const target = next.automationRules.find((item) => item.id === rule.id); if (target) target.name = event.target.value; })} /><button onClick={() => persist((next) => { next.automationRules = next.automationRules.filter((item) => item.id !== rule.id); })}><Trash2 size={13} /></button></header><label>When<select value={rule.trigger} onChange={(event) => persist((next) => { const target = next.automationRules.find((item) => item.id === rule.id); if (target) target.trigger = event.target.value; })}><option value="cargo_appeared">Cargo appears</option><option value="heli_appeared">Helicopter appears</option><option value="crate_appeared">Crate appears</option><option value="explosion_appeared">Explosion appears</option><option value="alarm_active">Smart alarm activates</option><option value="member_died">Team member dies</option><option value="member_offline">Team member goes offline</option><option value="chat_mention">Team chat mentions me</option></select></label><label>Then<select value={rule.action} onChange={(event) => persist((next) => { const target = next.automationRules.find((item) => item.id === rule.id); if (target) target.action = event.target.value; })}><option value="notification">Windows notification</option><option value="team_message">Send team message</option><option value="clan_message">Send clan message</option><option value="switch_on">Turn switch on</option><option value="switch_off">Turn switch off</option><option value="webhook">HTTPS / Discord webhook</option></select></label><input className="rule-value" value={rule.actionValue} onChange={(event) => persist((next) => { const target = next.automationRules.find((item) => item.id === rule.id); if (target) target.actionValue = event.target.value; })} placeholder={rule.action === "webhook" ? "https://…" : rule.action.startsWith("switch") ? "Entity ID" : "Optional message"} /><footer><span>Cooldown {rule.cooldownSeconds}s</span><span>{rule.lastRunAt ? `Ran ${relativeTime(new Date(rule.lastRunAt))}` : "Never run"}</span></footer></article>)}<EmptyLine when={workspace.automationRules.length === 0} text="Create a rule to react to live Rust+ events." /></div></div>;
}

function ToolsPanel({ serverId, workspace, persist, setError }: Pick<PanelProps, "workspace" | "persist"> & { serverId: string | null; setError(message: string | null): void }) {
  const [tab, setTab] = useState<"notes" | "checklists" | "shopping" | "calculator" | "data">("notes"); const [note, setNote] = useState("");
  const [rockets, setRockets] = useState(1); const [dailyUpkeep, setDailyUpkeep] = useState(0);
  return <div className="drawer-stack"><div className="tool-tabs">{(["notes", "checklists", "shopping", "calculator", "data"] as const).map((item) => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{prettyToken(item)}</button>)}</div>{tab === "notes" && <><form className="note-form" onSubmit={(event) => { event.preventDefault(); if (!note.trim()) return; persist((next) => next.notes.push({ id: crypto.randomUUID(), title: `Note ${next.notes.length + 1}`, body: note.trim(), scope: "server", x: null, y: null, updatedAt: new Date().toISOString() })); setNote(""); }}><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Server, base, electrical, or monument note…" /><button>Add note</button></form><div className="note-list">{workspace.notes.map((item) => <article key={item.id}><strong>{item.title}</strong><p>{item.body}</p><footer><span>{relativeTime(new Date(item.updatedAt))}</span><button onClick={() => persist((next) => { next.notes = next.notes.filter((noteItem) => noteItem.id !== item.id); })}><Trash2 size={13} /></button></footer></article>)}</div></>}{tab === "checklists" && <><button className="wide-add" onClick={() => persist((next) => next.checklists.push({ id: crypto.randomUUID(), name: "Raid preparation", items: [{ id: crypto.randomUUID(), label: "Weapons repaired", done: false }, { id: crypto.randomUUID(), label: "Meds crafted", done: false }, { id: crypto.randomUUID(), label: "Escape route marked", done: false }] }))}><Plus size={14} /> Add checklist</button>{workspace.checklists.map((list) => <section className="checklist" key={list.id}><header><strong>{list.name}</strong><button onClick={() => persist((next) => { next.checklists = next.checklists.filter((item) => item.id !== list.id); })}><Trash2 size={13} /></button></header>{list.items.map((item) => <label key={item.id}><input type="checkbox" checked={item.done} onChange={() => persist((next) => { const target = next.checklists.find((entry) => entry.id === list.id)?.items.find((entry) => entry.id === item.id); if (target) target.done = !target.done; })} /><span>{item.label}</span></label>)}</section>)}</>}{tab === "shopping" && <><form className="inline-form" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const label = String(form.get("item") ?? "").trim(); if (!label) return; persist((next) => next.shoppingList.push({ id: crypto.randomUUID(), itemId: null, label, quantity: 1, done: false })); event.currentTarget.reset(); }}><input name="item" placeholder="Add an item…" /><button><Plus size={14} /></button></form><div className="task-list">{workspace.shoppingList.map((item) => <article key={item.id} className={item.done ? "done" : ""}><button onClick={() => persist((next) => { const target = next.shoppingList.find((entry) => entry.id === item.id); if (target) target.done = !target.done; })}>{item.done ? <Check size={14} /> : <ShoppingCart size={14} />}</button><span>{item.quantity}× {item.label}</span><button onClick={() => persist((next) => { next.shoppingList = next.shoppingList.filter((entry) => entry.id !== item.id); })}><Trash2 size={13} /></button></article>)}</div></>}{tab === "calculator" && <div className="calculator-grid"><section><header><Sparkles size={16} /><strong>Rocket materials</strong></header><label>Rockets<input type="number" min="1" value={rockets} onChange={(event) => setRockets(Math.max(1, Number(event.target.value)))} /></label><Row label="Sulfur" value={(rockets * 1400).toLocaleString()} /><Row label="Gun powder" value={(rockets * 1950).toLocaleString()} /><Row label="Metal pipes" value={(rockets * 2).toLocaleString()} /></section><section><header><Clock3 size={16} /><strong>Upkeep runway</strong></header><label>Daily resource cost<input type="number" min="0" value={dailyUpkeep} onChange={(event) => setDailyUpkeep(Math.max(0, Number(event.target.value)))} /></label><Row label="3 days" value={(dailyUpkeep * 3).toLocaleString()} /><Row label="7 days" value={(dailyUpkeep * 7).toLocaleString()} /><p>Game values should be verified after Rust balance updates.</p></section></div>}{tab === "data" && <div className="data-actions"><button disabled={!serverId} onClick={() => serverId && void window.rcc.exportData(serverId).catch((error) => setError(readError(error)))}><Download size={18} /><div><strong>Export workspace</strong><span>JSON backup of local pins, rules, notes, tasks, devices, and tools</span></div></button><button disabled={!serverId} onClick={() => serverId && void window.rcc.importData(serverId).then((result) => { if (result) location.reload(); }).catch((error) => setError(readError(error)))}><Upload size={18} /><div><strong>Import workspace</strong><span>Validate and restore an RCC workspace backup</span></div></button></div>}</div>;
}

function useAutomationEngine(serverId: string | null, operations: OperationsSnapshot | undefined, workspace: WorkspaceDocument, notifications: boolean, persist: (mutate: (next: WorkspaceDocument) => void) => void) {
  const previous = useRef<OperationsSnapshot | null>(null);
  useEffect(() => {
    if (!serverId || !operations) return;
    const before = previous.current;
    previous.current = operations;
    if (!before || before.serverId !== operations.serverId || workspace.automationPaused) return;
    const signals = detectSignals(before, operations);
    if (!signals.length) return;
    for (const signal of signals) {
      const quiet = isQuietHours(workspace.quietHours);
      const rules = workspace.automationRules.filter((rule) => rule.enabled && rule.trigger === signal.type && (!quiet || rule.severity === "critical") && (!rule.lastRunAt || Date.now() - new Date(rule.lastRunAt).getTime() >= rule.cooldownSeconds * 1000));
      for (const rule of rules) {
        const message = rule.actionValue || signal.message;
        if (rule.action === "notification" && notifications) void window.rcc.showNotification(rule.name, message);
        if (rule.action === "team_message") void window.rcc.executeCommand(serverId, { type: "send_team_message", message });
        if (rule.action === "clan_message") void window.rcc.executeCommand(serverId, { type: "send_clan_message", message });
        if ((rule.action === "switch_on" || rule.action === "switch_off") && Number(rule.actionValue) > 0) void window.rcc.executeCommand(serverId, { type: "set_entity_value", entityId: Number(rule.actionValue), value: rule.action === "switch_on" });
        if (rule.action === "webhook" && rule.actionValue.startsWith("https://")) void window.rcc.sendWebhook(rule.actionValue, { content: `[Rust Command Center] ${signal.message}`, event: signal.type, serverId });
        persist((next) => {
          const target = next.automationRules.find((item) => item.id === rule.id); if (target) target.lastRunAt = new Date().toISOString();
          next.activity.push({ id: crypto.randomUUID(), type: rule.name, message: signal.message, severity: rule.severity, createdAt: new Date().toISOString() });
          next.activity = next.activity.slice(-1000);
        });
      }
    }
  }, [serverId, operations, notifications, persist, workspace.automationPaused, workspace.automationRules, workspace.quietHours]);
}

function detectSignals(before: OperationsSnapshot, after: OperationsSnapshot): Array<{ type: string; message: string }> {
  const signals: Array<{ type: string; message: string }> = [];
  const beforeMarkers = new Set(before.markers.map((marker) => marker.id));
  for (const marker of after.markers.filter((item) => !beforeMarkers.has(item.id))) {
    const type = marker.type === "cargo" ? "cargo_appeared" : marker.type === "patrol-heli" || marker.type === "ch47" ? "heli_appeared" : marker.type === "crate" ? "crate_appeared" : marker.type === "explosion" ? "explosion_appeared" : null;
    if (type) signals.push({ type, message: `${marker.name ?? markerLabel[marker.type]} appeared at ${Math.round(marker.x)}, ${Math.round(marker.y)}` });
  }
  const beforeMembers = new Map(before.team?.members.map((member) => [member.steamId, member]));
  for (const member of after.team?.members ?? []) { const old = beforeMembers.get(member.steamId); if (old?.isOnline && !member.isOnline) signals.push({ type: "member_offline", message: `${member.name} went offline` }); if (old?.isAlive && !member.isAlive) signals.push({ type: "member_died", message: `${member.name} died` }); }
  const beforeDevices = new Map(before.devices.map((device) => [device.entityId, device]));
  for (const device of after.devices) { const old = beforeDevices.get(device.entityId); if (device.kind === "alarm" && device.active && !old?.active) signals.push({ type: "alarm_active", message: `Smart alarm ${device.entityId} activated` }); }
  const oldMessages = new Set(before.teamChat.map((message) => message.id));
  for (const message of after.teamChat.filter((item) => !oldMessages.has(item.id) && /@\w+/.test(item.message))) signals.push({ type: "chat_mention", message: `${message.name}: ${message.message}` });
  return signals;
}

type PanelProps = { operations?: OperationsSnapshot; workspace: WorkspaceDocument; persist(mutate: (next: WorkspaceDocument) => void): void };
function Metric({ label, value, detail }: { label: string; value: string; detail: string }) { return <section className="metric"><span>{label}</span><strong>{value}</strong><small>{detail}</small></section>; }
function Row({ label, value }: { label: string; value: string }) { return <div className="info-row"><span>{label}</span><strong>{value}</strong></div>; }
function SearchBox({ value, onChange, placeholder }: { value: string; onChange(value: string): void; placeholder: string }) { return <label className="drawer-search"><Search size={14} /><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label>; }
function EmptyLine({ text, when = true }: { text: string; when?: boolean }) { return when ? <div className="drawer-empty-line">{text}</div> : null; }

function execute(serverId: string | undefined, command: RustPlusCommand, setError: (message: string | null) => void) { if (!serverId) return; void window.rcc.executeCommand(serverId, command).catch((error) => setError(readError(error))); }
function readError(error: unknown) { return error instanceof Error ? error.message.replace(/^Error invoking remote method '[^']+': /, "") : "Request failed"; }
function clamp(value: number, minimum: number, maximum: number) { return Math.min(maximum, Math.max(minimum, value)); }
function prettyToken(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function markerColor(type: MapMarker["type"]) { return ({ cargo: "#4fc3f7", ch47: "#ffc857", "patrol-heli": "#ff8a65", crate: "#ffd166", explosion: "#ff5252", vending: "#75d69c", player: "#79b8ff", radius: "#c792ea", unknown: "#9aa49f" } as Record<MapMarker["type"], string>)[type]; }
function itemName(itemId: number) { return ITEM_NAMES[itemId] ?? `Item ${itemId}`; }
function gridCoordinate(x: number, y: number, width: number, height: number) { const columns = Math.max(1, Math.ceil(width / 146.3)); const column = clamp(Math.floor(x / (width / columns)), 0, 25); const row = clamp(Math.floor((height - y) / (height / columns)), 0, 99) + 1; return `${String.fromCharCode(65 + column)}${row}`; }
function formatRustTime(value: number | null) { if (value == null) return "—"; return `${Math.floor(value).toString().padStart(2, "0")}:${Math.floor((value % 1) * 60).toString().padStart(2, "0")}`; }
function relativeTime(date: Date) { const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000)); if (seconds < 60) return `${seconds}s ago`; if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`; if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`; return `${Math.floor(seconds / 86400)}d ago`; }
function relativeFuture(date: Date) { const seconds = Math.max(0, Math.round((date.getTime() - Date.now()) / 1000)); if (seconds < 3600) return `${Math.floor(seconds / 60)}m`; if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`; return `${Math.floor(seconds / 86400)}d`; }
function nextMonthlyWipe(from: Date) { const date = new Date(from); date.setUTCMonth(date.getUTCMonth() + 1, 1); while (date.getUTCDay() !== 4) date.setUTCDate(date.getUTCDate() + 1); date.setUTCHours(19, 0, 0, 0); return date; }
function highlightMentions(message: string) { const parts = message.split(/(@\w+)/g); return <>{parts.map((part, index) => part.startsWith("@") ? <mark key={index}>{part}</mark> : part)}</>; }
function exportChat(channel: string, messages: Array<{ sentAt: string; name: string; message: string }>) { const blob = new Blob([messages.map((message) => `[${new Date(message.sentAt).toLocaleString()}] ${message.name}: ${message.message}`).join("\n")], { type: "text/plain" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `${channel}-chat-${new Date().toISOString().slice(0, 10)}.txt`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function isQuietHours(quiet: WorkspaceDocument["quietHours"]) { if (!quiet.enabled) return false; const now = new Date(); const current = now.getHours() * 60 + now.getMinutes(); const [startHour, startMinute] = quiet.start.split(":").map(Number); const [endHour, endMinute] = quiet.end.split(":").map(Number); const start = startHour * 60 + startMinute; const end = endHour * 60 + endMinute; return start <= end ? current >= start && current < end : current >= start || current < end; }
