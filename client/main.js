// Utility Functions
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Initialize API configuration
window.__API_BASE = window.__API_BASE || 'http://localhost:3000'; // Default to localhost if not set

// Application State Management
window.appState = window.appState || {
    initialized: false,
    authenticated: false,
    creatures: [],
    errors: []
};

// Initialize the application
async function initializeApp() {
    if (!window.appState) {
        window.appState = {
            initialized: false,
            authenticated: false,
            creatures: [],
            currentView: null
        };
    }

    try {
        // Check if user is already authenticated
        const token = localStorage.getItem('token');
        if (token) {
            // Verify token is still valid
            try {
                const { res } = await apiRequest('/api/auth/verify', { 
                    method: 'GET',
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                window.appState.authenticated = res.ok;
            } catch (e) {
                console.error('Token verification failed:', e);
                window.appState.authenticated = false;
                localStorage.removeItem('token');
            }
        }

        // Load species database
        await waitForSpeciesDB(3000, 50);
        
        // Load user's creatures if authenticated
        if (window.appState.authenticated) {
            try {
                const { res, body } = await apiRequest('/api/creature', { method: 'GET' });
                if (res.ok && Array.isArray(body)) {
                    window.appState.creatures = body;
                }
            } catch (e) {
                console.error('Failed to load user creatures:', e);
            }
        }

        window.appState.initialized = true;
    } catch (e) {
        console.error('Failed to initialize app:', e);
        window.appState.errors.push(e);
    }
}

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
async function goToCreatures() {
    try {
        const main = document.getElementById('appMainContent');
        if (main) main.innerHTML = '<div class="loading">Loading species database...</div>';
        await loadSpeciesPage();
    } catch (e) {
        console.error('Failed to load species page:', e);
        const main = document.getElementById('appMainContent');
        if (main) main.innerHTML = '<div class="error">Failed to load species database</div>';
    }
}
function goToMyNuggies() {
	loadMyNuggiesPage();
}
function goToTrading() {
	loadTradingPage();
}
window.goToTrading = goToTrading;
// Boss Planner Implementation
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
                <button id="addBossBtn" class="btn btn-primary">Add Boss</button>
            </div>
            <div id="bossGrid" class="boss-grid"></div>
        </section>
    `;

    // Load boss data
    const bosses = getBossData();

    // Initialize event handlers
    document.getElementById('bossSearch')?.addEventListener('input', debounce(renderBossGrid, 200));
    document.getElementById('bossMapFilter')?.addEventListener('change', renderBossGrid);
    document.getElementById('addBossBtn')?.addEventListener('click', () => showBossModal());

    // Initial render
    renderBossGrid();
}

function renderBossGrid() {
    const bossGrid = document.getElementById('bossGrid');
    if (!bossGrid) return;

    const searchTerm = document.getElementById('bossSearch')?.value.toLowerCase() || '';
    const mapFilter = document.getElementById('bossMapFilter')?.value || '';
    
    const bosses = getBossData();
    const filteredBosses = bosses.filter(boss => {
        if (searchTerm && !boss.name.toLowerCase().includes(searchTerm)) {
            return false;
        }
        if (mapFilter && boss.map !== mapFilter) {
            return false;
        }
        return true;
    });

    bossGrid.innerHTML = filteredBosses.length ? filteredBosses.map(boss => `
        <div class="boss-card" data-boss-id="${boss.id}">
            <div class="boss-card-header">
                <h3>${boss.name || 'Unnamed Boss'}</h3>
                <span class="boss-difficulty ${boss.difficulty?.toLowerCase() || 'alpha'}">${boss.difficulty || 'Alpha'}</span>
            </div>
            <div class="boss-card-content">
                <div class="boss-map">${boss.map || 'Unknown Map'}</div>
                <div class="boss-info">
                    ${boss.level ? `<div class="boss-level">Level ${boss.level}</div>` : ''}
                    ${boss.partySize ? `<div class="boss-party">Party: ${boss.partySize}</div>` : ''}
                </div>
                ${boss.notes ? `<div class="boss-notes">${boss.notes}</div>` : ''}
                <div class="boss-actions">
                    <button class="btn btn-primary edit-boss" data-boss-id="${boss.id}">Edit</button>
                    <button class="btn btn-danger delete-boss" data-boss-id="${boss.id}">Delete</button>
                </div>
            </div>
        </div>
    `).join('') : '<div class="no-results">No bosses found matching your criteria</div>';

    // Add event listeners
    document.querySelectorAll('.edit-boss').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const bossId = e.target.dataset.bossId;
            const boss = bosses.find(b => b.id === bossId);
            if (boss) showBossModal(boss);
        });
    });

    document.querySelectorAll('.delete-boss').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const bossId = e.target.dataset.bossId;
            if (confirm('Are you sure you want to delete this boss?')) {
                const newData = bosses.filter(b => b.id !== bossId);
                saveBossData(newData);
                renderBossGrid();
            }
        });
    });
}

function showBossModal(boss = null) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>${boss ? 'Edit' : 'Add'} Boss</h2>
                <button type="button" class="close" id="closeBossModal">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>Name</label>
                    <input id="bossNameInput" class="form-control" value="${boss?.name || ''}">
                </div>
                <div class="form-group">
                    <label>Map</label>
                    <select id="bossMapInput" class="form-control">
                        <option value="">Select a Map</option>
                        <option ${boss?.map === 'The Island' ? 'selected' : ''}>The Island</option>
                        <option ${boss?.map === 'Scorched Earth' ? 'selected' : ''}>Scorched Earth</option>
                        <option ${boss?.map === 'The Center' ? 'selected' : ''}>The Center</option>
                        <option ${boss?.map === 'Aberration' ? 'selected' : ''}>Aberration</option>
                        <option ${boss?.map === 'Ragnarok' ? 'selected' : ''}>Ragnarok</option>
                        <option ${boss?.map === 'Astraeos' ? 'selected' : ''}>Astraeos</option>
                        <option ${boss?.map === 'Extinction' ? 'selected' : ''}>Extinction</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Difficulty</label>
                    <select id="bossDifficultyInput" class="form-control">
                        <option value="alpha" ${boss?.difficulty === 'alpha' ? 'selected' : ''}>Alpha</option>
                        <option value="beta" ${boss?.difficulty === 'beta' ? 'selected' : ''}>Beta</option>
                        <option value="gamma" ${boss?.difficulty === 'gamma' ? 'selected' : ''}>Gamma</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Level</label>
                    <input type="number" id="bossLevelInput" class="form-control" value="${boss?.level || ''}">
                </div>
                <div class="form-group">
                    <label>Required Party Size</label>
                    <input type="number" id="bossPartySizeInput" class="form-control" value="${boss?.partySize || ''}">
                </div>
                <div class="form-group">
                    <label>Notes</label>
                    <textarea id="bossNotesInput" class="form-control" rows="3">${boss?.notes || ''}</textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" id="cancelBossBtn">Cancel</button>
                <button class="btn btn-primary" id="saveBossBtn">Save</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // Show modal
    setTimeout(() => modal.classList.add('show'), 10);

    // Wire up event handlers
    function closeModal() {
        modal.classList.remove('show');
        setTimeout(() => modal.remove(), 200);
    }

    document.getElementById('closeBossModal')?.addEventListener('click', closeModal);
    document.getElementById('cancelBossBtn')?.addEventListener('click', closeModal);
    document.getElementById('saveBossBtn')?.addEventListener('click', () => {
        const newBoss = {
            id: boss?.id || `boss_${Date.now()}`,
            name: document.getElementById('bossNameInput')?.value || '',
            map: document.getElementById('bossMapInput')?.value || '',
            difficulty: document.getElementById('bossDifficultyInput')?.value || 'alpha',
            level: parseInt(document.getElementById('bossLevelInput')?.value) || null,
            partySize: parseInt(document.getElementById('bossPartySizeInput')?.value) || null,
            notes: document.getElementById('bossNotesInput')?.value || ''
        };

        const bosses = getBossData();
        if (boss) {
            // Update existing
            const index = bosses.findIndex(b => b.id === boss.id);
            if (index !== -1) {
                bosses[index] = newBoss;
            }
        } else {
            // Add new
            bosses.unshift(newBoss);
        }

        saveBossData(bosses);
        closeModal();
        renderBossGrid();
    });
}

// Expose boss planner functions to window for debugging
window.loadBossPlanner = loadBossPlanner;
window.openBossModal = openBossModal;
window.showBossDetail = showBossDetail;
window.renderBossList = renderBossList;
window.openArenaPage = openArenaPage;
window.renderArenaGrid = renderArenaGrid;

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

// Use global SPECIES_DATABASE for species data management
// This is populated by species-database.js which is loaded in index.html
function speciesValues() {
    const db = getSpeciesDB();
    return Object.values(db || {});
}

// Initialize species database and ensure it's loaded
function initializeSpeciesDB() {
    if (!window.SPECIES_DATABASE) {
        window.SPECIES_DATABASE = {};
        console.warn('Species database not loaded yet');
    }
}

// Ensure we're using the global SPECIES_DATABASE
function getSpeciesDB() {
    return (typeof window !== 'undefined' && window.SPECIES_DATABASE) ? window.SPECIES_DATABASE : {};
}

async function loadSpeciesPage() {
    try {
        // Initialize speciesData
        const speciesData = window.SPECIES_DATABASE || {};

        // First ensure app and species database are initialized
        if (!window.appState?.initialized) {
            console.log('[SPA] Waiting for app initialization...');
            await initializeApp();
        }
        
        await waitForSpeciesDB(2000, 50);
        
        const main = document.getElementById('appMainContent');
        if (!main) {
            console.error('[SPA] Main content element not found');
            return;
        }

        console.log('[SPA] Rendering species page...');
        
        // Show loading state
        main.innerHTML = '<div class="loading">Loading species data...</div>';
        
        // Get species data
        if (!Object.keys(speciesData).length) {
            main.innerHTML = '<div class="error">No species data available.</div>';
            return;
        }

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
                    </select>
                    <select id="rarityFilter" class="form-control">
                        <option value="">All Rarities</option>
                    </select>
                    <button id="clearFiltersBtn" class="btn btn-secondary">Clear</button>
                </div>
            </div>
            <div id="speciesGrid" class="species-grid" aria-live="polite"></div>
        </section>
    `;

    // Initialize the species grid
    const speciesGrid = document.getElementById('speciesGrid');
    
    // Ensure species database is loaded
    try {
        await waitForSpeciesDB(3000, 50);
        
        if (!Object.keys(speciesData).length) {
            if (speciesGrid) {
                speciesGrid.innerHTML = '<div class="error">No species data available</div>';
            }
            return;
        }
    } catch (e) {
        console.error('Failed to load species database:', e);
        if (speciesGrid) {
            speciesGrid.innerHTML = '<div class="error">Failed to load species database</div>';
        }
        return;
    }

    // Helper to capitalize strings
    const capitalize = (s) => (s || '').toString().replace(/\b\w/g, c => c.toUpperCase());

    // Collect unique categories and rarities
    const categories = new Set();
    const rarities = new Set();
    Object.values(speciesData || {}).forEach(s => {
        if (s.category) categories.add(s.category.toLowerCase());
        if (s.rarity) rarities.add(s.rarity.toLowerCase());
    });

    // Populate filters
    const categoryFilter = document.getElementById('categoryFilter');
    if (categoryFilter) {
        const options = ['<option value="">All Categories</option>'];
        Array.from(categories).sort().forEach(cat => {
            options.push(`<option value="${cat}">${capitalize(cat)}</option>`);
        });
        categoryFilter.innerHTML = options.join('');
    }

    const rarityFilter = document.getElementById('rarityFilter');
    if (rarityFilter) {
        const canonicalRarities = [
            'common',
            'uncommon',
            'rare',
            'very rare',
            'unique',
            'extinct'
        ].filter(r => rarities.has(r));

        const options = ['<option value="">All Rarities</option>'];
        canonicalRarities.forEach(rarity => {
            options.push(`<option value="${rarity}">${capitalize(rarity)}</option>`);
        });
        rarityFilter.innerHTML = options.join('');
    }

    // Set up filtering functionality
    function filterSpecies() {
        const speciesGrid = document.getElementById('speciesGrid');
        if (!speciesGrid || !speciesData) {
            speciesGrid.innerHTML = '<div class="no-species-found">Species database unavailable.</div>';
            return;
        }

        const searchTerm = (document.getElementById('searchInput')?.value || '').toLowerCase();
        const category = document.getElementById('categoryFilter')?.value?.toLowerCase();
        const rarity = document.getElementById('rarityFilter')?.value?.toLowerCase();

        const filteredSpecies = Object.values(speciesData).filter(s => {
            if (searchTerm && !s.name?.toLowerCase().includes(searchTerm) && 
                !s.category?.toLowerCase().includes(searchTerm) &&
                !s.diet?.toLowerCase().includes(searchTerm)) {
                return false;
            }
            if (category && s.category?.toLowerCase() !== category) {
                return false;
            }
            if (rarity && s.rarity?.toLowerCase() !== rarity) {
                return false;
            }
            return true;
        });

        speciesGrid.innerHTML = filteredSpecies.length ? filteredSpecies.map(s => `
            <div class="species-card" data-species-id="${s.id || ''}">
                <div class="species-card-content">
                    <div class="species-icon">${s.icon || '🦖'}</div>
                    <div class="species-info">
                        <div class="species-name">${s.name || 'Unknown Species'}</div>
                        <div class="species-meta">${s.category || ''} · ${s.rarity || 'Common'}</div>
                        <div class="species-stats">
                            ${s.baseStats ? Object.entries(s.baseStats)
                                .map(([key, value]) => `<span class="stat">${key}: ${value}</span>`)
                                .join('') : ''}
                        </div>
                    </div>
                </div>
            </div>
        `).join('') : '<div class="no-results">No species found matching your criteria</div>';
    }

    // Wire up event handlers
    const searchInput = document.getElementById('searchInput');
    const clearBtn = document.getElementById('clearFiltersBtn');

    if (searchInput) searchInput.addEventListener('input', debounce(filterSpecies, 180));
    if (categoryFilter) categoryFilter.addEventListener('change', filterSpecies);
    if (rarityFilter) rarityFilter.addEventListener('change', filterSpecies);
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            if (categoryFilter) categoryFilter.value = '';
            if (rarityFilter) rarityFilter.value = '';
            filterSpecies();
        });
    }

        // Initial render
        filterSpecies();
        
    } catch (e) {
        console.error('[SPA] Error rendering species page:', e);
    }
}

// Helper function to filter species data
function filterSpecies() {
    const grid = document.getElementById('speciesGrid');
    if (!grid) {
        console.error('[SPA] Species grid not found');
        return;
    }

    const searchTerm = (document.getElementById('searchInput')?.value || '').toLowerCase();
    const category = (document.getElementById('categoryFilter')?.value || '').toLowerCase();
    const rarity = (document.getElementById('rarityFilter')?.value || '').toLowerCase();
    
    const speciesData = window.SPECIES_DATABASE || {};
    
    const filteredSpecies = Object.values(speciesData).filter(species => {
        if (!species || !species.name) return false;

        // Search term matching
        const matchesSearch = !searchTerm || (
            (species.name && species.name.toLowerCase().includes(searchTerm)) ||
            (species.category && species.category.toLowerCase().includes(searchTerm)) ||
            (species.diet && species.diet.toLowerCase().includes(searchTerm)) ||
            (species.description && species.description.toLowerCase().includes(searchTerm))
        );

        // Category matching
        let matchesCategory = true;
        if (category) {
            const categoryText = [
                species.category || '',
                species.diet || '',
                ...(Array.isArray(species.tags) ? species.tags : [])
            ].join(' ').toLowerCase();

            if (category === 'flyer') {
                const hasFlightSpeed = species.speeds?.flying > 0;
                matchesCategory = hasFlightSpeed || 
                    categoryText.includes('fly') || 
                    categoryText.includes('flying') || 
                    categoryText.includes('wing');
            } else {
                matchesCategory = categoryText.includes(category);
            }
        }

        // Rarity matching
        let matchesRarity = true;
        if (rarity) {
            const speciesRarity = canonicalRarityForSpecies(species).toLowerCase();
            matchesRarity = speciesRarity === rarity;
        }

        return matchesSearch && matchesCategory && matchesRarity;
    });

    console.log(`[SPA] Filtered species: ${filtered.length} of ${species.length}`);

    grid.innerHTML = filtered.length ? filtered.map(s => `
        <div class="species-card" onclick="window.goToCreatures('${s.name}')" data-species-id="${s.id || ''}">
            <div class="species-card-content">
                <div class="species-icon">${s.icon || '🦖'}</div>
                <div class="species-info">
                    <div class="species-name">${s.name || 'Unknown Species'}</div>
                    <div class="species-meta">${s.category || ''} · ${s.rarity || 'Common'}</div>
                    <div class="species-stats">
                        ${s.baseStats ? Object.entries(s.baseStats)
                            .map(([key, value]) => `<span class="stat">${key}: ${value}</span>`)
                            .join('') : ''}
                    </div>
                </div>
            </div>
        </div>
    `).join('') : '<div class="no-results">No species found matching your criteria</div>';
}
