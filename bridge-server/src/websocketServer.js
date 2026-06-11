const WebSocket = require('ws');

const clients = new Map();
let claimCodeHandler = null;

function setupWebSocket(server) {
  const wss = new WebSocket.Server({ server });

  wss.on('connection', (ws, req) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    console.log(`[WS] New client connected: ${ip}`);
    
    let authenticated = false;

    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message);
        
        if (!authenticated) {
          if (data.type === 'auth' && data.secret === process.env.WS_SECRET && data.streamer) {
            authenticated = true;
            clients.set(ws, {
              ip: ip,
              streamer: data.streamer.toLowerCase(),
              connectedAt: new Date().toISOString()
            });
            console.log(`[WS] Client authenticated`);
            ws.send(JSON.stringify({ type: 'auth_success' }));
          } else {
            console.log(`[WS] Authentication failed`);
            ws.close(1008, 'Unauthorized');
          }
          return;
        }

        if (data.type === 'claim_code_generated') {
          console.log(`[WS] Received claim code from MC server:`, data.code);
          if (claimCodeHandler) {
            await claimCodeHandler(data);
          }
        }
      } catch (err) {
        console.error(`[WS] Error parsing message:`, err);
      }
    });

    ws.on('close', () => {
      console.log(`[WS] Client disconnected`);
      clients.delete(ws);
    });
  });

  return {
    routeToStreamer(streamerUsername, event) {
      if (!streamerUsername) return;
      const target = streamerUsername.toLowerCase();
      const message = JSON.stringify(event);
      
      let sent = 0;
      for (const [client, meta] of clients.entries()) {
        if (meta.streamer === target && client.readyState === WebSocket.OPEN) {
          client.send(message);
          sent++;
        }
      }
      console.log(`[WS] Routed event '${event.type}' to ${sent} servers for streamer '${target}'`);
    },
    setClaimCodeHandler(handler) {
      claimCodeHandler = handler;
    },
    getActiveConnections() {
      return Array.from(clients.values());
    }
  };
}

module.exports = { setupWebSocket };
