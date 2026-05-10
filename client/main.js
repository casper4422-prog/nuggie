// Escape HTML to prevent XSS when injecting user content into innerHTML
function esc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

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
                    try { startNotificationPolling(); } catch (e) {}
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
                    try { startNotificationPolling(); } catch (e) {}
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
		
		// Request browser notification permission
		requestNotificationPermission();
		// Handle hash-based routing (e.g. #creature/123 from shared links)
		if (handleHashRoute()) return;
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
                case 'leaderboards':
                    loadLeaderboardsPage();
                    break;
                case 'messages':
                    loadDMInboxPage();
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
    
    const _ncView = localStorage.getItem('nuggiesView') || 'expanded';
    main.innerHTML = `
        <div class="std-page">
            <div class="std-page-header">
                <div class="page-title">
                    <h1>🍗 My Nuggies</h1>
                    <div class="page-subtitle">${creatures.length} creature${creatures.length !== 1 ? 's' : ''} across ${Object.keys(creaturesBySpecies).length} species</div>
                </div>
                <div style="display:flex;gap:8px;align-items:center">
                    <button class="nc-view-toggle" id="nuggieViewToggle" onclick="toggleNuggieView()">${_ncView === 'expanded' ? '☰ Compact View' : '⊞ Expanded View'}</button>
                    <button class="btn btn-secondary" onclick="exportCreatures()">📤 Export</button>
                    <button class="btn btn-secondary" onclick="importCreatures()">📥 Import</button>
                </div>
            </div>

            <div class="nuggies-controls">
                <div class="filter-section">
                    <input type="text" id="creatureSearch" placeholder="🔍 Search creatures..." class="search-input" style="max-width:220px">
                    ${mkSelect('speciesFilter',
                        [{ v: '', l: 'All Species' }, ...Object.keys(creaturesBySpecies).sort().map(s => ({ v: s, l: `${s} (${creaturesBySpecies[s].length})` }))],
                        '', 'All Species')}
                    ${mkSelect('sortFilter',
                        [{ v: 'species', l: 'Group by Species' }, { v: 'level', l: 'Sort by Level' }, { v: 'name', l: 'Sort by Name' }, { v: 'recent', l: 'Recently Added' }],
                        'species', 'Group by Species')}
                </div>
            </div>

            <div class="collection-content">
                ${creatures.length > 0 ? renderCreatureCollection(creaturesBySpecies, database) : renderEmptyCollection()}
            </div>
        </div>
    `;

    setupCollectionFilters();
}

// ── Nuggie card system ────────────────────────────────────────────────────────

const NC_STATS = [
    { key: 'Health',   icon: '❤️',  pct: false },
    { key: 'Stamina',  icon: '⚡',  pct: false },
    { key: 'Oxygen',   icon: '💧',  pct: false },
    { key: 'Food',     icon: '🍖',  pct: false },
    { key: 'Weight',   icon: '⚖️',  pct: false },
    { key: 'Melee',    icon: '⚔️',  pct: true  },
    { key: 'Crafting', icon: '🔧',  pct: true  },
];

function ncFmt(val, pct) {
    if (val == null || val === '') return '—';
    const n = parseFloat(val);
    if (isNaN(n)) return '—';
    if (pct) return `${Math.round(n)}%`;
    return n >= 10000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n));
}

function ncGlowClass(creature) {
    const badges = window.BadgeSystem?.calculateAchievements?.(creature) || [];
    if (badges.some(b => ['diamond','titan'].includes(b.tier))) return 'nc-glow-diamond';
    if (badges.some(b => ['gold','alpha'].includes(b.tier)))    return 'nc-glow-gold';
    if (badges.some(b => ['silver','beta'].includes(b.tier)))   return 'nc-glow-silver';
    if (badges.some(b => ['bronze','gamma'].includes(b.tier)))  return 'nc-glow-bronze';
    return '';
}

function ncBadgeIcons(creature) {
    const badges = window.BadgeSystem?.calculateAchievements?.(creature) || [];
    if (!badges.length) return '';
    return badges.map(b => {
        const tier = { diamond:'💎', titan:'💎', gold:'🥇', alpha:'🥇', silver:'🥈', beta:'🥈', bronze:'🥉', gamma:'🥉' }[b.tier] || '';
        const cat  = b.id?.startsWith('boss_')      ? '👑'
                   : b.id?.startsWith('underdog_')   ? '🥊'
                   : b.id?.startsWith('util_')        ? '⛏️'
                   : b.id?.startsWith('collector_')   ? '🗺️'
                   : '🏆';
        return `<span class="nc-badge-icon" data-tip="${esc(b.name)} — ${esc(b.tier)}">${cat}${tier}</span>`;
    }).join('');
}

function ncActions(creature) {
    const id = creature.id;
    const name = (creature.name || 'this creature').replace(/'/g,"\\'");
    return `<div class="nc-actions">
        <button class="nc-btn" title="Edit"                onclick="editCreature('${id}')">✏️</button>
        <button class="nc-btn" title="Clone"               onclick="duplicateCreature('${id}')">📋</button>
        <button class="nc-btn" title="Copy shareable link" onclick="shareCreatureUrl(${id})">🔗</button>
        <button class="nc-btn" title="List for trade"      onclick="nuggieListForTrade(${id})">🔁</button>
        <button class="nc-btn nc-btn-danger" title="Delete" onclick="deleteCreature('${id}')">🗑️</button>
    </div>`;
}

function renderCreatureCardExpanded(creature, speciesData) {
    const glow  = ncGlowClass(creature);
    const emoji = speciesData?.emoji || speciesData?.icon || '🦖';
    const totalMuts = Object.values(creature.mutations || {}).reduce((a, b) => a + (b || 0), 0);
    const badges = ncBadgeIcons(creature);

    return `<div class="nc-card nc-card-exp${glow ? ' ' + glow : ''}">
        <div class="nc-header">
            <div class="nc-avatar">${emoji}</div>
            <div class="nc-identity">
                <div class="nc-name">${esc(creature.name) || 'Unnamed'}</div>
                <div class="nc-meta">${esc(creature.species) || 'Unknown'}${creature.gender ? ' · ' + esc(creature.gender) : ''}${creature.map ? ' · ' + esc(creature.map) : ''}</div>
            </div>
            <div class="nc-level-badge">Lv ${creature.level || '?'}</div>
        </div>

        <div class="nc-stats-grid">
            ${NC_STATS.map(s => {
                const base = creature.baseStats?.[s.key];
                const dom  = creature.domesticLevels?.[s.key];
                const mut  = creature.mutations?.[s.key];
                return `<div class="nc-stat-cell" title="${s.key}">
                    <div class="nc-stat-icon">${s.icon}</div>
                    <div class="nc-stat-val">${ncFmt(base, s.pct)}</div>
                    ${dom > 0 ? `<div class="nc-stat-dom">+${dom}</div>` : ''}
                    ${mut > 0 ? `<div class="nc-stat-mut">M${mut}</div>` : ''}
                </div>`;
            }).join('')}
        </div>

        <div class="nc-footer-info">
            ${totalMuts > 0 ? `<span class="nc-muts-total" title="Total mutations">🧬 ${totalMuts}</span>` : ''}
            ${creature.notes ? `<span class="nc-note-icon" title="${esc(creature.notes)}">📝 Note</span>` : ''}
        </div>

        ${badges ? `<div class="nc-badges">${badges}</div>` : ''}
        ${ncActions(creature)}
    </div>`;
}

function renderCreatureCardCompact(creature, speciesData) {
    const glow  = ncGlowClass(creature);
    const emoji = speciesData?.emoji || speciesData?.icon || '🦖';
    const badges = ncBadgeIcons(creature);

    return `<div class="nc-card nc-card-cmp${glow ? ' ' + glow : ''}">
        <div class="nc-cmp-avatar">${emoji}</div>
        <div class="nc-cmp-name">
            <div class="nc-name">${esc(creature.name) || 'Unnamed'}</div>
            <div class="nc-meta">${esc(creature.gender) || ''}${creature.level ? ' · Lv ' + creature.level : ''}</div>
        </div>
        <div class="nc-cmp-stats">
            ${NC_STATS.map(s => `<span class="nc-cmp-stat" title="${s.key}">${s.icon} ${ncFmt(creature.baseStats?.[s.key], s.pct)}</span>`).join('')}
        </div>
        ${badges ? `<div class="nc-badges nc-badges-cmp">${badges}</div>` : ''}
        ${ncActions(creature)}
    </div>`;
}

function renderCreatureCard(creature, speciesData) {
    const view = localStorage.getItem('nuggiesView') || 'expanded';
    return view === 'compact'
        ? renderCreatureCardCompact(creature, speciesData)
        : renderCreatureCardExpanded(creature, speciesData);
}

function renderCreatureCollection(creaturesBySpecies, database) {
    const view = localStorage.getItem('nuggiesView') || 'expanded';

    return Object.keys(creaturesBySpecies).sort().map(speciesName => {
        const speciesCreatures = creaturesBySpecies[speciesName];
        const speciesData = database?.[speciesName];
        return `
            <div class="species-collection-section">
                <div class="species-section-header">
                    <div class="species-info">
                        <div class="species-icon">${speciesData?.emoji || speciesData?.icon || '🦖'}</div>
                        <div>
                            <h3>${esc(speciesName)}</h3>
                            <div class="species-meta">${speciesCreatures.length} creature${speciesCreatures.length !== 1 ? 's' : ''}</div>
                        </div>
                    </div>
                    <div class="species-actions">
                        <button class="btn btn-sm btn-primary" onclick="addSpeciesCreature('${speciesName.replace(/'/g,"\\'") }')">+ Add ${esc(speciesName)}</button>
                        <button class="btn btn-sm btn-secondary" onclick="openSpeciesDetail('${speciesName.replace(/'/g,"\\'") }')">Species Info</button>
                    </div>
                </div>
                <div class="${view === 'compact' ? 'creatures-grid-compact' : 'creatures-grid'}">
                    ${speciesCreatures.map(c => renderCreatureCard(c, speciesData)).join('')}
                </div>
            </div>`;
    }).join('');
}

function toggleNuggieView() {
    const current = localStorage.getItem('nuggiesView') || 'expanded';
    localStorage.setItem('nuggiesView', current === 'expanded' ? 'compact' : 'expanded');
    loadMyNuggiesPage();
}
window.toggleNuggieView = toggleNuggieView;

function nuggieListForTrade(creatureId) {
    loadTradingPage().then(() => {
        setTimeout(() => tradeShowListModal(creatureId), 300);
    }).catch(() => {
        loadTradingPage();
    });
}
window.nuggieListForTrade = nuggieListForTrade;

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
    const [trades, myOffers, myWishlist] = await Promise.all([
        apiRequest('/api/trades?status=open').then(r => Array.isArray(r.body) ? r.body : []).catch(() => []),
        apiRequest('/api/offers').then(r => Array.isArray(r.body) ? r.body : []).catch(() => []),
        apiRequest('/api/wishlists').then(r => Array.isArray(r.body) ? r.body : []).catch(() => [])
    ]);
    window._myWishlist = new Set(myWishlist);

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
                <div style="display:flex;gap:8px">
                    <button class="btn btn-secondary" onclick="tradeWishlistModal()">⭐ Wishlist (${window._myWishlist?.size || 0})</button>
                    <button class="btn btn-primary" onclick="tradeShowListModal()">➕ List a Creature</button>
                </div>
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
                    <div class="friend-name">${esc(c.name)||'Unnamed'} <span style="color:#64748b;font-weight:400">${esc(c.species)||'?'}</span></div>
                    <div class="friend-meta">Looking for: ${esc(t.wanted)||'Open to offers'}${t.price ? ` · 💰 ${esc(t.price)}` : ''}</div>
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
                <div class="friend-meta">Offering: ${esc(oc.name)||'Unnamed'} (${esc(oc.species)||'?'})${o.message ? ` · "${esc(o.message)}"` : ''}</div>
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
                <span style="color:#f1f5f9;font-weight:500">${esc(o.from_nickname) || 'User #'+o.from_user_id}</span>
                offers <strong>${esc(oc.name)||'Unnamed'}</strong> (${esc(oc.species)||'?'})
                ${o.message ? `<em style="color:#64748b"> — "${esc(o.message)}"</em>` : ''}
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

// ── Wishlist Management ───────────────────────────────────────────────────────
async function tradeWishlistModal() {
    const db2 = window.SPECIES_DATABASE || {};
    const speciesOptions = Object.keys(db2).sort().map(k => {
        const onWl = window._myWishlist?.has(k);
        return `<div class="wl-row" id="wlrow-${k.replace(/[^a-z0-9]/gi,'_')}">
            <span style="flex:1;color:#f1f5f9;font-size:0.9rem">${k}</span>
            <button class="btn btn-sm ${onWl ? 'btn-danger' : 'btn-secondary'}" onclick="wishlistToggle('${k.replace(/'/g,"\\'")}',this)">${onWl ? '✕ Remove' : '+ Watch'}</button>
        </div>`;
    }).join('');
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:440px">
            <div class="modal-header"><h2 class="modal-title">⭐ My Wishlist</h2><button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button></div>
            <div class="modal-body">
                <div style="color:#94a3b8;font-size:0.85rem;margin-bottom:12px">Watch species and get notified when they're listed. <span style="color:var(--tc-1,#3b82f6)">${window._myWishlist?.size || 0} watching</span></div>
                <input class="form-control" placeholder="🔍 Filter species..." oninput="wlFilter(this.value)" style="margin-bottom:10px">
                <div id="wlList" style="max-height:360px;overflow-y:auto;display:flex;flex-direction:column;gap:4px">${speciesOptions}</div>
            </div>
        </div>`;
    document.body.appendChild(modal);
}
window.tradeWishlistModal = tradeWishlistModal;

function wlFilter(q) {
    document.querySelectorAll('.wl-row').forEach(row => {
        row.style.display = row.textContent.toLowerCase().includes(q.toLowerCase()) ? '' : 'none';
    });
}
window.wlFilter = wlFilter;

async function wishlistToggle(species, btn) {
    const onWl = window._myWishlist?.has(species);
    if (onWl) {
        await apiRequest(`/api/wishlists/${encodeURIComponent(species)}`, { method: 'DELETE' });
        window._myWishlist?.delete(species);
        if (btn) { btn.textContent = '+ Watch'; btn.className = 'btn btn-sm btn-secondary'; }
    } else {
        await apiRequest('/api/wishlists', { method: 'POST', body: JSON.stringify({ species }) });
        window._myWishlist?.add(species);
        if (btn) { btn.textContent = '✕ Remove'; btn.className = 'btn btn-sm btn-danger'; }
    }
}
window.wishlistToggle = wishlistToggle;

// ── Seller Rating Modal ───────────────────────────────────────────────────────
function tradeRateModal(ratedUserId, ratedName, tradeId) {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:380px">
            <div class="modal-header"><h2 class="modal-title">⭐ Rate Trader</h2><button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button></div>
            <div class="modal-body" style="display:flex;flex-direction:column;gap:14px">
                <div style="color:#94a3b8">Rate your trade with <strong style="color:#f1f5f9">${ratedName}</strong></div>
                <div style="display:flex;gap:8px;justify-content:center">
                    ${[1,2,3,4,5].map(n => `<button class="rating-star" data-val="${n}" onclick="ratingStarClick(${n})" style="font-size:2rem;background:none;border:none;cursor:pointer;opacity:0.4;transition:opacity 0.15s" title="${n} star${n>1?'s':''}">⭐</button>`).join('')}
                </div>
                <input id="ratingComment" class="form-control" placeholder="Optional comment...">
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Skip</button>
                <button class="btn btn-primary" onclick="tradeSubmitRating(${ratedUserId},${tradeId})">Submit Rating</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
}
window.tradeRateModal = tradeRateModal;

function ratingStarClick(val) {
    document.querySelectorAll('.rating-star').forEach(s => {
        s.style.opacity = parseInt(s.dataset.val) <= val ? '1' : '0.3';
    });
    window._selectedRating = val;
}
window.ratingStarClick = ratingStarClick;

async function tradeSubmitRating(ratedUserId, tradeId) {
    const rating = window._selectedRating;
    if (!rating) { alert('Please select a star rating.'); return; }
    const comment = document.getElementById('ratingComment')?.value?.trim() || null;
    await apiRequest('/api/ratings', { method: 'POST', body: JSON.stringify({ rated_user_id: ratedUserId, trade_id: tradeId, rating, comment }) });
    document.querySelector('.modal.active')?.remove();
}
window.tradeSubmitRating = tradeSubmitRating;

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


// ── Tribe color theme system ────────────────────────────────────────────────

const ARK_MAPS = [
    'The Island','The Center','Scorched Earth','Aberration','Extinction',
    'Genesis Part 1','Genesis Part 2','Ragnarok','Crystal Isles','Fjordur',
    'Valguero','Lost Island','Lost Colony','Astraeos','Svartalfheim','Custom'
];

function applyTribeTheme(colors) {
    if (!Array.isArray(colors) || !colors.length) return;
    const root = document.documentElement;
    if (colors[0]) root.style.setProperty('--tc-1', colors[0]);
    if (colors[1]) root.style.setProperty('--tc-2', colors[1]);
    if (colors[2]) root.style.setProperty('--tc-3', colors[2]);
}

function resetTribeTheme() {
    const root = document.documentElement;
    root.style.removeProperty('--tc-1');
    root.style.removeProperty('--tc-2');
    root.style.removeProperty('--tc-3');
}

function loadTribeThemeOnStartup() {
    const useTribeColors = localStorage.getItem('useTribeColors') !== 'false'; // default on
    if (!useTribeColors) return;
    // Apply from cached tribe data if available
    const cached = window.appState?.myTribeColors;
    if (cached && Array.isArray(cached)) applyTribeTheme(cached);
}
window.applyTribeTheme = applyTribeTheme;
window.resetTribeTheme = resetTribeTheme;

function initDarkMode() {
    const dark = localStorage.getItem('darkMode') === 'true';
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : '');
    const btn = document.getElementById('darkModeBtn');
    if (btn) btn.textContent = dark ? '☀️' : '🌙';
}

function toggleDarkMode() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const newDark = !isDark;
    localStorage.setItem('darkMode', String(newDark));
    document.documentElement.setAttribute('data-theme', newDark ? 'dark' : '');
    const btn = document.getElementById('darkModeBtn');
    if (btn) btn.textContent = newDark ? '☀️' : '🌙';
}
window.toggleDarkMode = toggleDarkMode;

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
                <div class="tribe-browse-name">${esc(t.name)}</div>
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

function tribeShowCreateModal(existing) {
    // existing = tribe object when editing, null when creating
    const isEdit = !!existing;
    const mapOpts = [{ v: '', l: 'Select a map...' }, ...ARK_MAPS.map(m => ({ v: m, l: m }))];
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:520px">
            <div class="modal-header">
                <h2 class="modal-title">${isEdit ? '⚙️ Tribe Settings' : '➕ Create Tribe'}</h2>
                <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="modal-body" style="display:flex;flex-direction:column;gap:16px">
                <div class="plan-field">
                    <label class="form-label">Tribe Name *</label>
                    <input id="tcName" class="form-control" placeholder="e.g. Alpha Hunters" value="${existing?.name || ''}">
                </div>
                <div class="plan-field">
                    <label class="form-label">Main Map</label>
                    ${mkSelect('tcMap', mapOpts, existing?.main_map || '', 'Select a map...')}
                </div>
                <div class="plan-field">
                    <label class="form-label">Description</label>
                    <textarea id="tcDesc" class="form-control" rows="3" placeholder="What's your tribe about?">${existing?.description || ''}</textarea>
                </div>
                <div class="plan-field">
                    <label class="form-label">Tribe Flag <span style="color:#64748b;font-size:0.78rem">(image — shown as banner on tribe page)</span></label>
                    ${existing?.flag_image
                        ? `<img id="tcFlagPreview" class="tribe-flag-preview" src="${existing.flag_image}" alt="Flag">`
                        : `<div class="tribe-flag-placeholder" id="tcFlagPreview">No flag uploaded</div>`
                    }
                    <input type="file" id="tcFlagInput" accept="image/*" style="margin-top:8px" onchange="tribePreviewFlag(this)">
                </div>
                <div class="plan-field">
                    <label class="form-label">Tribe Colors <span style="color:#64748b;font-size:0.78rem">(changes site accent colors when active)</span></label>
                    <div class="tribe-color-row">
                        <div class="tribe-color-item">
                            <label>Primary</label>
                            <input type="color" id="tcColor1" value="${(Array.isArray(existing?.colors) ? existing.colors[0] : null) || '#3b82f6'}">
                        </div>
                        <div class="tribe-color-item">
                            <label>Secondary</label>
                            <input type="color" id="tcColor2" value="${(Array.isArray(existing?.colors) ? existing.colors[1] : null) || '#60a5fa'}">
                        </div>
                        <div class="tribe-color-item">
                            <label>Accent</label>
                            <input type="color" id="tcColor3" value="${(Array.isArray(existing?.colors) ? existing.colors[2] : null) || '#22c55e'}">
                        </div>
                        <div class="tribe-color-item" style="justify-content:flex-end;padding-bottom:4px">
                            <button class="btn btn-secondary btn-sm" onclick="tribePreviewColors()">Preview</button>
                        </div>
                    </div>
                </div>
                <div id="tcError" style="color:#ef4444;font-size:0.85rem;display:none"></div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                <button class="btn btn-primary" onclick="tribeDoCreate(${isEdit ? existing.id : 'null'})">${isEdit ? 'Save Settings' : 'Create Tribe'}</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
    window._tcFlagBase64 = null; // reset flag data
}
window.tribeShowCreateModal = tribeShowCreateModal;

function tribePreviewFlag(input) {
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return alert('Flag image must be under 2MB.');
    const reader = new FileReader();
    reader.onload = e => {
        window._tcFlagBase64 = e.target.result;
        const preview = document.getElementById('tcFlagPreview');
        if (preview) {
            preview.outerHTML = `<img id="tcFlagPreview" class="tribe-flag-preview" src="${e.target.result}" alt="Flag">`;
        }
    };
    reader.readAsDataURL(file);
}
window.tribePreviewFlag = tribePreviewFlag;

function tribePreviewColors() {
    const c1 = document.getElementById('tcColor1')?.value;
    const c2 = document.getElementById('tcColor2')?.value;
    const c3 = document.getElementById('tcColor3')?.value;
    if (c1 || c2 || c3) applyTribeTheme([c1, c2, c3]);
}
window.tribePreviewColors = tribePreviewColors;

async function tribeDoCreate(tribeId) {
    const name = document.getElementById('tcName')?.value.trim();
    const errEl = document.getElementById('tcError');
    if (!name) { if (errEl) { errEl.textContent = 'Tribe name is required.'; errEl.style.display = 'block'; } return; }

    const main_map = document.getElementById('csel_tcMap')?.dataset.val || null;
    const description = document.getElementById('tcDesc')?.value.trim() || null;
    const colors = [
        document.getElementById('tcColor1')?.value || '#3b82f6',
        document.getElementById('tcColor2')?.value || '#60a5fa',
        document.getElementById('tcColor3')?.value || '#22c55e'
    ];
    const flag_image = window._tcFlagBase64 || (tribeId ? undefined : null);

    const payload = { name, main_map, description, colors };
    if (flag_image !== undefined) payload.flag_image = flag_image;

    const method = tribeId ? 'PUT' : 'POST';
    const url = tribeId ? `/api/tribes/${tribeId}` : '/api/tribes';
    const { res, body } = await apiRequest(url, { method, body: JSON.stringify(payload) });

    if (res.ok) {
        // Apply new colors immediately
        applyTribeTheme(colors);
        window.appState = window.appState || {};
        window.appState.myTribeColors = colors;
        document.querySelector('.modal.active')?.remove();
        loadTribesPage();
    } else {
        if (errEl) { errEl.textContent = body?.error || 'Failed to save tribe.'; errEl.style.display = 'block'; }
    }
}
window.tribeDoCreate = tribeDoCreate;

// ── IN TRIBE: tabbed management view ───────────────────────────
function renderTribeMemberView(tribe, main) {
    const myUserId = parseInt(localStorage.getItem('userId') || '0');
    const me = (tribe.members || []).find(m => m.user_id === myUserId);
    const myRole = me?.role || 'member';
    const isAdmin = myRole === 'owner' || myRole === 'admin';
    const isOwner = myRole === 'owner';

    // Apply tribe colors immediately on entering the tribe view
    const colors = Array.isArray(tribe.colors) ? tribe.colors : null;
    if (colors && localStorage.getItem('useTribeColors') !== 'false') {
        applyTribeTheme(colors);
        window.appState = window.appState || {};
        window.appState.myTribeColors = colors;
    }

    const flagHtml = tribe.flag_image
        ? `<img class="tribe-banner" src="${tribe.flag_image}" alt="${tribe.name} flag">`
        : '';

    main.innerHTML = `
        <div class="std-page">
            ${flagHtml}
            <div class="std-page-header">
                <div class="page-title">
                    <h1>🏛️ ${esc(tribe.name)}</h1>
                    <div class="page-subtitle">
                        ${tribe.main_map ? `📍 ${tribe.main_map} · ` : ''}
                        ${tribe.members?.length || 0} members · Your role:
                        <strong style="color:var(--tc-2,#60a5fa);text-transform:capitalize">${myRole}</strong>
                    </div>
                </div>
                <button class="btn btn-danger btn-sm" onclick="tribeLeaveTribe(${tribe.id})">Leave Tribe</button>
            </div>

            <div class="tribe-tabs">
                <button class="tribe-tab active" data-tab="overview" onclick="tribeTab(this,'overview',${tribe.id})">🏠 Overview</button>
                <button class="tribe-tab" data-tab="members" onclick="tribeTab(this,'members',${tribe.id})">👥 Members (${tribe.members?.length||0})</button>
                <button class="tribe-tab" data-tab="vault" onclick="tribeTab(this,'vault',${tribe.id})">🗄️ Vault</button>
                <button class="tribe-tab" data-tab="alliances" onclick="tribeTab(this,'alliances',${tribe.id})">🤝 Alliances</button>
                ${isAdmin ? `<button class="tribe-tab" data-tab="requests" onclick="tribeTab(this,'requests',${tribe.id})">📬 Requests</button>` : ''}
                ${isOwner ? `<button class="tribe-tab" data-tab="settings" onclick="tribeTab(this,'settings',${tribe.id})">⚙️ Settings</button>` : ''}
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
        if (body?.colors && localStorage.getItem('useTribeColors') !== 'false') applyTribeTheme(body.colors);
        content.innerHTML = body ? renderTribeOverviewTab(body, null) : '<div class="tribe-empty">Failed to load.</div>';
    } else if (tab === 'members') {
        const { body } = await apiRequest(`/api/tribes/${tribeId}`).catch(() => ({ body: null }));
        const myUserId = parseInt(localStorage.getItem('userId') || '0');
        const me = (body?.members || []).find(m => m.user_id === myUserId);
        const myRole = me?.role || 'member';
        const isAdmin = myRole === 'owner' || myRole === 'admin';
        content.innerHTML = renderTribeMembersTab(body, tribeId, isAdmin, myRole);
    } else if (tab === 'vault') {
        const { body } = await apiRequest(`/api/tribes/${tribeId}/creatures`).catch(() => ({ body: [] }));
        content.innerHTML = renderTribeVaultTab(Array.isArray(body) ? body : [], tribeId);
    } else if (tab === 'alliances') {
        content.innerHTML = await loadAlliancesTab(tribeId);
    } else if (tab === 'requests') {
        content.innerHTML = await loadJoinRequestsTab(tribeId);
    } else if (tab === 'settings') {
        const { body } = await apiRequest(`/api/tribes/${tribeId}`).catch(() => ({ body: null }));
        if (body) { tribeShowCreateModal(body); content.innerHTML = '<div class="tribe-empty">Settings modal opened.</div>'; }
    }
}
window.tribeTab = tribeTab;

// ── Alliance Tab ──────────────────────────────────────────────────────────────
async function loadAlliancesTab(tribeId) {
    const alliances = await apiRequest('/api/alliances').then(r => Array.isArray(r.body) ? r.body : []).catch(() => []);
    const allTribes = await apiRequest('/api/tribes').then(r => Array.isArray(r.body) ? r.body : []).catch(() => []);
    const myTribeId = parseInt(tribeId);

    const active = alliances.filter(a => a.status === 'accepted');
    const pending = alliances.filter(a => a.status === 'pending');

    const allyName = a => a.tribe_id === myTribeId ? a.ally_name : a.tribe_name;
    const allyId = a => a.tribe_id === myTribeId ? a.ally_tribe_id : a.tribe_id;

    const otherTribes = allTribes.filter(t => t.id !== myTribeId && !alliances.some(a => allyId(a) === t.id));

    return `
        <div style="display:flex;flex-direction:column;gap:20px">
            <div class="profile-card">
                <div class="profile-card-header"><h3>🤝 Active Alliances</h3></div>
                ${active.length === 0
                    ? '<div class="friends-empty">No active alliances yet.</div>'
                    : active.map(a => `
                    <div style="display:flex;align-items:center;gap:12px;padding:12px;border-bottom:1px solid #0f172a">
                        <div style="flex:1;font-weight:bold;color:#f1f5f9">🛡️ ${allyName(a)}</div>
                        <button class="btn btn-sm btn-secondary" onclick="allianceOpenChat(${a.id},'${allyName(a).replace(/'/g,"\\'")}')">💬 Chat</button>
                    </div>`).join('')
                }
            </div>

            ${pending.length > 0 ? `
            <div class="profile-card">
                <div class="profile-card-header"><h3>📬 Pending Requests</h3></div>
                ${pending.map(a => {
                    const isSent = a.tribe_id === myTribeId;
                    return `<div style="display:flex;align-items:center;gap:12px;padding:12px;border-bottom:1px solid #0f172a">
                        <div style="flex:1;color:#94a3b8">${isSent ? '📤 Sent to' : '📥 From'} <strong style="color:#f1f5f9">${allyName(a)}</strong></div>
                        ${!isSent ? `<button class="btn btn-sm btn-primary" onclick="allianceRespond(${a.id},'accepted')">Accept</button>
                        <button class="btn btn-sm btn-danger" onclick="allianceRespond(${a.id},'declined')">Decline</button>` : '<span style="color:#64748b;font-size:0.8rem">Awaiting response</span>'}
                    </div>`;
                }).join('')}
            </div>` : ''}

            <div class="profile-card">
                <div class="profile-card-header"><h3>➕ Request Alliance</h3></div>
                ${otherTribes.length === 0
                    ? '<div class="friends-empty">No tribes available to ally with.</div>'
                    : `<div style="display:flex;flex-direction:column;gap:6px">
                        ${otherTribes.slice(0, 10).map(t => `
                        <div style="display:flex;align-items:center;gap:12px;padding:10px;border-radius:8px;background:rgba(255,255,255,0.02)">
                            <div style="flex:1;color:#f1f5f9;font-size:0.9rem">🏛️ ${esc(t.name)}</div>
                            <button class="btn btn-sm btn-secondary" onclick="allianceRequest(${t.id},'${t.name.replace(/'/g,"\\'")}')" >Request</button>
                        </div>`).join('')}
                    </div>`
                }
            </div>
        </div>`;
}
window.loadAlliancesTab = loadAlliancesTab;

async function allianceRequest(allyTribeId, allyName) {
    if (!confirm(`Send alliance request to ${allyName}?`)) return;
    const { res, body } = await apiRequest('/api/alliances', { method: 'POST', body: JSON.stringify({ ally_tribe_id: allyTribeId }) });
    if (res.ok) { alert('Alliance request sent!'); loadTribesPage(); }
    else alert(body?.error || 'Failed to send request.');
}
window.allianceRequest = allianceRequest;

async function allianceRespond(allianceId, status) {
    await apiRequest(`/api/alliances/${allianceId}`, { method: 'PUT', body: JSON.stringify({ status }) });
    loadTribesPage();
}
window.allianceRespond = allianceRespond;

async function allianceOpenChat(allianceId, allyName) {
    const msgs = await apiRequest(`/api/alliances/${allianceId}/chat`).then(r => Array.isArray(r.body) ? r.body : []).catch(() => []);
    const myNick = localStorage.getItem('userNickname') || 'You';
    const myId = parseInt(localStorage.getItem('userId') || '0');

    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:520px;height:560px;display:flex;flex-direction:column">
            <div class="modal-header"><h2 class="modal-title">🤝 Alliance Chat: ${allyName}</h2><button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button></div>
            <div class="dm-thread" id="allianceThread" style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding:16px">
                ${msgs.length === 0 ? '<div style="color:#475569;text-align:center;margin:auto">No messages yet.</div>' : ''}
                ${msgs.map(m => {
                    const isMe = m.user_id === myId;
                    return `<div class="dm-bubble ${isMe ? 'dm-me' : 'dm-them'}">
                        <div class="dm-sender">${m.sender || 'Unknown'}</div>
                        <div class="dm-text">${m.message.replace(/</g,'&lt;')}</div>
                    </div>`;
                }).join('')}
            </div>
            <div class="dm-compose">
                <input id="allianceChatInput" class="form-control" placeholder="Message alliance..." onkeydown="if(event.key==='Enter'){event.preventDefault();allianceSendMsg(${allianceId})}">
                <button class="btn btn-primary" onclick="allianceSendMsg(${allianceId})">Send</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
    setTimeout(() => { const t = document.getElementById('allianceThread'); if (t) t.scrollTop = t.scrollHeight; }, 50);
    document.getElementById('allianceChatInput')?.focus();
}
window.allianceOpenChat = allianceOpenChat;

async function allianceSendMsg(allianceId) {
    const input = document.getElementById('allianceChatInput');
    const msg = input?.value?.trim();
    if (!msg) return;
    input.value = '';
    const myNick = localStorage.getItem('userNickname') || 'You';
    const myId = parseInt(localStorage.getItem('userId') || '0');
    const thread = document.getElementById('allianceThread');
    if (thread) {
        const bubble = document.createElement('div');
        bubble.className = 'dm-bubble dm-me';
        bubble.innerHTML = `<div class="dm-sender">${myNick}</div><div class="dm-text">${msg.replace(/</g,'&lt;')}</div>`;
        thread.appendChild(bubble);
        thread.scrollTop = thread.scrollHeight;
    }
    await apiRequest(`/api/alliances/${allianceId}/chat`, { method: 'POST', body: JSON.stringify({ message: msg }) });
}
window.allianceSendMsg = allianceSendMsg;

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

function renderTribeMembersTab(tribe, tribeId, isAdmin, callerRole) {
    const members = tribe?.members || [];
    const myUserId = parseInt(localStorage.getItem('userId') || '0');
    const isOwner = callerRole === 'owner';
    // Role order for display
    const roleOrder = { owner: 0, admin: 1, member: 2, recruit: 3 };
    const sorted = [...members].sort((a, b) => (roleOrder[a.role] ?? 9) - (roleOrder[b.role] ?? 9));

    function roleButtons(m) {
        if (!isAdmin || m.user_id === myUserId || m.role === 'owner') return '';
        const btns = [];
        // Promotion
        const next = { recruit: 'member', member: 'admin' }[m.role];
        if (next && (isOwner || next !== 'admin')) {
            btns.push(`<button class="btn btn-secondary btn-sm" onclick="tribeSetRole(${tribeId},${m.user_id},'${next}')">▲ ${next}</button>`);
        }
        // Demotion
        const prev = { admin: 'member', member: 'recruit' }[m.role];
        if (prev) {
            btns.push(`<button class="btn btn-secondary btn-sm" onclick="tribeSetRole(${tribeId},${m.user_id},'${prev}')">▼ ${prev}</button>`);
        }
        // Kick
        btns.push(`<button class="btn btn-danger btn-sm" onclick="tribeKickMember(${tribeId},${m.user_id},'${(m.nickname||m.email||'this member').replace(/'/g,"\\'")}')">Kick</button>`);
        return btns.join('');
    }

    return `
        <div class="tribe-members-list">
            ${sorted.map(m => `
                <div class="tribe-member-row">
                    <div class="tribe-member-avatar">👤</div>
                    <div class="tribe-member-info">
                        <div class="tribe-member-name">${m.nickname || m.email || 'Unknown'}</div>
                        <div class="tribe-member-role ${m.role}">${m.role}</div>
                    </div>
                    <div style="display:flex;gap:6px;flex-wrap:wrap">${roleButtons(m)}</div>
                </div>`).join('')}
        </div>`;
}

async function tribeSetRole(tribeId, userId, role) {
    const { res, body } = await apiRequest(`/api/tribes/${tribeId}/members/${userId}/role`, {
        method: 'PUT', body: JSON.stringify({ role })
    });
    if (res.ok) {
        // Refresh the members tab
        const btn = document.querySelector('.tribe-tab[data-tab="members"]');
        if (btn) tribeTab(btn, 'members', tribeId);
    } else {
        alert(body?.error || 'Failed to change role.');
    }
}
window.tribeSetRole = tribeSetRole;

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

// ── Arena — Boss Fight War Rooms ───────────────────────────────────────────
// A shared workspace for planning and coordinating boss fights with allies.
// Not PvP — this is collaborative raid prep.

let _arenaSessionId = null;  // currently open session
let _arenaChatPollTimer = null;
let _arenaLastChatId = 0;

async function loadArenaPage() {
    setActiveNavButton('arena');
    const main = document.getElementById('appMainContent');
    if (!main) return;
    arenaClearPoll();
    main.innerHTML = `<div class="std-page"><div style="color:#94a3b8;padding:40px">Loading war rooms...</div></div>`;

    const { res, body: sessions } = await apiRequest('/api/arena/sessions').catch(() => ({ res:{ok:false}, body:[] }));
    const list = res.ok && Array.isArray(sessions) ? sessions : [];

    main.innerHTML = `
        <div class="std-page">
            <div class="std-page-header">
                <div class="page-title">
                    <h1>⚔️ Arena</h1>
                    <div class="page-subtitle">Boss fight war rooms — coordinate with allies across tribes</div>
                </div>
                <div style="display:flex;gap:10px">
                    <button class="btn btn-secondary" onclick="arenaJoinModal()">🔑 Join with Code</button>
                    <button class="btn btn-primary" onclick="arenaCreateModal()">➕ Create War Room</button>
                </div>
            </div>

            ${list.length === 0
                ? `<div class="friends-empty" style="text-align:center;padding:60px 0">
                     <div style="font-size:3rem;margin-bottom:12px">⚔️</div>
                     <div style="color:#94a3b8;font-size:1rem">No active war rooms yet.</div>
                     <div style="color:#64748b;font-size:0.85rem;margin-top:6px">Create one to plan a boss fight with allies.</div>
                   </div>`
                : `<div class="arena-session-list">
                    ${list.map(s => arenaSessionCard(s)).join('')}
                   </div>`
            }
        </div>`;
}
window.loadArenaPage = loadArenaPage;

// Called from Boss Planner — go to Arena filtered to that boss, auto-open create if no sessions
async function loadArenaForBoss(bossId) {
    setActiveNavButton('arena');
    const main = document.getElementById('appMainContent');
    if (!main) return;
    arenaClearPoll();

    const template = getBossTemplates().find(t => t.id === bossId);
    if (!template) { loadArenaPage(); return; }

    main.innerHTML = `<div class="std-page"><div style="color:#94a3b8;padding:40px">Loading war rooms for ${esc(template.name)}...</div></div>`;

    const { res, body: sessions } = await apiRequest('/api/arena/sessions').catch(() => ({ res:{ok:false}, body:[] }));
    const all = res.ok && Array.isArray(sessions) ? sessions : [];
    // Show sessions for this boss first, then the rest
    const bossSessions = all.filter(s => s.boss_id === bossId || s.boss_name === template.name);
    const otherSessions = all.filter(s => s.boss_id !== bossId && s.boss_name !== template.name);

    main.innerHTML = `
        <div class="std-page">
            <div class="std-page-header">
                <div class="page-title">
                    <h1>${template.icon} ${esc(template.name)}</h1>
                    <div class="page-subtitle">📍 ${esc(template.map)} · ${esc(template.type)} — Arena war rooms</div>
                </div>
                <div style="display:flex;gap:8px">
                    <button class="btn btn-secondary" onclick="loadBossPlanner()">← Boss List</button>
                    <button class="btn btn-secondary" onclick="arenaJoinModal()">🔑 Join with Code</button>
                    <button class="btn btn-primary" onclick="arenaCreateModal('${bossId}')">⚔️ Start War Room</button>
                </div>
            </div>

            ${bossessions_html(bossId, template.name, bossSessions)}

            ${otherSessions.length > 0 ? `
            <div style="color:#64748b;font-size:0.85rem;margin:24px 0 10px;text-transform:uppercase;letter-spacing:0.5px">Other Active War Rooms</div>
            <div class="arena-session-list">${otherSessions.map(s => arenaSessionCard(s)).join('')}</div>` : ''}
        </div>`;
}
window.loadArenaForBoss = loadArenaForBoss;

function bossessions_html(bossId, bossName, bossSessionList) {
    if (bossSessionList.length === 0) {
        return `<div style="background:rgba(255,255,255,0.03);border:2px dashed #334155;border-radius:12px;padding:40px;text-align:center">
            <div style="font-size:2.5rem;margin-bottom:12px">⚔️</div>
            <div style="color:#94a3b8;font-size:1rem;margin-bottom:6px">No active war rooms for this boss yet.</div>
            <div style="color:#64748b;font-size:0.85rem;margin-bottom:20px">Start one and invite your allies — they can join with a code.</div>
            <button class="btn btn-primary" onclick="arenaCreateModal('${bossId}')">⚔️ Start War Room</button>
        </div>`;
    }
    return `
        <div style="color:#64748b;font-size:0.85rem;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.5px">${bossSessionList.length} War Room${bossSessionList.length!==1?'s':''} for ${esc(bossName)}</div>
        <div class="arena-session-list">${bossSessionList.map(s => arenaSessionCard(s)).join('')}</div>`;
}

function arenaSessionCard(s) {
    const diffColor = { alpha:'#ef4444', beta:'#3b82f6', gamma:'#22c55e' }[s.difficulty] || '#94a3b8';
    const diffLabel = { alpha:'🔴 Alpha', beta:'🔵 Beta', gamma:'🟢 Gamma' }[s.difficulty] || s.difficulty;
    return `
    <div class="arena-session-card" onclick="arenaOpenSession(${s.id})">
        <div class="arena-session-info">
            <div class="arena-session-boss">👑 ${s.boss_name || s.boss_id}</div>
            <div class="arena-session-meta">
                <span style="color:${diffColor}">${diffLabel}</span>
                <span>·</span>
                <span>👥 ${s.member_count} member${s.member_count!==1?'s':''}</span>
                <span>·</span>
                <span class="arena-session-code">🔑 ${s.join_code}</span>
            </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
            <span class="arena-session-status ${s.status}">${s.status}</span>
            <span style="color:#3b82f6;font-size:0.85rem">Open →</span>
        </div>
    </div>`;
}

// ── Create modal ──────────────────────────────────────────────────────────────
function arenaCreateModal(preBossId) {
    const bosses = getBossTemplates();
    const pre = preBossId ? bosses.find(b => b.id === preBossId) : null;
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:460px">
            <div class="modal-header">
                <h2 class="modal-title">${pre ? `⚔️ War Room: ${esc(pre.name)}` : '➕ Create War Room'}</h2>
                <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="modal-body" style="display:flex;flex-direction:column;gap:14px">
                ${pre
                    ? `<div style="background:rgba(255,255,255,0.04);border:1px solid #334155;border-radius:8px;padding:12px;color:#94a3b8;font-size:0.9rem">
                           <div style="color:#f1f5f9;font-weight:bold;margin-bottom:4px">${esc(pre.icon)} ${esc(pre.name)}</div>
                           <div>📍 ${esc(pre.map)} · ${esc(pre.type)}</div>
                       </div>`
                    : `<div class="plan-field">
                           <label class="form-label">Boss Fight *</label>
                           ${mkSelect('arenaCreateBoss',
                               [{ v:'', l:'Select a boss...' }, ...bosses.map(b => ({ v: b.id, l: `${b.name} — ${b.map}` }))],
                               '', 'Select a boss...')}
                       </div>`
                }
                <div class="plan-field">
                    <label class="form-label">Difficulty</label>
                    ${mkSelect('arenaCreateDiff',
                        [{ v:'gamma', l:'🟢 Gamma (Easy)' }, { v:'beta', l:'🔵 Beta (Medium)' }, { v:'alpha', l:'🔴 Alpha (Hard)' }],
                        'alpha', 'Alpha')}
                </div>
                <div id="arenaCreateErr" style="color:#ef4444;font-size:0.85rem;display:none"></div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                <button class="btn btn-primary" onclick="arenaDoCreate('${preBossId || ''}')">Create Room</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
}
window.arenaCreateModal = arenaCreateModal;

async function arenaDoCreate(preBossId) {
    const bossId = preBossId || document.getElementById('csel_arenaCreateBoss')?.dataset.val;
    const difficulty = document.getElementById('csel_arenaCreateDiff')?.dataset.val || 'alpha';
    const errEl = document.getElementById('arenaCreateErr');
    if (!bossId) { if (errEl) { errEl.textContent = 'Select a boss.'; errEl.style.display='block'; } return; }
    const bossName = getBossTemplates().find(b => b.id === bossId)?.name || bossId;
    const { res, body } = await apiRequest('/api/arena/sessions', {
        method: 'POST', body: JSON.stringify({ boss_id: bossId, boss_name: bossName, difficulty })
    });
    if (res.ok) {
        document.querySelector('.modal.active')?.remove();
        arenaOpenSession(body.id);
    } else {
        if (errEl) { errEl.textContent = body?.error || 'Failed to create.'; errEl.style.display='block'; }
    }
}
window.arenaDoCreate = arenaDoCreate;

// ── Join modal ────────────────────────────────────────────────────────────────
function arenaJoinModal() {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:400px">
            <div class="modal-header">
                <h2 class="modal-title">🔑 Join with Code</h2>
                <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="modal-body" style="display:flex;flex-direction:column;gap:14px">
                <div class="plan-field">
                    <label class="form-label">Join Code</label>
                    <input id="arenaJoinCode" class="form-control" placeholder="e.g. RAVEN-4291" style="text-transform:uppercase;letter-spacing:0.1em">
                </div>
                <div id="arenaJoinErr" style="color:#ef4444;font-size:0.85rem;display:none"></div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                <button class="btn btn-primary" onclick="arenaDoJoin()">Join Room</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
    document.getElementById('arenaJoinCode')?.focus();
}
window.arenaJoinModal = arenaJoinModal;

async function arenaDoJoin() {
    const code = document.getElementById('arenaJoinCode')?.value.trim().toUpperCase();
    const errEl = document.getElementById('arenaJoinErr');
    if (!code) { if (errEl) { errEl.textContent='Enter a join code.'; errEl.style.display='block'; } return; }
    const { res, body } = await apiRequest('/api/arena/sessions/join', {
        method: 'POST', body: JSON.stringify({ join_code: code })
    });
    if (res.ok) {
        document.querySelector('.modal.active')?.remove();
        arenaOpenSession(body.id);
    } else {
        if (errEl) { errEl.textContent = body?.error || 'Code not found.'; errEl.style.display='block'; }
    }
}
window.arenaDoJoin = arenaDoJoin;

// ── Session view ──────────────────────────────────────────────────────────────
async function arenaOpenSession(sessionId) {
    arenaClearPoll();               // clear any previous timer first
    _arenaSessionId = sessionId;    // THEN set the new session id
    _arenaLastChatId = 0;
    const main = document.getElementById('appMainContent');
    if (!main) return;
    main.innerHTML = `<div class="std-page"><div style="color:#94a3b8;padding:40px">Loading war room...</div></div>`;
    await arenaRenderSession(sessionId, main);
    _arenaChatPollTimer = setInterval(() => arenaPollChat(sessionId), 5000);
}
window.arenaOpenSession = arenaOpenSession;

async function arenaRenderSession(sessionId, main) {
    const { res, body: session } = await apiRequest(`/api/arena/sessions/${sessionId}`).catch(() => ({ res:{ok:false}, body:null }));
    if (!res.ok || !session) {
        main.innerHTML = `<div class="std-page"><div class="friends-empty">Failed to load session.</div></div>`;
        return;
    }
    const myId = parseInt(localStorage.getItem('userId') || '0');
    const isCreator = session.creator_user_id === myId;
    const diffColor = { alpha:'#ef4444', beta:'#3b82f6', gamma:'#22c55e' }[session.difficulty] || '#94a3b8';

    // Group creatures by owner
    const byOwner = {};
    (session.creatures || []).forEach(c => {
        if (!byOwner[c.owner]) byOwner[c.owner] = { userId: c.user_id, creatures: [] };
        byOwner[c.owner].creatures.push(c);
    });

    main.innerHTML = `
        <div class="std-page arena-session-page">
            <div class="arena-session-header">
                <button class="btn btn-secondary btn-sm" onclick="arenaClearPoll();loadArenaPage()">← War Rooms</button>
                <div class="arena-session-title">
                    <h1>👑 ${session.boss_name || session.boss_id}</h1>
                    <div class="arena-session-meta">
                        <span style="color:${diffColor}">${session.difficulty?.toUpperCase()}</span>
                        <span>· 👥 ${session.members?.length || 0} members</span>
                        <span>· 🔑 <strong style="letter-spacing:0.08em">${session.join_code}</strong></span>
                        <span class="arena-session-status ${session.status}">${session.status}</span>
                    </div>
                </div>
                <div style="display:flex;gap:8px">
                    <button class="btn btn-secondary btn-sm" onclick="arenaInviteModal(${sessionId})">+ Invite</button>
                    ${isCreator && session.status === 'open'
                        ? `<button class="btn btn-danger btn-sm" onclick="arenaCloseSession(${sessionId})">Close Room</button>`
                        : ''}
                </div>
            </div>

            <div class="arena-layout">
                <!-- Roster -->
                <div class="arena-roster-panel">
                    <div class="arena-panel-header">
                        <span>🦖 Roster (${session.creatures?.length || 0})</span>
                        ${session.status === 'open'
                            ? `<button class="btn btn-primary btn-sm" onclick="arenaAddNuggieModal(${sessionId})">+ Add Nuggie</button>`
                            : ''}
                    </div>
                    <div class="arena-roster-list" id="arenaRoster">
                        ${Object.keys(byOwner).length === 0
                            ? `<div class="friends-empty" style="padding:20px 0">No creatures added yet. Add your Nuggies to the roster!</div>`
                            : Object.entries(byOwner).map(([owner, data]) => `
                                <div class="arena-roster-group">
                                    <div class="arena-roster-owner">👤 ${owner}</div>
                                    ${data.creatures.map(c => {
                                        const cr = c.creature;
                                        const isMine = c.user_id === myId;
                                        return `<div class="arena-roster-card">
                                            <div>
                                                <div class="arena-roster-name">${cr.name || 'Unnamed'}</div>
                                                <div class="arena-roster-species">${cr.species || '?'} · Lvl ${cr.level || 1}</div>
                                                <div class="arena-roster-stats">HP ${cr.baseStats?.Health||0} · Mel ${cr.baseStats?.Melee||0}</div>
                                            </div>
                                            ${isMine && session.status === 'open'
                                                ? `<button class="btn btn-danger btn-sm" onclick="arenaRemoveCreature(${sessionId},${c.id})">✕</button>`
                                                : ''}
                                        </div>`;
                                    }).join('')}
                                </div>`
                            ).join('')}
                    </div>
                </div>

                <!-- Chat -->
                <div class="arena-chat-panel">
                    <div class="arena-panel-header"><span>💬 Chat</span></div>
                    <div class="arena-chat-messages" id="arenaChatMessages">
                        <div style="color:#64748b;text-align:center;padding:20px">Loading chat...</div>
                    </div>
                    ${session.status === 'open' ? `
                    <div class="arena-chat-input-row">
                        <input id="arenaChatInput" class="form-control" placeholder="Type a message... (Enter to send)"
                            onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();arenaSendChat(${sessionId},'text')}">
                        <button class="btn btn-secondary btn-sm" onclick="arenaShareNuggieModal(${sessionId})" title="Share a Nuggie">🦖</button>
                        <button class="btn btn-primary btn-sm" onclick="arenaSendChat(${sessionId},'text')">Send</button>
                    </div>` : `<div style="color:#64748b;font-size:0.85rem;padding:10px;text-align:center">This war room is closed.</div>`}
                </div>
            </div>
        </div>`;

    // Load initial chat
    await arenaPollChat(sessionId, true);
}

async function arenaPollChat(sessionId, initial) {
    if (_arenaSessionId !== sessionId) return; // navigated away

    const chatEl = document.getElementById('arenaChatMessages');
    if (!chatEl) return;

    const { res, body } = await apiRequest(`/api/arena/sessions/${sessionId}/chat?since=${_arenaLastChatId}`).catch(() => ({ res:{ok:false}, body:[] }));

    // On initial load, always clear "Loading chat..." regardless of whether there are messages
    if (initial) {
        chatEl.innerHTML = '';
        if (!res.ok || !Array.isArray(body) || !body.length) {
            chatEl.innerHTML = '<div style="color:#64748b;text-align:center;padding:20px;font-size:0.88rem">No messages yet. Say hello! 👋</div>';
            return;
        }
    } else if (!res.ok || !Array.isArray(body) || !body.length) {
        return;
    }

    body.forEach(msg => {
        if (msg.id > _arenaLastChatId) _arenaLastChatId = msg.id;
        const div = document.createElement('div');
        div.className = 'arena-chat-msg';
        const myId = parseInt(localStorage.getItem('userId') || '0');
        const isMe = msg.user_id === myId;
        const time = msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : '';

        if (msg.message_type === 'creature') {
            const cr = msg.content || {};
            const bs = cr.baseStats || {};
            div.innerHTML = `
                <div class="arena-chat-bubble ${isMe ? 'mine' : ''}">
                    <div class="arena-chat-sender">${isMe ? 'You' : msg.sender} shared a Nuggie</div>
                    <div class="arena-nuggie-share">
                        <div class="arena-roster-name">${cr.name || 'Unnamed'}</div>
                        <div class="arena-roster-species">${cr.species || '?'} · Lvl ${cr.level || 1}</div>
                        <div class="arena-roster-stats">❤️ ${bs.Health||0} · ⚔️ ${bs.Melee||0} · ⚡ ${bs.Stamina||0} · 🏋️ ${bs.Weight||0}</div>
                    </div>
                    <div class="arena-chat-time">${time}</div>
                </div>`;
        } else {
            div.innerHTML = `
                <div class="arena-chat-bubble ${isMe ? 'mine' : ''}">
                    <div class="arena-chat-sender">${isMe ? 'You' : msg.sender}</div>
                    <div class="arena-chat-text">${msg.content}</div>
                    <div class="arena-chat-time">${time}</div>
                </div>`;
        }
        chatEl.appendChild(div);
    });

    // Scroll to bottom
    chatEl.scrollTop = chatEl.scrollHeight;
}

async function arenaSendChat(sessionId, type) {
    const input = document.getElementById('arenaChatInput');
    const text = input?.value.trim();
    if (!text) return;
    input.value = '';
    await apiRequest(`/api/arena/sessions/${sessionId}/chat`, {
        method: 'POST', body: JSON.stringify({ message_type: 'text', content: text })
    });
    await arenaPollChat(sessionId, false);
}
window.arenaSendChat = arenaSendChat;

// Add Nuggie to roster modal
function arenaAddNuggieModal(sessionId) {
    const creatures = window.appState?.creatures || [];
    if (!creatures.length) return alert('No Nuggies in My Nuggies yet!');
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:500px">
            <div class="modal-header">
                <h2 class="modal-title">🦖 Add to Roster</h2>
                <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="modal-body"><div class="nuggie-picker">
                ${creatures.map(c => `
                <div class="nuggie-pick-card" onclick="arenaAddCreature(${sessionId},'${c.id}',this)">
                    <div class="nuggie-pick-name">${c.name||'Unnamed'}</div>
                    <div class="nuggie-pick-species">${c.species||'?'} · Lvl ${c.level||1}</div>
                    <div class="nuggie-pick-stats">HP ${c.baseStats?.Health||0} · Mel ${c.baseStats?.Melee||0}</div>
                </div>`).join('')}
            </div></div>
        </div>`;
    document.body.appendChild(modal);
}
window.arenaAddNuggieModal = arenaAddNuggieModal;

async function arenaAddCreature(sessionId, creatureId, el) {
    const creature = (window.appState?.creatures||[]).find(c => c.id === creatureId);
    if (!creature) return;
    const { res, body } = await apiRequest(`/api/arena/sessions/${sessionId}/creatures`, {
        method: 'POST', body: JSON.stringify({ creature_data: creature })
    });
    if (res.ok) {
        el.closest('.modal')?.remove();
        await arenaRenderSession(sessionId, document.getElementById('appMainContent'));
    } else { alert(body?.error || 'Failed to add creature.'); }
}
window.arenaAddCreature = arenaAddCreature;

async function arenaRemoveCreature(sessionId, creatureEntryId) {
    if (!confirm('Remove this creature from the roster?')) return;
    const { res } = await apiRequest(`/api/arena/sessions/${sessionId}/creatures/${creatureEntryId}`, { method: 'DELETE' });
    if (res.ok) arenaRenderSession(sessionId, document.getElementById('appMainContent'));
}
window.arenaRemoveCreature = arenaRemoveCreature;

// Share Nuggie into chat
function arenaShareNuggieModal(sessionId) {
    const creatures = window.appState?.creatures || [];
    if (!creatures.length) return alert('No Nuggies to share!');
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:500px">
            <div class="modal-header">
                <h2 class="modal-title">🦖 Share Nuggie to Chat</h2>
                <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="modal-body"><div class="nuggie-picker">
                ${creatures.map(c => `
                <div class="nuggie-pick-card" onclick="arenaShareNuggie(${sessionId},'${c.id}',this)">
                    <div class="nuggie-pick-name">${c.name||'Unnamed'}</div>
                    <div class="nuggie-pick-species">${c.species||'?'}</div>
                    <div class="nuggie-pick-stats">HP ${c.baseStats?.Health||0} · Mel ${c.baseStats?.Melee||0}</div>
                </div>`).join('')}
            </div></div>
        </div>`;
    document.body.appendChild(modal);
}
window.arenaShareNuggieModal = arenaShareNuggieModal;

async function arenaShareNuggie(sessionId, creatureId, el) {
    const creature = (window.appState?.creatures||[]).find(c => c.id === creatureId);
    if (!creature) return;
    await apiRequest(`/api/arena/sessions/${sessionId}/chat`, {
        method: 'POST', body: JSON.stringify({ message_type: 'creature', content: creature })
    });
    el.closest('.modal')?.remove();
    await arenaPollChat(sessionId, false);
}
window.arenaShareNuggie = arenaShareNuggie;

// Invite modal
function arenaInviteModal(sessionId) {
    const friends = [];
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:400px">
            <div class="modal-header">
                <h2 class="modal-title">+ Invite Player</h2>
                <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="modal-body" style="display:flex;flex-direction:column;gap:12px">
                <div style="color:#94a3b8;font-size:0.85rem">Search for a user to invite directly, or share the join code with them.</div>
                <div class="plan-field">
                    <label class="form-label">Search by email or nickname</label>
                    <div style="display:flex;gap:8px">
                        <input id="arenaInviteSearch" class="form-control" placeholder="username...">
                        <button class="btn btn-secondary" onclick="arenaSearchInvite(${sessionId})">Find</button>
                    </div>
                </div>
                <div id="arenaInviteResults"></div>
                <div id="arenaInviteErr" style="color:#ef4444;font-size:0.85rem;display:none"></div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Done</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
    document.getElementById('arenaInviteSearch')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') arenaSearchInvite(sessionId);
    });
}
window.arenaInviteModal = arenaInviteModal;

async function arenaSearchInvite(sessionId) {
    const q = document.getElementById('arenaInviteSearch')?.value.trim();
    const resultsEl = document.getElementById('arenaInviteResults');
    if (!q || !resultsEl) return;
    resultsEl.innerHTML = '<div style="color:#94a3b8;font-size:0.85rem">Searching...</div>';
    const { res, body } = await apiRequest(`/api/users/search?q=${encodeURIComponent(q)}`);
    if (!res.ok || !Array.isArray(body) || !body.length) {
        resultsEl.innerHTML = '<div style="color:#64748b;font-size:0.85rem">No users found.</div>';
        return;
    }
    resultsEl.innerHTML = body.map(u => `
        <div class="friend-card" style="margin-top:8px">
            <div class="friend-avatar">👤</div>
            <div class="friend-info">
                <div class="friend-name">${u.nickname || u.email}</div>
            </div>
            <button class="btn btn-primary btn-sm" onclick="arenaDoInvite(${sessionId},${u.id},this)">Invite</button>
        </div>`).join('');
}
window.arenaSearchInvite = arenaSearchInvite;

async function arenaDoInvite(sessionId, userId, btn) {
    if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }
    const { res, body } = await apiRequest(`/api/arena/sessions/${sessionId}/invite`, {
        method: 'POST', body: JSON.stringify({ user_id: userId })
    });
    if (res.ok) { if (btn) { btn.textContent = 'Invited ✓'; btn.className = 'btn btn-secondary btn-sm'; } }
    else { if (btn) { btn.disabled = false; btn.textContent = 'Invite'; } alert(body?.error || 'Failed to invite.'); }
}
window.arenaDoInvite = arenaDoInvite;

async function arenaCloseSession(sessionId) {
    if (!confirm('Close this war room? Members will no longer be able to chat or add creatures.')) return;
    const { res, body } = await apiRequest(`/api/arena/sessions/${sessionId}/close`, { method: 'PUT' });
    if (res.ok) { arenaClearPoll(); loadArenaPage(); }
    else alert(body?.error || 'Failed to close.');
}
window.arenaCloseSession = arenaCloseSession;

function arenaClearPoll() {
    if (_arenaChatPollTimer) { clearInterval(_arenaChatPollTimer); _arenaChatPollTimer = null; }
    _arenaSessionId = null;
}
window.arenaClearPoll = arenaClearPoll;

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

// ── Public Creature Pages (hash routing) ─────────────────────────────────────
async function loadCreaturePublicPage(creatureId) {
    const main = document.getElementById('appMainContent');
    if (!main) return;
    main.innerHTML = `<div class="std-page"><div style="color:#94a3b8;padding:40px 0">Loading creature...</div></div>`;

    const { res, body } = await apiRequest(`/api/creatures/public/${creatureId}`).catch(() => ({ res: { ok: false }, body: null }));
    if (!res.ok || !body) {
        main.innerHTML = `<div class="std-page"><div class="friends-empty" style="padding:60px 0">Creature not found or has been removed.</div></div>`;
        return;
    }

    const d = body.data || {};
    const db2 = window.SPECIES_DATABASE || {};
    const sp = db2[d.species] || {};
    const emoji = sp.emoji || '🦕';
    const badges = (window.BadgeSystem?.calculateAchievements?.(d) || []);
    const myId = parseInt(localStorage.getItem('userId') || '0');
    const isOwner = body.owner_id === myId;

    const statRow = (label, val) => val !== undefined && val !== null
        ? `<div class="tc-sum-row"><span>${label}</span><span class="tc-sum-val">${typeof val === 'number' ? val.toLocaleString() : val}</span></div>`
        : '';

    main.innerHTML = `
        <div class="std-page">
            <div class="std-page-header">
                <div class="page-title"><h1>${emoji} ${d.name || 'Unnamed'}</h1><div class="page-subtitle">${d.species || ''} · Owner: ${body.owner_nickname || 'Unknown'}</div></div>
                <div style="display:flex;gap:8px">
                    <button class="btn btn-secondary" onclick="shareCreatureUrl(${body.id})">🔗 Copy Link</button>
                    ${!isOwner ? `<button class="btn btn-primary" onclick="requestCreatureTrade(${body.owner_id},'${(body.owner_nickname||'').replace(/'/g,"\\'")}','${(d.name||'').replace(/'/g,"\\'")}')">🔁 Request Trade</button>` : ''}
                </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
                <div class="profile-card">
                    <div class="profile-card-header"><h3>📊 Base Stats</h3></div>
                    <div class="tc-summary">
                        ${statRow('❤️ Health', d.baseStats?.Health)}
                        ${statRow('🏃 Stamina', d.baseStats?.Stamina)}
                        ${statRow('🫁 Oxygen', d.baseStats?.Oxygen)}
                        ${statRow('🍖 Food', d.baseStats?.Food)}
                        ${statRow('⚖️ Weight', d.baseStats?.Weight)}
                        ${statRow('⚔️ Melee', d.baseStats?.Melee ? d.baseStats.Melee + '%' : undefined)}
                        ${statRow('💨 Speed', d.baseStats?.Speed ? d.baseStats.Speed + '%' : undefined)}
                    </div>
                </div>
                <div class="profile-card">
                    <div class="profile-card-header"><h3>📋 Details</h3></div>
                    <div class="tc-summary">
                        ${statRow('Level', d.level)}
                        ${statRow('Gender', d.gender)}
                        ${statRow('Map', d.map)}
                        ${statRow('Mutations', d.mutations)}
                        ${d.notes ? `<div style="color:#94a3b8;font-size:0.85rem;margin-top:8px;font-style:italic">${d.notes.replace(/</g,'&lt;')}</div>` : ''}
                    </div>
                    ${badges.length > 0 ? `
                    <div style="margin-top:14px">
                        <div style="color:#64748b;font-size:0.75rem;text-transform:uppercase;margin-bottom:6px">Badges</div>
                        <div style="display:flex;flex-wrap:wrap;gap:6px">
                            ${badges.map(b => `<span class="badge-${b.tier}" style="font-size:0.8rem;padding:3px 10px;border-radius:10px">${b.name}</span>`).join('')}
                        </div>
                    </div>` : ''}
                </div>
            </div>
            <div class="profile-card" style="margin-top:16px">
                <div class="profile-card-header"><h3>💬 Community Reactions</h3></div>
                <div class="reaction-bar-placeholder" data-type="creature" data-id="${body.id}"></div>
            </div>
        </div>`;

    loadAndInjectReactions('creature', [body.id]);
    // Update browser hash without triggering another load
    if (window.location.hash !== `#creature/${body.id}`) {
        history.pushState(null, '', `#creature/${body.id}`);
    }
}
window.loadCreaturePublicPage = loadCreaturePublicPage;

function shareCreatureUrl(creatureId) {
    const url = `${window.location.origin}${window.location.pathname}#creature/${creatureId}`;
    navigator.clipboard?.writeText(url).then(() => alert('Link copied to clipboard!')).catch(() => {
        prompt('Copy this link:', url);
    });
}
window.shareCreatureUrl = shareCreatureUrl;

function requestCreatureTrade(ownerId, ownerName, creatureName) {
    // Open DM thread with the owner with a pre-filled message
    openDMThread(ownerId, ownerName).then(() => {
        setTimeout(() => {
            const input = document.getElementById('dmInput');
            if (input) input.value = `Hi! I'm interested in trading for your ${creatureName}. Are you open to offers?`;
        }, 100);
    });
}
window.requestCreatureTrade = requestCreatureTrade;

// Hash-based routing: handle #creature/ID on page load and hash change
function handleHashRoute() {
    const hash = window.location.hash;
    const match = hash.match(/^#creature\/(\d+)$/);
    if (match && localStorage.getItem('token')) {
        loadCreaturePublicPage(parseInt(match[1]));
        return true;
    }
    return false;
}
window.handleHashRoute = handleHashRoute;

// ── Wild Find Reports Page ────────────────────────────────────────────────────
async function loadWildFindsPage() {
    setActiveNavButton('wildfinds');
    const main = document.getElementById('appMainContent');
    if (!main) return;
    main.innerHTML = `<div class="std-page"><div style="color:#94a3b8;padding:40px 0">Loading wild finds...</div></div>`;

    const finds = await apiRequest('/api/wild-finds').then(r => Array.isArray(r.body) ? r.body : []).catch(() => []);
    const myId = parseInt(localStorage.getItem('userId') || '0');
    const db2 = window.SPECIES_DATABASE || {};

    const timeAgo = ts => {
        const diff = Date.now() - new Date(ts).getTime();
        const m = Math.floor(diff / 60000);
        if (m < 60) return `${m}m ago`;
        const h = Math.floor(m / 60);
        return `${h}h ago`;
    };

    const findCard = f => {
        const sp = db2[f.species] || {};
        const emoji = sp.emoji || '🦕';
        const isHigh = f.level >= 130;
        const isOwn = f.user_id === myId;
        return `<div class="wf-card${isHigh ? ' wf-card--high' : ''}">
            <div class="wf-avatar">${emoji}</div>
            <div class="wf-info">
                <div class="wf-species">${f.species} <span class="wf-level${isHigh ? ' high' : ''}">Lv ${f.level}</span></div>
                ${f.map_name ? `<div class="wf-map">📍 ${f.map_name}${f.coordinates ? ` · ${f.coordinates}` : ''}</div>` : ''}
                ${f.notes ? `<div class="wf-notes">${f.notes.replace(/</g,'&lt;')}</div>` : ''}
                <div class="wf-meta">👤 ${f.reporter_nickname || 'Unknown'} · ${timeAgo(f.created_at)}</div>
            </div>
            ${isOwn ? `<button class="btn btn-sm btn-danger" onclick="wildFindDelete(${f.id})">✕</button>` : ''}
        </div>
        <div class="reaction-bar-placeholder" data-type="wild_find" data-id="${f.id}"></div>`;
    };

    main.innerHTML = `
        <div class="std-page">
            <div class="std-page-header">
                <div class="page-title"><h1>🗺️ Wild Finds</h1><div class="page-subtitle">Community creature sightings · Expire after 24h</div></div>
                <button class="btn btn-primary" onclick="wildFindOpenModal()">+ Report Sighting</button>
            </div>

            ${finds.length === 0
                ? `<div class="friends-empty" style="padding:60px 0">No active sightings. Be the first to report one!</div>`
                : `<div class="wf-grid">${finds.map(findCard).join('')}</div>`
            }
        </div>`;
    // Inject reactions
    if (finds.length) loadAndInjectReactions('wild_find', finds.map(f => f.id));
}
window.loadWildFindsPage = loadWildFindsPage;

function wildFindOpenModal() {
    const db2 = window.SPECIES_DATABASE || {};
    const speciesOptions = Object.keys(db2).sort().map(k => `<option value="${k}">${k}</option>`).join('');
    const mapOptions = (window.ARK_MAPS || ['The Island','Scorched Earth','Aberration','Extinction','Genesis Part 1','Genesis Part 2','Crystal Isles','Fjordur','Lost Island','Ragnarok','Valguero','The Center','Caballus','Astraeos','Svartalfheim','Lost Colony'])
        .map(m => `<option value="${m}">${m}</option>`).join('');
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:460px">
            <div class="modal-header"><h2 class="modal-title">🗺️ Report Wild Sighting</h2><button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button></div>
            <div class="modal-body" style="display:flex;flex-direction:column;gap:14px">
                <div class="plan-field">
                    <label class="form-label">Species</label>
                    <select id="wfSpecies" class="form-control"><option value="">— Select species —</option>${speciesOptions}</select>
                </div>
                <div class="plan-field">
                    <label class="form-label">Wild Level</label>
                    <input id="wfLevel" class="form-control" type="number" min="1" max="9999" placeholder="e.g. 145">
                </div>
                <div class="plan-field">
                    <label class="form-label">Map</label>
                    <select id="wfMap" class="form-control"><option value="">— Select map —</option>${mapOptions}</select>
                </div>
                <div class="plan-field">
                    <label class="form-label">Coordinates <span style="color:#64748b;font-size:0.8rem">(optional)</span></label>
                    <input id="wfCoords" class="form-control" placeholder="e.g. 45.2 / 62.8">
                </div>
                <div class="plan-field">
                    <label class="form-label">Notes <span style="color:#64748b;font-size:0.8rem">(optional)</span></label>
                    <input id="wfNotes" class="form-control" placeholder="Color mutation, near a resource node, etc.">
                </div>
                <div id="wfError" style="color:#ef4444;font-size:0.85rem;display:none"></div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                <button class="btn btn-primary" onclick="wildFindSubmit()">Report Sighting</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
}
window.wildFindOpenModal = wildFindOpenModal;

async function wildFindSubmit() {
    const species = document.getElementById('wfSpecies')?.value;
    const level = parseInt(document.getElementById('wfLevel')?.value);
    const map_name = document.getElementById('wfMap')?.value || null;
    const coordinates = document.getElementById('wfCoords')?.value?.trim() || null;
    const notes = document.getElementById('wfNotes')?.value?.trim() || null;
    const errEl = document.getElementById('wfError');
    if (!species) { if (errEl) { errEl.textContent = 'Select a species.'; errEl.style.display = 'block'; } return; }
    if (!level || level < 1) { if (errEl) { errEl.textContent = 'Enter a valid level.'; errEl.style.display = 'block'; } return; }
    const { res, body } = await apiRequest('/api/wild-finds', { method: 'POST', body: JSON.stringify({ species, level, map_name, coordinates, notes }) });
    if (res.ok) { document.querySelector('.modal.active')?.remove(); loadWildFindsPage(); }
    else if (errEl) { errEl.textContent = body?.error || 'Failed to submit.'; errEl.style.display = 'block'; }
}
window.wildFindSubmit = wildFindSubmit;

async function wildFindDelete(id) {
    if (!confirm('Remove this sighting?')) return;
    await apiRequest(`/api/wild-finds/${id}`, { method: 'DELETE' });
    loadWildFindsPage();
}
window.wildFindDelete = wildFindDelete;

// ── Wild Tame Calculator ──────────────────────────────────────────────────────
// Approximate per-stat wild increase rates (per wild level point allocated)
const TAME_STAT_INCREASE = {
    Health: 0.20, Stamina: 0.10, Oxygen: 0.10, Food: 0.10,
    Weight: 0.04, Melee: 0.05, Speed: 0.00, Crafting: 0.05
};
const TAME_BONUS_MULT = 0.14; // taming bonus applied to all stats (most creatures)
const TAME_FOOD_EFFECTIVENESS = {
    'Kibble (Best)': 99.9,
    'Preferred Kibble': 96,
    'Preferred Food': 88,
    'Raw Meat / Berries': 75,
    'Raw Fish': 80,
    'Cooked Meat': 50,
    'Vegetables (Herbivore)': 82,
    'Custom %': 0
};

function loadTameCalcPage() {
    setActiveNavButton('tamecalc');
    const main = document.getElementById('appMainContent');
    if (!main) return;
    const db2 = window.SPECIES_DATABASE || {};
    const speciesOptions = Object.keys(db2).sort().map(k => `<option value="${k}">${k}</option>`).join('');
    const foodOptions = Object.keys(TAME_FOOD_EFFECTIVENESS)
        .map(f => `<option value="${f}">${f}</option>`).join('');

    main.innerHTML = `
        <div class="std-page">
            <div class="std-page-header">
                <div class="page-title"><h1>🧮 Wild Tame Calculator</h1><div class="page-subtitle">Estimate post-tame stats before you commit</div></div>
            </div>
            <div class="tamecalc-layout">
                <!-- Inputs -->
                <div class="tamecalc-inputs profile-card">
                    <div class="profile-card-header"><h3>⚙️ Inputs</h3></div>
                    <div class="tc-field">
                        <label class="form-label">Species</label>
                        <select id="tcSpecies" class="form-control" onchange="tameCalcRun()">
                            <option value="">— Select species (optional) —</option>
                            ${speciesOptions}
                        </select>
                    </div>
                    <div class="tc-field">
                        <label class="form-label">Wild Level</label>
                        <input id="tcLevel" class="form-control" type="number" min="1" max="1500" value="150" oninput="tameCalcRun()">
                    </div>
                    <div class="tc-field">
                        <label class="form-label">Taming Food</label>
                        <select id="tcFood" class="form-control" onchange="tameCalcFoodChanged()">
                            ${foodOptions}
                        </select>
                    </div>
                    <div class="tc-field" id="tcCustomEffRow" style="display:none">
                        <label class="form-label">Custom Effectiveness %</label>
                        <input id="tcCustomEff" class="form-control" type="number" min="0" max="100" value="99" oninput="tameCalcRun()">
                    </div>
                    <button class="btn btn-primary" style="width:100%;margin-top:8px" onclick="tameCalcRun()">Calculate</button>
                </div>

                <!-- Results -->
                <div class="tamecalc-results profile-card">
                    <div class="profile-card-header"><h3>📊 Taming Results</h3></div>
                    <div id="tcResults" style="color:#64748b;padding:20px 0;text-align:center">Enter a wild level and food type above.</div>
                </div>

                <!-- Reference Guide -->
                <div class="tamecalc-guide profile-card">
                    <div class="profile-card-header"><h3>📖 Effectiveness Guide</h3></div>
                    <div class="tc-guide-list">
                        ${Object.entries(TAME_FOOD_EFFECTIVENESS).filter(([k]) => k !== 'Custom %').map(([food, eff]) => `
                        <div class="tc-guide-row">
                            <span>${food}</span>
                            <span class="tc-eff-val" style="color:${eff >= 95 ? '#22c55e' : eff >= 80 ? '#f59e0b' : '#ef4444'}">${eff}%</span>
                        </div>`).join('')}
                    </div>
                    <div style="margin-top:16px;color:#64748b;font-size:0.8rem;line-height:1.5">
                        <strong>Tip:</strong> Higher effectiveness = higher post-tame stats and more bonus levels. Always use the best food you can!<br><br>
                        <strong>Bonus levels</strong> are "free" extra levels added after taming. At 99% effectiveness, a Lv 150 gets ~75 bonus levels.
                    </div>
                </div>
            </div>
        </div>`;
    tameCalcRun();
}
window.loadTameCalcPage = loadTameCalcPage;

function tameCalcFoodChanged() {
    const food = document.getElementById('tcFood')?.value;
    const customRow = document.getElementById('tcCustomEffRow');
    if (customRow) customRow.style.display = food === 'Custom %' ? 'block' : 'none';
    tameCalcRun();
}
window.tameCalcFoodChanged = tameCalcFoodChanged;

function tameCalcRun() {
    const resultsEl = document.getElementById('tcResults');
    if (!resultsEl) return;

    const wildLevel = parseInt(document.getElementById('tcLevel')?.value) || 150;
    const food = document.getElementById('tcFood')?.value || 'Kibble (Best)';
    const speciesKey = document.getElementById('tcSpecies')?.value || '';

    let effectiveness = TAME_FOOD_EFFECTIVENESS[food] ?? 99.9;
    if (food === 'Custom %') {
        effectiveness = parseFloat(document.getElementById('tcCustomEff')?.value) || 99;
    }
    effectiveness = Math.max(0, Math.min(100, effectiveness));

    // Bonus levels formula: floor(wildLevel * 0.5 * effectiveness/100)
    const bonusLevels = Math.floor(wildLevel * 0.5 * (effectiveness / 100));
    const totalLevel = wildLevel + bonusLevels;
    const effDecimal = effectiveness / 100;

    // Get species base stats if available
    const db2 = window.SPECIES_DATABASE || {};
    const sp = db2[speciesKey] || {};
    const baseStats = sp.baseStats || sp.stats || null;

    // Build stat estimates (wild level splits ~equally across 7 stats)
    const avgPointsPerStat = wildLevel / 7;
    const statResults = [];

    const STAT_KEYS = ['Health', 'Stamina', 'Oxygen', 'Food', 'Weight', 'Melee'];
    STAT_KEYS.forEach(stat => {
        const wildIncrease = TAME_STAT_INCREASE[stat] || 0.1;
        let baseStat = baseStats?.[stat] ?? null;
        if (!baseStat) return;

        const wildMult = 1 + avgPointsPerStat * wildIncrease;
        const tamingMult = 1 + effDecimal * TAME_BONUS_MULT;
        const estimated = Math.round(baseStat * wildMult * tamingMult);

        const isMelee = stat === 'Melee';
        const display = isMelee ? `${estimated}%` : estimated.toLocaleString();
        statResults.push({ stat, estimated: display, base: isMelee ? `${baseStat}%` : baseStat.toLocaleString() });
    });

    const effColor = effectiveness >= 95 ? '#22c55e' : effectiveness >= 80 ? '#f59e0b' : '#ef4444';

    resultsEl.innerHTML = `
        <div class="tc-summary">
            <div class="tc-sum-row"><span>Wild Level</span><span class="tc-sum-val">${wildLevel}</span></div>
            <div class="tc-sum-row"><span>Taming Effectiveness</span><span class="tc-sum-val" style="color:${effColor}">${effectiveness.toFixed(1)}%</span></div>
            <div class="tc-sum-row"><span>Bonus Levels</span><span class="tc-sum-val" style="color:#f59e0b">+${bonusLevels}</span></div>
            <div class="tc-sum-row highlight"><span>Total Post-Tame Level</span><span class="tc-sum-val" style="color:var(--tc-1,#3b82f6);font-size:1.3rem">${totalLevel}</span></div>
        </div>
        ${statResults.length > 0 ? `
        <div style="margin-top:16px">
            <div style="color:#94a3b8;font-size:0.8rem;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px">Estimated Post-Tame Stats</div>
            ${statResults.map(s => `
            <div class="tc-stat-row">
                <span class="tc-stat-name">${s.stat}</span>
                <span class="tc-stat-base" title="Species base stat">Base: ${s.base}</span>
                <span class="tc-stat-result">≈ ${s.estimated}</span>
            </div>`).join('')}
            <div style="color:#475569;font-size:0.75rem;margin-top:12px">* Estimates assume even wild stat distribution. Actual values vary based on random wild point allocation.</div>
        </div>` : `<div style="color:#64748b;margin-top:12px;font-size:0.85rem">Select a species above to see estimated stats, or use the level and effectiveness summary.</div>`}`;
}
window.tameCalcRun = tameCalcRun;

// ── Global Leaderboards Page ──────────────────────────────────────────────────
async function loadLeaderboardsPage() {
    setActiveNavButton('leaderboards');
    const main = document.getElementById('appMainContent');
    if (!main) return;
    main.innerHTML = `<div class="std-page"><div style="color:#94a3b8;padding:40px 0">Loading leaderboards...</div></div>`;

    // Fetch all leaderboard data in parallel
    const [meleeTop, healthTop, playersCreatures, playersTraders, playersFriends, tribesTop] = await Promise.all([
        apiRequest('/api/leaderboards/creatures?stat=Melee&limit=10').then(r => Array.isArray(r.body) ? r.body : []).catch(() => []),
        apiRequest('/api/leaderboards/creatures?stat=Health&limit=10').then(r => Array.isArray(r.body) ? r.body : []).catch(() => []),
        apiRequest('/api/leaderboards/players?type=creatures&limit=10').then(r => Array.isArray(r.body) ? r.body : []).catch(() => []),
        apiRequest('/api/leaderboards/players?type=traders&limit=10').then(r => Array.isArray(r.body) ? r.body : []).catch(() => []),
        apiRequest('/api/leaderboards/players?type=friends&limit=10').then(r => Array.isArray(r.body) ? r.body : []).catch(() => []),
        apiRequest('/api/leaderboards/tribes?limit=10').then(r => Array.isArray(r.body) ? r.body : []).catch(() => [])
    ]);

    const myId = parseInt(localStorage.getItem('userId') || '0');

    const rankMedal = r => r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : `#${r}`;
    const isMe = id => id === myId ? ' style="background:rgba(59,130,246,0.12);font-weight:bold"' : '';

    const creatureRow = (c, i) => `
        <div class="lb-row" ${isMe(c.owner_id)}>
            <span class="lb-rank">${rankMedal(i+1)}</span>
            <span class="lb-name">${esc(c.name) || 'Unnamed'} <span class="lb-sub">${esc(c.species)}</span></span>
            <span class="lb-owner">${esc(c.owner)}</span>
            <span class="lb-score">${typeof c.stat_val === 'number' ? Math.round(c.stat_val).toLocaleString() : '—'}</span>
        </div>`;

    const playerRow = (p, label) => `
        <div class="lb-row" ${isMe(p.id)}>
            <span class="lb-rank">${rankMedal(p.rank)}</span>
            <span class="lb-name">${esc(p.nickname) || 'Unknown'}</span>
            <span class="lb-score">${(p.score || 0).toLocaleString()} ${label}</span>
        </div>`;

    const tribeRow = (t) => `
        <div class="lb-row">
            <span class="lb-rank">${rankMedal(t.rank)}</span>
            <span class="lb-name">${esc(t.name) || 'Unknown'}</span>
            <span class="lb-score">${(t.member_count || 0).toLocaleString()} members</span>
        </div>`;

    main.innerHTML = `
        <div class="std-page">
            <div class="std-page-header">
                <div class="page-title"><h1>🏆 Global Leaderboards</h1><div class="page-subtitle">Top trainers, creatures, and tribes</div></div>
            </div>

            <div class="lb-grid">

                <!-- Top Melee -->
                <div class="lb-card">
                    <div class="lb-card-header">⚔️ Highest Melee</div>
                    <div class="lb-col-labels"><span>Rank</span><span>Creature</span><span>Owner</span><span>Melee %</span></div>
                    ${meleeTop.length ? meleeTop.map((c, i) => creatureRow(c, i)).join('') : '<div class="lb-empty">No data yet</div>'}
                </div>

                <!-- Top Health -->
                <div class="lb-card">
                    <div class="lb-card-header">❤️ Highest Health</div>
                    <div class="lb-col-labels"><span>Rank</span><span>Creature</span><span>Owner</span><span>HP</span></div>
                    ${healthTop.length ? healthTop.map((c, i) => creatureRow(c, i)).join('') : '<div class="lb-empty">No data yet</div>'}
                </div>

                <!-- Most Creatures -->
                <div class="lb-card">
                    <div class="lb-card-header">🦖 Biggest Army</div>
                    ${playersCreatures.length ? playersCreatures.map(p => playerRow(p, 'nuggies')).join('') : '<div class="lb-empty">No data yet</div>'}
                </div>

                <!-- Most Trades -->
                <div class="lb-card">
                    <div class="lb-card-header">🔁 Top Traders</div>
                    ${playersTraders.length ? playersTraders.map(p => playerRow(p, 'trades')).join('') : '<div class="lb-empty">No data yet</div>'}
                </div>

                <!-- Most Friends -->
                <div class="lb-card">
                    <div class="lb-card-header">👥 Most Connected</div>
                    ${playersFriends.length ? playersFriends.map(p => playerRow(p, 'friends')).join('') : '<div class="lb-empty">No data yet</div>'}
                </div>

                <!-- Biggest Tribes -->
                <div class="lb-card">
                    <div class="lb-card-header">🏛️ Biggest Tribes</div>
                    ${tribesTop.length ? tribesTop.map(t => tribeRow(t)).join('') : '<div class="lb-empty">No tribes yet</div>'}
                </div>

            </div>
        </div>`;
}
window.loadLeaderboardsPage = loadLeaderboardsPage;

// Load My Profile Page (Landing page after login)
async function loadMyProfilePage() {
    setActiveNavButton('profile');
    const main = document.getElementById('appMainContent');
    if (!main) return;
    main.innerHTML = `<div class="std-page"><div style="color:#94a3b8;padding:40px 0">Loading profile...</div></div>`;

    // Fetch real profile + friends + trades + activity feed in parallel
    const [profile, friends, trades, myOffers, feedItems] = await Promise.all([
        apiRequest('/api/profile').then(r => r.body || {}).catch(() => ({})),
        apiRequest('/api/friends?status=accepted').then(r => Array.isArray(r.body) ? r.body : []).catch(() => []),
        apiRequest('/api/trades').then(r => Array.isArray(r.body) ? r.body : []).catch(() => []),
        apiRequest('/api/offers').then(r => Array.isArray(r.body) ? r.body : []).catch(() => []),
        apiRequest('/api/feed').then(r => Array.isArray(r.body) ? r.body : []).catch(() => [])
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

    // Resolve pinned creatures from local creature list
    const pinnedIds = Array.isArray(profile.pinned_creatures) ? profile.pinned_creatures : [];
    const pinnedCreatures = pinnedIds.map(id => creatures.find(c => c.id === id)).filter(Boolean);

    main.innerHTML = `
        <div class="std-page profile-page-wrap">

            <!-- Hero header (with optional banner) -->
            <div class="profile-hero${profile.banner_image ? ' profile-hero--banner' : ''}" ${profile.banner_image ? `style="background-image:url('${profile.banner_image}')"` : ''}>
                ${profile.banner_image ? '<div class="profile-hero-overlay"></div>' : ''}
                <div class="profile-hero-avatar">🦕</div>
                <div class="profile-hero-info">
                    <h1 class="profile-hero-name">${esc(profile.nickname) || 'Trainer'}</h1>
                    <div class="profile-hero-sub">Dino Nuggie Trainer · Joined ${esc(joinedDate)}</div>
                    ${profile.tribe ? `<div class="profile-hero-tribe">🏛️ ${esc(profile.tribe.name)} <span style="color:#64748b;font-size:0.8rem">(${esc(profile.tribe.role)})</span></div>` : ''}
                    ${profile.bio ? `<div class="profile-hero-bio">${esc(profile.bio)}</div>` : ''}
                    ${profile.looking_for ? `<div class="profile-looking-for">👀 ${esc(profile.looking_for)}</div>` : ''}
                    <div class="profile-hero-stats">
                        <div class="profile-hstat"><span class="profile-hstat-val">${creatures.length}</span><span class="profile-hstat-lbl">Nuggies</span></div>
                        <div class="profile-hstat"><span class="profile-hstat-val">${speciesOwned}/${totalSpecies}</span><span class="profile-hstat-lbl">Species</span></div>
                        <div class="profile-hstat"><span class="profile-hstat-val">${friends.length}</span><span class="profile-hstat-lbl">Friends</span></div>
                        <div class="profile-hstat"><span class="profile-hstat-val">${badgeCount}</span><span class="profile-hstat-lbl">Badges</span></div>
                    </div>
                </div>
                <button class="profile-banner-edit-btn" onclick="profileEditBanner()" title="Change banner">🖼️ Banner</button>
            </div>

            <div class="profile-grid">

                <!-- Activity Feed -->
                <div class="profile-card" style="grid-column: 1 / -1">
                    <div class="profile-card-header"><h3>📰 Activity Feed</h3></div>
                    ${feedItems.length === 0
                        ? `<div class="friends-empty">No recent activity. Add friends to see their updates here!</div>`
                        : `<div class="feed-list">
                            ${feedItems.slice(0, 15).map(item => {
                                const ts = item.created_at ? new Date(item.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }) : '';
                                let icon = '📌', text = '';
                                const a = esc(item.actor);
                                switch(item.type) {
                                    case 'creature_added':
                                        icon = '🦕'; text = `<strong>${a}</strong> added <em>${esc(item.data?.name) || 'a creature'}</em>${item.data?.species ? ` (${esc(item.data.species)})` : ''}`; break;
                                    case 'trade_completed':
                                        icon = '🔁'; text = `<strong>${a}</strong> completed a trade`; break;
                                    case 'tribe_created':
                                        icon = '🏛️'; text = `<strong>${a}</strong> founded tribe <em>${esc(item.data?.tribe_name)}</em>`; break;
                                    case 'tribe_joined':
                                        icon = '🛡️'; text = `<strong>${a}</strong> joined a tribe`; break;
                                    case 'boss_plan_created':
                                        icon = '👑'; text = `<strong>${a}</strong> created a boss plan: <em>${esc(item.data?.boss_name)}</em>`; break;
                                    case 'arena_created':
                                        icon = '⚔️'; text = `<strong>${a}</strong> opened an Arena session: <em>${esc(item.data?.title)}</em>`; break;
                                    case 'boss_kill':
                                        icon = '☠️'; text = `<strong>${a}</strong> defeated <em>${esc(item.data?.boss_name)}</em> (${esc(item.data?.difficulty) || 'unknown'} difficulty)`; break;
                                    default:
                                        icon = '📌'; text = `<strong>${a}</strong> did something`;
                                }
                                return `<div class="feed-item">
                                    <span class="feed-icon">${icon}</span>
                                    <div class="feed-body">
                                        <div class="feed-text">${text}</div>
                                        <div class="feed-time">${ts}</div>
                                    </div>
                                </div>`;
                            }).join('')}
                           </div>`
                    }
                </div>

                <!-- Account Information -->
                <div class="profile-card">
                    <div class="profile-card-header">
                        <h3>👤 Account Information</h3>
                        <button class="btn btn-sm btn-secondary" onclick="profileEditModal()">Edit</button>
                    </div>
                    <div class="profile-info-list">
                        <div class="profile-info-row"><span class="pil-label">Email</span><span class="pil-val">${esc(profile.email) || '—'}</span></div>
                        <div class="profile-info-row"><span class="pil-label">Nickname</span><span class="pil-val">${esc(profile.nickname) || '—'}</span></div>
                        <div class="profile-info-row"><span class="pil-label">Discord</span><span class="pil-val">${esc(profile.discord_name) || 'Not set'}</span></div>
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

                <!-- Pinned Nuggies -->
                <div class="profile-card" style="grid-column: 1 / -1">
                    <div class="profile-card-header">
                        <h3>📌 Pinned Nuggies</h3>
                        <button class="btn btn-sm btn-secondary" onclick="profileOpenPinModal()">Edit Pins</button>
                    </div>
                    ${pinnedCreatures.length === 0
                        ? `<div class="friends-empty">No pinned creatures yet. Click "Edit Pins" to showcase up to 6 of your best.</div>`
                        : `<div class="profile-pinned-grid">
                            ${pinnedCreatures.map(c => {
                                const db2 = window.SPECIES_DATABASE || {};
                                const sp = db2[c.species] || {};
                                const emoji = sp.emoji || '🦕';
                                const topBadge = (window.BadgeSystem?.calculateAchievements?.(c) || [])[0];
                                return `<div class="profile-pinned-card">
                                    <div class="profile-pinned-avatar">${emoji}</div>
                                    <div class="profile-pinned-name">${c.name || 'Unnamed'}</div>
                                    <div class="profile-pinned-species">${c.species || ''}</div>
                                    ${topBadge ? `<div class="profile-pinned-badge badge-${topBadge.tier}">${topBadge.name}</div>` : ''}
                                    <div class="profile-pinned-stats">
                                        ${c.baseStats?.Health ? `<span>❤️ ${c.baseStats.Health.toLocaleString()}</span>` : ''}
                                        ${c.baseStats?.Melee ? `<span>⚔️ ${c.baseStats.Melee}%</span>` : ''}
                                    </div>
                                </div>`;
                            }).join('')}
                           </div>`
                    }
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
                        <button class="profile-setting-btn" onclick="profileToggleTheme()" id="themeToggleBtn">
                            <span>🎨 Site Theme: ${localStorage.getItem('useTribeColors') === 'false' ? 'Default' : 'Tribe Colors'}</span><span>→</span>
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
async function profileEditModal() {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    const email = localStorage.getItem('userEmail') || '';
    const nick = localStorage.getItem('userNickname') || '';
    // Fetch current profile to pre-fill bio/looking_for
    const prof = await apiRequest('/api/profile').then(r => r.body || {}).catch(() => ({}));
    const LOOKING_FOR_OPTIONS = [
        'Open to everything',
        'Looking for trade partners',
        'Seeking tribe members',
        'Looking for a tribe',
        'Seeking breeding partners',
        'Just browsing'
    ];
    modal.innerHTML = `
        <div class="modal-content" style="max-width:480px">
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
                    <input id="editDiscord" class="form-control" value="${prof.discord_name || ''}" placeholder="your_discord_name">
                </div>
                <div class="plan-field">
                    <label class="form-label">Bio <span style="color:#64748b;font-size:0.8rem">(max 280 chars)</span></label>
                    <textarea id="editBio" class="form-control" rows="3" maxlength="280" placeholder="Tell the community about yourself...">${prof.bio || ''}</textarea>
                </div>
                <div class="plan-field">
                    <label class="form-label">Looking For</label>
                    <select id="editLookingFor" class="form-control">
                        <option value="">— Not set —</option>
                        ${LOOKING_FOR_OPTIONS.map(o => `<option value="${o}" ${prof.looking_for === o ? 'selected' : ''}>${o}</option>`).join('')}
                    </select>
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
    const bio = document.getElementById('editBio')?.value.trim() || null;
    const looking_for = document.getElementById('editLookingFor')?.value || null;
    const errEl = document.getElementById('editProfileError');
    if (!nickname) { if (errEl) { errEl.textContent = 'Nickname is required.'; errEl.style.display = 'block'; } return; }
    if (!email || !email.includes('@')) { if (errEl) { errEl.textContent = 'Valid email is required.'; errEl.style.display = 'block'; } return; }
    const { res, body } = await apiRequest('/api/profile', { method: 'PUT', body: JSON.stringify({ nickname, email, discord_name, bio, looking_for }) });
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

// ── Banner Image Upload ───────────────────────────────────────────────────────
function profileEditBanner() {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:460px">
            <div class="modal-header">
                <h2 class="modal-title">🖼️ Profile Banner</h2>
                <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="modal-body" style="display:flex;flex-direction:column;gap:16px">
                <div style="color:#94a3b8;font-size:0.9rem">Upload an image to display as your profile banner. Recommended: 1200×300 px, max 2MB.</div>
                <input type="file" id="bannerFileInput" accept="image/*" class="form-control" style="padding:8px">
                <div id="bannerPreview" style="display:none;border-radius:10px;overflow:hidden;height:140px;background:#0f172a">
                    <img id="bannerPreviewImg" style="width:100%;height:140px;object-fit:cover">
                </div>
                <div id="bannerError" style="color:#ef4444;font-size:0.85rem;display:none"></div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="profileRemoveBanner()">Remove Banner</button>
                <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                <button class="btn btn-primary" onclick="profileSaveBanner()">Save Banner</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
    document.getElementById('bannerFileInput').addEventListener('change', function() {
        const file = this.files[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
            document.getElementById('bannerError').textContent = 'Image too large (max 2MB).';
            document.getElementById('bannerError').style.display = 'block';
            return;
        }
        const reader = new FileReader();
        reader.onload = e => {
            document.getElementById('bannerPreviewImg').src = e.target.result;
            document.getElementById('bannerPreview').style.display = 'block';
            document.getElementById('bannerError').style.display = 'none';
        };
        reader.readAsDataURL(file);
    });
}
window.profileEditBanner = profileEditBanner;

async function profileSaveBanner() {
    const img = document.getElementById('bannerPreviewImg');
    const errEl = document.getElementById('bannerError');
    if (!img || !img.src || !img.src.startsWith('data:')) {
        if (errEl) { errEl.textContent = 'Please select an image first.'; errEl.style.display = 'block'; }
        return;
    }
    const { res, body } = await apiRequest('/api/profile', { method: 'PUT', body: JSON.stringify({ banner_image: img.src }) });
    if (res.ok) { document.querySelector('.modal.active')?.remove(); loadMyProfilePage(); }
    else if (errEl) { errEl.textContent = body?.error || 'Failed to save banner.'; errEl.style.display = 'block'; }
}
window.profileSaveBanner = profileSaveBanner;

async function profileRemoveBanner() {
    await apiRequest('/api/profile', { method: 'PUT', body: JSON.stringify({ banner_image: null }) });
    document.querySelector('.modal.active')?.remove();
    loadMyProfilePage();
}
window.profileRemoveBanner = profileRemoveBanner;

// ── Pin Creatures Modal ───────────────────────────────────────────────────────
async function profileOpenPinModal() {
    const prof = await apiRequest('/api/profile').then(r => r.body || {}).catch(() => ({}));
    const pinnedIds = new Set(Array.isArray(prof.pinned_creatures) ? prof.pinned_creatures : []);
    const creatures = window.appState?.creatures || [];
    if (creatures.length === 0) { alert('You have no creatures to pin yet. Add some first!'); return; }
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:600px">
            <div class="modal-header">
                <h2 class="modal-title">📌 Pin Your Best Nuggies</h2>
                <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <div style="color:#94a3b8;font-size:0.9rem;margin-bottom:16px">Select up to 6 creatures to feature on your profile. <span id="pinCount" style="color:var(--tc-1,#3b82f6);font-weight:bold">${pinnedIds.size}/6 selected</span></div>
                <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;max-height:400px;overflow-y:auto;padding:4px">
                    ${creatures.map(c => {
                        const sp = (window.SPECIES_DATABASE || {})[c.species] || {};
                        const checked = pinnedIds.has(c.id);
                        return `<label class="pin-creature-option${checked ? ' selected' : ''}" style="cursor:pointer;background:${checked?'rgba(59,130,246,0.15)':'rgba(255,255,255,0.03)'};border:2px solid ${checked?'var(--tc-1,#3b82f6)':'#334155'};border-radius:10px;padding:12px;display:flex;flex-direction:column;align-items:center;gap:6px;transition:all 0.2s">
                            <input type="checkbox" style="display:none" value="${c.id}" ${checked ? 'checked' : ''} onchange="pinModalToggle(this)">
                            <div style="font-size:2rem">${sp.emoji || '🦕'}</div>
                            <div style="font-weight:bold;font-size:0.85rem;color:#f1f5f9;text-align:center">${c.name || 'Unnamed'}</div>
                            <div style="font-size:0.75rem;color:#64748b">${c.species || ''}</div>
                        </label>`;
                    }).join('')}
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                <button class="btn btn-primary" onclick="profileSavePins()">Save Pins</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
}
window.profileOpenPinModal = profileOpenPinModal;

function pinModalToggle(cb) {
    const checked = document.querySelectorAll('.pin-creature-option input:checked');
    if (checked.length > 6 && cb.checked) { cb.checked = false; alert('Maximum 6 pinned creatures.'); return; }
    const label = cb.closest('label');
    if (label) {
        label.style.background = cb.checked ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.03)';
        label.style.borderColor = cb.checked ? 'var(--tc-1,#3b82f6)' : '#334155';
    }
    const countEl = document.getElementById('pinCount');
    if (countEl) countEl.textContent = `${document.querySelectorAll('.pin-creature-option input:checked').length}/6 selected`;
}
window.pinModalToggle = pinModalToggle;

async function profileSavePins() {
    const checked = [...document.querySelectorAll('.pin-creature-option input:checked')];
    const creature_ids = checked.map(cb => parseInt(cb.value)).filter(Boolean);
    const { res } = await apiRequest('/api/profile/pinned', { method: 'PUT', body: JSON.stringify({ creature_ids }) });
    if (res.ok) { document.querySelector('.modal.active')?.remove(); loadMyProfilePage(); }
}
window.profileSavePins = profileSavePins;

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

function profileToggleTheme() {
    const current = localStorage.getItem('useTribeColors') !== 'false';
    localStorage.setItem('useTribeColors', current ? 'false' : 'true');
    if (!current) {
        // Turning ON — apply tribe colors if available
        const colors = window.appState?.myTribeColors;
        if (colors) applyTribeTheme(colors);
    } else {
        // Turning OFF — reset to defaults
        resetTribeTheme();
    }
    loadMyProfilePage();
}
window.profileToggleTheme = profileToggleTheme;

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

// ── Boss Detail Page ──────────────────────────────────────────────────────────
async function loadBossDetailPage(bossId) {
    setActiveNavButton('boss');
    const main = document.getElementById('appMainContent');
    if (!main) return;
    arenaClearPoll();

    const template = getBossTemplates().find(t => t.id === bossId);
    if (!template) { loadBossPlanner(); return; }

    main.innerHTML = `<div class="std-page"><div style="color:#94a3b8;padding:40px">Loading boss details...</div></div>`;

    // Fetch active war rooms for this boss in parallel with plans
    const sessions = await apiRequest('/api/arena/sessions').then(r => Array.isArray(r.body) ? r.body : []).catch(() => []);
    const bossSessions = sessions.filter(s => s.boss_id === bossId || s.boss_name === template.name);
    const plans = window.appState?.bossPlans || [];
    const existingPlan = plans.find(p => p.bossId === bossId);

    const diffColor = { gamma: '#22c55e', beta: '#3b82f6', alpha: '#ef4444' };
    const diffLabel = { gamma: 'Gamma', beta: 'Beta', alpha: 'Alpha' };

    const mechanicsHtml = template.mechanics.length > 0
        ? `<div class="boss-detail-section">
            <div class="boss-detail-section-title">⚙️ Key Mechanics</div>
            <ul class="boss-detail-list">
                ${template.mechanics.map(m => `<li>${esc(m)}</li>`).join('')}
            </ul>
           </div>` : '';

    const debuffsHtml = template.debuffs.length > 0
        ? `<div class="boss-detail-section">
            <div class="boss-detail-section-title">⚠️ Debuffs &amp; Abilities</div>
            <ul class="boss-detail-list">
                ${template.debuffs.map(d => `<li>${esc(d)}</li>`).join('')}
            </ul>
           </div>` : '';

    const rolesHtml = template.secondaryRoles.length > 0
        ? `<div class="boss-detail-section">
            <div class="boss-detail-section-title">🎯 Roles &amp; Behaviour</div>
            <div style="display:flex;flex-wrap:wrap;gap:6px">
                ${template.secondaryRoles.map(r => `<span class="boss-tag">${esc(r)}</span>`).join('')}
            </div>
           </div>` : '';

    const mapsHtml = template.spawnMaps.length > 1
        ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
            ${template.spawnMaps.map(m => `<span class="boss-tag map">${esc(m)}</span>`).join('')}
           </div>` : '';

    const warRoomsHtml = bossSessions.length > 0
        ? `<div class="boss-detail-section">
            <div class="boss-detail-section-title">⚔️ Active War Rooms</div>
            <div class="arena-session-list">
                ${bossSessions.map(s => arenaSessionCard(s)).join('')}
            </div>
           </div>`
        : `<div class="boss-detail-section">
            <div class="boss-detail-section-title">⚔️ War Rooms</div>
            <div style="background:rgba(255,255,255,0.03);border:2px dashed #334155;border-radius:10px;padding:28px;text-align:center;color:#64748b;font-size:0.9rem">
                No active war rooms for this boss yet.<br>
                <span style="color:#94a3b8">Start one and share the code with your allies.</span>
            </div>
           </div>`;

    main.innerHTML = `
        <div class="std-page">
            <!-- Header -->
            <div class="boss-detail-hero">
                <div class="boss-detail-icon">${template.icon}</div>
                <div class="boss-detail-header-info">
                    <h1 class="boss-detail-name">${esc(template.name)}</h1>
                    <div class="boss-detail-tags">
                        <span class="boss-tag map">📍 ${esc(template.map)}</span>
                        <span class="boss-tag">${esc(template.type)}</span>
                        ${existingPlan?.difficulty ? `<span class="boss-tag diff" style="border-color:${diffColor[existingPlan.difficulty]};color:${diffColor[existingPlan.difficulty]}">✓ ${diffLabel[existingPlan.difficulty]} planned</span>` : ''}
                    </div>
                    ${mapsHtml}
                </div>
                <div class="boss-detail-actions">
                    <button class="btn btn-secondary" onclick="loadBossPlanner()">← Boss List</button>
                    <button class="btn btn-secondary" onclick="bossLogKillModal('${bossId}','${template.name.replace(/'/g,"\\'")}')">☠️ Log Kill</button>
                    <button class="btn btn-primary" onclick="arenaCreateModal('${bossId}')">⚔️ Create War Room</button>
                </div>
            </div>

            <div class="boss-detail-body">
                <div class="boss-detail-left">
                    ${template.description ? `
                    <div class="boss-detail-section">
                        <div class="boss-detail-section-title">📖 About</div>
                        <p class="boss-detail-description">${esc(template.description)}</p>
                    </div>` : ''}

                    ${mechanicsHtml}
                    ${debuffsHtml}
                    ${rolesHtml}

                    ${!template.description && !template.mechanics.length && !template.debuffs.length ? `
                    <div class="boss-detail-section">
                        <div class="boss-detail-section-title">💡 Strategy</div>
                        <p class="boss-detail-description">${esc(template.strategy)}</p>
                    </div>` : ''}
                </div>

                <div class="boss-detail-right">
                    ${warRoomsHtml}
                </div>
            </div>
        </div>`;
}
window.loadBossDetailPage = loadBossDetailPage;

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
                <div class="boss-planning-card" onclick="loadBossDetailPage('${t.id}')">
                    <div class="boss-card-header">
                        <div class="boss-card-icon">${t.icon}</div>
                        <div class="boss-card-title">
                            <div class="boss-card-name">${esc(t.name)}</div>
                            <div class="boss-card-sub">${esc(t.type)}</div>
                        </div>
                        ${hasPlan ? `<div class="boss-planned-dot" title="${diffLabel} planned">✓</div>` : ''}
                    </div>
                    <div class="boss-card-tags">
                        <span class="boss-tag map">${esc(t.map)}</span>
                        ${hasPlan && diffLabel ? `<span class="boss-tag diff" style="border-color:${diffColor};color:${diffColor}">${diffLabel}</span>` : ''}
                    </div>
                    <div class="boss-card-desc">${esc((t.description || t.strategy || '').slice(0, 100))}${(t.description || '').length > 100 ? '…' : ''}</div>
                    <div class="boss-card-footer">
                        <span class="click-hint">👁️ View Details</span>
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
                <div style="display:flex;gap:8px">
                    <button class="btn btn-secondary" onclick="loadBossRecordsPage()">☠️ Fight Records</button>
                    <button class="btn btn-primary" onclick="loadArenaPage()">⚔️ View Active War Rooms</button>
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

// ── Boss Fight Records ────────────────────────────────────────────────────────
function bossLogKillModal(bossId, bossName) {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    const creatures = window.appState?.creatures || [];
    modal.innerHTML = `
        <div class="modal-content" style="max-width:480px">
            <div class="modal-header"><h2 class="modal-title">☠️ Log Boss Kill: ${bossName}</h2><button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button></div>
            <div class="modal-body" style="display:flex;flex-direction:column;gap:14px">
                <div class="plan-field">
                    <label class="form-label">Difficulty</label>
                    <select id="bfrDifficulty" class="form-control">
                        <option value="gamma">Gamma</option>
                        <option value="beta">Beta</option>
                        <option value="alpha" selected>Alpha</option>
                    </select>
                </div>
                <div class="plan-field">
                    <label class="form-label">Outcome</label>
                    <select id="bfrOutcome" class="form-control">
                        <option value="success">✅ Success</option>
                        <option value="failure">❌ Failed</option>
                    </select>
                </div>
                <div class="plan-field">
                    <label class="form-label">Creatures Used <span style="color:#64748b;font-size:0.8rem">(optional)</span></label>
                    <div style="display:flex;flex-wrap:wrap;gap:6px;max-height:140px;overflow-y:auto;padding:4px">
                        ${creatures.slice(0, 30).map(c => `
                        <label style="display:flex;align-items:center;gap:4px;background:rgba(255,255,255,0.05);border:1px solid #334155;border-radius:6px;padding:4px 8px;cursor:pointer;font-size:0.8rem;color:#94a3b8">
                            <input type="checkbox" value="${c.id}" name="bfrCreature" style="margin:0"> ${c.name || c.species || 'Unknown'}
                        </label>`).join('')}
                    </div>
                </div>
                <div class="plan-field">
                    <label class="form-label">Notes <span style="color:#64748b;font-size:0.8rem">(optional)</span></label>
                    <input id="bfrNotes" class="form-control" placeholder="Team comp, time taken, etc.">
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                <button class="btn btn-primary" onclick="bossSubmitKill('${bossId}','${bossName.replace(/'/g,"\\'")}')">Log Kill</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
}
window.bossLogKillModal = bossLogKillModal;

async function bossSubmitKill(bossId, bossName) {
    const difficulty = document.getElementById('bfrDifficulty')?.value || 'alpha';
    const outcome = document.getElementById('bfrOutcome')?.value || 'success';
    const notes = document.getElementById('bfrNotes')?.value?.trim() || null;
    const creatures_used = [...document.querySelectorAll('input[name="bfrCreature"]:checked')].map(cb => parseInt(cb.value));
    const templates = getBossTemplates();
    const t = templates.find(b => b.id === bossId);
    const map_name = t?.map || null;
    const { res } = await apiRequest('/api/boss-records', { method: 'POST', body: JSON.stringify({ boss_name: bossName, map_name, difficulty, outcome, notes, creatures_used }) });
    if (res.ok) { document.querySelector('.modal.active')?.remove(); }
}
window.bossSubmitKill = bossSubmitKill;

async function loadBossRecordsPage() {
    setActiveNavButton('boss');
    const main = document.getElementById('appMainContent');
    if (!main) return;
    main.innerHTML = `<div class="std-page"><div style="color:#94a3b8;padding:40px 0">Loading records...</div></div>`;
    const [records, summary] = await Promise.all([
        apiRequest('/api/boss-records').then(r => Array.isArray(r.body) ? r.body : []).catch(() => []),
        apiRequest('/api/boss-records/summary').then(r => Array.isArray(r.body) ? r.body : []).catch(() => [])
    ]);

    const outIcon = o => o === 'success' ? '✅' : '❌';
    const diffColor = d => ({ gamma: '#22c55e', beta: '#3b82f6', alpha: '#ef4444' }[d] || '#94a3b8');
    const timeAgo = ts => { const d = Date.now() - new Date(ts).getTime(), m = Math.floor(d/60000); if (m < 60) return `${m}m ago`; const h = Math.floor(m/60); if (h < 24) return `${h}h ago`; return `${Math.floor(h/24)}d ago`; };

    // Group summary by boss
    const byBoss = {};
    summary.forEach(s => {
        if (!byBoss[s.boss_name]) byBoss[s.boss_name] = { kills: 0, fails: 0 };
        if (s.outcome === 'success') byBoss[s.boss_name].kills += s.count;
        else byBoss[s.boss_name].fails += s.count;
    });

    main.innerHTML = `
        <div class="std-page">
            <div class="std-page-header">
                <div class="page-title"><h1>☠️ Boss Fight Records</h1></div>
                <button class="btn btn-secondary" onclick="loadBossPlanner()">← Back to Planner</button>
            </div>
            ${Object.keys(byBoss).length > 0 ? `
            <div class="profile-card" style="margin-bottom:20px">
                <div class="profile-card-header"><h3>🏆 Boss Kill Summary</h3></div>
                <div style="display:flex;flex-wrap:wrap;gap:10px">
                    ${Object.entries(byBoss).map(([boss, s]) => `
                    <div style="background:rgba(255,255,255,0.03);border:1px solid #1e293b;border-radius:8px;padding:10px 16px;text-align:center">
                        <div style="font-weight:bold;color:#f1f5f9;font-size:0.9rem">${boss}</div>
                        <div style="color:#22c55e;font-size:0.85rem">✅ ${s.kills} kill${s.kills !== 1 ? 's' : ''}</div>
                        ${s.fails ? `<div style="color:#ef4444;font-size:0.8rem">❌ ${s.fails} fail${s.fails !== 1 ? 's' : ''}</div>` : ''}
                    </div>`).join('')}
                </div>
            </div>` : ''}
            <div class="profile-card">
                <div class="profile-card-header"><h3>📋 Fight Log</h3></div>
                ${records.length === 0 ? '<div class="friends-empty">No boss fights logged yet. Click ☠️ Log Kill on any planned boss.</div>'
                : records.map(r => `
                <div class="bfr-row">
                    <span class="bfr-outcome">${outIcon(r.outcome)}</span>
                    <div class="bfr-info">
                        <div class="bfr-boss">${r.boss_name} <span style="color:${diffColor(r.difficulty)};font-size:0.8rem">${r.difficulty || ''}</span></div>
                        ${r.notes ? `<div class="bfr-notes">${r.notes}</div>` : ''}
                    </div>
                    <div class="bfr-time">${timeAgo(r.created_at)}</div>
                </div>`).join('')}
            </div>
        </div>`;
}
window.loadBossRecordsPage = loadBossRecordsPage;

// ── Direct Messages ───────────────────────────────────────────────────────────
async function loadDMInboxPage() {
    setActiveNavButton('messages');
    const main = document.getElementById('appMainContent');
    if (!main) return;
    main.innerHTML = `<div class="std-page"><div style="color:#94a3b8;padding:40px 0">Loading messages...</div></div>`;
    const convos = await apiRequest('/api/dms').then(r => Array.isArray(r.body) ? r.body : []).catch(() => []);
    const timeAgo = ts => { const d = Date.now() - new Date(ts).getTime(), m = Math.floor(d/60000); if (m < 60) return `${m}m ago`; const h = Math.floor(m/60); if (h < 24) return `${h}h ago`; return `${Math.floor(h/24)}d ago`; };

    main.innerHTML = `
        <div class="std-page">
            <div class="std-page-header">
                <div class="page-title"><h1>💬 Messages</h1><div class="page-subtitle">${convos.length} conversation${convos.length !== 1 ? 's' : ''}</div></div>
            </div>
            ${convos.length === 0
                ? '<div class="friends-empty" style="padding:60px 0">No messages yet. Go to Friends and click "Message" to start a conversation.</div>'
                : `<div class="dm-convo-list">
                    ${convos.map(c => `
                    <div class="dm-convo-row" onclick="openDMThread(${c.partner_id}, '${(c.partner_nickname || 'User').replace(/'/g,"\\'")}')" >
                        <div class="dm-avatar">💬</div>
                        <div class="dm-convo-info">
                            <div class="dm-convo-name">${esc(c.partner_nickname) || 'Unknown'} ${c.unread > 0 ? `<span class="dm-unread-badge">${c.unread}</span>` : ''}</div>
                            <div class="dm-convo-preview">${esc(c.last_message?.slice(0, 60) || '')}${c.last_message?.length > 60 ? '...' : ''}</div>
                        </div>
                        <div class="dm-convo-time">${timeAgo(c.last_at)}</div>
                    </div>`).join('')}
                   </div>`
            }
        </div>`;
}
window.loadDMInboxPage = loadDMInboxPage;

async function openDMThread(partnerId, partnerName) {
    // Fetch thread
    const msgs = await apiRequest(`/api/dms/${partnerId}`).then(r => Array.isArray(r.body) ? r.body : []).catch(() => []);
    const myId = parseInt(localStorage.getItem('userId') || '0');
    const myNick = localStorage.getItem('userNickname') || 'You';

    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'dmThreadModal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:520px;height:580px;display:flex;flex-direction:column">
            <div class="modal-header">
                <h2 class="modal-title">💬 ${partnerName}</h2>
                <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="dm-thread" id="dmThread" style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding:16px">
                ${msgs.length === 0 ? '<div style="color:#475569;text-align:center;margin:auto">No messages yet. Say hi!</div>' : ''}
                ${msgs.map(m => {
                    const isMe = m.from_user_id === myId;
                    return `<div class="dm-bubble ${isMe ? 'dm-me' : 'dm-them'}">
                        <div class="dm-sender">${isMe ? myNick : m.sender_nickname || partnerName}</div>
                        <div class="dm-text">${m.message.replace(/</g,'&lt;')}</div>
                    </div>`;
                }).join('')}
            </div>
            <div class="dm-compose">
                <input id="dmInput" class="form-control" placeholder="Type a message..." onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();dmSend(${partnerId})}" style="flex:1">
                <button class="btn btn-primary" onclick="dmSend(${partnerId})" style="flex-shrink:0">Send</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
    // Scroll to bottom
    setTimeout(() => { const t = document.getElementById('dmThread'); if (t) t.scrollTop = t.scrollHeight; }, 50);
    document.getElementById('dmInput')?.focus();
    // Store partner info for send function
    modal._partnerId = partnerId;
    modal._partnerName = partnerName;
}
window.openDMThread = openDMThread;

async function dmSend(partnerId) {
    const input = document.getElementById('dmInput');
    const msg = input?.value?.trim();
    if (!msg) return;
    input.value = '';
    const myNick = localStorage.getItem('userNickname') || 'You';
    const myId = parseInt(localStorage.getItem('userId') || '0');
    const thread = document.getElementById('dmThread');
    // Optimistic append
    if (thread) {
        const bubble = document.createElement('div');
        bubble.className = 'dm-bubble dm-me';
        bubble.innerHTML = `<div class="dm-sender">${myNick}</div><div class="dm-text">${msg.replace(/</g,'&lt;')}</div>`;
        thread.appendChild(bubble);
        thread.scrollTop = thread.scrollHeight;
    }
    await apiRequest(`/api/dms/${partnerId}`, { method: 'POST', body: JSON.stringify({ message: msg }) });
}
window.dmSend = dmSend;

// ── Events / Calendar ─────────────────────────────────────────────────────────
async function loadEventsPage() {
    setActiveNavButton('events');
    const main = document.getElementById('appMainContent');
    if (!main) return;
    main.innerHTML = `<div class="std-page"><div style="color:#94a3b8;padding:40px 0">Loading events...</div></div>`;

    const events = await apiRequest('/api/events').then(r => Array.isArray(r.body) ? r.body : []).catch(() => []);
    const myId = parseInt(localStorage.getItem('userId') || '0');

    const countdown = ts => {
        const diff = new Date(ts).getTime() - Date.now();
        if (diff <= 0) return 'Started';
        const h = Math.floor(diff / 3600000);
        const d = Math.floor(h / 24);
        if (d > 0) return `in ${d}d ${h % 24}h`;
        const m = Math.floor((diff % 3600000) / 60000);
        return h > 0 ? `in ${h}h ${m}m` : `in ${m}m`;
    };

    const typeIcon = t => ({ boss: '👑', pvp: '⚔️', farming: '⛏️', social: '🎉', general: '📅' }[t] || '📅');
    const rsvpColor = s => ({ going: '#22c55e', maybe: '#f59e0b', declined: '#ef4444' }[s] || '#475569');

    const eventCard = e => {
        const isOwn = e.creator_id === myId;
        const cd = countdown(e.scheduled_at);
        const scheduled = new Date(e.scheduled_at).toLocaleString('en-US', { weekday:'short', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
        return `<div class="event-card">
            <div class="event-card-top">
                <span class="event-type-badge">${typeIcon(e.event_type)} ${e.event_type}</span>
                <span class="event-countdown ${new Date(e.scheduled_at).getTime() - Date.now() < 3600000 ? 'soon' : ''}">${cd}</span>
            </div>
            <div class="event-title">${e.title}</div>
            ${e.description ? `<div class="event-desc">${e.description.replace(/</g,'&lt;')}</div>` : ''}
            <div class="event-meta">
                📅 ${scheduled}
                ${e.map_name ? `· 📍 ${e.map_name}` : ''}
                · 👥 ${e.rsvp_count || 0} going
                · by ${e.creator_nickname || 'Unknown'}
            </div>
            <div class="event-actions">
                ${['going','maybe','declined'].map(s => `
                <button class="btn btn-sm event-rsvp-btn${e.my_rsvp === s ? ' active' : ''}" style="${e.my_rsvp === s ? `background:${rsvpColor(s)};color:#fff;border-color:${rsvpColor(s)}` : ''}" onclick="eventRSVP(${e.id},'${s}')">
                    ${{ going:'✅ Going', maybe:'🤔 Maybe', declined:'❌ Decline' }[s]}
                </button>`).join('')}
                ${isOwn ? `<button class="btn btn-sm btn-danger" onclick="eventDelete(${e.id})">Delete</button>` : ''}
            </div>
        </div>`;
    };

    main.innerHTML = `
        <div class="std-page">
            <div class="std-page-header">
                <div class="page-title"><h1>📅 Events</h1><div class="page-subtitle">${events.length} upcoming</div></div>
                <button class="btn btn-primary" onclick="eventCreateModal()">+ Create Event</button>
            </div>
            ${events.length === 0
                ? '<div class="friends-empty" style="padding:60px 0">No upcoming events. Create one to coordinate with your crew!</div>'
                : `<div class="event-grid">${events.map(eventCard).join('')}</div>`
            }
        </div>`;
}
window.loadEventsPage = loadEventsPage;

function eventCreateModal() {
    const mapOptions = (window.ARK_MAPS || ['The Island','Scorched Earth','Aberration','Extinction','Genesis Part 1','Genesis Part 2','Crystal Isles','Fjordur','Lost Island','Ragnarok','Valguero','The Center','Caballus','Astraeos','Svartalfheim','Lost Colony'])
        .map(m => `<option value="${m}">${m}</option>`).join('');
    // Default to tomorrow
    const tmr = new Date(Date.now() + 86400000);
    tmr.setMinutes(0); tmr.setSeconds(0);
    const dtLocal = new Date(tmr.getTime() - tmr.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:480px">
            <div class="modal-header"><h2 class="modal-title">📅 Create Event</h2><button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button></div>
            <div class="modal-body" style="display:flex;flex-direction:column;gap:14px">
                <div class="plan-field"><label class="form-label">Title</label><input id="evTitle" class="form-control" placeholder="e.g. Alpha Dragon Run"></div>
                <div class="plan-field"><label class="form-label">Event Type</label>
                    <select id="evType" class="form-control">
                        <option value="boss">👑 Boss Fight</option>
                        <option value="pvp">⚔️ PvP</option>
                        <option value="farming">⛏️ Farming / Grinding</option>
                        <option value="social">🎉 Social</option>
                        <option value="general">📅 General</option>
                    </select>
                </div>
                <div class="plan-field"><label class="form-label">Date & Time</label><input id="evTime" class="form-control" type="datetime-local" value="${dtLocal}"></div>
                <div class="plan-field"><label class="form-label">Map <span style="color:#64748b;font-size:0.8rem">(optional)</span></label>
                    <select id="evMap" class="form-control"><option value="">— No map —</option>${mapOptions}</select>
                </div>
                <div class="plan-field"><label class="form-label">Description <span style="color:#64748b;font-size:0.8rem">(optional)</span></label><textarea id="evDesc" class="form-control" rows="3" placeholder="Details, requirements, etc."></textarea></div>
                <div id="evError" style="color:#ef4444;font-size:0.85rem;display:none"></div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                <button class="btn btn-primary" onclick="eventSubmit()">Create Event</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
}
window.eventCreateModal = eventCreateModal;

async function eventSubmit() {
    const title = document.getElementById('evTitle')?.value.trim();
    const event_type = document.getElementById('evType')?.value || 'general';
    const scheduled_at = document.getElementById('evTime')?.value;
    const map_name = document.getElementById('evMap')?.value || null;
    const description = document.getElementById('evDesc')?.value.trim() || null;
    const errEl = document.getElementById('evError');
    if (!title) { if (errEl) { errEl.textContent = 'Title is required.'; errEl.style.display = 'block'; } return; }
    if (!scheduled_at) { if (errEl) { errEl.textContent = 'Pick a date and time.'; errEl.style.display = 'block'; } return; }
    const { res, body } = await apiRequest('/api/events', { method: 'POST', body: JSON.stringify({ title, event_type, scheduled_at: new Date(scheduled_at).toISOString(), map_name, description }) });
    if (res.ok) { document.querySelector('.modal.active')?.remove(); loadEventsPage(); }
    else if (errEl) { errEl.textContent = body?.error || 'Failed to create.'; errEl.style.display = 'block'; }
}
window.eventSubmit = eventSubmit;

async function eventRSVP(eventId, status) {
    await apiRequest(`/api/events/${eventId}/rsvp`, { method: 'PUT', body: JSON.stringify({ status }) });
    loadEventsPage();
}
window.eventRSVP = eventRSVP;

async function eventDelete(eventId) {
    if (!confirm('Delete this event?')) return;
    await apiRequest(`/api/events/${eventId}`, { method: 'DELETE' });
    loadEventsPage();
}
window.eventDelete = eventDelete;

// ── Reactions System ──────────────────────────────────────────────────────────
const REACTION_EMOJIS = ['❤️','🔥','💪','😮','👑','🤣'];

// Render a reaction bar for a given entity. reactions = [{emoji, count, my_react}]
function renderReactionBar(entityType, entityId, reactions) {
    const counts = {};
    (reactions || []).forEach(r => { counts[r.emoji] = { count: r.count, my_react: r.my_react }; });
    return `<div class="reaction-bar" data-type="${entityType}" data-id="${entityId}">
        ${REACTION_EMOJIS.map(e => {
            const info = counts[e] || { count: 0, my_react: false };
            return `<button class="reaction-btn${info.my_react ? ' reacted' : ''}" onclick="toggleReaction('${entityType}',${entityId},'${e}',this)" title="${e}">
                ${e}${info.count > 0 ? `<span class="reaction-count">${info.count}</span>` : ''}
            </button>`;
        }).join('')}
    </div>`;
}

async function toggleReaction(entityType, entityId, emoji, btn) {
    const { res, body } = await apiRequest('/api/reactions/toggle', { method: 'POST', body: JSON.stringify({ entity_type: entityType, entity_id: entityId, emoji }) });
    if (!res.ok) return;
    const added = body?.action === 'added';
    const bar = btn.closest('.reaction-bar');
    if (!bar) return;
    // Refresh reactions for this entity
    const newR = await apiRequest(`/api/reactions?type=${entityType}&ids=${entityId}`).then(r => r.body || {}).catch(() => ({}));
    const entityReactions = newR[entityId] || [];
    bar.outerHTML = renderReactionBar(entityType, entityId, entityReactions);
}
window.toggleReaction = toggleReaction;

// Load reactions for a list of entity IDs, then inject them into the DOM
async function loadAndInjectReactions(entityType, ids) {
    if (!ids || !ids.length) return;
    const data = await apiRequest(`/api/reactions?type=${entityType}&ids=${ids.join(',')}`).then(r => r.body || {}).catch(() => ({}));
    // Find all reaction-bar placeholders and fill them
    document.querySelectorAll(`.reaction-bar-placeholder[data-type="${entityType}"]`).forEach(el => {
        const id = parseInt(el.dataset.id);
        el.outerHTML = renderReactionBar(entityType, id, data[id] || []);
    });
}

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

// Creatures wrongly marked category='boss' in the species DB — excluded from the planner
const BOSS_EXCLUSIONS = new Set(['Forest Wyvern', 'Forest Wyvern (Variant)']);

function getBossTemplates() {
    const db = (typeof window !== 'undefined' && window.SPECIES_DATABASE) || {};
    const templates = [];
    for (const [name, species] of Object.entries(db)) {
        if (species.category !== 'boss') continue;
        const displayName = species.name || name;
        if (BOSS_EXCLUSIONS.has(displayName)) continue;
        const map = (species.spawnMaps && species.spawnMaps[0]) || 'Unknown';
        templates.push({
            id: (species.id || name).toString().toLowerCase().replace(/[^a-z0-9]+/g, '_'),
            name: displayName,
            map: map,
            type: _deriveBossType(species),
            icon: species.icon || '💀',
            rarity: species.rarity || 'Legendary',
            description: species.dossierText || '',
            strategy: _deriveBossStrategy(species),
            // Full species record preserved for the detail page
            mechanics: (species.uniqueMechanics || []).filter(m => m && m !== 'None' && m.length > 3),
            debuffs: (species.debuffAbilities || []).filter(d => d && d !== 'None' && d !== 'none'),
            secondaryRoles: species.secondaryRoles || [],
            spawnMaps: species.spawnMaps || [map],
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
			// Start notification polling
			try { startNotificationPolling(); } catch (e) {}
			// Load tribe theme colors
			try {
				const { body: tribeMeta } = await apiRequest('/api/my-tribe').catch(() => ({ body: null }));
				if (tribeMeta && Array.isArray(tribeMeta.colors)) {
					window.appState = window.appState || {};
					window.appState.myTribeColors = tribeMeta.colors;
					if (localStorage.getItem('useTribeColors') !== 'false') applyTribeTheme(tribeMeta.colors);
				}
			} catch (e) {}
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

// Hash change routing (for shared creature links)
window.addEventListener('hashchange', () => { if (localStorage.getItem('token')) handleHashRoute(); });

// ── Discord OAuth ──────────────────────────────────────────────────────────────
function discordLogin() {
    window.location.href = window.__API_BASE + '/api/auth/discord/start';
}
window.discordLogin = discordLogin;

async function handleDiscordCallback() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code) return false;

    // Remove the code from the URL immediately so refreshing doesn't re-trigger
    window.history.replaceState({}, '', window.location.pathname);

    // Show a loading message on the login page
    const errEl = document.getElementById('loginError');
    if (errEl) { errEl.textContent = '🔵 Completing Discord login…'; errEl.style.color = '#93c5fd'; errEl.style.display = 'block'; }

    try {
        const res = await fetch(window.__API_BASE + '/api/auth/discord/callback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code })
        });
        const data = await res.json();

        if (data.token) {
            localStorage.setItem('token', data.token);
            if (data.user) {
                localStorage.setItem('userEmail',    data.user.email    || '');
                localStorage.setItem('userNickname', data.user.nickname || '');
                localStorage.setItem('userId',       String(data.user.id || ''));
            }
            showMainApp();
            updateTribeHeader();
            loadMyProfilePage();
            try { await loadServerCreatures(); } catch {}
            try { await loadServerBossData(); } catch {}
            try { startNotificationPolling(); } catch {}
        } else {
            if (errEl) { errEl.textContent = data.error || 'Discord login failed. Please try again.'; errEl.style.color = '#ef4444'; errEl.style.display = 'block'; }
        }
    } catch (e) {
        if (errEl) { errEl.textContent = 'Network error during Discord login. Please try again.'; errEl.style.color = '#ef4444'; errEl.style.display = 'block'; }
    }
    return true;
}

// ── PWA: Service Worker + Browser Notifications ────────────────────────────────
(function initPWA() {
    // Register service worker
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js').catch(() => {});
        });
    }
})();

// Request browser notification permission (called after login)
async function requestNotificationPermission() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') return;
    if (Notification.permission === 'denied') return;
    // Only ask once per session
    if (sessionStorage.getItem('notifAsked')) return;
    sessionStorage.setItem('notifAsked', '1');
    // Small delay so it doesn't feel intrusive
    setTimeout(async () => {
        const perm = await Notification.requestPermission().catch(() => 'denied');
        if (perm === 'granted') {
            new Notification('Dino Nuggie Manager 🦕', {
                body: 'Notifications enabled! You\'ll be alerted for DMs, trades, and events.',
                icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><text y='52' font-size='52'>🦕</text></svg>"
            });
        }
    }, 3000);
}

// Show a browser notification (called from notification poller)
function showBrowserNotification(title, body, onClick) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const n = new Notification(title, {
        body,
        icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><text y='52' font-size='52'>🦕</text></svg>"
    });
    if (onClick) n.addEventListener('click', onClick);
}
window.showBrowserNotification = showBrowserNotification;

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    // Handle Discord OAuth callback (?code=...) before anything else
    const handledDiscord = await handleDiscordCallback();
    if (handledDiscord) return;

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
// ── Notification System ────────────────────────────────────────────────────

// Load notifications from server and cache in appState
async function loadNotifications() {
    try {
        const { res, body } = await apiRequest('/api/notifications');
        if (res.ok && Array.isArray(body)) {
            window.appState = window.appState || {};
            window.appState.notifications = body;
            updateNotificationBadge();
        }
    } catch (e) { /* silent */ }
}
window.loadNotifications = loadNotifications;

// Format a notification into { icon, title, message, navigate }
function formatNotification(n) {
    const actor = n.actor_name || 'Someone';
    const p = n.payload || {};
    switch (n.type) {
        case 'offer':
            return { icon: '💰', title: 'Trade Offer', message: `${actor} made an offer on your listing.`, navigate: () => { closeNotifications(); loadTradingPage(); } };
        case 'tribe_join_request':
            return { icon: '🏛️', title: 'Tribe Join Request', message: `${actor} wants to join your tribe.`, navigate: () => { closeNotifications(); loadTribesPage(); } };
        case 'tribe_join_response': {
            const status = p.status === 'accepted' ? 'accepted ✓' : 'declined ✗';
            return { icon: '🏛️', title: 'Tribe Request Update', message: `Your tribe join request was ${status}.`, navigate: () => { closeNotifications(); loadTribesPage(); } };
        }
        case 'friend_request':
            return { icon: '👥', title: 'Friend Request', message: `${actor} sent you a friend request.`, navigate: () => { closeNotifications(); loadFriendsPage(); } };
        case 'announcement': {
            const cName = p.creatureName || 'a creature';
            return { icon: '💎', title: 'Diamond Bloodline!', message: `${actor} just raised ${cName} with Diamond Prized Bloodline!`, navigate: () => { closeNotifications(); } };
        }
        case 'boss_invite': {
            const boss = p.bossId || 'a boss';
            return { icon: '👑', title: 'Boss Fight Invite', message: `${actor} invited you to fight ${boss}.`, navigate: () => { closeNotifications(); loadBossPlanner(); } };
        }
        case 'arena_join': {
            const bossN = p.bossName || 'a boss';
            return { icon: '⚔️', title: 'War Room: Player Joined', message: `${actor} joined your ${bossN} war room.`, navigate: () => { closeNotifications(); loadArenaPage(); } };
        }
        case 'arena_invite': {
            const bossI = p.bossName || 'a boss';
            return { icon: '⚔️', title: 'War Room Invite', message: `${actor} invited you to a ${bossI} war room. Code: ${p.join_code || ''}`, navigate: () => { closeNotifications(); loadArenaPage(); } };
        }
        case 'direct_message': {
            const from = p.fromNickname || actor;
            return { icon: '💬', title: 'New Message', message: `${from} sent you a message.`, navigate: () => { closeNotifications(); loadDMInboxPage(); } };
        }
        case 'wishlist_listed': {
            return { icon: '⭐', title: 'Wishlist Alert', message: `A ${p.species || 'creature'} you wishlisted is now listed on the Trading Post!`, navigate: () => { closeNotifications(); loadTradingPage(); } };
        }
        default:
            return { icon: '🔔', title: 'Notification', message: p.message || 'You have a new notification.', navigate: () => closeNotifications() };
    }
}

function notifTimeAgo(dateStr) {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

async function toggleNotifications() {
    const existing = document.getElementById('notificationPanel');
    if (existing) { existing.remove(); return; }
    // Refresh from server then render
    await loadNotifications();
    renderNotificationPanel();
}

function renderNotificationPanel() {
    document.getElementById('notificationPanel')?.remove();
    const notifs = window.appState?.notifications || [];
    const unread = notifs.filter(n => !n.read);

    const panel = document.createElement('div');
    panel.id = 'notificationPanel';
    panel.className = 'notification-panel';
    panel.innerHTML = `
        <div class="notification-header">
            <span>🔔 Notifications${unread.length ? ` <span class="notif-count">${unread.length}</span>` : ''}</span>
            <div class="notification-actions">
                ${unread.length ? `<button onclick="notifMarkAllRead()">✓ All read</button>` : ''}
                <button onclick="closeNotifications()">✕</button>
            </div>
        </div>
        <div class="notification-content">
            ${notifs.length === 0
                ? '<div class="no-notifications">You\'re all caught up 🎉</div>'
                : notifs.map(n => {
                    const f = formatNotification(n);
                    return `<div class="notification-item ${n.read ? 'read' : 'unread'}" data-nid="${n.id}" onclick="notifClick(${n.id})">
                        <div class="notification-icon">${f.icon}</div>
                        <div class="notification-details">
                            <div class="notification-title">${f.title}</div>
                            <div class="notification-message">${f.message}</div>
                            <div class="notification-time">${notifTimeAgo(n.created_at)}</div>
                        </div>
                        ${!n.read ? '<div class="unread-indicator"></div>' : ''}
                    </div>`;
                }).join('')
            }
        </div>`;
    document.body.appendChild(panel);

    // Close when clicking outside
    setTimeout(() => {
        document.addEventListener('click', notifOutsideClick, { once: true, capture: true });
    }, 50);
}

function notifOutsideClick(e) {
    const panel = document.getElementById('notificationPanel');
    if (panel && !panel.contains(e.target)) panel.remove();
    else if (panel) document.addEventListener('click', notifOutsideClick, { once: true, capture: true });
}

async function notifClick(id) {
    const notifs = window.appState?.notifications || [];
    const n = notifs.find(x => x.id === id);
    if (!n) return;
    // Mark read locally immediately
    n.read = true;
    updateNotificationBadge();
    // Mark read on server (fire and forget)
    apiRequest(`/api/notifications/${id}/read`, { method: 'PUT' }).catch(() => {});
    // Navigate
    const f = formatNotification(n);
    if (f.navigate) f.navigate();
}
window.notifClick = notifClick;

async function notifMarkAllRead() {
    const notifs = window.appState?.notifications || [];
    notifs.forEach(n => n.read = true);
    updateNotificationBadge();
    closeNotifications();
    apiRequest('/api/notifications/read-all', { method: 'PUT' }).catch(() => {});
}
window.notifMarkAllRead = notifMarkAllRead;

function closeNotifications() {
    document.getElementById('notificationPanel')?.remove();
}
window.closeNotifications = closeNotifications;

function updateNotificationBadge() {
    const notifs = window.appState?.notifications || [];
    const unread = notifs.filter(n => !n.read);
    const count = unread.length;
    const badge = document.getElementById('notificationCount');
    if (badge) {
        badge.textContent = count > 0 ? count : '';
        badge.style.display = count > 0 ? 'inline-flex' : 'none';
    }
    // Show browser notification for new unread items since last check
    const lastSeen = parseInt(localStorage.getItem('lastNotifId') || '0');
    const newest = unread.filter(n => n.id > lastSeen);
    if (newest.length > 0 && lastSeen > 0) {
        newest.forEach(n => {
            const f = formatNotification(n);
            showBrowserNotification(f.title, f.message, () => { window.focus(); f.navigate?.(); });
        });
    }
    if (unread.length > 0) {
        const maxId = Math.max(...unread.map(n => n.id));
        localStorage.setItem('lastNotifId', String(maxId));
    }
}
window.updateNotificationBadge = updateNotificationBadge;

// Poll every 60 seconds while logged in
function startNotificationPolling() {
    loadNotifications();
    setInterval(() => {
        if (localStorage.getItem('token')) loadNotifications();
    }, 60000);
}
window.startNotificationPolling = startNotificationPolling;

// Legacy alias
window.markAsRead = notifClick;
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
