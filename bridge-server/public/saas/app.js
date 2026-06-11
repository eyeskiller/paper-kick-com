let currentAuthMode = 'login'; // 'login' or 'register'

function showAuthView(mode) {
  document.getElementById('landing-view').style.display = 'none';
  document.getElementById('auth-view').style.display = 'flex';
  document.getElementById('dashboard-view').style.display = 'none';
  switchAuthTab(mode);
}

function switchAuthTab(mode) {
  currentAuthMode = mode;
  document.getElementById('tab-login').classList.toggle('active', mode === 'login');
  document.getElementById('tab-register').classList.toggle('active', mode === 'register');
  document.getElementById('auth-btn').textContent = mode === 'login' ? 'Login' : 'Register';
  document.getElementById('auth-error').textContent = '';
}

async function handleAuth(e) {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const errorDiv = document.getElementById('auth-error');
  
  errorDiv.textContent = '';
  const endpoint = currentAuthMode === 'login' ? '/api/auth/login' : '/api/auth/register';

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Authentication failed');

    // Success
    document.getElementById('auth-view').style.display = 'none';
    document.getElementById('landing-view').style.display = 'none';
    document.getElementById('dashboard-view').style.display = 'flex';
    document.getElementById('user-email').textContent = email;
    loadServers();
  } catch (err) {
    errorDiv.textContent = err.message;
  }
}

async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' });
  document.getElementById('dashboard-view').style.display = 'none';
  document.getElementById('auth-view').style.display = 'none';
  document.getElementById('landing-view').style.display = 'flex';
}

async function loadServers() {
  try {
    const res = await fetch('/api/dashboard/servers');
    if (!res.ok) {
      document.getElementById('landing-view').style.display = 'flex';
      document.getElementById('dashboard-view').style.display = 'none';
      document.getElementById('auth-view').style.display = 'none';
      return;
    }
    const servers = await res.json();
    
    // Authenticated! Show dashboard.
    document.getElementById('landing-view').style.display = 'none';
    document.getElementById('auth-view').style.display = 'none';
    document.getElementById('dashboard-view').style.display = 'flex';
    
    const grid = document.getElementById('servers-grid');
    grid.innerHTML = '';

    if (servers.length === 0) {
      grid.innerHTML = '<p style="color: var(--text-muted); grid-column: 1/-1;">No servers found. Create one to get started!</p>';
      return;
    }

    servers.forEach(server => {
      const card = document.createElement('div');
      card.className = 'glass-panel server-card';
      
      const isLinked = server.kickChannel ? true : false;
      const linkBadge = isLinked 
        ? `<span class="status-badge" style="background: rgba(16,185,129,0.2); color: #10b981;">Kick: @${server.kickChannel}</span>`
        : `<span class="status-badge" style="background: rgba(239,68,68,0.2); color: #ef4444;">Kick: Unlinked</span>`;

      const wsBadge = server.isConnected
        ? `<span class="status-badge" style="background: rgba(59,130,246,0.2); color: #3b82f6;">🟢 Online</span>`
        : `<span class="status-badge" style="background: rgba(148,163,184,0.2); color: #94a3b8;">🔴 Offline</span>`;

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <h3>${server.name}</h3>
          <div style="display: flex; gap: 0.5rem; flex-direction: column; align-items: flex-end;">
            ${wsBadge}
            ${linkBadge}
          </div>
        </div>
        
        <div>
          <label style="font-size: 0.75rem; color: var(--text-muted);">Plugin API Key</label>
          <div class="api-key-box">${server.apiKey}</div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: auto; padding-top: 1rem;">
          <span style="font-size: 0.875rem; color: var(--text-muted);">👥 ${server._count.linkedUsers} linked players</span>
          <a href="/api/kick/auth?serverId=${server.id}" target="_blank" class="secondary-btn" style="text-decoration: none;">
            ${isLinked ? 'Re-link Kick' : 'Link Kick Channel'}
          </a>
        </div>
      `;
      grid.appendChild(card);
    });
  } catch (err) {
    console.error('Failed to load servers', err);
  }
}

function openNewServerModal() {
  document.getElementById('new-server-modal').style.display = 'flex';
}

function closeNewServerModal() {
  document.getElementById('new-server-modal').style.display = 'none';
  document.getElementById('new-server-name').value = '';
  document.getElementById('new-server-client-id').value = '';
  document.getElementById('new-server-secret').value = '';
}

async function handleCreateServer(e) {
  e.preventDefault();
  const name = document.getElementById('new-server-name').value;
  const kickClientId = document.getElementById('new-server-client-id').value;
  const kickSecret = document.getElementById('new-server-secret').value;

  try {
    const res = await fetch('/api/dashboard/servers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, kickClientId, kickSecret })
    });
    
    if (!res.ok) throw new Error('Failed to create server');
    
    closeNewServerModal();
    loadServers();
  } catch (err) {
    alert(err.message);
  }
}

// Initial check
loadServers();
