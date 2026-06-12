# Kick.com to Minecraft Server Integration

This project integrates the Kick.com streaming platform with a Minecraft server running Paper. Real-time events from Kick (chat messages, new subscriptions, gifted subs) trigger specific in-game actions on the Minecraft server.

You can configure what happens in-game through our beautiful Web UI!

## 🚀 Easy Setup (Hosted SaaS)

Don't want to deal with setting up databases, reverse proxies, and Node.js servers?

We offer a **fully managed SaaS platform** for only **€1.99 / month**!
- No port forwarding or VPS needed.
- Beautiful web dashboard to manage your Kick Actions.
- Instant connection to your Minecraft server.
- Automatic updates and premium support.

**[Sign up at kick.bechatbot.online](https://kick.bechatbot.online/)**

---

## 🛠️ Open-Source Self-Hosted Setup

The system is split into two components:
1. **Bridge Server**: A Node.js backend that handles Kick OAuth, webhooks, and maintains a WebSocket server.
2. **Paper Plugin**: A Minecraft plugin that connects to the Bridge Server via WebSockets and executes game logic.

### 1. Kick Developer App Setup
Before running the system, you must create a Developer Application on Kick.com to receive API credentials.
- **OAuth Redirect URL**: `https://<your-domain>/api/kick/callback`
- **Webhook Endpoint**: `https://<your-domain>/api/webhooks/kick`

Once created, you will receive a Client ID, Client Secret, and a Webhook Secret.

### 2. Bridge Server Setup

#### Requirements
- Node.js (v18+)
- NPM

#### Installation
1. Navigate to the `bridge-server` directory.
2. Run `npm install` to install dependencies.
3. Edit the `.env` file and insert your Kick Developer credentials:
   ```env
   DATABASE_URL="file:./dev.db"
   PORT=8811
   JWT_SECRET="change_me_in_production"
   ```
4. Initialize the SQLite database by running:
   ```bash
   npx prisma db push
   ```

#### Running the Server
Start the server using:
```bash
node src/index.js
```

The server will start on port `8811`. Make sure your Nginx proxy maps your domain to point to `localhost:8811` internally.

### 3. Paper Plugin Setup

#### Requirements
- Java 21
- A Minecraft Server running Paper 1.20.6+ / 1.21

#### Building the Plugin
1. Navigate to the `paper-plugin` directory.
2. Build the plugin using Gradle:
   ```bash
   ./gradlew build
   ```
   *(Note: Use `./gradlew.bat build` if on Windows)*
3. Grab the compiled jar from `paper-plugin/build/libs/` and place it in your Minecraft server's `plugins/` folder.

#### Configuration
1. Start your Minecraft server to generate the default configuration.
2. Open `plugins/KickIntegration/config.yml` and set your API Key (generated from the Web Dashboard):
   ```yaml
   bridge:
     api-url: "https://<your-domain>/api/kick"
     ws-url: "wss://<your-domain>"
     api-key: "CHANGE_ME_IN_DASHBOARD"

   streamer-uuid: "00000000-0000-0000-0000-000000000000"
   events-enabled: true
   ```
   *(You can find UUIDs using a tool like namemc.com)*
3. Run `/kick reload` in-game or from the console.

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