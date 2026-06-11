package com.kick.integration.listeners;

import io.papermc.paper.chat.ChatRenderer;
import io.papermc.paper.event.player.AsyncChatEvent;
import net.kyori.adventure.audience.Audience;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.serializer.legacy.LegacyComponentSerializer;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.jetbrains.annotations.NotNull;

public class PlayerChatListener implements Listener {

    private final com.kick.integration.KickIntegrationPlugin plugin;

    public PlayerChatListener(com.kick.integration.KickIntegrationPlugin plugin) {
        this.plugin = plugin;
    }

    @EventHandler(priority = EventPriority.HIGHEST)
    public void onPlayerChat(AsyncChatEvent event) {
        Player player = event.getPlayer();
        
        boolean isLinked = plugin.isUserLinked(player.getUniqueId());
        boolean isSub = plugin.isUserSubscribed(player.getUniqueId());
        
        if (isSub || isLinked) {
            ChatRenderer originalRenderer = event.renderer();
            event.renderer(new ChatRenderer() {
                @Override
                public @NotNull Component render(@NotNull Player source, @NotNull Component sourceDisplayName, @NotNull Component message, @NotNull Audience viewer) {
                    Component prefix = Component.empty();
                    if (isSub) {
                        prefix = LegacyComponentSerializer.legacySection().deserialize("§d[KICK SUB] §r");
                    } else if (isLinked) {
                        prefix = LegacyComponentSerializer.legacySection().deserialize("§a[KICK] §r");
                    }
                    return prefix.append(originalRenderer.render(source, sourceDisplayName, message, viewer));
                }
            });
        }
    }
}
