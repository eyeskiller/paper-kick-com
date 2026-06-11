package com.kick.integration;

import com.kick.integration.commands.KickCommandExecutor;
import com.kick.integration.listeners.PlayerJoinListener;
import com.kick.integration.network.BridgeWebSocketClient;
import org.bukkit.plugin.java.JavaPlugin;

import java.net.URI;
import java.net.URISyntaxException;

public class KickIntegrationPlugin extends JavaPlugin {

    private BridgeWebSocketClient webSocketClient;
    private final java.util.Map<java.util.UUID, Boolean> linkedUsers = new java.util.concurrent.ConcurrentHashMap<>();
    private final java.util.Map<java.util.UUID, Boolean> subscribedUsers = new java.util.concurrent.ConcurrentHashMap<>();

    @Override
    public void onEnable() {
        saveDefaultConfig();
        
        String wsUrl = getConfig().getString("bridge.ws-url", "ws://127.0.0.1:8811");
        String apiKey = getConfig().getString("bridge.api-key", "");

        try {
            webSocketClient = new BridgeWebSocketClient(this, new URI(wsUrl), apiKey);
            webSocketClient.connect();
        } catch (URISyntaxException e) {
            getLogger().severe("Invalid WebSocket URL in config!");
        }

        getCommand("kick").setExecutor(new KickCommandExecutor(this));
        getServer().getPluginManager().registerEvents(new PlayerJoinListener(this), this);
        getServer().getPluginManager().registerEvents(new com.kick.integration.listeners.PlayerChatListener(this), this);

        getLogger().info("KickIntegrationPlugin enabled!");
    }

    @Override
    public void onDisable() {
        if (webSocketClient != null) {
            webSocketClient.close();
        }
        getLogger().info("KickIntegrationPlugin disabled!");
    }

    public BridgeWebSocketClient getWebSocketClient() {
        return webSocketClient;
    }

    public boolean isUserLinked(java.util.UUID uuid) {
        return linkedUsers.getOrDefault(uuid, false);
    }

    public void setUserLinked(java.util.UUID uuid, boolean linked) {
        linkedUsers.put(uuid, linked);
    }

    public boolean isUserSubscribed(java.util.UUID uuid) {
        return subscribedUsers.getOrDefault(uuid, false);
    }

    public void setUserSubscribed(java.util.UUID uuid, boolean subbed) {
        subscribedUsers.put(uuid, subbed);
    }
}
