# RHEL Deployment Guide

This guide covers setting up the Kick.com Bridge Server on a Red Hat Enterprise Linux (RHEL), AlmaLinux, or Rocky Linux server. We will create a dedicated, unprivileged user to run the application securely.

## 1. Create a Dedicated User
It is a security best practice to run web applications under a dedicated user rather than `root`.

Run the following commands as a user with `sudo` privileges:
```bash
# Create a new user named 'kickbot' with a home directory
sudo useradd -m -s /bin/bash kickbot

# (Optional) Set a password if you need to log in as this user via SSH directly
sudo passwd kickbot
```

## 2. Install Required Software
Ensure you have Git, Node.js, and Nginx installed on your RHEL server.

```bash
# Update packages
sudo dnf update -y

# Install Git and Nginx
sudo dnf install -y git nginx

# Install Node.js (Enable the Node.js 20 module if available)
sudo dnf module enable nodejs:20 -y
sudo dnf install -y nodejs npm
```

## 3. Clone and Setup the Project
Switch to your new user so that all files and dependencies are owned by `kickbot`.

```bash
# Switch to the new user
sudo su - kickbot

# Clone the repository into the user's home directory
git clone https://github.com/eyeskiller/paper-kick-com.git
cd paper-kick-com/bridge-server

# Install Node.js dependencies
npm install

# Create your .env file
nano .env 
# (Paste your secrets here according to the main README)

# Initialize the SQLite database
npx prisma db push
```

## 4. Run the Server as a Background Service (PM2)
To keep the Bridge Server running 24/7 and automatically restart it on server reboots or crashes, we use PM2.

Still logged in as `kickbot`:
```bash
# Start the bridge server using pm2
npx pm2 start src/index.js --name "kick-bridge"

# Save the PM2 process list so it remembers this app
npx pm2 save

# Generate the startup script so PM2 boots on server startup
npx pm2 startup
```

> [!IMPORTANT]
> The `pm2 startup` command above will output a specific command that looks like `sudo env PATH=$PATH:/usr/bin ...`. 
> **You must copy that exact output, type `exit` to return to your sudo user, and paste it to enable the startup service.**

## 5. Configure Nginx
As your `sudo` user (after exiting the `kickbot` session):

```bash
# Copy the provided Nginx configuration to RHEL's conf.d directory
sudo cp /home/kickbot/paper-kick-com/kick.bechatbot.online.conf /etc/nginx/conf.d/

# Test the Nginx configuration for syntax errors
sudo nginx -t

# Enable Nginx to start on boot and start it now
sudo systemctl enable --now nginx
sudo systemctl reload nginx
```
*(Note: RHEL uses `/etc/nginx/conf.d/` rather than the `sites-available`/`sites-enabled` structure common in Debian/Ubuntu.)*

## 6. Configure SELinux
RHEL enforces SELinux strictly by default. SELinux will block Nginx from acting as a reverse proxy to your Node.js app on port `8811` unless you explicitly allow it.

```bash
# Allow Nginx to make outbound network proxy connections
sudo setsebool -P httpd_can_network_connect 1
```

## 7. Install Let's Encrypt (Certbot)
Finally, secure your domain with an SSL certificate.

```bash
# Install EPEL repository and Certbot
sudo dnf install -y epel-release
sudo dnf install -y certbot python3-certbot-nginx

# Run certbot to automatically configure HTTPS
sudo certbot --nginx -d kick.bechatbot.online
```
