package com.kick.integration.logic;

import com.google.gson.JsonObject;
import com.kick.integration.KickIntegrationPlugin;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.entity.EntityType;
import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemStack;

import java.util.List;
import java.util.Map;
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

    public static void executeActions(KickIntegrationPlugin plugin, Player streamer, String sender, List<Map<?, ?>> actions) {
        if (actions == null) return;

        Bukkit.getScheduler().runTask(plugin, () -> {
            for (Map<?, ?> actionMap : actions) {
                String actionType = (String) actionMap.get("action");
                if (actionType == null) continue;

                switch (actionType.toUpperCase()) {
                    case "SPAWN_MOB":
                        String entityStr = (String) actionMap.get("entity");
                        int amount = actionMap.containsKey("amount") ? (Integer) actionMap.get("amount") : 1;
                        if (entityStr != null) {
                            try {
                                EntityType type = EntityType.valueOf(entityStr.toUpperCase());
                                for (int i = 0; i < amount; i++) {
                                    streamer.getWorld().spawnEntity(streamer.getLocation(), type);
                                }
                            } catch (IllegalArgumentException e) {
                                plugin.getLogger().warning("Invalid entity type in config: " + entityStr);
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
                        String itemStr = (String) actionMap.get("item");
                        int itemAmount = actionMap.containsKey("amount") ? (Integer) actionMap.get("amount") : 1;
                        if (itemStr != null) {
                            try {
                                Material mat = Material.valueOf(itemStr.toUpperCase());
                                streamer.getInventory().addItem(new ItemStack(mat, itemAmount));
                            } catch (IllegalArgumentException e) {
                                plugin.getLogger().warning("Invalid item material in config: " + itemStr);
                            }
                        }
                        break;
                    case "EXECUTE_COMMAND":
                        String cmd = (String) actionMap.get("command");
                        if (cmd != null) {
                            cmd = cmd.replace("%streamer%", streamer.getName());
                            cmd = cmd.replace("%sender%", sender);
                            Bukkit.dispatchCommand(Bukkit.getConsoleSender(), cmd);
                        }
                        break;
                }
            }
        });
    }

    public static void handleSubscriptionEvent(KickIntegrationPlugin plugin, JsonObject data) {
        if (!plugin.getConfig().getBoolean("events-enabled", true)) {
            return;
        }

        Player streamer = getStreamerEntity(plugin);
        if (streamer == null || !streamer.isOnline()) {
            return;
        }

        String subType = data.has("subType") ? data.get("subType").getAsString() : "";
        JsonObject eventData = data.getAsJsonObject("data");
        
        String sender = "Someone";
        if (eventData != null && eventData.has("username")) {
            sender = eventData.get("username").getAsString();
        }

        int giftedCount = 1;
        if (eventData != null && eventData.has("count")) {
            giftedCount = eventData.get("count").getAsInt();
        }

        if (subType.equals("channel.subscription.gifts")) {
            List<Map<?, ?>> giftActions = plugin.getConfig().getMapList("kick-actions.subscription-gift");
            for (Map<?, ?> actionMap : giftActions) {
                int threshold = actionMap.containsKey("threshold") ? (Integer) actionMap.get("threshold") : 1;
                if (giftedCount >= threshold) {
                    executeActions(plugin, streamer, sender, List.of(actionMap));
                }
            }
        } else if (subType.equals("channel.subscription.new") || subType.equals("channel.subscription.renewal")) {
            List<Map<?, ?>> newSubActions = plugin.getConfig().getMapList("kick-actions.subscription-new");
            executeActions(plugin, streamer, sender, newSubActions);
        }
    }

    public static void handleChatEvent(KickIntegrationPlugin plugin, JsonObject data) {
        if (!plugin.getConfig().getBoolean("events-enabled", true)) {
            return;
        }

        Player streamer = getStreamerEntity(plugin);
        if (streamer == null || !streamer.isOnline()) {
            return;
        }

        String sender = data.has("sender") ? data.get("sender").getAsString() : "Unknown";
        String content = data.has("content") ? data.get("content").getAsString() : "";

        List<Map<?, ?>> chatActions = plugin.getConfig().getMapList("kick-actions.chat-triggers");
        for (Map<?, ?> actionMap : chatActions) {
            String containsStr = (String) actionMap.get("contains");
            if (containsStr != null && content.toLowerCase().contains(containsStr.toLowerCase())) {
                executeActions(plugin, streamer, sender, List.of(actionMap));
            }
        }
    }
}
