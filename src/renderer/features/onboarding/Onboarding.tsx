import { useState } from "react";
import { BellRing, Bot, Check, ChevronLeft, ChevronRight, Hexagon, LockKeyhole, MonitorCog, RadioTower, ShieldCheck } from "lucide-react";
import { Button } from "../../design-system/Button";
import { useAppStore } from "../../stores/appStore";
import { ServerForm } from "../servers/ServerForm";

const STEPS = ["Welcome", "Rust+ setup", "Pair server", "Notifications", "Discord", "Appearance", "Finish"];

export function Onboarding() {
  const [step, setStep] = useState(0);
  const [serverCreated, setServerCreated] = useState(false);
  const settings = useAppStore((state) => state.settings)!;
  const updateSettings = useAppStore((state) => state.updateSettings);

  const finish = async () => updateSettings({ onboardingComplete: true });

  return (
    <div className="onboarding">
      <div className="onboarding-rail">
        <div className="onboarding-brand"><div className="brand-mark large"><Hexagon size={25} /></div><div><strong>RUST COMMAND</strong><span>CENTER</span></div></div>
        <div className="onboarding-progress">
          {STEPS.map((label, index) => (
            <div key={label} className={`progress-step ${index === step ? "active" : ""} ${index < step ? "complete" : ""}`}>
              <span>{index < step ? <Check size={13} /> : index + 1}</span><div>{label}</div>
            </div>
          ))}
        </div>
        <div className="local-first"><ShieldCheck size={17} /><div><strong>Local-first by design</strong><span>No RCC account or product telemetry.</span></div></div>
      </div>
      <main className="onboarding-main">
        <div className="onboarding-content">
          {step === 0 && <Welcome settings={settings} onPreset={(profilePreset) => void updateSettings({ profilePreset })} />}
          {step === 1 && <RustSetup />}
          {step === 2 && <PairStep serverCreated={serverCreated} onCreated={() => setServerCreated(true)} />}
          {step === 3 && <Notifications enabled={settings.desktopNotifications} onChange={(desktopNotifications) => void updateSettings({ desktopNotifications })} />}
          {step === 4 && <DiscordStep />}
          {step === 5 && <Appearance />}
          {step === 6 && <Finish serverCreated={serverCreated} />}
        </div>
        <footer className="onboarding-footer">
          <Button variant="ghost" disabled={step === 0} onClick={() => setStep((value) => value - 1)}><ChevronLeft size={15} /> Back</Button>
          <div className="step-count">{step + 1} / {STEPS.length}</div>
          {step < STEPS.length - 1
            ? <Button variant="primary" onClick={() => setStep((value) => value + 1)}>{step === 2 && !serverCreated ? "Skip for now" : "Continue"} <ChevronRight size={15} /></Button>
            : <Button variant="primary" onClick={() => void finish()}>Open command center <ChevronRight size={15} /></Button>}
        </footer>
      </main>
    </div>
  );
}

function StepHeader({ code, title, description }: { code: string; title: string; description: string }) {
  return <header className="setup-header"><div className="eyebrow">{code}</div><h1>{title}</h1><p>{description}</p></header>;
}

function Welcome({ settings, onPreset }: { settings: { profilePreset: string }; onPreset(value: "solo" | "small-group" | "clan" | "server-owner"): void }) {
  const presets = [
    ["solo", "Solo", "A focused base operations layout"], ["small-group", "Small group", "Balanced team and base tooling"],
    ["clan", "Clan", "Denser coordination and intelligence"], ["server-owner", "Server owner", "Keeps owner integrations separate"],
  ] as const;
  return <><StepHeader code="INITIALIZE" title="Your wipe, under control." description="Rust Command Center keeps server operations, base monitoring, team context, and local intelligence in one secure Windows workspace." /><div className="preset-grid">{presets.map(([id, title, text]) => <button key={id} className={settings.profilePreset === id ? "selected" : ""} onClick={() => onPreset(id)}><strong>{title}</strong><span>{text}</span>{settings.profilePreset === id && <Check size={16} />}</button>)}</div></>;
}

function RustSetup() {
  return <><StepHeader code="RUST+ / STEAM" title="Understand the trust boundary." description="Rust+ uses server pairing credentials. RCC never asks for or stores your Steam password." /><div className="setup-card-list"><InfoCard icon={LockKeyhole} title="Credentials stay privileged" text="Steam ID and player token are encrypted through Electron safeStorage and are never returned to the renderer." /><InfoCard icon={RadioTower} title="Pair through Rust+" text="Use the upstream Rust+ registration/listening flow, pair the server in game, then paste the resulting server values on the next screen." /><InfoCard icon={ShieldCheck} title="Unofficial companion" text="RCC is not affiliated with Facepunch. It uses the unofficial Rust+ protocol library and exposes only confirmed capabilities." /></div></>;
}

function PairStep({ serverCreated, onCreated }: { serverCreated: boolean; onCreated(): void }) {
  return <><StepHeader code="SERVER PAIRING" title={serverCreated ? "Server profile created." : "Pair your first server."} description={serverCreated ? "Connection recovery and background monitoring are now enabled for this profile." : "You can skip this and pair from Server Manager later."} />{serverCreated ? <div className="success-panel"><Check size={24} /><strong>Pairing saved securely</strong><span>Continue to notification preferences.</span></div> : <ServerForm onCreated={onCreated} compact />}</>;
}

function Notifications({ enabled, onChange }: { enabled: boolean; onChange(value: boolean): void }) {
  return <><StepHeader code="NOTIFICATIONS" title="Choose how RCC gets your attention." description="Critical alert routing is configured later. This enables the Windows notification channel itself." /><ChoiceCard icon={BellRing} title="Windows desktop notifications" text="Allow connection and future alert notifications outside the app." active={enabled} onClick={() => onChange(!enabled)} /></>;
}

function DiscordStep() {
  return <><StepHeader code="OPTIONAL INTEGRATION" title="Discord stays disconnected for now." description="Bot tokens require dedicated encrypted configuration, permissions, rate limits, and audit logging. The integration will remain unavailable until those safeguards are complete." /><div className="disabled-capability"><Bot size={25} /><div><strong>Discord integration unavailable</strong><span>No token is requested and no connection is simulated.</span></div></div></>;
}

function Appearance() {
  return <><StepHeader code="APPEARANCE" title="Industrial dark, tuned for long sessions." description="The initial release uses a high-contrast dark operations theme. System theme and density controls will be added without changing status semantics." /><ChoiceCard icon={MonitorCog} title="Command center dark" text="Graphite surfaces, oxide accents, clear warning colors." active onClick={() => undefined} /></>;
}

function Finish({ serverCreated }: { serverCreated: boolean }) {
  return <><StepHeader code="READY" title="Command center initialized." description="Open the dashboard and continue setup at your own pace." /><div className="finish-checklist"><div><Check size={15} /> Local database migrated</div><div><Check size={15} /> Credential vault ready</div><div><Check size={15} /> Secure IPC boundary active</div><div className={serverCreated ? "" : "pending"}>{serverCreated ? <Check size={15} /> : <span />} {serverCreated ? "Server profile paired" : "Pair a server from Server Manager"}</div></div></>;
}

function InfoCard({ icon: Icon, title, text }: { icon: typeof LockKeyhole; title: string; text: string }) { return <div className="setup-info-card"><Icon size={19} /><div><strong>{title}</strong><span>{text}</span></div></div>; }
function ChoiceCard({ icon: Icon, title, text, active, onClick }: { icon: typeof BellRing; title: string; text: string; active: boolean; onClick(): void }) { return <button className={`choice-card ${active ? "selected" : ""}`} onClick={onClick}><Icon size={22} /><div><strong>{title}</strong><span>{text}</span></div><span className="choice-indicator">{active ? <Check size={14} /> : null}</span></button>; }
