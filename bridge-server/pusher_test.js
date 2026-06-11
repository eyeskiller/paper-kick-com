const { Pusher } = require('pusher-js');

const pusher = new Pusher('eb1d5f283081a78b932c', { cluster: 'us2' });
const channel = pusher.subscribe('chatrooms.10975819.v2');

pusher.connection.bind('state_change', (states) => {
  console.log('[Pusher State]', states.current);
});

channel.bind_global((eventName, data) => {
  console.log(`[Pusher Event] ${eventName}:`, JSON.stringify(data).substring(0, 200));
});

console.log('Listening for 30 seconds...');
setTimeout(() => process.exit(0), 30000);
