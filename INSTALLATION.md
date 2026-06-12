# Installation Guide

If you prefer not to use our [Hosted SaaS Platform](https://kick.bechatbot.online/), you can self-host the Kick Integration bridge server yourself. 

The system is split into two components:
1. **Bridge Server**: A Node.js backend that handles Kick OAuth, webhooks, and maintains a WebSocket server.
2. **Paper Plugin**: A Minecraft plugin that connects to the Bridge Server via WebSockets and executes game logic.

---

## 1. Kick Developer App Setup
Before running the system, you must create a Developer Application on Kick.com to receive API credentials.
- **OAuth Redirect URL**: `https://<your-domain>/api/kick/callback`
- **Webhook Endpoint**: `https://<your-domain>/api/webhooks/kick`

Once created, you will receive a **Client ID**, **Client Secret**, and a **Webhook Secret**.

---

## 2. Bridge Server Setup

### Requirements
- Node.js (v18+)
- NPM
- A domain name with SSL (required for Kick Webhooks)
- Nginx or similar reverse proxy

### Installation
1. Navigate to the `bridge-server` directory.
2. Run `npm install` to install dependencies.
3. Edit the `.env` file and insert your Kick Developer credentials:
   ```env
   DATABASE_URL="file:./dev.db"
   PORT=8811
   JWT_SECRET="change_me_in_production"
   ```
   *(Note: You do not need to put your Kick secrets in `.env` if you are using the web dashboard, as you will configure them in the UI!)*
4. Initialize the SQLite database by running:
   ```bash
   npx prisma db push
   ```

### Running the Server
Start the server using:
```bash
node src/index.js
```
*(We recommend using `pm2` to keep the server running in the background).*

The server will start on port `8811`. Make sure your Nginx proxy maps your domain to point to `localhost:8811` internally, and that it has a valid SSL certificate.

---

## 3. Paper Plugin Setup

### Requirements
- Java 21
- A Minecraft Server running Paper 1.20.6+ or 1.21

### Building the Plugin
1. Navigate to the `paper-plugin` directory.
2. Build the plugin using Gradle:
   ```bash
   ./gradlew build
   ```
   *(Note: Use `./gradlew.bat build` if on Windows)*
3. Grab the compiled `.jar` file from `paper-plugin/build/libs/` and place it in your Minecraft server's `plugins/` folder.

### Configuration
1. Start your Minecraft server to generate the default configuration.
2. Go to your web dashboard (`https://<your-domain>`) and create a new server. Copy the **Plugin API Key** it generates.
3. Open `plugins/KickIntegration/config.yml` on your Minecraft server and set your credentials:
   ```yaml
   bridge:
     api-url: "https://<your-domain>/api/kick"
     ws-url: "wss://<your-domain>"
     api-key: "PASTE_YOUR_API_KEY_HERE"

   streamer-uuid: "00000000-0000-0000-0000-000000000000"
   events-enabled: true
   ```
   *(You can find UUIDs using a tool like [namemc.com](https://namemc.com))*
4. Run `/kick reload` in-game or from the console to apply the configuration.

---

## 4. Final Steps
1. Log into your dashboard and verify your server is showing as `🟢 Online`.
2. Click **Link Kick Channel** in the dashboard to authorize your Kick account.
3. You are now ready to start configuring Actions!
