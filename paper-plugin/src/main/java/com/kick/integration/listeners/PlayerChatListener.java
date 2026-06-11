package com.kick.integration.listeners;

import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.AsyncPlayerChatEvent;

public class PlayerChatListener implements Listener {

    private final com.kick.integration.KickIntegrationPlugin plugin;

    public PlayerChatListener(com.kick.integration.KickIntegrationPlugin plugin) {
        this.plugin = plugin;
    }

    @EventHandler(priority = EventPriority.HIGHEST)
    public void onPlayerChat(AsyncPlayerChatEvent event) {
        Player player = event.getPlayer();
        
        boolean isLinked = plugin.isUserLinked(player.getUniqueId());
        boolean isSub = plugin.isUserSubscribed(player.getUniqueId());
        
        if (isSub) {
            event.setFormat("§d[KICK SUB]§r " + event.getFormat());
        } else if (isLinked) {
            event.setFormat("§a[KICK]§r " + event.getFormat());
        }
    }
}
