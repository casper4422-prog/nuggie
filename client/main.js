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
	document.getElementById('tribeHeader').textContent = tribeName;
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

	// Inject the exact header markup into the main app area (replace existing header)
	function injectExactHeader() {
		var mainApp = document.getElementById('mainApp') || document.getElementById('mainContainer') || document.body;
		if (!mainApp) return;
		var oldHeader = mainApp.querySelector('.header');
		if (oldHeader) oldHeader.remove();
		var header = document.createElement('header');
		header.className = 'header';
		header.innerHTML = '<div class="header-content">' +
			'<div class="header-top">' +
				'<div class="logo"><div class="logo-icon">🦕</div>DINO NUGGIES</div>' +
				'<div class="header-actions">' +
					'<button class="btn btn-secondary" id="openTribeBtn">🏛️ Tribe Settings</button>' +
				'</div>' +
			'</div>' +
			'<div class="header-subtitle">Ark Creature Management System Brought to You By Casper4422. Grow Your Armies Here!</div>' +
			'<div class="header-status">Work in Progress, please report any issues or bugs to casper.4422</div>' +
		'</div>';
		if (mainApp.firstChild) mainApp.insertBefore(header, mainApp.firstChild);
		else mainApp.appendChild(header);
	}

	// Compute base and load the exact theme CSS before revealing UI to avoid overlap
	(async function prepareTheme() {
		const base = resolveBasePath();
		const cssHref = base + 'theme-exact.css';
		console.log('[SPA] loading exact theme from', cssHref);
		const ok = await loadStylesheet(cssHref, 2500);
		if (!ok) console.warn('[SPA] theme-exact.css failed to load or timed out:', cssHref);
		// Apply class that scopes the exact theme
		try { document.documentElement.classList.add('theme-exact'); } catch (e) {}
		// Inject header now that stylesheet is present
		try { injectExactHeader(); } catch (e) { console.warn('[SPA] injectExactHeader failed', e); }
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
			if (openTribeBtn) openTribeBtn.addEventListener('click', showTribeSettings);
			const goToCreaturesBtn = document.getElementById('goToCreaturesBtn');
			if (goToCreaturesBtn) goToCreaturesBtn.addEventListener('click', goToCreatures);
			const goToMyNuggiesBtn = document.getElementById('goToMyNuggiesBtn');
			if (goToMyNuggiesBtn) goToMyNuggiesBtn.addEventListener('click', goToMyNuggies);
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
			loadSpeciesPage();
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
			showLoginPage();
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
	filterSpecies();
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

		let matchesCategory = true;
		if (categoryFilter) {
			if (categoryFilter === 'flyer') {
				matchesCategory = species.speeds && species.speeds.flying && species.speeds.flying > 0;
			} else {
				matchesCategory = (species.category && species.category.toLowerCase() === categoryFilter) ||
								  (species.diet && species.diet.toLowerCase() === categoryFilter);
			}
		}

		const matchesRarity = !rarityFilter || (species.rarity && species.rarity.toLowerCase() === rarityFilter);

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

	const statsHTML = `
		<div class="species-stats">
			<div class="stat-row"><span class="stat-icon">❤️</span><span class="stat-value">${highestStats.Health?.value || 0}</span></div>
			<div class="stat-row"><span class="stat-icon">🏃</span><span class="stat-value">${highestStats.Stamina?.value || 0}</span></div>
			<div class="stat-row"><span class="stat-icon">💨</span><span class="stat-value">${highestStats.Oxygen?.value || 0}</span></div>
		</div>
	`;

	card.innerHTML = `
		<div class="species-card-header">
			<div class="species-icon">${species.icon || '🦖'}</div>
			<div class="species-info">
				<div class="species-name">${species.name}</div>
				<div class="species-meta">${species.category || ''} • ${species.rarity || ''}</div>
			</div>
			<div class="species-count">${creatureCount} owned</div>
		</div>
		<div class="species-card-body">
			${statsHTML}
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
	document.getElementById('appMainContent').innerHTML = '<h2>My Nuggies</h2><p>Your saved creature cards will appear here. (Sorting/filtering UI coming soon!)</p>';
	// TODO: Fetch and display user creature cards from backend
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
