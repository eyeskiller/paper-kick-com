const loginScreen = document.getElementById('login-screen');
const dashboard = document.getElementById('dashboard');
const passwordInput = document.getElementById('admin-password');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const loginError = document.getElementById('login-error');

const statServers = document.getElementById('stat-servers');
const statUsers = document.getElementById('stat-users');
const statUptime = document.getElementById('stat-uptime');
const serversBody = document.getElementById('servers-body');

let token = localStorage.getItem('kick_admin_token') || null;
let pollInterval = null;

if (token) {
    showDashboard();
}

loginBtn.addEventListener('click', async () => {
    const pwd = passwordInput.value;
    if (!pwd) return;
    
    loginBtn.textContent = 'Authenticating...';
    
    try {
        const res = await fetch('/api/admin/stats', {
            headers: { 'Authorization': pwd }
        });
        
        if (res.ok) {
            token = pwd;
            localStorage.setItem('kick_admin_token', token);
            showDashboard();
        } else {
            loginError.textContent = "Invalid password.";
        }
    } catch (err) {
        loginError.textContent = "Connection error.";
    } finally {
        loginBtn.textContent = 'Login';
    }
});

passwordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') loginBtn.click();
});

logoutBtn.addEventListener('click', () => {
    token = null;
    localStorage.removeItem('kick_admin_token');
    clearInterval(pollInterval);
    loginScreen.classList.add('active');
    dashboard.classList.remove('active');
    passwordInput.value = '';
    loginError.textContent = '';
});

function showDashboard() {
    loginScreen.classList.remove('active');
    dashboard.classList.add('active');
    fetchStats();
    pollInterval = setInterval(fetchStats, 5000);
}

function formatUptime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h}h ${m}m ${s}s`;
}

async function fetchStats() {
    if (!token) return;
    
    try {
        const res = await fetch('/api/admin/stats', {
            headers: { 'Authorization': token }
        });
        
        if (res.status === 401) {
            logoutBtn.click();
            return;
        }
        
        const data = await res.json();
        
        statServers.textContent = data.activeConnections.length;
        statUsers.textContent = data.totalUsers;
        statUptime.textContent = formatUptime(data.uptime);
        
        serversBody.innerHTML = '';
        if (data.activeConnections.length === 0) {
            serversBody.innerHTML = `<tr><td colspan="4" style="text-align:center; color: #8b92a5">No servers connected</td></tr>`;
        } else {
            data.activeConnections.forEach(conn => {
                const date = new Date(conn.connectedAt).toLocaleString();
                serversBody.innerHTML += `
                    <tr>
                        <td style="color: var(--kick-green); font-weight: 600;">${conn.streamer || 'Unknown'}</td>
                        <td>${conn.ip}</td>
                        <td>${date}</td>
                        <td><span class="status-badge">Online</span></td>
                    </tr>
                `;
            });
        }
    } catch (err) {
        console.error("Failed to fetch stats", err);
    }
}
