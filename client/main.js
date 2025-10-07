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
window.__API_BASE = window.__API_BASE || 'http://localhost:3001'; // Default to localhost if not set

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
                <div class="form-group">
                    <label class="form-label" for="registerPasswordConfirm">Re-enter Password</label>
                    <input class="form-control" id="registerPasswordConfirm" type="password" required autocomplete="new-password">
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
            const passwordConfirm = document.getElementById('registerPasswordConfirm')?.value;
            const errorDiv = document.getElementById('registerError');
            
            if (!email || !password || !passwordConfirm) {
                if (errorDiv) errorDiv.textContent = 'Please fill out all required fields';
                return;
            }
            
            if (password !== passwordConfirm) {
                if (errorDiv) errorDiv.textContent = 'Passwords do not match';
                return;
            }
            
            if (password.length < 6) {
                if (errorDiv) errorDiv.textContent = 'Password must be at least 6 characters';
                return;
            }
            
            try {
                const res = await fetch('/api/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password, nickname, discord_name: discord })
                });
                
                // Check if response is ok first
                if (!res.ok) {
                    // Try to get error message from response
                    let errorMessage = 'Registration failed';
                    try {
                        const errorData = await res.json();
                        errorMessage = errorData.error || errorMessage;
                    } catch (e) {
                        // If JSON parsing fails, use status text
                        errorMessage = res.statusText || errorMessage;
                    }
                    console.log('Registration failed with status:', res.status, errorMessage);
                    if (errorDiv) errorDiv.textContent = errorMessage;
                    return;
                }
                
                // Parse response JSON
                let data;
                try {
                    data = await res.json();
                } catch (e) {
                    console.error('Failed to parse registration response JSON:', e);
                    if (errorDiv) errorDiv.textContent = 'Server response error. Please try again.';
                    return;
                }
                
                console.log('Registration response:', res.status, data);
                
                if (data.success || data.token) {
                    console.log('Registration successful, showing main app');
                    // Store credentials and show main app
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('userId', data.userId);
                    if (data.email) localStorage.setItem('userEmail', data.email);
                    if (data.nickname) localStorage.setItem('userNickname', data.nickname);
                    // Ensure the document is visible and the main app is shown
                    try { document.documentElement.setAttribute('data-ready', 'true'); } catch (e) {}
                    showMainApp();
                    updateTribeHeader();
                    // Load My Profile page as landing page
                    loadMyProfilePage();
                    // Sync server-stored creatures and planner/arena data for this user
                    try { await loadServerCreatures(); } catch (e) { console.warn('loadServerCreatures after registration failed', e); }
                    try { await loadServerBossData(); } catch (e) { console.warn('loadServerBossData after registration failed', e); }
                    try { await loadServerArenaCollections(); } catch (e) { console.warn('loadServerArenaCollections after registration failed', e); }
                    // Refresh stats and auth UI after registration
                    try { updateStatsDashboard(); } catch (e) {}
                    try { updateAuthUI(); } catch (e) {}
                } else {
                    console.log('Registration failed:', data.error);
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

// Load the main species page (your beautiful species grid)
async function loadSpeciesPage() {
    const main = document.getElementById('appMainContent');
    if (!main) return;
    
    main.innerHTML = `
        <div id="speciesPage">
            <!-- Stats Dashboard -->
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-number" id="totalCreatures">0</div>
                    <div class="stat-label">Total Creatures</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number" id="speciesTracked">0</div>
                    <div class="stat-label">Species Owned</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number" id="bossReadySpecies">0</div>
                    <div class="stat-label">Boss Ready Species</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number" id="prizedBloodlines">0</div>
                    <div class="stat-label">Prized Bloodlines</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number" id="highestLevel">1</div>
                    <div class="stat-label">Highest Level</div>
                </div>
            </div>

            <!-- Main Content -->
            <div class="main-content">
                <!-- Species Controls -->
                <div class="species-controls">
                    <div class="search-box">
                        <span class="search-icon">🔍</span>
                        <input type="text" class="search-input" id="searchInput" placeholder="Search species by name or type..." oninput="filterSpecies()">
                    </div>
                    <select class="filter-select" id="categoryFilter" onchange="filterSpecies()">
                        <option value="">All Categories</option>
                        <option value="carnivore">Carnivore</option>
                        <option value="herbivore">Herbivore</option>
                        <option value="omnivore">Omnivore</option>
                        <option value="flyer">Flyer</option>
                        <option value="combat">Combat</option>
                        <option value="utility">Utility</option>
                        <option value="transport">Transport</option>
                        <option value="harvesting">Harvesting</option>
                        <option value="boss">Boss</option>
                    </select>
                    <select class="filter-select" id="rarityFilter" onchange="filterSpecies()">
                        <option value="">All Rarities</option>
                        <option value="common">Common</option>
                        <option value="uncommon">Uncommon</option>
                        <option value="rare">Rare</option>
                        <option value="legendary">Legendary</option>
                        <option value="event">Event</option>
                        <option value="mission">Mission</option>
                        <option value="tek">Tek</option>
                    </select>
                </div>

                <!-- Species Grid -->
                <div class="species-grid" id="speciesGrid">
                    <!-- Species cards will be dynamically generated -->
                </div>
            </div>
        </div>
    `;
    
    // Wait for species database to load
    await waitForSpeciesDB(3000, 50);
    
    // Load and render species
    try {
        updateStatsDashboard();
        renderSpeciesGrid();
    } catch (e) {
        console.error('Failed to render species grid:', e);
        const grid = document.getElementById('speciesGrid');
        if (grid) {
            grid.innerHTML = '<div class="no-species-found">Failed to load species database</div>';
        }
    }
}

// Species Grid Management (restored from Old Nugget)
function renderSpeciesGrid() {
    console.log('Loading species grid...');
    
    // Clear any existing filters and show all species
    const searchInput = document.getElementById('searchInput');
    const categoryFilter = document.getElementById('categoryFilter');
    const rarityFilter = document.getElementById('rarityFilter');
    
    if (searchInput) searchInput.value = '';
    if (categoryFilter) categoryFilter.value = '';
    if (rarityFilter) rarityFilter.value = '';
    
    // Use the filter function to display all species
    filterSpecies();
}

function createSpeciesCard(species, creatureCount) {
    if (!species) {
        console.error('Species is null or undefined');
        return null;
    }
    
    if (!species.name || !species.icon || !species.rarity || !species.category) {
        console.error('Species missing required fields:', species);
        return null;
    }
    
    try {
        const card = document.createElement('div');
        card.className = 'species-card';
        card.onclick = () => openCreaturePage(species.name);

        // Get creatures for this species to calculate badges and stats
        const speciesCreatures = window.appState?.creatures?.filter(c => c.species === species.name) || [];
        
        // Generate basic stats display
        let statsHTML = `
            <div class="species-stats">
                <div class="species-stat">
                    <span class="species-stat-label">Combat</span>
                    <span class="species-stat-value">${species.ratings?.combat || 'N/A'}</span>
                </div>
                <div class="species-stat">
                    <span class="species-stat-label">Transport</span>
                    <span class="species-stat-value">${species.ratings?.transport || 'N/A'}</span>
                </div>
                <div class="species-stat">
                    <span class="species-stat-label">Speed</span>
                    <span class="species-stat-value">${species.ratings?.speed || 'N/A'}</span>
                </div>
                <div class="species-stat">
                    <span class="species-stat-label">Utility</span>
                    <span class="species-stat-value">${species.ratings?.survivability || 'N/A'}</span>
                </div>
            </div>
        `;

        // Generate badges
        let badgesHTML = '';
        if (species.badgeCategories && species.badgeCategories.length > 0) {
            badgesHTML = `
                <div class="species-badges">
                    ${species.badgeCategories.slice(0, 3).map(badge => 
                        `<span class="species-badge">${badge}</span>`
                    ).join('')}
                </div>
            `;
        }

        card.innerHTML = `
            <div class="species-card-header">
                <div class="species-icon">${species.icon}</div>
                <div>
                    <div class="species-name">${species.name}</div>
                    <div class="species-category">${species.category} • ${species.rarity}</div>
                </div>
            </div>
            <div class="species-card-body">
                ${statsHTML}
                ${badgesHTML}
                <div style="color: #94a3b8; font-size: 0.875rem; margin-top: 12px;">
                    ${creatureCount} creatures owned
                </div>
            </div>
        `;

        return card;
    } catch (error) {
        console.error('Error creating species card for', species.name, ':', error);
        return null;
    }
}

function filterSpecies() {
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
    const categoryFilter = document.getElementById('categoryFilter')?.value.toLowerCase() || '';
    const rarityFilter = document.getElementById('rarityFilter')?.value.toLowerCase() || '';
    
    const grid = document.getElementById('speciesGrid');
    
    if (!grid) {
        console.error('Species grid element not found');
        return;
    }
    
    // Check both possible database locations
    const database = window.SPECIES_DATABASE || window.EXPANDED_SPECIES_DATABASE;
    
    if (!database) {
        console.error('Species database not found');
        grid.innerHTML = '<div class="no-species-found">Species database loading...</div>';
        return;
    }
    
    grid.innerHTML = '';
    console.log('Filtering species with:', { searchTerm, categoryFilter, rarityFilter });
    console.log('Database has', Object.keys(database).length, 'species');

    let filteredCount = 0;
    Object.values(database).forEach(species => {
        if (!species || !species.name) {
            return;
        }
        
        // Apply search filter
        const matchesSearch = !searchTerm || 
            species.name.toLowerCase().includes(searchTerm) ||
            (species.category && species.category.toLowerCase().includes(searchTerm)) ||
            (species.diet && species.diet.toLowerCase().includes(searchTerm));
        
        // Apply category filter
        let matchesCategory = false;
        if (!categoryFilter) {
            matchesCategory = true;
        } else if (categoryFilter === 'flyer') {
            matchesCategory = species.speeds && species.speeds.flying && species.speeds.flying > 0;
        } else {
            matchesCategory = (species.category && species.category.toLowerCase() === categoryFilter) ||
                            (species.diet && species.diet.toLowerCase() === categoryFilter);
        }
        
        // Apply rarity filter
        const matchesRarity = !rarityFilter || 
            (species.rarity && species.rarity.toLowerCase() === rarityFilter);
        
        // Show species if it matches all filters
        if (matchesSearch && matchesCategory && matchesRarity) {
            const creatureCount = window.appState?.creatures?.filter(c => c.species === species.name).length || 0;
            const card = createSpeciesCard(species, creatureCount);
            if (card) {
                grid.appendChild(card);
                filteredCount++;
            }
        }
    });

    console.log(`Filtered species: showing ${filteredCount} species out of ${Object.keys(database).length} total`);
    
    if (filteredCount === 0) {
        grid.innerHTML = '<div class="no-species-found">No species found matching your filters.</div>';
    }
}

// Creature Page Management
function openCreaturePage(speciesName) {
    window.appState.currentSpecies = speciesName;
    const database = window.SPECIES_DATABASE || window.EXPANDED_SPECIES_DATABASE;
    const species = database[speciesName];
    
    if (!species) {
        console.error('Species not found:', speciesName);
        return;
    }
    
    const main = document.getElementById('appMainContent');
    if (!main) return;
    
    main.innerHTML = `
        <div class="main-content">
            <div class="creature-page-header">
                <div class="creature-page-icon">${species.icon}</div>
                <div class="creature-page-info">
                    <h1>${species.name}</h1>
                    <div class="creature-page-meta">${window.appState?.creatures?.filter(c => c.species === speciesName).length || 0} creatures</div>
                </div>
                <div class="creature-page-actions">
                    <button class="btn btn-primary" onclick="openCreatureModal()">
                        ➕ Add Creature
                    </button>
                    <button class="btn btn-secondary" onclick="goBackToSpecies()">
                        ← Back to Species
                    </button>
                </div>
            </div>
            
            <div class="species-info-container">
                <div class="tab-navigation">
                    <button class="tab-button active" onclick="switchTab('basic-info')">📖 Basic Info</button>
                    <button class="tab-button" onclick="switchTab('stats-combat')">📊 Stats & Combat</button>
                    <button class="tab-button" onclick="switchTab('utility-roles')">⚙️ Utility & Roles</button>
                </div>

                <div id="basic-info" class="tab-content active">
                    <div class="info-section">
                        <div class="dossier-text">
                            ${species.description || 'Species information will be available soon.'}
                        </div>
                    </div>
                    
                    <div class="info-section">
                        <div class="info-grid">
                            <div class="info-item">
                                <div class="info-label">Category</div>
                                <div class="info-value">${species.category || 'Unknown'}</div>
                            </div>
                            <div class="info-item">
                                <div class="info-label">Rarity</div>
                                <div class="info-value">${species.rarity || 'Unknown'}</div>
                            </div>
                            <div class="info-item">
                                <div class="info-label">Source</div>
                                <div class="info-value">${species.source || 'Unknown'}</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div id="stats-combat" class="tab-content">
                    <div class="info-section">
                        <div class="info-title">📊 Ratings</div>
                        <div class="info-grid">
                            <div class="info-item">
                                <div class="info-label">Combat</div>
                                <div class="info-value">${species.ratings?.combat || 'N/A'}/10</div>
                            </div>
                            <div class="info-item">
                                <div class="info-label">Transport</div>
                                <div class="info-value">${species.ratings?.transport || 'N/A'}/10</div>
                            </div>
                            <div class="info-item">
                                <div class="info-label">Speed</div>
                                <div class="info-value">${species.ratings?.speed || 'N/A'}/10</div>
                            </div>
                            <div class="info-item">
                                <div class="info-label">Survivability</div>
                                <div class="info-value">${species.ratings?.survivability || 'N/A'}/10</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div id="utility-roles" class="tab-content">
                    <div class="info-section">
                        <div class="info-grid">
                            <div class="info-item">
                                <div class="info-label">Primary Role</div>
                                <div class="info-value">${species.primaryRole || 'Unknown'}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function goBackToSpecies() {
    loadSpeciesPage();
}

function switchTab(tabId) {
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Remove active class from all tab buttons
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('active');
    });
    
    // Show selected tab content
    const selectedTab = document.getElementById(tabId);
    if (selectedTab) {
        selectedTab.classList.add('active');
    }
    
    // Add active class to selected button
    event.target.classList.add('active');
}

// Update stats dashboard
function updateStatsDashboard() {
    const creatures = window.appState?.creatures || [];
    const database = window.SPECIES_DATABASE || window.EXPANDED_SPECIES_DATABASE;
    const totalSpeciesInDB = database ? Object.keys(database).length : 0;
    const speciesOwned = new Set(creatures.map(c => c.species)).size;
    const prizedCount = 0; // Placeholder for badge system
    const highestLevel = creatures.length > 0 ? Math.max(...creatures.map(c => c.level || 1)) : 1;
    
    try {
        document.getElementById('totalCreatures').textContent = creatures.length;
        document.getElementById('speciesTracked').textContent = `${speciesOwned}/${totalSpeciesInDB}`;
        document.getElementById('bossReadySpecies').textContent = '0'; // Placeholder
        document.getElementById('prizedBloodlines').textContent = prizedCount;
        document.getElementById('highestLevel').textContent = highestLevel;
    } catch (e) {
        console.warn('Could not update stats dashboard:', e);
    }
}

// Make functions globally available
window.filterSpecies = filterSpecies;
window.openCreaturePage = openCreaturePage;
window.goBackToSpecies = goBackToSpecies;
window.switchTab = switchTab;
window.loadSpeciesPage = loadSpeciesPage;

// Setup navigation listeners for all nav buttons
function setupNavigationListeners() {
    console.log('[SPA] Setting up navigation listeners...');
    
    // Get all navigation buttons
    const navButtons = document.querySelectorAll('.nav-btn');
    
    navButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            const pageId = this.getAttribute('data-page');
            console.log(`[Navigation] Clicked: ${pageId}`);
            
            // Handle navigation based on page
            switch(pageId) {
                case 'profile':
                    loadMyProfilePage();
                    break;
                case 'creatures':
                    loadMyNuggiesPage();
                    break;
                case 'species':
                    loadSpeciesPage();
                    break;
                case 'trading':
                    loadTradingPage();
                    break;
                case 'tribes':
                    loadTribesPage();
                    break;
                case 'boss':
                    loadBossPage();
                    break;
                case 'arena':
                    loadArenaPage();
                    break;
                case 'friends':
                    loadFriendsPage();
                    break;
                case 'notifications':
                    toggleNotifications();
                    break;
                default:
                    console.warn(`[Navigation] Unknown page: ${pageId}`);
            }
        });
    });
}

// My Nuggies Page - Comprehensive Creature Management
function loadMyNuggiesPage() {
    setActiveNavButton('creatures');
    const main = document.getElementById('appMainContent');
    if (!main) return;
    
    const creatures = window.appState?.creatures || [];
    const database = window.SPECIES_DATABASE || window.EXPANDED_SPECIES_DATABASE;
    
    main.innerHTML = `
        <div class="nuggies-page">
            <div class="nuggies-header">
                <div class="page-title">
                    <h1>🍗 My Nuggies</h1>
                    <div class="creature-count">${creatures.length} creatures</div>
                </div>
                <div class="header-actions">
                    <button class="btn btn-primary" onclick="addNewCreature()">➕ Add Creature</button>
                    <button class="btn btn-secondary" onclick="exportCreatures()">📤 Export</button>
                    <button class="btn btn-secondary" onclick="importCreatures()">📥 Import</button>
                </div>
            </div>
            
            <div class="nuggies-controls">
                <div class="search-section">
                    <div class="search-group">
                        <input type="text" id="creatureSearch" placeholder="Search creatures..." class="search-input">
                        <button class="search-btn" onclick="searchCreatures()">🔍</button>
                    </div>
                </div>
                
                <div class="filter-section">
                    <select id="speciesFilter" class="filter-select" onchange="filterCreatures()">
                        <option value="">All Species</option>
                        ${generateSpeciesFilterOptions()}
                    </select>
                    
                    <select id="genderFilter" class="filter-select" onchange="filterCreatures()">
                        <option value="">All Genders</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                    </select>
                    
                    <select id="badgeFilter" class="filter-select" onchange="filterCreatures()">
                        <option value="">All Badges</option>
                        <option value="prized">Prized Bloodline</option>
                        <option value="boss-ready">Boss Ready</option>
                        <option value="boss-underdog">Boss Underdog</option>
                    </select>
                    
                    <select id="sortFilter" class="filter-select" onchange="sortCreatures()">
                        <option value="name">Sort by Name</option>
                        <option value="species">Sort by Species</option>
                        <option value="level">Sort by Level</option>
                        <option value="health">Sort by Health</option>
                        <option value="melee">Sort by Melee</option>
                        <option value="recent">Recently Added</option>
                    </select>
                    
                    <button class="btn btn-sm btn-secondary" onclick="clearFilters()">Clear All</button>
                </div>
            </div>
            
            <div class="nuggies-content">
                <div id="creaturesGrid" class="creatures-grid">
                    ${renderCreaturesGrid(creatures)}
                </div>
            </div>
        </div>
    `;
    
    // Initialize search and filter functionality
    setupCreatureSearch();
}

function loadTradingPage() {
    setActiveNavButton('trading');
    const main = document.getElementById('appMainContent');
    if (!main) return;
    
    const userCreatures = window.appState?.creatures || [];
    const mockTrades = generateMockTrades();
    
    main.innerHTML = `
        <div class="trading-page">
            <div class="trading-header">
                <div class="page-title">
                    <h1>🔄 Trading Hub</h1>
                    <div class="trade-count">${mockTrades.length} active trades</div>
                </div>
                <div class="header-actions">
                    <button class="btn btn-primary" onclick="createNewTrade()">➕ Create Trade</button>
                    <button class="btn btn-secondary" onclick="viewMyTrades()">📋 My Trades</button>
                    <button class="btn btn-secondary" onclick="tradeHistory()">📈 Trade History</button>
                </div>
            </div>
            
            <div class="trading-tabs">
                <button class="trade-tab active" onclick="switchTradeTab('marketplace')" data-tab="marketplace">
                    🏢 Marketplace
                </button>
                <button class="trade-tab" onclick="switchTradeTab('my-trades')" data-tab="my-trades">
                    📋 My Trades (3)
                </button>
                <button class="trade-tab" onclick="switchTradeTab('pending')" data-tab="pending">
                    ⏳ Pending (2)
                </button>
                <button class="trade-tab" onclick="switchTradeTab('completed')" data-tab="completed">
                    ✅ Completed (15)
                </button>
            </div>
            
            <div class="trading-controls">
                <div class="search-section">
                    <div class="search-group">
                        <input type="text" id="tradeSearch" placeholder="Search trades..." class="search-input">
                        <button class="search-btn" onclick="searchTrades()">🔍</button>
                    </div>
                </div>
                
                <div class="filter-section">
                    <select id="tradeTypeFilter" class="filter-select" onchange="filterTrades()">
                        <option value="">All Trade Types</option>
                        <option value="creature">Creature for Creature</option>
                        <option value="resources">Creature for Resources</option>
                        <option value="mixed">Mixed Trades</option>
                    </select>
                    
                    <select id="speciesWantedFilter" class="filter-select" onchange="filterTrades()">
                        <option value="">Any Species Wanted</option>
                        <option value="rex">Rex</option>
                        <option value="spino">Spino</option>
                        <option value="giga">Giga</option>
                        <option value="wyvern">Wyvern</option>
                    </select>
                    
                    <select id="tradeSortFilter" class="filter-select" onchange="sortTrades()">
                        <option value="recent">Most Recent</option>
                        <option value="value">Highest Value</option>
                        <option value="ending">Ending Soon</option>
                        <option value="rating">Best Rated</option>
                    </select>
                    
                    <button class="btn btn-sm btn-secondary" onclick="clearTradeFilters()">Clear All</button>
                </div>
            </div>
            
            <div class="trading-content">
                <div id="tradesContainer" class="trades-container">
                    ${renderTradingMarketplace(mockTrades)}
                </div>
            </div>
        </div>
    `;
    
    setupTradingSearch();
}

// Trading System Functions
function generateMockTrades() {
    return [
        {
            id: '1',
            trader: 'AlphaBreeder',
            traderRating: 4.8,
            type: 'creature',
            offering: {
                type: 'creature',
                species: 'Rex',
                name: 'Thunder King',
                level: 380,
                stats: { health: 85, melee: 92, stamina: 70 },
                gender: 'male',
                mutations: 12
            },
            wanting: {
                type: 'creature',
                species: 'Spino',
                minLevel: 350,
                preferredStats: { health: 80, melee: 85 },
                gender: 'female'
            },
            created: '2 hours ago',
            expires: '5 days',
            status: 'active',
            offers: 3
        },
        {
            id: '2',
            trader: 'DinoMaster99',
            traderRating: 4.5,
            type: 'resources',
            offering: {
                type: 'creature',
                species: 'Giga',
                name: 'Devastator',
                level: 450,
                stats: { health: 78, melee: 95, stamina: 65 },
                gender: 'female',
                mutations: 8
            },
            wanting: {
                type: 'resources',
                items: [
                    { name: 'Metal Ingot', quantity: 50000 },
                    { name: 'Polymer', quantity: 10000 },
                    { name: 'Electronics', quantity: 5000 }
                ]
            },
            created: '1 day ago',
            expires: '3 days',
            status: 'active',
            offers: 7
        },
        {
            id: '3',
            trader: 'WyvernRider',
            traderRating: 4.9,
            type: 'creature',
            offering: {
                type: 'creature',
                species: 'Crystal Wyvern',
                name: 'Prism Wing',
                level: 320,
                stats: { health: 88, melee: 75, stamina: 90 },
                gender: 'female',
                mutations: 15
            },
            wanting: {
                type: 'creature',
                species: 'Rock Drake',
                minLevel: 300,
                preferredStats: { health: 75, melee: 80 },
                gender: 'any'
            },
            created: '3 hours ago',
            expires: '1 week',
            status: 'active',
            offers: 1
        }
    ];
}

function renderTradingMarketplace(trades) {
    if (trades.length === 0) {
        return `
            <div class="empty-state">
                <div class="empty-icon">🛒</div>
                <h3>No trades available</h3>
                <p>Be the first to create a trade in the marketplace!</p>
                <button class="btn btn-primary" onclick="createNewTrade()">➕ Create First Trade</button>
            </div>
        `;
    }
    
    return trades.map(trade => {
        const offeringStats = trade.offering.stats;
        const badges = calculateTradeBadges(trade.offering);
        
        return `
            <div class="trade-card" onclick="openTradeDetails('${trade.id}')">
                <div class="trade-header">
                    <div class="trader-info">
                        <div class="trader-name">${trade.trader}</div>
                        <div class="trader-rating">
                            ${renderStars(trade.traderRating)} (${trade.traderRating})
                        </div>
                    </div>
                    <div class="trade-status">
                        <span class="status-badge ${trade.status}">${trade.status}</span>
                        <div class="offers-count">${trade.offers} offers</div>
                    </div>
                </div>
                
                <div class="trade-content">
                    <div class="trade-offering">
                        <div class="trade-section-title">Offering</div>
                        <div class="creature-offer">
                            <div class="creature-summary">
                                <span class="creature-species">${trade.offering.species}</span>
                                <span class="creature-name">"${trade.offering.name}"</span>
                                <span class="creature-level">Lvl ${trade.offering.level}</span>
                                <span class="creature-gender">${trade.offering.gender === 'male' ? '♂️' : '♀️'}</span>
                            </div>
                            
                            <div class="creature-stats-mini">
                                <div class="stat-mini">HP: ${offeringStats.health}</div>
                                <div class="stat-mini">Melee: ${offeringStats.melee}</div>
                                <div class="stat-mini">Stam: ${offeringStats.stamina}</div>
                                <div class="mutations-count">${trade.offering.mutations} muts</div>
                            </div>
                            
                            <div class="creature-badges-mini">
                                ${badges.map(badge => `<div class="badge-mini ${badge.class}">${badge.icon}</div>`).join('')}
                            </div>
                        </div>
                    </div>
                    
                    <div class="trade-arrow">↔️</div>
                    
                    <div class="trade-wanting">
                        <div class="trade-section-title">Wanting</div>
                        ${renderTradeWanting(trade.wanting)}
                    </div>
                </div>
                
                <div class="trade-footer">
                    <div class="trade-meta">
                        <span class="trade-time">Posted ${trade.created}</span>
                        <span class="trade-expires">Expires in ${trade.expires}</span>
                    </div>
                    <div class="trade-actions">
                        <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); makeOffer('${trade.id}')">
                            💰 Make Offer
                        </button>
                        <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); addToWatchlist('${trade.id}')">
                            🔖 Watch
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function renderTradeWanting(wanting) {
    if (wanting.type === 'creature') {
        return `
            <div class="creature-wanted">
                <div class="wanted-species">${wanting.species}</div>
                <div class="wanted-requirements">
                    <div class="wanted-req">Min Level: ${wanting.minLevel}</div>
                    <div class="wanted-req">Gender: ${wanting.gender}</div>
                    ${wanting.preferredStats ? `
                        <div class="wanted-stats">
                            Preferred: HP ${wanting.preferredStats.health}+ / Melee ${wanting.preferredStats.melee}+
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    } else if (wanting.type === 'resources') {
        return `
            <div class="resources-wanted">
                ${wanting.items.map(item => `
                    <div class="resource-item">
                        <span class="resource-name">${item.name}</span>
                        <span class="resource-quantity">${item.quantity.toLocaleString()}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }
    return '<div>Mixed trade requirements</div>';
}

function renderStars(rating) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    
    return '⭐'.repeat(fullStars) + 
           (hasHalfStar ? '🌟' : '') + 
           '☆'.repeat(emptyStars);
}

function calculateTradeBadges(creature) {
    const badges = [];
    
    if (creature.stats.health >= 80 && creature.stats.melee >= 80) {
        badges.push({ icon: '👑', class: 'legendary' });
    } else if (creature.stats.health >= 70 && creature.stats.melee >= 70) {
        badges.push({ icon: '🏆', class: 'epic' });
    }
    
    if (creature.mutations >= 10) {
        badges.push({ icon: '🧬', class: 'mutated' });
    }
    
    return badges;
}

function setupTradingSearch() {
    const searchInput = document.getElementById('tradeSearch');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            filterTrades();
        });
    }
}

// Trading action functions
function switchTradeTab(tabName) {
    // Remove active class from all tabs
    document.querySelectorAll('.trade-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Add active class to clicked tab
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    // Load content for tab
    const container = document.getElementById('tradesContainer');
    if (container) {
        switch(tabName) {
            case 'marketplace':
                container.innerHTML = renderTradingMarketplace(generateMockTrades());
                break;
            case 'my-trades':
                container.innerHTML = '<div class="loading">Loading your trades...</div>';
                break;
            case 'pending':
                container.innerHTML = '<div class="loading">Loading pending trades...</div>';
                break;
            case 'completed':
                container.innerHTML = '<div class="loading">Loading trade history...</div>';
                break;
        }
    }
}

function searchTrades() {
    filterTrades();
}

function filterTrades() {
    console.log('Filtering trades...');
}

function sortTrades() {
    console.log('Sorting trades...');
}

function clearTradeFilters() {
    document.getElementById('tradeSearch').value = '';
    document.getElementById('tradeTypeFilter').value = '';
    document.getElementById('speciesWantedFilter').value = '';
    document.getElementById('tradeSortFilter').value = 'recent';
    filterTrades();
}

function createNewTrade() {
    alert('Create trade form will be implemented soon!');
}

function viewMyTrades() {
    switchTradeTab('my-trades');
}

function tradeHistory() {
    switchTradeTab('completed');
}

function openTradeDetails(tradeId) {
    alert(`Trade details for ${tradeId} will be implemented soon!`);
}

function makeOffer(tradeId) {
    alert(`Make offer for trade ${tradeId} will be implemented soon!`);
}

function addToWatchlist(tradeId) {
    alert(`Added trade ${tradeId} to watchlist!`);
}

function loadTribesPage() {
    setActiveNavButton('tribes');
    const main = document.getElementById('appMainContent');
    if (!main) return;
    
    const userTribe = getUserTribeData();
    const availableTribes = getAvailableTribes();
    
    main.innerHTML = `
        <div class="tribes-page">
            <div class="tribes-header">
                <div class="page-title">
                    <h1>🏛️ Tribes</h1>
                    <div class="tribe-status">${userTribe ? `Member of ${userTribe.name}` : 'No tribe'}</div>
                </div>
                <div class="header-actions">
                    ${userTribe ? `
                        <button class="btn btn-primary" onclick="manageTribe()">⚙️ Manage Tribe</button>
                        <button class="btn btn-secondary" onclick="tribeChat()">💬 Tribe Chat</button>
                    ` : `
                        <button class="btn btn-primary" onclick="createTribe()">➕ Create Tribe</button>
                        <button class="btn btn-secondary" onclick="searchTribes()">🔍 Find Tribes</button>
                    `}
                    <button class="btn btn-secondary" onclick="tribeAlliances()">🤝 Alliances</button>
                </div>
            </div>
            
            <div class="tribes-tabs">
                <button class="tribe-tab active" onclick="switchTribeTab('overview')" data-tab="overview">
                    🏠 ${userTribe ? 'My Tribe' : 'Overview'}
                </button>
                <button class="tribe-tab" onclick="switchTribeTab('members')" data-tab="members">
                    👥 Members (${userTribe ? userTribe.members.length : 0})
                </button>
                <button class="tribe-tab" onclick="switchTribeTab('available')" data-tab="available">
                    🌍 Available Tribes (${availableTribes.length})
                </button>
                <button class="tribe-tab" onclick="switchTribeTab('log')" data-tab="log">
                    📅 Tribe Log
                </button>
            </div>
            
            <div class="tribes-content">
                <div id="tribesContainer" class="tribes-container">
                    ${userTribe ? renderMyTribe(userTribe) : renderTribeSearch(availableTribes)}
                </div>
            </div>
        </div>
    `;
}

function loadBossPage() {
    setActiveNavButton('boss');
    const main = document.getElementById('appMainContent');
    if (!main) return;
    
    const userCreatures = window.appState?.creatures || [];
    const bossData = generateBossData();
    
    main.innerHTML = `
        <div class="boss-page">
            <div class="boss-header">
                <div class="page-title">
                    <h1>👑 Boss Planner</h1>
                    <div class="boss-count">${bossData.length} bosses available</div>
                </div>
                <div class="header-actions">
                    <button class="btn btn-primary" onclick="createBossTeam()">⚕️ Create Team</button>
                    <button class="btn btn-secondary" onclick="bossCalculator()">🧮 Calculator</button>
                    <button class="btn btn-secondary" onclick="exportBossData()">📤 Export Plans</button>
                </div>
            </div>
            
            <div class="boss-tabs">
                <button class="boss-tab active" onclick="switchBossTab('overview')" data-tab="overview">
                    📈 Overview
                </button>
                <button class="boss-tab" onclick="switchBossTab('gamma')" data-tab="gamma">
                    🏅 Gamma (Easy)
                </button>
                <button class="boss-tab" onclick="switchBossTab('beta')" data-tab="beta">
                    🏆 Beta (Medium)
                </button>
                <button class="boss-tab" onclick="switchBossTab('alpha')" data-tab="alpha">
                    👑 Alpha (Hard)
                </button>
                <button class="boss-tab" onclick="switchBossTab('teams')" data-tab="teams">
                    👥 My Teams (${getUserBossTeams().length})
                </button>
            </div>
            
            <div class="boss-controls">
                <div class="search-section">
                    <div class="search-group">
                        <input type="text" id="bossSearch" placeholder="Search bosses..." class="search-input">
                        <button class="search-btn" onclick="searchBosses()">🔍</button>
                    </div>
                </div>
                
                <div class="filter-section">
                    <select id="bossMapFilter" class="filter-select" onchange="filterBosses()">
                        <option value="">All Maps</option>
                        <option value="island">The Island</option>
                        <option value="center">The Center</option>
                        <option value="ragnarok">Ragnarok</option>
                        <option value="aberration">Aberration</option>
                        <option value="extinction">Extinction</option>
                        <option value="genesis">Genesis</option>
                    </select>
                    
                    <select id="bossDifficultyFilter" class="filter-select" onchange="filterBosses()">
                        <option value="">All Difficulties</option>
                        <option value="gamma">Gamma (Easy)</option>
                        <option value="beta">Beta (Medium)</option>
                        <option value="alpha">Alpha (Hard)</option>
                    </select>
                    
                    <select id="bossReadinessFilter" class="filter-select" onchange="filterBosses()">
                        <option value="">All Readiness</option>
                        <option value="ready">Ready to Fight</option>
                        <option value="almost">Almost Ready</option>
                        <option value="not-ready">Need Preparation</option>
                    </select>
                    
                    <button class="btn btn-sm btn-secondary" onclick="clearBossFilters()">Clear All</button>
                </div>
            </div>
            
            <div class="boss-content">
                <div id="bossContainer" class="boss-container">
                    ${renderBossOverview(bossData, userCreatures)}
                </div>
            </div>
        </div>
    `;
    
    setupBossSearch();
}

function loadArenaPage() {
    setActiveNavButton('arena');
    const main = document.getElementById('appMainContent');
    if (!main) return;
    
    const userCreatures = window.appState?.creatures || [];
    const arenaMatches = getArenaMatches();
    const leaderboard = getArenaLeaderboard();
    
    main.innerHTML = `
        <div class="arena-page">
            <div class="arena-header">
                <div class="page-title">
                    <h1>⚔️ Arena</h1>
                    <div class="arena-rank">Rank: #${getUserArenaRank()} (${getUserArenaRating()} ELO)</div>
                </div>
                <div class="header-actions">
                    <button class="btn btn-primary" onclick="quickMatch()">⚡ Quick Match</button>
                    <button class="btn btn-secondary" onclick="createCustomMatch()">🎯 Custom Match</button>
                    <button class="btn btn-secondary" onclick="arenaShop()">🏦 Arena Shop</button>
                </div>
            </div>
            
            <div class="arena-tabs">
                <button class="arena-tab active" onclick="switchArenaTab('overview')" data-tab="overview">
                    📈 Overview
                </button>
                <button class="arena-tab" onclick="switchArenaTab('matches')" data-tab="matches">
                    ⚔️ Active Matches (${arenaMatches.length})
                </button>
                <button class="arena-tab" onclick="switchArenaTab('leaderboard')" data-tab="leaderboard">
                    🏆 Leaderboard
                </button>
                <button class="arena-tab" onclick="switchArenaTab('history')" data-tab="history">
                    📅 Battle History
                </button>
                <button class="arena-tab" onclick="switchArenaTab('tournaments')" data-tab="tournaments">
                    🏅 Tournaments (2)
                </button>
            </div>
            
            <div class="arena-content">
                <div id="arenaContainer" class="arena-container">
                    ${renderArenaOverview(userCreatures, arenaMatches, leaderboard)}
                </div>
            </div>
        </div>
    `;
}

function loadFriendsPage() {
    setActiveNavButton('friends');
    const main = document.getElementById('appMainContent');
    if (!main) return;
    
    const mockFriends = generateMockFriends();
    const pendingRequests = generatePendingRequests();
    
    main.innerHTML = `
        <div class="friends-page">
            <div class="friends-header">
                <div class="page-title">
                    <h1>👥 Friends</h1>
                    <div class="friends-count">${mockFriends.length} friends · ${mockFriends.filter(f => f.online).length} online</div>
                </div>
                <div class="header-actions">
                    <button class="btn btn-primary" onclick="addFriend()">➕ Add Friend</button>
                    <button class="btn btn-secondary" onclick="findPlayers()">🔍 Find Players</button>
                    <button class="btn btn-secondary" onclick="importFriends()">📥 Import</button>
                </div>
            </div>
            
            <div class="friends-tabs">
                <button class="friends-tab active" onclick="switchFriendsTab('all')" data-tab="all">
                    👥 All Friends (${mockFriends.length})
                </button>
                <button class="friends-tab" onclick="switchFriendsTab('online')" data-tab="online">
                    🟢 Online (${mockFriends.filter(f => f.online).length})
                </button>
                <button class="friends-tab" onclick="switchFriendsTab('requests')" data-tab="requests">
                    📬 Requests (${pendingRequests.length})
                </button>
                <button class="friends-tab" onclick="switchFriendsTab('blocked')" data-tab="blocked">
                    🚫 Blocked (0)
                </button>
            </div>
            
            <div class="friends-controls">
                <div class="search-section">
                    <div class="search-group">
                        <input type="text" id="friendsSearch" placeholder="Search friends..." class="search-input">
                        <button class="search-btn" onclick="searchFriends()">🔍</button>
                    </div>
                </div>
                
                <div class="filter-section">
                    <select id="friendsStatusFilter" class="filter-select" onchange="filterFriends()">
                        <option value="">All Status</option>
                        <option value="online">Online</option>
                        <option value="away">Away</option>
                        <option value="busy">Busy</option>
                        <option value="offline">Offline</option>
                    </select>
                    
                    <select id="friendsActivityFilter" class="filter-select" onchange="filterFriends()">
                        <option value="">All Activities</option>
                        <option value="breeding">Breeding</option>
                        <option value="taming">Taming</option>
                        <option value="building">Building</option>
                        <option value="trading">Trading</option>
                        <option value="bosses">Boss Fights</option>
                    </select>
                    
                    <select id="friendsSortFilter" class="filter-select" onchange="sortFriends()">
                        <option value="name">Sort by Name</option>
                        <option value="status">Sort by Status</option>
                        <option value="activity">Recent Activity</option>
                        <option value="level">Tribe Level</option>
                    </select>
                    
                    <button class="btn btn-sm btn-secondary" onclick="clearFriendsFilters()">Clear All</button>
                </div>
            </div>
            
            <div class="friends-content">
                <div id="friendsContainer" class="friends-container">
                    ${renderFriendsList(mockFriends)}
                </div>
            </div>
        </div>
    `;
    
    setupFriendsSearch();
}

// Friends System Functions
function generateMockFriends() {
    return [
        {
            id: '1',
            name: 'DragonMaster',
            avatar: '🐲',
            status: 'online',
            activity: 'Breeding Wyverns',
            server: 'The Island - Official',
            tribeLevel: 95,
            mutualFriends: 3,
            lastSeen: 'now',
            joinDate: '2023-05-15',
            achievements: 127,
            favoriteSpecies: 'Wyvern'
        },
        {
            id: '2',
            name: 'AlphaBreeder99',
            avatar: '🦖',
            status: 'online',
            activity: 'Boss Fight - Dragon',
            server: 'Ragnarok - Unofficial',
            tribeLevel: 87,
            mutualFriends: 8,
            lastSeen: '2 minutes ago',
            joinDate: '2023-02-20',
            achievements: 203,
            favoriteSpecies: 'Rex'
        },
        {
            id: '3',
            name: 'SpinoCrafter',
            avatar: '🦕',
            status: 'away',
            activity: 'Building Base',
            server: 'Extinction - PvP',
            tribeLevel: 72,
            mutualFriends: 1,
            lastSeen: '15 minutes ago',
            joinDate: '2023-08-10',
            achievements: 89,
            favoriteSpecies: 'Spino'
        },
        {
            id: '4',
            name: 'GigaHunter',
            avatar: '🦴',
            status: 'busy',
            activity: 'Taming Giga',
            server: 'Genesis - Official',
            tribeLevel: 101,
            mutualFriends: 5,
            lastSeen: '1 hour ago',
            joinDate: '2022-12-05',
            achievements: 245,
            favoriteSpecies: 'Giga'
        },
        {
            id: '5',
            name: 'TekMaster',
            avatar: '⚡',
            status: 'offline',
            activity: 'Last seen: Trading',
            server: 'Aberration - PvE',
            tribeLevel: 89,
            mutualFriends: 2,
            lastSeen: '2 days ago',
            joinDate: '2023-01-12',
            achievements: 156,
            favoriteSpecies: 'Rock Drake'
        }
    ];
}

function generatePendingRequests() {
    return [
        {
            id: 'req1',
            name: 'NoobBreeder22',
            avatar: '🥚',
            mutualFriends: 0,
            message: 'Hey! I saw your Rex breeding guide. Would love to be friends!',
            sent: '2 hours ago',
            type: 'incoming'
        },
        {
            id: 'req2',
            name: 'WyvernQueen',
            avatar: '👑',
            mutualFriends: 3,
            message: 'Amazing crystal wyvern collection! Let\'s trade sometime.',
            sent: '1 day ago',
            type: 'incoming'
        },
        {
            id: 'req3',
            name: 'BossSlayer',
            avatar: '⚔️',
            mutualFriends: 1,
            message: '',
            sent: '3 days ago',
            type: 'outgoing'
        }
    ];
}

function renderFriendsList(friends) {
    if (friends.length === 0) {
        return `
            <div class="empty-state">
                <div class="empty-icon">👥</div>
                <h3>No friends yet!</h3>
                <p>Start building your network by adding fellow survivors.</p>
                <button class="btn btn-primary" onclick="addFriend()">➕ Add Your First Friend</button>
            </div>
        `;
    }
    
    return friends.map(friend => {
        const statusIcon = getStatusIcon(friend.status);
        const statusColor = getStatusColor(friend.status);
        
        return `
            <div class="friend-card" onclick="openFriendProfile('${friend.id}')">
                <div class="friend-avatar-section">
                    <div class="friend-avatar">
                        <span class="avatar-emoji">${friend.avatar}</span>
                        <div class="status-indicator ${friend.status}" title="${friend.status}"></div>
                    </div>
                </div>
                
                <div class="friend-info">
                    <div class="friend-header">
                        <div class="friend-name">${friend.name}</div>
                        <div class="friend-status" style="color: ${statusColor}">
                            ${statusIcon} ${friend.status}
                        </div>
                    </div>
                    
                    <div class="friend-activity">
                        <span class="activity-text">${friend.activity}</span>
                    </div>
                    
                    <div class="friend-details">
                        <div class="detail-item">
                            <span class="detail-icon">🏰</span>
                            <span class="detail-text">${friend.server}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-icon">⭐</span>
                            <span class="detail-text">Level ${friend.tribeLevel}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-icon">🤝</span>
                            <span class="detail-text">${friend.mutualFriends} mutual</span>
                        </div>
                    </div>
                    
                    <div class="friend-meta">
                        <span class="last-seen">Last seen: ${friend.lastSeen}</span>
                        <span class="favorite-species">Loves: ${friend.favoriteSpecies}</span>
                    </div>
                </div>
                
                <div class="friend-actions">
                    <button class="action-btn" onclick="event.stopPropagation(); messageFriend('${friend.id}')" title="Message">
                        💬
                    </button>
                    <button class="action-btn" onclick="event.stopPropagation(); inviteToTribe('${friend.id}')" title="Invite to Tribe">
                        🏛️
                    </button>
                    <button class="action-btn" onclick="event.stopPropagation(); viewFriendCreatures('${friend.id}')" title="View Creatures">
                        🦖
                    </button>
                    <button class="action-btn danger" onclick="event.stopPropagation(); removeFriend('${friend.id}')" title="Remove Friend">
                        ❌
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function renderFriendRequests(requests) {
    if (requests.length === 0) {
        return `
            <div class="empty-state">
                <div class="empty-icon">📭</div>
                <h3>No pending requests</h3>
                <p>All caught up with friend requests!</p>
            </div>
        `;
    }
    
    return requests.map(request => {
        return `
            <div class="request-card">
                <div class="request-avatar">
                    <span class="avatar-emoji">${request.avatar}</span>
                </div>
                
                <div class="request-info">
                    <div class="request-header">
                        <div class="request-name">${request.name}</div>
                        <div class="request-type">${request.type === 'incoming' ? '📥 Incoming' : '📤 Outgoing'}</div>
                    </div>
                    
                    <div class="request-mutual">
                        ${request.mutualFriends} mutual friends
                    </div>
                    
                    ${request.message ? `
                        <div class="request-message">
                            "${request.message}"
                        </div>
                    ` : ''}
                    
                    <div class="request-time">
                        Sent ${request.sent}
                    </div>
                </div>
                
                <div class="request-actions">
                    ${request.type === 'incoming' ? `
                        <button class="btn btn-sm btn-primary" onclick="acceptFriendRequest('${request.id}')">
                            ✅ Accept
                        </button>
                        <button class="btn btn-sm btn-secondary" onclick="declineFriendRequest('${request.id}')">
                            ❌ Decline
                        </button>
                    ` : `
                        <button class="btn btn-sm btn-secondary" onclick="cancelFriendRequest('${request.id}')">
                            🚫 Cancel
                        </button>
                    `}
                </div>
            </div>
        `;
    }).join('');
}

function getStatusIcon(status) {
    const icons = {
        online: '🟢',
        away: '🟡',
        busy: '🔴',
        offline: '⚫'
    };
    return icons[status] || '⚫';
}

function getStatusColor(status) {
    const colors = {
        online: '#4CAF50',
        away: '#FFC107',
        busy: '#F44336',
        offline: '#888'
    };
    return colors[status] || '#888';
}

function setupFriendsSearch() {
    const searchInput = document.getElementById('friendsSearch');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            filterFriends();
        });
    }
}

// Friends Action Functions
function switchFriendsTab(tabName) {
    // Remove active class from all tabs
    document.querySelectorAll('.friends-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Add active class to clicked tab
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    // Load content for tab
    const container = document.getElementById('friendsContainer');
    if (container) {
        const allFriends = generateMockFriends();
        const requests = generatePendingRequests();
        
        switch(tabName) {
            case 'all':
                container.innerHTML = renderFriendsList(allFriends);
                break;
            case 'online':
                const onlineFriends = allFriends.filter(f => f.status === 'online');
                container.innerHTML = renderFriendsList(onlineFriends);
                break;
            case 'requests':
                container.innerHTML = renderFriendRequests(requests);
                break;
            case 'blocked':
                container.innerHTML = '<div class="empty-state"><div class="empty-icon">🚫</div><h3>No blocked users</h3><p>You haven\'t blocked anyone yet.</p></div>';
                break;
        }
    }
}

function searchFriends() {
    filterFriends();
}

function filterFriends() {
    console.log('Filtering friends...');
}

function sortFriends() {
    console.log('Sorting friends...');
}

function clearFriendsFilters() {
    document.getElementById('friendsSearch').value = '';
    document.getElementById('friendsStatusFilter').value = '';
    document.getElementById('friendsActivityFilter').value = '';
    document.getElementById('friendsSortFilter').value = 'name';
    filterFriends();
}

function addFriend() {
    const friendCode = prompt('Enter friend code or username:');
    if (friendCode) {
        alert(`Friend request sent to ${friendCode}!`);
    }
}

function findPlayers() {
    alert('Player discovery will open the community browser!');
}

function importFriends() {
    alert('Import friends from Steam, Discord, or other platforms!');
}

function openFriendProfile(friendId) {
    alert(`Opening profile for friend ${friendId}`);
}

function messageFriend(friendId) {
    alert(`Opening chat with friend ${friendId}`);
}

function inviteToTribe(friendId) {
    alert(`Sending tribe invitation to friend ${friendId}`);
}

function viewFriendCreatures(friendId) {
    alert(`Viewing creature collection for friend ${friendId}`);
}

function removeFriend(friendId) {
    if (confirm('Are you sure you want to remove this friend?')) {
        alert(`Removed friend ${friendId}`);
        loadFriendsPage(); // Refresh
    }
}

function acceptFriendRequest(requestId) {
    alert(`Accepted friend request ${requestId}!`);
    loadFriendsPage(); // Refresh
}

function declineFriendRequest(requestId) {
    alert(`Declined friend request ${requestId}`);
    loadFriendsPage(); // Refresh
}

function cancelFriendRequest(requestId) {
    alert(`Cancelled friend request ${requestId}`);
    loadFriendsPage(); // Refresh
}

// Professional Navigation System
function setActiveNavButton(pageId) {
    // Remove active class from all nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Add active class to current page button
    const activeBtn = document.querySelector(`[data-page="${pageId}"]`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
}

// Load My Profile Page (Landing page after login)
async function loadMyProfilePage() {
    setActiveNavButton('profile');
    const main = document.getElementById('appMainContent');
    if (!main) return;
    
    const userEmail = localStorage.getItem('userEmail') || 'user@example.com';
    const userNickname = localStorage.getItem('userNickname') || 'Player';
    const userDiscord = localStorage.getItem('userDiscord') || 'Not set';
    const userId = localStorage.getItem('userId') || '1';
    
    // Get user stats
    const creatures = window.appState?.creatures || [];
    const totalCreatures = creatures.length;
    const speciesOwned = new Set(creatures.map(c => c.species)).size;
    const database = window.SPECIES_DATABASE || window.EXPANDED_SPECIES_DATABASE;
    const totalSpecies = database ? Object.keys(database).length : 501;
    
    // Calculate achievements (placeholder for now)
    const achievements = calculateUserAchievements(creatures);
    
    main.innerHTML = `
        <div class="profile-page">
            <div class="profile-header">
                <div class="profile-avatar">
                    <div class="avatar-icon">🦕</div>
                </div>
                <div class="profile-info">
                    <h1 class="profile-name">${userNickname}</h1>
                    <div class="profile-title">Dino Nuggie Trainer</div>
                    <div class="profile-stats-quick">
                        <div class="quick-stat">
                            <span class="stat-value">${totalCreatures}</span>
                            <span class="stat-label">Creatures</span>
                        </div>
                        <div class="quick-stat">
                            <span class="stat-value">${speciesOwned}/${totalSpecies}</span>
                            <span class="stat-label">Species</span>
                        </div>
                        <div class="quick-stat">
                            <span class="stat-value">${achievements.total}</span>
                            <span class="stat-label">Achievements</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="profile-content">
                <div class="profile-grid">
                    <!-- User Information Card -->
                    <div class="profile-card">
                        <div class="card-header">
                            <h3>👤 Account Information</h3>
                            <button class="btn btn-sm btn-secondary" onclick="editAccountInfo()">Edit</button>
                        </div>
                        <div class="info-list">
                            <div class="info-item">
                                <span class="info-label">Email:</span>
                                <span class="info-value">${userEmail}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Nickname:</span>
                                <span class="info-value">${userNickname}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Discord:</span>
                                <span class="info-value">${userDiscord}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Member Since:</span>
                                <span class="info-value">October 2025</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Achievements Card -->
                    <div class="profile-card">
                        <div class="card-header">
                            <h3>� Recent Achievements</h3>
                            <button class="btn btn-sm btn-secondary" onclick="viewAllAchievements()">View All</button>
                        </div>
                        <div class="achievement-list">
                            ${renderRecentAchievements(achievements)}
                        </div>
                    </div>
                    
                    <!-- Friends Card -->
                    <div class="profile-card">
                        <div class="card-header">
                            <h3>👥 Friends</h3>
                            <button class="btn btn-sm btn-secondary" onclick="loadFriendsPage()">Manage</button>
                        </div>
                        <div class="friends-preview">
                            <div class="friend-count">5 friends online</div>
                            <div class="friend-avatars">
                                <!-- Will load dynamically -->
                                <div class="loading-text">Loading friends...</div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Active Trades Card -->
                    <div class="profile-card">
                        <div class="card-header">
                            <h3>🔁 Active Trades</h3>
                            <button class="btn btn-sm btn-secondary" onclick="loadTradingPage()">View All</button>
                        </div>
                        <div class="trades-preview">
                            <div class="trade-item">
                                <span class="trade-status pending">Pending</span>
                                <span class="trade-desc">Rex for 1000 Metal</span>
                            </div>
                            <div class="trade-item">
                                <span class="trade-status incoming">Incoming</span>
                                <span class="trade-desc">Spino trade offer</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Quick Stats Card -->
                    <div class="profile-card">
                        <div class="card-header">
                            <h3>📊 Statistics</h3>
                        </div>
                        <div class="stats-grid-profile">
                            <div class="stat-item">
                                <div class="stat-icon">🦖</div>
                                <div class="stat-details">
                                    <span class="stat-number">${totalCreatures}</span>
                                    <span class="stat-text">Total Creatures</span>
                                </div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-icon">🏆</div>
                                <div class="stat-details">
                                    <span class="stat-number">${achievements.badges}</span>
                                    <span class="stat-text">Badges Earned</span>
                                </div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-icon">👑</div>
                                <div class="stat-details">
                                    <span class="stat-number">${achievements.bosses}</span>
                                    <span class="stat-text">Boss Ready</span>
                                </div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-icon">🔄</div>
                                <div class="stat-details">
                                    <span class="stat-number">12</span>
                                    <span class="stat-text">Trades Completed</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Account Settings Card -->
                    <div class="profile-card">
                        <div class="card-header">
                            <h3>⚙️ Account Settings</h3>
                        </div>
                        <div class="settings-list">
                            <button class="setting-item" onclick="changePassword()">
                                <span>🔒 Change Password</span>
                                <span class="setting-arrow">→</span>
                            </button>
                            <button class="setting-item" onclick="notificationSettings()">
                                <span>🔔 Notification Settings</span>
                                <span class="setting-arrow">→</span>
                            </button>
                            <button class="setting-item" onclick="privacySettings()">
                                <span>🛡️ Privacy Settings</span>
                                <span class="setting-arrow">→</span>
                            </button>
                            <button class="setting-item danger" onclick="deleteAccount()">
                                <span>🗑️ Delete Account</span>
                                <span class="setting-arrow">→</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Load dynamic content
    loadFriendsPreview();
    loadTradesPreview();
}

// Calculate user achievements
function calculateUserAchievements(creatures) {
    let badges = 0;
    let bosses = 0;
    
    creatures.forEach(creature => {
        // Check for badge-worthy stats (placeholder logic)
        if (creature.health >= 45 && creature.stamina >= 45 && creature.food >= 45 && 
            creature.weight >= 45 && creature.melee >= 45) {
            badges++;
        }
        
        // Check for boss readiness
        if (creature.health >= 75 && creature.melee >= 75) {
            bosses++;
        }
    });
    
    return {
        total: badges + bosses,
        badges: badges,
        bosses: bosses
    };
}

// Render recent achievements
function renderRecentAchievements(achievements) {
    if (achievements.total === 0) {
        return '<div class="no-achievements">No achievements yet. Start breeding creatures to earn badges!</div>';
    }
    
    return `
        <div class="achievement-item">
            <div class="achievement-icon">🥉</div>
            <div class="achievement-details">
                <span class="achievement-name">Bronze Bloodline</span>
                <span class="achievement-desc">Bred a creature with solid genetics</span>
            </div>
            <span class="achievement-time">2 hours ago</span>
        </div>
        <div class="achievement-item">
            <div class="achievement-icon">👑</div>
            <div class="achievement-details">
                <span class="achievement-name">Boss Ready</span>
                <span class="achievement-desc">Trained a Gamma-ready creature</span>
            </div>
            <span class="achievement-time">1 day ago</span>
        </div>
    `;
}

// Placeholder functions for profile actions
function editAccountInfo() {
    alert('Account editing will be implemented soon!');
}

function viewAllAchievements() {
    alert('Achievement gallery will be implemented soon!');
}

function loadFriendsPreview() {
    // Will load actual friends list preview
    console.log('Loading friends preview...');
}

function loadTradesPreview() {
    // Will load actual trades preview  
    console.log('Loading trades preview...');
}

function changePassword() {
    alert('Password change will be implemented soon!');
}

function notificationSettings() {
    alert('Notification settings will be implemented soon!');
}

function privacySettings() {
    alert('Privacy settings will be implemented soon!');
}

function deleteAccount() {
    if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
        alert('Account deletion will be implemented soon!');
    }
}

// Creature Management Functions
function generateSpeciesFilterOptions() {
    const creatures = window.appState?.creatures || [];
    const species = [...new Set(creatures.map(c => c.species))].sort();
    return species.map(s => `<option value="${s}">${s}</option>`).join('');
}

function renderCreaturesGrid(creatures) {
    if (creatures.length === 0) {
        return `
            <div class="empty-state">
                <div class="empty-icon">🦕</div>
                <h3>No creatures yet!</h3>
                <p>Add your first creature to start building your collection.</p>
                <button class="btn btn-primary" onclick="addNewCreature()">➕ Add First Creature</button>
            </div>
        `;
    }
    
    return creatures.map(creature => {
        const badges = calculateCreatureBadges(creature);
        const database = window.SPECIES_DATABASE || window.EXPANDED_SPECIES_DATABASE;
        const speciesData = database && database[creature.species] ? database[creature.species] : null;
        
        return `
            <div class="creature-card" onclick="openCreatureDetails('${creature.id}')">
                <div class="creature-header">
                    <div class="creature-name">${creature.name || 'Unnamed'}</div>
                    <div class="creature-level">Lvl ${creature.level || 1}</div>
                </div>
                
                <div class="creature-species">
                    <span class="species-name">${creature.species}</span>
                    <span class="gender-icon">${creature.gender === 'male' ? '♂️' : '♀️'}</span>
                </div>
                
                <div class="creature-stats">
                    <div class="stat-bar">
                        <span class="stat-label">HP</span>
                        <div class="stat-progress">
                            <div class="stat-fill" style="width: ${Math.min(100, (creature.health || 0) * 2)}%"></div>
                        </div>
                        <span class="stat-value">${creature.health || 0}</span>
                    </div>
                    <div class="stat-bar">
                        <span class="stat-label">Melee</span>
                        <div class="stat-progress">
                            <div class="stat-fill" style="width: ${Math.min(100, (creature.melee || 0) * 2)}%"></div>
                        </div>
                        <span class="stat-value">${creature.melee || 0}</span>
                    </div>
                </div>
                
                <div class="creature-badges">
                    ${badges.map(badge => `<div class="badge ${badge.class}">${badge.icon} ${badge.name}</div>`).join('')}
                </div>
                
                <div class="creature-actions">
                    <button class="action-btn" onclick="event.stopPropagation(); editCreature('${creature.id}')" title="Edit">
                        ✏️
                    </button>
                    <button class="action-btn" onclick="event.stopPropagation(); duplicateCreature('${creature.id}')" title="Duplicate">
                        📋
                    </button>
                    <button class="action-btn danger" onclick="event.stopPropagation(); deleteCreature('${creature.id}')" title="Delete">
                        🗑️
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function calculateCreatureBadges(creature) {
    const badges = [];
    
    // Prized Bloodline (all stats 45+)
    if (creature.health >= 45 && creature.stamina >= 45 && creature.food >= 45 && 
        creature.weight >= 45 && creature.melee >= 45) {
        badges.push({ name: 'Prized', icon: '🏆', class: 'prized' });
    }
    
    // Boss Ready (health and melee 75+)
    if (creature.health >= 75 && creature.melee >= 75) {
        badges.push({ name: 'Boss Ready', icon: '👑', class: 'boss-ready' });
    }
    
    // Boss Underdog (health and melee 50-74)
    if (creature.health >= 50 && creature.health < 75 && creature.melee >= 50 && creature.melee < 75) {
        badges.push({ name: 'Underdog', icon: '🥊', class: 'boss-underdog' });
    }
    
    return badges;
}

function setupCreatureSearch() {
    const searchInput = document.getElementById('creatureSearch');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            filterCreatures();
        });
    }
}

function searchCreatures() {
    filterCreatures();
}

function filterCreatures() {
    const searchTerm = document.getElementById('creatureSearch')?.value.toLowerCase() || '';
    const speciesFilter = document.getElementById('speciesFilter')?.value || '';
    const genderFilter = document.getElementById('genderFilter')?.value || '';
    const badgeFilter = document.getElementById('badgeFilter')?.value || '';
    
    let creatures = window.appState?.creatures || [];
    
    // Apply filters
    if (searchTerm) {
        creatures = creatures.filter(c => 
            (c.name || '').toLowerCase().includes(searchTerm) ||
            (c.species || '').toLowerCase().includes(searchTerm)
        );
    }
    
    if (speciesFilter) {
        creatures = creatures.filter(c => c.species === speciesFilter);
    }
    
    if (genderFilter) {
        creatures = creatures.filter(c => c.gender === genderFilter);
    }
    
    if (badgeFilter) {
        creatures = creatures.filter(c => {
            const badges = calculateCreatureBadges(c);
            return badges.some(badge => {
                if (badgeFilter === 'prized') return badge.class === 'prized';
                if (badgeFilter === 'boss-ready') return badge.class === 'boss-ready';
                if (badgeFilter === 'boss-underdog') return badge.class === 'boss-underdog';
                return false;
            });
        });
    }
    
    // Update grid
    const grid = document.getElementById('creaturesGrid');
    if (grid) {
        grid.innerHTML = renderCreaturesGrid(creatures);
    }
}

function sortCreatures() {
    const sortBy = document.getElementById('sortFilter')?.value || 'name';
    let creatures = [...(window.appState?.creatures || [])];
    
    creatures.sort((a, b) => {
        switch(sortBy) {
            case 'name':
                return (a.name || '').localeCompare(b.name || '');
            case 'species':
                return (a.species || '').localeCompare(b.species || '');
            case 'level':
                return (b.level || 0) - (a.level || 0);
            case 'health':
                return (b.health || 0) - (a.health || 0);
            case 'melee':
                return (b.melee || 0) - (a.melee || 0);
            case 'recent':
                return new Date(b.created || 0) - new Date(a.created || 0);
            default:
                return 0;
        }
    });
    
    // Update grid
    const grid = document.getElementById('creaturesGrid');
    if (grid) {
        grid.innerHTML = renderCreaturesGrid(creatures);
    }
}

function clearFilters() {
    document.getElementById('creatureSearch').value = '';
    document.getElementById('speciesFilter').value = '';
    document.getElementById('genderFilter').value = '';
    document.getElementById('badgeFilter').value = '';
    document.getElementById('sortFilter').value = 'name';
    
    // Reset to all creatures
    const grid = document.getElementById('creaturesGrid');
    if (grid) {
        grid.innerHTML = renderCreaturesGrid(window.appState?.creatures || []);
    }
}

// Creature Action Functions
function addNewCreature() {
    alert('Add creature form will be implemented soon!');
}

function exportCreatures() {
    const creatures = window.appState?.creatures || [];
    const dataStr = JSON.stringify(creatures, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = 'my-creatures.json';
    link.click();
}

function importCreatures() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const creatures = JSON.parse(e.target.result);
                    if (Array.isArray(creatures)) {
                        // Merge with existing creatures
                        window.appState.creatures = [...(window.appState.creatures || []), ...creatures];
                        loadMyNuggiesPage(); // Refresh page
                        alert(`Imported ${creatures.length} creatures!`);
                    } else {
                        alert('Invalid file format');
                    }
                } catch (err) {
                    alert('Error reading file: ' + err.message);
                }
            };
            reader.readAsText(file);
        }
    };
    input.click();
}

function openCreatureDetails(creatureId) {
    alert(`Creature details for ${creatureId} will be implemented soon!`);
}

function editCreature(creatureId) {
    alert(`Edit creature ${creatureId} will be implemented soon!`);
}

function duplicateCreature(creatureId) {
    const creature = window.appState?.creatures?.find(c => c.id === creatureId);
    if (creature) {
        const newCreature = {
            ...creature,
            id: Date.now().toString(),
            name: (creature.name || 'Unnamed') + ' Copy',
            created: new Date().toISOString()
        };
        window.appState.creatures.push(newCreature);
        loadMyNuggiesPage(); // Refresh page
    }
}

function deleteCreature(creatureId) {
    if (confirm('Are you sure you want to delete this creature?')) {
        window.appState.creatures = window.appState.creatures.filter(c => c.id !== creatureId);
        loadMyNuggiesPage(); // Refresh page
    }
}

// Make functions globally available
window.loadMyProfilePage = loadMyProfilePage;
window.setActiveNavButton = setActiveNavButton;
window.setupNavigationListeners = setupNavigationListeners;
window.loadMyNuggiesPage = loadMyNuggiesPage;
window.loadTradingPage = loadTradingPage;
window.loadTribesPage = loadTribesPage;
window.loadBossPage = loadBossPage;
window.loadArenaPage = loadArenaPage;
window.loadFriendsPage = loadFriendsPage;
window.toggleNotifications = toggleNotifications;
window.addNewCreature = addNewCreature;
window.exportCreatures = exportCreatures;
window.importCreatures = importCreatures;
window.searchCreatures = searchCreatures;
window.filterCreatures = filterCreatures;
window.sortCreatures = sortCreatures;
window.clearFilters = clearFilters;
window.openCreatureDetails = openCreatureDetails;
window.editCreature = editCreature;
window.duplicateCreature = duplicateCreature;
window.deleteCreature = deleteCreature;
window.switchTradeTab = switchTradeTab;
window.searchTrades = searchTrades;
window.filterTrades = filterTrades;
window.sortTrades = sortTrades;
window.clearTradeFilters = clearTradeFilters;
window.createNewTrade = createNewTrade;
window.viewMyTrades = viewMyTrades;
window.tradeHistory = tradeHistory;
window.openTradeDetails = openTradeDetails;
window.makeOffer = makeOffer;
window.addToWatchlist = addToWatchlist;
window.switchFriendsTab = switchFriendsTab;
window.searchFriends = searchFriends;
window.filterFriends = filterFriends;
window.sortFriends = sortFriends;
window.clearFriendsFilters = clearFriendsFilters;
window.addFriend = addFriend;
window.findPlayers = findPlayers;
window.importFriends = importFriends;
window.openFriendProfile = openFriendProfile;
window.messageFriend = messageFriend;
window.inviteToTribe = inviteToTribe;
window.viewFriendCreatures = viewFriendCreatures;
window.removeFriend = removeFriend;
window.acceptFriendRequest = acceptFriendRequest;
window.declineFriendRequest = declineFriendRequest;
window.cancelFriendRequest = cancelFriendRequest;

// Load trading page (placeholder)
function loadTradingPage() {
    const main = document.getElementById('appMainContent');
    if (!main) return;
    main.innerHTML = `
        <div class="main-content">
            <h1>🔁 Trading</h1>
            <p>Trading functionality coming soon!</p>
        </div>
    `;
}
// Boss Planner Implementation
async function loadBossPlanner() {
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
    const bosses = await getBossData();

    // Initialize event handlers
    document.getElementById('bossSearch')?.addEventListener('input', debounce(() => renderBossGrid(bosses), 200));
    document.getElementById('bossMapFilter')?.addEventListener('change', () => renderBossGrid(bosses));
    document.getElementById('addBossBtn')?.addEventListener('click', () => openBossModal());

    // Initial render
    renderBossGrid(bosses);
}

function renderBossGrid(bosses) {
    const bossGrid = document.getElementById('bossGrid');
    if (!bossGrid) return;

    const searchTerm = document.getElementById('bossSearch')?.value.toLowerCase() || '';
    const mapFilter = document.getElementById('bossMapFilter')?.value || '';
    
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
            if (boss) openBossModal(boss);
        });
    });

    document.querySelectorAll('.delete-boss').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const bossId = e.target.dataset.bossId;
            if (confirm('Are you sure you want to delete this boss?')) {
                const newData = bosses.filter(b => b.id !== bossId);
                saveBossData(newData);
                renderBossGrid(newData);
            }
        });
    });
}

function openBossModal(boss = null) {
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

        const bosses = window.currentBosses || [];
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
        renderBossGrid(bosses);
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
			// Load My Profile page as landing page
			loadMyProfilePage();
			// Sync server-stored creatures and planner/arena data for this user
			try { await loadServerCreatures(); } catch (e) { console.warn('loadServerCreatures after login failed', e); }
			try { await loadServerBossData(); } catch (e) { console.warn('loadServerBossData after login failed', e); }
			try { await loadServerArenaCollections(); } catch (e) { console.warn('loadServerArenaCollections after login failed', e); }
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

// Placeholder functions for boss data and arena collections
async function loadServerBossData() {
    // Placeholder - boss data loading will be implemented later
    console.log('loadServerBossData called (placeholder)');
}

async function loadServerArenaCollections() {
    // Placeholder - arena collections loading will be implemented later  
    console.log('loadServerArenaCollections called (placeholder)');
}

function updateAuthUI() {
    // Placeholder - auth UI update will be implemented later
    console.log('updateAuthUI called (placeholder)');
}

window.loadServerBossData = loadServerBossData;
window.loadServerArenaCollections = loadServerArenaCollections;
window.updateAuthUI = updateAuthUI;

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

// Boss detail and arena functions
function showBossDetail(bossId) {
    const bosses = getBossData();
    const boss = bosses.find(b => b.id === bossId);
    if (!boss) {
        console.error(`Boss with ID ${bossId} not found.`);
        return;
    }

    const detailModal = document.createElement('div');
    detailModal.className = 'modal';
    detailModal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>${boss.name} Details</h2>
                <button type="button" class="close" id="closeDetailModal">&times;</button>
            </div>
            <div class="modal-body">
                <p><strong>Map:</strong> ${boss.map}</p>
                <p><strong>Difficulty:</strong> ${boss.difficulty}</p>
                <p><strong>Level:</strong> ${boss.level}</p>
                <p><strong>Party Size:</strong> ${boss.partySize}</p>
                <p><strong>Notes:</strong> ${boss.notes}</p>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" id="closeDetailBtn">Close</button>
            </div>
        </div>
    `;
    document.body.appendChild(detailModal);

    setTimeout(() => detailModal.classList.add('show'), 10);

    document.getElementById('closeDetailModal')?.addEventListener('click', () => {
        detailModal.classList.remove('show');
        setTimeout(() => detailModal.remove(), 200);
    });
    document.getElementById('closeDetailBtn')?.addEventListener('click', () => {
        detailModal.classList.remove('show');
        setTimeout(() => detailModal.remove(), 200);
    });
}

function renderBossList() {
    const bosses = getBossData();
    const bossListContainer = document.getElementById('bossListContainer');
    if (!bossListContainer) {
        console.error('Boss list container not found.');
        return;
    }

    bossListContainer.innerHTML = bosses.map(boss => `
        <div class="boss-item">
            <h3>${boss.name}</h3>
            <p><strong>Map:</strong> ${boss.map}</p>
            <p><strong>Difficulty:</strong> ${boss.difficulty}</p>
            <button class="btn btn-primary" onclick="showBossDetail('${boss.id}')">View Details</button>
        </div>
    `).join('');
}

function openArenaPage(arenaId) {
    console.log(`Opening arena page for arena ID: ${arenaId}`);
    // Placeholder for arena page logic
    alert(`Arena page for ${arenaId} is under construction.`);
}

function renderArenaGrid() {
    console.log('Rendering arena grid...');
    // Placeholder for arena grid rendering logic
    alert('Arena grid rendering is under construction.');
}

async function getBossData() {
    try {
        const response = await fetch('/api/bosses', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });

        if (response.ok) {
            return await response.json();
        } else {
            console.error('Failed to fetch bosses from backend');
            return [];
        }
    } catch (e) {
        console.error('Error fetching boss data:', e);
        return [];
    }
}

async function saveBossData(bosses) {
    try {
        // Assuming we save all bosses, or handle individually. For simplicity, replace all.
        const response = await fetch('/api/bosses', {
            method: 'PUT', // Or POST if replacing
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(bosses)
        });

        if (!response.ok) {
            console.error('Failed to save bosses');
        } else {
            window.currentBosses = bosses;
        }
    } catch (e) {
        console.error('Error saving bosses:', e);
    }
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    await initializeApp();
    
    // Set up navigation listeners  
    setupNavigationListeners();
    
    // Set up initial event listeners
    const loginForm = document.getElementById('loginForm');
    const showRegisterLink = document.getElementById('showRegisterLink');
    
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail')?.value;
            const password = document.getElementById('loginPassword')?.value;
            const errorDiv = document.getElementById('loginError');
            
            if (!email || !password) {
                if (errorDiv) errorDiv.textContent = 'Please enter email and password';
                return;
            }
            
            try {
                const res = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                
                // Check if response is ok first
                if (!res.ok) {
                    // Try to get error message from response
                    let errorMessage = 'Login failed';
                    try {
                        const errorData = await res.json();
                        errorMessage = errorData.error || errorMessage;
                    } catch (e) {
                        // If JSON parsing fails, use status text
                        errorMessage = res.statusText || errorMessage;
                    }
                    console.log('Login failed with status:', res.status, errorMessage);
                    if (errorDiv) errorDiv.textContent = errorMessage;
                    return;
                }
                
                // Parse response JSON
                let data;
                try {
                    data = await res.json();
                } catch (e) {
                    console.error('Failed to parse login response JSON:', e);
                    if (errorDiv) errorDiv.textContent = 'Server response error. Please try again.';
                    return;
                }
                
                console.log('Login response:', res.status, data);
                
                if (data.success || data.token) {
                    console.log('Login successful, showing main app');
                    // Store credentials and show main app
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('userId', data.userId);
                    if (data.email) localStorage.setItem('userEmail', data.email);
                    if (data.nickname) localStorage.setItem('userNickname', data.nickname);
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
                    console.log('Login failed:', data.error);
                    if (errorDiv) errorDiv.textContent = data.error || 'Login failed';
                }
            } catch (err) {
                console.error('Login error:', err);
                if (errorDiv) errorDiv.textContent = 'Login failed. Please try again.';
            }
        });
    }
    
    if (showRegisterLink) {
        showRegisterLink.addEventListener('click', (e) => {
            e.preventDefault();
            renderRegisterForm();
            showRegisterPage();
        });
    }
    
    // Set up other initial event listeners
    const authBtn = document.getElementById('authBtn');
    if (authBtn) {
        authBtn.addEventListener('click', handleAuthClick);
    }
    
    // Header button listeners
    const goToMyProfileBtn = document.getElementById('goToMyProfileBtn');
    if (goToMyProfileBtn) {
        goToMyProfileBtn.addEventListener('click', goToMyNuggies);
    }
    
    const goToFriendsBtn = document.getElementById('goToFriendsBtn');
    if (goToFriendsBtn) {
        goToFriendsBtn.addEventListener('click', () => loadFriendsPage());
    }
    
    const goToCreaturesBtn = document.getElementById('goToCreaturesBtn');
    if (goToCreaturesBtn) {
        goToCreaturesBtn.addEventListener('click', () => loadSpeciesPage());
    }
    
    const goToMyNuggiesBtn = document.getElementById('goToMyNuggiesBtn');
    if (goToMyNuggiesBtn) {
        goToMyNuggiesBtn.addEventListener('click', goToMyNuggies);
    }
    
    const goToTradingBtn = document.getElementById('goToTradingBtn');
    if (goToTradingBtn) {
        goToTradingBtn.addEventListener('click', goToTrading);
    }
    
    const goToBossPlannerBtn = document.getElementById('goToBossPlannerBtn');
    if (goToBossPlannerBtn) {
        goToBossPlannerBtn.addEventListener('click', () => loadBossPlanner());
    }
    
    const openTribeManagerBtn = document.getElementById('openTribeManagerBtn');
    if (openTribeManagerBtn) {
        openTribeManagerBtn.addEventListener('click', () => loadFriendsPage());
    }
});

// === NOTIFICATION SYSTEM ===
function toggleNotifications() {
    console.log('[Navigation] Toggling notifications...');
    
    // Check if notification panel exists
    let notificationPanel = document.getElementById('notificationPanel');
    
    if (notificationPanel) {
        // Toggle visibility
        notificationPanel.style.display = notificationPanel.style.display === 'none' ? 'block' : 'none';
    } else {
        // Create notification panel
        createNotificationPanel();
    }
}

function createNotificationPanel() {
    const notifications = getNotifications();
    
    const panel = document.createElement('div');
    panel.id = 'notificationPanel';
    panel.className = 'notification-panel';
    panel.innerHTML = `
        <div class="notification-header">
            <h3>🔔 Notifications</h3>
            <div class="notification-actions">
                <button class="btn btn-sm" onclick="markAllAsRead()">✓ Mark All Read</button>
                <button class="btn btn-sm" onclick="closeNotifications()">✖ Close</button>
            </div>
        </div>
        <div class="notification-content">
            ${notifications.length > 0 ? notifications.map(notification => `
                <div class="notification-item ${notification.read ? 'read' : 'unread'}" onclick="markAsRead('${notification.id}')">
                    <div class="notification-icon">${notification.icon}</div>
                    <div class="notification-details">
                        <div class="notification-title">${notification.title}</div>
                        <div class="notification-message">${notification.message}</div>
                        <div class="notification-time">${notification.time}</div>
                    </div>
                    ${!notification.read ? '<div class="unread-indicator"></div>' : ''}
                </div>
            `).join('') : '<div class="no-notifications">No notifications yet!</div>'}
        </div>
    `;
    
    document.body.appendChild(panel);
    updateNotificationBadge();
}

function getNotifications() {
    return [
        {
            id: '1',
            icon: '🏆',
            title: 'Achievement Unlocked!',
            message: 'You earned the "Prized Bloodline" badge for breeding a perfect creature.',
            time: '2 minutes ago',
            read: false
        },
        {
            id: '2',
            icon: '👥',
            title: 'Friend Request',
            message: 'NoobBreeder22 wants to be your friend.',
            time: '5 minutes ago',
            read: false
        },
        {
            id: '3',
            icon: '🔄',
            title: 'Trade Offer',
            message: 'New trade offer for your Rex "Thunder King".',
            time: '1 hour ago',
            read: true
        },
        {
            id: '4',
            icon: '🏛️',
            title: 'Tribe Update',
            message: 'Your tribe completed the Dragon boss fight!',
            time: '3 hours ago',
            read: true
        },
        {
            id: '5',
            icon: '⚔️',
            title: 'Arena Victory!',
            message: 'Your Spino "Blade Runner" won a ranked match and gained 25 rating points.',
            time: '2 hours ago',
            read: false
        }
    ];
}

function markAsRead(notificationId) {
    console.log(`Marking notification ${notificationId} as read`);
    // Update notification badge count
    updateNotificationBadge();
    
    // Re-render the panel to update read status
    const panel = document.getElementById('notificationPanel');
    if (panel) {
        panel.remove();
        createNotificationPanel();
    }
}

function markAllAsRead() {
    console.log('Marking all notifications as read');
    updateNotificationBadge();
    closeNotifications();
}

function closeNotifications() {
    const panel = document.getElementById('notificationPanel');
    if (panel) {
        panel.remove();
    }
}

function updateNotificationBadge() {
    const unreadCount = getNotifications().filter(n => !n.read).length;
    const badge = document.querySelector('.notification-badge');
    if (badge) {
        if (unreadCount > 0) {
            badge.textContent = unreadCount;
            badge.style.display = 'block';
        } else {
            badge.style.display = 'none';
        }
    }
}

// Export notification functions
window.markAsRead = markAsRead;
window.markAllAsRead = markAllAsRead;
window.closeNotifications = closeNotifications;
window.updateNotificationBadge = updateNotificationBadge;

// Initialize notification badge on page load
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(updateNotificationBadge, 100);
});
