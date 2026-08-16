using System;
using System.Collections.Generic;
using Newtonsoft.Json;
using Oxide.Core.Libraries.Covalence;

namespace Oxide.Plugins
{
    [Info("RCC Bridge", "Rust Command Center", "1.0.0")]
    [Description("Sends authenticated server events to a local Rust Command Center owner bridge.")]
    public class RccBridge : CovalencePlugin
    {
        private Configuration _config;

        private class Configuration
        {
            public string Endpoint = "http://127.0.0.1:47832/api/events";
            public string Token = "replace-with-the-token-from-rcc";
            public string ProfileId = "";
        }

        protected override void LoadDefaultConfig() => _config = new Configuration();
        protected override void LoadConfig()
        {
            base.LoadConfig();
            try { _config = Config.ReadObject<Configuration>() ?? new Configuration(); }
            catch { _config = new Configuration(); }
            SaveConfig();
        }
        protected override void SaveConfig() => Config.WriteObject(_config, true);

        private void OnServerInitialized()
        {
            Send("plugin", "info", "RCC Bridge online", "The uMod/Oxide event bridge initialized.", new Dictionary<string, object>());
            timer.Every(60f, () => Send("performance", "info", "Server performance", "Periodic server health sample.", new Dictionary<string, object>
            {
                ["players"] = BasePlayer.activePlayerList.Count,
                ["maxPlayers"] = ConVar.Server.maxplayers,
                ["entities"] = BaseNetworkable.serverEntities.Count
            }));
        }

        private void OnUserConnected(IPlayer player) => Send("server", "info", "Player connected", player.Name, new Dictionary<string, object> { ["playerId"] = player.Id });
        private void OnUserDisconnected(IPlayer player) => Send("server", "info", "Player disconnected", player.Name, new Dictionary<string, object> { ["playerId"] = player.Id });
        private void OnUserBanned(string name, string id, string address, string reason) => Send("authorization", "warning", "Player banned", name + ": " + reason, new Dictionary<string, object> { ["playerId"] = id });

        private void OnPlayerDeath(BasePlayer player, HitInfo info)
        {
            if (player == null) return;
            var attacker = info?.InitiatorPlayer;
            Send("death", "warning", "Player death", player.displayName + (attacker == null ? " died" : " was killed by " + attacker.displayName), new Dictionary<string, object>
            {
                ["victimId"] = player.UserIDString,
                ["attackerId"] = attacker?.UserIDString ?? "",
                ["weapon"] = info?.WeaponPrefab?.ShortPrefabName ?? "unknown"
            });
        }

        private void OnEntityTakeDamage(BuildingBlock block, HitInfo info)
        {
            if (block == null || info == null) return;
            var weapon = info.WeaponPrefab?.ShortPrefabName ?? "";
            if (!weapon.Contains("rocket") && !weapon.Contains("explosive") && !weapon.Contains("satchel")) return;
            Send("raid", "critical", "Explosive building damage", weapon + " damaged a " + block.ShortPrefabName, new Dictionary<string, object>
            {
                ["ownerId"] = block.OwnerID.ToString(),
                ["damage"] = info.damageTypes.Total()
            });
        }

        private void Send(string type, string severity, string title, string message, Dictionary<string, object> metadata)
        {
            if (string.IsNullOrWhiteSpace(_config.Endpoint) || string.IsNullOrWhiteSpace(_config.Token)) return;
            var payload = JsonConvert.SerializeObject(new { profileId = string.IsNullOrWhiteSpace(_config.ProfileId) ? null : _config.ProfileId, type, severity, title, message, metadata });
            var headers = new Dictionary<string, string> { ["Authorization"] = "Bearer " + _config.Token, ["Content-Type"] = "application/json" };
            webrequest.Enqueue(_config.Endpoint, payload, (code, response) => { if (code < 200 || code >= 300) PrintWarning("RCC bridge returned HTTP " + code); }, this, Oxide.Core.Libraries.RequestMethod.POST, headers);
        }
    }
}
