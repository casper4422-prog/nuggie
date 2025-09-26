// Begin main application logic
// We'll set the readiness marker only after our exact theme CSS is loaded
// to avoid the original UI flashing and then being overlapped by the injected UI.

function renderRegisterForm() {
    const registerPage = document.getElementById('registerPage');
    if (!registerPage) return;
    registerPage.innerHTML = `
        <div class="register-container">
            <h1 class="register-title">Create Account</h1>
            <form id="registerForm">
                <div class="form-group">
                    <label class="form-label" for="registerEmail">Email</label>
                    <input class="form-control" id="registerEmail" type="email" required autocomplete="email" placeholder="you@example.com">
                </div>
                <div class="form-group">
                    <label class="form-label" for="registerNickname">Nickname (optional)</label>
                    <input class="form-control" id="registerNickname" type="text" autocomplete="nickname" placeholder="Your display name">
                </div>
                <div class="form-group">
                    <label class="form-label" for="registerDiscord">Discord Name (optional)</label>
                    <input class="form-control" id="registerDiscord" type="text" placeholder="Your Discord username">
                </div>
                <div class="form-group">
                    <label class="form-label" for="registerPassword">Password</label>
                    <input class="form-control" id="registerPassword" type="password" required autocomplete="new-password">
                </div>
                <button type="submit" class="btn btn-primary register-btn">Register</button>
            </form>
            <div class="register-link">Already have an account? <a href="#" id="showLoginLink">Login</a></div>
            <div id="registerError" class="register-error" role="status" aria-live="polite"></div>
        </div>
    `;
    
    // Add event listeners
    const form = document.getElementById('registerForm');
    const showLoginLink = document.getElementById('showLoginLink');
    
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('registerEmail')?.value;
            const nickname = document.getElementById('registerNickname')?.value;
            const discord = document.getElementById('registerDiscord')?.value;
            const password = document.getElementById('registerPassword')?.value;
            const errorDiv = document.getElementById('registerError');
            
            if (!email || !password) {
                if (errorDiv) errorDiv.textContent = 'Please fill out all required fields';
                return;
            }
            
            try {
                const res = await fetch('/api/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password, nickname, discord_name: discord })
                });
                const data = await res.json();
                
                if (res.ok) {
                    // Store credentials and show main app
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('userId', data.userId);
                    if (data.email) localStorage.setItem('userEmail', data.email);
                    if (data.nickname) localStorage.setItem('userNickname', data.nickname);
                    showMainApp();
                } else {
                    if (errorDiv) errorDiv.textContent = data.error || 'Registration failed';
                }
            } catch (err) {
                console.error('Registration error:', err);
                if (errorDiv) errorDiv.textContent = 'Registration failed. Please try again.';
            }
        });
    }
    
    if (showLoginLink) {
        showLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            showLoginPage();
        });
    }
}

// --- SPA Logic and Event Handlers (migrated from index.html) ---
function showLoginPage() {
	console.log('[SPA] showLoginPage called');
	const landing = document.getElementById('landingPage');
	const register = document.getElementById('registerPage');
	const mainApp = document.getElementById('mainApp');
	// If any of the main containers are missing, log and abort gracefully
	if (!landing || !register || !mainApp) {
		console.error('[SPA] One or more main containers missing:', { landing, register, mainApp });
		return;
	}
	// Show landing/login, hide register and main app content
	try {
		landing.classList.remove('hidden'); landing.style.display = '';
		landing.setAttribute('aria-hidden', 'false');
	} catch (e) {}
	try {
		register.classList.add('hidden'); register.style.display = 'none'; register.setAttribute('aria-hidden', 'true');
	} catch (e) {}
	try {
		mainApp.classList.add('hidden'); mainApp.style.display = 'none'; mainApp.setAttribute('aria-hidden', 'true');
	} catch (e) {}
	// If there's a login form, focus first field
	try { const f = document.getElementById('loginEmail') || document.getElementById('loginForm')?.querySelector('input'); if (f) f.focus(); } catch (e) {}
}

// Show the register page
function showRegisterPage() {
	try {
		const landing = document.getElementById('landingPage');
		const register = document.getElementById('registerPage');
		const mainApp = document.getElementById('mainApp');
		if (landing) { landing.classList.add('hidden'); landing.style.display = 'none'; landing.setAttribute('aria-hidden','true'); }
		if (mainApp) { mainApp.classList.add('hidden'); mainApp.style.display = 'none'; mainApp.setAttribute('aria-hidden','true'); }
		if (register) { register.classList.remove('hidden'); register.style.display = ''; register.setAttribute('aria-hidden','false'); }
		try { const f = document.getElementById('registerEmail') || register?.querySelector('input'); if (f) f.focus(); } catch (e) {}
	} catch (e) { console.warn('showRegisterPage failed', e); }
}
window.showRegisterPage = showRegisterPage;

function isLoggedIn() {
	try {
		const token = localStorage.getItem('token');
		if (!token) return false;
		const parts = token.split('.');
		return parts.length === 3;
	} catch (e) { return false; }
}

// Show main application UI (called after successful login)
function showMainApp() {
	try {
		const landing = document.getElementById('landingPage');
		const register = document.getElementById('registerPage');
		const mainApp = document.getElementById('mainApp');
		if (landing) { landing.classList.add('hidden'); landing.style.display = 'none'; landing.setAttribute('aria-hidden', 'true'); }
		if (register) { register.classList.add('hidden'); register.style.display = 'none'; register.setAttribute('aria-hidden', 'true'); }
		if (mainApp) { mainApp.classList.remove('hidden'); mainApp.style.display = ''; mainApp.setAttribute('aria-hidden', 'false'); }
		// Ensure the app main content exists
		const appMain = document.getElementById('appMainContent');
		if (appMain) appMain.style.display = '';
	} catch (e) { console.warn('showMainApp failed', e); }
}
window.showMainApp = showMainApp;
function handleAuthClick() {
	if (isLoggedIn()) {
		localStorage.removeItem('token');
		showLoginPage();
		try { updateAuthUI(); } catch (e) {}
	}
}
window.handleAuthClick = handleAuthClick;

function updateTribeHeader() {
	// Replace with actual tribe name from user profile if available
	const tribeName = localStorage.getItem('tribeName') || 'My Tribe';
	try {
		const el = document.getElementById('tribeHeader');
		if (el) el.textContent = tribeName;
	} catch (e) {
		console.warn('[SPA] updateTribeHeader failed', e);
	}
}
function goToCreatures() {
	loadSpeciesPage();
}
function goToMyNuggies() {
	loadMyNuggiesPage();
}
function goToTrading() {
	loadTradingPage();
}
window.goToTrading = goToTrading;
function goToBossPlanner() { loadBossPlanner(); }
window.goToBossPlanner = goToBossPlanner;
function goToMyProfile() { loadMyProfile(); }
// Profile page
function loadMyProfile() {
    const main = document.getElementById('appMainContent');
    if (!main) return;

    // Get user info from localStorage
    const userId = localStorage.getItem('userId');
    const email = localStorage.getItem('userEmail');
    const nickname = localStorage.getItem('userNickname');
    const token = localStorage.getItem('token');

    if (!userId || !token) {
        showLoginPage();
        return;
    }

    main.innerHTML = `
        <section class="profile-page">
            <div class="page-header">
                <h1>My Profile</h1>
                <div class="section-sub">Manage your account settings and preferences</div>
            </div>
            <div class="profile-content">
                <div class="profile-info">
                    <div class="info-group">
                        <label>Email</label>
                        <div class="info-value">${email || 'Not set'}</div>
                    </div>
                    <div class="info-group">
                        <label>Nickname</label>
                        <div class="info-value">${nickname || 'Not set'}</div>
                    </div>
                    <div class="info-group">
                        <label>User ID</label>
                        <div class="info-value">${userId}</div>
                    </div>
                </div>
                <div class="profile-actions">
                    <button id="logoutBtn" class="btn btn-danger">Logout</button>
                </div>
            </div>
        </section>
    `;

    // Add logout handler
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        localStorage.clear();
        showLoginPage();
    });
}

window.goToMyProfile = goToMyProfile;
window.goToCreatures = goToCreatures;
window.goToMyNuggies = goToMyNuggies;

document.addEventListener('DOMContentLoaded', () => {
	console.log('[SPA] DOMContentLoaded fired');

	// Helper: resolve base path for assets relative to this script
	function resolveBasePath() {
		try {
			var cur = document.currentScript && document.currentScript.src;
			if (!cur) {
				var scripts = document.getElementsByTagName('script');
				cur = scripts[scripts.length-1] && scripts[scripts.length-1].src;
			}
			if (!cur) return './';
			return cur.replace(/\/[^/]*$/, '/');
		} catch (e) { return './'; }
	}

	// Load a stylesheet and return a promise resolved on load or after timeout
	function loadStylesheet(href, timeoutMs = 2000) {
		return new Promise((resolve) => {
			try {
				var link = document.createElement('link');
				link.rel = 'stylesheet';
				link.href = href;
				var done = false;
				link.onload = function() { if (!done) { done = true; resolve(true); } };
				link.onerror = function() { if (!done) { done = true; resolve(false); } };
				document.head.appendChild(link);
				setTimeout(() => { if (!done) { done = true; resolve(false); } }, timeoutMs);
			} catch (e) { resolve(false); }
		});
	}

	// Header is provided statically in index.html; runtime injection removed.

	// Compute base and load the exact theme CSS before revealing UI to avoid overlap
	(async function prepareTheme() {
		const base = resolveBasePath();
		const cssHref = base + 'theme-exact.css';
		console.log('[SPA] loading exact theme from', cssHref);
		const ok = await loadStylesheet(cssHref, 2500);
		if (!ok) console.warn('[SPA] theme-exact.css failed to load or timed out:', cssHref);
		// Apply class that scopes the exact theme
		try { document.documentElement.classList.add('theme-exact'); } catch (e) {}
	// Header is static; no runtime injection required here
		// Now mark the document ready so CSS guard un-hides content with new styling
		try { document.documentElement.setAttribute('data-ready', 'true'); } catch (e) {}
		try { document.documentElement.style.visibility = ''; } catch (e) {}
	})();
	try {
		// Attach UI wiring
		// Ensure register form markup exists so its handlers can be attached when needed
		try { renderRegisterForm(); } catch (e) {}
		// Quick stats render if user is already logged in
		try { updateStatsDashboard(); } catch (e) {}
		try {
			const loginForm = document.getElementById('loginForm');
			if (loginForm) loginForm.addEventListener('submit', handleLogin);
			const showReg = document.getElementById('showRegisterLink');
			if (showReg) showReg.addEventListener('click', (e) => { e.preventDefault(); showRegisterPage(); });
			const authBtn = document.getElementById('authBtn');
			if (authBtn) authBtn.addEventListener('click', handleAuthClick);
			const openTribeManagerBtn = document.getElementById('openTribeManagerBtn');
			if (openTribeManagerBtn) openTribeManagerBtn.addEventListener('click', (e) => { e.preventDefault(); if (typeof loadTribeManagerPage === 'function') { loadTribeManagerPage(); } });
			const goToBossPlannerBtn = document.getElementById('goToBossPlannerBtn');
			if (goToBossPlannerBtn) goToBossPlannerBtn.addEventListener('click', (e) => { e.preventDefault(); if (typeof goToBossPlanner === 'function') goToBossPlanner(); });
			const goToMyProfileBtn = document.getElementById('goToMyProfileBtn');
			if (goToMyProfileBtn) goToMyProfileBtn.addEventListener('click', (e) => { e.preventDefault(); if (typeof goToMyProfile === 'function') goToMyProfile(); });
			const goToFriendsBtn = document.getElementById('goToFriendsBtn');
			if (goToFriendsBtn) goToFriendsBtn.addEventListener('click', (e) => { e.preventDefault(); if (typeof loadFriendsPage === 'function') loadFriendsPage(); });
			const goToCreaturesBtn = document.getElementById('goToCreaturesBtn');
			if (goToCreaturesBtn) goToCreaturesBtn.addEventListener('click', goToCreatures);
			const goToMyNuggiesBtn = document.getElementById('goToMyNuggiesBtn');
			if (goToMyNuggiesBtn) goToMyNuggiesBtn.addEventListener('click', goToMyNuggies);
			const goToTradingBtn = document.getElementById('goToTradingBtn');
			if (goToTradingBtn) goToTradingBtn.addEventListener('click', goToTrading);
			// Notifications button (may be present in header)
			let notificationsBtn = document.getElementById('notificationsBtn');
			// If header doesn't include a dedicated notifications button, create one in the header area
			if (!notificationsBtn) {
				const headerArea = document.querySelector('.header-content') || document.querySelector('header') || document.body;
				if (headerArea) {
					notificationsBtn = document.createElement('button');
					notificationsBtn.id = 'notificationsBtn';
					notificationsBtn.className = 'btn btn-secondary';
					notificationsBtn.setAttribute('aria-label', 'Inbox');
					notificationsBtn.style.marginLeft = '8px';
					notificationsBtn.innerHTML = 'Inbox <span id="inboxBadge" style="background:#e11d48;color:white;border-radius:10px;padding:2px 6px;font-size:12px;margin-left:6px;display:none">0</span>';
					// Prefer inserting after Boss Planner button and before Sign Out (authBtn)
					const bpBtn = document.getElementById('goToBossPlannerBtn');
					const authBtnEl = document.getElementById('authBtn');
					if (bpBtn && bpBtn.parentNode) {
						bpBtn.parentNode.insertBefore(notificationsBtn, bpBtn.nextSibling);
					} else if (authBtnEl && authBtnEl.parentNode) {
						authBtnEl.parentNode.insertBefore(notificationsBtn, authBtnEl);
					} else {
						const target = headerArea.querySelector('.header-controls') || headerArea;
						target.appendChild(notificationsBtn);
					}
				}
			}
			if (notificationsBtn) notificationsBtn.addEventListener('click', async (e) => { e.preventDefault(); loadInboxPage(); });
		} catch (wireErr) {
			console.warn('[SPA] UI wiring failed', wireErr);
		}

		if (isLoggedIn()) {
			console.log('[SPA] User is logged in');
			showMainApp();
			updateTribeHeader();
			loadSpeciesPage(); // Default page after login
		} else {
			console.log('[SPA] User is NOT logged in');
			showLoginPage();
		}
	} catch (e) {
		console.error('[SPA] Error during DOMContentLoaded init:', e);
	}
});

// Tribe modal and legacy modal-based settings removed. Use the new Tribe Manager page.

// New Tribe Manager page loader: implement robust tribe features here.
function loadTribeManagerPage() {
	const main = document.getElementById('appMainContent');
	if (!main) return;
	main.innerHTML = `
		<section class="tribe-manager-page">
			<div class="page-header"><h1>Tribe Manager</h1><div class="section-sub">Create, manage and configure tribes (owner/admin tools)</div></div>
			<div style="margin-top:12px;">
				<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;"><input id="tribeSearch" class="form-control" placeholder="Search tribes" style="flex:1;min-width:260px;"><button id="createTribeBtn" class="btn btn-primary">Create Tribe</button></div>
				<div id="tribeList" class="species-grid"></div>
				<div id="tribeDetail" style="margin-top:12px;border-top:1px solid rgba(255,255,255,0.03);padding-top:12px;"></div>
			</div>
		</section>
	`;
	document.getElementById('tribeSearch')?.addEventListener('input', debounce(fetchAndRenderTribes, 220));
	document.getElementById('createTribeBtn')?.addEventListener('click', () => {
		if (!isLoggedIn()) { alert('Please sign in to create a tribe'); return; }
		openTribeModal({ mode: 'create' });
	});
	fetchAndRenderTribes();

	// Reuse existing fetchAndRenderTribes from earlier code (should be present in file)
}
// End of fetchAndRenderTrades or trading section

window.loadTribeManagerPage = loadTribeManagerPage;

// Small helper to escape user-provided text before inserting into innerHTML
function escapeHtml(s) {
	if (s === null || s === undefined) return '';
	return String(s).replace(/[&<>"']/g, function(c) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]); });
}

// Fetch tribes from server (public) and render into the tribe manager list.
async function fetchAndRenderTribes() {
	try {
		const listEl = document.getElementById('tribeList');
		const detailEl = document.getElementById('tribeDetail');
		if (!listEl) return;
		if (detailEl) detailEl.innerHTML = '';
		const q = (document.getElementById('tribeSearch')?.value || '').trim();
		const path = '/api/tribes' + (q ? ('?q=' + encodeURIComponent(q)) : '');
		const { res, body } = await apiRequest(path, { method: 'GET' });
		if (!res.ok) {
			listEl.innerHTML = '<div class="no-species-found">Failed to load tribes</div>';
			return;
		}
		const items = Array.isArray(body) ? body : [];
		if (items.length === 0) {
			listEl.innerHTML = '<div class="no-species-found">No tribes found</div>';
			return;
		}
		listEl.innerHTML = '';
		items.forEach(t => {
			try {
				const card = document.createElement('div');
				card.className = 'species-card';
				card.tabIndex = 0;
				card.innerHTML = `<div class="species-card-header"><div class="species-icon">🏛️</div><div class="species-info"><div class="species-name">${escapeHtml(t.name)}</div><div class="species-meta">${escapeHtml(t.description||'')}</div></div></div>`;
				card.addEventListener('click', () => showTribeDetail(t));
				listEl.appendChild(card);
			} catch (e) { console.warn('render tribe item failed', e); }
		});
	} catch (e) { console.warn('fetchAndRenderTribes failed', e); }
}

// Show tribe details in the detail pane and provide a Join action when appropriate
async function showTribeDetail(t) {
	try {
		const detail = document.getElementById('tribeDetail');
		if (!detail) return;
		detail.innerHTML = `<h2>${escapeHtml(t.name)}</h2><div style="color:#94a3b8">${escapeHtml(t.description||'')}</div><div id="tribeMembers" style="margin-top:12px"></div><div style="margin-top:12px" id="tribeActions"></div>`;

		// Attach join button (uses modal for message)
		const actions = document.getElementById('tribeActions');
		if (actions) {
			const joinBtn = document.createElement('button');
			joinBtn.className = 'btn btn-primary';
			joinBtn.textContent = 'Request to Join';
			joinBtn.addEventListener('click', () => {
				if (!isLoggedIn()) { alert('Please sign in to request to join a tribe'); return; }
				openTribeModal({ mode: 'join', tribe: t });
			});
			actions.appendChild(joinBtn);
		}

		// Try to load members (requires auth). If not available, ignore.
		try {
			const { res, body } = await apiRequest('/api/tribes/' + t.id, { method: 'GET' });
			if (res.ok && body && Array.isArray(body.members)) {
				const mdiv = document.getElementById('tribeMembers');
				if (mdiv) {
					if (body.members.length === 0) mdiv.innerHTML = '<div class="no-species-found">No members</div>';
					else mdiv.innerHTML = '<h4>Members</h4>' + body.members.map(m => `<div>${escapeHtml(m.nickname || m.email || ('User ' + (m.user_id || '')))} — ${escapeHtml(m.role||'member')}</div>`).join('');
				}
			}
		} catch (e) { /* ignore member load failures when unauthenticated */ }
	} catch (e) { console.warn('showTribeDetail failed', e); }
}

// Expose for debugging/tests
window.fetchAndRenderTribes = fetchAndRenderTribes;
window.showTribeDetail = showTribeDetail;

// Modal helper for tribe actions (reuse #creatureModal container)
function closeTribeModal() {
	const modal = document.getElementById('creatureModal');
	if (!modal) return;
	modal.classList.remove('active');
	modal.setAttribute('aria-hidden', 'true');
	modal.innerHTML = '';
}

function openTribeModal(opts = {}) {
	// opts: { mode: 'create'|'join', tribe: {id,name} }
	const modal = document.getElementById('creatureModal');
	if (!modal) return alert('Modal container missing');
	modal.classList.add('active');
	modal.setAttribute('aria-hidden', 'false');
	if (opts.mode === 'create') {
		modal.innerHTML = `<div class="modal-content" style="max-width:520px;margin:20px auto;"><div class="modal-header"><h3>Create Tribe</h3><button id="closeTribeModalBtn" class="close-btn soft">Close</button></div><div class="modal-body"><div class="form-group"><label>Name</label><input id="tribeModalName" class="form-control"></div><div class="form-group"><label>Main Map (optional)</label><input id="tribeModalMap" class="form-control"></div><div class="form-group"><label>Description (optional)</label><textarea id="tribeModalDesc" class="form-control" rows="3"></textarea></div><div style="margin-top:10px;text-align:right"><button id="tribeModalCancel" class="btn btn-secondary">Cancel</button> <button id="tribeModalSubmit" class="btn btn-primary">Create</button></div></div></div>`;
		document.getElementById('closeTribeModalBtn')?.addEventListener('click', closeTribeModal);
		document.getElementById('tribeModalCancel')?.addEventListener('click', closeTribeModal);
		document.getElementById('tribeModalSubmit')?.addEventListener('click', async () => {
			const name = (document.getElementById('tribeModalName')?.value || '').trim();
			const main_map = (document.getElementById('tribeModalMap')?.value || '').trim() || null;
			const description = (document.getElementById('tribeModalDesc')?.value || '').trim() || null;
			if (!name) return alert('Please provide a tribe name');
			const { res, body } = await apiRequest('/api/tribes', { method: 'POST', body: JSON.stringify({ name, main_map, description }) });
			if (res && res.ok) {
				alert('Tribe created');
				closeTribeModal();
				fetchAndRenderTribes();
			} else {
				let msg = 'Failed to create tribe';
				try { if (body && body.error) msg = body.error; } catch (e) {}
				alert(msg);
			}
		});
	} else if (opts.mode === 'join') {
		const t = opts.tribe || {};
		modal.innerHTML = `<div class="modal-content" style="max-width:520px;margin:20px auto;"><div class="modal-header"><h3>Request to Join ${escapeHtml(t.name||'Tribe')}</h3><button id="closeTribeModalBtn" class="close-btn soft">Close</button></div><div class="modal-body"><div class="form-group"><label>Message (optional)</label><textarea id="tribeJoinMessage" class="form-control" rows="4"></textarea></div><div style="margin-top:10px;text-align:right"><button id="tribeModalCancel" class="btn btn-secondary">Cancel</button> <button id="tribeModalSubmit" class="btn btn-primary">Send Request</button></div></div></div>`;
		document.getElementById('closeTribeModalBtn')?.addEventListener('click', closeTribeModal);
		document.getElementById('tribeModalCancel')?.addEventListener('click', closeTribeModal);
		document.getElementById('tribeModalSubmit')?.addEventListener('click', async () => {
			const msg = (document.getElementById('tribeJoinMessage')?.value || '').trim() || null;
			const { res, body } = await apiRequest(`/api/tribes/${t.id}/join`, { method: 'POST', body: JSON.stringify({ message: msg }) });
			if (res && res.ok) {
				alert('Join request sent');
				closeTribeModal();
			} else {
				let m = 'Failed to send join request';
				try { if (body && body.error) m = body.error; } catch (e) {}
				alert(m);
			}
		});
	} else {
		// unknown mode
		modal.innerHTML = '';
		modal.classList.remove('active');
	}
}

window.openTribeModal = openTribeModal;
window.closeTribeModal = closeTribeModal;

// Open a comprehensive Achievements / Badges modal explaining all rules
function openBadgesModal() {
	const modal = document.getElementById('creatureModal');
	if (!modal) return alert('Modal container missing');
	modal.classList.add('active'); modal.setAttribute('aria-hidden', 'false');
	modal.innerHTML = `
		<div class="modal-content" style="max-width:860px;margin:20px auto;">
			<div class="modal-header"><h3>Achievements & Badges</h3><button id="closeBadgesModalBtn" class="close-btn">&times;</button></div>
			<div class="modal-body" style="max-height:70vh;overflow:auto;">
						<section style="margin-bottom:12px;"><h4>Prized Bloodline</h4>
							<p>All-or-nothing check across five core base stats: Health, Stamina, Food, Weight and Melee. Mutations and domestic levels are <strong>excluded</strong> for this badge — only base stat points count.</p>
					<ul>
						<li><strong>Bronze</strong>: all five core stats ≥ 45</li>
						<li><strong>Silver</strong>: all five core stats ≥ 50</li>
						<li><strong>Gold</strong>: all five core stats ≥ 55</li>
						<li><strong>Diamond</strong>: all five core stats ≥ 60 — triggers a server-wide announcement</li>
					</ul>
				</section>

				<section style="margin-bottom:12px;"><h4>Boss Ready</h4>
					<p>Uses <em>total points</em> = Base + (Mutations × 2) + Domestic Levels. Unless otherwise noted, both Health and Melee must meet thresholds for difficulty tiers.</p>
					<ul>
						<li><strong>Gamma Ready</strong>: Health ≥ 75 and Melee ≥ 75</li>
						<li><strong>Beta Ready</strong>: Health ≥ 100 and Melee ≥ 100</li>
						<li><strong>Alpha Ready</strong>: Health ≥ 125 and Melee ≥ 125</li>
						<li><strong>Titan Slayer</strong>: Health ≥ 150 and Melee ≥ 150</li>
					</ul>
					<p>Specialized role badges (independent checks):</p>
					<ul>
						<li><strong>Boss Tank</strong>: Health ≥ 175 (Melee not required)</li>
						<li><strong>Boss DPS</strong>: Melee ≥ 175 (Health not required)</li>
						<li><strong>Boss Juggernaut</strong>: Health ≥ 125 and Stamina ≥ 125</li>
						<li><strong>Boss Bruiser</strong>: Health ≥ 125 and Weight ≥ 125</li>
					</ul>
				</section>

				<section style="margin-bottom:12px;"><h4>Boss Underdog</h4>
					<p>Recognizes non-meta species bred to boss-viable levels. Uses the same total-points formula as Boss Ready but with higher thresholds. Certain canonical meta-boss species are ineligible.</p>
					<p><strong>Ineligible (revised meta-boss list):</strong> Rex, Giganotosaurus, Carcharodontosaurus, Therizinosaurus, Deinonychus, Megatherium, Yutyrannus, Daeodon, Woolly Rhino, Shadowmane, Reaper, Rock Drake.</p>
					<ul>
						<li><strong>Underdog Champion (Gamma)</strong>: Health ≥ 90 and Melee ≥ 90</li>
						<li><strong>Underdog Hero (Beta)</strong>: Health ≥ 115 and Melee ≥ 115</li>
						<li><strong>Underdog Legend (Alpha)</strong>: Health ≥ 140 and Melee ≥ 140</li>
						<li><strong>Underdog Titan</strong>: Health ≥ 160 and Melee ≥ 160</li>
					</ul>
				</section>

			<!-- Mutation Master and Tank badges removed as requested -->

				<section style="margin-bottom:6px;color:#94a3b8;font-size:13px;"><strong>Notes:</strong>
					<ul>
						<li>All thresholds are implemented client-side by default; the server stores achievements if provided by the client and will create a Diamond announcement when detected.</li>
						<li>Mutations are treated as 2 levels for Boss/Underdog calculations.</li>
						<li>Prized Bloodline ignores mutations/domestic levels — only raw wild base points count.</li>
						<li>If you want achievements to be authoritative, we can add server-side recomputation/validation to prevent spoofing.</li>
					</ul>
				</section>
			</div>
			<div class="modal-footer"><button id="closeBadgesModalFoot" class="btn btn-secondary">Close</button></div>
		</div>
	`;
	document.getElementById('closeBadgesModalBtn')?.addEventListener('click', closeTribeModal);
	document.getElementById('closeBadgesModalFoot')?.addEventListener('click', closeTribeModal);
}
window.openBadgesModal = openBadgesModal;

// --- SPECIES_DATABASE startup helper ---
// Wait for the external species-database.js to set window.SPECIES_DATABASE.
// Avoid TDZ and race conditions by polling with a short timeout.
// NOTE: do NOT declare a variable named SPECIES_DATABASE here because the
// external file may declare it (as const). Use a safe accessor instead.
window.__SPECIES_DB = window.__SPECIES_DB || {};
function getSpeciesDB() {
	return (typeof window !== 'undefined') ? (window.SPECIES_DATABASE || window.__SPECIES_DB || {}) : (window.__SPECIES_DB || {});
}
function waitForSpeciesDB(timeoutMs = 2000, intervalMs = 50) {
	return new Promise((resolve) => {
		const start = Date.now();
		const tick = () => {
			if (window && window.SPECIES_DATABASE && Object.keys(window.SPECIES_DATABASE).length > 0) {
				resolve(window.SPECIES_DATABASE);
				return;
			}
			if (Date.now() - start >= timeoutMs) {
				// give up and resolve with whatever is present (possibly empty object)
				resolve(window.SPECIES_DATABASE || {});
				return;
			}
			setTimeout(tick, intervalMs);
		};
		tick();
	});
}

function speciesValues() {
	try { return Object.values(getSpeciesDB() || {}); } catch (e) { return []; }
}

// Normalize rarity for a species into the canonical set used by the UI.
// Canonical set (lowercase keys): common, uncommon, rare, legendary, mythic, boss
function canonicalRarityForSpecies(species) {
	try {
		if (!species) return 'common';
	// If DB explicitly marks boss-capable or has boss badgeCategories or category 'boss', treat as boss
	if (species.bossFightCapable === true) return 'boss';
	if (Array.isArray(species.badgeCategories) && species.badgeCategories.map(String).join(' ').toLowerCase().includes('boss')) return 'boss';
	if (species.category && (species.category + '').toLowerCase().includes('boss')) return 'boss';
		// Also check common descriptive fields
		const hay = ((species.secondaryRoles||[]) .concat([species.description||'', species.name||'', species.rarity||'', species.rarityRating||''])).join(' ').toLowerCase();
		if (hay.includes('boss')) return 'boss';

		const raw = ((species.rarity || species.rarityRating) + '').toLowerCase();
		if (!raw || raw === 'undefined') return 'common';
		if (raw.includes('myth') || raw.includes('mythic')) return 'mythic';
		// Map legacy/undesired 'epic' to 'mythic' per requested canonical set
		if (raw.includes('epic')) return 'mythic';
		if (raw.indexOf('legend') !== -1) return 'legendary';
		if (raw.indexOf('rare') !== -1 && raw.indexOf('rare') === raw.lastIndexOf('rare')) return 'rare';
		if (raw.indexOf('uncommon') !== -1) return 'uncommon';
		if (raw.indexOf('common') !== -1) return 'common';
		// Fallback: treat unknown as common
		return 'common';
	} catch (e) { return 'common'; }
}

// Kick off async probe but don't block the rest of the script sync execution.
(async function initSpeciesDBProbe() {
	try {
		const db = await waitForSpeciesDB(2000, 40);
		// Update fallback storage without overwriting an existing SPECIES_DATABASE const.
		try { window.__SPECIES_DB = db || window.__SPECIES_DB || {}; } catch (e) {}
		// ensure global reflects resolved DB so other modules can access it (do not redeclare const)
		try { window.SPECIES_DATABASE = window.SPECIES_DATABASE || window.__SPECIES_DB; } catch (e) {}
		const count = Object.keys(getSpeciesDB() || {}).length;
		console.log(`[SPA] species DB resolved: ${count} species`);
		if (count === 0) console.warn('[SPA] species database appears empty or failed to load before timeout');
		// If the app is already showing the main app, refresh the species list
		try { if (document.readyState === 'complete' || document.readyState === 'interactive') { if (typeof loadSpeciesPage === 'function') loadSpeciesPage(); } } catch (e) {}
	} catch (err) {
		console.error('[SPA] Error while waiting for SPECIES_DATABASE:', err);
	}
})();

// --- Login/Register Handlers (API calls) ---
async function handleLogin(event) {
	event.preventDefault();
	console.log('[SPA] handleLogin invoked');
	// identifier can be email or nickname
	const identifier = (document.getElementById('loginEmail')?.value || '').trim();
	const password = (document.getElementById('loginPassword')?.value || '').trim();
	const errorDiv = document.getElementById('loginError');
	errorDiv.style.display = 'none';

	// Basic client-side validation
	if (!identifier || !password) {
		errorDiv.textContent = 'Please provide email/nickname and password.';
		errorDiv.style.display = 'block';
		return false;
	}
	try {
	console.log('[SPA] sending login request to server for', identifier);
	const { res, body } = await apiRequest('/api/login', { method: 'POST', body: JSON.stringify({ identifier, password }) });
	// Mirror the original helper behavior: prefer parsed body from apiRequest
	const data = body;
	// `res` and `data` variables now available
	if (res.ok && data && data.token) {
			localStorage.setItem('token', data.token);
			// store returned user info for profile page if present
			try { if (data.user) { localStorage.setItem('userEmail', data.user.email || ''); localStorage.setItem('userNickname', data.user.nickname || ''); } } catch (e) {}
			// Ensure the document is visible and the main app is shown
			try { document.documentElement.setAttribute('data-ready', 'true'); } catch (e) {}
			showMainApp();
			updateTribeHeader();
			// Sync server-stored creatures and planner/arena data for this user
			try { await loadServerCreatures(); } catch (e) { console.warn('loadServerCreatures after login failed', e); }
			try { await loadServerBossData(); } catch (e) { console.warn('loadServerBossData after login failed', e); }
			try { await loadServerArenaCollections(); } catch (e) { console.warn('loadServerArenaCollections after login failed', e); }
			// Wait for species DB to be available before rendering species page
			try { await waitForSpeciesDB(3000, 50); } catch (e) {}
			try { loadSpeciesPage(); } catch (e) {}
			// Refresh stats and auth UI after login
			try { updateStatsDashboard(); } catch (e) {}
			try { updateAuthUI(); } catch (e) {}
		} else {
			// Show helpful diagnostic including status and any server-provided body
			console.warn('[SPA] login failed', { status: res.status, body: data });
			let msg = 'Login failed.';
			if (data) {
				if (typeof data === 'string') msg = data;
				else if (data.error) msg = data.error;
				else msg = JSON.stringify(data);
			}
			errorDiv.textContent = `${res.status} ${res.statusText}: ${msg}`;
			errorDiv.style.display = 'block';
		}
	} catch (e) {
		console.error('[SPA] login network error', e);
		errorDiv.textContent = 'Network error. See console for details.';
		errorDiv.style.display = 'block';
	}
	return false;
}
window.handleLogin = handleLogin;

async function handleRegister(event) {
	event.preventDefault();
	const email = (document.getElementById('registerEmail')?.value || '').trim();
	const nickname = (document.getElementById('registerNickname')?.value || '').trim();
	const password = (document.getElementById('registerPassword')?.value || '').trim();
	const confirmPassword = (document.getElementById('registerConfirmPassword')?.value || '').trim();
	const errorDiv = document.getElementById('registerError');
	errorDiv.style.display = 'none';

	// Basic validation
	if (!email || !password || !confirmPassword) {
		errorDiv.textContent = 'Please complete all fields.';
		errorDiv.style.display = 'block';
		return false;
	}
	if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
		errorDiv.textContent = 'Please enter a valid email address.';
		errorDiv.style.display = 'block';
		return false;
	}
	if (password !== confirmPassword) {
		errorDiv.textContent = 'Passwords do not match.';
		errorDiv.style.display = 'block';
		return false;
	}
	if (password.length < 6) {
		errorDiv.textContent = 'Password must be at least 6 characters.';
		errorDiv.style.display = 'block';
		return false;
	}
	try {
		const { res, body } = await apiRequest('/api/register', { method: 'POST', body: JSON.stringify({ email, password, nickname }) });
		const data = body;
		// Success path: server may return { success: true } or include a token/user
		if (res.ok && (data === true || (data && (data.success || data.token)))) {
			if (data && data.token) {
				localStorage.setItem('token', data.token);
				try { if (data.user) { localStorage.setItem('userEmail', data.user.email || ''); localStorage.setItem('userNickname', data.user.nickname || ''); } } catch (e) {}
				try { document.documentElement.setAttribute('data-ready', 'true'); } catch (e) {}
				showMainApp();
				updateTribeHeader();
				try { await loadServerCreatures(); } catch (e) {}
				try { await loadServerBossData(); } catch (e) {}
				try { await loadServerArenaCollections(); } catch (e) {}
				try { loadSpeciesPage(); } catch (e) {}
				try { updateStatsDashboard(); } catch (e) {}
				try { updateAuthUI(); } catch (e) {}
			} else {
				// No token: guide user to login form and prefill credentials for convenience
				showLoginPage();
				setTimeout(async () => {
					try {
						const le = document.getElementById('loginEmail');
						const lp = document.getElementById('loginPassword');
						if (le) le.value = email;
						if (lp) lp.value = password;
						try { await handleLogin(new Event('submit')); } catch (e) {}
					} catch (e) {}
				}, 50);
			}
		} else {
			console.warn('[SPA] register failed', { status: res.status, body: data });
			let msg = 'Registration failed.';
			if (data) {
				if (typeof data === 'string') msg = data;
				else if (data.error) msg = data.error;
				else msg = JSON.stringify(data);
			}
			errorDiv.textContent = `${res.status} ${res.statusText}: ${msg}`;
			errorDiv.style.display = 'block';
		}
	} catch (e) {
		console.error('[SPA] register network error', e);
		errorDiv.textContent = 'Network error.';
		errorDiv.style.display = 'block';
	}
	return false;
}
window.handleRegister = handleRegister;

// --- API helper and server-sync for creature persistence ---
async function apiRequest(path, opts = {}) {
	const token = localStorage.getItem('token');
	const headers = Object.assign({}, opts.headers || {});
	if (token) headers['Authorization'] = 'Bearer ' + token;
	// Ask for JSON responses; only set Content-Type when we have a body to send
	headers['Accept'] = headers['Accept'] || 'application/json';
	if (opts.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
	// Resolve base with safe fallbacks: opts.base -> window.__API_BASE -> same-origin
	let base = '';
	try {
		base = opts.base || (typeof window !== 'undefined' ? (window.__API_BASE || window.location.origin) : '');
	} catch (e) { base = ''; }
	// Normalize: remove trailing slash if present so base + path is consistent
	try { if (base && base.endsWith('/')) base = base.slice(0, -1); } catch (e) {}
	const url = base + path;
	const method = (opts.method || 'GET').toUpperCase();
	try {
		console.debug('[SPA] apiRequest ->', method, url, opts && opts.body ? { bodyPreview: (opts.body || '').slice(0,200) } : undefined);
	} catch (e) {}
	const res = await fetch(url, Object.assign({}, opts, { headers, credentials: 'include' }));
	const ct = res.headers.get('content-type') || '';
	// read raw text then try to parse JSON even when Content-Type is missing
	let raw = null;
	try { raw = await res.text(); } catch (e) { raw = null; }
	let body = null;
	try {
		if (raw && ct.toLowerCase().includes('application/json')) {
			body = JSON.parse(raw);
		} else if (raw && raw.trim() && (raw.trim().startsWith('{') || raw.trim().startsWith('['))) {
			// attempt to parse JSON even if content-type header is absent
			try { body = JSON.parse(raw); } catch (e) { body = raw; }
		} else {
			body = raw;
		}
	} catch (e) {
		body = raw;
	}

	// Only warn for non-ok responses or when login/register returned an unexpected empty body.
	const authEmpty = (path === '/api/login' || path === '/api/register') && (body === null || (typeof body === 'string' && body.trim() === ''));
	if (!res.ok || authEmpty) {
		try {
			console.warn('[SPA] apiRequest response', { url, method, status: res.status, contentType: ct, bodyPreview: (raw || '').slice(0,1000) });
		} catch (e) {}
	}
	return { res, body };
}

// Load creatures from server and merge into appState.creatures
async function loadServerCreatures() {
	try {
		const { res, body } = await apiRequest('/api/creature', { method: 'GET' });
		if (res.ok && Array.isArray(body)) {
			// Map server objects into client format, using id as stable id
			const serverCreatures = body.map(c => ({ id: String(c.id), ...c }));
			// Merge: prefer server copy for logged-in users
			window.appState = window.appState || { creatures: [] };
			window.appState.creatures = serverCreatures;
			try { localStorage.setItem(getCreatureStorageKey(), JSON.stringify(window.appState.creatures)); } catch (e) {}
			try { if (typeof loadSpeciesPage === 'function') loadSpeciesPage(); } catch (e) {}
		}
	} catch (e) { console.warn('loadServerCreatures failed', e); }
}

// Save local creature list to server: create or update each entry
async function saveDataToServer() {
	try {
		if (!window.appState || !Array.isArray(window.appState.creatures)) return;
		for (const c of window.appState.creatures) {
			// Server expects objects without client-generated ids for creation; use numeric id for updates
			if (String(c.id).startsWith('creature_')) {
				// create
				const { res, body } = await apiRequest('/api/creature', { method: 'POST', body: JSON.stringify({ data: c }) });
				if (res.ok && body && body.id) {
					// replace local id with server id
					c.id = String(body.id);
				}
			} else {
				// update
				await apiRequest(`/api/creature/${c.id}`, { method: 'PUT', body: JSON.stringify({ data: c }) });
			}
		}
		try { localStorage.setItem(getCreatureStorageKey(), JSON.stringify(window.appState.creatures)); } catch (e) {}
	} catch (e) { console.warn('saveDataToServer failed', e); }
}

async function deleteCreatureOnServer(id) {
	try {
		if (!id) return;
		await apiRequest(`/api/creature/${id}`, { method: 'DELETE' });
	} catch (e) { console.warn('deleteCreatureOnServer failed', e); }
}

// Expose for creatures.js or console
window.apiRequest = apiRequest;
window.loadServerCreatures = loadServerCreatures;
window.saveDataToServer = saveDataToServer;
window.deleteCreatureOnServer = deleteCreatureOnServer;

// Global saveData used by legacy code — write localStorage and sync to server when logged in
window.saveData = function() {
		try { localStorage.setItem(getCreatureStorageKey(), JSON.stringify(window.appState && window.appState.creatures || [])); } catch (e) {}
	try { if (typeof window.saveDataToServer === 'function' && localStorage.getItem('token')) window.saveDataToServer(); } catch (e) {}
}

// --- Navigation/Page Loading ---
function isValidImageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  // Accept data URLs or http(s) URLs
  return url.startsWith('data:image') || url.startsWith('http://') || url.startsWith('https://');
}

function renderCreatureImage(creature, className = '') {
  if (isValidImageUrl(creature.image)) {
    return `<img src="${creature.image}" alt="${creature.name || 'Creature'}" class="${className}">`;
  } else {
    // Use icon or placeholder
    return `<div class="creature-image-list-placeholder">${creature.icon || '🦖'}</div>`;
  }
}

async function loadSpeciesPage() {
    const main = document.getElementById('appMainContent');
    if (!main) return;

    // Render the species page with search and filters and a species grid
    main.innerHTML = `
        <section class="species-section">
            <div class="species-header-controls">
                <div class="species-search">
                    <input id="searchInput" class="form-control" placeholder="Search species by name, category or diet">
                </div>
                <div class="species-filters">
                    <select id="categoryFilter" class="form-control">
                        <option value="">All Categories</option>
                        <option value="herbivore">Herbivore</option>
                        <option value="carnivore">Carnivore</option>
                        <option value="aquatic">Aquatic</option>
                        <option value="flyer">Flyer</option>
                    </select>
                    <select id="rarityFilter" class="form-control">
                        <option value="">All Rarities</option>
                        <option value="common">Common</option>
                        <option value="uncommon">Uncommon</option>
                        <option value="rare">Rare</option>
                        <option value="very rare">Very Rare</option>
                        <option value="unique">Unique</option>
                    </select>
                </div>
            </div>
            <div id="speciesGrid" class="species-grid"></div>
        </section>
    `;

    try {
        // Load species database
        const species = await import('./species-database.js');
        if (!species || !species.default) {
            console.error('Failed to load species database');
            return;
        }

        const speciesGrid = document.getElementById('speciesGrid');
        if (!speciesGrid) return;

        // Render species cards
        const renderCards = () => {
            const searchTerm = (document.getElementById('searchInput')?.value || '').toLowerCase();
            const category = document.getElementById('categoryFilter')?.value;
            const rarity = document.getElementById('rarityFilter')?.value;

            const filteredSpecies = species.default.filter(s => {
                if (searchTerm && !s.name.toLowerCase().includes(searchTerm) && 
                    !s.category?.toLowerCase().includes(searchTerm) &&
                    !s.diet?.toLowerCase().includes(searchTerm)) {
                    return false;
                }
                if (category && s.category?.toLowerCase() !== category.toLowerCase()) {
                    return false;
                }
                if (rarity && s.rarity?.toLowerCase() !== rarity.toLowerCase()) {
                    return false;
                }
                return true;
            });

            speciesGrid.innerHTML = filteredSpecies.map(s => `
                <div class="species-card" data-species-id="${s.id}">
                    <div class="species-card-content">
                        <div class="species-icon">${s.icon || '🦖'}</div>
                        <div class="species-info">
                            <div class="species-name">${s.name}</div>
                            <div class="species-meta">${s.category || ''} · ${s.rarity || 'Common'}</div>
                            <div class="species-stats">
                                ${s.baseStats ? Object.entries(s.baseStats)
                                    .map(([key, value]) => `<span class="stat">${key}: ${value}</span>`)
                                    .join('') : ''}
                            </div>
                        </div>
                    </div>
                </div>
            `).join('');
        };

        // Set up event listeners for filtering
        document.getElementById('searchInput')?.addEventListener('input', debounce(renderCards, 200));
        document.getElementById('categoryFilter')?.addEventListener('change', renderCards);
        document.getElementById('rarityFilter')?.addEventListener('change', renderCards);

        // Initial render
        renderCards();
    } catch (error) {
        console.error('Error loading species page:', error);
    }
						<option value="extinct">Extinct</option>
					</select>
					<button id="clearFiltersBtn" class="btn btn-secondary">Clear</button>
				</div>
			</div>

			<div id="speciesGrid" class="species-grid" aria-live="polite"></div>
		</section>
	`;

	// Fill tribe info in case other parts rely on it
	const leaderEl = document.getElementById('tribeLeaderInfo');
	if (leaderEl) leaderEl.textContent = appState.tribeSettings.leader || 'N/A';

	// Wire events
	const searchInput = document.getElementById('searchInput');
	const categoryFilter = document.getElementById('categoryFilter');
	const rarityFilter = document.getElementById('rarityFilter');
	const clearBtn = document.getElementById('clearFiltersBtn');

	if (searchInput) searchInput.addEventListener('input', debounce(filterSpecies, 180));
	if (categoryFilter) categoryFilter.addEventListener('change', filterSpecies);
	if (rarityFilter) rarityFilter.addEventListener('change', filterSpecies);
	if (clearBtn) clearBtn.addEventListener('click', () => {
		if (searchInput) searchInput.value = '';
		if (categoryFilter) categoryFilter.value = '';
		if (rarityFilter) rarityFilter.value = '';
		filterSpecies();
	});

	// Initial population
	// If the species DB is empty, wait briefly for it to resolve then populate
	try {
		const initialCount = Object.keys(getSpeciesDB() || {}).length;
		if (initialCount === 0) {
			const grid = document.getElementById('speciesGrid');
			if (grid) grid.innerHTML = '<div class="no-species-found">Species database loading...</div>';
			await waitForSpeciesDB(3000, 50);
			console.log('[SPA] species DB probe complete, re-rendering species list');
		}
	} catch (e) { console.warn('[SPA] error while waiting for species DB', e); }

	// Populate filters based on the resolved species DB so UI only shows valid options
	(function populateFilters() {
		const capitalize = (s) => (s || '').toString().replace(/\b\w/g, c => c.toUpperCase());
		try {
			waitForSpeciesDB(2000, 40).then(() => {
				const db = getSpeciesDB() || {};
				const list = Object.values(db || {});
				const cats = new Set();
				const rarities = new Set();
				list.forEach(s => {
					if (!s) return;
					if (s.category) cats.add((s.category+'').toLowerCase());
					if (s.tags && Array.isArray(s.tags)) s.tags.forEach(t => cats.add((t+'').toLowerCase()));
					if (s.rarity) rarities.add((s.rarity+'').toLowerCase());
				});
				const categoryFilterEl = document.getElementById('categoryFilter');
				const rarityFilterEl = document.getElementById('rarityFilter');
				if (categoryFilterEl) {
					const opts = ['<option value="">All Categories</option>'].concat(Array.from(cats).sort().map(c => `<option value="${c}">${capitalize(c)}</option>`));
					categoryFilterEl.innerHTML = opts.join('');
				}
				if (rarityFilterEl) {
					// Use the canonical rarity options in the requested order.
					const canonical = [
						{ k: 'common', label: 'Common' },
						{ k: 'uncommon', label: 'Uncommon' },
						{ k: 'rare', label: 'Rare' },
						{ k: 'legendary', label: 'Legendary' },
						{ k: 'mythic', label: 'Mythic' },
						{ k: 'boss', label: 'Boss', category: 'boss' }
					];
					const opts = ['<option value="">All Rarities</option>'].concat(canonical.map(r => `<option value="${r.k}" ${r.category ? 'data-category="'+r.category+'"' : ''}>${r.label}</option>`));
					rarityFilterEl.innerHTML = opts.join('');
				}
				// Re-attach filter handlers if necessary
				if (document.getElementById('categoryFilter')) document.getElementById('categoryFilter').addEventListener('change', filterSpecies);
				if (document.getElementById('rarityFilter')) document.getElementById('rarityFilter').addEventListener('change', filterSpecies);
				// Finally run the filter to populate the grid
				filterSpecies();
			});
		} catch (err) { console.warn('populateFilters failed', err); filterSpecies(); }
	})();
}

// Debounce helper
function debounce(fn, ms) {
	let t;
	return (...args) => {
		clearTimeout(t);
		t = setTimeout(() => fn.apply(null, args), ms);
	};
}

function filterSpecies() {
	const searchTerm = (document.getElementById('searchInput')?.value || '').toLowerCase();
	const categoryFilter = (document.getElementById('categoryFilter')?.value || '').toLowerCase();
	const rarityFilter = (document.getElementById('rarityFilter')?.value || '').toLowerCase();

	const grid = document.getElementById('speciesGrid');
	if (!grid) return;
	if (!Object.keys(getSpeciesDB() || {}).length) {
		grid.innerHTML = '<div class="no-species-found">Species database unavailable.</div>';
		return;
	}

	grid.innerHTML = '';
	let filteredCount = 0;

	speciesValues().forEach(species => {
		if (!species || !species.name) return;

		const matchesSearch = !searchTerm || (
			(species.name && species.name.toLowerCase().includes(searchTerm)) ||
			(species.category && species.category.toLowerCase().includes(searchTerm)) ||
			(species.diet && species.diet.toLowerCase().includes(searchTerm)) ||
			(species.description && species.description.toLowerCase().includes(searchTerm))
		);

		// Category matching: accept contains/includes (handles multi-value categories or tags),
		// and special-case 'flyer' to detect flying species via speeds or category/tag mentions.
		let matchesCategory = true;
		if (categoryFilter) {
			try {
				const cat = (species.category || '') + '';
				const diet = (species.diet || '') + '';
				const tags = (species.tags && Array.isArray(species.tags)) ? species.tags.join(' ') : '';
				const hay = (cat + ' ' + diet + ' ' + tags).toLowerCase();
				if (categoryFilter === 'flyer') {
					const flying = (species.speeds && (Number(species.speeds.flying) || 0)) || 0;
					matchesCategory = flying > 0 || hay.includes('fly') || hay.includes('flying') || hay.includes('wing');
				} else {
					matchesCategory = hay.includes(categoryFilter);
				}
			} catch (e) { matchesCategory = true; }
		}

		// Rarity matching: normalize species rarity into our canonical set and match against the selected filter.
		let matchesRarity = true;
		if (rarityFilter) {
			try {
				const selected = (rarityFilter || '').toString().toLowerCase();
				// Compute canonical rarity for this species
				const sR = canonicalRarityForSpecies(species);
				// Boss species should only match when 'boss' is selected
				if (selected === 'boss') {
					matchesRarity = (sR === 'boss');
				} else {
					matchesRarity = (sR === selected);
				}
			} catch (e) { matchesRarity = true; }
		}

		if (matchesSearch && matchesCategory && matchesRarity) {
			const creatureCount = (appState.creatures || []).filter(c => c.species === species.name).length;
			const card = createSpeciesCard(species, creatureCount);
			if (card) {
				// Guard click handlers that may reference functions defined in creatures.js
				if (typeof openCreaturePage === 'function') {
					card.onclick = () => openCreaturePage(species.name);
				} else {
					card.onclick = () => { console.warn('openCreaturePage not available'); };
				}
				grid.appendChild(card);
				filteredCount++;
			}
		}
	});

	if (filteredCount === 0) {
		grid.innerHTML = '<div class="no-species-found">No species found</div>';
	}
}

function createSpeciesCard(species, creatureCount) {
	if (!species || !species.name) return null;
	const card = document.createElement('div');
	card.className = 'species-card';
	card.tabIndex = 0;
	card.setAttribute('role', 'button');
	card.onclick = () => openCreaturePage(species.name);

	// compute highest stats for species creatures
	const speciesCreatures = (appState.creatures || []).filter(c => c.species === species.name);
	const highestStats = calculateHighestBaseStats(speciesCreatures);

	const badgesHTML = (speciesCreatures.length > 0 && window.BadgeSystem) ?
		speciesCreatures.slice(0,3).map(c => BadgeSystem.generateBadgeHTML(c)).join('') : '';

	card.innerHTML = `
		<div class="species-card-header">
			<div class="species-icon">${species.icon || '🦖'}</div>
			<div class="species-info">
				<div class="species-name">${species.name}</div>
				<div class="species-meta">${species.category || ''} • ${canonicalRarityForSpecies(species)}</div>
			</div>
			<div class="species-count">${creatureCount}</div>
		</div>
		<div class="species-card-body">
			<div class="species-desc">${species.description || ''}</div>
			<div class="species-badges">${badgesHTML}</div>
		</div>
	`;

	return card;
}

function calculateHighestBaseStats(creatures) {
	const stats = ['Health', 'Stamina', 'Oxygen', 'Food', 'Weight', 'Melee'];
	const highest = {};
	if (!creatures || creatures.length === 0) return highest;
	stats.forEach(stat => {
		let maxValue = 0;
		let maxId = null;
		creatures.forEach(c => {
			const v = c.baseStats?.[stat] || 0;
			if (v > maxValue) { maxValue = v; maxId = c.id; }
		});
		highest[stat] = { value: maxValue, creatureId: maxId };
	});
	return highest;
}
function loadMyNuggiesPage() {
	const main = document.getElementById('appMainContent');
	if (!main) return;
	main.innerHTML = `
		<div class="creature-page">
		  <div class="creature-page-header">
		    <div class="creature-page-info">
		      <h1>My Nuggies</h1>
		      <div class="creature-page-meta" id="myNuggiesMeta">Your saved creatures</div>
		    </div>
				<div class="creature-page-actions">
					<button class="btn btn-primary" id="openBadgesBtn">🏆 Badges</button>
					<button class="btn btn-secondary" id="backToMainFromMyNuggies">← Back to Species</button>
				</div>
		  </div>
		  <div class="creature-page-filters" style="display:flex;gap:8px;align-items:center;margin:12px 0;">
		    <input id="myNuggiesSearch" class="form-control" placeholder="Search by name or species" style="flex:1;min-width:140px;">
		    <select id="myNuggiesSpeciesFilter" class="form-control" style="width:220px;"><option value="">All owned species</option></select>
		  </div>
		  <div class="creatures-section-header">
		    <h2 class="creatures-section-title">Your Creatures</h2>
		    <div class="view-toggle">
		      <button class="view-toggle-btn active" id="myCardViewBtn">📊 Cards</button>
		      <button class="view-toggle-btn" id="myListViewBtn">📋 List</button>
		    </div>
		  </div>
		  <div class="creatures-grid" id="creaturesGrid"></div>
		</div>
	`;

	// Wire actions
	const badgesBtn = document.getElementById('openBadgesBtn');
	if (badgesBtn) badgesBtn.onclick = () => { try { openBadgesModal(); } catch (e) { console.warn('openBadgesModal failed', e); } };
	const backBtn = document.getElementById('backToMainFromMyNuggies');
	if (backBtn) backBtn.onclick = () => { if (typeof window.loadSpeciesPage === 'function') window.loadSpeciesPage(); };

	// Wire view toggle buttons
	const cardViewBtn = document.getElementById('myCardViewBtn');
	const listViewBtn = document.getElementById('myListViewBtn');
	if (cardViewBtn) cardViewBtn.addEventListener('click', (e) => { e.preventDefault(); setCreatureView('card'); cardViewBtn.classList.add('active'); listViewBtn?.classList.remove('active'); });
	if (listViewBtn) listViewBtn.addEventListener('click', (e) => { e.preventDefault(); setCreatureView('list'); listViewBtn.classList.add('active'); cardViewBtn?.classList.remove('active'); });

	// Populate the grid with all saved creatures
	// Populate species filter dropdown with species user actually owns
	try {
		const speciesFilter = document.getElementById('myNuggiesSpeciesFilter');
		const searchInput = document.getElementById('myNuggiesSearch');
		const owned = Array.from(new Set((window.appState.creatures || []).map(c => c.species).filter(Boolean)));
		if (speciesFilter) {
			// clear and add default
			speciesFilter.innerHTML = '<option value="">All owned species</option>' + owned.map(s => `<option value="${s}">${s}</option>`).join('');
		}
		// wire inputs to re-render grid with filter/search
		const refreshGrid = () => {
			const species = speciesFilter?.value || null;
			const search = searchInput?.value || '';
			try { loadCreaturesGrid(species, search); } catch (e) { console.warn('loadCreaturesGrid failed on My Nuggies page', e); }
		};
		if (speciesFilter) speciesFilter.addEventListener('change', refreshGrid);
		if (searchInput) searchInput.addEventListener('input', debounce(refreshGrid, 160));
		// initial render
		refreshGrid();
	} catch (e) { console.warn('failed to wire My Nuggies filters', e); }
}

// Inject tribe creatures column into My Nuggies page when user is member of tribes
function loadMyTribeColumn(tribeId) {
	try {
		const main = document.getElementById('appMainContent');
		if (!main) return;
		// Ensure two-column layout
		const container = document.querySelector('.creature-page');
		if (!container) return;
		// If already injected, refresh
		let tribeCol = document.getElementById('tribeCreaturesColumn');
		if (!tribeCol) {
			tribeCol = document.createElement('div');
			tribeCol.id = 'tribeCreaturesColumn';
			tribeCol.style.width = '360px';
			tribeCol.style.marginLeft = '12px';
			tribeCol.innerHTML = `<div class="creature-page-header"><h2>Tribe Vault</h2><div id="tribeVaultMeta" class="creature-page-meta">Shared creatures from your tribe</div></div><div id="tribeCreaturesGrid" class="creatures-grid"></div>`;
			// Place it after the main creature-page content if available
			container.parentNode.style.display = 'flex';
			container.parentNode.style.alignItems = 'flex-start';
			container.parentNode.appendChild(tribeCol);
		}
		// fetch tribe creatures
		apiRequest('/api/tribes/' + tribeId + '/creatures', { method: 'GET' }).then(({ res, body }) => {
			const grid = document.getElementById('tribeCreaturesGrid');
			if (!res.ok) { if (grid) grid.innerHTML = '<div class="no-species-found">Failed to load tribe creatures</div>'; return; }
			if (!Array.isArray(body) || body.length === 0) { if (grid) grid.innerHTML = '<div class="no-species-found">No tribe creatures</div>'; return; }
			grid.innerHTML = '';
			(body || []).forEach(c => {
				const card = document.createElement('div'); card.className = 'species-card';
				const stats = (c.baseStats ? Object.keys(c.baseStats).map(k => `${k}: ${c.baseStats[k]||0}`).join(' • ') : '');
				card.innerHTML = `<div class="species-card-header"><div class="species-icon">${c.icon||'🦖'}</div><div class="species-info"><div class="species-name">${c.name||c.species||'Creature'}</div><div class="species-meta">${c.species||''}</div></div></div><div class="species-card-body"><div style="color:#94a3b8">${stats}</div></div>`;
				// Allow user to copy tribe creature to their own collection
				const copyBtn = document.createElement('button'); copyBtn.className = 'btn btn-primary'; copyBtn.textContent = 'Add to My Nuggies';
				copyBtn.onclick = async () => {
					// POST to /api/creature with the creature data to save to user's personal vault
					await apiRequest('/api/creature', { method: 'POST', body: JSON.stringify({ data: c }) });
					alert('Creature added to your collection');
					// reload user's creatures state
					if (typeof loadUserCreatures === 'function') loadUserCreatures();
				};
				card.querySelector('.species-card-body')?.appendChild(copyBtn);
				grid.appendChild(card);
			});
		}).catch(() => { const grid = document.getElementById('tribeCreaturesGrid'); if (grid) grid.innerHTML = '<div class="no-species-found">Failed to load tribe creatures</div>'; });
	} catch (e) { console.warn('loadMyTribeColumn failed', e); }
}

// Legacy My Tribe page removed. Use loadTribeManagerPage for tribe features.

function loadTradingPage() {
	const main = document.getElementById('appMainContent');
	if (!main) return;
		main.innerHTML = `
			<section class="trading-page">
				<div class="page-header"><h1>Trading</h1><div class="section-sub">A simple marketplace for exchanging creatures</div></div>

				<div class="trading-controls" style="display:flex;gap:10px;align-items:center;margin:12px 0;flex-wrap:wrap;">
					<div style="flex:1;min-width:180px;"><input id="tradeSearch" class="form-control" placeholder="Search species or creature name"></div>
					<select id="tradeSpeciesFilter" class="form-control"><option value="">All Species</option></select>
					<select id="tradeStatSort" class="form-control" style="width:160px;"><option value="">Sort: None</option><option value="Health">Highest HP</option><option value="Melee">Highest Melee</option><option value="Stamina">Highest Stamina</option></select>
					<select id="tradeStatusFilter" class="form-control" style="width:140px;"><option value="">Any</option><option value="open">Open</option><option value="closed">Closed</option></select>
					<select id="tradeStatFilter" class="form-control" style="width:120px;"><option value="">Stat</option><option value="Health">HP</option><option value="Melee">Melee</option><option value="Stamina">Stamina</option></select>
					<input id="tradeStatMin" class="form-control" placeholder="min" style="width:80px;">
					<input id="tradeStatMax" class="form-control" placeholder="max" style="width:80px;">
					<button id="tradeRefreshBtn" class="btn btn-secondary">Refresh</button>
					<button id="createTradeBtn" class="btn btn-primary">Create Listing</button>
				</div>

				<div id="tradesGrid" class="species-grid" style="margin-top:12px;"></div>
			</section>
		`;

	// Wire controls
	const tradeSearch = document.getElementById('tradeSearch');
	const tradeSpeciesFilter = document.getElementById('tradeSpeciesFilter');
	const tradeMinPrice = document.getElementById('tradeMinPrice');
	const tradeMaxPrice = document.getElementById('tradeMaxPrice');
	const statusFilter = document.getElementById('tradeStatusFilter');
	const refreshBtn = document.getElementById('tradeRefreshBtn');
	const createBtn = document.getElementById('createTradeBtn');

	// populate species filter from species DB
	waitForSpeciesDB(1000, 30).then(() => {
		const db = getSpeciesDB() || {};
		const speciesList = Object.values(db || {}).map(s => s.name).filter(Boolean).sort();
		const sel = document.getElementById('tradeSpeciesFilter');
		if (sel) sel.innerHTML = '<option value="">All Species</option>' + speciesList.map(s => `<option value="${s}">${s}</option>`).join('');
	});

	function fetchAndRenderTrades() {
		const q = {};
		const sp = (tradeSearch?.value || '').trim();
		const spFilter = (document.getElementById('tradeSpeciesFilter')?.value || '').trim();
		if (spFilter) q.species = spFilter;
		if (sp) q.species = sp; // quick search by species or name
		if (tradeMinPrice?.value) q.minPrice = tradeMinPrice.value;
		if (tradeMaxPrice?.value) q.maxPrice = tradeMaxPrice.value;
		// stat range filters
		const statFilter = (document.getElementById('tradeStatFilter')?.value || '').trim();
		const statMin = (document.getElementById('tradeStatMin')?.value || '').trim();
		const statMax = (document.getElementById('tradeStatMax')?.value || '').trim();
		if (statFilter) q.stat = statFilter;
		if (statMin) q.statMin = statMin;
		if (statMax) q.statMax = statMax;
		if (statusFilter?.value) q.status = statusFilter.value;
		const qs = new URLSearchParams(q).toString();
		apiRequest('/api/trades' + (qs ? ('?' + qs) : ''), { method: 'GET' })
		.then(({ res, body }) => {
			const grid = document.getElementById('tradesGrid');
			if (!res.ok) { grid.innerHTML = '<div class="no-species-found">Failed to load trades</div>'; return; }
			if (!Array.isArray(body) || body.length === 0) { grid.innerHTML = '<div class="no-species-found">No trades found</div>'; return; }
				grid.innerHTML = '';
				// optionally sort by selected stat (highest)
				const statSort = document.getElementById('tradeStatSort')?.value || '';
				if (statSort) {
					body.sort((a,b) => {
						const aVal = (a.creature && a.creature.baseStats && Number(a.creature.baseStats[statSort] || 0)) || 0;
						const bVal = (b.creature && b.creature.baseStats && Number(b.creature.baseStats[statSort] || 0)) || 0;
						return bVal - aVal; // descending
					});
				}
					// safely decode local user id from token for ownership checks
					const localUserId = (function() {
						try {
							const t = localStorage.getItem('token'); if (!t) return null;
							const payload = JSON.parse(atob(t.split('.')[1] || '')); return payload && payload.userId ? Number(payload.userId) : null;
						} catch (e) { return null; }
					})();

					// client-side stat-range filtering if server didn't apply it
					const serverDidFilter = !!q.stat || !!q.statMin || !!q.statMax;
					const filteredBody = body.filter(trade => {
						if (!trade.creature || !trade.creature.baseStats) return true;
						if (!statFilter && !statMin && !statMax) return true;
						const val = Number(trade.creature.baseStats?.[statFilter] || 0);
						if (statMin && val < Number(statMin)) return false;
						if (statMax && val > Number(statMax)) return false;
						return true;
					});
					filteredBody.forEach(trade => {
				const item = document.createElement('div');
						const owner = isLoggedIn() && localUserId && Number(trade.user_id) === Number(localUserId);
								// Render creature summary with full base stats (matching My Nuggies style)
								const statsHtml = (() => {
									try {
										const s = trade.creature.baseStats || {};
										const parts = ['Health','Stamina','Oxygen','Food','Weight','Melee'].map(k => `${k}: ${s[k]||0}`);
										return `<div class="stat-row">${parts.join(' • ')}</div>`;
									} catch (e) { return ''; }
								})();
						item.innerHTML = `
							<div class="species-card-header"><div class="species-icon">${trade.creature.icon || '🦖'}</div><div class="species-info"><div class="species-name">${trade.creature.name || trade.creature.species}</div><div class="species-meta">${trade.creature.species || ''} • ${trade.status || 'open'}</div></div><div class="species-count">${trade.price ? ('$' + trade.price) : ''}</div></div>
							<div class="species-card-body"><div>${trade.creature.description || ''}</div>${statsHtml}<div style="margin-top:8px;color:#94a3b8;">Wanted: ${trade.wanted || 'Any'}</div></div>
						`;
						// If owner, allow delete and view offers; otherwise allow making an offer
						if (isLoggedIn() && owner) {
							try {
								const del = document.createElement('button'); del.className = 'btn btn-danger'; del.textContent = 'Remove'; del.style.marginTop = '8px';
								del.onclick = async () => { await apiRequest('/api/trades/' + trade.id, { method: 'DELETE' }); fetchAndRenderTrades(); };
								const viewOffers = document.createElement('button'); viewOffers.className = 'btn btn-secondary'; viewOffers.textContent = 'View Offers'; viewOffers.style.marginLeft = '8px';
								viewOffers.onclick = async () => {
									// fetch offers for this trade and show in modal with accept/reject buttons
									const { res, body } = await apiRequest('/api/trades/' + trade.id + '/offers', { method: 'GET' });
									const modal = document.getElementById('creatureModal'); if (!modal) return alert('Modal container missing');
									if (!res.ok) return alert('Failed to load offers');
									// smaller modal and softer close button
									modal.classList.add('active'); modal.setAttribute('aria-hidden','false');
									modal.innerHTML = `<div class="modal-content" style="max-width:680px;margin:20px auto;"><div class="modal-header"><h3>Offers for ${trade.creature.name || trade.creature.species}</h3><button id="closeOffersModal" class="close-btn soft">Close</button></div><div class="modal-body" id="offersList"></div></div>`;
									document.getElementById('closeOffersModal').addEventListener('click', () => { modal.classList.remove('active'); modal.innerHTML = ''; modal.setAttribute('aria-hidden','true'); });
									const list = document.getElementById('offersList'); list.innerHTML = '';
									(body || []).forEach(o => {
										const row = document.createElement('div'); row.style.borderTop = '1px solid rgba(255,255,255,0.03)'; row.style.padding = '8px 0';
										// show from nickname when available
										const fromLabel = o.from_nickname ? `${o.from_nickname} (id:${o.from_user_id})` : `User ${o.from_user_id}`;
										let offeredPreview = '';
										try {
											if (o.offered_creature_data && Object.keys(o.offered_creature_data).length) {
												const oc = o.offered_creature_data;
												offeredPreview = `<div style=\"margin-top:6px;padding:8px;border:1px solid rgba(255,255,255,0.03);border-radius:6px;background:rgba(255,255,255,0.01);\"><div><strong>${oc.name||oc.species||'Creature'}</strong> • ${oc.species||''}</div><div style=\"color:#94a3b8;margin-top:6px;\">${(oc.baseStats? Object.keys(oc.baseStats).slice(0,3).map(k=>`${k}:${oc.baseStats[k]||0}`).join(' • '):'')}</div></div>`;
											}
										} catch (e) { offeredPreview = ''; }
										row.innerHTML = `<div><strong>From:</strong> ${fromLabel} • <strong>Price:</strong> ${o.offered_price || 'N/A'}</div><div style=\"color:#cbd5e1;\">${o.message || ''}</div>${offeredPreview}`;
										const acceptBtn = document.createElement('button'); acceptBtn.className = 'btn btn-primary'; acceptBtn.textContent = 'Accept'; acceptBtn.style.marginRight = '8px';
										const rejectBtn = document.createElement('button'); rejectBtn.className = 'btn btn-secondary'; rejectBtn.textContent = 'Reject';
										acceptBtn.onclick = async () => { await apiRequest('/api/offers/' + o.id, { method: 'PUT', body: JSON.stringify({ status: 'accepted' }) }); alert('Offer accepted'); modal.classList.remove('active'); modal.innerHTML = ''; fetchAndRenderTrades(); };
										rejectBtn.onclick = async () => { await apiRequest('/api/offers/' + o.id, { method: 'PUT', body: JSON.stringify({ status: 'rejected' }) }); alert('Offer rejected'); fetchAndRenderTrades(); };
										row.appendChild(acceptBtn); row.appendChild(rejectBtn); list.appendChild(row);
									}); // end offers forEach
								};
								item.querySelector('.species-card-body')?.appendChild(del);
								item.querySelector('.species-card-body')?.appendChild(viewOffers);
							} catch (err) {
								console.warn('open trade failed', err);
							}
						} else {
							const offerBtn = document.createElement('button');
							offerBtn.className = 'btn btn-primary';
							offerBtn.textContent = 'Make Offer';
							offerBtn.style.marginTop = '8px';
							offerBtn.onclick = () => {
								const modal = document.getElementById('creatureModal');
								if (!modal) return alert('Modal missing');
								// simplified modal: remove price field (not needed), narrower, softer close label
								modal.innerHTML = `<div class=\"modal-content\" style=\"max-width:640px;margin:20px auto;\"><div class=\"modal-header\"><h3>Make Offer</h3><button id=\"closeMakeOffer\" class=\"close-btn soft\">Close</button></div><div class=\"modal-body\"><div class=\"form-group\"><label class=\"form-label\">Offered Creature (optional)</label><select id=\"offerCreatureSelect\" class=\"form-control\">${(window.appState.creatures||[]).map(c=>`<option value=\"${c.id}\">${c.name} (${c.species})</option>`).join('')}</select></div><div class=\"form-group\"><label class=\"form-label\">Message</label><input id=\"offerMessageInput\" class=\"form-control\" type=\"text\"></div></div><div class=\"modal-footer\"><button class=\"btn btn-primary\" id=\"sendOfferBtn\">Send Offer</button></div></div>`;
								modal.classList.add('active');
								modal.setAttribute('aria-hidden','false');
								document.getElementById('closeMakeOffer').addEventListener('click', ()=>{
									modal.classList.remove('active');
									modal.innerHTML='';
									modal.setAttribute('aria-hidden','true');
								});
								document.getElementById('sendOfferBtn').addEventListener('click', async ()=>{
									const offeredCreatureId = document.getElementById('offerCreatureSelect')?.value || null;
									const message = document.getElementById('offerMessageInput')?.value || null;
									const creatureData = (window.appState.creatures||[]).find(c=>String(c.id)===String(offeredCreatureId)) || null;
									await apiRequest('/api/trades/' + trade.id + '/offers', { method: 'POST', body: JSON.stringify({ offered_creature_id: (!String(offeredCreatureId).startsWith('creature_') ? Number(offeredCreatureId) : null), offered_creature_data: creatureData, message }) });
									modal.classList.remove('active');
									modal.innerHTML='';
									modal.setAttribute('aria-hidden','true');
									alert('Offer sent');
								});
							};
							item.querySelector('.species-card-body')?.appendChild(offerBtn);
						}
						grid.appendChild(item);
					}); // end forEach
				})
				.catch(err => {
					const grid = document.getElementById('tradesGrid');
					if (grid) grid.innerHTML = '<div class="no-species-found">Failed to load trades</div>';
				});

	refreshBtn?.addEventListener('click', fetchAndRenderTrades);
	tradeSearch?.addEventListener('input', debounce(fetchAndRenderTrades, 180));
	document.getElementById('tradeSpeciesFilter')?.addEventListener('change', fetchAndRenderTrades);
	document.getElementById('tradeStatusFilter')?.addEventListener('change', fetchAndRenderTrades);

		// Create listing flow: pick one of your creatures and submit (no price field)
		createBtn?.addEventListener('click', () => {
			const modal = document.getElementById('creatureModal');
			if (!modal) return alert('Modal area missing');
			const myCreatures = (window.appState.creatures || []).slice();
			modal.innerHTML = `<div class="modal-content" style="max-width:680px;margin:20px auto;"><div class="modal-header"><h3>Create Trade</h3><button id="closeTradeModal" class="close-btn soft">Close</button></div><div class="modal-body"><div><label class="form-label">Select Creature</label><select id="tradeCreatureSelect" class="form-control">${myCreatures.map(c => `<option value="${c.id}">${c.name} (${c.species})</option>`).join('')}</select></div><div class="form-group"><label class="form-label">Wanted (optional)</label><input id="tradeWantedInput" class="form-control" type="text"></div></div><div class="modal-footer"><button class="btn btn-primary" id="postTradeBtn">Post</button></div></div>`;
			modal.classList.add('active'); modal.setAttribute('aria-hidden','false');
			document.getElementById('closeTradeModal')?.addEventListener('click', () => { modal.classList.remove('active'); modal.innerHTML = ''; modal.setAttribute('aria-hidden','true'); });
			document.getElementById('postTradeBtn')?.addEventListener('click', async () => {
				const selectedId = document.getElementById('tradeCreatureSelect')?.value;
				const wanted = document.getElementById('tradeWantedInput')?.value || null;
				const creature = myCreatures.find(c => String(c.id) === String(selectedId));
				if (!creature) return alert('Select a creature');
				// Post a snapshot and reference if available; price omitted intentionally
				await apiRequest('/api/trades', { method: 'POST', body: JSON.stringify({ creature_card_id: (!String(creature.id).startsWith('creature_') ? Number(creature.id) : null), creature_data: creature, wanted }) });
				modal.classList.remove('active'); modal.innerHTML = ''; modal.setAttribute('aria-hidden','true');
				fetchAndRenderTrades();
			});
		});

	// initial load
	fetchAndRenderTrades();
}

function loadBossPlanner() {
    const main = document.getElementById('appMainContent');
    if (!main) return;

    main.innerHTML = `
        <section class="boss-planner-page">
            <div class="page-header">
                <h1>Boss Planner</h1>
                <div class="section-sub">Plan boss fights, rewards and party composition</div>
            </div>
            <div class="boss-controls">
                <input id="bossSearch" class="form-control" placeholder="Search bosses..." style="max-width:320px;"> 
                <select id="bossMapFilter" class="form-control" style="max-width:220px;">
                    <option value="">All Maps</option>
                    <option>The Island</option>
                    <option>Scorched Earth</option>
                    <option>The Center</option>
                    <option>Aberration</option>
                    <option>Ragnarok</option>
                    <option>Astraeos</option>
                    <option>Extinction</option>
                </select>
                <span class="boss-storage-note">Stored locally (per browser)</span>
            </div>
            <div id="bossGrid" class="boss-grid"></div>
        </section>
    `;

    // Initialize listeners
    document.getElementById('bossSearch')?.addEventListener('input', debounce(() => {
        const searchTerm = document.getElementById('bossSearch')?.value.toLowerCase() || '';
        const mapFilter = document.getElementById('bossMapFilter')?.value || '';
        
        const bossGrid = document.getElementById('bossGrid');
        if (!bossGrid) return;

        // Simulated boss data (replace with actual data structure)
        const bosses = [
            { id: 'megapithecus', name: 'Megapithecus', map: 'The Island', difficulty: 'Alpha' },
            { id: 'broodmother', name: 'Broodmother Lysrix', map: 'The Island', difficulty: 'Beta' },
            { id: 'dragon', name: 'Dragon', map: 'The Island', difficulty: 'Gamma' },
            // Add more bosses here
        ];

        const filteredBosses = bosses.filter(boss => {
            if (searchTerm && !boss.name.toLowerCase().includes(searchTerm)) {
                return false;
            }
            if (mapFilter && boss.map !== mapFilter) {
                return false;
            }
            return true;
        });

        bossGrid.innerHTML = filteredBosses.map(boss => `
            <div class="boss-card" data-boss-id="${boss.id}">
                <div class="boss-card-header">
                    <h3>${boss.name}</h3>
                    <span class="boss-difficulty ${boss.difficulty.toLowerCase()}">${boss.difficulty}</span>
                </div>
                <div class="boss-card-content">
                    <div class="boss-map">${boss.map}</div>
                    <button class="btn btn-primary plan-fight">Plan Fight</button>
                </div>
            </div>
        `).join('');

        // Add click handlers for "Plan Fight" buttons
        document.querySelectorAll('.plan-fight').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const bossId = e.target.closest('.boss-card').dataset.bossId;
                showBossPlannerModal(bossId);
            });
        });
    }, 220));

    // Initial render (trigger search with empty term)
    document.getElementById('bossSearch')?.dispatchEvent(new Event('input'));

	// Render arenas by default
	renderArenaGrid();
}

// Boss Planner storage helpers (namespaced per-user)
const BOSS_STORAGE_KEY_BASE = 'bossPlanner.v1';
function getBossData() {
	try { const raw = localStorage.getItem(getUserKey(BOSS_STORAGE_KEY_BASE)); return raw ? JSON.parse(raw) : []; } catch (e) { console.warn('bossPlanner: failed to read storage', e); return []; }
}
function saveBossData(data) {
	try { localStorage.setItem(getUserKey(BOSS_STORAGE_KEY_BASE), JSON.stringify(data)); } catch (e) { console.warn('bossPlanner: failed to save', e); }
	// also sync to server when logged in
	try { if (localStorage.getItem('token')) saveBossDataToServer(data); } catch (e) {}
}

// Arena and boss definitions used for the Boss Planner UI (grouped by arena)
const ARENAS = [
	// The Island guardians
	{ id: 'island_dragon', arena: 'The Island - Dragon', map: 'The Island', bosses: [{ id: 'dragon', name: 'Dragon', notes: 'Fire-breathing dragon. Ranged tactics recommended.' }] },
	{ id: 'island_megapithecus', arena: 'The Island - Megapithecus', map: 'The Island', bosses: [{ id: 'megapithecus', name: 'Megapithecus', notes: 'Giant ape boss.' }] },
	{ id: 'island_broodmother', arena: 'The Island - Broodmother', map: 'The Island', bosses: [{ id: 'broodmother', name: 'Broodmother Lysrix', notes: 'Spawns insect minions causing torpor.' }] },
	// Island ascension boss
	{ id: 'island_overseer', arena: 'The Island - Overseer', map: 'The Island', bosses: [{ id: 'overseer', name: 'Overseer', notes: 'Final ascension boss fought in the Tek Cave.' }] },

	// Ragnarok: Nunatak plus mini-bosses referenced in the guide
	{ id: 'rag_nunatak', arena: 'Ragnarok - Nunatak', map: 'Ragnarok', bosses: [{ id: 'nunatak', name: 'Nunatak', notes: 'Massive ice wyvern; freezing attacks.' }] },
	{ id: 'rag_iceworm_queen', arena: 'Ragnarok - Iceworm Queen (Frozen Dungeon)', map: 'Ragnarok', bosses: [{ id: 'iceworm_queen', name: 'Iceworm Queen', notes: 'Mini-boss in the Frozen Dungeon; spawns Ice Worms.' }] },
	{ id: 'rag_lava_elemental', arena: 'Ragnarok - Lava Elemental (Jungle Dungeon)', map: 'Ragnarok', bosses: [{ id: 'lava_elemental', name: 'Lava Elemental', notes: 'Mini-boss in the Jungle Dungeon.' }] },

	// The Center dual arena
	{ id: 'center_dual', arena: 'The Center - Dual Arena', map: 'The Center', bosses: [{ id: 'dual_brood_meg', name: 'Dual: Broodmother + Megapithecus', notes: 'Two bosses spawn at once; extreme difficulty.' }] },

	// Scorched Earth
	{ id: 'scorched_manticore', arena: 'Scorched Earth - Manticore', map: 'Scorched Earth', bosses: [{ id: 'manticore', name: 'Manticore', notes: 'Venom projectiles and elementals.' }] },

	// Aberration
	{ id: 'aberration_rockwell', arena: 'Aberration - Rockwell', map: 'Aberration', bosses: [{ id: 'rockwell', name: 'Rockwell', notes: 'Mutated human-plant hybrid, radiation hazards.' }] },

	// Astraeos (custom / mythological themed map) – include main bosses and notable myth enemies
	{ id: 'astraeos_thodes', arena: 'Astraeos - Thodes (Widowmaker)', map: 'Astraeos', bosses: [{ id: 'thodes_widowmaker', name: 'Thodes the Widowmaker', notes: 'Primary Greek-mythology style boss for Astraeos.' }] },
	{ id: 'astraeos_natrix', arena: 'Astraeos - Natrix (Devious)', map: 'Astraeos', bosses: [{ id: 'natrix_devious', name: 'Natrix the Devious', notes: 'Secondary Astraeos boss.' }] },
	{ id: 'astraeos_medusa', arena: 'Astraeos - Medusa', map: 'Astraeos', bosses: [{ id: 'medusa', name: 'Medusa', notes: 'Mythological enemy encountered in caves.' }] },
	{ id: 'astraeos_minotaur', arena: 'Astraeos - Minotaur', map: 'Astraeos', bosses: [{ id: 'minotaur', name: 'Minotaur', notes: 'Legendary beast encounter.' }] },

	// Extinction Titans and King Titan
	{ id: 'extinction_desert_titan', arena: 'Extinction - Desert Titan', map: 'Extinction', bosses: [{ id: 'desert_titan', name: 'Desert Titan', notes: 'Massive flying titan; teleport mechanics.' }] },
	{ id: 'extinction_forest_titan', arena: 'Extinction - Forest Titan', map: 'Extinction', bosses: [{ id: 'forest_titan', name: 'Forest Titan', notes: 'Extremely slow but powerful; destroys surroundings.' }] },
	{ id: 'extinction_ice_titan', arena: 'Extinction - Ice Titan', map: 'Extinction', bosses: [{ id: 'ice_titan', name: 'Ice Titan', notes: 'Agile frost titan with freeze attacks.' }] },
	{ id: 'extinction_king_titan', arena: 'Extinction - King Titan', map: 'Extinction', bosses: [{ id: 'king_titan', name: 'King Titan', notes: 'Final Titan boss; keep fight centered.' }] }
];

// Assignment storage: maps bossId -> array of creature ids (namespaced per-user)
const ASSIGNMENT_KEY_BASE = 'bossPlanner.assignments.v1';
function getAssignments() { try { return JSON.parse(localStorage.getItem(getUserKey(ASSIGNMENT_KEY_BASE)) || '{}'); } catch (e) { return {}; } }
function saveAssignments(a) { try { localStorage.setItem(getUserKey(ASSIGNMENT_KEY_BASE), JSON.stringify(a)); } catch (e) {} }

// Invites storage (keeps invited user ids per boss locally until server-side invites implemented) - namespaced per-user
const INVITE_STORAGE_KEY_BASE = 'bossPlanner.invites.v1';
function getInvites() { try { return JSON.parse(localStorage.getItem(getUserKey(INVITE_STORAGE_KEY_BASE)) || '{}'); } catch (e) { return {}; } }
function saveInvites(v) { try { localStorage.setItem(getUserKey(INVITE_STORAGE_KEY_BASE), JSON.stringify(v)); } catch (e) {} }

// Timers storage (per-boss scheduled timestamp) - namespaced per-user
const TIMER_STORAGE_KEY_BASE = 'bossPlanner.timers.v1';
function getTimers() { try { return JSON.parse(localStorage.getItem(getUserKey(TIMER_STORAGE_KEY_BASE)) || '{}'); } catch (e) { return {}; } }
function saveTimers(t) { try { localStorage.setItem(getUserKey(TIMER_STORAGE_KEY_BASE), JSON.stringify(t)); } catch (e) {} }

function getUserCreatures() {
    try {
        if (window.appState && Array.isArray(window.appState.creatures) && window.appState.creatures.length) {
            return window.appState.creatures;
        }
        const raw = localStorage.getItem(getCreatureStorageKey());
        if (!raw) return [];
        return JSON.parse(raw || '[]');
    } catch (e) {
        console.warn('Failed to get user creatures', e);
        return [];
    }
}

// Return a per-user storage key for creatures so different accounts don't mix local data.
function getCreatureStorageKey() {
	try {
		const email = (localStorage.getItem('userEmail') || '').toString().toLowerCase();
		const nick = (localStorage.getItem('userNickname') || '').toString().toLowerCase();
		const user = email || nick || '';
		const safe = user ? encodeURIComponent(user).replace(/%/g,'') : 'anon';
		return `arkCreatures:${safe}`;
	} catch (e) { return 'arkCreatures:anon'; }
}

// Return a per-user storage key for any base key. Uses userEmail/userNickname for scoping.
function getUserKey(baseKey) {
	try {
		const email = (localStorage.getItem('userEmail') || '').toString().toLowerCase();
		const nick = (localStorage.getItem('userNickname') || '').toString().toLowerCase();
		const user = email || nick || '';
		const safe = user ? encodeURIComponent(user).replace(/%/g,'') : 'anon';
		return `${baseKey}:${safe}`;
	} catch (e) { return `${baseKey}:anon`; }
}

// Migrate legacy global keys into per-user namespaced keys on first startup for this user
function migrateLegacyKeysToUser() {
	try {
		const mappings = [
			{ global: 'arkCreatures', user: getCreatureStorageKey() },
			{ global: 'arkTribeSettings', user: getUserKey('arkTribeSettings') },
			{ global: 'bossPlanner.v1', user: getUserKey(BOSS_STORAGE_KEY_BASE) },
			{ global: 'bossPlanner.assignments.v1', user: getUserKey(ASSIGNMENT_KEY_BASE) },
			{ global: 'bossPlanner.invites.v1', user: getUserKey(INVITE_STORAGE_KEY_BASE) },
			{ global: 'bossPlanner.timers.v1', user: getUserKey(TIMER_STORAGE_KEY_BASE) },
			{ global: 'arenaCreatures.v1', user: getUserKey(ARENA_CREATURES_KEY_BASE) }
		];
		mappings.forEach(m => {
			try {
				const globalVal = localStorage.getItem(m.global);
				const userVal = localStorage.getItem(m.user);
				if (globalVal && (!userVal || userVal === 'null')) {
					localStorage.setItem(m.user, globalVal);
					console.info('migrated', m.global, '->', m.user);
				}
			} catch (e) { /* ignore per-key errors */ }
		});
	} catch (e) { console.warn('migration failed', e); }
}

// Arena-specific creature storage: key maps arenaId -> array of creature objects (namespaced per-user)
const ARENA_CREATURES_KEY_BASE = 'arenaCreatures.v1';
function getArenaCreatures() { try { return JSON.parse(localStorage.getItem(getUserKey(ARENA_CREATURES_KEY_BASE)) || '{}'); } catch (e) { return {}; } }
function saveArenaCreatures(obj) { try { localStorage.setItem(getUserKey(ARENA_CREATURES_KEY_BASE), JSON.stringify(obj)); } catch (e) {} }
function saveArenaCreaturesWithSync(obj) { try { saveArenaCreatures(obj); } catch (e) {} try { if (localStorage.getItem('token')) saveArenaCollectionsToServer(obj); } catch (e) {} }

// Sync helpers for boss planner and arena collections
async function loadServerBossData() {
	try {
		if (!localStorage.getItem('token')) return null;
		const { res, body } = await apiRequest('/api/boss/data', { method: 'GET' });
		if (res.ok && body && body.data) {
			try { localStorage.setItem(getUserKey(BOSS_STORAGE_KEY_BASE), JSON.stringify(body.data)); } catch (e) {}
			return body.data;
		}
	} catch (e) { console.warn('loadServerBossData failed', e); }
	return null;
}

async function saveBossDataToServer(data) {
	try {
		if (!localStorage.getItem('token')) return false;
		await apiRequest('/api/boss/data', { method: 'PUT', body: JSON.stringify({ data }) });
		return true;
	} catch (e) { console.warn('saveBossDataToServer failed', e); return false; }
}

async function loadServerArenaCollections() {
	try {
		if (!localStorage.getItem('token')) return null;
		const { res, body } = await apiRequest('/api/arena/creatures', { method: 'GET' });
		if (res.ok && body && body.data) {
			try { localStorage.setItem(getUserKey(ARENA_CREATURES_KEY_BASE), JSON.stringify(body.data)); } catch (e) {}
			return body.data;
		}
	} catch (e) { console.warn('loadServerArenaCollections failed', e); }
	return null;
}

async function saveArenaCollectionsToServer(data) {
	try {
		if (!localStorage.getItem('token')) return false;
		await apiRequest('/api/arena/creatures', { method: 'PUT', body: JSON.stringify({ data }) });
		return true;
	} catch (e) { console.warn('saveArenaCollectionsToServer failed', e); return false; }
}

function renderArenaCreatureList(arenaId) {
	const wrap = document.getElementById('arenaCreatureList'); if (!wrap) return;
	const all = getArenaCreatures(); const list = Array.isArray(all[arenaId]) ? all[arenaId] : [];
	wrap.innerHTML = '';
	if (!list.length) { wrap.innerHTML = '<div style="color:#666">No creatures added to this arena yet.</div>'; return; }
	list.forEach(c => {
		const item = document.createElement('div'); item.className = 'species-card'; item.style = 'padding:8px;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between';
		item.innerHTML = `<div style="display:flex;gap:8px;align-items:center"><div style="width:56px;height:56px;border-radius:6px;overflow:hidden;background:#f7fafc">${isValidImageUrl(c.image)?'<img src="'+c.image+'" style="width:56px;height:56px;object-fit:cover">':(c.icon||'🦖')}</div><div><div style="font-weight:700">${escapeHtml(c.name||c.species||'Creature')}</div><div style="font-size:12px;color:#666">${escapeHtml(c.species||'')}</div></div></div><div><button class="btn btn-small btn-secondary remove-arena-creature">Remove</button></div>`;
		const btn = item.querySelector('.remove-arena-creature'); btn?.addEventListener('click', () => {
			const all = getArenaCreatures(); all[arenaId] = (all[arenaId]||[]).filter(x => String(x.id) !== String(c.id)); saveArenaCreaturesWithSync(all); renderArenaCreatureList(arenaId);
		});
		wrap.appendChild(item);
	});
}

function openAddCreatureModal(arenaId) {
	const modal = document.getElementById('creatureModal'); if (!modal) return alert('Modal missing');
	const my = getUserCreatures(); if (!my || my.length === 0) {
		// allow quick upload from file (not implemented fully) or instruct user
		return alert('No saved creatures found. Create or import creatures in My Nuggies first.');
	}
	modal.classList.add('active'); modal.setAttribute('aria-hidden','false');
	modal.innerHTML = `<div class="modal-content" style="max-width:720px;margin:20px auto;"><div class="modal-header"><h3>Add Creature to Arena</h3><button id="closeAddCreatureModal" class="close-btn soft">Close</button></div><div class="modal-body"><div style="margin-bottom:8px;color:#666">Select one or more of your saved creature cards to copy into this arena.</div><div id="addCreatureList" style="max-height:420px;overflow:auto"></div></div><div class="modal-footer"><button class="btn btn-primary" id="addSelectedToArenaBtn">Add Selected</button><button class="btn btn-secondary" id="cancelAddCreatureBtn">Cancel</button></div></div>`;
	document.getElementById('closeAddCreatureModal')?.addEventListener('click', () => { modal.classList.remove('active'); modal.innerHTML=''; modal.setAttribute('aria-hidden','true'); });
	document.getElementById('cancelAddCreatureBtn')?.addEventListener('click', () => { modal.classList.remove('active'); modal.innerHTML=''; modal.setAttribute('aria-hidden','true'); });
	const listWrap = document.getElementById('addCreatureList'); listWrap.innerHTML = '';
	my.forEach(c => {
		const el = document.createElement('div'); el.style='padding:8px;border-bottom:1px solid rgba(255,255,255,0.03);display:flex;align-items:center;justify-content:space-between';
		el.innerHTML = `<div style="display:flex;gap:8px;align-items:center"><div style="width:48px;height:48px;border-radius:6px;overflow:hidden">${isValidImageUrl(c.image)?'<img src="'+c.image+'" style="width:48px;height:48px;object-fit:cover">':(c.icon||'🦖')}</div><div><div style="font-weight:700">${escapeHtml(c.name||c.species||'Creature')}</div><div style="font-size:12px;color:#666">${escapeHtml(c.species||'')}</div></div></div><div><input type="checkbox" data-id="${escapeHtml(String(c.id))}" class="add-arena-checkbox"></div>`;
		listWrap.appendChild(el);
	});
	document.getElementById('addSelectedToArenaBtn')?.addEventListener('click', () => {
		const checks = Array.from(document.querySelectorAll('.add-arena-checkbox')).filter(x=>x.checked).map(x=>x.getAttribute('data-id'));
		if (!checks.length) return alert('Select at least one creature');
	const my = getUserCreatures(); const selected = my.filter(c => checks.includes(String(c.id)));
	const all = getArenaCreatures(); all[arenaId] = (all[arenaId]||[]).concat(selected.map(c=>({ ...c }))); saveArenaCreaturesWithSync(all);
		modal.classList.remove('active'); modal.innerHTML=''; modal.setAttribute('aria-hidden','true'); renderArenaCreatureList(arenaId);
	});
}

function renderBossList() {
	const listEl = document.getElementById('bossList');
	const detailEl = document.getElementById('bossDetail');
	if (!listEl) return;
	const all = getBossData();
	const search = (document.getElementById('bossSearch')?.value || '').toLowerCase();
	const mapFilter = (document.getElementById('bossMapFilter')?.value || '').toLowerCase();
	let data = all.slice();
	if (mapFilter) data = data.filter(d => (d.map||'').toLowerCase().includes(mapFilter));
	if (search) data = data.filter(d => (d.name||'').toLowerCase().includes(search) || (d.notes||'').toLowerCase().includes(search));
	if (!data.length) {
		listEl.innerHTML = '<div class="no-items">No bosses defined yet. Click "Add Boss" to get started.</div>';
		if (detailEl) detailEl.innerHTML = '';
		return;
	}
	// group by map
	const groups = {};
	data.forEach(b => { const m = b.map || 'Unknown'; if (!groups[m]) groups[m] = []; groups[m].push(b); });
	listEl.innerHTML = '';
	Object.keys(groups).forEach(mapName => {
		const header = document.createElement('div'); header.style = 'font-weight:700;padding:6px 4px;color:#222;background:#f9f9f9;border-bottom:1px solid #eee;margin-top:8px'; header.textContent = mapName; listEl.appendChild(header);
		groups[mapName].forEach(b => {
			const item = document.createElement('div');
			item.className = 'boss-item';
			item.style = 'padding:10px;border:1px solid #eee;margin-bottom:8px;border-radius:6px;cursor:pointer;background:#fff';
			item.innerHTML = `<div style="display:flex;align-items:center;gap:10px;"><div style="flex:1"><strong>${escapeHtml(b.name||'Untitled')}</strong><div style="font-size:12px;color:#666">Level: ${escapeHtml(String(b.level||''))} • Party: ${escapeHtml(String(b.partySize||''))}</div></div><div><button class="btn btn-small edit-btn">Edit</button> <button class="btn btn-small danger delete-btn">Delete</button></div></div>`;
			item.addEventListener('click', (e) => {
				// if clicked on buttons, ignore outer click
				if (e.target && (e.target.classList.contains('edit-btn') || e.target.classList.contains('delete-btn'))) return;
				showBossDetail(b.id);
			});
			item.querySelector('.edit-btn')?.addEventListener('click', (ev) => { ev.stopPropagation(); openBossModal(b.id); });
			item.querySelector('.delete-btn')?.addEventListener('click', (ev) => { ev.stopPropagation(); if (confirm('Delete boss "'+(b.name||'')+'"?')) { const next = getBossData().filter(x=>x.id!==b.id); saveBossData(next); renderBossList(); if (detailEl) detailEl.innerHTML=''; } });
			listEl.appendChild(item);
		});
	});
	// show first detail by default
	if (data.length && detailEl) showBossDetail(data[0].id);
}

// --- New arena-based rendering ---
function renderArenaGrid() {
	const wrap = document.getElementById('arenaGrid'); if (!wrap) return;
	wrap.innerHTML = '';
	ARENAS.forEach(ar => {
	// Use species-card styling so it matches the creature page
	const card = document.createElement('div');
	card.className = 'species-card';
	card.tabIndex = 0;
	card.style.cursor = 'pointer';
	const inner = document.createElement('div');
	inner.className = 'species-card-header';
	inner.innerHTML = `<div class="species-icon">🎯</div><div class="species-info"><div class="species-name">${escapeHtml(ar.arena)}</div><div class="species-meta">${escapeHtml(ar.map||'')}</div></div><div class="species-count">${(ar.bosses||[]).length}</div>`;
	card.appendChild(inner);
	const body = document.createElement('div'); body.className = 'species-card-body'; body.innerHTML = `<div style="font-size:13px;color:#666">${escapeHtml((ar.bosses||[]).map(b=>b.name).join(', '))}</div>`;
	card.appendChild(body);
	card.addEventListener('click', () => openArenaPage(ar.id));
	wrap.appendChild(card);
	});
}

function openArenaPage(arenaId) {
	// Render a full arena page (replace main content) so navigation flows: Boss Planner -> Arena -> Arena Page
	const main = document.getElementById('appMainContent'); if (!main) return;
	const arena = ARENAS.find(a=>a.id===arenaId);
	if (!arena) { main.innerHTML = '<div class="no-items">Arena not found</div>'; return; }
	main.innerHTML = `
		<section class="arena-page">
			<div class="page-header"><h1>${escapeHtml(arena.arena)}</h1><div class="section-sub">Map: ${escapeHtml(arena.map||'')}</div></div>
			<div style="margin-top:12px;display:flex;gap:18px;align-items:flex-start;">
				<div style="flex:1;min-width:360px;">
					<div id="arenaBossListPage" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px"></div>
				</div>
				<div style="width:420px;flex:0 0 420px;">
					<div id="arenaBossRightPanel" style="background:#fff;border:1px solid #eee;padding:12px;border-radius:6px;min-height:120px"></div>
				</div>
			</div>
		</section>`;
	// render bosses into the list and wire clicks to open assignment panel
	const listEl = document.getElementById('arenaBossListPage');
	const rightPanel = document.getElementById('arenaBossRightPanel');
	listEl.innerHTML = '';
	// Add 'Add Creature' button in right panel for uploading/copying saved creatures
	if (rightPanel) {
		rightPanel.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between"><h4 style="margin:0">Arena Tools</h4><div><button id="arenaAddCreatureBtn" class="btn btn-primary">Add Creature</button></div></div><div id="arenaCreatureList" style="margin-top:10px;max-height:300px;overflow:auto"></div>`;
		document.getElementById('arenaAddCreatureBtn')?.addEventListener('click', () => openAddCreatureModal(arenaId));
		renderArenaCreatureList(arenaId);
	}
	(arena.bosses||[]).forEach(b => {
		const card = document.createElement('div'); card.className='boss-card'; card.style='background:#fff;border:1px solid #eee;padding:10px;border-radius:8px;display:flex;flex-direction:column;gap:8px;cursor:pointer';
		const h = document.createElement('div'); h.style='display:flex;align-items:center;justify-content:space-between'; h.innerHTML = `<div><strong>${escapeHtml(b.name||'Untitled')}</strong><div style="font-size:12px;color:#666">Level: ${escapeHtml(String(b.level||''))} • Party: ${escapeHtml(String(b.partySize||''))}</div></div><div><button class="btn btn-small edit-btn">Edit</button> <button class="btn btn-small danger delete-btn">Delete</button></div></div>`;
		card.appendChild(h);
		card.addEventListener('click', () => {
			// open assignment panel in right column
			openBossAssignment(b);
		});
		listEl.appendChild(card);
	});
}

function renderArenaBosses(arena) {
	const list = document.getElementById('arenaBossList'); if (!list) return;
	list.innerHTML = '';
	const assignments = getAssignments();
	(arena.bosses||[]).forEach(b => {
		const card = document.createElement('div'); card.className='boss-card'; card.style='background:#fff;border:1px solid #eee;padding:10px;border-radius:8px;display:flex;flex-direction:column;gap:8px;';
		const h = document.createElement('div'); h.style='display:flex;align-items:center;justify-content:space-between'; h.innerHTML = `<div><strong>${escapeHtml(b.name||'Untitled')}</strong><div style="font-size:12px;color:#666">Level: ${escapeHtml(String(b.level||''))} • Party: ${escapeHtml(String(b.partySize||''))}</div></div>`;
		const assignCount = (assignments[b.id] || []).length;
		const actions = document.createElement('div'); actions.style='display:flex;gap:6px;align-items:center';
		const assignBtn = document.createElement('button'); assignBtn.className='btn btn-primary'; assignBtn.textContent = 'Assign Creatures';
		const countBadge = document.createElement('span'); countBadge.style='background:#f1f1f1;padding:6px;border-radius:6px;font-size:13px'; countBadge.textContent = assignCount + ' assigned';
		assignBtn.addEventListener('click', () => openBossAssignment(b));
		actions.appendChild(assignBtn); actions.appendChild(countBadge);
		h.appendChild(actions);
		card.appendChild(h);
		list.appendChild(card);
	});
}

function openBossAssignment(boss) {
	const detail = document.getElementById('arenaBossDetail'); if (!detail) return;
	const assignments = getAssignments();
	const assigned = new Set((assignments[boss.id] || []).slice());
	const creatures = getUserCreatures();
	// Build the planning page: left = assign creatures, right = invites + timer
	detail.innerHTML = `<div style="display:flex;gap:12px;align-items:flex-start"><div style="flex:1"><div style="display:flex;align-items:center;justify-content:space-between"><div><h3 style="margin:0">${escapeHtml(boss.name||'Untitled')}</h3><div style="color:#666">${escapeHtml(boss.notes||'')}</div></div><div><button id="backToArenaBtn" class="btn btn-secondary">← Back</button></div></div><div style="margin-top:10px"><strong>Assign your saved creature cards to this boss</strong></div><div id="assignGrid" style="margin-top:10px;display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;max-height:56vh;overflow:auto;padding-right:6px"></div><div style="margin-top:8px"><button id="saveAssignBtn" class="btn btn-primary">Save Assignments</button> <button id="clearAssignBtn" class="btn btn-secondary">Clear</button></div></div><div style="width:360px;flex:0 0 360px;background:#fff;border:1px solid #eee;border-radius:8px;padding:12px;"><h4 style="margin-top:0">Invites</h4><div style="font-size:13px;color:#666;margin-bottom:8px">Invite tribemates or other users to join this fight (local invites until server-side invites are available)</div><div style="display:flex;gap:8px;margin-bottom:8px"><input id="userSearchInput" class="form-control" placeholder="Search users by email or nickname"> <button id="userSearchBtn" class="btn btn-secondary">Search</button></div><div id="userSearchResults" style="max-height:160px;overflow:auto;margin-bottom:8px"></div><div><strong>Invited</strong><div id="invitedList" style="margin-top:8px;max-height:120px;overflow:auto"></div></div><hr><h4>Timer</h4><div style="font-size:13px;color:#666;margin-bottom:6px">Set a countdown to alert invited users locally when the fight is about to begin.</div><div style="display:flex;gap:8px;align-items:center;margin-bottom:8px"><input id="timerMinutes" class="form-control" type="number" min="0" placeholder="Minutes"> <button id="startTimerBtn" class="btn btn-primary">Start</button> <button id="stopTimerBtn" class="btn btn-secondary">Stop</button></div><div id="timerDisplay" style="font-weight:700;color:#d946ef"></div></div></div>`;
	document.getElementById('backToArenaBtn')?.addEventListener('click', () => { renderArenaGrid(); document.getElementById('arenaBossDetail').innerHTML = ''; });
	const grid = document.getElementById('assignGrid'); if (!grid) return;
	creatures.forEach(c => {
		const card = document.createElement('div'); card.className='species-card'; card.style='cursor:pointer;padding:8px;';
		const icon = document.createElement('div'); icon.className='species-icon'; icon.innerHTML = isValidImageUrl(c.image) ? `<img src="${c.image}" alt="${escapeHtml(c.name||c.species||'Creature')}" style="width:56px;height:56px;border-radius:6px;object-fit:cover">` : (c.icon || '🦖');
		const info = document.createElement('div'); info.className='species-info'; info.innerHTML = `<div class="species-name">${escapeHtml(c.name||c.species||'Creature')}</div><div class="species-meta" style="font-size:12px;color:#666">${c.level?('Lvl '+c.level):''}</div>`;
		const right = document.createElement('div'); right.style='display:flex;align-items:center;gap:8px';
		const cb = document.createElement('input'); cb.type='checkbox'; cb.checked = assigned.has(c.id);
		cb.addEventListener('change', () => { if (cb.checked) assigned.add(c.id); else assigned.delete(c.id); });
		right.appendChild(cb);
		card.appendChild(icon); card.appendChild(info); card.appendChild(right);
		grid.appendChild(card);
	});

	document.getElementById('saveAssignBtn')?.addEventListener('click', () => {
		const assignments = getAssignments(); assignments[boss.id] = Array.from(assigned); saveAssignments(assignments); renderArenaGrid(); renderArenaBosses(ARENAS.find(a=> (a.bosses||[]).some(bb=>bb.id===boss.id) )); alert('Saved ' + assigned.size + ' assignments for ' + (boss.name||'this boss'));
	});
	document.getElementById('clearAssignBtn')?.addEventListener('click', () => {
		if (!confirm('Clear assignments for this boss?')) return; const assignments = getAssignments(); delete assignments[boss.id]; saveAssignments(assignments); renderArenaGrid(); renderArenaBosses(ARENAS.find(a=> (a.bosses||[]).some(bb=>bb.id===boss.id) )); detail.innerHTML = '';
	});

	// --- Invite UI wiring ---
	const searchInput = document.getElementById('userSearchInput');
	const searchBtn = document.getElementById('userSearchBtn');
	const resultsEl = document.getElementById('userSearchResults');
	const invitedListEl = document.getElementById('invitedList');
	const invites = getInvites();
	const invited = new Set((invites[boss.id] || []).slice());
	function renderInvited() {
		invitedListEl.innerHTML = '';
		Array.from(invited).forEach(uid => {
			const row = document.createElement('div'); row.style='display:flex;justify-content:space-between;align-items:center;padding:6px;border-bottom:1px solid #f4f4f4';
			row.textContent = uid;
			const rem = document.createElement('button'); rem.className='btn btn-small'; rem.textContent='Remove'; rem.addEventListener('click', ()=>{ invited.delete(uid); saveInvites(Object.assign(getInvites(), { [boss.id]: Array.from(invited) })); renderInvited(); });
			row.appendChild(rem);
			invitedListEl.appendChild(row);
		});
	}
	renderInvited();

	async function doUserSearch(q) {
		resultsEl.innerHTML = '<div class="loading">Searching...</div>';
		if (!q) { resultsEl.innerHTML = ''; return; }
		if (!isLoggedIn()) { resultsEl.innerHTML = '<div style="color:#cbd5e1">Sign in to search users</div>'; return; }
		try {
			const { res, body } = await apiRequest('/api/users/search?q=' + encodeURIComponent(q), { method: 'GET' });
			if (!res.ok) { resultsEl.innerHTML = '<div style="color:#cbd5e1">Search failed</div>'; return; }
			const arr = Array.isArray(body) ? body : [];
			resultsEl.innerHTML = '';
			arr.forEach(u => {
				const r = document.createElement('div'); r.style='padding:6px;border-bottom:1px solid #f4f4f4;display:flex;justify-content:space-between;align-items:center';
				r.innerHTML = `<div><strong>${escapeHtml(u.nickname||u.email||('User '+u.id))}</strong><div style="font-size:12px;color:#666">${escapeHtml(u.email||'')}</div></div>`;
				const inv = document.createElement('button'); inv.className='btn btn-secondary'; inv.textContent = 'Invite'; inv.addEventListener('click', async () => { 
					// call server to create invite and rely on notifications
					try {
						const payload = { bossId: boss.id, invitedUserId: u.id, message: 'Join boss fight: ' + (boss.name||'Boss') };
						const resp = await apiRequest('/api/boss/invites', { method: 'POST', body: JSON.stringify(payload) });
						if (!resp.res.ok) return alert('Invite failed');
						invited.add(String(u.id)); saveInvites(Object.assign(getInvites(), { [boss.id]: Array.from(invited) })); renderInvited();
					} catch (e) { alert('Invite failed'); }
				});
				r.appendChild(inv);
				resultsEl.appendChild(r);
			});
			if (arr.length === 0) resultsEl.innerHTML = '<div style="color:#666">No users found</div>';
		} catch (e) { resultsEl.innerHTML = '<div style="color:#cbd5e1">Search error</div>'; }
	}
	searchBtn?.addEventListener('click', () => doUserSearch((searchInput?.value||'').trim()));

	// --- Timer wiring ---
	const startBtn = document.getElementById('startTimerBtn');
	const stopBtn = document.getElementById('stopTimerBtn');
	const minutesInput = document.getElementById('timerMinutes');
	const timerDisplay = document.getElementById('timerDisplay');
	let timerInterval = null;
	function renderTimer() {
		const timers = getTimers();
		const ts = timers[boss.id];
		if (!ts) { timerDisplay.textContent = '' ; return; }
		const remaining = Math.max(0, Math.floor((new Date(ts).getTime() - Date.now())/1000));
		const mins = Math.floor(remaining/60); const secs = remaining % 60;
		timerDisplay.textContent = `${mins}:${String(secs).padStart(2,'0')} remaining`;
		if (remaining <= 0) {
			// fire notification
			try { if (Notification && Notification.permission === 'granted') new Notification('Boss timer', { body: boss.name + ' fight time!' }); else alert('Boss fight time: ' + (boss.name||'Boss')); } catch (e) { alert('Boss fight time: ' + (boss.name||'Boss')); }
			// remove timer
			const t = getTimers(); delete t[boss.id]; saveTimers(t); clearInterval(timerInterval); timerInterval = null; renderTimer();
		}
	}

	startBtn?.addEventListener('click', async () => {
		const m = parseInt(minutesInput?.value) || 0; if (m <= 0) return alert('Enter minutes > 0');
		// create timer on server
		try {
			const when = new Date(Date.now() + m * 60000).toISOString();
			const resp = await apiRequest('/api/boss/timers', { method: 'POST', body: JSON.stringify({ bossId: boss.id, scheduledAt: when }) });
			if (!resp.res.ok) return alert('Failed to schedule timer');
			// also save locally for UI convenience
			const timers = getTimers(); timers[boss.id] = when; saveTimers(timers); renderTimer();
			if (timerInterval) clearInterval(timerInterval);
			timerInterval = setInterval(renderTimer, 1000);
		} catch (e) { alert('Failed to schedule timer'); }
	});
	stopBtn?.addEventListener('click', () => { const timers = getTimers(); delete timers[boss.id]; saveTimers(timers); if (timerInterval) clearInterval(timerInterval); timerInterval = null; renderTimer(); });
	// if there is an active timer, start rendering
	if (getTimers()[boss.id]) { if (timerInterval) clearInterval(timerInterval); timerInterval = setInterval(renderTimer, 1000); renderTimer(); }
}

function showBossDetail(id) {
	const detailEl = document.getElementById('bossDetail'); if (!detailEl) return;
	const data = getBossData(); const b = data.find(x=>x.id===id); if (!b) { detailEl.innerHTML=''; return; }
	detailEl.innerHTML = `<h3 style="margin-top:0">${escapeHtml(b.name||'Untitled')}</h3>
		<div style="font-size:13px;color:#444">Level: <strong>${escapeHtml(String(b.level||''))}</strong></div>
		<div style="font-size:13px;color:#444">Party size: <strong>${escapeHtml(String(b.partySize||''))}</strong></div>
		<div style="margin-top:8px;color:#333">${escapeHtml(b.notes||'')}</div>
		<div style="margin-top:10px"><strong>Drops</strong></div>
		<div id="bossDrops" style="margin-top:6px"></div>
		<div style="margin-top:10px"><button class="btn btn-secondary" id="editBossDetailBtn">Edit</button></div>`;
	const dropsEl = document.getElementById('bossDrops'); if (dropsEl) {
		const drops = Array.isArray(b.drops) ? b.drops : [];
		if (!drops.length) dropsEl.innerHTML = '<div style="color:#666;font-size:13px">No drops defined</div>';
		else {
			dropsEl.innerHTML = drops.map(d=>`<div style="padding:6px;border-bottom:1px solid #f1f1f1"><strong>${escapeHtml(d.name)}</strong> <span style="color:#666">(${escapeHtml(String(d.chance||''))}%)</span></div>`).join('');
		}
	}
	document.getElementById('editBossDetailBtn')?.addEventListener('click', () => openBossModal(b.id));
}

function openBossModal(bossId) {
	const modal = document.getElementById('creatureModal'); if (!modal) return alert('Modal area missing');
	const data = getBossData(); const boss = bossId ? data.find(x=>x.id===bossId) : null;
	const dropsJson = boss ? JSON.stringify(boss.drops||[], null, 2) : '[]';
	modal.innerHTML = `<div class="modal-content" style="max-width:720px;margin:20px auto;"><div class="modal-header"><h3>${boss? 'Edit Boss' : 'Add Boss'}</h3><button id="closeBossModal" class="close-btn soft">Close</button></div>
		<div class="modal-body">
			<div class="form-group"><label class="form-label">Name</label><input id="bossNameInput" class="form-control" value="${escapeHtml(boss?boss.name:'')}"></div>
			<div class="form-group"><label class="form-label">Level</label><input id="bossLevelInput" class="form-control" type="number" value="${escapeHtml(boss?String(boss.level||''):'')}"></div>
			<div class="form-group"><label class="form-label">Party Size</label><input id="bossPartyInput" class="form-control" type="number" value="${escapeHtml(boss?String(boss.partySize||''):'')}"></div>
			<div class="form-group"><label class="form-label">Notes</label><textarea id="bossNotesInput" class="form-control" rows="3">${escapeHtml(boss?boss.notes:'')}</textarea></div>
			<div class="form-group"><label class="form-label">Drops (JSON array of {name, chance})</label><textarea id="bossDropsInput" class="form-control" rows="6">${escapeHtml(dropsJson)}</textarea><div style="font-size:12px;color:#666;margin-top:6px">Example: [{"name":"Ultra Hide","chance":2.5}]</div></div>
		</div>
		<div class="modal-footer"><button class="btn btn-primary" id="saveBossBtn">Save</button> <button class="btn btn-secondary" id="cancelBossBtn">Cancel</button></div>
	</div>`;
	modal.classList.add('active'); modal.setAttribute('aria-hidden','false');
	document.getElementById('closeBossModal')?.addEventListener('click', () => { modal.classList.remove('active'); modal.innerHTML=''; modal.setAttribute('aria-hidden','true'); });
	document.getElementById('cancelBossBtn')?.addEventListener('click', () => { modal.classList.remove('active'); modal.innerHTML=''; modal.setAttribute('aria-hidden','true'); });
	document.getElementById('saveBossBtn')?.addEventListener('click', () => {
		const name = document.getElementById('bossNameInput')?.value || '';
		const level = parseInt(document.getElementById('bossLevelInput')?.value) || null;
		const partySize = parseInt(document.getElementById('bossPartyInput')?.value) || null;
		const notes = document.getElementById('bossNotesInput')?.value || '';
		let drops = [];
		try { drops = JSON.parse(document.getElementById('bossDropsInput')?.value || '[]'); if (!Array.isArray(drops)) throw new Error('Drops must be an array'); } catch (e) { return alert('Invalid drops JSON: ' + (e.message || e)); }
		const all = getBossData();
		if (boss) {
			// update
			const idx = all.findIndex(x=>x.id===boss.id);
			if (idx !== -1) { all[idx] = { ...all[idx], name, level, partySize, notes, drops }; }
		} else {
			const id = 'boss_' + Date.now();
			all.unshift({ id, name, level, partySize, notes, drops });
		}
		saveBossData(all); modal.classList.remove('active'); modal.innerHTML=''; modal.setAttribute('aria-hidden','true'); renderBossList();
	});
}

}
