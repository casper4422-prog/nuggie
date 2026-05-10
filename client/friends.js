// Friends page — all API calls use apiRequest() so they hit the correct backend
function esc(s) { return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

async function loadFriendsPage() {
    setActiveNavButton('friends');
    const main = document.getElementById('appMainContent');
    if (!main) return;
    main.innerHTML = `<div class="std-page"><div style="color:#94a3b8;padding:40px 0">Establishing network link...</div></div>`;

    const [friends, incoming, sent, onlineData] = await Promise.all([
        apiRequest('/api/friends?status=accepted').then(r => Array.isArray(r.body) ? r.body : []).catch(() => []),
        apiRequest('/api/friends?status=pending').then(r => Array.isArray(r.body) ? r.body : []).catch(() => []),
        apiRequest('/api/friends?status=sent').then(r => Array.isArray(r.body) ? r.body : []).catch(() => []),
        apiRequest('/api/users/online').then(r => r.body || {}).catch(() => ({}))
    ]);
    const onlineIds = new Set(Array.isArray(onlineData.online_ids) ? onlineData.online_ids : []);

    main.innerHTML = `
        <div class="std-page">
            <div class="std-page-header">
                <div class="page-title">
                    <h1>👥 Network</h1>
                    <div class="page-subtitle">${friends.length} survivor${friends.length !== 1 ? "s" : ""} connected</div>
                </div>
            </div>

            <!-- Search -->
            <div class="friends-search-bar">
                <input id="friendSearchInput" class="form-control search-input" placeholder="🔍 Search users by name, email, or Discord...">
                <button class="btn btn-primary" onclick="friendsDoSearch()">Search</button>
            </div>
            <div id="friendSearchResults"></div>

            <!-- Incoming requests -->
            ${incoming.length ? `
            <div class="friends-section">
                <h2 class="friends-section-title">📬 Incoming Link Requests <span class="friends-badge">${incoming.length}</span></h2>
                <div class="friends-list" id="incomingList">
                    ${incoming.map(r => friendRequestCard(r, 'incoming')).join('')}
                </div>
            </div>` : ''}

            <!-- Sent requests -->
            ${sent.length ? `
            <div class="friends-section">
                <h2 class="friends-section-title">📤 Pending Outbound</h2>
                <div class="friends-list">
                    ${sent.map(r => friendRequestCard(r, 'sent')).join('')}
                </div>
            </div>` : ''}

            <!-- Friends list -->
            <div class="friends-section">
                <h2 class="friends-section-title">👥 Your Network</h2>
                <div class="friends-list" id="friendsList">
                    ${friends.length
                        ? friends.map(f => friendCard(f, onlineIds)).join('')
                        : '<div class="friends-empty">No network connections. Search for survivors above to connect.</div>'
                    }
                </div>
            </div>
        </div>`;

    document.getElementById('friendSearchInput')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') friendsDoSearch();
    });
}

function friendCard(f, onlineIds) {
    const isOnline = onlineIds instanceof Set ? onlineIds.has(f.friend_id) : false;
    return `
        <div class="friend-card" id="friend-${f.id}">
            <div class="friend-avatar-wrap" style="position:relative">
                <div class="friend-avatar">👤</div>
                <span class="online-dot ${isOnline ? 'online' : 'offline'}" title="${isOnline ? 'Online' : 'Offline'}"></span>
            </div>
            <div class="friend-info">
                <div class="friend-name">${esc(f.friend_nickname || f.friend_email) || 'Unknown'}</div>
                ${f.friend_discord_name ? `<div class="friend-meta">Discord: ${esc(f.friend_discord_name)}</div>` : ''}
                <div class="friend-status-label ${isOnline ? 'online' : ''}">${isOnline ? '● Online' : '○ Offline'}</div>
            </div>
            <div class="friend-actions">
                <button class="btn btn-secondary btn-sm" onclick="openDMThread(${f.friend_id}, '${(f.friend_nickname || f.friend_email || 'Friend').replace(/'/g, "\\'")}')">💬 Message</button>
                <button class="btn btn-secondary btn-sm" onclick="friendViewCreatures(${f.friend_id}, '${(f.friend_nickname || f.friend_email || 'Friend').replace(/'/g, "\\'")}')">🦖 Creatures</button>
                <button class="btn btn-danger btn-sm" onclick="friendRemove(${f.id})">Remove</button>
            </div>
        </div>`;
}

function friendRequestCard(r, type) {
    if (type === 'incoming') {
        return `
        <div class="friend-card" id="freq-${r.id}">
            <div class="friend-avatar">👤</div>
            <div class="friend-info">
                <div class="friend-name">${esc(r.friend_nickname || r.friend_email) || 'Unknown'}</div>
                ${r.friend_discord_name ? `<div class="friend-meta">Discord: ${esc(r.friend_discord_name)}</div>` : ''}
            </div>
            <div class="friend-actions">
                <button class="btn btn-primary btn-sm" onclick="friendRespond(${r.id}, 'accept')">Accept</button>
                <button class="btn btn-danger btn-sm" onclick="friendRespond(${r.id}, 'reject')">Decline</button>
            </div>
        </div>`;
    }
    return `
        <div class="friend-card" id="freq-${r.id}">
            <div class="friend-avatar">👤</div>
            <div class="friend-info">
                <div class="friend-name">${esc(r.friend_nickname || r.friend_email) || 'Unknown'}</div>
                <div class="friend-meta">Waiting for response...</div>
            </div>
            <div class="friend-actions">
                <button class="btn btn-secondary btn-sm" onclick="friendCancel(${r.id})">Cancel</button>
            </div>
        </div>`;
}

// ── Search ───────────────────────────────────────────────────────────
async function friendsDoSearch() {
    const q = document.getElementById('friendSearchInput')?.value.trim();
    const resultsDiv = document.getElementById('friendSearchResults');
    if (!resultsDiv) return;
    if (!q) { resultsDiv.innerHTML = ''; return; }

    resultsDiv.innerHTML = '<div class="friends-loading">Searching...</div>';
    const { res, body } = await apiRequest(`/api/users/search?q=${encodeURIComponent(q)}`);

    if (!res.ok || !Array.isArray(body) || !body.length) {
        resultsDiv.innerHTML = '<div class="friends-empty" style="margin-bottom:16px">No users found.</div>';
        return;
    }

    resultsDiv.innerHTML = `
        <div class="friends-section">
            <h2 class="friends-section-title">Search Results</h2>
            <div class="friends-list">
                ${body.map(u => `
                <div class="friend-card">
                    <div class="friend-avatar">👤</div>
                    <div class="friend-info">
                        <div class="friend-name">${esc(u.nickname || u.email)}</div>
                        ${u.discord_name ? `<div class="friend-meta">Discord: ${esc(u.discord_name)}</div>` : ''}
                    </div>
                    <div class="friend-actions">
                        ${u.friend_status === 'accepted'
                            ? `<span class="friend-status-tag accepted">✓ Friends</span>`
                            : u.friend_status === 'pending'
                            ? `<span class="friend-status-tag pending">Request Pending</span>`
                            : `<button class="btn btn-primary btn-sm" onclick="friendSendRequest(${u.id}, this)">Add Friend</button>`
                        }
                    </div>
                </div>`).join('')}
            </div>
        </div>`;
}
window.friendsDoSearch = friendsDoSearch;

// ── Actions ──────────────────────────────────────────────────────────
async function friendSendRequest(userId, btn) {
    if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }
    const { res, body } = await apiRequest('/api/friends/request', {
        method: 'POST', body: JSON.stringify({ friend_user_id: userId })
    });
    if (res.ok) {
        if (btn) { btn.textContent = 'Request Sent'; btn.className = 'btn btn-secondary btn-sm'; }
    } else {
        if (btn) { btn.disabled = false; btn.textContent = 'Add Friend'; }
        alert(body?.error || 'Failed to send friend request.');
    }
}
window.friendSendRequest = friendSendRequest;

async function friendRespond(friendshipId, action) {
    const { res, body } = await apiRequest(`/api/friends/${friendshipId}`, {
        method: 'PUT', body: JSON.stringify({ action })
    });
    if (res.ok) {
        loadFriendsPage();
    } else {
        alert(body?.error || 'Failed to respond to request.');
    }
}
window.friendRespond = friendRespond;

async function friendCancel(friendshipId) {
    if (!confirm('Cancel this friend request?')) return;
    const { res, body } = await apiRequest(`/api/friends/${friendshipId}`, { method: 'DELETE' });
    if (res.ok) {
        loadFriendsPage();
    } else {
        alert(body?.error || 'Failed to cancel request.');
    }
}
window.friendCancel = friendCancel;

async function friendRemove(friendshipId) {
    if (!confirm('Remove this friend?')) return;
    const { res, body } = await apiRequest(`/api/friends/${friendshipId}`, { method: 'DELETE' });
    if (res.ok) {
        const el = document.getElementById(`friend-${friendshipId}`);
        if (el) el.remove();
    } else {
        alert(body?.error || 'Failed to remove friend.');
    }
}
window.friendRemove = friendRemove;

// ── View Friend's Creatures ───────────────────────────────────────────
async function friendViewCreatures(userId, name) {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:680px">
            <div class="modal-header">
                <h2 class="modal-title">🦖 ${name}'s Nuggies</h2>
                <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="modal-body" id="friendCreaturesBody">
                <div style="color:#94a3b8">Loading...</div>
            </div>
        </div>`;
    document.body.appendChild(modal);

    const { res, body } = await apiRequest(`/api/users/${userId}/creatures`);
    const bodyEl = document.getElementById('friendCreaturesBody');
    if (!bodyEl) return;

    if (!res.ok || !Array.isArray(body) || !body.length) {
        bodyEl.innerHTML = '<div style="color:#64748b;padding:20px 0">No creatures yet.</div>';
        return;
    }

    bodyEl.innerHTML = `<div class="friend-creatures-grid">
        ${body.map(c => {
            const bs = c.baseStats || {};
            const muts = c.mutations || {};
            const dom = c.domesticLevels || {};
            const totalMuts = Object.values(muts).reduce((a, b) => a + b, 0);
            const badges = (window.BadgeSystem && typeof window.BadgeSystem.generateBadgeHTML === 'function')
                ? window.BadgeSystem.generateBadgeHTML(c) : '';
            return `
            <div class="friend-creature-card">
                <div class="friend-creature-header">
                    <div>
                        <div class="friend-creature-name">${c.name || 'Unnamed'}</div>
                        <div class="friend-creature-species">${c.species || '?'} · Lvl ${c.level || 1} · ${c.gender || '?'}</div>
                    </div>
                    ${badges ? `<div>${badges}</div>` : ''}
                </div>
                <div class="friend-creature-stats">
                    <div class="fc-stat"><span>❤️ HP</span><strong>${bs.Health||0}</strong></div>
                    <div class="fc-stat"><span>⚡ Stam</span><strong>${bs.Stamina||0}</strong></div>
                    <div class="fc-stat"><span>🍖 Food</span><strong>${bs.Food||0}</strong></div>
                    <div class="fc-stat"><span>🏋️ Wgt</span><strong>${bs.Weight||0}</strong></div>
                    <div class="fc-stat"><span>⚔️ Mel</span><strong>${bs.Melee||0}</strong></div>
                    <div class="fc-stat"><span>🧬 Muts</span><strong>${totalMuts}</strong></div>
                </div>
                ${c.notes ? `<div class="friend-creature-notes">${c.notes}</div>` : ''}
            </div>`;
        }).join('')}
    </div>`;
}
window.friendViewCreatures = friendViewCreatures;

// Legacy exports (kept for any remaining references in other files)
window.loadFriendsPage = loadFriendsPage;
window.sendFriendRequest = friendSendRequest;
window.removeFriend = friendRemove;
window.respondToFriendRequest = friendRespond;
window.viewFriendCreatures = friendViewCreatures;
