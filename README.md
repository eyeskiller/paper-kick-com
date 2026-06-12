# Kick.com to Minecraft Server Integration

This project integrates the Kick.com streaming platform with a Minecraft server running Paper. Real-time events from Kick (chat messages, new subscriptions, gifted subs) trigger specific in-game actions on the Minecraft server.

You can configure what happens in-game through our beautiful Web UI!

## 🛠️ Installation Setup

The system is fully open-source and can run on your own VPS.

The architecture consists of:
1. **Bridge Server**: A Node.js backend that handles Kick OAuth, webhooks, and the Web UI.
2. **Paper Plugin**: A Minecraft plugin that connects to the Bridge Server.

For full step-by-step instructions on setting up your Kick Developer App, configuring the Node.js server, and building the Paper plugin, please see our dedicated **[Installation Guide](INSTALLATION.md)**.

## ✨ Features & Capabilities

The Kick Integration plugin is packed with interactive tools to monetize and engage your Kick stream:

### 🎮 Player Account Linking
- Players use `/kick claim <Username>` in Minecraft to generate a temporary verification code.
- They paste this code in your Kick chat to verify their identity securely.
- **Automatic Subscriber Sync**: The bridge automatically reads chat badges from Kick webhooks. When a linked player types in chat, the system detects if they have a sub badge and instantly syncs their subscriber status to the server!
- **In-Game Perks**: Verified subscribers receive a prominent `[KICK SUB]` prefix in the player list (Tab).
- Server admins can easily view all linked players and manually override subscriber status directly from the Web Dashboard.

### ⚡ Dynamic Event Actions
Configure exactly what happens in-game when events happen on your stream!

**Supported Triggers:**
- **Chat Messages:** Trigger actions when viewers type specific keywords (e.g. `!creeper`).
- **New Subscriptions:** Reward or troll the streamer when someone subscribes.
- **Gifted Subscriptions:** Highly customizable math logic for gifted subs!
  - You can set rules for **Exact** amounts (e.g. `== 5` drops 1 diamond block).
  - You can set rules for **At Least** amounts (e.g. `>= 20` spawns a Warden).
  - **Multiply Fallback:** If no exact rule matches, use the *Otherwise, Multiply Payload* option to multiply your action by the number of gifts. (e.g. If you configure it to spawn 1 zombie, and a viewer gifts 10 subs, it spawns 10 zombies!).

**Available In-Game Actions:**
- **Spawn Mobs:** Spawn entities like Creepers, Zombies, Skeletons, or Wardens right on top of the streamer.
- **Give Items:** Give the streamer valuable items like Diamonds, Netherite Ingots, or Enchanted Golden Apples.
- **Drop Streamer Hotbar:** Instantly force the streamer to drop whatever items are in their active hotbar!
- **Execute Console Command:** Run custom commands using variables. You can use `%streamer%` (the streamer's username) and `%sender%` (the Kick viewer who triggered it).

### 🧪 Built-In Testing
Don't want to spend real money testing your Gifted Sub actions? The Web Dashboard features a `🧪 Test Action` button next to every configured rule. It will even prompt you to simulate specific amounts of gifted subs so you can test your math perfectly in-game.

## 🛠️ Usage

1. Log into your dashboard and link your Minecraft server.
2. Ensure your `KickIntegration` plugin is connected (`/kick status`).
3. Click **Manage Actions** in the dashboard to start creating your interactive rules.
4. Tell your viewers to type `/kick claim` in-game to sync their accounts!