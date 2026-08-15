import { z } from "zod";

export const connectionStateSchema = z.enum([
  "UNPAIRED",
  "PAIRING",
  "DISCONNECTED",
  "CONNECTING",
  "AUTHENTICATING",
  "CONNECTED",
  "STALE",
  "RECONNECTING",
  "ERROR",
]);

export const providerKindSchema = z.enum(["live", "mock"]);

export const serverProfileSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(80),
  address: z.string().min(1).max(253),
  port: z.number().int().min(1).max(65_535),
  steamServerId: z.string().nullable(),
  provider: providerKindSchema,
  favorite: z.boolean(),
  archived: z.boolean(),
  autoConnect: z.boolean(),
  status: connectionStateSchema,
  statusReason: z.string().nullable(),
  lastConnectedAt: z.string().datetime().nullable(),
  lastPacketAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createServerRequestSchema = z
  .object({
    name: z.string().trim().min(1, "Server name is required").max(80),
    address: z.string().trim().min(1, "Address is required").max(253),
    port: z.coerce.number().int().min(1).max(65_535),
    playerId: z.string().trim().regex(/^\d{15,20}$/, "Enter a valid Steam ID"),
    playerToken: z.string().trim().regex(/^-?\d+$/, "Enter a valid pairing token"),
    provider: providerKindSchema.default("live"),
    favorite: z.boolean().default(false),
    autoConnect: z.boolean().default(true),
  })
  .superRefine((value, context) => {
    if (value.provider === "mock") return;
    const hostname = value.address.toLowerCase();
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      context.addIssue({
        code: "custom",
        path: ["address"],
        message: "Loopback addresses are reserved for development simulation",
      });
    }
  });

export const serverActionRequestSchema = z.object({
  serverId: z.string().uuid(),
});

export const archiveServerRequestSchema = serverActionRequestSchema.extend({
  archived: z.boolean(),
});

export type ConnectionState = z.infer<typeof connectionStateSchema>;
export type ProviderKind = z.infer<typeof providerKindSchema>;
export type ServerProfile = z.infer<typeof serverProfileSchema>;
export type CreateServerRequest = z.infer<typeof createServerRequestSchema>;
