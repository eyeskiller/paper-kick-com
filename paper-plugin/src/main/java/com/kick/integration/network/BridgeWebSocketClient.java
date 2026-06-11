package com.kick.integration.network;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.kick.integration.KickIntegrationPlugin;
import com.kick.integration.logic.ActionHandler;
import org.bukkit.Bukkit;
import org.java_websocket.client.WebSocketClient;
import org.java_websocket.handshake.ServerHandshake;

import java.net.URI;
import java.util.logging.Level;

public class BridgeWebSocketClient extends WebSocketClient {

    private final KickIntegrationPlugin plugin;
    private final String secret;
    private final Gson gson = new Gson();

    public BridgeWebSocketClient(KickIntegrationPlugin plugin, URI serverUri, String secret) {
        super(serverUri);
        this.plugin = plugin;
        this.secret = secret;
    }

    @Override
    public void onOpen(ServerHandshake handshakedata) {
        plugin.getLogger().info("Connected to Bridge Server. Authenticating...");
        JsonObject authMsg = new JsonObject();
        authMsg.addProperty("type", "auth");
        authMsg.addProperty("secret", secret);
        send(gson.toJson(authMsg));
    }

    @Override
    public void onMessage(String message) {
        plugin.getLogger().info("Received WS Message: " + message);
        
        Bukkit.getScheduler().runTask(plugin, () -> {
            try {
                JsonObject data = gson.fromJson(message, JsonObject.class);
                String type = data.has("type") ? data.get("type").getAsString() : "";

                switch (type) {
                    case "auth_success":
                        plugin.getLogger().info("Successfully authenticated with Bridge Server.");
                        break;
                    case "claim_success":
                        String kickUsername = data.get("kickUsername").getAsString();
                        plugin.getLogger().info("Player linked Kick account: " + kickUsername);
                        break;
                    case "subscription_event":
                        ActionHandler.handleSubscriptionEvent(plugin, data);
                        break;
                }
            } catch (Exception e) {
                plugin.getLogger().log(Level.SEVERE, "Error handling message", e);
            }
        });
    }

    @Override
    public void onClose(int code, String reason, boolean remote) {
        plugin.getLogger().warning("Disconnected from Bridge Server: " + reason);
        Bukkit.getScheduler().runTaskLaterAsynchronously(plugin, () -> {
            try {
                reconnect();
            } catch (Exception e) {
                plugin.getLogger().warning("Failed to reconnect: " + e.getMessage());
            }
        }, 100L);
    }

    @Override
    public void onError(Exception ex) {
        plugin.getLogger().log(Level.SEVERE, "WebSocket Error", ex);
    }
}
