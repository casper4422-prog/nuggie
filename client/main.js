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
	register.style.display = 'none';
	register.classList.add('hidden');
	mainApp.style.display = 'none';
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
	register.style.display = '';
	register.classList.remove('hidden');
	mainApp.style.display = 'none';
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
	register.style.display = 'none';
	register.classList.add('hidden');
	mainApp.style.display = '';
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
	}
}
window.handleAuthClick = handleAuthClick;

function updateTribeHeader() {
	// Replace with actual tribe name from user profile if available
	const tribeName = localStorage.getItem('tribeName') || 'My Tribe';
	document.getElementById('tribeHeader').textContent = tribeName;
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
	try {
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

// --- Login/Register Handlers (API calls) ---
async function handleLogin(event) {
	event.preventDefault();
	const email = document.getElementById('loginEmail').value;
	const password = document.getElementById('loginPassword').value;
	const errorDiv = document.getElementById('loginError');
	errorDiv.style.display = 'none';
	try {
		const res = await fetch('https://nuggie.onrender.com/api/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email, password })
		});
		const data = await res.json();
		if (res.ok && data.token) {
			localStorage.setItem('token', data.token);
			showMainApp();
			updateTribeHeader();
			loadSpeciesPage();
		} else {
			errorDiv.textContent = data.error || 'Login failed.';
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
	const email = document.getElementById('registerEmail').value;
	const password = document.getElementById('registerPassword').value;
	const confirmPassword = document.getElementById('registerConfirmPassword').value;
	const errorDiv = document.getElementById('registerError');
	errorDiv.style.display = 'none';
	if (password !== confirmPassword) {
		errorDiv.textContent = 'Passwords do not match.';
		errorDiv.style.display = 'block';
		return false;
	}
	try {
		const res = await fetch('https://nuggie.onrender.com/api/register', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email, password })
		});
		const data = await res.json();
		if (res.ok && data.success) {
			showLoginPage();
		} else {
			errorDiv.textContent = data.error || 'Registration failed.';
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

function loadSpeciesPage() {
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
	if (!SPECIES_DATABASE) {
		grid.innerHTML = '<div class="no-species-found">Species database unavailable.</div>';
		return;
	}

	grid.innerHTML = '';
	let filteredCount = 0;

	Object.values(SPECIES_DATABASE).forEach(species => {
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

// --- SPECIES_DATABASE wiring ---
// The full species data is provided by species-database.js which sets `window.SPECIES_DATABASE`.
// If that file is unavailable, fall back to an empty object to avoid runtime errors.
if (typeof window !== 'undefined' && window.SPECIES_DATABASE) {
	// Use the species DB defined in the separate file
	window.__SPECIES_DB = window.SPECIES_DATABASE;
} else {
	console.error('[SPA] species-database.js not loaded or SPECIES_DATABASE missing; functionality will be limited.');
	window.__SPECIES_DB = {};
}

// Local alias used throughout main.js
const SPECIES_DATABASE = window.__SPECIES_DB;
