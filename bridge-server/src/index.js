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

let kickPublicKey = null;

async function fetchKickPublicKey() {
  try {
    const res = await fetch('https://api.kick.com/public/v1/public-key');
    const data = await res.text();
    // Some endpoints return JSON with the key, others return plain text. Handle both.
    try {
      const json = JSON.parse(data);
      kickPublicKey = json?.data?.public_key || json.public_key || json.key || data;
    } catch {
      kickPublicKey = data;
    }
    console.log('[Webhook] Successfully fetched Kick Public Key for signature verification.');
  } catch (err) {
    console.error('[Webhook] Failed to fetch Kick Public Key. Webhooks will not be verified securely:', err.message);
  }
}

// Fetch the public key on startup
fetchKickPublicKey();

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

    console.log('[OAuth] Successfully obtained access token. Subscribing to Webhooks...');

    // Subscribe to chat events using the Official Kick Dev API!
    const subResponse = await fetch('https://api.kick.com/public/v1/events/subscriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        method: 'webhook',
        events: [
          { name: 'chat.message.sent', version: 1 }
        ]
      })
    });

    if (!subResponse.ok) {
      const subErr = await subResponse.text();
      console.error('[OAuth] Failed to subscribe to webhooks:', subErr);
      return res.status(500).send(`Token was retrieved, but webhook subscription failed: ${subErr}`);
    }

    console.log('[OAuth] Webhook subscription successful!');
    res.send('Authorization successful! You can close this window. Kick webhooks are now enabled for your channel. Type a KICK-XXXX code in your chat to test it!');
  } catch (err) {
    console.error('[OAuth] Exception:', err);
    res.status(500).send('Internal Server Error during Kick authorization.');
  }
});

app.post('/api/webhooks/kick', async (req, res) => {
  const signature = req.headers['kick-event-signature'];
  const messageId = req.headers['kick-event-message-id'];
  const timestamp = req.headers['kick-event-message-timestamp'];

  if (!signature || !messageId || !timestamp) {
    return res.status(400).send('Missing required Kick Webhook headers');
  }

  if (kickPublicKey) {
    try {
      const signatureBase = `${messageId}.${timestamp}.${req.rawBody}`;
      const verify = crypto.createVerify('SHA256');
      verify.update(signatureBase);
      const isValid = verify.verify(kickPublicKey, Buffer.from(signature, 'base64'));

      if (!isValid) {
        console.warn('[Webhook] Invalid signature received!');
        return res.status(401).send('Invalid signature');
      }
    } catch (err) {
      console.error('[Webhook] Error validating signature:', err);
      return res.status(500).send('Signature validation failed');
    }
  } else {
    console.warn('[Webhook] Warning: Processing webhook without signature validation because Kick public key is missing.');
  }

  const event = req.body;
  console.log(`[Webhook] Received event:`, req.headers['kick-event-type']);

  try {
    if (req.headers['kick-event-type'] === 'chat.message.sent') {
      const messageText = event.content;
      const sender = event.sender.username;

      // Ensure backward compatibility with different payload structures just in case
      const broadcasterObj = event.broadcaster || event.streamer || event.channel;
      const streamerTarget = broadcasterObj?.slug || broadcasterObj?.username;
      
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

          // Because streamerTarget might be cased differently, we pass it down
          wsManager.routeToStreamer(streamerTarget.toLowerCase(), {
            type: 'claim_success',
            minecraftUuid: claim.minecraftUuid,
            kickUsername: sender
          });
        }
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
