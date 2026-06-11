const { Pusher } = require('pusher-js');

Pusher.logToConsole = true;

const clusters = ['us2', 'mt1', 'us3', 'eu', 'ap1'];

let currentIdx = 0;

function tryCluster() {
  if (currentIdx >= clusters.length) return process.exit(0);
  const cluster = clusters[currentIdx++];
  console.log('Trying cluster:', cluster);
  
  const pusher = new Pusher('eb1d5f283081a78b932c', { cluster: cluster, forceTLS: true });
  
  pusher.connection.bind('state_change', (states) => {
    console.log(`[${cluster} State] ${states.previous} -> ${states.current}`);
    if (states.current === 'connected') {
      console.log('SUCCESS! Cluster is', cluster);
      process.exit(0);
    }
  });

  pusher.connection.bind('error', (err) => {
    if (err && err.error && err.error.data && err.error.data.code === 4001) {
      console.log('Wrong cluster:', cluster);
      pusher.disconnect();
      tryCluster();
    }
  });
}

tryCluster();
