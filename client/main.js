// We'll set the readiness marker only after our exact theme CSS is loaded
// to avoid the original UI flashing and then being overlapped by the injected UI.

// --- SPA Logic and Event Handlers (migrated from index.html) ---
// Configurable API base. Consumers can override by setting window.__NUGGIE_API_BASE__ before this script runs.
// Default to the current page origin when available so the SPA works when served from the API host.
const API_BASE = (typeof window !== 'undefined' && window.__NUGGIE_API_BASE__)
	? window.__NUGGIE_API_BASE__
	: ((typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : 'https://nuggie.onrender.com');
// Fallback API host we can probe when the primary origin doesn't expose API routes.
const FALLBACK_API_BASE = 'https://nuggie.onrender.com';

// Small helper: parse a JWT without validating signature. Returns payload object or null.
// apiFetch: send cookies to server (credentials include). On 401 attempt refresh once.

function resolveApiBase() {
	// Allow runtime override when we detect that the page origin doesn't host the API
	if (typeof window !== 'undefined' && window.__NUGGIE_API_OVERRIDE__) return window.__NUGGIE_API_OVERRIDE__;
	return API_BASE;
}

async function apiFetch(path, opts = {}) {
	const base = resolveApiBase();
	const url = path.indexOf('http') === 0 ? path : (base.replace(/\/$/, '') + '/' + path.replace(/^\//, ''));
	const cfg = Object.assign({}, { credentials: 'include', headers: Object.assign({}, opts.headers || {}) }, opts);
	let resp = await fetch(url, cfg);
	if (resp.status === 401) {
		// try refresh
		try {
			const r = await fetch(API_BASE.replace(/\/$/, '') + '/api/refresh', { method: 'POST', credentials: 'include' });
			if (r && r.ok) {
				// retry original request once
				resp = await fetch(url, cfg);
			} else {
				// logout client side
				try { await fetch(API_BASE.replace(/\/$/, '') + '/api/logout', { method: 'POST', credentials: 'include' }); } catch (e) {}
				try { showLoginPage(); updateAuthUI(); } catch (e) {}
			}
		} catch (e) { try { showLoginPage(); updateAuthUI(); } catch (e) {} }
	} else if (resp.status === 403) {
		try { showLoginPage(); updateAuthUI(); } catch (e) {}
	}
	return resp;
}
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

// isLoggedIn: do a lightweight server probe (via /api/me) when needed; for quick checks rely on cached flag
let __AUTH_CACHE = { loggedIn: false, lastChecked: 0 };
async function isLoggedIn(checkServer = false) {
	// quick return if cached and recent
	if (!checkServer && (Date.now() - __AUTH_CACHE.lastChecked) < 5 * 60 * 1000) return __AUTH_CACHE.loggedIn;
	try {
		const resp = await apiFetch('/api/me');
		if (resp && resp.ok) { __AUTH_CACHE = { loggedIn: true, lastChecked: Date.now() }; return true; }
	} catch (e) {}
	__AUTH_CACHE = { loggedIn: false, lastChecked: Date.now() };
	return false;
}
function handleAuthClick() {
	(async () => {
		const logged = await isLoggedIn();
		if (logged) {
			try { await fetch(API_BASE.replace(/\/$/, '') + '/api/logout', { method: 'POST', credentials: 'include' }); } catch (e) {}
		}
		showLoginPage();
		try { await updateAuthUI(); } catch (e) { /* ignore */ }
	})();
}
window.handleAuthClick = handleAuthClick;

function updateTribeHeader() {
	// Replace with actual tribe name from user profile if available
	const tribeName = localStorage.getItem('tribeName') || 'My Tribe';
	const el = document.getElementById('tribeHeader');
	if (el) el.textContent = tribeName;
}

async function updateAuthUI() {
	const authBtn = document.getElementById('authBtn');
	if (!authBtn) return;
	const logged = await isLoggedIn();
	authBtn.textContent = logged ? 'Sign Out' : 'Sign In';
	authBtn.classList.toggle('btn-danger', logged);
	authBtn.classList.toggle('btn-primary', !logged);
}
function goToCreatures() {
	loadSpeciesPage();
}
function goToMyNuggies() {
	loadMyNuggiesPage();
}
window.goToCreatures = goToCreatures;
window.goToMyNuggies = goToMyNuggies;

document.addEventListener('DOMContentLoaded', async () => {
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
		// Candidate locations to try for theme-exact.css. We try the resolved base first,
		// then a few fallbacks (root, relative) to handle different hosting layouts.
		const candidates = [
			(base ? base + 'theme-exact.css' : null),
			(base ? base + 'theme-exact.css?cb=' + Date.now() : null),
			'/theme-exact.css',
			'theme-exact.css',
			'./theme-exact.css'
		].filter(Boolean);
		let loaded = false;
		for (const href of candidates) {
			try {
				console.log('[SPA] attempting to load theme CSS from', href);
				/* eslint-disable no-await-in-loop */
				const ok = await loadStylesheet(href, 2200);
				/* eslint-enable no-await-in-loop */
				if (ok) {
					console.log('[SPA] theme-exact.css loaded from', href);
					document.documentElement.classList.add('theme-exact');
					loaded = true;
					break;
				} else {
					console.warn('[SPA] failed to load theme-exact.css from', href);
				}
			} catch (e) {
				console.warn('[SPA] error loading theme-exact.css from', href, e);
			}
		}
		if (!loaded) {
			console.warn('[SPA] theme-exact.css could not be loaded from any candidate path; using base styles');
		}
		// Header is static; no runtime injection required here
		// Now mark the document ready so CSS guard un-hides content with new styling (or fallbacks)
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
		} catch (wireErr) {
			console.warn('[SPA] UI wiring failed', wireErr);
		}

		if (await isLoggedIn()) {
			console.log('[SPA] User is logged in');
			// Try to refresh basic profile info from server. If token is invalid the apiFetch will force logout.
			try {
				let meResp = await apiFetch('/api/me');
				// If the page origin doesn't host the API we may get 404; try the fallback host and switch to it
				if (meResp && meResp.status === 404) {
					console.warn('[SPA] /api/me returned 404 from primary API base; probing fallback host');
					try {
						const probe = await fetch((FALLBACK_API_BASE.replace(/\/$/, '') + '/api/me'), { method: 'GET', credentials: 'include' });
						if (probe && probe.ok) {
							console.log('[SPA] fallback API responded; switching API base to', FALLBACK_API_BASE);
							window.__NUGGIE_API_OVERRIDE__ = FALLBACK_API_BASE;
							meResp = probe;
						}
					} catch (e) { console.warn('[SPA] fallback probe failed', e); }
				}
				if (meResp && meResp.ok) {
					const me = await meResp.json();
					if (me && me.email) localStorage.setItem('tribeName', me.email.split('@')[0]);
				}
			} catch (e) { /* ignore */ }
			// Fetch server-stored creatures and merge with local state (server authoritative)
			try {
				const resp = await apiFetch('/api/creature');
				if (resp && resp.ok) {
					const serverCreatures = await resp.json();
					// Merge: keep server items (numeric ids) and append local-only items (string ids)
					const local = appState.creatures || [];
					const localOnly = local.filter(c => typeof c.id === 'string' && !serverCreatures.find(sc => String(sc.id) === String(c.id)));
					appState.creatures = (serverCreatures || []).concat(localOnly);
					try { localStorage.setItem('arkCreatures', JSON.stringify(appState.creatures || [])); } catch (e) {}
				}
			} catch (e) { /* ignore */ }
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
		const res = await apiFetch('/api/login', {
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
	if (res && typeof res.status === 'number' && res.status >= 200 && res.status < 300) {
			// Server sets httpOnly cookies; probe /api/me to fetch profile and derive tribeName.
			try {
				const meResp = await apiFetch('/api/me');
				if (meResp && meResp.ok) {
					const me = await meResp.json();
					if (me && me.email) try { localStorage.setItem('tribeName', me.email.split('@')[0]); } catch (e) {}
					// update auth cache so immediate subsequent calls know we're logged in
					try { __AUTH_CACHE = { loggedIn: true, lastChecked: Date.now() }; } catch (e) {}
				}
			} catch (e) { /* ignore */ }
			// Ensure the document is visible and the main app is shown
			try { document.documentElement.setAttribute('data-ready', 'true'); } catch (e) {}
			showMainApp();
			updateTribeHeader();
			// Wait for species DB to be available before rendering species page
			try { await waitForSpeciesDB(3000, 50); } catch (e) {}
			try { loadSpeciesPage(); } catch (e) {}
			// Refresh stats and auth UI after login
			try { updateStatsDashboard(); } catch (e) {}
			try { await updateAuthUI(); } catch (e) {}
		} else {
			// Show helpful diagnostic including status and any server-provided body
			console.warn('[SPA] login failed', { status: (res && res.status), body: data, res });
			// surface to UI log as well for quick debugging
			console.log('[SPA] login response body:', data);
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
		const res = await apiFetch('/api/register', {
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
	if (res && typeof res.status === 'number' && res.status >= 200 && res.status < 300 && (data === true || (data && data.success))) {
			// Server set cookies for auth. Probe /api/me to fetch profile and show the main app.
			try {
				const meResp = await apiFetch('/api/me');
				if (meResp && meResp.ok) {
					const me = await meResp.json();
					if (me && me.email) try { localStorage.setItem('tribeName', me.email.split('@')[0]); } catch (e) {}
					try { __AUTH_CACHE = { loggedIn: true, lastChecked: Date.now() }; } catch (e) {}
				}
			} catch (e) { /* ignore */ }
			try { document.documentElement.setAttribute('data-ready', 'true'); } catch (e) {}
			showMainApp();
			updateTribeHeader();
			try { loadSpeciesPage(); } catch (e) {}
			try { updateStatsDashboard(); } catch (e) {}
			try { await updateAuthUI(); } catch (e) {}
		} else {
			console.warn('[SPA] register failed', { status: res.status, body: data });
			console.log('[SPA] register response body:', data);
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
					<input id="searchInput" class="form-control" placeholder="Search species by name, category or tags">
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
	(async function populateFilters() {
		const capitalize = (s) => (s || '').toString().replace(/\b\w/g, c => c.toUpperCase());
		try {
			// Wait for species DB to be ready (up to 3s), then build filter lists
			await waitForSpeciesDB(3000, 50);
			const db = getSpeciesDB() || {};
			const list = Object.values(db || {});
			const cats = new Set();
			const rarities = new Set();
			list.forEach(s => {
				if (!s) return;
				// Use category and tags as category sources; do NOT use diet as a category source
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
			// Attach filter handlers
			if (categoryFilterEl) categoryFilterEl.addEventListener('change', filterSpecies);
			if (rarityFilterEl) rarityFilterEl.addEventListener('change', filterSpecies);
			// Run the filter to populate the grid
			filterSpecies();
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

			// Search should match name, category, tags, and description
			const tagsText = (species.tags && Array.isArray(species.tags)) ? species.tags.join(' ').toLowerCase() : '';
			const catText = (species.category || '').toLowerCase();
			const descText = (species.description || '').toLowerCase();
			const nameText = (species.name || '').toLowerCase();
			const matchesSearch = !searchTerm || (
				nameText.includes(searchTerm) ||
				catText.includes(searchTerm) ||
				tagsText.includes(searchTerm) ||
				descText.includes(searchTerm)
			);

		// Category matching: accept contains/includes (handles multi-value categories or tags),
		// and special-case 'flyer' to detect flying species via speeds or category/tag mentions.
		let matchesCategory = true;
		if (categoryFilter) {
			try {
				const cat = (species.category || '') + '';
				const tags = (species.tags && Array.isArray(species.tags)) ? species.tags.join(' ') : '';
				const hay = (cat + ' ' + tags).toLowerCase();
				if (categoryFilter === 'flyer') {
					// Prefer an explicit 'flight' indicator or tags mentioning flying
					const flying = (species.speeds && (Number(species.speeds.flying) || 0)) || 0;
					const flightFlag = species.flight || species.canFly || false;
					matchesCategory = flying > 0 || flightFlag === true || hay.includes('fly') || hay.includes('flying') || hay.includes('wing');
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
	try { loadCreaturesGrid(null); } catch (e) { console.warn('loadCreaturesGrid failed on My Nuggies page', e); }
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
async function saveCreature(payload) {
	try {
		// payload may be { species, editing } (from creatures.js) or a full creature object
		if (!payload) return console.warn('saveCreature called with no payload');

		// If payload contains a full creature object
		if (payload && payload.id && payload.name) {
			// If logged in, try to sync to server
			if (typeof isLoggedIn === 'function' && typeof apiFetch === 'function' && await isLoggedIn()) {
				try {
					const resp = await apiFetch('/api/creature', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: payload }) });
					if (resp && resp.ok) {
						const body = await resp.json();
						if (body && body.id) payload.id = body.id;
					}
				} catch (e) { /* ignore: fallback to local */ }
			}
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
setTimeout(async () => {
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
			try {
				if (typeof isLoggedIn === 'function' && await isLoggedIn()) {
					try { showMainApp(); } catch (e) { console.warn('[SPA] showMainApp failed', e); }
				} else {
					try { showLoginPage(); } catch (e) { console.warn('[SPA] showLoginPage failed', e); }
				}
			} catch (e) { try { showLoginPage(); } catch (ee) {} }
		}
	} catch (err) {
		console.warn('[SPA] startup fallback encountered an error', err);
	}
}, 700);
