require('dotenv').config();
const express = require('express');
const http = require('http');
const crypto = require('crypto');
const path = require('path');
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

app.get('/api/kick/auth', (req, res) => {
  const clientId = process.env.KICK_CLIENT_ID;
  const redirectUri = encodeURIComponent('https://kick.bechatbot.online/api/kick/callback');
  const url = `https://kick.com/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=channel:read,chat:read`;
  res.redirect(url);
});

app.get('/api/kick/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('No code provided');
  console.log(`[OAuth] Received code: ${code}`);
  res.send('OAuth flow complete. You can close this window.');
});

app.post('/api/webhooks/kick', async (req, res) => {
  const signature = req.headers['x-kick-signature'];
  
  if (process.env.KICK_WEBHOOK_SECRET && signature) {
    const hmac = crypto.createHmac('sha256', process.env.KICK_WEBHOOK_SECRET);
    const calculatedSignature = hmac.update(req.rawBody).digest('hex');
    // Uncomment for prod:
    // if (calculatedSignature !== signature) return res.status(401).send('Invalid signature');
  }

  const event = req.body;
  console.log(`[Webhook] Received event:`, event?.type);

  try {
    if (event.type === 'chat.message.sent') {
      const messageText = event.data.message;
      const sender = event.data.sender.username;

      const streamerTarget = event.streamer?.slug || event.data?.channel?.slug || event.data?.streamer?.slug;
      
      const claimMatch = messageText.match(/KICK-[A-Z0-9]{4}/) || messageText.match(/^[A-Z0-9]{6}$/);
      if (claimMatch && streamerTarget) {
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

          wsManager.routeToStreamer(streamerTarget, {
            type: 'claim_success',
            minecraftUuid: claim.minecraftUuid,
            kickUsername: sender
          });
        }
      }
    } else if (event.type === 'channel.subscription.new' || event.type === 'kicks.gifted') {
      const streamerTarget = event.streamer?.slug || event.data?.channel?.slug || event.data?.streamer?.slug;
      if (streamerTarget) {
        wsManager.routeToStreamer(streamerTarget, {
          type: 'subscription_event',
          subType: event.type,
          data: event.data
        });
      } else {
        console.warn('[Webhook] Missing streamer target in subscription event payload!');
      }
    }

    res.status(200).send('OK');
  } catch (err) {
    console.error(`[Webhook] Error processing event:`, err);
    res.status(500).send('Error');
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
