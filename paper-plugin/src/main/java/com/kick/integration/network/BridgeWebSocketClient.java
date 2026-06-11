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
    private final String apiKey;
    private final Gson gson = new Gson();

    public BridgeWebSocketClient(KickIntegrationPlugin plugin, URI serverUri, String apiKey) {
        super(serverUri);
        this.plugin = plugin;
        this.apiKey = apiKey;
    }

    @Override
    public void onOpen(ServerHandshake handshakedata) {
        plugin.getLogger().info("Connected to Bridge Server. Authenticating API Key...");
        JsonObject authMsg = new JsonObject();
        authMsg.addProperty("type", "auth");
        authMsg.addProperty("apiKey", apiKey);
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
                        String uuidStr = data.get("minecraftUuid").getAsString();
                        boolean isSub = data.has("isSubscriber") && data.get("isSubscriber").getAsBoolean();
                        plugin.getLogger().info("Player linked Kick account: " + kickUsername + " (Sub: " + isSub + ")");
                        
                        org.bukkit.entity.Player p = Bukkit.getPlayer(java.util.UUID.fromString(uuidStr));
                        if (p != null) {
                            plugin.setUserLinked(p.getUniqueId(), true);
                            plugin.setUserSubscribed(p.getUniqueId(), isSub);

                            if (isSub) {
                                p.setPlayerListName("§d[KICK SUB] §r" + p.getName());
                            } else {
                                p.setPlayerListName("§a[KICK] §r" + p.getName());
                            }
                            p.sendMessage("§aYou have successfully linked your Kick account (" + kickUsername + ")!");
                        }
                        break;
                    case "subscription_update":
                        String targetUuid = data.get("minecraftUuid").getAsString();
                        boolean isTargetSub = data.get("isSubscriber").getAsBoolean();
                        org.bukkit.entity.Player target = Bukkit.getPlayer(java.util.UUID.fromString(targetUuid));
                        if (target != null) {
                            plugin.setUserSubscribed(target.getUniqueId(), isTargetSub);
                            
                            if (isTargetSub) {
                                target.setPlayerListName("§d[KICK SUB] §r" + target.getName());
                            } else {
                                target.setPlayerListName("§a[KICK] §r" + target.getName());
                            }
                        }
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
