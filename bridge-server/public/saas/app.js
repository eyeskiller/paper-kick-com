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
  if (window.turnstile) { turnstile.reset(); }
}

async function handleAuth(e) {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const errorDiv = document.getElementById('auth-error');
  
  const formData = new FormData(e.target);
  const turnstileToken = formData.get('cf-turnstile-response');

  if (!turnstileToken) {
    errorDiv.textContent = 'Please complete the CAPTCHA';
    return;
  }
  
  errorDiv.textContent = '';
  const endpoint = currentAuthMode === 'login' ? '/api/auth/login' : '/api/auth/register';

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, turnstileToken })
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
    if (window.turnstile) {
      turnstile.reset();
    }
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
        ? `<span class="status-badge">Kick: @${server.kickChannel}</span>`
        : `<span class="status-badge">Kick: Unlinked</span>`;

      const wsBadge = server.isConnected
        ? `<span class="status-badge">🟢 Online</span>`
        : `<span class="status-badge">🔴 Offline</span>`;

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <h3>${server.name}</h3>
          <div style="display: flex; gap: 0.5rem; flex-direction: column; align-items: flex-end;">
            ${wsBadge}
            ${linkBadge}
          </div>
        </div>
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: auto;">
          <div style="flex: 1;">
            <label style="font-size: 0.75rem; color: var(--text-muted);">Plugin API Key</label>
            <div class="api-key-box">${server.apiKey}</div>
          </div>
          
          <div style="margin-left: 1rem; margin-top: 1rem; text-align: center;">
            <label style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 0.25rem; text-transform: uppercase; letter-spacing: 1px;">Game Events</label>
            <label class="switch" style="position: relative; display: inline-block; width: 40px; height: 20px;">
              <input type="checkbox" onchange="toggleEvents('${server.id}', this.checked)" ${server.eventsEnabled ? 'checked' : ''}>
              <span class="slider"></span>
            </label>
          </div>

          <button onclick="deleteServer('${server.id}')" title="Delete Server" style="background: transparent; color: var(--error); border: 1px solid var(--error); width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; cursor: pointer; margin-left: 1rem; margin-top: 1rem;">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
          </button>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: auto; padding-top: 1rem;">
          <div>
            <span style="font-size: 0.875rem; color: var(--text-muted); display: block;">👥 ${server._count.linkedUsers} linked players</span>
            <div style="display: flex; gap: 0.5rem; margin-top: 0.25rem;">
              <button onclick="viewPlayers('${server.id}', '${server.name}')" class="secondary-btn" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">View Players</button>
              <button onclick="openActionsModal('${server.id}', '${server.name}')" class="secondary-btn" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; border-color: var(--primary); color: var(--primary);">Configure Actions</button>
            </div>
          </div>
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

async function deleteServer(serverId) {
  if (!confirm('Are you sure you want to delete this server? This will also delete all linked players and claim codes associated with it. This action cannot be undone.')) return;
  
  try {
    const res = await fetch(`/api/dashboard/servers/${serverId}`, {
      method: 'DELETE'
    });
    
    if (!res.ok) throw new Error('Failed to delete server');
    
    loadServers();
  } catch (err) {
    alert(err.message);
  }
}

async function toggleEvents(serverId, isEnabled) {
  try {
    const res = await fetch(`/api/dashboard/servers/${serverId}/events`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventsEnabled: isEnabled })
    });
    if (!res.ok) throw new Error('Failed to update events configuration');
  } catch (err) {
    alert(err.message);
    loadServers(); // revert toggle visually
  }
}

// Initial check
loadServers();

async function viewPlayers(serverId, serverName) {
  document.getElementById('players-modal-title').textContent = `Linked Players - ${serverName}`;
  const tbody = document.getElementById('players-table-body');
  tbody.innerHTML = '<tr><td colspan="3" style="padding: 1rem; text-align: center;">Loading...</td></tr>';
  document.getElementById('players-modal').style.display = 'flex';

  try {
    const res = await fetch(`/api/dashboard/servers/${serverId}/users`);
    if (!res.ok) throw new Error('Failed to fetch players');
    const users = await res.json();

    tbody.innerHTML = '';
    if (users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" style="padding: 1rem; text-align: center; color: var(--text-muted);">No linked players found.</td></tr>';
      return;
    }

    users.forEach(u => {
      const subBadge = u.isSubscriber 
        ? '<span style="background: rgba(139,92,246,0.2); color: #8b5cf6; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem;">Yes</span>' 
        : '<span style="color: var(--text-muted); font-size: 0.75rem;">No</span>';
        
      tbody.innerHTML += `
        <tr style="border-bottom: 1px solid var(--panel-border);">
          <td style="padding: 0.75rem;">${u.kickUsername}</td>
          <td style="padding: 0.75rem; font-family: monospace; font-size: 0.8rem;">${u.minecraftUuid}</td>
          <td style="padding: 0.75rem;">${subBadge}</td>
        </tr>
      `;
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="3" style="padding: 1rem; text-align: center; color: var(--error);">${err.message}</td></tr>`;
  }
}

function closePlayersModal() {
  document.getElementById('players-modal').style.display = 'none';
}

// === ACTIONS ===
function openActionsModal(serverId, serverName) {
  document.getElementById('action-server-id').value = serverId;
  document.getElementById('actions-modal-title').textContent = `Actions for ${serverName}`;
  document.getElementById('actions-modal').style.display = 'flex';
  updateActionForm();
  loadActions(serverId);
}

function closeActionsModal() {
  document.getElementById('actions-modal').style.display = 'none';
}

function updateActionForm() {
  const eventType = document.getElementById('action-event-type').value;
  const actionType = document.getElementById('action-action-type').value;
  const conditionGroup = document.getElementById('action-condition-group');
  const conditionLabel = document.getElementById('action-condition-label');
  const conditionInput = document.getElementById('action-condition');
  const payloadFields = document.getElementById('action-payload-fields');

  // Condition
  if (eventType === 'CHAT') {
    conditionGroup.style.display = 'block';
    conditionLabel.textContent = 'Chat Keyword';
    conditionInput.placeholder = 'e.g. !creeper';
  } else if (eventType === 'SUB_GIFT') {
    conditionGroup.style.display = 'block';
    conditionLabel.textContent = 'Gift Threshold';
    conditionInput.placeholder = 'e.g. 5';
  } else {
    conditionGroup.style.display = 'none';
  }

  // Payload
  payloadFields.innerHTML = '';
  if (actionType === 'SPAWN_MOB') {
    payloadFields.innerHTML = `
      <div class="input-group"><label>Entity Type</label><input type="text" id="payload-entity" placeholder="e.g. CREEPER" required></div>
      <div class="input-group"><label>Amount</label><input type="number" id="payload-amount" value="1" required></div>
    `;
  } else if (actionType === 'GIVE_ITEM') {
    payloadFields.innerHTML = `
      <div class="input-group"><label>Item Material</label><input type="text" id="payload-item" placeholder="e.g. DIAMOND" required></div>
      <div class="input-group"><label>Amount</label><input type="number" id="payload-amount" value="1" required></div>
    `;
  } else if (actionType === 'EXECUTE_COMMAND') {
    payloadFields.innerHTML = `
      <div class="input-group"><label>Command</label><input type="text" id="payload-command" placeholder="e.g. say %sender% subbed!" required></div>
    `;
  } else if (actionType === 'DROP_HOTBAR') {
    payloadFields.innerHTML = `<span style="font-size: 0.8rem; color: #ccc;">No additional configuration required.</span>`;
  }
}

async function loadActions(serverId) {
  const tbody = document.getElementById('actions-table-body');
  tbody.innerHTML = '<tr><td colspan="4">Loading...</td></tr>';
  
  try {
    const res = await fetch(`/api/dashboard/servers/${serverId}/actions`);
    if (res.status === 401) return logout();
    const actions = await res.json();
    
    tbody.innerHTML = '';
    if (actions.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="color: var(--text-muted);">No actions configured.</td></tr>';
      return;
    }
    
    actions.forEach(action => {
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid var(--panel-border)';
      
      const evtBadge = action.eventType === 'CHAT' ? '💬 Chat' : action.eventType === 'SUB_NEW' ? '⭐ Sub' : '🎁 Gifts';
      let pl = '';
      try {
        const parsed = JSON.parse(action.payload);
        if (action.actionType === 'SPAWN_MOB') pl = `${parsed.amount}x ${parsed.entity}`;
        else if (action.actionType === 'GIVE_ITEM') pl = `${parsed.amount}x ${parsed.item}`;
        else if (action.actionType === 'EXECUTE_COMMAND') pl = `/${parsed.command}`;
      } catch (e) {}

      tr.innerHTML = `
        <td style="padding: 0.5rem;">${evtBadge}</td>
        <td style="padding: 0.5rem; color: var(--primary);">${action.condition || '-'}</td>
        <td style="padding: 0.5rem;">${action.actionType}<br><span style="color: var(--text-muted); font-size: 0.75rem;">${pl}</span></td>
        <td style="padding: 0.5rem; text-align: right;">
          <button onclick="deleteAction('${serverId}', '${action.id}')" style="background: transparent; color: var(--error); border: none; cursor: pointer;">❌</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Failed to load actions', err);
    tbody.innerHTML = '<tr><td colspan="4">Error loading actions.</td></tr>';
  }
}

async function handleAddAction(e) {
  e.preventDefault();
  const serverId = document.getElementById('action-server-id').value;
  const eventType = document.getElementById('action-event-type').value;
  const actionType = document.getElementById('action-action-type').value;
  let condition = document.getElementById('action-condition').value;
  
  if (eventType === 'SUB_NEW') condition = null;

  let payload = {};
  if (actionType === 'SPAWN_MOB') {
    payload.entity = document.getElementById('payload-entity').value;
    payload.amount = parseInt(document.getElementById('payload-amount').value);
  } else if (actionType === 'GIVE_ITEM') {
    payload.item = document.getElementById('payload-item').value;
    payload.amount = parseInt(document.getElementById('payload-amount').value);
  } else if (actionType === 'EXECUTE_COMMAND') {
    payload.command = document.getElementById('payload-command').value;
  }

  try {
    const res = await fetch(`/api/dashboard/servers/${serverId}/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType, condition, actionType, payload: JSON.stringify(payload) })
    });
    if (!res.ok) throw new Error('Failed to create action');
    
    // Clear form
    document.getElementById('action-condition').value = '';
    loadActions(serverId);
  } catch (err) {
    console.error(err);
    alert('Failed to add action');
  }
}

async function deleteAction(serverId, actionId) {
  try {
    const res = await fetch(`/api/dashboard/servers/${serverId}/actions/${actionId}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete');
    loadActions(serverId);
  } catch (err) {
    console.error(err);
    alert('Failed to delete action');
  }
}
