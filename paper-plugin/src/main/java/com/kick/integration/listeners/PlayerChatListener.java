package com.kick.integration.listeners;

import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.AsyncPlayerChatEvent;

public class PlayerChatListener implements Listener {

    @EventHandler(priority = EventPriority.HIGHEST)
    public void onPlayerChat(AsyncPlayerChatEvent event) {
        Player player = event.getPlayer();
        String listName = player.getPlayerListName();
        
        // Ensure the prefix is dynamically added to whatever the current format is
        if (listName != null) {
            if (listName.contains("[KICK SUB]")) {
                event.setFormat("§d[KICK SUB]§r " + event.getFormat());
            } else if (listName.contains("[KICK]")) {
                event.setFormat("§a[KICK]§r " + event.getFormat());
            }
        }
    }
}
