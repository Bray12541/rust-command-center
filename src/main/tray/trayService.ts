import { Menu, nativeImage, Tray, type BrowserWindow } from "electron";
import type { ServerRepository } from "../repositories/serverRepository";

const TRAY_ICON = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <rect width="32" height="32" rx="7" fill="#d56338"/>
    <path d="M8 23V8h9.2c4.1 0 6.8 2.2 6.8 5.8 0 2.5-1.3 4.3-3.4 5.2l4 4h-5.2l-3.2-3.4h-3.5V23H8zm4.7-7.4h4.1c1.6 0 2.5-.7 2.5-1.9 0-1.2-.9-1.9-2.5-1.9h-4.1v3.8z" fill="#101312"/>
  </svg>
`)}`;

export class TrayService {
  private tray: Tray | null = null;

  constructor(
    private readonly window: BrowserWindow,
    private readonly servers: ServerRepository,
    private readonly onReconnect: (serverId: string) => void,
    private readonly onExit: () => void,
  ) {}

  create(): void {
    const icon = nativeImage.createFromDataURL(TRAY_ICON).resize({ width: 16, height: 16 });
    this.tray = new Tray(icon);
    this.tray.setToolTip("Rust Command Center");
    this.tray.on("double-click", () => this.showWindow());
    this.refresh();
  }

  refresh(): void {
    if (!this.tray) return;
    const selected = this.servers.list().find((server) => server.favorite) ?? this.servers.list()[0];
    const contextMenu = Menu.buildFromTemplate([
      { label: "Rust Command Center", enabled: false },
      { type: "separator" },
      ...(selected
        ? [
            { label: selected.name, enabled: false } as const,
            { label: selected.status.toLowerCase().replaceAll("_", " "), enabled: false } as const,
            { label: "Reconnect", click: () => this.onReconnect(selected.id) } as const,
          ]
        : [{ label: "No paired servers", enabled: false } as const]),
      { type: "separator" },
      { label: "Open Dashboard", click: () => this.showWindow() },
      { label: "Exit", click: () => this.onExit() },
    ]);
    this.tray.setContextMenu(contextMenu);
  }

  destroy(): void {
    this.tray?.destroy();
    this.tray = null;
  }

  private showWindow(): void {
    if (this.window.isMinimized()) this.window.restore();
    this.window.show();
    this.window.focus();
  }
}
