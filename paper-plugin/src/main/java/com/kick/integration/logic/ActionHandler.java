package com.kick.integration.logic;

import com.google.gson.JsonObject;
import com.kick.integration.KickIntegrationPlugin;
import org.bukkit.Bukkit;
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

    public static void handleSubscriptionEvent(KickIntegrationPlugin plugin, JsonObject data) {
        if (!plugin.getConfig().getBoolean("events-enabled", true)) {
            plugin.getLogger().info("Subscription event received but events are disabled in config.");
            return;
        }

        Player streamer = getStreamerEntity(plugin);
        if (streamer == null || !streamer.isOnline()) {
            plugin.getLogger().info("Streamer is offline. Event ignored.");
            return;
        }

        String subType = data.has("subType") ? data.get("subType").getAsString() : "";
        JsonObject eventData = data.getAsJsonObject("data");

        int giftedCount = 1;
        if (eventData != null && eventData.has("count")) {
            giftedCount = eventData.get("count").getAsInt();
        }

        if (subType.equals("channel.subscription.gifts") && giftedCount >= 5) {
            // Drop hotbar
            for (int i = 0; i < 9; i++) {
                ItemStack item = streamer.getInventory().getItem(i);
                if (item != null && !item.getType().isAir()) {
                    streamer.getWorld().dropItemNaturally(streamer.getLocation(), item);
                    streamer.getInventory().setItem(i, null);
                }
            }
            streamer.sendMessage("§cWoah! 5 or more gifted subs! You dropped your hotbar!");
        } else if (subType.equals("channel.subscription.new") || subType.equals("channel.subscription.renewal")) {
            // Spawn a creeper
            streamer.getWorld().spawnEntity(streamer.getLocation(), EntityType.CREEPER);
            streamer.sendMessage("§aSomeone subscribed! A Creeper spawned!");
        }
    }
}
