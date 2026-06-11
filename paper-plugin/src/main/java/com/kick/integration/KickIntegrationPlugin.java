package com.kick.integration;

import com.kick.integration.commands.KickCommandExecutor;
import com.kick.integration.listeners.PlayerJoinListener;
import com.kick.integration.network.BridgeWebSocketClient;
import org.bukkit.plugin.java.JavaPlugin;

import java.net.URI;
import java.net.URISyntaxException;

public class KickIntegrationPlugin extends JavaPlugin {

    private BridgeWebSocketClient webSocketClient;

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
}
