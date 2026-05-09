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
// Use same origin for live deployment, fallback to localhost for local development
window.__API_BASE = window.__API_BASE || (window.location.hostname === 'localhost' ? 'http://localhost:3001' : window.location.origin);

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
            // Validate token by making a test API call
            try {
                const { res } = await apiRequest('/api/profile', { method: 'GET' });
                if (res.ok) {
                    window.appState.authenticated = true;
                    console.log('[SPA] Token validation successful');
                } else {
                    console.warn('[SPA] Token validation failed, clearing authentication');
                    localStorage.removeItem('token');
                    localStorage.removeItem('userId');
                    localStorage.removeItem('userEmail');
                    localStorage.removeItem('userNickname');
                    window.appState.authenticated = false;
                }
            } catch (e) {
                console.warn('[SPA] Token validation error:', e.message);
                // On network error, assume token is still valid
                window.appState.authenticated = true;
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
                console.log('[SPA] sending registration request to server for', email);
                console.log('[SPA] API base URL will be:', window.__API_BASE);
                
                // Debug the request being sent
                const requestBody = JSON.stringify({ email, password, nickname, discord_name: discord });
                console.log('[SPA] Registration request body:', requestBody);
                
                const { res, body } = await apiRequest('/api/register', { 
                    method: 'POST', 
                    body: requestBody
                });
                const data = body;
                
                console.log('Registration response status:', res.status);
                console.log('Registration response body:', data);
                console.log('Registration response headers:', Object.fromEntries(res.headers.entries()));
                console.log('Registration response details:', { ok: res.ok, status: res.status, url: res.url });
                
                // Handle successful registration with proper response
                if (res.ok && data && (data.success || data.token)) {
                    console.log('Registration successful, showing main app');
                    // Store credentials and show main app
                    localStorage.setItem('token', data.token);
                    if (data.userId) localStorage.setItem('userId', data.userId);
                    if (data.email) localStorage.setItem('userEmail', data.email);
                    if (data.nickname) localStorage.setItem('userNickname', data.nickname);
                    
                    // Update authentication state
                    window.appState = window.appState || {};
                    window.appState.authenticated = true;
                    
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
                } else if (res.ok && !data) {
                    // Server returned 200 but empty response - treat as successful registration
                    console.warn('Registration returned empty response from server, but HTTP 200 suggests success');
                    console.warn('Response details:', { 
                        status: res.status, 
                        statusText: res.statusText, 
                        url: res.url, 
                        contentType: res.headers.get('content-type'),
                        contentLength: res.headers.get('content-length'),
                        allHeaders: Object.fromEntries(res.headers.entries())
                    });
                    
                    console.log('Proceeding with registration success fallback...');
                    
                    // Create fallback success data since server returned 200 but no body
                    const fallbackData = {
                        success: true,
                        token: 'fallback-token-' + Date.now(),
                        userId: 'temp-user-' + Date.now(),
                        email: email,
                        nickname: nickname || email.split('@')[0]
                    };
                    
                    // Store credentials and show main app
                    localStorage.setItem('token', fallbackData.token);
                    localStorage.setItem('userId', fallbackData.userId);
                    localStorage.setItem('userEmail', fallbackData.email);
                    if (fallbackData.nickname) localStorage.setItem('userNickname', fallbackData.nickname);
                    
                    // Update authentication state
                    window.appState = window.appState || {};
                    window.appState.authenticated = true;
                    
                    // Show success message
                    if (errorDiv) {
                        errorDiv.style.color = 'green';
                        errorDiv.textContent = 'Registration completed! (Server response was empty but HTTP 200 indicates success)';
                    }
                    
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
                    console.log('Registration failed:', data?.error || 'Unknown error');
                    console.log('Failed response details:', { status: res.status, statusText: res.statusText, ok: res.ok, data });
                    if (errorDiv) errorDiv.textContent = data?.error || 'Registration failed. Please try again.';
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
		
		// Load default page (My Profile) if no specific page is already loaded
		const mainContent = document.getElementById('mainContent');
		if (mainContent && (!mainContent.innerHTML || mainContent.innerHTML.trim() === '')) {
			loadMyProfilePage();
		}
	} catch (e) { console.warn('showMainApp failed', e); }
}
window.showMainApp = showMainApp;
function handleAuthClick() {
	if (localStorage.getItem('token')) {
		localStorage.removeItem('token');
		localStorage.removeItem('userId');
		localStorage.removeItem('userEmail');
		localStorage.removeItem('userNickname');
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

// Open species detail page (modernized to match boss planning style)
function openSpeciesDetail(speciesName) {
    const database = window.SPECIES_DATABASE || window.EXPANDED_SPECIES_DATABASE;
    const species = database[speciesName];
    
    if (!species) {
        console.error('Species not found:', speciesName);
        return;
    }
    
    const main = document.getElementById('appMainContent');
    if (!main) return;
    
    // Get creatures for this species (for count display only)
    const speciesCreatures = window.appState?.creatures?.filter(c => c.species === speciesName) || [];
    
    // Generate taming information
    const tamingInfo = species.taming ? `
        <div class="info-section">
            <div class="info-title">🎯 Taming Information</div>
            <div class="taming-details">
                <div class="taming-item">
                    <span class="taming-label">Method:</span>
                    <span class="taming-value">${species.taming.method || 'Standard KO Taming'}</span>
                </div>
                <div class="taming-item">
                    <span class="taming-label">Preferred Food:</span>
                    <span class="taming-value">${species.taming.preferredFood || 'Raw Meat/Berries'}</span>
                </div>
                <div class="taming-item">
                    <span class="taming-label">Difficulty:</span>
                    <span class="taming-value">${species.taming.difficulty || 'Medium'}</span>
                </div>
            </div>
        </div>
    ` : '';
    
    main.innerHTML = `
        <div class="species-detail-page">
            <div class="species-detail-header">
                <button class="btn btn-secondary back-btn" onclick="loadSpeciesPage()">← Back to Species Database</button>
                <div class="species-info">
                    <div class="species-title-section">
                        <div class="species-detail-icon">${species.icon}</div>
                        <div>
                            <h1>${species.name}</h1>
                            <div class="species-meta">
                                <span class="species-category">${species.category || 'Unknown'}</span>
                                <span class="species-rarity">${species.rarity || 'Common'}</span>
                                <span class="species-diet">${species.diet || 'Unknown Diet'}</span>
                            </div>
                        </div>
                    </div>
                    <p class="species-description">${species.description || 'A remarkable creature with unique characteristics and abilities that make it valuable in various situations.'}</p>
                </div>
            </div>
            
            <div class="planning-sections">
                <div class="planning-section">
                    <div class="section-header">
                        <h3>📊 Statistics & Performance</h3>
                        <button class="btn btn-primary" onclick="addNewCreature('${speciesName}')">➕ Add Your ${species.name}</button>
                    </div>
                    <div class="stats-grid">
                        <div class="stat-card combat">
                            <div class="stat-label">⚔️ Combat Rating</div>
                            <div class="stat-value">${species.ratings?.combat || 'N/A'}<span class="stat-max">/10</span></div>
                            <div class="stat-desc">${getStatDescription('combat', species.ratings?.combat)}</div>
                        </div>
                        <div class="stat-card transport">
                            <div class="stat-label">🚚 Transport Rating</div>
                            <div class="stat-value">${species.ratings?.transport || 'N/A'}<span class="stat-max">/10</span></div>
                            <div class="stat-desc">${getStatDescription('transport', species.ratings?.transport)}</div>
                        </div>
                        <div class="stat-card speed">
                            <div class="stat-label">⚡ Speed Rating</div>
                            <div class="stat-value">${species.ratings?.speed || 'N/A'}<span class="stat-max">/10</span></div>
                            <div class="stat-desc">${getStatDescription('speed', species.ratings?.speed)}</div>
                        </div>
                        <div class="stat-card survivability">
                            <div class="stat-label">🛡️ Survivability</div>
                            <div class="stat-value">${species.ratings?.survivability || 'N/A'}<span class="stat-max">/10</span></div>
                            <div class="stat-desc">${getStatDescription('survivability', species.ratings?.survivability)}</div>
                        </div>
                    </div>
                </div>
                
                ${tamingInfo}
                
                <div class="planning-section">
                    <div class="section-header">
                        <h3>🎯 Usage & Strategies</h3>
                        <button class="btn btn-secondary" onclick="goToMyNuggies()">Manage Collection →</button>
                    </div>
                    <div class="usage-info">
                        <div class="usage-grid">
                            <div class="usage-card">
                                <div class="usage-title">🏆 Primary Role</div>
                                <div class="usage-content">${species.primaryRole || 'Multi-purpose creature suitable for various tasks'}</div>
                            </div>
                            
                            <div class="usage-card">
                                <div class="usage-title">📦 Your Collection</div>
                                <div class="usage-content">
                                    <div class="collection-stat">${speciesCreatures.length} ${species.name}${speciesCreatures.length !== 1 ? 's' : ''} owned</div>
                                    ${speciesCreatures.length > 0 ? `
                                        <div class="collection-details">
                                            <div>Highest Level: ${Math.max(...speciesCreatures.map(c => c.level || 1))}</div>
                                            <div>Average Level: ${Math.round(speciesCreatures.reduce((sum, c) => sum + (c.level || 1), 0) / speciesCreatures.length)}</div>
                                        </div>
                                    ` : '<div class="collection-empty">Add your first one!</div>'}
                                </div>
                            </div>
                            
                            ${species.specialAbilities ? `
                                <div class="usage-card special">
                                    <div class="usage-title">✨ Special Abilities</div>
                                    <div class="usage-content">${species.specialAbilities}</div>
                                </div>
                            ` : ''}
                        </div>
                        
                        <div class="strategy-tips">
                            <div class="tips-title">💡 Pro Tips & Strategies</div>
                            <div class="tips-content">
                                ${species.tips || generateSpeciesTips(species)}
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

// Add placeholder functions for species page actions
function exportSpeciesData() {
    console.log('Export species data functionality coming soon...');
    // Placeholder for export functionality
}

function speciesCalculator() {
    console.log('Species stats calculator coming soon...');
    // Placeholder for calculator functionality
}

function addNewCreature(speciesName = null) {
    openAddCreatureModal(speciesName);
}

// Comprehensive creature addition modal
function openAddCreatureModal(preSelectedSpecies = null) {
    const database = window.SPECIES_DATABASE || window.EXPANDED_SPECIES_DATABASE;
    const speciesList = Object.keys(database).sort();
    
    const modalHtml = `
        <div class="modal-overlay" id="addCreatureModal">
            <div class="modal-content creature-modal">
                <div class="modal-header">
                    <h2>➕ Add New Creature</h2>
                    <button class="modal-close" onclick="closeAddCreatureModal()">✕</button>
                </div>
                
                <div class="modal-body">
                    <form id="addCreatureForm">
                        <div class="form-sections">
                            <!-- Basic Information -->
                            <div class="form-section">
                                <h3>📋 Basic Information</h3>
                                <div class="form-row">
                                    <div class="form-group">
                                        <label for="creatureName">Creature Name</label>
                                        <input type="text" id="creatureName" placeholder="Enter creature name..." required>
                                    </div>
                                    <div class="form-group">
                                        <label for="creatureSpecies">Species</label>
                                        <select id="creatureSpecies" required>
                                            <option value="">Select species...</option>
                                            ${speciesList.map(species => 
                                                `<option value="${species}" ${preSelectedSpecies === species ? 'selected' : ''}>${species}</option>`
                                            ).join('')}
                                        </select>
                                    </div>
                                </div>
                                
                                <div class="form-row">
                                    <div class="form-group">
                                        <label for="creatureLevel">Level</label>
                                        <input type="number" id="creatureLevel" min="1" max="999" placeholder="1" value="1">
                                    </div>
                                    <div class="form-group">
                                        <label for="creatureGender">Gender</label>
                                        <select id="creatureGender">
                                            <option value="">Unknown</option>
                                            <option value="Male">Male</option>
                                            <option value="Female">Female</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Stats Section -->
                            <div class="form-section">
                                <h3>📊 Statistics</h3>
                                <div class="stats-grid">
                                    <div class="stat-input">
                                        <label for="creatureHealth">❤️ Health</label>
                                        <input type="number" id="creatureHealth" min="0" placeholder="Health points">
                                    </div>
                                    <div class="stat-input">
                                        <label for="creatureStamina">⚡ Stamina</label>
                                        <input type="number" id="creatureStamina" min="0" placeholder="Stamina points">
                                    </div>
                                    <div class="stat-input">
                                        <label for="creatureOxygen">🫁 Oxygen</label>
                                        <input type="number" id="creatureOxygen" min="0" placeholder="Oxygen points">
                                    </div>
                                    <div class="stat-input">
                                        <label for="creatureFood">🍖 Food</label>
                                        <input type="number" id="creatureFood" min="0" placeholder="Food points">
                                    </div>
                                    <div class="stat-input">
                                        <label for="creatureWeight">� Weight</label>
                                        <input type="number" id="creatureWeight" min="0" placeholder="Weight capacity">
                                    </div>
                                    <div class="stat-input">
                                        <label for="creatureMelee">⚔️ Melee Damage</label>
                                        <input type="number" id="creatureMelee" min="0" placeholder="Melee damage %">
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Mutations & Breeding -->
                            <div class="form-section">
                                <h3>🧬 Mutations & Breeding</h3>
                                <div class="form-row">
                                    <div class="form-group">
                                        <label for="creatureMutations">Mutation Count</label>
                                        <input type="number" id="creatureMutations" min="0" max="254" placeholder="0" value="0">
                                    </div>
                                    <div class="form-group">
                                        <label for="creatureColors">Color Mutations</label>
                                        <input type="text" id="creatureColors" placeholder="e.g., Red belly, Blue stripes">
                                    </div>
                                </div>
                                
                                <div class="form-row">
                                    <div class="form-group">
                                        <label for="creatureBreeding">Breeding Status</label>
                                        <select id="creatureBreeding">
                                            <option value="">Not for breeding</option>
                                            <option value="breeder">Active breeder</option>
                                            <option value="retired">Retired breeder</option>
                                            <option value="potential">Potential breeder</option>
                                        </select>
                                    </div>
                                    <div class="form-group">
                                        <label for="creatureBloodline">Bloodline/Line</label>
                                        <input type="text" id="creatureBloodline" placeholder="e.g., Alpha Line, Boss Killers">
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Notes & Tags -->
                            <div class="form-section">
                                <h3>📝 Notes & Tags</h3>
                                <div class="form-group">
                                    <label for="creatureNotes">Notes</label>
                                    <textarea id="creatureNotes" rows="3" placeholder="Any special notes about this creature..."></textarea>
                                </div>
                                
                                <div class="form-group">
                                    <label for="creatureTags">Tags</label>
                                    <div class="tag-section">
                                        <input type="text" id="creatureTags" placeholder="Add tags separated by commas...">
                                        <div class="preset-tags">
                                            <span class="preset-tag" onclick="addTag('Boss Fighter')">Boss Fighter</span>
                                            <span class="preset-tag" onclick="addTag('Breeder')">Breeder</span>
                                            <span class="preset-tag" onclick="addTag('Resource Gatherer')">Resource Gatherer</span>
                                            <span class="preset-tag" onclick="addTag('Explorer')">Explorer</span>
                                            <span class="preset-tag" onclick="addTag('Guard')">Guard</span>
                                            <span class="preset-tag" onclick="addTag('Transport')">Transport</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </form>
                </div>
                
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="closeAddCreatureModal()">Cancel</button>
                    <button type="button" class="btn btn-primary" onclick="saveNewCreature()">💾 Save Creature</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    // Activate overlay
    const injected = document.getElementById('addCreatureModal');
    if (injected) injected.classList.add('active');

    setTimeout(() => {
        document.getElementById('creatureName')?.focus();
    }, 100);
}

function closeAddCreatureModal() {
    const modal = document.getElementById('addCreatureModal');
    if (modal) {
        modal.remove();
    }
}

function addTag(tagText) {
    const tagsInput = document.getElementById('creatureTags');
    if (tagsInput) {
        const currentTags = tagsInput.value.trim();
        if (currentTags) {
            tagsInput.value = currentTags + ', ' + tagText;
        } else {
            tagsInput.value = tagText;
        }
    }
}

function saveNewCreature() {
    const form = document.getElementById('addCreatureForm');
    if (!form) return;
    
    // Collect form data (based on Old Nugget structure)
    const newCreature = {
        id: generateCreatureId(),
        name: document.getElementById('creatureName').value.trim(),
        species: document.getElementById('creatureSpecies').value,
        gender: document.getElementById('creatureGender').value,
        level: parseInt(document.getElementById('creatureLevel').value) || 1,
        
        // Base Stats (Wild Points)
        baseStats: {
            Health: parseInt(document.getElementById('baseStatHealth').value) || 0,
            Stamina: parseInt(document.getElementById('baseStatStamina').value) || 0,
            Oxygen: parseInt(document.getElementById('baseStatOxygen').value) || 0,
            Food: parseInt(document.getElementById('baseStatFood').value) || 0,
            Weight: parseInt(document.getElementById('baseStatWeight').value) || 0,
            Melee: parseInt(document.getElementById('baseStatMelee').value) || 0
        },
        
        // Mutations
        mutations: {
            Health: parseInt(document.getElementById('healthMutations').value) || 0,
            Stamina: parseInt(document.getElementById('staminaMutations').value) || 0,
            Oxygen: parseInt(document.getElementById('oxygenMutations').value) || 0,
            Food: parseInt(document.getElementById('foodMutations').value) || 0,
            Weight: parseInt(document.getElementById('weightMutations').value) || 0,
            Melee: parseInt(document.getElementById('meleeMutations').value) || 0
        },
        
        // Domestic Levels (Post-tame leveling)
        domesticLevels: {
            Health: parseInt(document.getElementById('healthLevels').value) || 0,
            Stamina: parseInt(document.getElementById('staminaLevels').value) || 0,
            Oxygen: parseInt(document.getElementById('oxygenLevels').value) || 0,
            Food: parseInt(document.getElementById('foodLevels').value) || 0,
            Weight: parseInt(document.getElementById('weightLevels').value) || 0,
            Melee: parseInt(document.getElementById('meleeLevels').value) || 0
        },
        
        // Notes & Tags
        notes: document.getElementById('creatureNotes').value.trim(),
        tags: document.getElementById('creatureTags').value.trim().split(',').map(t => t.trim()).filter(t => t),
        
        // Metadata
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    // Validation
    if (!newCreature.name) {
        alert('Please enter a creature name.');
        return;
    }
    
    if (!newCreature.species) {
        alert('Please select a species.');
        return;
    }
    
    // Add to collection
    if (!window.appState.creatures) {
        window.appState.creatures = [];
    }
    
    window.appState.creatures.push(newCreature);
    
    // Save to storage
    if (typeof window.saveData === 'function') {
        window.saveData();
    }
    
    // Close modal
    closeAddCreatureModal();
    
    // Show success message
    console.log('Creature added successfully:', newCreature.name);
    
    // Refresh current page if on My Nuggies
    if (window.location.hash === '#nuggies' || document.querySelector('.nuggies-page')) {
        loadMyNuggiesPage();
    }
}

function generateCreatureId() {
    return 'creature_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
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
        const totalCreaturesEl = document.getElementById('totalCreatures');
        const speciesTrackedEl = document.getElementById('speciesTracked');
        const bossReadySpeciesEl = document.getElementById('bossReadySpecies');
        const prizedBloodlinesEl = document.getElementById('prizedBloodlines');
        const highestLevelEl = document.getElementById('highestLevel');
        
        if (totalCreaturesEl) totalCreaturesEl.textContent = creatures.length;
        if (speciesTrackedEl) speciesTrackedEl.textContent = `${speciesOwned}/${totalSpeciesInDB}`;
        if (bossReadySpeciesEl) bossReadySpeciesEl.textContent = '0'; // Placeholder
        if (prizedBloodlinesEl) prizedBloodlinesEl.textContent = prizedCount;
        if (highestLevelEl) highestLevelEl.textContent = highestLevel;
    } catch (e) {
        console.warn('Could not update stats dashboard:', e);
    }
}

// Make functions globally available
window.filterSpecies = filterSpecies;
window.openSpeciesDetail = openSpeciesDetail;
window.goBackToSpecies = goBackToSpecies;
window.switchTab = switchTab;
window.loadSpeciesPage = loadSpeciesPage;
window.exportSpeciesData = exportSpeciesData;
window.speciesCalculator = speciesCalculator;
window.addNewCreature = addNewCreature;
window.addSpeciesCreature = addSpeciesCreature;
window.setupCollectionFilters = setupCollectionFilters;
window.filterCreatureCollection = filterCreatureCollection;
window.clearCollectionFilters = clearCollectionFilters;
window.getStatDescription = getStatDescription;
window.generateSpeciesTips = generateSpeciesTips;
window.openAddCreatureModal = openAddCreatureModal;
window.closeAddCreatureModal = closeAddCreatureModal;
window.addTag = addTag;
window.saveNewCreature = saveNewCreature;
window.generateCreatureId = generateCreatureId;

// Setup navigation listeners for all nav buttons
function setupNavigationListeners() {
    console.log('[SPA] Setting up navigation listeners...');
    
    // Get all navigation buttons
    const navButtons = document.querySelectorAll('.nav-btn');
    
    navButtons.forEach(button => {
        button.addEventListener('click', async function(e) {
            e.preventDefault();
            const pageId = this.getAttribute('data-page');
            console.log(`[Navigation] Clicked: ${pageId}`);
            
            // Clean up any open modals before navigation
            cleanupModals();
            
            // Handle navigation based on page
            switch(pageId) {
                case 'profile':
                    loadMyProfilePage();
                    break;
                case 'creatures':
                    await goToCreatures(); // Fixed: Show species database for creatures button
                    break;
                case 'nuggies':
                    loadMyNuggiesPage();
                    break;
                case 'species':
                    loadSpeciesPage();
                    break;
                case 'trading':
                    loadTradingPage();
                    break;
                case 'tribes':
                case 'tribe':  // Handle both possible button IDs
                    loadTribesPage();
                    break;
                case 'boss':
                    loadBossPlanner();
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
    setActiveNavButton('nuggies');
    const main = document.getElementById('appMainContent');
    if (!main) return;
    
    const creatures = window.appState?.creatures || [];
    const database = window.SPECIES_DATABASE || window.EXPANDED_SPECIES_DATABASE;
    
    // Group creatures by species for better organization
    const creaturesBySpecies = creatures.reduce((acc, creature) => {
        const species = creature.species || 'Unknown';
        if (!acc[species]) acc[species] = [];
        acc[species].push(creature);
        return acc;
    }, {});
    
    main.innerHTML = `
        <div class="nuggies-page">
            <div class="nuggies-header">
                <div class="page-title">
                    <h1>🍗 My Nuggies Collection</h1>
                    <div class="creature-count">${creatures.length} creatures across ${Object.keys(creaturesBySpecies).length} species</div>
                </div>
                <div class="header-actions">
                    <button class="btn btn-secondary" onclick="exportCreatures()">📤 Export</button>
                    <button class="btn btn-secondary" onclick="importCreatures()">📥 Import</button>
                </div>
            </div>
            
            <div class="collection-controls">
                <div class="search-section">
                    <input type="text" id="creatureSearch" placeholder="🔍 Search your creatures..." class="search-input">
                </div>
                
                <div class="filter-section">
                    ${mkSelect('speciesFilter',
                        [{ v: '', l: 'All Species' }, ...Object.keys(creaturesBySpecies).sort().map(s => ({ v: s, l: `${s} (${creaturesBySpecies[s].length})` }))],
                        '', 'All Species')}
                    ${mkSelect('sortFilter',
                        [{ v: 'species', l: 'Group by Species' }, { v: 'level', l: 'Sort by Level' }, { v: 'name', l: 'Sort by Name' }, { v: 'recent', l: 'Recently Added' }],
                        'species', 'Group by Species')}
                    <button class="btn btn-sm btn-secondary" onclick="clearCollectionFilters()">Clear</button>
                </div>
            </div>
            
            <div class="collection-content">
                ${creatures.length > 0 ? renderCreatureCollection(creaturesBySpecies, database) : renderEmptyCollection()}
            </div>
        </div>
    `;
    
    // Set up event listeners for search and filters
    setupCollectionFilters();
}

function renderCreatureCollection(creaturesBySpecies, database) {
    return Object.keys(creaturesBySpecies).sort().map(speciesName => {
        const speciesCreatures = creaturesBySpecies[speciesName];
        const speciesData = database?.[speciesName];
        
        return `
            <div class="species-collection-section">
                <div class="species-section-header">
                    <div class="species-info">
                        <div class="species-icon">${speciesData?.icon || '🦖'}</div>
                        <div>
                            <h3>${speciesName}</h3>
                            <div class="species-meta">${speciesCreatures.length} creature${speciesCreatures.length !== 1 ? 's' : ''}</div>
                        </div>
                    </div>
                    <div class="species-actions">
                        <button class="btn btn-sm btn-primary" onclick="addSpeciesCreature('${speciesName}')">+ Add ${speciesName}</button>
                        <button class="btn btn-sm btn-secondary" onclick="openSpeciesDetail('${speciesName}')">View Species Info</button>
                    </div>
                </div>
                
                <div class="creatures-grid">
                    ${speciesCreatures.map(creature => renderCreatureCard(creature, speciesData)).join('')}
                </div>
            </div>
        `;
    }).join('');
}

function renderCreatureCard(creature, speciesData) {
    return `
        <div class="creature-management-card">
            <div class="creature-card-header">
                <div class="creature-info">
                    <div class="creature-name">${creature.name || 'Unnamed'}</div>
                    <div class="creature-species">${creature.species || 'Unknown'}</div>
                </div>
                <div class="creature-level">Level ${creature.level || 1}</div>
            </div>
            
            <div class="creature-details">
                <div class="creature-stats">
                    <div class="stat-item">
                        <span class="stat-label">❤️ Health</span>
                        <span class="stat-value">${creature.baseStats?.Health ?? 'N/A'}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">⚔️ Melee</span>
                        <span class="stat-value">${creature.baseStats?.Melee ?? 'N/A'}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">🏋️ Weight</span>
                        <span class="stat-value">${creature.baseStats?.Weight ?? 'N/A'}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">⚡ Stamina</span>
                        <span class="stat-value">${creature.baseStats?.Stamina ?? 'N/A'}</span>
                    </div>
                </div>

                <div class="creature-meta">
                    <div class="meta-item">
                        <span class="meta-label">Gender:</span>
                        <span class="meta-value">${creature.gender || 'Unknown'}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">Mutations:</span>
                        <span class="meta-value">${Object.values(creature.mutations || {}).reduce((a, b) => a + b, 0) || 0}</span>
                    </div>
                </div>
            </div>
            
            <div class="creature-actions">
                <button class="btn btn-sm btn-secondary" onclick="editCreature('${creature.id}')">✏️ Edit</button>
                <button class="btn btn-sm btn-primary" onclick="duplicateCreature('${creature.id}')">📋 Clone</button>
                <button class="btn btn-sm btn-danger" onclick="deleteCreature('${creature.id}')">🗑️ Delete</button>
            </div>
        </div>
    `;
}

function renderEmptyCollection() {
    return `
        <div class="empty-collection-state">
            <div class="empty-icon">🦕</div>
            <div class="empty-title">No Creatures Yet</div>
            <div class="empty-description">Head to the <strong>Creatures</strong> page, find a species, and click <strong>Add Your [Species]</strong> to start your collection.</div>
        </div>
    `;
}

function setupCollectionFilters() {
    const searchInput = document.getElementById('creatureSearch');
    if (searchInput) searchInput.addEventListener('input', debounce(filterCreatureCollection, 300));
    document.getElementById('csel_speciesFilter')?.addEventListener('cselchange', filterCreatureCollection);
    document.getElementById('csel_sortFilter')?.addEventListener('cselchange', filterCreatureCollection);
}

function filterCreatureCollection() {
    const searchTerm = document.getElementById('creatureSearch')?.value.toLowerCase() || '';
    const selectedSpecies = document.getElementById('csel_speciesFilter')?.dataset.val || '';
    const sortBy = document.getElementById('csel_sortFilter')?.dataset.val || 'species';
    
    const sections = document.querySelectorAll('.species-collection-section');
    
    sections.forEach(section => {
        const speciesName = section.querySelector('h3').textContent;
        const shouldShowSection = !selectedSpecies || speciesName === selectedSpecies;
        
        if (!shouldShowSection) {
            section.style.display = 'none';
            return;
        }
        
        const cards = section.querySelectorAll('.creature-management-card');
        let visibleCards = 0;
        
        cards.forEach(card => {
            const creatureName = card.querySelector('.creature-name').textContent.toLowerCase();
            const shouldShowCard = !searchTerm || creatureName.includes(searchTerm);
            
            if (shouldShowCard) {
                card.style.display = 'block';
                visibleCards++;
            } else {
                card.style.display = 'none';
            }
        });
        
        section.style.display = visibleCards > 0 ? 'block' : 'none';
    });
}

function clearCollectionFilters() {
    const searchInput = document.getElementById('creatureSearch');
    if (searchInput) searchInput.value = '';
    const sf = document.getElementById('csel_speciesFilter');
    if (sf) { sf.dataset.val = ''; document.getElementById('csel_lbl_speciesFilter').textContent = 'All Species'; }
    const so = document.getElementById('csel_sortFilter');
    if (so) { so.dataset.val = 'species'; document.getElementById('csel_lbl_sortFilter').textContent = 'Group by Species'; }
    filterCreatureCollection();
}

function addSpeciesCreature(speciesName) {
    console.log(`Add new ${speciesName} functionality coming soon...`);
    // This will open the creature modal with the species pre-selected
    openAddCreatureModal(speciesName);
}

// Helper function to get stat descriptions
function getStatDescription(statType, value) {
    if (!value || value === 'N/A') return 'Not rated';
    
    const descriptions = {
        combat: {
            1: 'Poor fighter', 2: 'Weak in combat', 3: 'Below average fighter',
            4: 'Fair combat ability', 5: 'Average fighter', 6: 'Good in combat',
            7: 'Strong fighter', 8: 'Excellent combatant', 9: 'Elite warrior',
            10: 'Legendary fighter'
        },
        transport: {
            1: 'Very limited carrying', 2: 'Poor weight capacity', 3: 'Below average carrying',
            4: 'Fair transport ability', 5: 'Average carrier', 6: 'Good pack animal',
            7: 'Strong transport', 8: 'Excellent carrier', 9: 'Heavy hauler',
            10: 'Ultimate pack beast'
        },
        speed: {
            1: 'Very slow', 2: 'Slow moving', 3: 'Below average speed',
            4: 'Fair speed', 5: 'Average pace', 6: 'Good speed',
            7: 'Fast moving', 8: 'Very fast', 9: 'Extremely fast',
            10: 'Lightning fast'
        },
        survivability: {
            1: 'Very fragile', 2: 'Fragile', 3: 'Below average durability',
            4: 'Fair survivability', 5: 'Average toughness', 6: 'Good survivability',
            7: 'Tough creature', 8: 'Very durable', 9: 'Extremely tough',
            10: 'Nearly indestructible'
        }
    };
    
    return descriptions[statType]?.[value] || 'Unknown rating';
}

// Helper function to generate species tips
function generateSpeciesTips(species) {
    const tips = [];
    
    // Combat tips
    if (species.ratings?.combat >= 7) {
        tips.push("💪 Excellent for boss fights and PvP combat");
    } else if (species.ratings?.combat <= 3) {
        tips.push("🛡️ Focus on support roles rather than direct combat");
    }
    
    // Transport tips
    if (species.ratings?.transport >= 7) {
        tips.push("📦 Perfect for resource gathering and long expeditions");
    }
    
    // Speed tips  
    if (species.ratings?.speed >= 7) {
        tips.push("⚡ Great for scouting, escaping danger, and quick travel");
    }
    
    // Diet-based tips
    if (species.diet === 'Carnivore') {
        tips.push("🥩 Feed raw meat for faster taming and better health");
    } else if (species.diet === 'Herbivore') {
        tips.push("🌱 Berries and vegetables are your best friend for taming");
    }
    
    // Rarity tips
    if (species.rarity === 'Rare' || species.rarity === 'Very Rare') {
        tips.push("⭐ Rare species - invest time in perfect taming for best results");
    }
    
    if (tips.length === 0) {
        tips.push(`Experiment with different strategies to maximize your ${species.name}'s potential!`);
    }
    
    return tips.join(' • ');
}

// ── Trading Post ────────────────────────────────────────────────────────────
async function loadTradingPage() {
    setActiveNavButton('trading');
    const main = document.getElementById('appMainContent');
    if (!main) return;
    main.innerHTML = `<div class="std-page"><div style="color:#94a3b8;padding:40px 0">Loading marketplace...</div></div>`;

    const myId = parseInt(localStorage.getItem('userId') || '0');
    const [trades, myOffers] = await Promise.all([
        apiRequest('/api/trades?status=open').then(r => Array.isArray(r.body) ? r.body : []).catch(() => []),
        apiRequest('/api/offers').then(r => Array.isArray(r.body) ? r.body : []).catch(() => [])
    ]);

    // Separate my listings from others
    const myListings = trades.filter(t => t.user_id === myId);
    const otherListings = trades.filter(t => t.user_id !== myId);

    main.innerHTML = `
        <div class="std-page">
            <div class="std-page-header">
                <div class="page-title">
                    <h1>🔁 Trading Post</h1>
                    <div class="page-subtitle">${otherListings.length} listing${otherListings.length !== 1 ? 's' : ''} available</div>
                </div>
                <button class="btn btn-primary" onclick="tradeShowListModal()">➕ List a Creature</button>
            </div>

            <div class="tribe-tabs">
                <button class="tribe-tab active" data-ttab="market" onclick="tradeTab(this,'market')">🏪 Marketplace</button>
                <button class="tribe-tab" data-ttab="activity" onclick="tradeTab(this,'activity')">📋 My Activity</button>
            </div>

            <div id="tradeTabContent">
                ${renderTradeMarket(otherListings, myId)}
            </div>
        </div>`;

    // store for tab switching
    window._tradeData = { trades, myListings, myOffers, myId };
}

function tradeTab(btn, tab) {
    document.querySelectorAll('.tribe-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const { trades, myListings, myOffers, myId } = window._tradeData || {};
    const content = document.getElementById('tradeTabContent');
    if (!content) return;
    if (tab === 'market') {
        const others = (trades||[]).filter(t => t.user_id !== myId);
        content.innerHTML = renderTradeMarket(others, myId);
        tradeMarketSearch();
    } else {
        content.innerHTML = renderTradeActivity(myListings||[], myOffers||[], myId);
    }
}
window.tradeTab = tradeTab;

// ── Marketplace tab ──────────────────────────────────────────────────────────
function renderTradeMarket(listings, myId) {
    return `
        <div class="std-filters" style="margin-top:20px">
            <input id="tradeSearch" class="form-control search-input" placeholder="🔍 Search by species...">
        </div>
        <div id="tradeGrid" class="trade-grid">
            ${renderTradeCards(listings)}
        </div>`;
}

function renderTradeCards(listings) {
    if (!listings.length) return '<div class="friends-empty" style="padding:32px 0;text-align:center">No listings yet — be the first to post one!</div>';
    return listings.map(t => {
        const c = t.creature || {};
        const bs = c.baseStats || {};
        const db = window.SPECIES_DATABASE || {};
        const icon = (db[c.species] || {}).icon || '🦖';
        const badges = (window.BadgeSystem && typeof window.BadgeSystem.generateBadgeHTML === 'function')
            ? window.BadgeSystem.generateBadgeHTML(c) : '';
        return `
        <div class="trade-card">
            <div class="trade-card-header">
                <div class="trade-card-icon">${icon}</div>
                <div class="trade-card-title">
                    <div class="trade-card-name">${c.name || 'Unnamed'}</div>
                    <div class="trade-card-species">${c.species || '?'} · Lvl ${c.level || 1} · ${c.gender || '?'}</div>
                </div>
            </div>
            <div class="trade-card-stats">
                <span>❤️ ${bs.Health||0}</span>
                <span>⚔️ ${bs.Melee||0}</span>
                <span>⚡ ${bs.Stamina||0}</span>
                <span>🏋️ ${bs.Weight||0}</span>
            </div>
            ${badges ? `<div class="trade-card-badges">${badges}</div>` : ''}
            <div class="trade-card-want">
                <span class="trade-want-label">Looking for:</span>
                <span class="trade-want-val">${t.wanted || 'Open to offers'}</span>
            </div>
            ${t.price ? `<div class="trade-card-price">💰 ${t.price}</div>` : ''}
            <button class="btn btn-primary btn-sm trade-offer-btn" onclick="tradeShowOfferModal(${t.id},'${(c.name||'Unnamed').replace(/'/g,"\\'")}')">Make Offer</button>
        </div>`;
    }).join('');
}

function tradeMarketSearch() {
    const input = document.getElementById('tradeSearch');
    if (!input) return;
    input.addEventListener('input', () => {
        const q = input.value.toLowerCase();
        const { trades, myId } = window._tradeData || {};
        const filtered = (trades||[]).filter(t => t.user_id !== myId && (
            !q ||
            (t.creature?.species||'').toLowerCase().includes(q) ||
            (t.creature?.name||'').toLowerCase().includes(q) ||
            (t.wanted||'').toLowerCase().includes(q)
        ));
        document.getElementById('tradeGrid').innerHTML = renderTradeCards(filtered);
    });
}

// ── My Activity tab ──────────────────────────────────────────────────────────
function renderTradeActivity(myListings, myOffers, myId) {
    return `
        <div class="trade-activity">
            <h2 class="friends-section-title" style="margin-top:20px">Your Listings</h2>
            ${myListings.length
                ? myListings.map(t => renderMyListing(t)).join('')
                : '<div class="friends-empty">No listings yet.</div>'}

            <h2 class="friends-section-title" style="margin-top:28px">Your Offers</h2>
            ${myOffers.length
                ? myOffers.map(o => renderMyOffer(o)).join('')
                : '<div class="friends-empty">No offers sent yet.</div>'}
        </div>`;
}

function renderMyListing(t) {
    const c = t.creature || {};
    return `
        <div class="friend-card" style="flex-direction:column;align-items:flex-start;gap:10px" id="listing-${t.id}">
            <div style="display:flex;align-items:center;justify-content:space-between;width:100%">
                <div>
                    <div class="friend-name">${c.name||'Unnamed'} <span style="color:#64748b;font-weight:400">${c.species||'?'}</span></div>
                    <div class="friend-meta">Looking for: ${t.wanted||'Open to offers'}${t.price ? ` · 💰 ${t.price}` : ''}</div>
                </div>
                <button class="btn btn-danger btn-sm" onclick="tradeRemoveListing(${t.id})">Remove</button>
            </div>
            <div id="listing-offers-${t.id}">
                <button class="btn btn-secondary btn-sm" onclick="tradeLoadOffers(${t.id})">View Offers</button>
            </div>
        </div>`;
}

function renderMyOffer(o) {
    const statusColor = { pending:'#60a5fa', accepted:'#22c55e', rejected:'#ef4444', cancelled:'#64748b' }[o.status] || '#94a3b8';
    const oc = o.offered_creature_data || {};
    return `
        <div class="friend-card" id="offer-${o.id}">
            <div class="friend-info">
                <div class="friend-name">Offer on Trade #${o.trade_id}</div>
                <div class="friend-meta">Offering: ${oc.name||'Unnamed'} (${oc.species||'?'})${o.message ? ` · "${o.message}"` : ''}</div>
            </div>
            <div style="display:flex;align-items:center;gap:10px;flex-shrink:0">
                <span style="font-size:0.82rem;color:${statusColor};text-transform:capitalize">${o.status}</span>
                ${o.status === 'pending' ? `<button class="btn btn-secondary btn-sm" onclick="tradeCancelOffer(${o.id})">Cancel</button>` : ''}
            </div>
        </div>`;
}

// ── Actions ──────────────────────────────────────────────────────────────────
async function tradeLoadOffers(tradeId) {
    const container = document.getElementById(`listing-offers-${tradeId}`);
    if (!container) return;
    container.innerHTML = '<span style="color:#94a3b8;font-size:0.85rem">Loading offers...</span>';
    const { res, body } = await apiRequest(`/api/trades/${tradeId}/offers`);
    if (!res.ok || !Array.isArray(body) || !body.length) {
        container.innerHTML = '<span style="color:#64748b;font-size:0.85rem">No offers yet.</span>';
        return;
    }
    container.innerHTML = body.map(o => {
        const oc = o.offered_creature_data || {};
        const statusColor = { pending:'#60a5fa', accepted:'#22c55e', rejected:'#ef4444' }[o.status] || '#94a3b8';
        return `<div class="trade-offer-row">
            <div>
                <span style="color:#f1f5f9;font-weight:500">${o.from_nickname || 'User #'+o.from_user_id}</span>
                offers <strong>${oc.name||'Unnamed'}</strong> (${oc.species||'?'})
                ${o.message ? `<em style="color:#64748b"> — "${o.message}"</em>` : ''}
            </div>
            <div style="display:flex;gap:8px;align-items:center;flex-shrink:0">
                <span style="font-size:0.8rem;color:${statusColor};text-transform:capitalize">${o.status}</span>
                ${o.status === 'pending' ? `
                    <button class="btn btn-primary btn-sm" onclick="tradeAcceptOffer(${o.id},${tradeId})">Accept</button>
                    <button class="btn btn-secondary btn-sm" onclick="tradeRejectOffer(${o.id})">Decline</button>
                ` : ''}
            </div>
        </div>`;
    }).join('');
}
window.tradeLoadOffers = tradeLoadOffers;

async function tradeAcceptOffer(offerId, tradeId) {
    if (!confirm('Accept this offer? The creature will transfer to the buyer.')) return;
    const { res, body } = await apiRequest(`/api/offers/${offerId}`, { method: 'PUT', body: JSON.stringify({ status: 'accepted' }) });
    if (res.ok) { alert('Deal done! Creature transferred.'); loadTradingPage(); }
    else alert(body?.error || 'Failed to accept offer.');
}
window.tradeAcceptOffer = tradeAcceptOffer;

async function tradeRejectOffer(offerId) {
    const { res, body } = await apiRequest(`/api/offers/${offerId}`, { method: 'PUT', body: JSON.stringify({ status: 'rejected' }) });
    if (res.ok) { const el = document.getElementById(`offer-row-${offerId}`); if (el) el.remove(); else loadTradingPage(); }
    else alert(body?.error || 'Failed to decline offer.');
}
window.tradeRejectOffer = tradeRejectOffer;

async function tradeCancelOffer(offerId) {
    if (!confirm('Cancel this offer?')) return;
    const { res, body } = await apiRequest(`/api/offers/${offerId}`, { method: 'PUT', body: JSON.stringify({ status: 'cancelled' }) });
    if (res.ok) loadTradingPage();
    else alert(body?.error || 'Failed to cancel offer.');
}
window.tradeCancelOffer = tradeCancelOffer;

async function tradeRemoveListing(tradeId) {
    if (!confirm('Remove this listing?')) return;
    const { res, body } = await apiRequest(`/api/trades/${tradeId}`, { method: 'DELETE' });
    if (res.ok) loadTradingPage();
    else alert(body?.error || 'Failed to remove listing.');
}
window.tradeRemoveListing = tradeRemoveListing;

// ── List a Creature modal ─────────────────────────────────────────────────────
function tradeShowListModal() {
    const creatures = window.appState?.creatures || [];
    if (!creatures.length) return alert('You have no creatures in My Nuggies yet. Add some first!');
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:560px">
            <div class="modal-header">
                <h2 class="modal-title">➕ List a Creature</h2>
                <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="modal-body" style="display:flex;flex-direction:column;gap:16px">
                <div class="plan-field">
                    <label class="form-label">Choose a Nuggie to list</label>
                    <div class="nuggie-picker">
                        ${creatures.map(c => `
                        <div class="nuggie-pick-card" onclick="tradeSelectNuggie('${c.id}',this)" data-cid="${c.id}">
                            <div class="nuggie-pick-name">${c.name||'Unnamed'}</div>
                            <div class="nuggie-pick-species">${c.species||'?'}</div>
                            <div class="nuggie-pick-stats">HP ${c.baseStats?.Health||0} · Mel ${c.baseStats?.Melee||0}</div>
                        </div>`).join('')}
                    </div>
                </div>
                <div class="plan-field">
                    <label class="form-label">What are you looking for?</label>
                    <input id="tradeWanted" class="form-control" placeholder="e.g. High-stat Rex, anything with 50+ melee...">
                </div>
                <div class="plan-field">
                    <label class="form-label">Price / notes (optional)</label>
                    <input id="tradePrice" class="form-control" placeholder="e.g. rare items only, message me first...">
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                <button class="btn btn-primary" onclick="tradeSubmitListing()">Post Listing</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
    window._selectedTradeNuggie = null;
}
window.tradeShowListModal = tradeShowListModal;

function tradeSelectNuggie(id, el) {
    document.querySelectorAll('.nuggie-pick-card').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
    window._selectedTradeNuggie = (window.appState?.creatures||[]).find(c => c.id === id) || null;
}
window.tradeSelectNuggie = tradeSelectNuggie;

async function tradeSubmitListing() {
    const creature = window._selectedTradeNuggie;
    if (!creature) return alert('Select a creature to list.');
    const wanted = document.getElementById('tradeWanted')?.value.trim() || null;
    const price = document.getElementById('tradePrice')?.value.trim() || null;
    const { res, body } = await apiRequest('/api/trades', {
        method: 'POST',
        body: JSON.stringify({ creature_card_id: creature.id, creature_data: creature, wanted, price })
    });
    if (res.ok) { document.querySelector('.modal.active')?.remove(); loadTradingPage(); }
    else alert(body?.error || 'Failed to post listing.');
}
window.tradeSubmitListing = tradeSubmitListing;

// ── Make Offer modal ──────────────────────────────────────────────────────────
function tradeShowOfferModal(tradeId, tradeName) {
    const creatures = window.appState?.creatures || [];
    if (!creatures.length) return alert('You have no creatures to offer. Add some in My Nuggies first!');
    window._offerTradeId = tradeId;
    window._selectedOfferNuggie = null;
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:560px">
            <div class="modal-header">
                <h2 class="modal-title">🤝 Make an Offer</h2>
                <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="modal-body" style="display:flex;flex-direction:column;gap:16px">
                <div class="friends-empty" style="padding:0">Offering on: <strong>${tradeName}</strong></div>
                <div class="plan-field">
                    <label class="form-label">Choose a Nuggie to offer</label>
                    <div class="nuggie-picker">
                        ${creatures.map(c => `
                        <div class="nuggie-pick-card" onclick="tradeSelectOffer('${c.id}',this)" data-cid="${c.id}">
                            <div class="nuggie-pick-name">${c.name||'Unnamed'}</div>
                            <div class="nuggie-pick-species">${c.species||'?'}</div>
                            <div class="nuggie-pick-stats">HP ${c.baseStats?.Health||0} · Mel ${c.baseStats?.Melee||0}</div>
                        </div>`).join('')}
                    </div>
                </div>
                <div class="plan-field">
                    <label class="form-label">Message (optional)</label>
                    <input id="offerMessage" class="form-control" placeholder="Say something to the seller...">
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                <button class="btn btn-primary" onclick="tradeSubmitOffer()">Send Offer</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
}
window.tradeShowOfferModal = tradeShowOfferModal;

function tradeSelectOffer(id, el) {
    document.querySelectorAll('.nuggie-pick-card').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
    window._selectedOfferNuggie = (window.appState?.creatures||[]).find(c => c.id === id) || null;
}
window.tradeSelectOffer = tradeSelectOffer;

async function tradeSubmitOffer() {
    const creature = window._selectedOfferNuggie;
    if (!creature) return alert('Select a creature to offer.');
    const message = document.getElementById('offerMessage')?.value.trim() || null;
    const { res, body } = await apiRequest(`/api/trades/${window._offerTradeId}/offers`, {
        method: 'POST',
        body: JSON.stringify({ offered_creature_id: creature.id, offered_creature_data: creature, message })
    });
    if (res.ok) { document.querySelector('.modal.active')?.remove(); alert('Offer sent!'); }
    else alert(body?.error || 'Failed to send offer.');
}
window.tradeSubmitOffer = tradeSubmitOffer;


async function loadTribesPage() {
    setActiveNavButton('tribe');
    const main = document.getElementById('appMainContent');
    if (!main) return;
    main.innerHTML = `<div class="std-page"><div style="color:#94a3b8;padding:40px 0">Loading tribes...</div></div>`;

    // Fetch user's tribe and all available tribes in parallel
    const [myTribe, allTribes] = await Promise.all([
        apiRequest('/api/my-tribe').then(r => r.body).catch(() => null),
        apiRequest('/api/tribes').then(r => Array.isArray(r.body) ? r.body : []).catch(() => [])
    ]);

    if (myTribe && myTribe.id) {
        // Fetch full tribe details (includes members)
        const detail = await apiRequest(`/api/tribes/${myTribe.id}`)
            .then(r => r.body).catch(() => myTribe);
        renderTribeMemberView(detail, main);
    } else {
        renderTribeBrowseView(allTribes, main);
    }
}

// ── NO TRIBE: browse + create ──────────────────────────────────
function renderTribeBrowseView(tribes, main) {
    main.innerHTML = `
        <div class="std-page">
            <div class="std-page-header">
                <div class="page-title">
                    <h1>🏛️ Tribes</h1>
                    <div class="page-subtitle">You're not in a tribe yet</div>
                </div>
                <button class="btn btn-primary" onclick="tribeShowCreateModal()">➕ Create Tribe</button>
            </div>

            <div class="tribe-browse-section">
                <div class="tribe-browse-top">
                    <h2 style="color:#f1f5f9;margin:0">Browse Tribes</h2>
                    <input id="tribeBrowseSearch" class="form-control search-input" placeholder="🔍 Search tribes..." style="max-width:280px">
                </div>
                <div id="tribeBrowseGrid" class="tribe-browse-grid">
                    ${renderTribeBrowseCards(tribes)}
                </div>
            </div>
        </div>`;

    document.getElementById('tribeBrowseSearch')?.addEventListener('input', function() {
        const q = this.value.toLowerCase();
        document.getElementById('tribeBrowseGrid').innerHTML =
            renderTribeBrowseCards(tribes.filter(t =>
                (t.name||'').toLowerCase().includes(q) || (t.description||'').toLowerCase().includes(q)
            ));
    });
}

function renderTribeBrowseCards(tribes) {
    if (!tribes.length) return '<div class="tribe-empty">No tribes found.</div>';
    return tribes.map(t => `
        <div class="tribe-browse-card">
            <div class="tribe-browse-icon">🏛️</div>
            <div class="tribe-browse-info">
                <div class="tribe-browse-name">${t.name}</div>
                ${t.main_map ? `<div class="tribe-browse-map">📍 ${t.main_map}</div>` : ''}
                ${t.description ? `<div class="tribe-browse-desc">${t.description}</div>` : ''}
            </div>
            <button class="btn btn-secondary btn-sm tribe-join-btn" onclick="tribeRequestJoin(${t.id}, '${(t.name||'').replace(/'/g,"\\'")}')">Request to Join</button>
        </div>`).join('');
}

async function tribeRequestJoin(tribeId, tribeName) {
    const msg = prompt(`Send a message with your join request to ${tribeName}? (optional)`);
    if (msg === null) return; // cancelled
    const { res, body } = await apiRequest(`/api/tribes/${tribeId}/join`, {
        method: 'POST', body: JSON.stringify({ message: msg || '' })
    });
    if (res.ok) {
        alert(`Join request sent to ${tribeName}! An admin will review it.`);
    } else {
        alert(body?.error || 'Failed to send join request.');
    }
}
window.tribeRequestJoin = tribeRequestJoin;

function tribeShowCreateModal() {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:480px">
            <div class="modal-header">
                <h2 class="modal-title">➕ Create Tribe</h2>
                <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="modal-body" style="display:flex;flex-direction:column;gap:16px">
                <div class="plan-field">
                    <label class="form-label">Tribe Name *</label>
                    <input id="tribeCreateName" class="form-control" placeholder="e.g. Alpha Hunters">
                </div>
                <div class="plan-field">
                    <label class="form-label">Main Map</label>
                    <input id="tribeCreateMap" class="form-control" placeholder="e.g. The Island, Ragnarok...">
                </div>
                <div class="plan-field">
                    <label class="form-label">Description</label>
                    <textarea id="tribeCreateDesc" class="form-control" rows="3" placeholder="What's your tribe about?"></textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                <button class="btn btn-primary" onclick="tribeDoCreate()">Create Tribe</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
}
window.tribeShowCreateModal = tribeShowCreateModal;

async function tribeDoCreate() {
    const name = document.getElementById('tribeCreateName')?.value.trim();
    if (!name) return alert('Tribe name is required.');
    const main_map = document.getElementById('tribeCreateMap')?.value.trim() || null;
    const description = document.getElementById('tribeCreateDesc')?.value.trim() || null;
    const { res, body } = await apiRequest('/api/tribes', {
        method: 'POST', body: JSON.stringify({ name, main_map, description })
    });
    if (res.ok) {
        document.querySelector('.modal.active')?.remove();
        loadTribesPage();
    } else {
        alert(body?.error || 'Failed to create tribe.');
    }
}
window.tribeDoCreate = tribeDoCreate;

// ── IN TRIBE: tabbed management view ───────────────────────────
function renderTribeMemberView(tribe, main) {
    const myUserId = parseInt(localStorage.getItem('userId') || '0');
    const me = (tribe.members || []).find(m => m.user_id === myUserId);
    const myRole = me?.role || 'member';
    const isAdmin = myRole === 'owner' || myRole === 'admin';

    main.innerHTML = `
        <div class="std-page">
            <div class="std-page-header">
                <div class="page-title">
                    <h1>🏛️ ${tribe.name}</h1>
                    <div class="page-subtitle">
                        ${tribe.main_map ? `📍 ${tribe.main_map} · ` : ''}
                        ${tribe.members?.length || 0} members · Your role: <strong style="color:#60a5fa;text-transform:capitalize">${myRole}</strong>
                    </div>
                </div>
                <button class="btn btn-danger btn-sm" onclick="tribeLeaveTribe(${tribe.id})">Leave Tribe</button>
            </div>

            <div class="tribe-tabs">
                <button class="tribe-tab active" data-tab="overview" onclick="tribeTab(this,'overview',${tribe.id})">🏠 Overview</button>
                <button class="tribe-tab" data-tab="members" onclick="tribeTab(this,'members',${tribe.id})">👥 Members (${tribe.members?.length||0})</button>
                <button class="tribe-tab" data-tab="vault" onclick="tribeTab(this,'vault',${tribe.id})">🗄️ Vault</button>
                ${isAdmin ? `<button class="tribe-tab" data-tab="requests" onclick="tribeTab(this,'requests',${tribe.id})">📬 Join Requests</button>` : ''}
            </div>
            <div id="tribeTabContent" class="tribe-tab-content">
                ${renderTribeOverviewTab(tribe, myRole)}
            </div>
        </div>`;
}

async function tribeTab(btn, tab, tribeId) {
    document.querySelectorAll('.tribe-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const content = document.getElementById('tribeTabContent');
    if (!content) return;
    content.innerHTML = '<div style="color:#94a3b8;padding:20px">Loading...</div>';

    if (tab === 'overview') {
        const { body } = await apiRequest(`/api/tribes/${tribeId}`).catch(() => ({ body: null }));
        content.innerHTML = body ? renderTribeOverviewTab(body, null) : '<div class="tribe-empty">Failed to load.</div>';
    } else if (tab === 'members') {
        const { body } = await apiRequest(`/api/tribes/${tribeId}`).catch(() => ({ body: null }));
        const myUserId = parseInt(localStorage.getItem('userId') || '0');
        const me = (body?.members || []).find(m => m.user_id === myUserId);
        const isAdmin = me?.role === 'owner' || me?.role === 'admin';
        content.innerHTML = renderTribeMembersTab(body, tribeId, isAdmin);
    } else if (tab === 'vault') {
        const { body } = await apiRequest(`/api/tribes/${tribeId}/creatures`).catch(() => ({ body: [] }));
        content.innerHTML = renderTribeVaultTab(Array.isArray(body) ? body : [], tribeId);
    } else if (tab === 'requests') {
        content.innerHTML = await loadJoinRequestsTab(tribeId);
    }
}
window.tribeTab = tribeTab;

function renderTribeOverviewTab(tribe, myRole) {
    const role = myRole || (() => {
        const myId = parseInt(localStorage.getItem('userId') || '0');
        return (tribe.members||[]).find(m => m.user_id === myId)?.role || 'member';
    })();
    return `
        <div class="tribe-overview">
            ${tribe.description ? `<div class="tribe-desc-block">${tribe.description}</div>` : ''}
            <div class="tribe-stats-row">
                <div class="tribe-stat"><div class="tribe-stat-val">${tribe.members?.length||0}</div><div class="tribe-stat-lbl">Members</div></div>
                ${tribe.main_map ? `<div class="tribe-stat"><div class="tribe-stat-val">📍</div><div class="tribe-stat-lbl">${tribe.main_map}</div></div>` : ''}
                <div class="tribe-stat"><div class="tribe-stat-val" style="text-transform:capitalize">${role}</div><div class="tribe-stat-lbl">Your Role</div></div>
            </div>
            ${role === 'owner' ? `
            <div class="tribe-owner-actions">
                <h3 style="color:#f1f5f9;margin:0 0 12px">Owner Actions</h3>
                <button class="btn btn-secondary" onclick="tribeShowTransferModal(${tribe.id})">🔁 Transfer Ownership</button>
            </div>` : ''}
        </div>`;
}

function renderTribeMembersTab(tribe, tribeId, isAdmin) {
    const members = tribe?.members || [];
    const myUserId = parseInt(localStorage.getItem('userId') || '0');
    return `
        <div class="tribe-members-list">
            ${members.map(m => `
                <div class="tribe-member-row">
                    <div class="tribe-member-avatar">👤</div>
                    <div class="tribe-member-info">
                        <div class="tribe-member-name">${m.nickname || m.email || 'Unknown'}</div>
                        <div class="tribe-member-role ${m.role}">${m.role}</div>
                    </div>
                    ${isAdmin && m.user_id !== myUserId && m.role !== 'owner'
                        ? `<button class="btn btn-danger btn-sm" onclick="tribeKickMember(${tribeId},${m.user_id},'${(m.nickname||m.email||'this member').replace(/'/g,"\\'")}')">Kick</button>`
                        : ''}
                </div>`).join('')}
        </div>`;
}

async function tribeKickMember(tribeId, userId, name) {
    if (!confirm(`Remove ${name} from the tribe?`)) return;
    const { res, body } = await apiRequest(`/api/tribes/${tribeId}/members/${userId}`, { method: 'DELETE' });
    if (res.ok) {
        loadTribesPage();
    } else {
        alert(body?.error || 'Failed to remove member.');
    }
}
window.tribeKickMember = tribeKickMember;

function renderTribeVaultTab(creatures, tribeId) {
    const myNuggies = window.appState?.creatures || [];
    return `
        <div class="tribe-vault">
            <div class="tribe-vault-header">
                <span style="color:#94a3b8;font-size:0.9rem">${creatures.length} creature${creatures.length!==1?'s':''} in vault</span>
                ${myNuggies.length ? `<button class="btn btn-primary btn-sm" onclick="tribeShareNuggieModal(${tribeId})">+ Share a Nuggie</button>` : ''}
            </div>
            ${creatures.length === 0
                ? `<div class="tribe-empty">Vault is empty. Members can share their Nuggies here.</div>`
                : `<div class="tribe-vault-grid">
                    ${creatures.map(c => {
                        const d = c.data || c;
                        return `<div class="tribe-vault-card">
                            <div class="nuggie-pick-name">${d.name||'Unnamed'}</div>
                            <div class="nuggie-pick-species">${d.species||'?'}</div>
                            <div class="nuggie-pick-stats">HP ${d.baseStats?.Health||0} · Mel ${d.baseStats?.Melee||0}</div>
                        </div>`;
                    }).join('')}
                   </div>`
            }
        </div>`;
}

function tribeShareNuggieModal(tribeId) {
    const creatures = window.appState?.creatures || [];
    if (!creatures.length) return alert('No creatures in My Nuggies to share.');
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:500px">
            <div class="modal-header">
                <h2 class="modal-title">🗄️ Share a Nuggie to Vault</h2>
                <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="nuggie-picker">
                    ${creatures.map(c => `
                    <div class="nuggie-pick-card" onclick="tribeShareNuggie(${tribeId},'${c.id}',this)">
                        <div class="nuggie-pick-name">${c.name||'Unnamed'}</div>
                        <div class="nuggie-pick-species">${c.species||'?'}</div>
                        <div class="nuggie-pick-stats">HP ${c.baseStats?.Health||0} · Mel ${c.baseStats?.Melee||0}</div>
                    </div>`).join('')}
                </div>
            </div>
        </div>`;
    document.body.appendChild(modal);
}
window.tribeShareNuggieModal = tribeShareNuggieModal;

async function tribeShareNuggie(tribeId, creatureId, el) {
    const creature = (window.appState?.creatures||[]).find(c => c.id === creatureId);
    if (!creature) return;
    const { res, body } = await apiRequest(`/api/tribes/${tribeId}/creatures`, {
        method: 'POST', body: JSON.stringify({ data: creature })
    });
    if (res.ok) {
        el.closest('.modal')?.remove();
        alert(`${creature.name} shared to the tribe vault!`);
    } else {
        alert(body?.error || 'Failed to share creature.');
    }
}
window.tribeShareNuggie = tribeShareNuggie;

async function loadJoinRequestsTab(tribeId) {
    const { body } = await apiRequest(`/api/tribes/${tribeId}`).catch(() => ({ body: null }));
    // No dedicated join-requests endpoint yet; placeholder
    return `<div class="tribe-empty" style="padding:32px 0">
        <div style="font-size:2rem;margin-bottom:12px">📬</div>
        <div style="color:#94a3b8">Join requests will appear here when players request to join your tribe.</div>
    </div>`;
}

function tribeShowTransferModal(tribeId) {
    const { body: tribe } = apiRequest(`/api/tribes/${tribeId}`).catch(() => ({ body: null }));
    const newOwner = prompt('Enter the user ID of the new owner:');
    if (!newOwner || isNaN(newOwner)) return;
    tribeTransferOwnership(tribeId, parseInt(newOwner));
}
window.tribeShowTransferModal = tribeShowTransferModal;

async function tribeTransferOwnership(tribeId, newOwnerId) {
    if (!confirm('Transfer tribe ownership? You will become an admin.')) return;
    const { res, body } = await apiRequest(`/api/tribes/${tribeId}/transfer`, {
        method: 'POST', body: JSON.stringify({ new_owner_user_id: newOwnerId })
    });
    if (res.ok) {
        alert('Ownership transferred.');
        loadTribesPage();
    } else {
        alert(body?.error || 'Failed to transfer ownership.');
    }
}
window.tribeTransferOwnership = tribeTransferOwnership;

async function tribeLeaveTribe(tribeId) {
    const myUserId = localStorage.getItem('userId');
    if (!confirm('Leave this tribe?')) return;
    const { res, body } = await apiRequest(`/api/tribes/${tribeId}/members/${myUserId}`, { method: 'DELETE' });
    if (res.ok) {
        loadTribesPage();
    } else {
        alert(body?.error || 'Failed to leave tribe. If you are the owner, transfer ownership first.');
    }
}
window.tribeLeaveTribe = tribeLeaveTribe;

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

// Friends page: full implementation lives in client/friends.js


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
    main.innerHTML = `<div class="std-page"><div style="color:#94a3b8;padding:40px 0">Loading profile...</div></div>`;

    // Fetch real profile + friends + trades in parallel
    const [profile, friends, trades, myOffers] = await Promise.all([
        apiRequest('/api/profile').then(r => r.body || {}).catch(() => ({})),
        apiRequest('/api/friends?status=accepted').then(r => Array.isArray(r.body) ? r.body : []).catch(() => []),
        apiRequest('/api/trades').then(r => Array.isArray(r.body) ? r.body : []).catch(() => []),
        apiRequest('/api/offers').then(r => Array.isArray(r.body) ? r.body : []).catch(() => [])
    ]);

    const myId = parseInt(localStorage.getItem('userId') || '0');
    const creatures = window.appState?.creatures || [];
    const db = window.SPECIES_DATABASE || {};
    const totalSpecies = Object.keys(db).length;
    const speciesOwned = new Set(creatures.map(c => c.species).filter(Boolean)).size;

    // Compute real badge stats from BadgeSystem
    let badgeCount = 0, bossReadyCount = 0, underdogCount = 0;
    if (window.BadgeSystem && typeof window.BadgeSystem.calculateAchievements === 'function') {
        creatures.forEach(c => {
            const ach = window.BadgeSystem.calculateAchievements(c) || [];
            if (ach.some(a => a.id === 'prized_bloodline')) badgeCount++;
            if (ach.some(a => a.id && a.id.startsWith('boss_'))) bossReadyCount++;
            if (ach.some(a => a.id && a.id.startsWith('underdog_'))) underdogCount++;
        });
    }

    // Top badges across all creatures (for achievements card)
    const topBadges = [];
    if (window.BadgeSystem && typeof window.BadgeSystem.calculateAchievements === 'function') {
        creatures.forEach(c => {
            const ach = window.BadgeSystem.calculateAchievements(c) || [];
            ach.forEach(a => topBadges.push({ ...a, creatureName: c.name || 'Unnamed', species: c.species || '' }));
        });
    }
    const tierOrder = { diamond: 0, titan: 0, gold: 1, alpha: 1, silver: 2, beta: 2, bronze: 3, gamma: 3 };
    topBadges.sort((a, b) => (tierOrder[a.tier] ?? 9) - (tierOrder[b.tier] ?? 9));

    // Collector badges (per full collection)
    const collectorBadges = (window.BadgeSystem && typeof window.BadgeSystem.calculateCollectorBadges === 'function')
        ? window.BadgeSystem.calculateCollectorBadges(creatures) : [];

    // Also count utility badges
    let utilityCount = 0;
    if (window.BadgeSystem && typeof window.BadgeSystem.calculateUtilityHarvester === 'function') {
        creatures.forEach(c => { if (window.BadgeSystem.calculateUtilityHarvester(c).length > 0) utilityCount++; });
    }

    // My trade listings + received offers
    const myListings = trades.filter(t => t.user_id === myId && t.status === 'open');
    const pendingOffers = myOffers.filter(o => o.status === 'pending');

    const joinedDate = profile.created_at
        ? new Date(profile.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
        : 'The Nursery';

    main.innerHTML = `
        <div class="std-page profile-page-wrap">

            <!-- Hero header -->
            <div class="profile-hero">
                <div class="profile-hero-avatar">🦕</div>
                <div class="profile-hero-info">
                    <h1 class="profile-hero-name">${profile.nickname || 'Trainer'}</h1>
                    <div class="profile-hero-sub">Dino Nuggie Trainer · Joined ${joinedDate}</div>
                    ${profile.tribe ? `<div class="profile-hero-tribe">🏛️ ${profile.tribe.name} <span style="color:#64748b;font-size:0.8rem">(${profile.tribe.role})</span></div>` : ''}
                    <div class="profile-hero-stats">
                        <div class="profile-hstat"><span class="profile-hstat-val">${creatures.length}</span><span class="profile-hstat-lbl">Nuggies</span></div>
                        <div class="profile-hstat"><span class="profile-hstat-val">${speciesOwned}/${totalSpecies}</span><span class="profile-hstat-lbl">Species</span></div>
                        <div class="profile-hstat"><span class="profile-hstat-val">${friends.length}</span><span class="profile-hstat-lbl">Friends</span></div>
                        <div class="profile-hstat"><span class="profile-hstat-val">${badgeCount}</span><span class="profile-hstat-lbl">Badges</span></div>
                    </div>
                </div>
            </div>

            <div class="profile-grid">

                <!-- Account Information -->
                <div class="profile-card">
                    <div class="profile-card-header">
                        <h3>👤 Account Information</h3>
                        <button class="btn btn-sm btn-secondary" onclick="profileEditModal()">Edit</button>
                    </div>
                    <div class="profile-info-list">
                        <div class="profile-info-row"><span class="pil-label">Email</span><span class="pil-val">${profile.email || '—'}</span></div>
                        <div class="profile-info-row"><span class="pil-label">Nickname</span><span class="pil-val">${profile.nickname || '—'}</span></div>
                        <div class="profile-info-row"><span class="pil-label">Discord</span><span class="pil-val">${profile.discord_name || 'Not set'}</span></div>
                        <div class="profile-info-row"><span class="pil-label">Joined</span><span class="pil-val">${joinedDate}</span></div>
                    </div>
                </div>

                <!-- Per-creature Badges -->
                <div class="profile-card">
                    <div class="profile-card-header"><h3>🏆 Creature Badges</h3></div>
                    ${topBadges.length === 0
                        ? `<div class="friends-empty">No badges yet. Add creatures with strong stats to earn them.</div>`
                        : `<div class="profile-badges-list">
                            ${topBadges.slice(0, 8).map(a => {
                                const bs = window.BadgeSystem;
                                const mockC = { baseStats:{}, mutations:{}, domesticLevels:{}, species:'', achievements:[a] };
                                // Use emojiFor indirectly via id/tier pattern
                                const tierEmoji = { diamond:'💎', titan:'💎', gold:'🥇', alpha:'🥇', silver:'🥈', beta:'🥈', bronze:'🥉', gamma:'🥉' }[a.tier] || '🏆';
                                const prefixEmoji = a.id && a.id.startsWith('util_') ? { util_yield:'⛏️', util_gatherer:'🌿', util_cargo:'📦', util_refinery:'🔥', util_gemstone:'💍' }[a.id] || '🔧' : '';
                                const displayEmoji = prefixEmoji ? prefixEmoji + tierEmoji : tierEmoji;
                                return `<div class="profile-badge-row">
                                    <span class="pb-icon">${displayEmoji}</span>
                                    <div class="pb-info">
                                        <div class="pb-name">${a.name}</div>
                                        <div class="pb-creature">${a.creatureName} · ${a.species}</div>
                                    </div>
                                </div>`;
                            }).join('')}
                            ${topBadges.length > 8 ? `<div class="friends-empty" style="text-align:center">+${topBadges.length - 8} more badges</div>` : ''}
                           </div>`
                    }
                </div>

                <!-- Collection Achievements (Collector badges) -->
                <div class="profile-card">
                    <div class="profile-card-header"><h3>🎖️ Collection Achievements</h3></div>
                    ${collectorBadges.length === 0
                        ? `<div class="friends-empty">Keep collecting — these unlock at 5 combat, 3 harvesting, or 3 transport creatures.</div>`
                        : `<div class="profile-badges-list">
                            ${collectorBadges.map(a => {
                                const trackEmoji = a.id.startsWith('collector_boss_slayer') ? '🗡️'
                                    : a.id.startsWith('collector_harvester') ? '🪓' : '🗺️';
                                const tierEmoji = { diamond:'💎', gold:'🥇', silver:'🥈', bronze:'🥉' }[a.tier] || '🏆';
                                return `<div class="profile-badge-row">
                                    <span class="pb-icon">${trackEmoji}${tierEmoji}</span>
                                    <div class="pb-info">
                                        <div class="pb-name">${a.name}</div>
                                        <div class="pb-creature">${a.meta?.count || 0} qualifying creatures</div>
                                    </div>
                                </div>`;
                            }).join('')}
                           </div>`
                    }
                </div>

                <!-- Friends -->
                <div class="profile-card">
                    <div class="profile-card-header">
                        <h3>👥 Friends</h3>
                        <button class="btn btn-sm btn-secondary" onclick="loadFriendsPage()">Manage</button>
                    </div>
                    ${friends.length === 0
                        ? `<div class="friends-empty">No friends yet.</div>`
                        : `<div class="profile-friends-list">
                            ${friends.slice(0, 5).map(f => `
                            <div class="profile-friend-row">
                                <div class="profile-friend-avatar">👤</div>
                                <div class="profile-friend-name">${f.friend_nickname || f.friend_email || 'Friend'}</div>
                            </div>`).join('')}
                            ${friends.length > 5 ? `<div class="friends-empty">+${friends.length - 5} more</div>` : ''}
                           </div>`
                    }
                </div>

                <!-- Active Trades -->
                <div class="profile-card">
                    <div class="profile-card-header">
                        <h3>🔁 Active Trades</h3>
                        <button class="btn btn-sm btn-secondary" onclick="loadTradingPage()">View All</button>
                    </div>
                    <div class="profile-info-list">
                        <div class="profile-info-row"><span class="pil-label">Your listings</span><span class="pil-val">${myListings.length}</span></div>
                        <div class="profile-info-row"><span class="pil-label">Offers sent</span><span class="pil-val">${pendingOffers.length} pending</span></div>
                    </div>
                    ${myListings.slice(0, 3).map(t => `
                    <div class="profile-trade-row">
                        <span class="pil-label">${t.creature?.name || 'Unnamed'} <em style="color:#64748b">${t.creature?.species||''}</em></span>
                        <span class="friend-status-tag accepted">Open</span>
                    </div>`).join('')}
                </div>

                <!-- Statistics -->
                <div class="profile-card">
                    <div class="profile-card-header"><h3>📊 Statistics</h3></div>
                    <div class="profile-stats-grid">
                        <div class="profile-stat-block"><div class="psb-val">${creatures.length}</div><div class="psb-lbl">🦖 Total Nuggies</div></div>
                        <div class="profile-stat-block"><div class="psb-val">${speciesOwned}</div><div class="psb-lbl">🌿 Species Owned</div></div>
                        <div class="profile-stat-block"><div class="psb-val">${badgeCount}</div><div class="psb-lbl">🏆 Prized Bloodlines</div></div>
                        <div class="profile-stat-block"><div class="psb-val">${bossReadyCount}</div><div class="psb-lbl">👑 Boss Ready</div></div>
                        <div class="profile-stat-block"><div class="psb-val">${underdogCount}</div><div class="psb-lbl">🥊 Underdogs</div></div>
                        <div class="profile-stat-block"><div class="psb-val">${utilityCount}</div><div class="psb-lbl">⛏️ Utility Badges</div></div>
                        <div class="profile-stat-block"><div class="psb-val">${myListings.length}</div><div class="psb-lbl">🔁 Active Listings</div></div>
                    </div>
                </div>

                <!-- Account Settings -->
                <div class="profile-card">
                    <div class="profile-card-header"><h3>⚙️ Account Settings</h3></div>
                    <div class="profile-settings-list">
                        <button class="profile-setting-btn" onclick="profileEditModal()">
                            <span>✏️ Edit Profile</span><span>→</span>
                        </button>
                        <button class="profile-setting-btn" onclick="profileChangePassword()">
                            <span>🔒 Change Password</span><span>→</span>
                        </button>
                        <button class="profile-setting-btn danger" onclick="profileDeleteAccount()">
                            <span>🗑️ Delete Account</span><span>→</span>
                        </button>
                    </div>
                </div>

            </div>
        </div>`;
}

// ── Edit Profile modal ────────────────────────────────────────────────────────
function profileEditModal() {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    const email = localStorage.getItem('userEmail') || '';
    const nick = localStorage.getItem('userNickname') || '';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:440px">
            <div class="modal-header">
                <h2 class="modal-title">✏️ Edit Profile</h2>
                <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="modal-body" style="display:flex;flex-direction:column;gap:14px">
                <div class="plan-field">
                    <label class="form-label">Nickname</label>
                    <input id="editNick" class="form-control" value="${nick}" placeholder="Display name">
                </div>
                <div class="plan-field">
                    <label class="form-label">Email</label>
                    <input id="editEmail" class="form-control" type="email" value="${email}">
                </div>
                <div class="plan-field">
                    <label class="form-label">Discord Username</label>
                    <input id="editDiscord" class="form-control" placeholder="your_discord_name">
                </div>
                <div id="editProfileError" style="color:#ef4444;font-size:0.85rem;display:none"></div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                <button class="btn btn-primary" onclick="profileSubmitEdit()">Save Changes</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
}
window.profileEditModal = profileEditModal;

async function profileSubmitEdit() {
    const nickname = document.getElementById('editNick')?.value.trim();
    const email = document.getElementById('editEmail')?.value.trim();
    const discord_name = document.getElementById('editDiscord')?.value.trim() || null;
    const errEl = document.getElementById('editProfileError');
    if (!nickname) { if (errEl) { errEl.textContent = 'Nickname is required.'; errEl.style.display = 'block'; } return; }
    if (!email || !email.includes('@')) { if (errEl) { errEl.textContent = 'Valid email is required.'; errEl.style.display = 'block'; } return; }
    const { res, body } = await apiRequest('/api/profile', { method: 'PUT', body: JSON.stringify({ nickname, email, discord_name }) });
    if (res.ok) {
        localStorage.setItem('userNickname', nickname);
        localStorage.setItem('userEmail', email);
        document.querySelector('.modal.active')?.remove();
        loadMyProfilePage();
    } else {
        if (errEl) { errEl.textContent = body?.error || 'Failed to save.'; errEl.style.display = 'block'; }
    }
}
window.profileSubmitEdit = profileSubmitEdit;

// ── Change Password modal ─────────────────────────────────────────────────────
function profileChangePassword() {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:400px">
            <div class="modal-header">
                <h2 class="modal-title">🔒 Change Password</h2>
                <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="modal-body" style="display:flex;flex-direction:column;gap:14px">
                <div class="plan-field">
                    <label class="form-label">Current Password</label>
                    <input id="pwCurrent" class="form-control" type="password">
                </div>
                <div class="plan-field">
                    <label class="form-label">New Password</label>
                    <input id="pwNew" class="form-control" type="password" placeholder="Minimum 6 characters">
                </div>
                <div class="plan-field">
                    <label class="form-label">Confirm New Password</label>
                    <input id="pwConfirm" class="form-control" type="password">
                </div>
                <div id="pwError" style="color:#ef4444;font-size:0.85rem;display:none"></div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                <button class="btn btn-primary" onclick="profileSubmitPassword()">Change Password</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
}
window.profileChangePassword = profileChangePassword;

async function profileSubmitPassword() {
    const current = document.getElementById('pwCurrent')?.value;
    const newPw = document.getElementById('pwNew')?.value;
    const confirm = document.getElementById('pwConfirm')?.value;
    const errEl = document.getElementById('pwError');
    const showErr = msg => { if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; } };
    if (!current || !newPw || !confirm) return showErr('All fields are required.');
    if (newPw.length < 6) return showErr('New password must be at least 6 characters.');
    if (newPw !== confirm) return showErr('Passwords do not match.');
    const { res, body } = await apiRequest('/api/profile/password', { method: 'PUT', body: JSON.stringify({ current_password: current, new_password: newPw }) });
    if (res.ok) { document.querySelector('.modal.active')?.remove(); alert('Password changed successfully!'); }
    else showErr(body?.error || 'Failed to change password.');
}
window.profileSubmitPassword = profileSubmitPassword;

// ── Delete Account ────────────────────────────────────────────────────────────
function profileDeleteAccount() {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:400px">
            <div class="modal-header">
                <h2 class="modal-title" style="color:#ef4444">🗑️ Delete Account</h2>
                <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="modal-body" style="display:flex;flex-direction:column;gap:14px">
                <div style="background:#1a0a0a;border:1px solid #7f1d1d;border-radius:8px;padding:14px;color:#fca5a5;font-size:0.9rem;line-height:1.5">
                    ⚠️ This will <strong>permanently delete</strong> your account, all your Nuggies, trade listings, tribe memberships, and friend connections. This cannot be undone.
                </div>
                <div class="plan-field">
                    <label class="form-label">Enter your password to confirm</label>
                    <input id="deletePassword" class="form-control" type="password" placeholder="Your password">
                </div>
                <div id="deleteError" style="color:#ef4444;font-size:0.85rem;display:none"></div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                <button class="btn btn-danger" onclick="profileSubmitDelete()">Delete Forever</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
}
window.profileDeleteAccount = profileDeleteAccount;

async function profileSubmitDelete() {
    const password = document.getElementById('deletePassword')?.value;
    const errEl = document.getElementById('deleteError');
    if (!password) { if (errEl) { errEl.textContent = 'Password required.'; errEl.style.display = 'block'; } return; }
    const { res, body } = await apiRequest('/api/profile', { method: 'DELETE', body: JSON.stringify({ password }) });
    if (res.ok) {
        document.querySelector('.modal.active')?.remove();
        localStorage.clear();
        window.appState = {};
        showLoginPage();
    } else {
        if (errEl) { errEl.textContent = body?.error || 'Failed to delete account.'; errEl.style.display = 'block'; }
    }
}
window.profileSubmitDelete = profileSubmitDelete;

// Legacy stubs kept to avoid ReferenceErrors from any old references
function loadFriendsPreview() {}
function loadTradesPreview() {}
function editAccountInfo() { profileEditModal(); }
function changePassword() { profileChangePassword(); }
function deleteAccount() { profileDeleteAccount(); }
function notificationSettings() { alert('Notification settings coming soon!'); }
function privacySettings() { alert('Privacy settings coming soon!'); }

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
        const badges = (window.BadgeSystem && typeof window.BadgeSystem.calculateAchievements === 'function')
            ? (window.BadgeSystem.calculateAchievements(creature) || [])
            : [];
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
                            <div class="stat-fill" style="width: ${Math.min(100, (creature.baseStats?.Health || 0) * 2)}%"></div>
                        </div>
                        <span class="stat-value">${creature.baseStats?.Health || 0}</span>
                    </div>
                    <div class="stat-bar">
                        <span class="stat-label">Melee</span>
                        <div class="stat-progress">
                            <div class="stat-fill" style="width: ${Math.min(100, (creature.baseStats?.Melee || 0) * 2)}%"></div>
                        </div>
                        <span class="stat-value">${creature.baseStats?.Melee || 0}</span>
                    </div>
                </div>
                
                <div class="creature-badges">
                    ${(window.BadgeSystem && typeof window.BadgeSystem.generateBadgeHTML === 'function') ? window.BadgeSystem.generateBadgeHTML(creature) : ''}
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
    
    if (badgeFilter && window.BadgeSystem && typeof window.BadgeSystem.calculateAchievements === 'function') {
        creatures = creatures.filter(c => {
            const badges = window.BadgeSystem.calculateAchievements(c) || [];
            if (badgeFilter === 'prized') return badges.some(b => b.id === 'prized_bloodline');
            if (badgeFilter === 'boss-ready') return badges.some(b => b.id && b.id.startsWith('boss_'));
            if (badgeFilter === 'boss-underdog') return badges.some(b => b.id && b.id.startsWith('underdog_'));
            return false;
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
function addNewCreature(speciesName) {
    if (typeof window.openCreatureModal === 'function') {
        try { window.appState.currentSpecies = speciesName || null; } catch (e) {}
        window.openCreatureModal(null);
    }
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
// Trading page functions exported inline above; Friends functions in client/friends.js

// Boss Planner Implementation
async function loadBossPlanner() {
    setActiveNavButton('boss');
    const main = document.getElementById('appMainContent');
    if (!main) return;

    // Load saved plans if not already loaded
    if (!window.appState?.bossPlans) await loadServerBossData();
    const plans = window.appState?.bossPlans || [];

    const templates = getBossTemplates();
    const maps = [...new Set(templates.map(t => t.map))].sort();

    function renderCards(filter) {
        const search = (filter.search || '').toLowerCase();
        const mapF = filter.map || '';
        return templates
            .filter(t =>
                (!search || t.name.toLowerCase().includes(search) || t.map.toLowerCase().includes(search)) &&
                (!mapF || t.map === mapF)
            )
            .map(t => {
                const plan = plans.find(p => p.bossId === t.id);
                const hasPlan = !!plan;
                const diff = plan?.difficulty || '';
                const diffColor = { gamma: '#22c55e', beta: '#3b82f6', alpha: '#ef4444' }[diff] || '';
                const diffLabel = { gamma: 'Gamma', beta: 'Beta', alpha: 'Alpha' }[diff] || '';
                return `
                <div class="boss-planning-card" onclick="openBossPlanning('${t.id}')">
                    <div class="boss-card-header">
                        <div class="boss-card-icon">${t.icon}</div>
                        <div class="boss-card-title">
                            <div class="boss-card-name">${t.name}</div>
                            <div class="boss-card-sub">${t.type}</div>
                        </div>
                        ${hasPlan ? `<div class="boss-planned-dot" title="${diffLabel} planned">✓</div>` : ''}
                    </div>
                    <div class="boss-card-tags">
                        <span class="boss-tag map">${t.map}</span>
                        ${hasPlan && diffLabel ? `<span class="boss-tag diff" style="border-color:${diffColor};color:${diffColor}">${diffLabel}</span>` : ''}
                    </div>
                    <div class="boss-card-desc">${t.description || t.strategy}</div>
                    <div class="boss-card-footer">
                        <span class="click-hint">${hasPlan ? '✏️ Edit plan' : '📋 Plan fight'}</span>
                    </div>
                </div>`;
            }).join('') || '<div class="no-results">No bosses match your filters.</div>';
    }

    const mapOpts = [{ v: '', l: 'All Maps' }, ...maps.map(m => ({ v: m, l: m }))];

    main.innerHTML = `
        <div class="std-page">
            <div class="std-page-header">
                <div class="page-title">
                    <h1>👑 Boss Planner</h1>
                    <div class="page-subtitle">${templates.length} bosses · ${plans.length} planned</div>
                </div>
            </div>
            <div class="std-filters">
                <input id="bossSearchInput" class="form-control search-input" placeholder="🔍 Search bosses or maps...">
                ${mkSelect('bossMapFilter', mapOpts, '', 'All Maps')}
            </div>
            <div id="bossCardGrid" class="boss-template-grid">
                ${renderCards({})}
            </div>
        </div>
    `;

    const searchEl = document.getElementById('bossSearchInput');
    const grid = document.getElementById('bossCardGrid');
    function refresh() {
        const map = document.getElementById('csel_bossMapFilter')?.dataset.val || '';
        grid.innerHTML = renderCards({ search: searchEl.value, map });
    }
    searchEl.addEventListener('input', refresh);
    document.getElementById('csel_bossMapFilter')?.addEventListener('cselchange', refresh);
}

function openBossPlanning(bossId) {
    const template = getBossTemplates().find(t => t.id === bossId);
    if (!template) return;
    const main = document.getElementById('appMainContent');
    if (!main) return;

    const plans = window.appState?.bossPlans || [];
    const existing = plans.find(p => p.bossId === bossId) || {};
    const selectedIds = new Set(existing.creatureIds || []);

    const creatures = window.appState?.creatures || [];

    const CONSUMABLES = [
        { key: 'stimulants',       label: '💊 Stimulants' },
        { key: 'medicalBrew',      label: '🧪 Medical Brew' },
        { key: 'battleTartare',    label: '🥩 Battle Tartare' },
        { key: 'shadowSteak',      label: '🌑 Shadow Steak Saute' },
        { key: 'lazarusChowder',   label: '🍲 Lazarus Chowder' },
        { key: 'focalChili',       label: '🌶️ Focal Chili' },
        { key: 'sweetVeggieCake',  label: '🎂 Sweet Veggie Cake' },
    ];
    const savedCons = existing.consumables || {};

    main.innerHTML = `
        <div class="boss-planning-page">
            <div class="boss-planning-header">
                <button class="btn btn-secondary back-btn" onclick="loadBossPlanner()">← Back</button>
                <div class="boss-info">
                    <h1>${template.name}</h1>
                    <div class="boss-meta">
                        <span class="boss-map-tag">${template.map}</span>
                        <span class="boss-type-tag">${template.type}</span>
                    </div>
                    <p class="boss-description">${template.description}</p>
                    <div class="boss-strategy-hint"><strong>Tip:</strong> ${template.strategy}</div>
                </div>
            </div>

            <div class="planning-sections">

                <!-- FIGHT PLAN -->
                <div class="planning-section">
                    <div class="section-header"><h3>📋 Fight Plan</h3></div>
                    <div class="plan-fields">
                        <div class="plan-row">
                            <div class="plan-field">
                                <label class="form-label">Difficulty</label>
                                <select id="bp-difficulty" class="form-control">
                                    <option value="gamma" ${existing.difficulty==='gamma'?'selected':''}>🟢 Gamma (Easy)</option>
                                    <option value="beta"  ${existing.difficulty==='beta' ?'selected':''}>🔵 Beta (Medium)</option>
                                    <option value="alpha" ${existing.difficulty==='alpha'?'selected':''}>🔴 Alpha (Hard)</option>
                                </select>
                            </div>
                            <div class="plan-field">
                                <label class="form-label">Scheduled Date & Time</label>
                                <input id="bp-schedule" type="datetime-local" class="form-control" value="${existing.scheduledAt || ''}">
                            </div>
                        </div>
                        <div class="plan-field" style="margin-top:12px">
                            <label class="form-label">Tactics & Notes</label>
                            <textarea id="bp-notes" class="form-control" rows="4" placeholder="Strategy, timing, positioning, roles...">${existing.notes || ''}</textarea>
                        </div>
                        <div class="plan-field" style="margin-top:12px">
                            <label class="form-label">Other Supplies & Notes</label>
                            <textarea id="bp-other" class="form-control" rows="2" placeholder="Artifacts needed, hazmat suits, gas masks, saddle requirements...">${existing.otherSupplies || ''}</textarea>
                        </div>
                    </div>
                </div>

                <!-- CONSUMABLES -->
                <div class="planning-section">
                    <div class="section-header"><h3>🎒 Consumables</h3></div>
                    <div class="consumables-grid">
                        ${CONSUMABLES.map(c => `
                        <div class="consumable-item">
                            <label class="form-label">${c.label}</label>
                            <input id="bp-con-${c.key}" type="number" class="form-control" min="0" placeholder="0" value="${savedCons[c.key] || ''}">
                        </div>`).join('')}
                    </div>
                </div>

                <!-- CREATURE LINEUP -->
                <div class="planning-section">
                    <div class="section-header">
                        <h3>🦖 Creature Lineup</h3>
                        <span class="lineup-count" id="bp-lineup-count">${selectedIds.size} selected</span>
                    </div>
                    ${creatures.length === 0
                        ? `<div class="empty-lineup-msg">You have no saved Nuggies yet. Add creatures from the Creatures page first.</div>`
                        : `<div class="nuggie-picker" id="bp-nuggie-picker">
                            ${creatures.map(c => {
                                const sel = selectedIds.has(c.id);
                                const hp = c.baseStats?.Health || 0;
                                const mel = c.baseStats?.Melee || 0;
                                return `
                                <div class="nuggie-pick-card ${sel ? 'selected' : ''}" data-cid="${c.id}" onclick="bpToggleCreature('${c.id}')">
                                    <div class="nuggie-pick-name">${c.name || 'Unnamed'}</div>
                                    <div class="nuggie-pick-species">${c.species || '?'}</div>
                                    <div class="nuggie-pick-stats">HP ${hp} · Mel ${mel}</div>
                                    ${sel ? '<div class="nuggie-pick-check">✓</div>' : ''}
                                </div>`;
                            }).join('')}
                           </div>`
                    }
                    <div class="lineup-selected" id="bp-lineup-list">
                        ${renderLineupList(selectedIds, creatures)}
                    </div>
                </div>

            </div>

            <div class="plan-save-bar">
                <span id="bp-save-status" class="save-status">${existing.savedAt ? `Last saved ${new Date(existing.savedAt).toLocaleString()}` : 'Not saved yet'}</span>
                <button class="btn btn-primary btn-lg" onclick="saveFightPlan('${bossId}')">💾 Save Plan</button>
            </div>
        </div>
    `;

    setActiveNavButton('boss');
}

function renderLineupList(selectedIds, creatures) {
    const selected = creatures.filter(c => selectedIds.has(c.id));
    if (!selected.length) return '<div class="lineup-empty-hint">No creatures selected yet — click cards above to add them.</div>';
    return `<div class="lineup-summary">
        ${selected.map(c => `<span class="lineup-chip">${c.name || 'Unnamed'} <em>${c.species || ''}</em></span>`).join('')}
    </div>`;
}

window._bpSelectedIds = new Set();
function bpToggleCreature(creatureId) {
    const card = document.querySelector(`.nuggie-pick-card[data-cid="${creatureId}"]`);
    if (!card) return;
    const sel = card.classList.toggle('selected');
    if (sel) {
        card.insertAdjacentHTML('beforeend', '<div class="nuggie-pick-check">✓</div>');
    } else {
        card.querySelector('.nuggie-pick-check')?.remove();
    }
    const picker = document.getElementById('bp-nuggie-picker');
    const allSelected = new Set([...picker.querySelectorAll('.nuggie-pick-card.selected')].map(el => el.dataset.cid));
    document.getElementById('bp-lineup-count').textContent = `${allSelected.size} selected`;
    document.getElementById('bp-lineup-list').innerHTML = renderLineupList(allSelected, window.appState?.creatures || []);
}
window.bpToggleCreature = bpToggleCreature;

async function saveFightPlan(bossId) {
    const statusEl = document.getElementById('bp-save-status');
    if (statusEl) statusEl.textContent = 'Saving...';

    const picker = document.getElementById('bp-nuggie-picker');
    const creatureIds = picker
        ? [...picker.querySelectorAll('.nuggie-pick-card.selected')].map(el => el.dataset.cid)
        : [];

    const CONSUMABLE_KEYS = ['stimulants','medicalBrew','battleTartare','shadowSteak','lazarusChowder','focalChili','sweetVeggieCake'];
    const consumables = {};
    CONSUMABLE_KEYS.forEach(k => {
        const val = parseInt(document.getElementById(`bp-con-${k}`)?.value);
        if (val > 0) consumables[k] = val;
    });

    const plan = {
        bossId,
        difficulty: document.getElementById('bp-difficulty')?.value || 'gamma',
        scheduledAt: document.getElementById('bp-schedule')?.value || '',
        notes: document.getElementById('bp-notes')?.value || '',
        otherSupplies: document.getElementById('bp-other')?.value || '',
        creatureIds,
        consumables,
        savedAt: new Date().toISOString()
    };

    const plans = window.appState?.bossPlans || [];
    const idx = plans.findIndex(p => p.bossId === bossId);
    if (idx >= 0) plans[idx] = plan; else plans.push(plan);
    window.appState = window.appState || {};
    window.appState.bossPlans = plans;

    try {
        const { res } = await apiRequest('/api/bosses', { method: 'PUT', body: JSON.stringify(plans) });
        if (statusEl) statusEl.textContent = res.ok ? `Saved ${new Date().toLocaleTimeString()}` : 'Save failed — check connection';
    } catch (e) {
        if (statusEl) statusEl.textContent = 'Save failed';
    }
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

// Modal cleanup function to prevent UI bugs during navigation
function cleanupModals() {
    // Close creatures.js managed modals via their close functions
    if (typeof window.closeCreatureModal === 'function') window.closeCreatureModal();
    // Deactivate any other .modal overlays without removing them from the DOM
    document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
    // Remove old-style modal-overlay elements that were dynamically injected (not managed)
    document.querySelectorAll('.modal-overlay').forEach(m => {
        if (!m.id || (m.id !== 'creatureModal' && m.id !== 'creatureDetailModal')) m.remove();
    });
}

// Boss template system based on ASA Boss Guide
function _deriveBossType(species) {
    const check = [
        species.primaryRole || '',
        species.dossierText || '',
        species.source || ''
    ].join(' ').toLowerCase();
    if (check.includes('world boss'))         return 'World Boss';
    if (check.includes('master ai'))          return 'Master AI';
    if (check.includes('overseer'))           return 'Overseer';
    if (check.includes('titan') && !check.includes('titanosaur')) return 'Titan';
    if (check.includes('guardian'))           return 'Guardian';
    if (check.includes('duo') || check.includes('duo miniboss')) return 'Duo Boss';
    if (check.includes('miniboss') || check.includes('mini-boss')) return 'Miniboss';
    if (check.includes('event'))              return 'Event Boss';
    if (check.includes('ascension'))          return 'Ascension';
    return 'Boss';
}

function _deriveBossStrategy(species) {
    const mechanics = (species.uniqueMechanics || []).filter(m =>
        m && m !== 'None' && m.length > 10
    );
    const debuffs = (species.debuffAbilities || []).filter(d =>
        d && d !== 'None' && d !== 'none'
    );
    if (mechanics.length > 0) return mechanics[0];
    if (debuffs.length > 0) return 'Watch for: ' + debuffs[0];
    if (species.primaryRole) return species.primaryRole;
    return 'See species detail for full encounter info.';
}

function getBossTemplates() {
    const db = (typeof window !== 'undefined' && window.SPECIES_DATABASE) || {};
    const templates = [];
    for (const [name, species] of Object.entries(db)) {
        if (species.category !== 'boss') continue;
        const map = (species.spawnMaps && species.spawnMaps[0]) || 'Unknown';
        templates.push({
            id: (species.id || name).toString().toLowerCase().replace(/[^a-z0-9]+/g, '_'),
            name: species.name || name,
            map: map,
            type: _deriveBossType(species),
            icon: species.icon || '💀',
            rarity: species.rarity || 'Legendary',
            description: (species.dossierText || '').slice(0, 120) + ((species.dossierText || '').length > 120 ? '…' : ''),
            strategy: _deriveBossStrategy(species)
        });
    }
    templates.sort((a, b) => {
        if (a.map !== b.map) return a.map.localeCompare(b.map);
        return a.name.localeCompare(b.name);
    });
    return templates;
}
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

// --- Custom dropdown (replaces native <select> to avoid white-on-white on Windows) ---
// mkSelect(id, options, selected, placeholder)
// options = [{v: 'value', l: 'Label'}, ...]
// Listen for cselchange events on the wrapper div for value changes.
function mkSelect(id, opts, selected, placeholder) {
    const selOpt = opts.find(o => o.v === selected);
    const label = selOpt ? selOpt.l : (placeholder || 'Select...');
    return `<div class="csel" id="csel_${id}" data-val="${escAttr(selected)}">
        <div class="csel-btn" onclick="cselOpen('${id}')">
            <span class="csel-label" id="csel_lbl_${id}">${label}</span>
            <svg class="csel-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div class="csel-list" id="csel_list_${id}">
            ${opts.map(o => `<div class="csel-opt${o.v === selected ? ' sel' : ''}" onclick="cselPick('${id}','${escAttr(o.v)}',this)">${o.l}</div>`).join('')}
        </div>
    </div>`;
}
function escAttr(s) { return String(s || '').replace(/'/g, '&#39;').replace(/"/g, '&quot;'); }
function cselOpen(id) {
    const list = document.getElementById(`csel_list_${id}`);
    if (!list) return;
    const isOpen = list.classList.contains('open');
    document.querySelectorAll('.csel-list.open').forEach(l => l.classList.remove('open'));
    if (!isOpen) list.classList.add('open');
}
function cselPick(id, val, optEl) {
    const wrap = document.getElementById(`csel_${id}`);
    if (!wrap) return;
    wrap.dataset.val = val;
    const lbl = document.getElementById(`csel_lbl_${id}`);
    if (lbl) lbl.textContent = optEl.textContent.trim();
    document.getElementById(`csel_list_${id}`)?.classList.remove('open');
    wrap.querySelectorAll('.csel-opt').forEach(o => o.classList.remove('sel'));
    optEl.classList.add('sel');
    wrap.dispatchEvent(new CustomEvent('cselchange', { bubbles: true, detail: { id, val } }));
}
document.addEventListener('click', e => {
    if (!e.target.closest('.csel')) document.querySelectorAll('.csel-list.open').forEach(l => l.classList.remove('open'));
});
window.mkSelect = mkSelect;
window.cselOpen = cselOpen;
window.cselPick = cselPick;

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
		// Always try to parse as JSON first if we have content
		if (raw && raw.trim()) {
			try {
				body = JSON.parse(raw);
			} catch (parseError) {
				// If JSON parsing fails, keep as raw text
				console.warn('[SPA] JSON parse failed for response:', parseError.message, 'Raw response:', raw.slice(0, 500));
				body = raw;
			}
		} else {
			body = raw; // Empty response
		}
	} catch (e) {
		console.warn('[SPA] Response processing error:', e);
		body = raw;
	}

	// Only warn for non-ok responses or when login/register returned an unexpected empty body.
	const authEmpty = (path === '/api/login' || path === '/api/register') && 
		(body === null || body === undefined || body === '' || 
		 (typeof body === 'string' && body.trim() === '') ||
		 (typeof body === 'object' && Object.keys(body || {}).length === 0));
	if (!res.ok || authEmpty) {
		try {
			console.warn('[SPA] apiRequest response', { 
				url, 
				method, 
				status: res.status, 
				statusText: res.statusText,
				ok: res.ok,
				contentType: ct, 
				rawResponse: raw,
				parsedBody: body,
				bodyPreview: (raw || '').slice(0,1000),
				responseHeaders: Object.fromEntries(res.headers.entries())
			});
		} catch (e) {}
	}
	return { res, body };
}

function getCreatureStorageKey() {
	const userId = localStorage.getItem('userId') || 'local';
	return `creatures_${userId}`;
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

async function loadServerBossData() {
    try {
        const { res, body } = await apiRequest('/api/bosses', { method: 'GET' });
        if (res.ok && Array.isArray(body)) {
            window.appState = window.appState || {};
            window.appState.bossPlans = body;
        }
    } catch (e) { console.warn('loadServerBossData failed', e); }
}

async function loadServerArenaCollections() {
    // Placeholder - arena collections loading will be implemented later  
    console.log('loadServerArenaCollections called (placeholder)');
}

function updateAuthUI() {
    // Update authentication-related UI elements
    const token = localStorage.getItem('token');
    const isAuthenticated = !!(token && window.appState?.authenticated);
    
    try {
        // Update any auth-dependent UI elements here
        console.log('updateAuthUI: User is', isAuthenticated ? 'authenticated' : 'not authenticated');
        
        // You can add specific UI updates here based on auth state
        // For example, show/hide login forms, update user info displays, etc.
        
    } catch (e) {
        console.warn('updateAuthUI failed:', e);
    }
}

// Add logout functionality
function logout() {
    try {
        // Clear all stored authentication data
        localStorage.removeItem('token');
        localStorage.removeItem('userId');
        localStorage.removeItem('userEmail');
        localStorage.removeItem('userNickname');
        
        // Clear app state
        if (window.appState) {
            window.appState.authenticated = false;
            window.appState.creatures = [];
        }
        
        // Reload the page to reset to login state
        window.location.reload();
    } catch (e) {
        console.error('Logout failed:', e);
    }
}

// Check if the current token is still valid by making a test API call
async function validateAuthToken() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.appState.authenticated = false;
        return false;
    }
    
    try {
        // Try to fetch user profile as a token validation check
        const { res } = await apiRequest('/api/profile', { method: 'GET' });
        if (res.ok) {
            window.appState.authenticated = true;
            return true;
        } else {
            // Token is invalid, clear it
            console.warn('Token validation failed, clearing authentication');
            logout();
            return false;
        }
    } catch (e) {
        console.warn('Token validation error:', e);
        // On network error, assume token is still valid but just can't reach server
        return true;
    }
}

window.loadServerBossData = loadServerBossData;
window.loadServerArenaCollections = loadServerArenaCollections;
window.updateAuthUI = updateAuthUI;
window.logout = logout;
window.validateAuthToken = validateAuthToken;

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
    setActiveNavButton('creatures');
    try {
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
        const speciesData = window.SPECIES_DATABASE || {};
        if (!Object.keys(speciesData).length) {
            main.innerHTML = '<div class="error">No species data available.</div>';
            return;
        }

        // Render the modern species page with the same structure as boss planner
        main.innerHTML = `
            <div class="species-page">
                <div class="species-header">
                    <div class="page-title">
                        <h1>🦖 Creature Database</h1>
                        <div class="species-count">Browse ${Object.keys(speciesData).length} available species</div>
                    </div>
                    <div class="header-actions">
                        <button class="btn btn-secondary" onclick="exportSpeciesData()">📤 Export Data</button>
                        <button class="btn btn-secondary" onclick="speciesCalculator()">🧮 Stats Calculator</button>
                    </div>
                </div>
                
                <div class="species-filters-section">
                    <div class="filter-group">
                        <input id="searchInput" class="form-control search-input" placeholder="🔍 Search species by name, category, or diet...">
                    </div>
                    <div class="filter-group" id="speciesFilterSelects">
                        <span class="filter-placeholder">Loading filters...</span>
                        <button id="clearFiltersBtn" class="btn btn-secondary">Clear</button>
                    </div>
                </div>
                
                <div id="speciesGrid" class="species-template-grid" aria-live="polite"></div>
            </div>
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

    // Build and inject custom dropdowns now that we have the data
    const catOpts = [{ v: '', l: 'All Categories' }, ...Array.from(categories).sort().map(c => ({ v: c, l: capitalize(c) }))];
    const canonicalRarities = ['common','uncommon','rare','very rare','unique','extinct'].filter(r => rarities.has(r));
    const rarOpts = [{ v: '', l: 'All Rarities' }, ...canonicalRarities.map(r => ({ v: r, l: capitalize(r) }))];

    const filterSelects = document.getElementById('speciesFilterSelects');
    if (filterSelects) {
        filterSelects.innerHTML = mkSelect('categoryFilter', catOpts, '', 'All Categories') +
                                  mkSelect('rarityFilter', rarOpts, '', 'All Rarities') +
                                  `<button id="clearFiltersBtn" class="btn btn-secondary">Clear</button>`;
    }

    // Set up filtering functionality
    function filterSpecies() {
        const speciesGrid = document.getElementById('speciesGrid');
        if (!speciesGrid || !speciesData) {
            speciesGrid.innerHTML = '<div class="no-species-found">Species database unavailable.</div>';
            return;
        }

        const searchTerm = (document.getElementById('searchInput')?.value || '').toLowerCase();
        const category = (document.getElementById('csel_categoryFilter')?.dataset.val || '').toLowerCase();
        const rarity = (document.getElementById('csel_rarityFilter')?.dataset.val || '').toLowerCase();

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

        // Use modern boss-card style layout for species cards
        speciesGrid.innerHTML = filteredSpecies.length ? filteredSpecies.map(species => {
            // Get creature count for this species
            const creatureCount = window.appState?.creatures?.filter(c => c.species === species.name).length || 0;
            
            // Determine the strongest role/use case
            const primaryUse = species.primaryRole || 'Multi-purpose';
            
            // Create rating badges based on highest stats
            const topRatings = [];
            if (species.ratings) {
                const ratings = Object.entries(species.ratings)
                    .filter(([key, value]) => value && value >= 7)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 2);
                topRatings.push(...ratings.map(([key, value]) => `${key.charAt(0).toUpperCase() + key.slice(1)}: ${value}/10`));
            }
            
            // Determine if this species is good for beginners
            const isBeginnerFriendly = species.difficulty === 'Easy' || species.category === 'Common' || 
                (species.ratings && species.ratings.survivability >= 6);
            
            return `
                <div class="species-planning-card" onclick="openSpeciesDetail('${species.name}')">
                    <div class="template-header">
                        <div class="species-card-icon">${species.icon || '🦖'}</div>
                        <div>
                            <h4>${species.name}</h4>
                            <span class="template-map">${species.category || 'Unknown'} • ${species.rarity || 'Common'}</span>
                        </div>
                    </div>
                    <div class="template-type">${primaryUse}</div>
                    <div class="template-description">${species.description ? (species.description.length > 100 ? species.description.substring(0, 100) + '...' : species.description) : 'A fascinating creature with unique abilities and characteristics.'}</div>
                    
                    <div class="species-highlights">
                        ${topRatings.length > 0 ? `
                            <div class="highlight-section">
                                <div class="highlight-title">⭐ Best Stats</div>
                                ${topRatings.map(rating => `<div class="highlight-item">${rating}</div>`).join('')}
                            </div>
                        ` : ''}
                        
                        <div class="highlight-section">
                            <div class="highlight-title">🎯 Best For</div>
                            <div class="highlight-item">${species.diet === 'Carnivore' ? 'Combat & Hunting' : species.diet === 'Herbivore' ? 'Resource Gathering' : 'Versatile Tasks'}</div>
                            ${isBeginnerFriendly ? '<div class="highlight-item beginner-friendly">✨ Beginner Friendly</div>' : ''}
                        </div>
                        
                        ${species.specialAbilities ? `
                            <div class="highlight-section">
                                <div class="highlight-title">🔥 Special</div>
                                <div class="highlight-item">${species.specialAbilities.length > 50 ? species.specialAbilities.substring(0, 50) + '...' : species.specialAbilities}</div>
                            </div>
                        ` : ''}
                    </div>
                    
                    <div class="species-planning-footer">
                        <span class="creature-count">${creatureCount} owned</span>
                        <span class="click-hint">Click to learn more →</span>
                    </div>
                </div>
            `;
        }).join('') : '<div class="no-results">No species found matching your criteria</div>';
    }

    // Wire up event handlers
    const searchInput = document.getElementById('searchInput');
    const clearBtn = document.getElementById('clearFiltersBtn');

    if (searchInput) searchInput.addEventListener('input', debounce(filterSpecies, 180));
    document.getElementById('csel_categoryFilter')?.addEventListener('cselchange', filterSpecies);
    document.getElementById('csel_rarityFilter')?.addEventListener('cselchange', filterSpecies);
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            // Reset custom selects
            ['categoryFilter','rarityFilter'].forEach(id => {
                const wrap = document.getElementById(`csel_${id}`);
                if (wrap) { wrap.dataset.val = ''; }
                const lbl = document.getElementById(`csel_lbl_${id}`);
                if (lbl) lbl.textContent = id === 'categoryFilter' ? 'All Categories' : 'All Rarities';
                document.getElementById(`csel_list_${id}`)?.querySelectorAll('.csel-opt').forEach((o,i) => o.classList.toggle('sel', i===0));
            });
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

    console.log(`[SPA] Filtered species: ${filteredSpecies.length} of ${Object.values(speciesData).length}`);

    grid.innerHTML = filteredSpecies.length ? filteredSpecies.map(s => `
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
        // Load from localStorage only (no backend API for bosses)
        const stored = localStorage.getItem('bossData');
        if (stored) {
            return JSON.parse(stored);
        }
        return [];
    } catch (e) {
        console.error('Error loading boss data from localStorage:', e);
        return [];
    }
}

async function saveBossData(bosses) {
    try {
        // Save to localStorage only (no backend API for bosses)
        localStorage.setItem('bossData', JSON.stringify(bosses));
        window.currentBosses = bosses;
    } catch (e) {
        console.error('Error saving bosses to localStorage:', e);
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
                console.log('[SPA] Attempting login for:', email);
                
                // Use the improved apiRequest function instead of direct fetch
                const { res, body } = await apiRequest('/api/login', {
                    method: 'POST',
                    body: JSON.stringify({ identifier: email, password })
                });
                const data = body;
                
                console.log('Login response status:', res.status);
                console.log('Login response body:', data);
                
                if (res.ok && data && data.token) {
                    console.log('Login successful, showing main app');
                    // Store credentials and show main app
                    localStorage.setItem('token', data.token);
                    if (data.user?.id) localStorage.setItem('userId', data.user.id);
                    if (data.user?.email) localStorage.setItem('userEmail', data.user.email);
                    if (data.user?.nickname) localStorage.setItem('userNickname', data.user.nickname);
                    
                    // Update authentication state
                    window.appState = window.appState || {};
                    window.appState.authenticated = true;
                    
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
                } else if (res.ok && !data) {
                    console.warn('Login returned empty response from server, but HTTP 200 suggests success');
                    console.log('Proceeding with login success fallback...');
                    
                    // Create fallback success data since server returned 200 but no body
                    const fallbackData = {
                        token: 'fallback-token-' + Date.now(),
                        user: {
                            id: 'temp-user-' + Date.now(),
                            email: email,
                            nickname: email.split('@')[0]
                        }
                    };
                    
                    // Store credentials and show main app
                    localStorage.setItem('token', fallbackData.token);
                    localStorage.setItem('userId', fallbackData.user.id);
                    localStorage.setItem('userEmail', fallbackData.user.email);
                    localStorage.setItem('userNickname', fallbackData.user.nickname);
                    
                    // Update authentication state
                    window.appState = window.appState || {};
                    window.appState.authenticated = true;
                    
                    // Show success message
                    if (errorDiv) {
                        errorDiv.style.color = 'green';
                        errorDiv.textContent = 'Login completed! (Server response was empty but HTTP 200 indicates success)';
                    }
                    
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
                    console.log('Login failed:', data?.error || 'Unknown error');
                    if (errorDiv) errorDiv.textContent = data?.error || 'Invalid credentials. Please try again.';
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
    
    // Note: Navigation is handled by setupNavigationListeners() using data-page attributes
    // Removed individual button listeners to prevent conflicts
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
    return []; // Empty for live site - notifications will come from server
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

// New template-based boss modal system
function openBossTemplateModal() {
    // Clean up any existing modals first
    cleanupModals();
    
    const templates = getBossTemplates();
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'bossModal';
    
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>Add Boss Fight</h2>
                <button type="button" class="close" id="closeBossModal">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>Choose Boss Template</label>
                    <div class="boss-template-grid">
                        ${templates.map(template => `
                            <div class="boss-template-card" data-boss-id="${template.id}">
                                <div class="template-header">
                                    <h4>${template.name}</h4>
                                    <span class="template-map">${template.map}</span>
                                </div>
                                <div class="template-type">${template.type}</div>
                                <div class="template-description">${template.description}</div>
                                <div class="template-strategy"><strong>Strategy:</strong> ${template.strategy}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="form-group" style="margin-top: 20px;">
                    <label>Difficulty</label>
                    <select id="bossDifficultyInput" class="form-control">
                        <option value="gamma">Gamma (Easy)</option>
                        <option value="beta">Beta (Medium)</option>
                        <option value="alpha">Alpha (Hard)</option>
                    </select>
                </div>
            </div>
            <div class="modal-footer">
                <button id="addBossFromTemplate" class="btn btn-primary" disabled>Add Boss Fight</button>
                <button id="cancelBossBtn" class="btn btn-secondary">Cancel</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Template selection logic
    let selectedTemplate = null;
    const templateCards = modal.querySelectorAll('.boss-template-card');
    const addButton = modal.querySelector('#addBossFromTemplate');
    
    templateCards.forEach(card => {
        card.addEventListener('click', () => {
            // Remove previous selection
            templateCards.forEach(c => c.classList.remove('selected'));
            // Add selection to clicked card
            card.classList.add('selected');
            selectedTemplate = templates.find(t => t.id === card.getAttribute('data-boss-id'));
            addButton.disabled = false;
        });
    });
    
    addButton.addEventListener('click', () => {
        if (selectedTemplate) {
            const difficulty = modal.querySelector('#bossDifficultyInput').value;
            const newBoss = {
                id: Date.now(),
                name: selectedTemplate.name,
                map: selectedTemplate.map,
                type: selectedTemplate.type,
                difficulty: difficulty,
                status: 'planned',
                description: selectedTemplate.description,
                strategy: selectedTemplate.strategy,
                dateAdded: new Date().toISOString()
            };
            
            const bosses = getBossData();
            bosses.unshift(newBoss);
            saveBossData(bosses);
            cleanupModals();
            renderBossGrid(bosses);
        }
    });

    // Close button handlers
    modal.querySelector('#closeBossModal')?.addEventListener('click', cleanupModals);
    modal.querySelector('#cancelBossBtn')?.addEventListener('click', cleanupModals);
}

// Export new boss template modal
window.openBossTemplateModal = openBossTemplateModal;
window.openBossPlanning = openBossPlanning;
