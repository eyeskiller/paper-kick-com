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
        
        Bukkit.getScheduler().runTaskAsynchronously(plugin, () -> {
            try {
                URL url = new URL(apiUrl + "/status/" + player.getUniqueId());
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("GET");
                
                if (conn.getResponseCode() == 200) {
                    InputStreamReader reader = new InputStreamReader(conn.getInputStream());
                    JsonObject response = gson.fromJson(reader, JsonObject.class);
                    reader.close();
                    
                    if (response.has("linked") && response.get("linked").getAsBoolean()) {
                        boolean isSub = response.has("isSubscriber") && response.get("isSubscriber").getAsBoolean();
                        if (isSub) {
                            // Run on main thread to apply prefix
                            Bukkit.getScheduler().runTask(plugin, () -> {
                                player.setPlayerListName("§d[Kick Sub] §r" + player.getName());
                            });
                        }
                    }
                }
            } catch (Exception e) {
                plugin.getLogger().warning("Failed to fetch player status for " + player.getName());
            }
        });
    }
}
