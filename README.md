# Kick.com to Minecraft Server Integration

This project integrates the Kick.com streaming platform with a Minecraft server running Paper. Real-time events from Kick (chat messages, new subscriptions, gifted subs) trigger specific in-game actions on the Minecraft server.

The system is split into two components:
1. **Bridge Server**: A Node.js backend that handles Kick OAuth, webhooks, and maintains a WebSocket server.
2. **Paper Plugin**: A Minecraft plugin that connects to the Bridge Server via WebSockets and executes game logic.

## 1. Kick Developer App Setup
Before running the system, you must create a Developer Application on Kick.com to receive API credentials.
- **OAuth Redirect URL**: `https://kick.bechatbot.online/api/kick/callback`
- **Webhook Endpoint**: `https://kick.bechatbot.online/api/webhooks/kick`

Once created, you will receive a Client ID, Client Secret, and a Webhook Secret.

## 2. Bridge Server Setup

### Requirements
- Node.js (v18+)
- NPM

### Installation
1. Navigate to the `bridge-server` directory.
2. Run `npm install` to install dependencies.
3. Edit the `.env` file and insert your Kick Developer credentials:
   ```env
   DATABASE_URL="file:./dev.db"
   PORT=8811
   WS_SECRET="change_me_in_production"
   ADMIN_PASSWORD="super_secret_password"
   KICK_CLIENT_ID="your_client_id"
   KICK_CLIENT_SECRET="your_client_secret"
   ```
4. Initialize the SQLite database by running:
   ```bash
   npx prisma db push
   ```

### Running the Server
Start the server using:
```bash
node src/index.js
```

### Admin Control Panel
The Bridge Server includes a built-in admin dashboard. You can access it by visiting `/admin` on your deployed URL (e.g., `https://kick.bechatbot.online/admin`). Log in using the `ADMIN_PASSWORD` you configured in your `.env` file to see live statistics and connected Minecraft servers.
The server will start on port `8811`. Make sure your Nginx proxy maps `https://kick.bechatbot.online` to point to `localhost:8811` internally.

## 3. Paper Plugin Setup

### Requirements
- Java 21
- A Minecraft Server running Paper 1.20.6+ / 1.21

### Building the Plugin
1. Navigate to the `paper-plugin` directory.
2. Build the plugin using Gradle:
   ```bash
   ./gradlew build
   ```
   *(Note: Use `./gradlew.bat build` if on Windows)*
3. Grab the compiled jar from `paper-plugin/build/libs/` and place it in your Minecraft server's `plugins/` folder.

### Configuration
1. Start your Minecraft server to generate the default configuration.
2. Open `plugins/KickIntegration/config.yml` and set the Streamer's Minecraft UUID:
   ```yaml
   bridge:
     url: "ws://164.90.227.96:8811"
     secret: "change_me_in_production"
     api-url: "https://kick.bechatbot.online/api/kick"
   streamer-uuid: "00000000-0000-0000-0000-000000000000"
   ```
   *(You can find UUIDs using a tool like namemc.com)*
3. If you changed the `WS_SECRET` in the Bridge Server `.env`, update it in this config as well.
4. Run `/kick reload` in-game or from the console.

## Usage

### Claiming an Account
1. A player logs into Minecraft and types `/kick claim <KickUsername>`.
2. The server generates a unique code (e.g., `KICK-A1B2`).
3. The player has 5 minutes to type this code into the Streamer's Kick.com chat.
4. The Bridge Server receives the chat message via webhook, validates the code, and links the account!
5. When linked subscribers join the game, they will receive a `[Kick Sub]` prefix in the player list.

### In-Game Actions
Currently configured actions inside `ActionHandler.java`:
- **1 Gifted Sub / New Subscription**: Spawns a Creeper at the streamer's location.
- **5 Gifted Subs (or more)**: Forces the streamer to drop all items in their hotbar on the floor.