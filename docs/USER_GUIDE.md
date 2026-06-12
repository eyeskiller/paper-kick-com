# Kick.com Minecraft Integration Documentation

Welcome to the Kick.com Minecraft Integration! This guide covers everything you need to know about installing the plugin, setting up your server, and allowing players to link their Kick accounts to their Minecraft characters.

## Table of Contents
1. [For Server Administrators: Installation & Setup](#for-server-administrators-installation--setup)
2. [For Players: How to Link Your Account](#for-players-how-to-link-your-account)
3. [Commands & Permissions](#commands--permissions)
4. [Features](#features)

---

## For Server Administrators: Installation & Setup

### 1. Plugin Installation
1. Download the latest `KickIntegration.jar`.
2. Place the `.jar` file into your Minecraft server's `plugins/` directory.
3. Restart or reload your server to generate the configuration files.

### 2. Obtaining Your API Key
To connect your server to the Kick Bridge:
1. Log in to the **Kick Bridge Dashboard** (e.g., `https://kick.bechatbot.online/`).
2. Create a new server in the dashboard.
3. Copy the generated **API Key** (also referred to as the Server ID/Key).

### 3. Finding the Streamer UUID
To give the streamer a special prefix and distinguish them from regular users, you need their Minecraft UUID.
1. Use an online tool like [mcuuid.net](https://mcuuid.net/) to find the UUID of the streamer's Minecraft username.
2. Copy the UUID (with dashes, e.g., `123e4567-e89b-12d3-a456-426614174000`).

### 4. Configuration
Open `plugins/KickIntegration/config.yml` and update the placeholders:
```yaml
bridge:
  api-url: "https://kick.bechatbot.online/api/kick" # Adjust if hosting your own bridge
  ws-url: "wss://kick.bechatbot.online"             # Adjust if hosting your own bridge
  api-key: "YOUR_API_KEY_HERE"

streamer-uuid: "YOUR_STREAMER_UUID_HERE"
```
Once updated, save the file and run `/kick reload` from the console or in-game (requires admin permissions).

---

## For Players: How to Link Your Account

Linking your Kick.com account allows you to sync your Kick subscriber status and interact with the streamer's events.

### Step 1: Obtain a Claim Code
1. Join the Minecraft server.
2. Run the following command, replacing `<Username>` with your actual Kick.com username:
   ```
   /kick claim <Username>
   ```
3. The server will respond with a unique claim code (e.g., `KICK-A1B2`). **This code is valid for 5 minutes.**

### Step 2: Validate the Code
1. Open Kick.com and go to the streamer's chat.
2. Type your claim code exactly as provided (e.g., `KICK-A1B2`) into the chat and send the message.
3. Once the bot reads the message, your account will be instantly linked!
4. Rejoin the server or wait a moment for your new prefix to be applied. Linked users receive a `[KICK]` prefix, and active subscribers receive a `[KICK SUB]` prefix.

---

## Commands & Permissions

### Player Commands
| Command | Description | Permission |
| :--- | :--- | :--- |
| `/kick claim <Username>` | Generates a code to link your Kick account. | *None* |
| `/kick status` | *(WIP)* Check your link status. | *None* |
| `/kick unlink` | *(WIP)* Unlink your Kick account. | *None* |

### Admin Commands
| Command | Description | Permission |
| :--- | :--- | :--- |
| `/kick events <on\|off>` | Toggle Kick chat events (e.g., spawning mobs). | `kick.admin` |
| `/kick reload` | Reloads the plugin configuration. | `kick.admin` |

---

## Features

- **Subscriber Sync**: Players who are subscribed on Kick receive a special `[KICK SUB]` tablist prefix automatically when they join. Regular linked players get a `[KICK]` prefix.
- **Streamer Highlight**: The streamer gets a unique `[Streamer]` prefix automatically based on the UUID configured in `config.yml`.
- **Live Events**: (If configured by the admin) Chat events, new subscriptions, and gifted subs can trigger in-game actions like spawning mobs, dropping items, or executing console commands!
