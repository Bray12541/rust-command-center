import { _electron as electron, expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

test("packaged renderer bridge opens the map workspace instead of a black screen", async () => {
  const userData = await fs.mkdtemp(path.join(os.tmpdir(), "rcc-e2e-"));
  const application = await electron.launch({ args: ["."], env: { ...process.env, RCC_E2E_USER_DATA: userData, RCC_E2E_SKIP_ONBOARDING: "1" } });
  try {
    const window = await application.firstWindow();
    await expect(window.getByRole("heading", { name: "Pair a server to begin" })).toBeVisible();
    await expect(window.getByRole("navigation", { name: "Operations tools" })).toBeVisible();
    await window.getByRole("button", { name: "Events" }).click();
    await expect(window.getByText("Live world events")).toBeVisible();
  } finally {
    await application.close();
    await fs.rm(userData, { recursive: true, force: true });
  }
});
