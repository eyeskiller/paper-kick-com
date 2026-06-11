package com.kick.integration.commands;

import com.google.gson.JsonObject;
import com.kick.integration.KickIntegrationPlugin;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;

import java.util.Random;

public class KickCommandExecutor implements CommandExecutor {

    private final KickIntegrationPlugin plugin;
    private final Random random = new Random();

    public KickCommandExecutor(KickIntegrationPlugin plugin) {
        this.plugin = plugin;
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (args.length == 0) {
            sender.sendMessage("§cUsage: /kick <claim|events|unlink|status|reload>");
            return true;
        }

        switch (args[0].toLowerCase()) {
            case "claim":
                if (!(sender instanceof Player)) {
                    sender.sendMessage("§cOnly players can claim accounts.");
                    return true;
                }
                if (args.length < 2) {
                    sender.sendMessage("§cUsage: /kick claim <KickUsername>");
                    return true;
                }
                String kickUsername = args[1];
                String code = generateCode();
                
                JsonObject claimData = new JsonObject();
                claimData.addProperty("type", "claim_code_generated");
                claimData.addProperty("code", code);
                claimData.addProperty("minecraftUuid", ((Player) sender).getUniqueId().toString());
                claimData.addProperty("kickUsername", kickUsername);
                
                if (plugin.getWebSocketClient() != null && plugin.getWebSocketClient().isOpen()) {
                    plugin.getWebSocketClient().send(claimData.toString());
                    sender.sendMessage("§aYour claim code is: §e" + code);
                    sender.sendMessage("§aPlease type this code in the streamer's Kick chat within 5 minutes.");
                } else {
                    sender.sendMessage("§cBridge server is currently unavailable. Please try again later.");
                }
                break;
            case "events":
                if (!sender.hasPermission("kick.admin")) {
                    sender.sendMessage("§cNo permission.");
                    return true;
                }
                if (args.length < 2) {
                    sender.sendMessage("§cUsage: /kick events <on|off>");
                    return true;
                }
                boolean enable = args[1].equalsIgnoreCase("on");
                plugin.getConfig().set("events-enabled", enable);
                plugin.saveConfig();
                sender.sendMessage(enable ? "§aKick events (mobs, drops) are now ENABLED." : "§cKick events are now DISABLED.");
                break;
            case "reload":
                if (!sender.hasPermission("kick.admin")) {
                    sender.sendMessage("§cNo permission.");
                    return true;
                }
                plugin.reloadConfig();
                sender.sendMessage("§aConfig reloaded.");
                break;
            case "status":
            case "unlink":
                sender.sendMessage("§e" + args[0] + " command is a work in progress.");
                break;
            default:
                sender.sendMessage("§cUsage: /kick <claim|events|unlink|status|reload>");
                break;
        }
        return true;
    }

    private String generateCode() {
        String chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        StringBuilder code = new StringBuilder("KICK-");
        for (int i = 0; i < 4; i++) {
            code.append(chars.charAt(random.nextInt(chars.length())));
        }
        return code.toString();
    }
}
