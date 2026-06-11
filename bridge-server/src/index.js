require('dotenv').config();
const express = require('express');
const http = require('http');
const crypto = require('crypto');
const path = require('path');
const cookieParser = require('cookie-parser');
const { PrismaClient } = require('@prisma/client');
const { setupWebSocket } = require('./websocketServer');

const prisma = new PrismaClient();
const app = express();
const server = http.createServer(app);
const wsManager = setupWebSocket(server, prisma); // Pass prisma for auth

// Store generated claim codes from the WS client
wsManager.setClaimCodeHandler(async (data) => {
  try {
    await prisma.claimCode.create({
      data: {
        code: data.code,
        minecraftUuid: data.minecraftUuid,
        kickUsername: data.kickUsername,
        serverId: data.serverId, // Added from ws meta
        expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 mins
      }
    });
  } catch (err) {
    console.error('[WS] Failed to save claim code:', err);
  }
});

app.use(cookieParser());
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));

// SaaS Routes
const authRoutes = require('./routes/auth')(prisma);
app.use('/api/auth', authRoutes.router);
app.use('/api/dashboard', require('./routes/dashboard')(prisma, authRoutes.requireAuth, wsManager));

app.use('/admin', express.static(path.join(__dirname, '../public/admin')));
// Serve SaaS Dashboard (to be built)
app.use('/', express.static(path.join(__dirname, '../public/saas')));

app.get('/api/admin/stats', async (req, res) => {
  const auth = req.headers.authorization;
  if (!process.env.ADMIN_PASSWORD || auth !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const totalUsers = await prisma.linkedUser.count();
    const totalServers = await prisma.server.count();
    const totalCustomers = await prisma.customer.count();
    const activeConnections = wsManager.getActiveConnections();
    
    res.json({
      totalCustomers,
      totalServers,
      totalUsers,
      activeConnections,
      uptime: process.uptime()
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal error' });
  }
});

app.get('/api/admin/users', async (req, res) => {
  const auth = req.headers.authorization;
  if (!process.env.ADMIN_PASSWORD || auth !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const users = await prisma.linkedUser.findMany({
      include: { server: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Internal error' });
  }
});

let kickPublicKey = null;

async function fetchKickPublicKey() {
  try {
    const res = await fetch('https://api.kick.com/public/v1/public-key');
    const data = await res.text();
    try {
      const json = JSON.parse(data);
      kickPublicKey = json?.data?.public_key || json.public_key || json.key || data;
    } catch {
      kickPublicKey = data;
    }
    
    // Fix ERR_OSSL_UNSUPPORTED by ensuring standard PEM format
    if (kickPublicKey && !kickPublicKey.includes('-----BEGIN')) {
      // Remove any whitespace/newlines to create a clean base64 string
      const cleanKey = kickPublicKey.replace(/\s+/g, '');
      // Format into 64-character lines
      const formattedKey = cleanKey.match(/.{1,64}/g).join('\n');
      kickPublicKey = `-----BEGIN PUBLIC KEY-----\n${formattedKey}\n-----END PUBLIC KEY-----\n`;
    }
    
    console.log('[Webhook] Successfully fetched Kick Public Key for signature verification.');
  } catch (err) {
    console.error('[Webhook] Failed to fetch Kick Public Key. Webhooks will not be verified securely:', err.message);
  }
}

fetchKickPublicKey();

const pkceVerifiers = new Map();

// SaaS Dynamic OAuth Flow
app.get('/api/kick/auth', async (req, res) => {
  const { serverId } = req.query;
  if (!serverId) return res.status(400).send('Missing serverId');

  const dbServer = await prisma.server.findUnique({ where: { id: serverId } });
  if (!dbServer) return res.status(404).send('Server not found');

  const clientId = dbServer.kickClientId || process.env.KICK_CLIENT_ID;
  const redirectUri = encodeURIComponent('https://kick.bechatbot.online/api/kick/callback');
  
  const state = crypto.randomBytes(16).toString('hex');
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  
  pkceVerifiers.set(state, { codeVerifier, serverId });

  const scope = encodeURIComponent('user:read channel:read chat:write events:subscribe');
  const url = `https://id.kick.com/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&state=${state}&code_challenge=${codeChallenge}&code_challenge_method=S256`;
  
  res.redirect(url);
});

app.get('/api/kick/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code || !state) return res.status(400).send('Missing code or state');
  
  const sessionData = pkceVerifiers.get(state);
  if (!sessionData) return res.status(400).send('Invalid state or expired session');
  pkceVerifiers.delete(state);

  const { codeVerifier, serverId } = sessionData;
  const dbServer = await prisma.server.findUnique({ where: { id: serverId } });
  if (!dbServer) return res.status(404).send('Server not found');

  const clientId = dbServer.kickClientId || process.env.KICK_CLIENT_ID;
  const clientSecret = dbServer.kickSecret || process.env.KICK_CLIENT_SECRET;

  try {
    const tokenResponse = await fetch('https://id.kick.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
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

    console.log('[OAuth] Successfully obtained access token. Identifying user...');

    // Get the authorized user's details to store their channel slug
    const userRes = await fetch('https://api.kick.com/public/v1/users', {
      headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
    });
    
    if (userRes.ok) {
      const userData = await userRes.json();
      // Assuming the response array contains the authorized user when no ID is specified
      const authorizedUser = userData.data && userData.data.length > 0 ? userData.data[0] : null;
      if (authorizedUser && authorizedUser.name) {
        await prisma.server.update({
          where: { id: serverId },
          data: { kickChannel: authorizedUser.name.toLowerCase() }
        });
        console.log(`[OAuth] Linked Server ${dbServer.name} to Kick Channel ${authorizedUser.name}`);
      }
    }

    console.log('[OAuth] Subscribing to Webhooks...');
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
          { name: 'chat.message.sent', version: 1 },
          { name: 'channel.subscription.new', version: 1 },
          { name: 'channel.subscription.renewal', version: 1 },
          { name: 'channel.subscription.gifts', version: 1 }
        ]
      })
    });

    if (!subResponse.ok) {
      const subErr = await subResponse.text();
      console.error('[OAuth] Failed to subscribe to webhooks:', subErr);
      return res.status(500).send(`Token was retrieved, but webhook subscription failed: ${subErr}`);
    }

    res.send('Authorization successful! Your Server is now linked to Kick Webhooks. You can close this window.');
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
  }

  const event = req.body;
  console.log(`[Webhook] Received event:`, req.headers['kick-event-type']);

  try {
    const eventType = req.headers['kick-event-type'];
    const broadcasterObj = event.broadcaster || event.streamer || event.channel;
    const streamerTarget = broadcasterObj?.slug || broadcasterObj?.username;
      
    if (!streamerTarget) return res.status(200).send('OK');

    // Find the Server associated with this channel
    const dbServer = await prisma.server.findFirst({
      where: { kickChannel: streamerTarget.toLowerCase() }
    });

    if (!dbServer) {
       console.warn(`[Webhook] Received event for unlinked channel ${streamerTarget}`);
       return res.status(200).send('OK');
    }

    if (eventType === 'chat.message.sent') {
      const messageText = event.content;
      const sender = event.sender.username;

      let isSubscriber = false;
      if (event.sender.identity && Array.isArray(event.sender.identity.badges)) {
        isSubscriber = event.sender.identity.badges.some(b => b.type === 'subscriber' || b.type === 'founder');
      }

      const claimMatch = messageText.match(/KICK-[A-Z0-9]{4}/) || messageText.match(/^[A-Z0-9]{6}$/);
      if (claimMatch) {
        const code = claimMatch[0];
        const claim = await prisma.claimCode.findUnique({ where: { code } });
        
        if (claim && claim.expiresAt > new Date() && claim.serverId === dbServer.id) {
          console.log(`[Claim] Valid code ${code} for ${sender} -> ${claim.minecraftUuid}`);
          
          const newUser = await prisma.linkedUser.upsert({
            where: { minecraftUuid: claim.minecraftUuid },
            update: { kickUsername: sender, serverId: dbServer.id, isSubscriber },
            create: {
              minecraftUuid: claim.minecraftUuid,
              kickUsername: sender,
              serverId: dbServer.id,
              isSubscriber
            }
          });

          await prisma.claimCode.delete({ where: { code } });

          wsManager.routeToServer(dbServer.id, {
            type: 'claim_success',
            minecraftUuid: claim.minecraftUuid,
            kickUsername: sender,
            isSubscriber: newUser.isSubscriber
          });
        }
      } else {
        // Passively sync subscription status if an already linked user chats
        const existingUser = await prisma.linkedUser.findFirst({
          where: { kickUsername: sender, serverId: dbServer.id }
        });
        
        if (existingUser && existingUser.isSubscriber !== isSubscriber) {
          await prisma.linkedUser.update({
            where: { minecraftUuid: existingUser.minecraftUuid },
            data: { isSubscriber }
          });
          wsManager.routeToServer(dbServer.id, {
            type: 'subscription_update',
            minecraftUuid: existingUser.minecraftUuid,
            isSubscriber
          });
        }
      }

      if (dbServer.eventsEnabled) {
        const rules = await prisma.actionRule.findMany({ where: { serverId: dbServer.id, eventType: 'CHAT' } });
        for (const rule of rules) {
          if (!rule.condition || messageText.toLowerCase().includes(rule.condition.toLowerCase())) {
            wsManager.routeToServer(dbServer.id, {
              type: 'execute_action',
              actionType: rule.actionType,
              sender: sender,
              payload: rule.payload
            });
          }
        }
      }
    } else if (eventType === 'channel.subscription.new' || eventType === 'channel.subscription.renewal') {
      const subscriberUsername = event.subscriber?.username;
      if (subscriberUsername) {
        const user = await prisma.linkedUser.findFirst({ where: { kickUsername: subscriberUsername, serverId: dbServer.id } });
        if (user) {
          await prisma.linkedUser.updateMany({
            where: { kickUsername: subscriberUsername, serverId: dbServer.id },
            data: { isSubscriber: true }
          });
          wsManager.routeToServer(dbServer.id, {
            type: 'subscription_update',
            minecraftUuid: user.minecraftUuid,
            isSubscriber: true
          });
        }
      }
      if (dbServer.eventsEnabled) {
        const rules = await prisma.actionRule.findMany({ where: { serverId: dbServer.id, eventType: 'SUB_NEW' } });
        for (const rule of rules) {
          wsManager.routeToServer(dbServer.id, {
            type: 'execute_action',
            actionType: rule.actionType,
            sender: subscriberUsername || "Someone",
            payload: rule.payload
          });
        }
      }
    } else if (eventType === 'channel.subscription.gifts') {
      if (event.giftees && Array.isArray(event.giftees)) {
        const gifteeUsernames = event.giftees.map(g => g.username);
        const giftees = await prisma.linkedUser.findMany({
          where: { kickUsername: { in: gifteeUsernames }, serverId: dbServer.id }
        });
        
        await prisma.linkedUser.updateMany({
          where: { kickUsername: { in: gifteeUsernames }, serverId: dbServer.id },
          data: { isSubscriber: true }
        });
        
        for (const giftee of giftees) {
          wsManager.routeToServer(dbServer.id, {
            type: 'subscription_update',
            minecraftUuid: giftee.minecraftUuid,
            isSubscriber: true
          });
        }
      }
      if (dbServer.eventsEnabled) {
        const count = event.giftees ? event.giftees.length : 0;
        const rules = await prisma.actionRule.findMany({ where: { serverId: dbServer.id, eventType: 'SUB_GIFT' } });
        for (const rule of rules) {
          let matches = false;
          if (!rule.condition) {
             matches = count >= 1;
          } else if (rule.condition.startsWith('==')) {
             const val = parseInt(rule.condition.substring(2), 10);
             matches = count === val;
          } else if (rule.condition.startsWith('>=')) {
             const val = parseInt(rule.condition.substring(2), 10);
             matches = count >= val;
          } else {
             // Fallback for older data
             matches = count >= parseInt(rule.condition, 10);
          }

          if (matches) {
            wsManager.routeToServer(dbServer.id, {
              type: 'execute_action',
              actionType: rule.actionType,
              sender: "Someone",
              payload: rule.payload
            });
          }
        }
      }
    }

    res.status(200).send('OK');
  } catch (err) {
    console.error(`[Webhook] Error processing event:`, err);
    res.status(500).send('Error');
  }
});

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
