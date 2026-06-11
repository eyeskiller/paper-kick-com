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
        
        String wsUrl = getConfig().getString("bridge.url", "ws://127.0.0.1:8811");
        String wsSecret = getConfig().getString("bridge.secret", "change_me_in_production");
        String streamer = getConfig().getString("streamer-kick-username", "Eysekiller");

        try {
            webSocketClient = new BridgeWebSocketClient(this, new URI(wsUrl), wsSecret, streamer);
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
