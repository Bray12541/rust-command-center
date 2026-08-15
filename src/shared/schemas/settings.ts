import { z } from "zod";

export const colorThemeSchema = z.enum(["dark", "light", "high-contrast", "system"]);
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
  streamerMode: z.boolean().default(false),
  colorblindMarkers: z.boolean().default(false),
  uiScale: z.number().min(0.8).max(1.4).default(1),
  compactDensity: z.boolean().default(false),
  updateChannel: z.enum(["stable", "beta"]).default("stable"),
  skippedUpdateVersion: z.string().nullable().default(null),
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
  streamerMode: false,
  colorblindMarkers: false,
  uiScale: 1,
  compactDensity: false,
  updateChannel: "stable",
  skippedUpdateVersion: null,
};
