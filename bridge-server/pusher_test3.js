const { Pusher } = require('pusher-js');

Pusher.logToConsole = true;

const pusher = new Pusher('eb1d5f283081a78b932c', { cluster: 'us2', forceTLS: true });

pusher.connection.bind('state_change', (states) => {
  console.log(`[Pusher State] ${states.previous} -> ${states.current}`);
});

pusher.connection.bind('error', (err) => {
  console.error('[Pusher Error]', err);
});

console.log('Testing Pusher connection with debug...');
setTimeout(() => process.exit(0), 10000);
