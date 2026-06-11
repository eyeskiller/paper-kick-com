const WebSocket = require('ws');

const clients = new Set();
let claimCodeHandler = null;

function setupWebSocket(server) {
  const wss = new WebSocket.Server({ server });

  wss.on('connection', (ws, req) => {
    console.log(`[WS] New client connected: ${req.socket.remoteAddress}`);
    
    let authenticated = false;

    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message);
        
        if (!authenticated) {
          if (data.type === 'auth' && data.secret === process.env.WS_SECRET) {
            authenticated = true;
            clients.add(ws);
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
    broadcast(event) {
      const message = JSON.stringify(event);
      for (const client of clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      }
    },
    setClaimCodeHandler(handler) {
      claimCodeHandler = handler;
    }
  };
}

module.exports = { setupWebSocket };
