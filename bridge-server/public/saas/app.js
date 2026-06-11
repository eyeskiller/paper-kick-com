let currentAuthMode = 'login';
let newServerModal, playersModal, actionsModal;

document.addEventListener("DOMContentLoaded", () => {
  newServerModal = new bootstrap.Modal(document.getElementById('new-server-modal'));
  playersModal = new bootstrap.Modal(document.getElementById('players-modal'));
  actionsModal = new bootstrap.Modal(document.getElementById('actions-modal'));
  loadServers();
});

function showAuthView(mode) {
  document.getElementById('landing-view').style.setProperty('display', 'none', 'important');
  document.getElementById('auth-view').style.setProperty('display', 'flex', 'important');
  document.getElementById('dashboard-view').style.setProperty('display', 'none', 'important');
  switchAuthTab(mode);
}

function switchAuthTab(mode) {
  currentAuthMode = mode;
  document.getElementById('tab-login').classList.toggle('active', mode === 'login');
  document.getElementById('tab-register').classList.toggle('active', mode === 'register');
  document.getElementById('auth-btn').textContent = mode === 'login' ? 'Login' : 'Register';
  document.getElementById('auth-error').classList.add('d-none');
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
    errorDiv.classList.remove('d-none');
    return;
  }
  
  errorDiv.classList.add('d-none');
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
    document.getElementById('auth-view').style.setProperty('display', 'none', 'important');
    document.getElementById('landing-view').style.setProperty('display', 'none', 'important');
    document.getElementById('dashboard-view').style.setProperty('display', 'flex', 'important');
    document.getElementById('user-email').textContent = email;
    loadServers();
  } catch (err) {
    errorDiv.textContent = err.message;
    errorDiv.classList.remove('d-none');
    if (window.turnstile) {
      turnstile.reset();
    }
  }
}

async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' });
  document.getElementById('dashboard-view').style.setProperty('display', 'none', 'important');
  document.getElementById('auth-view').style.setProperty('display', 'none', 'important');
  document.getElementById('landing-view').style.setProperty('display', 'flex', 'important');
}

async function loadServers() {
  try {
    const res = await fetch('/api/dashboard/servers');
    if (!res.ok) {
      document.getElementById('landing-view').style.setProperty('display', 'flex', 'important');
      document.getElementById('dashboard-view').style.setProperty('display', 'none', 'important');
      document.getElementById('auth-view').style.setProperty('display', 'none', 'important');
      return;
    }
    const servers = await res.json();
    
    // Authenticated! Show dashboard.
    document.getElementById('landing-view').style.setProperty('display', 'none', 'important');
    document.getElementById('auth-view').style.setProperty('display', 'none', 'important');
    document.getElementById('dashboard-view').style.setProperty('display', 'flex', 'important');
    
    const grid = document.getElementById('servers-grid');
    grid.innerHTML = '';

    if (servers.length === 0) {
      grid.innerHTML = '<div class="col-12 text-muted">No servers found. Create one to get started!</div>';
      return;
    }

    servers.forEach(server => {
      const isLinked = server.kickChannel ? true : false;
      const linkBadge = isLinked 
        ? `<span class="badge bg-secondary">Kick: @${server.kickChannel}</span>`
        : `<span class="badge bg-warning text-dark">Kick: Unlinked</span>`;

      const wsBadge = server.isConnected
        ? `<span class="badge bg-success">🟢 Online</span>`
        : `<span class="badge bg-danger">🔴 Offline</span>`;

      const card = document.createElement('div');
      card.className = 'col-md-6 col-lg-4';
      card.innerHTML = `
        <div class="card card-server h-100">
          <div class="card-body d-flex flex-column">
            <div class="d-flex justify-content-between align-items-start mb-3">
              <h5 class="card-title fw-bold mb-0">${server.name}</h5>
              <div class="d-flex flex-column align-items-end gap-1">
                ${wsBadge}
                ${linkBadge}
              </div>
            </div>
            
            <div class="mb-4">
              <label class="form-label small text-muted text-uppercase fw-bold mb-1">Plugin API Key</label>
              <div class="bg-light p-2 rounded text-monospace small border font-monospace text-break">${server.apiKey}</div>
            </div>
            
            <div class="d-flex justify-content-between align-items-center mb-4">
              <div class="form-check form-switch">
                <input class="form-check-input" type="checkbox" role="switch" id="switch-${server.id}" onchange="toggleEvents('${server.id}', this.checked)" ${server.eventsEnabled ? 'checked' : ''}>
                <label class="form-check-label small fw-semibold" for="switch-${server.id}">Game Events</label>
              </div>
              <button onclick="deleteServer('${server.id}')" class="btn btn-outline-danger btn-sm" title="Delete Server">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
              </button>
            </div>

            <div class="mt-auto border-top pt-3">
              <div class="d-flex justify-content-between align-items-center mb-3">
                <span class="small text-muted fw-medium">👥 ${server._count.linkedUsers} linked players</span>
                <a href="/api/kick/auth?serverId=${server.id}" target="_blank" class="btn btn-outline-primary btn-sm">
                  ${isLinked ? 'Re-link Kick' : 'Link Kick Channel'}
                </a>
              </div>
              <div class="d-flex gap-2">
                <button onclick="viewPlayers('${server.id}', '${server.name}')" class="btn btn-light btn-sm flex-fill fw-semibold border">Players</button>
                <button onclick="openActionsModal('${server.id}', '${server.name}')" class="btn btn-primary btn-sm flex-fill fw-semibold">Actions</button>
              </div>
            </div>
          </div>
        </div>
      `;
      grid.appendChild(card);
    });
  } catch (err) {
    console.error('Failed to load servers', err);
  }
}

function openNewServerModal() {
  newServerModal.show();
}

function closeNewServerModal() {
  newServerModal.hide();
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

async function viewPlayers(serverId, serverName) {
  document.getElementById('players-modal-title').textContent = `Linked Players - ${serverName}`;
  const tbody = document.getElementById('players-table-body');
  tbody.innerHTML = '<tr><td colspan="3" class="text-center py-4">Loading...</td></tr>';
  playersModal.show();

  try {
    const res = await fetch(`/api/dashboard/servers/${serverId}/users`);
    if (!res.ok) throw new Error('Failed to fetch players');
    const users = await res.json();

    tbody.innerHTML = '';
    if (users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" class="text-center py-4 text-muted">No linked players found.</td></tr>';
      return;
    }

    users.forEach(u => {
      const subBadge = u.isSubscriber 
        ? '<span class="badge bg-primary">Yes</span>' 
        : '<span class="badge bg-secondary text-dark">No</span>';
        
      tbody.innerHTML += `
        <tr>
          <td class="fw-medium">${u.kickUsername}</td>
          <td class="font-monospace small text-muted">${u.minecraftUuid}</td>
          <td>
            ${subBadge}
            <button class="btn btn-sm btn-outline-primary ms-2" style="padding: 0.1rem 0.4rem; font-size: 0.75rem;" onclick="togglePlayerSub('${serverId}', '${u.minecraftUuid}', '${serverName}')">Toggle</button>
          </td>
        </tr>
      `;
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="3" class="text-center py-4 text-danger">${err.message}</td></tr>`;
  }
}

async function togglePlayerSub(serverId, uuid, serverName) {
  try {
    const res = await fetch(`/api/dashboard/servers/${serverId}/users/${uuid}/toggle-sub`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error('Failed to toggle subscription status');
    
    // Refresh the modal
    viewPlayers(serverId, serverName);
  } catch (err) {
    alert(err.message);
  }
}

function closePlayersModal() {
  playersModal.hide();
}

// === ACTIONS ===
function openActionsModal(serverId, serverName) {
  document.getElementById('action-server-id').value = serverId;
  document.getElementById('actions-modal-title').textContent = `Actions for ${serverName}`;
  actionsModal.show();
  updateActionForm();
  loadActions(serverId);
}

function closeActionsModal() {
  actionsModal.hide();
}

function updateActionForm() {
  const eventType = document.getElementById('action-event-type').value;
  const actionType = document.getElementById('action-action-type').value;
  const conditionGroup = document.getElementById('action-condition-group');
  const conditionLabel = document.getElementById('action-condition-label');
  const conditionOperator = document.getElementById('action-condition-operator');
  const conditionInput = document.getElementById('action-condition');
  const payloadFields = document.getElementById('action-payload-fields');

  // Condition
  if (eventType === 'CHAT') {
    conditionGroup.style.display = 'block';
    conditionOperator.style.display = 'none';
    conditionLabel.textContent = 'Chat Keyword';
    conditionInput.type = 'text';
    conditionInput.placeholder = 'e.g. !creeper';
  } else if (eventType === 'SUB_GIFT') {
    conditionGroup.style.display = 'block';
    conditionOperator.style.display = 'block';
    conditionLabel.textContent = 'Gift Amount Condition';
    conditionInput.type = 'number';
    conditionInput.placeholder = 'e.g. 5';
    conditionInput.min = '1';
  } else {
    conditionGroup.style.display = 'none';
  }

  // Payload
  payloadFields.innerHTML = '';
  if (actionType === 'SPAWN_MOB') {
    payloadFields.innerHTML = `
      <div class="mb-3">
        <label class="form-label fw-semibold">Entity Type</label>
        <select class="form-select" id="payload-entity" required>
          <option value="CREEPER">Creeper</option>
          <option value="ZOMBIE">Zombie</option>
          <option value="SKELETON">Skeleton</option>
          <option value="SPIDER">Spider</option>
          <option value="ENDERMAN">Enderman</option>
          <option value="PIG">Pig</option>
          <option value="COW">Cow</option>
          <option value="SHEEP">Sheep</option>
          <option value="CHICKEN">Chicken</option>
          <option value="WARDEN">Warden</option>
        </select>
      </div>
      <div class="mb-3">
        <label class="form-label fw-semibold">Amount</label>
        <input type="number" class="form-control" id="payload-amount" value="1" min="1" max="100" required>
      </div>
    `;
  } else if (actionType === 'GIVE_ITEM') {
    payloadFields.innerHTML = `
      <div class="mb-3">
        <label class="form-label fw-semibold">Item Material</label>
        <select class="form-select" id="payload-item" required>
          <option value="DIAMOND">Diamond</option>
          <option value="EMERALD">Emerald</option>
          <option value="IRON_INGOT">Iron Ingot</option>
          <option value="GOLD_INGOT">Gold Ingot</option>
          <option value="NETHERITE_INGOT">Netherite Ingot</option>
          <option value="DIRT">Dirt</option>
          <option value="COBBLESTONE">Cobblestone</option>
          <option value="ENCHANTED_GOLDEN_APPLE">Enchanted Golden Apple</option>
        </select>
      </div>
      <div class="mb-3">
        <label class="form-label fw-semibold">Amount</label>
        <input type="number" class="form-control" id="payload-amount" value="1" min="1" max="64" required>
      </div>
    `;
  } else if (actionType === 'EXECUTE_COMMAND') {
    payloadFields.innerHTML = `
      <div class="mb-3">
        <label class="form-label fw-semibold">Command</label>
        <input type="text" class="form-control" id="payload-command" placeholder="e.g. kick %streamer%" required>
        <div class="form-text small">Variables: %streamer%, %sender%</div>
      </div>
    `;
  } else if (actionType === 'DROP_HOTBAR') {
    payloadFields.innerHTML = `<span class="small text-muted">No additional configuration required.</span>`;
  }
}

async function loadActions(serverId) {
  const tbody = document.getElementById('actions-table-body');
  tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4">Loading...</td></tr>';
  
  try {
    const res = await fetch(`/api/dashboard/servers/${serverId}/actions`);
    if (res.status === 401) return logout();
    const actions = await res.json();
    
    tbody.innerHTML = '';
    if (actions.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-muted">No actions configured.</td></tr>';
      return;
    }
    
    actions.forEach(action => {
      const tr = document.createElement('tr');
      
      const evtBadge = action.eventType === 'CHAT' ? '<span class="badge bg-secondary">💬 Chat</span>' 
                   : action.eventType === 'SUB_NEW' ? '<span class="badge bg-primary">⭐ Sub</span>' 
                   : '<span class="badge bg-info text-dark">🎁 Gifts</span>';
                   
      let pl = '';
      try {
        const parsed = JSON.parse(action.payload);
        if (action.actionType === 'SPAWN_MOB') pl = `${parsed.amount}x ${parsed.entity}`;
        else if (action.actionType === 'GIVE_ITEM') pl = `${parsed.amount}x ${parsed.item}`;
        else if (action.actionType === 'EXECUTE_COMMAND') pl = `/${parsed.command}`;
      } catch (e) {}

      tr.innerHTML = `
        <td>${evtBadge}</td>
        <td class="fw-semibold text-primary">${action.condition || '-'}</td>
        <td>
          <div class="fw-bold">${action.actionType}</div>
          <div class="small text-muted">${pl}</div>
        </td>
        <td class="text-end">
          <button onclick="deleteAction('${serverId}', '${action.id}')" class="btn btn-outline-danger btn-sm" title="Delete">❌</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Failed to load actions', err);
    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-danger">Error loading actions.</td></tr>';
  }
}

async function handleAddAction(e) {
  e.preventDefault();
  const serverId = document.getElementById('action-server-id').value;
  const eventType = document.getElementById('action-event-type').value;
  const actionType = document.getElementById('action-action-type').value;
  let condition = document.getElementById('action-condition').value;
  
  if (eventType === 'SUB_NEW') {
    condition = null;
  } else if (eventType === 'SUB_GIFT') {
    const op = document.getElementById('action-condition-operator').value;
    condition = op + condition;
  }

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
