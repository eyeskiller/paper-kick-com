require('dotenv').config();
const express = require('express');
const http = require('http');
const crypto = require('crypto');
const path = require('path');
const { Pusher } = require('pusher-js');
const { PrismaClient } = require('@prisma/client');
const { setupWebSocket } = require('./websocketServer');

const prisma = new PrismaClient();
const app = express();
const server = http.createServer(app);
const wsManager = setupWebSocket(server);

// Store generated claim codes from the WS client
wsManager.setClaimCodeHandler(async (data) => {
  try {
    await prisma.claimCode.create({
      data: {
        code: data.code,
        minecraftUuid: data.minecraftUuid,
        kickUsername: data.kickUsername,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 mins
      }
    });
  } catch (err) {
    console.error('[WS] Failed to save claim code:', err);
  }
});

app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));

app.use('/admin', express.static(path.join(__dirname, '../public/admin')));

app.get('/api/admin/stats', async (req, res) => {
  const auth = req.headers.authorization;
  if (!process.env.ADMIN_PASSWORD || auth !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const totalUsers = await prisma.linkedUser.count();
    const activeConnections = wsManager.getActiveConnections();
    
    res.json({
      totalUsers,
      activeConnections,
      uptime: process.uptime()
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal error' });
  }
});

const pkceVerifiers = new Map();

app.get('/api/kick/auth', (req, res) => {
  const clientId = process.env.KICK_CLIENT_ID;
  const redirectUri = encodeURIComponent('https://kick.bechatbot.online/api/kick/callback');
  
  const state = crypto.randomBytes(16).toString('hex');
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  
  pkceVerifiers.set(state, codeVerifier);

  const scope = encodeURIComponent('user:read channel:read chat:write events:subscribe');
  const url = `https://id.kick.com/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&state=${state}&code_challenge=${codeChallenge}&code_challenge_method=S256`;
  
  res.redirect(url);
});

app.get('/api/kick/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code || !state) return res.status(400).send('Missing code or state');
  
  const codeVerifier = pkceVerifiers.get(state);
  if (!codeVerifier) return res.status(400).send('Invalid state or expired session');
  pkceVerifiers.delete(state);

  try {
    const tokenResponse = await fetch('https://id.kick.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.KICK_CLIENT_ID,
        client_secret: process.env.KICK_CLIENT_SECRET,
        redirect_uri: 'https://kick.bechatbot.online/api/kick/callback',
        code: code,
        code_verifier: codeVerifier
      })
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) {
      console.error('[OAuth] Token error:', tokenData);
      return res.status(400).send('Failed to obtain token from Kick. Check server logs.');
    }

    console.log('[OAuth] Successfully obtained access token for user!');
    res.send('Authorization successful! You can close this window. Kick webhooks are now enabled for your channel.');
  } catch (err) {
    console.error('[OAuth] Exception:', err);
    res.status(500).send('Internal Server Error during Kick authorization.');
  }
});

const pusher = new Pusher('eb1d5f283081a78b932c', { cluster: 'us2' });
const subscribedChannels = new Set();

wsManager.onClientAuth(async (streamerSlug) => {
  if (subscribedChannels.has(streamerSlug)) return;
  subscribedChannels.add(streamerSlug);

  try {
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(`https://kick.com/api/v1/channels/${streamerSlug}`)}`;
    const res = await fetch(proxyUrl);
    if (!res.ok) throw new Error('Failed to fetch from proxy');
    
    const proxyData = await res.json();
    if (!proxyData.contents) throw new Error('Channel not found on Kick API');
    
    const data = JSON.parse(proxyData.contents);
    const chatroomId = data.chatroom.id;
    
    console.log(`[Pusher] Subscribing to chatroom ${chatroomId} for streamer ${streamerSlug}`);
    const channel = pusher.subscribe(`chatrooms.${chatroomId}.v2`);

    channel.bind('App\\Events\\ChatMessageEvent', async (eventData) => {
      const messageText = eventData.content;
      const sender = eventData.sender.username;

      const claimMatch = messageText.match(/KICK-[A-Z0-9]{4}/) || messageText.match(/^[A-Z0-9]{6}$/);
      if (claimMatch) {
        const code = claimMatch[0];
        const claim = await prisma.claimCode.findUnique({ where: { code } });
        
        if (claim && claim.expiresAt > new Date()) {
          console.log(`[Claim] Valid code ${code} for ${sender} -> ${claim.minecraftUuid}`);
          
          await prisma.linkedUser.upsert({
            where: { minecraftUuid: claim.minecraftUuid },
            update: { kickUsername: sender },
            create: {
              minecraftUuid: claim.minecraftUuid,
              kickUsername: sender
            }
          });

          await prisma.claimCode.delete({ where: { code } });

          wsManager.routeToStreamer(streamerSlug, {
            type: 'claim_success',
            minecraftUuid: claim.minecraftUuid,
            kickUsername: sender
          });
        }
      }
    });

    channel.bind('App\\Events\\SubscriptionEvent', (eventData) => {
      wsManager.routeToStreamer(streamerSlug, {
        type: 'subscription_event',
        subType: 'channel.subscription.new',
        data: eventData
      });
    });

    channel.bind('App\\Events\\GiftedSubscriptionsEvent', (eventData) => {
      wsManager.routeToStreamer(streamerSlug, {
        type: 'subscription_event',
        subType: 'kicks.gifted',
        data: eventData
      });
    });

  } catch (err) {
    console.error(`[Pusher] Failed to subscribe to ${streamerSlug}:`, err);
    subscribedChannels.delete(streamerSlug);
  }
});

// Endpoint for Paper plugin to check subscriber status on join
app.get('/api/kick/status/:uuid', async (req, res) => {
  try {
    const user = await prisma.linkedUser.findUnique({
      where: { minecraftUuid: req.params.uuid }
    });
    if (user) {
      res.json({ linked: true, isSubscriber: user.isSubscriber, kickUsername: user.kickUsername });
    } else {
      res.json({ linked: false });
    }
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 8811;
server.listen(PORT, () => {
  console.log(`[Server] Bridge server listening on port ${PORT}`);
});
