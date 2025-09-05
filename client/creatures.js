// Creature modal and persistence helpers (moved out of main.js for clarity)
(function(){
  // Create or update a creature modal form inside #creatureModal
  function openCreatureModal(speciesName, editingCreature) {
    const modal = document.getElementById('creatureModal');
    if (!modal) return console.warn('Creature modal container missing');

    // Basic form markup. Keep minimal and consistent with main.js expectations.
    modal.innerHTML = `
      <div class="modal-inner">
        <h3 id="creatureModalTitle">${editingCreature ? 'Edit Creature' : 'Add Creature'}</h3>
        <div class="form-row">
          <label>Name</label>
          <input id="creatureName" class="form-control" type="text" />
        </div>
        <div class="form-row">
          <label>Gender</label>
          <select id="creatureGender" class="form-control"><option value="">Unknown</option><option value="Male">Male</option><option value="Female">Female</option></select>
        </div>
        <div class="form-row">
          <label>Level</label>
          <input id="creatureLevel" class="form-control" type="number" min="1" value="1" />
        </div>
        <div id="imagePreview"></div>
        <div class="modal-actions">
          <button id="saveCreatureBtn" class="btn btn-primary">Save</button>
          <button id="closeCreatureBtn" class="btn btn-secondary">Cancel</button>
        </div>
      </div>
    `;

    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');

    // Wire buttons
    const closeBtn = document.getElementById('closeCreatureBtn');
    const saveBtn = document.getElementById('saveCreatureBtn');
    if (closeBtn) closeBtn.onclick = () => closeCreatureModal();
    if (saveBtn) saveBtn.onclick = () => {
      // Dispatch a custom event so main.js handles actual saving (keeps responsibilities separated)
      const evt = new CustomEvent('creature:save', { detail: { species: speciesName, editing: editingCreature } });
      document.dispatchEvent(evt);
    };

    // If editingCreature is provided, prefill fields (main.js keeps appState)
    if (editingCreature && window.appState && window.appState.creatures) {
      const c = window.appState.creatures.find(x => x.id === editingCreature);
      if (c) {
        setTimeout(() => {
          document.getElementById('creatureName').value = c.name || '';
          document.getElementById('creatureGender').value = c.gender || '';
          document.getElementById('creatureLevel').value = c.level || 1;
        }, 30);
      }
    }
  }

  function closeCreatureModal() {
    const modal = document.getElementById('creatureModal');
    if (!modal) return;
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = '';
  }

  // Simple detail modal
  function openCreatureDetailModal(creature) {
    const modal = document.getElementById('creatureDetailModal');
    if (!modal) return console.warn('creatureDetailModal missing');
    modal.innerHTML = `
      <div class="modal-inner">
        <h3 id="creatureDetailTitle">${creature.name}</h3>
        <div id="creatureDetailContent">${creature.notes || ''}</div>
        <div class="modal-actions">
          <button id="closeCreatureDetailBtn" class="btn btn-secondary">Close</button>
        </div>
      </div>
    `;
    const closeBtn = document.getElementById('closeCreatureDetailBtn');
    if (closeBtn) closeBtn.onclick = () => closeCreatureDetailModal();
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeCreatureDetailModal() {
    const modal = document.getElementById('creatureDetailModal');
    if (!modal) return;
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = '';
  }

  // Basic open page for species (shows species-specific creature list)
  function switchTab(tabId) {
    try {
      const buttons = document.querySelectorAll('.tab-button');
      const contents = document.querySelectorAll('.tab-content');
      buttons.forEach(b => b.classList.remove('active'));
      contents.forEach(c => c.classList.remove('active'));
      const btn = document.querySelector(`.tab-button[data-target="${tabId}"]`);
      const content = document.getElementById(tabId);
      if (btn) btn.classList.add('active');
      if (content) content.classList.add('active');
    } catch (e) { console.warn('switchTab failed', e); }
  }

  function renderBaseStatsTable(statsObj) {
    if (!statsObj) return '';
    return Object.entries(statsObj).map(([k,v]) => `<div class="stat-item"><div class="stat-name">${k}</div><div class="stat-value">${v}</div></div>`).join('');
  }

  function openCreaturePage(speciesName) {
    if (!speciesName) return;
    if (!window.appState) window.appState = { creatures: [] };
    window.appState.currentSpecies = speciesName;

    const mainContent = document.getElementById('appMainContent');
    if (!mainContent) return;

    // Resolve species data from available DB helper or global
    const db = (typeof window.getSpeciesDB === 'function') ? window.getSpeciesDB() : (window.SPECIES_DATABASE || {});
    const species = db && db[speciesName] ? db[speciesName] : Object.values(db).find(s => s && s.name === speciesName) || null;

    // Render full species page layout (tabs, stats, actions)
    mainContent.innerHTML = `
      <div class="creature-page">
        <div class="creature-page-header">
          <div class="creature-page-icon" id="creaturePageIcon">${species?.icon || '🦖'}</div>
          <div class="creature-page-info">
            <h1 id="creaturePageTitle">${species?.name || speciesName}</h1>
            <div class="creature-page-meta" id="creaturePageMeta">${(window.appState.creatures || []).filter(c=>c.species===speciesName).length} creatures</div>
          </div>
          <div class="creature-page-actions">
            <button class="btn btn-primary" id="openAddCreatureBtn">➕ Add Creature</button>
            <button class="btn btn-secondary" id="backToSpeciesBtn">← Back to Species</button>
          </div>
        </div>

        <div class="species-info-container">
          <div class="tab-navigation">
            <button class="tab-button active" data-target="basic-info">📖 Basic Info</button>
            <button class="tab-button" data-target="stats-combat">📊 Stats & Combat</button>
            <button class="tab-button" data-target="taming-info">🏆 Taming Info</button>
            <button class="tab-button" data-target="utility-roles">⚙️ Utility & Roles</button>
            <button class="tab-button" data-target="environment">🌍 Environment</button>
            <button class="tab-button" data-target="management">🏕️ Management</button>
          </div>

          <div id="basic-info" class="tab-content active">
            <div class="info-section">
              <div class="dossier-text" id="species-dossier">${species?.dossierText || 'Loading species information...'}</div>
            </div>
            <div class="info-section">
              <div class="info-grid">
                <div class="info-item"><div class="info-label">Temperament</div><div class="info-value" id="species-temperament">${species?.temperament || '-'}</div></div>
                <div class="info-item"><div class="info-label">Diet</div><div class="info-value" id="species-diet">${species?.diet || '-'}</div></div>
                <div class="info-item"><div class="info-label">Habitat</div><div class="info-value" id="species-habitat">${species?.habitat || '-'}</div></div>
                <div class="info-item"><div class="info-label">Real World Basis</div><div class="info-value" id="species-basis">${species?.realWorldBasis || '-'}</div></div>
                <div class="info-item"><div class="info-label">Rarity</div><div class="info-value" id="species-rarity">${species?.rarity || '-'}</div></div>
                <div class="info-item"><div class="info-label">Source</div><div class="info-value" id="species-source">${species?.source || '-'}</div></div>
              </div>
            </div>
          </div>

          <div id="stats-combat" class="tab-content">
            <div class="info-section">
              <div class="info-title">📊 Base Statistics</div>
              <div class="stats-table" id="species-base-stats">${renderBaseStatsTable(species?.baseStats)}</div>
            </div>
            <div class="info-section">
              <div class="info-title">⚔️ Combat & Movement</div>
              <div class="info-grid">
                <div class="info-item"><div class="info-label">Attack Types</div><div class="info-value" id="species-attacks">${(species?.attackTypes||[]).join(', ')||'-'}</div></div>
                <div class="info-item"><div class="info-label">Special Abilities</div><div class="info-value" id="species-abilities">${(species?.specialAbilities||[]).join(', ')||'-'}</div></div>
                <div class="info-item"><div class="info-label">Land Speed</div><div class="info-value" id="species-land-speed">${species?.speeds?.land||'-'}</div></div>
                <div class="info-item"><div class="info-label">Flying Speed</div><div class="info-value" id="species-flying-speed">${species?.speeds?.flying||'-'}</div></div>
                <div class="info-item"><div class="info-label">Swimming Speed</div><div class="info-value" id="species-swimming-speed">${species?.speeds?.swimming||'-'}</div></div>
              </div>
            </div>
          </div>

          <div id="taming-info" class="tab-content">
            <div class="info-section">
              <div class="info-grid">
                <div class="info-item"><div class="info-label">Taming Method</div><div class="info-value" id="species-taming-method">${species?.tamingMethod||'-'}</div></div>
                <div class="info-item"><div class="info-label">Preferred Kibble</div><div class="info-value" id="species-kibble">${species?.preferredKibble||'-'}</div></div>
                <div class="info-item"><div class="info-label">Favorite Food</div><div class="info-value" id="species-food">${species?.favoriteFood||'-'}</div></div>
                <div class="info-item"><div class="info-label">Taming Speed</div><div class="info-value" id="species-taming-speed">${species?.tamingSpeed||'-'}</div></div>
                <div class="info-item"><div class="info-label">Base Torpor</div><div class="info-value" id="species-torpor">${species?.torpor?.baseValue||'-'}</div></div>
              </div>
            </div>
            <div class="info-section"><div class="info-title">⚠️ Special Requirements</div><div class="info-value" id="species-requirements">${species?.specialRequirements||'-'}</div></div>
          </div>

          <div id="utility-roles" class="tab-content">
            <div class="info-section">
              <div class="info-grid">
                <div class="info-item"><div class="info-label">Primary Role</div><div class="info-value" id="species-primary-role">${species?.primaryRole||'-'}</div></div>
                <div class="info-item"><div class="info-label">Secondary Roles</div><div class="info-value" id="species-secondary-roles">${(species?.secondaryRoles||[]).join(', ')||'-'}</div></div>
              </div>
            </div>
            <div class="info-section"><div class="info-title">📦 Resource Gathering</div><div class="resource-list" id="species-resources">${(species?.gatheringResources||[]).map(r=>`<span class="resource-tag">${r}</span>`).join('')||'<span>-</span>'}</div></div>
            <div class="info-section"><div class="info-title">🔧 Special Abilities</div><div class="ability-list" id="species-special-abilities">${(species?.specialAbilities||[]).map(a=>`<span class="ability-tag">${a}</span>`).join('')||'<span>-</span>'}</div></div>
          </div>

          <div id="environment" class="tab-content">
            <div class="info-section"><div class="info-grid">
              <div class="info-item"><div class="info-label">Preferred Biomes</div><div class="info-value" id="species-biomes">${species?.preferredBiome||'-'}</div></div>
              <div class="info-item"><div class="info-label">Temperature Range</div><div class="info-value" id="species-temperature">${species?.temperatureRange?`${species.temperatureRange.min} - ${species.temperatureRange.max}`:'-'}</div></div>
              <div class="info-item"><div class="info-label">Environmental Resistances</div><div class="info-value" id="species-resistances">${(species?.environmentalResistances||[]).join(', ')||'-'}</div></div>
            </div></div>
          </div>

          <div id="management" class="tab-content">
            <div class="info-section"><div class="info-grid">
              <div class="info-item"><div class="info-label">Difficulty Rating</div><div class="info-value" id="species-difficulty">${species?.difficultyRating||'-'}</div></div>
              <div class="info-item"><div class="info-label">Beginner Friendly</div><div class="info-value" id="species-beginner">${species?.beginnerFriendly? 'Yes' : 'No'}</div></div>
              <div class="info-item"><div class="info-label">Resource Investment</div><div class="info-value" id="species-investment">${species?.resourceInvestment||'-'}</div></div>
              <div class="info-item"><div class="info-label">Boss Fight Capable</div><div class="info-value" id="species-boss-capable">${species?.bossFightCapable? 'Yes' : 'No'}</div></div>
            </div></div>
          </div>
        </div>

        <div class="creatures-section-header">
          <h2 class="creatures-section-title">Your Creatures</h2>
          <div class="view-toggle">
            <button class="view-toggle-btn active" id="cardViewBtn">📊 Cards</button>
            <button class="view-toggle-btn" id="listViewBtn">📋 List</button>
          </div>
        </div>

        <div class="creatures-grid" id="creaturesGrid"></div>
      </div>
    `;

    // Wire actions
    const addBtn = document.getElementById('openAddCreatureBtn');
    if (addBtn) addBtn.onclick = () => openCreatureModal(speciesName);
    const backBtn = document.getElementById('backToSpeciesBtn');
    if (backBtn) backBtn.onclick = () => { if (typeof window.loadSpeciesPage === 'function') window.loadSpeciesPage(); };

    // Wire tabs
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(b => b.addEventListener('click', (e) => { const target = b.getAttribute('data-target'); switchTab(target); }));

    // Populate creatures list area
    const creaturesGrid = document.getElementById('creaturesGrid');
    const creatures = (window.appState.creatures || []).filter(c => c.species === speciesName);
    if (!creatures || creatures.length === 0) {
      creaturesGrid.innerHTML = '<div class="no-creatures">No creatures saved for this species.</div>';
    } else {
      // render cards (simple)
      creaturesGrid.innerHTML = creatures.map(c => `
        <div class="creature-card">
          <div class="creature-card-header">${c.image ? `<img class="creature-image" src="${c.image}">` : `<div class="creature-image-placeholder">${c.icon||'🦖'}</div>`}</div>
          <div class="creature-card-content"><div class="creature-name">${c.name}</div><div class="creature-meta">Lvl ${c.level} • ${c.gender||'?'}</div></div>
        </div>
      `).join('');
    }
  }

  // Listen for creature:save events and forward to main saving logic
  document.addEventListener('creature:save', (e) => {
    try {
      const { species, editing } = e.detail || {};
      // Dispatch to a global handler if present; main.js should provide saveCreature function
      if (typeof window.saveCreature === 'function') {
        window.saveCreature({ species, editing });
      } else {
        console.warn('saveCreature handler not present; creature data not saved');
      }
    } catch (err) {
      console.warn('Error handling creature:save', err);
    }
  });

  // Export functions
  if (typeof window !== 'undefined') {
    window.openCreatureModal = openCreatureModal;
    window.closeCreatureModal = closeCreatureModal;
    window.openCreatureDetailModal = openCreatureDetailModal;
    window.closeCreatureDetailModal = closeCreatureDetailModal;
    window.openCreaturePage = openCreaturePage;
  }
})();
