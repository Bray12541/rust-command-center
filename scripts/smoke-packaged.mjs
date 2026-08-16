/* global process, console */
import { _electron as electron } from "playwright";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const executable = path.resolve("release", "win-unpacked", "Rust Command Center.exe");
const userData = await fs.mkdtemp(path.join(os.tmpdir(), "rcc-packaged-smoke-"));
const application = await electron.launch({ executablePath: executable, env: { ...process.env, RCC_E2E_USER_DATA: userData, RCC_E2E_SKIP_ONBOARDING: "1" } });
try {
  const window = await application.firstWindow();
  await window.getByText("Pair a server to begin").waitFor({ state: "visible", timeout: 20_000 });
  await window.getByRole("link", { name: "Services" }).click();
  await window.getByRole("heading", { name: "Connected services" }).waitFor({ state: "visible" });
  await fs.mkdir(path.resolve("test-results"), { recursive: true });
  await window.screenshot({ path: path.resolve("test-results", "connected-services-v0.4.0.png"), fullPage: true });
  await window.getByRole("link", { name: "Server Owner" }).click();
  await window.getByRole("heading", { name: "Server Owner mode" }).waitFor({ state: "visible" });
  await window.screenshot({ path: path.resolve("test-results", "server-owner-v0.4.0.png"), fullPage: true });
  console.log("Packaged v0.4.0 smoke test passed");
} finally {
  await application.close();
  await fs.rm(userData, { recursive: true, force: true });
}
