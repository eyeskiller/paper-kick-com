const WebSocket = require('ws');

class CustomWebSocket extends WebSocket {
  constructor(url, protocols) {
    super(url, protocols, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Origin': 'https://kick.com'
      }
    });
  }
}

global.WebSocket = CustomWebSocket;

const { Pusher } = require('pusher-js');
const pusher = new Pusher('eb1d5f283081a78b932c', { cluster: 'us2', forceTLS: true });

pusher.connection.bind('state_change', (states) => {
  console.log(`[Pusher State] ${states.previous} -> ${states.current}`);
});

console.log('Testing Pusher connection with Custom WebSocket...');
setTimeout(() => process.exit(0), 5000);
