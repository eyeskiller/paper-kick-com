package com.kick.integration.logic;

import com.google.gson.JsonObject;
import com.kick.integration.KickIntegrationPlugin;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.entity.EntityType;
import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemStack;

import java.util.UUID;

public class ActionHandler {

    public static Player getStreamerEntity(KickIntegrationPlugin plugin) {
        String uuidStr = plugin.getConfig().getString("streamer-uuid", "");
        if (uuidStr.isEmpty()) return null;
        try {
            UUID uuid = UUID.fromString(uuidStr);
            return Bukkit.getPlayer(uuid);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    public static void handleExecuteAction(KickIntegrationPlugin plugin, JsonObject data) {
        if (!plugin.getConfig().getBoolean("events-enabled", true)) {
            return;
        }

        Player streamer = getStreamerEntity(plugin);
        if (streamer == null || !streamer.isOnline()) {
            return;
        }

        String actionType = data.has("actionType") ? data.get("actionType").getAsString() : null;
        if (actionType == null) return;

        String sender = data.has("sender") ? data.get("sender").getAsString() : "Unknown";
        
        String payloadStr = data.has("payload") ? data.get("payload").getAsString() : "{}";
        JsonObject payload;
        try {
            payload = com.google.gson.JsonParser.parseString(payloadStr).getAsJsonObject();
        } catch (Exception e) {
            payload = new JsonObject();
        }

        JsonObject finalPayload = payload;
        Bukkit.getScheduler().runTask(plugin, () -> {
            switch (actionType.toUpperCase()) {
                case "SPAWN_MOB":
                    String entityStr = finalPayload.has("entity") ? finalPayload.get("entity").getAsString() : null;
                    int amount = finalPayload.has("amount") ? finalPayload.get("amount").getAsInt() : 1;
                    if (entityStr != null) {
                        try {
                            EntityType type = EntityType.valueOf(entityStr.toUpperCase());
                            for (int i = 0; i < amount; i++) {
                                streamer.getWorld().spawnEntity(streamer.getLocation(), type);
                            }
                        } catch (IllegalArgumentException e) {
                            plugin.getLogger().warning("Invalid entity type from bridge: " + entityStr);
                        }
                    }
                    break;
                case "DROP_HOTBAR":
                    for (int i = 0; i < 9; i++) {
                        ItemStack item = streamer.getInventory().getItem(i);
                        if (item != null && !item.getType().isAir()) {
                            streamer.getWorld().dropItemNaturally(streamer.getLocation(), item);
                            streamer.getInventory().setItem(i, null);
                        }
                    }
                    break;
                case "GIVE_ITEM":
                    String itemStr = finalPayload.has("item") ? finalPayload.get("item").getAsString() : null;
                    int itemAmount = finalPayload.has("amount") ? finalPayload.get("amount").getAsInt() : 1;
                    if (itemStr != null) {
                        try {
                            Material mat = Material.valueOf(itemStr.toUpperCase());
                            streamer.getInventory().addItem(new ItemStack(mat, itemAmount));
                        } catch (IllegalArgumentException e) {
                            plugin.getLogger().warning("Invalid item material from bridge: " + itemStr);
                        }
                    }
                    break;
                case "EXECUTE_COMMAND":
                    String cmd = finalPayload.has("command") ? finalPayload.get("command").getAsString() : null;
                    if (cmd != null) {
                        cmd = cmd.replace("%streamer%", streamer.getName());
                        cmd = cmd.replace("%sender%", sender);
                        Bukkit.dispatchCommand(Bukkit.getConsoleSender(), cmd);
                    }
                    break;
            }
        });
    }
}
