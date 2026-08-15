import { z } from "zod";

export const updatePhaseSchema = z.enum([
  "disabled",
  "idle",
  "checking",
  "available",
  "downloading",
  "downloaded",
  "up-to-date",
  "error",
]);

export const updateStateSchema = z.object({
  phase: updatePhaseSchema,
  currentVersion: z.string(),
  availableVersion: z.string().nullable(),
  progress: z.number().min(0).max(100).nullable(),
  message: z.string(),
  canAutoUpdate: z.boolean(),
  releaseNotes: z.string().nullable(),
});

export type UpdateState = z.infer<typeof updateStateSchema>;
