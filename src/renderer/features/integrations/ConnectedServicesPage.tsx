import { Bot, Cloud, ExternalLink, FolderSync, LoaderCircle, MonitorSmartphone, PlugZap, Save, Send, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import type { ConnectedServicesConfig, SuiteState } from "../../../shared/contracts/connectedServices";
import { Button } from "../../design-system/Button";
import { Panel } from "../../design-system/Panel";
import { useAppStore } from "../../stores/appStore";
import { PageHeading } from "../common/PageHeading";

type Service = "discord" | "shared-workspace" | "telemetry" | "mobile" | "bridge";

export function ConnectedServicesPage() {
  const selectedServerId = useAppStore((state) => state.settings?.selectedServerId);
  const setError = useAppStore((state) => state.setError);
  const [suite, setSuite] = useState<SuiteState | null>(null);
  const [config, setConfig] = useState<ConnectedServicesConfig | null>(null);
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(""); const [notice, setNotice] = useState("");

  const refresh = async () => { const value = await window.rcc.getSuiteState(); setSuite(value); setConfig(structuredClone(value.connected)); };
  useEffect(() => { void refresh().catch((error) => setError(readError(error))); const timer = setInterval(() => void window.rcc.getSuiteState().then(setSuite), 3000); return () => clearInterval(timer); }, [setError]);
  if (!suite || !config) return <Loading />;

  const persistCurrent = async () => { const value = await window.rcc.saveConnectedServices(config, secrets); setSuite(value); setConfig(structuredClone(value.connected)); setSecrets({}); };
  const save = async () => run("save", async () => { await persistCurrent(); return "Connected services saved"; });
  const test = (service: Service) => run(`test-${service}`, async () => { await persistCurrent(); return window.rcc.testConnectedService(service); });
  const syncProfile = (direction: "push" | "pull") => run(`profile-${direction}`, async () => { await persistCurrent(); return window.rcc.profileSync(direction); });
  const syncWorkspace = (direction: "push" | "pull") => run(`workspace-${direction}`, async () => { if (!selectedServerId) throw new Error("Select a Rust+ server first"); await persistCurrent(); return window.rcc.sharedWorkspaceSync(direction, selectedServerId); });
  async function run(key: string, action: () => Promise<string>) { setBusy(key); setNotice(""); try { setNotice(await action()); await refresh(); } catch (error) { setError(readError(error)); } finally { setBusy(""); } }

  return <div className="page-stack services-page">
    <PageHeading eyebrow="OPT-IN CONNECTIONS" title="Connected services" description="Discord, encrypted cross-device profiles, a local mobile dashboard, shared workspaces, privacy-controlled reporting, and permission-gated community themes. Every service remains disabled until configured." />
    {notice && <div className="suite-notice"><ShieldCheck size={16} />{notice}</div>}
    <div className="suite-grid">
      <Panel title="Discord bot" eyebrow="ALERTS + RESTRICTED COMMANDS">
        <ServiceToggle checked={config.discord.enabled} onChange={(enabled) => setConfig({ ...config, discord: { ...config.discord, enabled } })} />
        <p className="suite-copy">Sends alerts and accepts <code>{config.discord.commandPrefix} status</code> only from the server owner or approved Discord roles.</p>
        <Fields>
          <Input label="Application ID" value={config.discord.applicationId} onChange={(applicationId) => setConfig({ ...config, discord: { ...config.discord, applicationId } })} />
          <Input label="Guild ID" value={config.discord.guildId} onChange={(guildId) => setConfig({ ...config, discord: { ...config.discord, guildId } })} />
          <Input label="Alert channel ID" value={config.discord.channelId} onChange={(channelId) => setConfig({ ...config, discord: { ...config.discord, channelId } })} />
          <Input label="Command prefix" value={config.discord.commandPrefix} onChange={(commandPrefix) => setConfig({ ...config, discord: { ...config.discord, commandPrefix } })} />
          <Input label="Allowed role IDs (comma separated)" value={config.discord.allowedRoleIds.join(", ")} onChange={(value) => setConfig({ ...config, discord: { ...config.discord, allowedRoleIds: value.split(",").map((item) => item.trim()).filter(Boolean) } })} />
          <Secret label={config.discord.hasToken ? "Replace bot token" : "Bot token"} value={secrets.discordToken ?? ""} onChange={(discordToken) => setSecrets({ ...secrets, discordToken })} />
        </Fields>
        <Actions><Button compact onClick={() => void test("discord")} disabled={Boolean(busy)}><Bot size={14} /> Test bot</Button><Button compact variant="secondary" onClick={() => void run("discord-send", async () => { await persistCurrent(); await window.rcc.sendDiscordMessage("Rust Command Center test alert"); return "Discord alert sent"; })} disabled={Boolean(busy)}><Send size={14} /> Send alert</Button></Actions>
      </Panel>

      <Panel title="Encrypted profile sync" eyebrow="USER-CONTROLLED FOLDER">
        <ServiceToggle checked={config.profileSync.enabled} onChange={(enabled) => setConfig({ ...config, profileSync: { ...config.profileSync, enabled } })} />
        <p className="suite-copy">Creates one AES-256-GCM encrypted profile file suitable for OneDrive, Dropbox, a NAS, or a removable drive. The passphrase is never written into that file.</p>
        <Fields><PathInput label="Sync folder" value={config.profileSync.folderPath} onPick={async () => { const folderPath = await window.rcc.chooseDirectory("Choose an encrypted profile sync folder"); if (folderPath) setConfig({ ...config, profileSync: { ...config.profileSync, folderPath } }); }} /><Secret label={config.profileSync.hasPassphrase ? "Replace sync passphrase" : "Sync passphrase"} value={secrets.profilePassphrase ?? ""} onChange={(profilePassphrase) => setSecrets({ ...secrets, profilePassphrase })} /></Fields>
        <label className="suite-check"><input type="checkbox" checked={config.profileSync.autoSync} onChange={(event) => setConfig({ ...config, profileSync: { ...config.profileSync, autoSync: event.target.checked } })} /> Sync automatically when a workspace changes</label>
        <Actions><Button compact onClick={() => void syncProfile("push")} disabled={Boolean(busy)}><FolderSync size={14} /> Push</Button><Button compact variant="secondary" onClick={() => void syncProfile("pull")} disabled={Boolean(busy)}>Pull</Button></Actions>
      </Panel>

      <Panel title="Mobile dashboard" eyebrow="LOCAL PWA">
        <ServiceToggle checked={config.mobileDashboard.enabled} onChange={(enabled) => setConfig({ ...config, mobileDashboard: { ...config.mobileDashboard, enabled } })} />
        <p className="suite-copy">Runs a read-only, token-protected dashboard directly from this PC. LAN mode is reachable by devices on the same network and may require a Windows Firewall rule.</p>
        <Fields><Select label="Network access" value={config.mobileDashboard.bindAddress} onChange={(bindAddress) => setConfig({ ...config, mobileDashboard: { ...config.mobileDashboard, bindAddress: bindAddress as "127.0.0.1" | "0.0.0.0" } })}><option value="127.0.0.1">This PC only</option><option value="0.0.0.0">Local network</option></Select><NumberInput label="Port" value={config.mobileDashboard.port} onChange={(port) => setConfig({ ...config, mobileDashboard: { ...config.mobileDashboard, port } })} /><Secret label={config.mobileDashboard.hasToken ? "Replace access token (optional)" : "Access token (generated if blank)"} value={secrets.mobileToken ?? ""} onChange={(mobileToken) => setSecrets({ ...secrets, mobileToken })} /></Fields>
        {suite.mobileUrl && <div className="suite-url"><span>{suite.mobileUrl}</span><button onClick={() => void window.rcc.openExternal(suite.mobileUrl!)}><ExternalLink size={14} /></button></div>}
        <Actions><Button compact onClick={() => void test("mobile")} disabled={Boolean(busy)}><MonitorSmartphone size={14} /> Test dashboard</Button></Actions>
      </Panel>

      <Panel title="Shared team workspace" eyebrow="SELF-HOSTED HTTPS API">
        <ServiceToggle checked={config.sharedWorkspace.enabled} onChange={(enabled) => setConfig({ ...config, sharedWorkspace: { ...config.sharedWorkspace, enabled } })} />
        <p className="suite-copy">Pushes or pulls the selected server workspace through a small user-controlled HTTPS endpoint. The app never merges silently.</p>
        <Fields><Input label="API base URL" value={config.sharedWorkspace.endpointUrl} onChange={(endpointUrl) => setConfig({ ...config, sharedWorkspace: { ...config.sharedWorkspace, endpointUrl } })} /><Input label="Workspace ID" value={config.sharedWorkspace.workspaceId} onChange={(workspaceId) => setConfig({ ...config, sharedWorkspace: { ...config.sharedWorkspace, workspaceId } })} /><Secret label={config.sharedWorkspace.hasToken ? "Replace bearer token" : "Bearer token"} value={secrets.sharedWorkspaceToken ?? ""} onChange={(sharedWorkspaceToken) => setSecrets({ ...secrets, sharedWorkspaceToken })} /></Fields>
        <Actions><Button compact onClick={() => void syncWorkspace("push")} disabled={Boolean(busy)}>Push selected</Button><Button compact variant="secondary" onClick={() => void syncWorkspace("pull")} disabled={Boolean(busy)}>Pull selected</Button><Button compact variant="ghost" onClick={() => void test("shared-workspace")} disabled={Boolean(busy)}>Test</Button></Actions>
      </Panel>

      <Panel title="Analytics and crash reports" eyebrow="EXPLICIT CONSENT">
        <p className="suite-copy">Only sanitized application health events are supported. Rust+ tokens, chat, map notes, server addresses, RCON commands, and workspace contents are excluded.</p>
        <Fields><Input label="HTTPS collector URL" value={config.telemetry.endpointUrl} onChange={(endpointUrl) => setConfig({ ...config, telemetry: { ...config.telemetry, endpointUrl } })} /><Input label="Privacy policy URL" value={config.telemetry.privacyPolicyUrl} onChange={(privacyPolicyUrl) => setConfig({ ...config, telemetry: { ...config.telemetry, privacyPolicyUrl } })} /><Secret label={config.telemetry.hasToken ? "Replace collector token" : "Collector token"} value={secrets.telemetryToken ?? ""} onChange={(telemetryToken) => setSecrets({ ...secrets, telemetryToken })} /></Fields>
        <label className="suite-check"><input type="checkbox" checked={config.telemetry.analyticsEnabled} onChange={(event) => setConfig({ ...config, telemetry: { ...config.telemetry, analyticsEnabled: event.target.checked } })} /> I consent to sanitized product analytics</label>
        <label className="suite-check"><input type="checkbox" checked={config.telemetry.crashReportsEnabled} onChange={(event) => setConfig({ ...config, telemetry: { ...config.telemetry, crashReportsEnabled: event.target.checked } })} /> I consent to sanitized crash reports</label>
        <Actions><Button compact onClick={() => void test("telemetry")} disabled={Boolean(busy)}><Cloud size={14} /> Send test event</Button></Actions>
      </Panel>

      <Panel title="Community extensions and themes" eyebrow="DECLARATIVE + PERMISSION-GATED">
        <p className="suite-copy">RCC loads JSON manifests only—never arbitrary extension JavaScript. Themes and links must declare permissions before they can be enabled.</p>
        <div className="extension-list">{suite.extensions.length ? suite.extensions.map((extension) => <article key={extension.id}><div><strong>{extension.name} <small>v{extension.version}</small></strong><span>{extension.description}</span><code>{extension.permissions.join(" · ") || "No permissions"}</code>{extension.enabled && extension.approvedPermissions.includes("open-external") && extension.links.length > 0 && <div className="extension-links">{extension.links.map((link) => <button key={link.url} onClick={() => void window.rcc.openExternal(link.url)}>{link.label} <ExternalLink size={11} /></button>)}</div>}</div><button className={`toggle ${extension.enabled ? "on" : ""}`} onClick={() => void run(`ext-${extension.id}`, async () => { const extensions = await window.rcc.setExtensionEnabled(extension.id, !extension.enabled, extension.permissions); setSuite({ ...suite, extensions }); return `${extension.name} ${extension.enabled ? "disabled" : "enabled"}`; })}><span /></button></article>) : <div className="suite-empty">No manifests installed yet.</div>}</div>
        <Actions><Button compact variant="secondary" onClick={() => void window.rcc.openExtensionsFolder()}><Sparkles size={14} /> Open extensions folder</Button></Actions>
      </Panel>
    </div>
    <div className="suite-savebar"><span><PlugZap size={16} /> Secrets are protected with Windows encryption.</span><Button onClick={() => void save()} disabled={Boolean(busy)}>{busy === "save" ? <LoaderCircle className="spin" size={15} /> : <Save size={15} />} Save connected services</Button></div>
  </div>;
}

function Loading() { return <div className="suite-loading"><LoaderCircle className="spin" /> Loading connected services…</div>; }
function Fields({ children }: { children: ReactNode }) { return <div className="suite-fields">{children}</div>; }
function Actions({ children }: { children: ReactNode }) { return <div className="suite-actions">{children}</div>; }
function Input({ label, value, onChange }: { label: string; value: string; onChange(value: string): void }) { return <label><span>{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} /></label>; }
function Secret(props: Parameters<typeof Input>[0]) { return <label><span>{props.label}</span><input type="password" autoComplete="new-password" value={props.value} placeholder="Stored encrypted; leave blank to keep" onChange={(event) => props.onChange(event.target.value)} /></label>; }
function NumberInput({ label, value, onChange }: { label: string; value: number; onChange(value: number): void }) { return <label><span>{label}</span><input type="number" min="1024" max="65535" value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>; }
function Select({ label, value, onChange, children }: { label: string; value: string; onChange(value: string): void; children: ReactNode }) { return <label><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{children}</select></label>; }
function PathInput({ label, value, onPick }: { label: string; value: string; onPick(): void }) { return <label><span>{label}</span><div className="path-input"><input value={value} readOnly /><button onClick={onPick}>Browse</button></div></label>; }
function ServiceToggle({ checked, onChange }: { checked: boolean; onChange(value: boolean): void }) { return <div className="service-toggle-row"><span>{checked ? "Enabled" : "Disabled"}</span><button role="switch" aria-checked={checked} className={`toggle ${checked ? "on" : ""}`} onClick={() => onChange(!checked)}><span /></button></div>; }
function readError(error: unknown): string { return error instanceof Error ? error.message.replace(/^Error invoking remote method '[^']+': /, "") : "Connected service request failed"; }
