import { z } from "zod";

export const colorThemeSchema = z.enum(["dark", "system"]);
export const profilePresetSchema = z.enum(["solo", "small-group", "clan", "server-owner"]);
export const closeBehaviorSchema = z.enum(["tray", "exit", "ask"]);

export const appSettingsSchema = z.object({
  onboardingComplete: z.boolean(),
  selectedServerId: z.string().uuid().nullable(),
  profilePreset: profilePresetSchema,
  theme: colorThemeSchema,
  closeBehavior: closeBehaviorSchema,
  desktopNotifications: z.boolean(),
  launchAtStartup: z.boolean(),
  sidebarCollapsed: z.boolean(),
  teamLocationHistory: z.boolean(),
});

export const settingsPatchSchema = appSettingsSchema.partial().strict();

export type AppSettings = z.infer<typeof appSettingsSchema>;
export type SettingsPatch = z.infer<typeof settingsPatchSchema>;

export const DEFAULT_SETTINGS: AppSettings = {
  onboardingComplete: false,
  selectedServerId: null,
  profilePreset: "small-group",
  theme: "dark",
  closeBehavior: "tray",
  desktopNotifications: true,
  launchAtStartup: false,
  sidebarCollapsed: false,
  teamLocationHistory: false,
};
