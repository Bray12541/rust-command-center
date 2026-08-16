import crypto from "node:crypto";
import http, { type IncomingMessage, type ServerResponse } from "node:http";
import os from "node:os";
import type { Logger } from "pino";
import { ownerEventSchema, type ConnectedServicesConfig, type OwnerEvent, type ServerOwnerConfig } from "../../shared/contracts/connectedServices";
import { CredentialVault } from "../security/credentialVault";

type SummaryProvider = () => Record<string, unknown>;

export class LocalGatewayService {
  private mobile: http.Server | null = null;
  private bridge: http.Server | null = null;
  private events: OwnerEvent[] = [];
  private mobileUrl: string | null = null;
  private bridgeUrl: string | null = null;

  constructor(private readonly vault: CredentialVault, private readonly logger: Logger, private readonly summary: SummaryProvider) {}
  snapshot(): { mobileUrl: string | null; bridgeUrl: string | null; events: OwnerEvent[] } { return { mobileUrl: this.mobileUrl, bridgeUrl: this.bridgeUrl, events: this.events.slice(-500) }; }

  async configureMobile(config: ConnectedServicesConfig["mobileDashboard"]): Promise<void> {
    await this.closeServer("mobile"); if (!config.enabled) return;
    const token = this.vault.getSecret("mobile-token"); if (!token) throw new Error("Generate or save a mobile dashboard token first");
    this.mobile = http.createServer((request, response) => void this.handleMobile(request, response, token));
    await listen(this.mobile, config.port, config.bindAddress);
    const host = config.bindAddress === "0.0.0.0" ? lanAddress() : "127.0.0.1";
    this.mobileUrl = `http://${host}:${config.port}/#token=${encodeURIComponent(token)}`;
  }

  async configureBridge(config: ServerOwnerConfig["bridge"]): Promise<void> {
    await this.closeServer("bridge"); if (!config.enabled) return;
    const token = this.vault.getSecret("owner-bridge-token"); if (!token) throw new Error("Generate or save a plugin bridge token first");
    this.bridge = http.createServer((request, response) => void this.handleBridge(request, response, token));
    await listen(this.bridge, config.port, config.bindAddress);
    const host = config.bindAddress === "0.0.0.0" ? lanAddress() : "127.0.0.1";
    this.bridgeUrl = `http://${host}:${config.port}/api/events`;
  }

  async shutdown(): Promise<void> { await Promise.all([this.closeServer("mobile"), this.closeServer("bridge")]); }

  private async handleMobile(request: IncomingMessage, response: ServerResponse, token: string): Promise<void> {
    const url = new URL(request.url ?? "/", "http://rcc.local");
    if (url.pathname === "/manifest.webmanifest") return json(response, 200, { name: "Rust Command Center Mobile", short_name: "RCC", start_url: "/", display: "standalone", background_color: "#0b0e0e", theme_color: "#cf623e" });
    if (url.pathname === "/sw.js") return send(response, 200, "application/javascript", "self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('fetch',()=>{});");
    if (url.pathname === "/api/status") {
      if (!secureEqual(url.searchParams.get("token"), token)) return json(response, 401, { error: "Unauthorized" });
      return json(response, 200, { ...this.summary(), observedAt: new Date().toISOString() });
    }
    if (url.pathname !== "/") return json(response, 404, { error: "Not found" });
    return send(response, 200, "text/html; charset=utf-8", mobileHtml());
  }

  private async handleBridge(request: IncomingMessage, response: ServerResponse, token: string): Promise<void> {
    if (request.method === "GET" && request.url === "/health") return json(response, 200, { status: "ok" });
    if (request.method !== "POST" || request.url !== "/api/events") return json(response, 404, { error: "Not found" });
    if (!secureEqual(request.headers.authorization?.replace(/^Bearer\s+/i, "") ?? null, token)) return json(response, 401, { error: "Unauthorized" });
    try {
      const raw = await readBody(request, 256 * 1024);
      const input = JSON.parse(raw) as Record<string, unknown>;
      const event = ownerEventSchema.parse({ id: crypto.randomUUID(), profileId: input.profileId ?? null, type: input.type ?? "custom", severity: input.severity ?? "info", title: input.title ?? "Server event", message: input.message ?? "", metadata: input.metadata ?? {}, createdAt: new Date().toISOString() });
      this.events.push(event); if (this.events.length > 500) this.events.shift();
      return json(response, 202, { accepted: true, id: event.id });
    } catch (error) { this.logger.warn({ service: "owner-bridge", error }, "Bridge event rejected"); return json(response, 400, { error: "Invalid event payload" }); }
  }

  private async closeServer(which: "mobile" | "bridge"): Promise<void> {
    const server = this[which]; this[which] = null; if (which === "mobile") this.mobileUrl = null; else this.bridgeUrl = null;
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

function secureEqual(provided: string | null, expected: string): boolean { if (!provided) return false; const a = Buffer.from(provided); const b = Buffer.from(expected); return a.length === b.length && crypto.timingSafeEqual(a, b); }
function lanAddress(): string { for (const values of Object.values(os.networkInterfaces())) for (const value of values ?? []) if (value.family === "IPv4" && !value.internal) return value.address; return "127.0.0.1"; }
function listen(server: http.Server, port: number, host: string): Promise<void> { return new Promise((resolve, reject) => { server.once("error", reject); server.listen(port, host, () => { server.off("error", reject); resolve(); }); }); }
function send(response: ServerResponse, status: number, type: string, body: string): void { response.writeHead(status, { "content-type": type, "cache-control": "no-store", "x-content-type-options": "nosniff", "content-security-policy": "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'" }); response.end(body); }
function json(response: ServerResponse, status: number, body: unknown): void { send(response, status, "application/json; charset=utf-8", JSON.stringify(body)); }
function readBody(request: IncomingMessage, limit: number): Promise<string> { return new Promise((resolve, reject) => { let body = ""; request.setEncoding("utf8"); request.on("data", (chunk) => { body += chunk; if (body.length > limit) { request.destroy(); reject(new Error("Payload too large")); } }); request.on("end", () => resolve(body)); request.on("error", reject); }); }
function mobileHtml(): string { return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#cf623e"><link rel="manifest" href="/manifest.webmanifest"><title>RCC Mobile</title><style>body{margin:0;background:#0b0e0e;color:#e6e8e5;font:14px system-ui}main{max-width:720px;margin:auto;padding:20px}h1{font-size:20px}#status{color:#93a09a}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px}.card{padding:14px;border:1px solid #303834;border-radius:10px;background:#151a18}.card span{display:block;color:#7e8983;font-size:11px}.card strong{display:block;margin-top:8px;font-size:18px}.ok{color:#73cc89}.bad{color:#ea786d}</style></head><body><main><h1>Rust Command Center</h1><p id="status">Connecting…</p><div class="cards" id="cards"></div></main><script>const token=new URLSearchParams(location.hash.slice(1)).get('token')||localStorage.rccToken;if(token){localStorage.rccToken=token;history.replaceState(null,'',location.pathname)}async function load(){try{const r=await fetch('/api/status?token='+encodeURIComponent(token));if(!r.ok)throw Error('Unauthorized');const d=await r.json();status.textContent='Updated '+new Date(d.observedAt).toLocaleTimeString();cards.innerHTML=(d.servers||[]).map(s=>'<div class="card"><span>'+esc(s.name)+'</span><strong class="'+(s.status==='CONNECTED'?'ok':'bad')+'">'+esc(s.status)+'</strong><p>'+esc(String(s.players??'—'))+' / '+esc(String(s.maxPlayers??'—'))+' players</p></div>').join('')||'<div class="card">No servers configured</div>'}catch(e){status.textContent=e.message}}function esc(v){return v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}load();setInterval(load,5000);if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js')</script></body></html>`; }
