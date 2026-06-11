const fetch = require('node-fetch'); // wait, node-fetch might not be installed, using built-in fetch if Node >= 18

async function getPusherKey() {
  try {
    const res = await fetch('https://api.allorigins.win/get?url=https://kick.com');
    const proxyData = await res.json();
    const html = proxyData.contents;
    
    const keyMatch = html.match(/pusherKey"\s*:\s*"([^"]+)"/);
    const clusterMatch = html.match(/pusherCluster"\s*:\s*"([^"]+)"/);
    
    console.log('Pusher Key:', keyMatch ? keyMatch[1] : 'Not Found');
    console.log('Cluster:', clusterMatch ? clusterMatch[1] : 'Not Found');
  } catch (err) {
    console.error(err);
  }
}

getPusherKey();
