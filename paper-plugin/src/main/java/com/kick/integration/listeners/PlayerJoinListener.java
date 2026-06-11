package com.kick.integration.listeners;

import com.kick.integration.KickIntegrationPlugin;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;

import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import com.google.gson.Gson;
import com.google.gson.JsonObject;

public class PlayerJoinListener implements Listener {

    private final KickIntegrationPlugin plugin;
    private final Gson gson = new Gson();

    public PlayerJoinListener(KickIntegrationPlugin plugin) {
        this.plugin = plugin;
    }

    @EventHandler
    public void onPlayerJoin(PlayerJoinEvent event) {
        Player player = event.getPlayer();
        String apiUrl = plugin.getConfig().getString("bridge.api-url", "http://164.90.227.96:8811/api/kick");
        if (apiUrl != null && apiUrl.endsWith("/")) {
            apiUrl = apiUrl.substring(0, apiUrl.length() - 1);
        }
        final String finalApiUrl = apiUrl;
        
        Bukkit.getScheduler().runTaskAsynchronously(plugin, () -> {
            try {
                URL url = new URL(finalApiUrl + "/status/" + player.getUniqueId());
                plugin.getLogger().info("Fetching player status from: " + url.toString());
                
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("GET");
                
                if (conn.getResponseCode() == 200) {
                    InputStreamReader reader = new InputStreamReader(conn.getInputStream());
                    JsonObject response = gson.fromJson(reader, JsonObject.class);
                    reader.close();
                    
                    if (response.has("linked") && response.get("linked").getAsBoolean()) {
                        boolean isSub = response.has("isSubscriber") && response.get("isSubscriber").getAsBoolean();
                        // Run on main thread to apply prefix with a slight delay
                        Bukkit.getScheduler().runTaskLater(plugin, () -> {
                            plugin.setUserLinked(player.getUniqueId(), true);
                            plugin.setUserSubscribed(player.getUniqueId(), isSub);

                            if (isSub) {
                                player.setPlayerListName("§d[KICK SUB] §r" + player.getName());
                                plugin.getLogger().info("Applied KICK SUB prefix to " + player.getName());
                            } else {
                                player.setPlayerListName("§a[KICK] §r" + player.getName());
                                plugin.getLogger().info("Applied KICK prefix to " + player.getName());
                            }
                        }, 20L); // 1 second delay
                    }
                } else {
                    plugin.getLogger().warning("HTTP Request failed with code: " + conn.getResponseCode());
                }
            } catch (Exception e) {
                plugin.getLogger().log(java.util.logging.Level.WARNING, "Failed to fetch player status for " + player.getName(), e);
            }
        });
    }
}
