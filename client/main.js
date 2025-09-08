// We'll set the readiness marker only after our exact theme CSS is loaded
// to avoid the original UI flashing and then being overlapped by the injected UI.

// --- SPA Logic and Event Handlers (migrated from index.html) ---
function showLoginPage() {
	console.log('[SPA] showLoginPage called');
	const landing = document.getElementById('landingPage');
	const register = document.getElementById('registerPage');
	const mainApp = document.getElementById('mainApp');
	if (!landing || !register || !mainApp) {
		console.error('[SPA] One or more main containers missing:', { landing, register, mainApp });
		return;
	}
	landing.style.display = '';
	landing.classList.remove('hidden');
	try { landing.setAttribute('aria-hidden', 'false'); } catch (e) {}

	register.style.display = 'none';
	register.classList.add('hidden');
	try { register.setAttribute('aria-hidden', 'true'); } catch (e) {}

	mainApp.style.display = 'none';
	mainApp.classList.add('hidden');
	try { mainApp.setAttribute('aria-hidden', 'true'); } catch (e) {}
	console.log('[SPA] Login page should now be visible');
}
function showRegisterPage() {
	console.log('[SPA] showRegisterPage called');
	const landing = document.getElementById('landingPage');
	const register = document.getElementById('registerPage');
	const mainApp = document.getElementById('mainApp');
	if (!landing || !register || !mainApp) {
		console.error('[SPA] One or more main containers missing:', { landing, register, mainApp });
		return;
	}
	landing.style.display = 'none';
	landing.classList.add('hidden');
	try { landing.setAttribute('aria-hidden', 'true'); } catch (e) {}

	register.style.display = '';
	register.classList.remove('hidden');
	try { register.setAttribute('aria-hidden', 'false'); } catch (e) {}

	mainApp.style.display = 'none';
	mainApp.classList.add('hidden');
	try { mainApp.setAttribute('aria-hidden', 'true'); } catch (e) {}
	// Ensure the register form is rendered and wired when the page is shown
	renderRegisterForm();
	console.log('[SPA] Register page should now be visible');
}
function showMainApp() {
	console.log('[SPA] showMainApp called');
	const landing = document.getElementById('landingPage');
	const register = document.getElementById('registerPage');
	const mainApp = document.getElementById('mainApp');
	if (!landing || !register || !mainApp) {
		console.error('[SPA] One or more main containers missing:', { landing, register, mainApp });
		return;
	}
	landing.style.display = 'none';
	landing.classList.add('hidden');
	try { landing.setAttribute('aria-hidden', 'true'); } catch (e) {}

	register.style.display = 'none';
	register.classList.add('hidden');
	try { register.setAttribute('aria-hidden', 'true'); } catch (e) {}

	mainApp.style.display = '';
	mainApp.classList.remove('hidden');
	try { mainApp.setAttribute('aria-hidden', 'false'); } catch (e) {}
	console.log('[SPA] Main app should now be visible');
}
window.showLoginPage = showLoginPage;
window.showRegisterPage = showRegisterPage;

function isLoggedIn() {
	const token = localStorage.getItem('token');
	if (!token || typeof token !== 'string') return false;
	// Allow forcing the login page via URL param for debugging
	try {
		const params = new URLSearchParams(window.location.search);
		if (params.get('forceLogin') === '1') {
			console.log('[SPA] forceLogin param detected; treating as logged out');
			return false;
		}
	} catch (e) {
		// ignore
	}
	// Basic JWT format check (three dot-separated parts). If it doesn't look like a JWT, treat as logged out.
	const parts = token.split('.');
	if (parts.length !== 3) {
		console.warn('[SPA] token present but not a valid JWT, treating as logged out', token);
		return false;
	}
	// token looks like a JWT; treat as logged in (we could validate with server if desired)
	return true;
}
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
		// In some pages the tribe header may be absent; fail silently to avoid breaking initialization
	}
}

function updateAuthUI() {
	const authBtn = document.getElementById('authBtn');
	if (!authBtn) return;
	if (isLoggedIn()) {
		authBtn.textContent = 'Sign Out';
		authBtn.classList.remove('btn-primary');
		authBtn.classList.add('btn-danger');
	} else {
		authBtn.textContent = 'Sign In';
		authBtn.classList.remove('btn-danger');
		authBtn.classList.add('btn-primary');
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
			const openTribeBtn = document.getElementById('openTribeBtn');
			if (openTribeBtn) openTribeBtn.addEventListener('click', (e) => { e.preventDefault(); if (typeof openTribeModal === 'function') openTribeModal(); else showTribeSettings(); });
			const goToCreaturesBtn = document.getElementById('goToCreaturesBtn');
			if (goToCreaturesBtn) goToCreaturesBtn.addEventListener('click', goToCreatures);
			const goToMyNuggiesBtn = document.getElementById('goToMyNuggiesBtn');
			if (goToMyNuggiesBtn) goToMyNuggiesBtn.addEventListener('click', goToMyNuggies);
			const goToTradingBtn = document.getElementById('goToTradingBtn');
			if (goToTradingBtn) goToTradingBtn.addEventListener('click', goToTrading);
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

// Ensure tribe modal container exists and provide modal handlers
(function ensureTribeModal() {
	try {
		if (typeof document !== 'undefined' && !document.getElementById('tribeModal')) {
			const div = document.createElement('div');
			div.id = 'tribeModal';
			div.className = 'modal';
			div.setAttribute('aria-hidden', 'true');
			document.body.appendChild(div);
		}
	} catch (e) { /* ignore non-browser */ }
})();

function openTribeModal() {
	const modal = document.getElementById('tribeModal');
	if (!modal) return console.warn('tribeModal missing');
	const s = JSON.parse(localStorage.getItem('arkTribeSettings') || '{}');
	modal.innerHTML = `
		<div class="modal-content">
			<div class="modal-header"><h2 class="modal-title">🏛️ Tribe Settings</h2><button class="close-btn" id="closeTribeModalBtn">&times;</button></div>
			<div class="modal-body">
				<div class="section-title">🏛️ Tribe Setup</div>
				<p style="margin-bottom: 12px; color:#94a3b8;">Personalize your breeding database. These settings are saved locally.</p>
				<div class="form-row cols-1"><div class="form-group"><label class="form-label">Tribe Leader</label><input class="form-control" id="tribeLeaderInput" value="${(s.tribeLeader||'')}" placeholder="Your username"></div></div>
				<div class="form-row cols-2"><div class="form-group"><label class="form-label">Server Type</label><select class="form-control" id="serverTypeInput"><option${(s.serverType==='Official'?' selected':'')}>Official</option><option${(s.serverType==='Unofficial'?' selected':'')}>Unofficial</option><option${(s.serverType==='Single Player'?' selected':'')}>Single Player</option></select></div>
				<div class="form-group"><label class="form-label">Primary Map</label><input class="form-control" id="primaryMapInput" value="${(s.primaryMap||'')}"></div></div>
				<div class="form-row cols-1"><div class="form-group"><label class="form-label">Breeding Goals</label><textarea id="breedingGoalsInput" class="form-control" rows="3">${(s.breedingGoals||'')}</textarea></div></div>
				<div class="form-row cols-2"><div class="form-group"><label class="form-label">Tribe Name</label><input class="form-control" id="tribeNameInputModal" value="${(s.tribeName||'')}"></div><div class="form-group"><label class="form-label">Favorite Creature</label><input class="form-control" id="favoriteCreatureInput" value="${(s.favoriteCreature||'')}"></div></div>
			</div>
			<div class="modal-footer"><button class="btn btn-primary" id="saveTribeSettingsBtn">Save Settings</button></div>
		</div>
	`;
	document.getElementById('closeTribeModalBtn')?.addEventListener('click', closeTribeModal);
	document.getElementById('saveTribeSettingsBtn')?.addEventListener('click', saveTribeSettings);
	modal.classList.add('active'); modal.setAttribute('aria-hidden','false');
}

function closeTribeModal() {
	const modal = document.getElementById('tribeModal'); if (!modal) return; modal.classList.remove('active'); modal.setAttribute('aria-hidden','true'); modal.innerHTML = '';
}

function saveTribeSettings() {
	try {
		const settings = {
			tribeLeader: (document.getElementById('tribeLeaderInput')?.value || '').trim(),
			serverType: (document.getElementById('serverTypeInput')?.value || '').trim(),
			primaryMap: (document.getElementById('primaryMapInput')?.value || '').trim(),
			breedingGoals: (document.getElementById('breedingGoalsInput')?.value || '').trim(),
			tribeName: (document.getElementById('tribeNameInputModal')?.value || '').trim(),
			favoriteCreature: (document.getElementById('favoriteCreatureInput')?.value || '').trim()
		};
		localStorage.setItem('arkTribeSettings', JSON.stringify(settings));
		// Also mirror some quick-access keys
		if (settings.tribeName) localStorage.setItem('tribeName', settings.tribeName);
		closeTribeModal();
		try { updateTribeHeader(); } catch (e) {}
	} catch (e) { console.error('saveTribeSettings failed', e); alert('Failed to save tribe settings'); }
}

window.openTribeModal = openTribeModal;
window.closeTribeModal = closeTribeModal;
window.saveTribeSettings = saveTribeSettings;

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
	const email = (document.getElementById('loginEmail')?.value || '').trim();
	const password = (document.getElementById('loginPassword')?.value || '').trim();
	const errorDiv = document.getElementById('loginError');
	errorDiv.style.display = 'none';

	// Basic client-side validation
	if (!email || !password) {
		errorDiv.textContent = 'Please provide email and password.';
		errorDiv.style.display = 'block';
		return false;
	}
	if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
		errorDiv.textContent = 'Please enter a valid email address.';
		errorDiv.style.display = 'block';
		return false;
	}
	try {
		const res = await fetch('https://nuggie.onrender.com/api/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email, password })
		});
		// helper to read JSON or text body for better diagnostics
		async function readBody(resp) {
			const ct = resp.headers.get('content-type') || '';
			try {
				if (ct.includes('application/json')) return await resp.json();
				return await resp.text();
			} catch (e) { return await resp.text().catch(() => null); }
		}

		const data = await readBody(res);
		if (res.ok && data && data.token) {
			localStorage.setItem('token', data.token);
			// Ensure the document is visible and the main app is shown
			try { document.documentElement.setAttribute('data-ready', 'true'); } catch (e) {}
			showMainApp();
			updateTribeHeader();
			// Sync server-stored creatures for this user
			try { await loadServerCreatures(); } catch (e) { console.warn('loadServerCreatures after login failed', e); }
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
		errorDiv.textContent = 'Network error.';
		errorDiv.style.display = 'block';
	}
	return false;
}
window.handleLogin = handleLogin;

async function handleRegister(event) {
	event.preventDefault();
	const email = (document.getElementById('registerEmail')?.value || '').trim();
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
		const res = await fetch('https://nuggie.onrender.com/api/register', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email, password })
		});
		async function readBody(resp) {
			const ct = resp.headers.get('content-type') || '';
			try {
				if (ct.includes('application/json')) return await resp.json();
				return await resp.text();
			} catch (e) { return await resp.text().catch(() => null); }
		}
		const data = await readBody(res);
		if (res.ok && (data === true || (data && data.success))) {
			// If server returned a token, sign in immediately. Otherwise, prefill login and attempt auto-login
			if (data && data.token) {
				localStorage.setItem('token', data.token);
				try { document.documentElement.setAttribute('data-ready', 'true'); } catch (e) {}
				showMainApp();
				updateTribeHeader();
				try { loadSpeciesPage(); } catch (e) {}
				try { updateStatsDashboard(); } catch (e) {}
				try { updateAuthUI(); } catch (e) {}
			} else {
				// No token: show login page and prefill credentials, then attempt login automatically
				showLoginPage();
				setTimeout(async () => {
					try {
						const le = document.getElementById('loginEmail');
						const lp = document.getElementById('loginPassword');
						if (le) le.value = email;
						if (lp) lp.value = password;
						// Call handleLogin to perform login flow without requiring a manual refresh
						try { await handleLogin(new Event('submit')); } catch (e) { /* ignore, user can login manually */ }
					} catch (e) { /* no-op */ }
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
		errorDiv.textContent = 'Network error.';
		errorDiv.style.display = 'block';
	}
	return false;
}
window.handleRegister = handleRegister;

// --- API helper and server-sync for creature persistence ---
async function apiRequest(path, opts = {}) {
	const token = localStorage.getItem('token');
	const headers = opts.headers || {};
	if (token) headers['Authorization'] = 'Bearer ' + token;
	headers['Content-Type'] = headers['Content-Type'] || 'application/json';
	const res = await fetch((opts.base || 'https://nuggie.onrender.com') + path, Object.assign({}, opts, { headers, credentials: 'include' }));
	const ct = res.headers.get('content-type') || '';
	let body = null;
	try { body = ct.includes('application/json') ? await res.json() : await res.text(); } catch (e) { body = null; }
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
			try { localStorage.setItem('arkCreatures', JSON.stringify(window.appState.creatures)); } catch (e) {}
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
		try { localStorage.setItem('arkCreatures', JSON.stringify(window.appState.creatures)); } catch (e) {}
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
	try { localStorage.setItem('arkCreatures', JSON.stringify(window.appState && window.appState.creatures || [])); } catch (e) {}
	try { if (typeof window.saveDataToServer === 'function' && localStorage.getItem('token')) window.saveDataToServer(); } catch (e) {}
};

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
	// Render the species page with search and filters and a species grid
	document.getElementById('appMainContent').innerHTML = `
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
		grid.innerHTML = '<div class="no-species-found">No species found.</div>';
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
		      <button class="btn btn-primary" id="addMyNuggieBtn">➕ Add Creature</button>
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
	const addBtn = document.getElementById('addMyNuggieBtn');
	if (addBtn) addBtn.onclick = () => { try { window.appState.currentSpecies = null; } catch (e) {} ; openCreatureModal(null); };
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

function loadTradingPage() {
	const main = document.getElementById('appMainContent');
	if (!main) return;
	main.innerHTML = `
		<section class="trading-page">
			<div class="page-header">
				<h1>Trading</h1>
				<div class="section-sub">A simple marketplace for exchanging creatures (coming soon)</div>
			</div>
			<div style="margin-top:18px;">
				<p>This is an initial Trading page. You can list creatures for trade or browse offers here.</p>
				<div class="trading-actions">
					<button class="btn btn-primary" id="createTradeBtn">Create Trade</button>
					<button class="btn btn-secondary" id="browseTradesBtn">Browse Trades</button>
				</div>
			</div>
		</section>
	`;
	// Wire basic actions
	const createBtn = document.getElementById('createTradeBtn');
	if (createBtn) createBtn.addEventListener('click', () => alert('Trade creation not implemented yet'));
	const browseBtn = document.getElementById('browseTradesBtn');
	if (browseBtn) browseBtn.addEventListener('click', () => alert('Browse trades not implemented yet'));
}


// Render register form into #registerPage (called when user clicks Register)
function renderRegisterForm() {
	const register = document.getElementById('registerPage');
	if (!register) return;
	register.innerHTML = `
		<div class="register-container">
			<h2 class="register-title">Create an account</h2>
			<form id="registerForm">
				<div class="form-group">
					<label class="form-label" for="registerEmail">Email</label>
					<input id="registerEmail" class="form-control" type="email" required autocomplete="username">
				</div>
				<div class="form-group">
					<label class="form-label" for="registerPassword">Password</label>
					<input id="registerPassword" class="form-control" type="password" required autocomplete="new-password">
				</div>
				<div class="form-group">
					<label class="form-label" for="registerConfirmPassword">Confirm Password</label>
					<input id="registerConfirmPassword" class="form-control" type="password" required>
				</div>
				<div id="registerError" class="register-error" role="status" aria-live="polite"></div>
				<button type="submit" class="btn btn-primary register-btn">Register</button>
				<button type="button" class="btn btn-secondary" id="cancelRegisterBtn">Cancel</button>
			</form>
		</div>
	`;

	// Wire events
	const registerForm = document.getElementById('registerForm');
	if (registerForm) registerForm.addEventListener('submit', handleRegister);
	const cancelBtn = document.getElementById('cancelRegisterBtn');
	if (cancelBtn) cancelBtn.addEventListener('click', (e) => { e.preventDefault(); showLoginPage(); });
}

function showTribeSettings() {
	const main = document.getElementById('appMainContent');
	if (!main) return;
	main.innerHTML = `
		<section class="tribe-settings">
			<h2>Tribe Settings</h2>
			<div class="form-group">
				<label class="form-label">Tribe Name</label>
				<input id="tribeNameInput" class="form-control" value="${(localStorage.getItem('tribeName')||'My Tribe')}">
			</div>
			<div class="form-group">
				<label class="form-label">Tribe Description</label>
				<textarea id="tribeDesc" class="form-control">${(localStorage.getItem('tribeDesc')||'')}</textarea>
			</div>
			<div class="modal-actions">
				<button id="saveTribeBtn" class="btn btn-primary">Save</button>
				<button id="backToMainBtn" class="btn btn-secondary">Back</button>
			</div>
		</section>
	`;

	document.getElementById('saveTribeBtn').addEventListener('click', () => {
		const name = document.getElementById('tribeNameInput').value.trim();
		const desc = document.getElementById('tribeDesc').value.trim();
		localStorage.setItem('tribeName', name);
		localStorage.setItem('tribeDesc', desc);
		updateTribeHeader();
	});
	document.getElementById('backToMainBtn').addEventListener('click', () => loadSpeciesPage());
}

function updateStatsDashboard() {
	// Keep it lightweight: compute a few quick metrics and render into header placeholders
	const creatures = appState.creatures || [];
	const total = creatures.length;
	const speciesCount = new Set(creatures.map(c => c.species)).size;
	const prized = creatures.filter(c => (window.BadgeSystem && BadgeSystem.calculatePrizedBloodline(c).qualified) ).length;
	const highest = creatures.length ? Math.max(...creatures.map(c => c.level || 1)) : 1;

	// Ensure placeholders exist; create them if not
	let statsBar = document.getElementById('statsBar');
	if (!statsBar) {
		const header = document.querySelector('.header-content') || document.body;
		statsBar = document.createElement('div');
		statsBar.id = 'statsBar';
		statsBar.className = 'stats-bar';
		statsBar.innerHTML = `<div class="stats-item">Total: <span id="totalCreatures">${total}</span></div>
			<div class="stats-item">Species: <span id="speciesTracked">${speciesCount}</span></div>
			<div class="stats-item">Prized: <span id="prizedBloodlines">${prized}</span></div>
			<div class="stats-item">Highest Lvl: <span id="highestLevel">${highest}</span></div>`;
		header.appendChild(statsBar);
	} else {
		document.getElementById('totalCreatures').textContent = total;
		document.getElementById('speciesTracked').textContent = speciesCount;
		document.getElementById('prizedBloodlines').textContent = prized;
		document.getElementById('highestLevel').textContent = highest;
	}
}

// Global Application State
let appState;
try {
	appState = {
		creatures: JSON.parse(localStorage.getItem('arkCreatures') || '[]'),
		tribeSettings: JSON.parse(localStorage.getItem('arkTribeSettings') || '{}'),
		currentSpecies: null,
		editingCreature: null,
		selectedCreature: null
	};
	console.log('App state loaded successfully', appState);
} catch (error) {
	console.error('Error loading app state from localStorage:', error);
	appState = {
		creatures: [],
		tribeSettings: {},
		currentSpecies: null,
		editingCreature: null,
		selectedCreature: null
	};
}
window.appState = appState;

// --- SPECIES_DATABASE wiring (non-destructive) ---
// Ensure fallback storage exists; avoid touching any variable named SPECIES_DATABASE
if (typeof window !== 'undefined') {
	if (window.SPECIES_DATABASE && Object.keys(window.SPECIES_DATABASE || {}).length > 0) {
		window.__SPECIES_DB = window.SPECIES_DATABASE;
	} else {
		window.__SPECIES_DB = window.__SPECIES_DB || {};
	}
}

// saveCreature: accepts either a full creature object or a wrapper from creatures.js
function saveCreature(payload) {
	try {
		// payload may be { species, editing } (from creatures.js) or a full creature object
		if (!payload) return console.warn('saveCreature called with no payload');

		// If payload contains a full creature object
		if (payload && payload.id && payload.name) {
			// direct save
			const existingIndex = appState.creatures.findIndex(c => c.id === payload.id);
			if (existingIndex >= 0) appState.creatures[existingIndex] = payload;
			else appState.creatures.push(payload);
		} else if (payload && payload.species) {
			// creatures.js will dispatch an event; expect main.js to read fields from the modal
			const name = document.getElementById('creatureName')?.value?.trim();
			if (!name) { alert('Please enter a creature name'); return; }
			const creature = {
				id: payload.editing || ('creature_' + Date.now() + '_' + Math.random().toString(36).substr(2,9)),
				name,
				species: payload.species,
				gender: document.getElementById('creatureGender')?.value || '',
				level: parseInt(document.getElementById('creatureLevel')?.value) || 1,
				baseStats: {},
				mutations: {},
				domesticLevels: {},
				notes: document.getElementById('creatureNotes')?.value || '',
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString()
			};
			// If editing, replace
			const idx = appState.creatures.findIndex(c => c.id === creature.id);
			if (idx >= 0) appState.creatures[idx] = creature; else appState.creatures.push(creature);
		}

		// Persist and refresh UI
		localStorage.setItem('arkCreatures', JSON.stringify(appState.creatures || []));
		// Close modal if open
		try { if (typeof closeCreatureModal === 'function') closeCreatureModal(); } catch (e) {}
		try { loadSpeciesPage(); } catch (e) {}
		try { updateStatsDashboard(); } catch (e) {}
	} catch (err) {
		console.error('saveCreature failed', err);
	}
}
window.saveCreature = saveCreature;

// Resilient startup fallback: if the page remains hidden or the login UI
// wasn't shown (due to an earlier error), force the app shell visible and
// show the login page after a short timeout. This avoids leaving users with
// a blank screen if any early init step throws.
setTimeout(() => {
	try {
		const docEl = document.documentElement;
		// If data-ready wasn't set by the aggressive cleanup, set it now.
		if (docEl.getAttribute('data-ready') !== 'true') {
			console.warn('[SPA] startup fallback: forcing data-ready=true');
			try { docEl.setAttribute('data-ready', 'true'); } catch (e) {}
		}

		// Ensure visibility style isn't accidentally hiding the page
		try { docEl.style.visibility = ''; } catch (e) {}

		// If landing page is present but still hidden, explicitly show it
		const landing = document.getElementById('landingPage');
		const register = document.getElementById('registerPage');
		const mainApp = document.getElementById('mainApp');
		if (landing && getComputedStyle(landing).display === 'none') {
			if (typeof isLoggedIn === 'function' && isLoggedIn()) {
				try { showMainApp(); } catch (e) { console.warn('[SPA] showMainApp failed', e); }
			} else {
				try { showLoginPage(); } catch (e) { console.warn('[SPA] showLoginPage failed', e); }
			}
		}
	} catch (err) {
		console.warn('[SPA] startup fallback encountered an error', err);
	}
}, 700);
