# Kick.com to Minecraft Server Integration

This project integrates the Kick.com streaming platform with a Minecraft server running Paper. Real-time events from Kick (chat messages, new subscriptions, gifted subs) trigger specific in-game actions on the Minecraft server.

You can configure what happens in-game through our beautiful Web UI!

## 🚀 Easy Setup (Hosted SaaS)

Don't want to deal with setting up databases, reverse proxies, and Node.js servers?

We offer a **fully managed SaaS platform** for only **$1.99 / month**!
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

## Usage

### Claiming an Account
1. A player logs into Minecraft and types `/kick claim <KickUsername>`.
2. The server generates a unique code (e.g., `KICK-A1B2`).
3. The player has 5 minutes to type this code into the Streamer's Kick.com chat.
4. The Bridge Server receives the chat message via webhook, validates the code, and links the account!
5. When linked subscribers join the game, they will receive a `[KICK SUB]` prefix in the player list.

### Configuring Actions
Log into your self-hosted web UI, click on your server, and click "Configure Actions". Here you can add actions like spawning mobs or dropping items based on chat keywords and subscriptions.