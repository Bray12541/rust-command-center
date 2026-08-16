import { BellRing, Download, Eye, Gauge, HardDrive, MonitorCog, Palette, Power, ShieldCheck, TextCursorInput } from "lucide-react";
import type { ReactNode } from "react";
import { Panel } from "../../design-system/Panel";
import { useAppStore } from "../../stores/appStore";
import { PageHeading } from "../common/PageHeading";

export function SettingsPage() {
  const settings = useAppStore((state) => state.settings)!;
  const update = useAppStore((state) => state.updateSettings);
  return <div className="page-stack"><PageHeading eyebrow="LOCAL CONFIGURATION" title="Settings" description="Window, privacy, accessibility, notification, and release preferences. Pairing credentials stay encrypted and are never displayed here." /><div className="settings-grid">
    <Panel title="Application" eyebrow="WINDOWS">
      <Setting icon={Power} title="Launch at startup" description="Start RCC when you sign in to Windows"><Toggle checked={settings.launchAtStartup} onChange={(value) => void update({ launchAtStartup: value })} /></Setting>
      <Setting icon={MonitorCog} title="Close behavior" description="Keep background monitoring active"><select value={settings.closeBehavior} onChange={(event) => void update({ closeBehavior: event.target.value as "tray" | "exit" | "ask" })}><option value="tray">Close to tray</option><option value="exit">Exit completely</option><option value="ask">Ask each time</option></select></Setting>
      <Setting icon={Eye} title="Compact navigation" description="Collapse the single sidebar to icons"><Toggle checked={settings.sidebarCollapsed} onChange={(value) => void update({ sidebarCollapsed: value })} /></Setting>
      <Setting icon={Gauge} title="Compact density" description="Fit more operations data in drawers"><Toggle checked={settings.compactDensity} onChange={(value) => void update({ compactDensity: value })} /></Setting>
    </Panel>
    <Panel title="Privacy & alerts" eyebrow="LOCAL-FIRST">
      <Setting icon={BellRing} title="Desktop notifications" description="Allow native Windows event alerts"><Toggle checked={settings.desktopNotifications} onChange={(value) => void update({ desktopNotifications: value })} /></Setting>
      <Setting icon={HardDrive} title="Team position history" description="Opt in to retaining local movement history"><Toggle checked={settings.teamLocationHistory} onChange={(value) => void update({ teamLocationHistory: value })} /></Setting>
      <Setting icon={ShieldCheck} title="Streamer mode" description="Hide server addresses, names, and Steam IDs"><Toggle checked={settings.streamerMode} onChange={(value) => void update({ streamerMode: value })} /></Setting>
      <Setting icon={ShieldCheck} title="Application analytics" description="Disabled unless explicitly configured in Connected Services"><span className="locked-setting">Opt-in only</span></Setting>
    </Panel>
    <Panel title="Appearance & accessibility" eyebrow="DISPLAY">
      <Setting icon={Palette} title="Color theme" description="Choose dark, light, system, or high contrast"><select value={settings.theme} onChange={(event) => void update({ theme: event.target.value as typeof settings.theme })}><option value="dark">Dark</option><option value="light">Light</option><option value="system">System</option><option value="high-contrast">High contrast</option></select></Setting>
      <Setting icon={TextCursorInput} title="Interface scale" description={`${Math.round(settings.uiScale * 100)}%`}><input className="scale-slider" type="range" min="0.8" max="1.4" step="0.05" value={settings.uiScale} onChange={(event) => void update({ uiScale: Number(event.target.value) })} /></Setting>
      <Setting icon={Palette} title="Colorblind markers" description="Use shape and contrast reinforcement"><Toggle checked={settings.colorblindMarkers} onChange={(value) => void update({ colorblindMarkers: value })} /></Setting>
    </Panel>
    <Panel title="Updates" eyebrow="GITHUB RELEASES">
      <Setting icon={Download} title="Release channel" description="Installed builds update in place"><select value={settings.updateChannel} onChange={(event) => void update({ updateChannel: event.target.value as "stable" | "beta", skippedUpdateVersion: null })}><option value="stable">Stable</option><option value="beta">Beta / prerelease</option></select></Setting>
      <Setting icon={Download} title="Skipped version" description="Clear the skip to offer it again"><button className="settings-action" disabled={!settings.skippedUpdateVersion} onClick={() => void update({ skippedUpdateVersion: null })}>{settings.skippedUpdateVersion ? `Clear ${settings.skippedUpdateVersion}` : "None"}</button></Setting>
      <Setting icon={ShieldCheck} title="Package verification" description="Update metadata is verified before install"><span className="locked-setting">Enabled</span></Setting>
    </Panel>
  </div></div>;
}

function Setting({ icon: Icon, title, description, children }: { icon: typeof Power; title: string; description: string; children: ReactNode }) { return <div className="setting-row"><div className="setting-icon"><Icon size={17} /></div><div><strong>{title}</strong><span>{description}</span></div><div className="setting-control">{children}</div></div>; }
function Toggle({ checked, onChange }: { checked: boolean; onChange(value: boolean): void }) { return <button role="switch" aria-checked={checked} className={`toggle ${checked ? "on" : ""}`} onClick={() => onChange(!checked)}><span /></button>; }
