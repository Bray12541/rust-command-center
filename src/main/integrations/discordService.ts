import { Client, GatewayIntentBits, type Message } from "discord.js";
import type { Logger } from "pino";
import type { ConnectedServicesConfig } from "../../shared/contracts/connectedServices";
import { CredentialVault } from "../security/credentialVault";

export class DiscordService {
  private client: Client | null = null;
  private config: ConnectedServicesConfig["discord"] | null = null;

  constructor(private readonly vault: CredentialVault, private readonly logger: Logger, private readonly statusSummary: () => string) {}

  async configure(config: ConnectedServicesConfig["discord"]): Promise<void> {
    await this.stop(); this.config = config;
    if (!config.enabled) return;
    const token = this.vault.getSecret("discord-token");
    if (!token) throw new Error("Save a Discord bot token before enabling the bot");
    const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
    client.on("messageCreate", (message) => void this.onMessage(message));
    client.on("error", (error) => this.logger.warn({ service: "discord", error }, "Discord client error"));
    await client.login(token);
    this.client = client;
  }

  async sendAlert(message: string): Promise<void> {
    if (!this.client || !this.config?.channelId) throw new Error("Discord bot is not connected");
    const channel = await this.client.channels.fetch(this.config.channelId);
    if (!channel?.isTextBased() || !("send" in channel)) throw new Error("Configured Discord channel is not writable");
    await channel.send({ content: message.slice(0, 1900), allowedMentions: { parse: [] } });
  }

  async test(config: ConnectedServicesConfig["discord"]): Promise<string> {
    await this.configure({ ...config, enabled: true });
    await this.sendAlert("Rust Command Center connection test passed. Restricted commands are ready.");
    return `Connected as ${this.client?.user?.tag ?? "Discord bot"}`;
  }

  async stop(): Promise<void> { if (this.client) { await this.client.destroy(); this.client = null; } }

  private async onMessage(message: Message): Promise<void> {
    const config = this.config;
    if (!config || message.author.bot || message.guildId !== config.guildId || !message.content.startsWith(config.commandPrefix)) return;
    const memberRoles = message.member?.roles.cache.map((role) => role.id) ?? [];
    const allowed = message.guild?.ownerId === message.author.id || config.allowedRoleIds.some((role) => memberRoles.includes(role));
    if (!allowed) { await message.reply({ content: "You do not have an RCC command role.", allowedMentions: { repliedUser: false } }); return; }
    const command = message.content.slice(config.commandPrefix.length).trim().toLowerCase();
    if (["", "help"].includes(command)) await message.reply({ content: `Commands: \`${config.commandPrefix} status\`, \`${config.commandPrefix} ping\``, allowedMentions: { repliedUser: false } });
    else if (command === "status") await message.reply({ content: this.statusSummary().slice(0, 1900), allowedMentions: { repliedUser: false } });
    else if (command === "ping") await message.reply({ content: "RCC is online.", allowedMentions: { repliedUser: false } });
  }
}
