// --- SPA Logic and Event Handlers (migrated from index.html) ---
function showLoginPage() {
	document.getElementById('landingPage').style.display = '';
	document.getElementById('landingPage').classList.remove('hidden');
	document.getElementById('registerPage').style.display = 'none';
	document.getElementById('registerPage').classList.add('hidden');
	document.getElementById('mainApp').style.display = 'none';
}
function showRegisterPage() {
	document.getElementById('landingPage').style.display = 'none';
	document.getElementById('landingPage').classList.add('hidden');
	document.getElementById('registerPage').style.display = '';
	document.getElementById('registerPage').classList.remove('hidden');
	document.getElementById('mainApp').style.display = 'none';
}
function showMainApp() {
	document.getElementById('landingPage').style.display = 'none';
	document.getElementById('landingPage').classList.add('hidden');
	document.getElementById('registerPage').style.display = 'none';
	document.getElementById('registerPage').classList.add('hidden');
	document.getElementById('mainApp').style.display = '';
}
window.showLoginPage = showLoginPage;
window.showRegisterPage = showRegisterPage;

function isLoggedIn() {
	const token = localStorage.getItem('token');
	return typeof token === 'string' && token.trim().length > 0;
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
	if (isLoggedIn()) {
		showMainApp();
		updateTribeHeader();
		loadSpeciesPage(); // Default page after login
	} else {
		showLoginPage();
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
	document.getElementById('appMainContent').innerHTML = `
		<section class="dashboard-section">
			<h2 class="dashboard-title">Welcome to Dino Nuggie Manager!</h2>
			<div class="dashboard-cards">
				<div class="dashboard-card">
					<h3>Tribe Info</h3>
					<div id="tribeInfo">
						<strong>Leader:</strong> <span id="tribeLeaderInfo"></span><br>
						<strong>Server:</strong> <span id="tribeServerInfo"></span><br>
						<strong>Map:</strong> <span id="tribeMapInfo"></span><br>
						<strong>Goals:</strong> <span id="tribeGoalsInfo"></span>
					</div>
				</div>
				<div class="dashboard-card">
					<h3>Species Grid</h3>
					<div id="speciesGrid">
						<!-- Species grid will be rendered here by JS -->
					</div>
				</div>
			</div>
		</section>
	`;
	document.getElementById('tribeLeaderInfo').textContent = appState.tribeSettings.leader || 'N/A';
	document.getElementById('tribeServerInfo').textContent = appState.tribeSettings.serverType || 'N/A';
	document.getElementById('tribeMapInfo').textContent = appState.tribeSettings.primaryMap || 'N/A';
	document.getElementById('tribeGoalsInfo').textContent = appState.tribeSettings.breedingGoals || 'N/A';

	// Example: Render a static species grid (replace with dynamic if needed)
	const grid = document.getElementById('speciesGrid');
	if (grid) {
		const creatures = appState.creatures || [];
		if (creatures.length === 0) {
			grid.innerHTML = '<div class="no-creatures-yet">No creatures added yet.</div>';
		} else {
			grid.innerHTML = creatures.map(c => `
				<div class="creature-image-list">${renderCreatureImage(c, 'creature-image-list')}</div>
			`).join('');
		}
	}
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

// --- SPECIES_DATABASE ---
const SPECIES_DATABASE = {
// ...existing species data...
};
