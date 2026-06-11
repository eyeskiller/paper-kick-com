const WebSocket = require('ws');

const clients = new Map();
let claimCodeHandler = null;

function setupWebSocket(server, prisma) {
  const wss = new WebSocket.Server({ server });

  wss.on('connection', (ws, req) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    console.log(`[WS] New client connected: ${ip}`);
    
    let authenticated = false;
    let serverId = null;

    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message);
        
        if (!authenticated) {
          if (data.type === 'auth' && data.apiKey) {
            // Find server by API key
            const dbServer = await prisma.server.findUnique({ where: { apiKey: data.apiKey } });
            if (dbServer) {
              authenticated = true;
              serverId = dbServer.id;
              
              clients.set(ws, {
                ip: ip,
                serverId: serverId,
                connectedAt: new Date().toISOString()
              });
              
              console.log(`[WS] Client authenticated for Server: ${dbServer.name} (${serverId})`);
              ws.send(JSON.stringify({ type: 'auth_success' }));
            } else {
              console.log(`[WS] Authentication failed: Invalid API Key`);
              ws.close(1008, 'Unauthorized: Invalid API Key');
            }
          } else {
            console.log(`[WS] Authentication failed: Missing apiKey`);
            ws.close(1008, 'Unauthorized');
          }
          return;
        }

        if (data.type === 'claim_code_generated') {
          console.log(`[WS] Received claim code from MC server:`, data.code);
          if (claimCodeHandler) {
            // Add the serverId context so we know which server generated the code
            await claimCodeHandler({ ...data, serverId });
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
    routeToServer(targetServerId, event) {
      if (!targetServerId) return;
      const message = JSON.stringify(event);
      
      let sent = 0;
      for (const [client, meta] of clients.entries()) {
        if (meta.serverId === targetServerId && client.readyState === WebSocket.OPEN) {
          client.send(message);
          sent++;
        }
      }
      console.log(`[WS] Routed event '${event.type}' to ${sent} WebSocket connections for serverId '${targetServerId}'`);
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
