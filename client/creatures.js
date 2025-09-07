// Creature modal and persistence helpers (moved out of main.js for clarity)
(function(){
  // Ensure modal containers exist at document root so injected HTML becomes overlayed, not appended inline
  try {
    if (typeof document !== 'undefined') {
      if (!document.getElementById('creatureModal')) {
        const m = document.createElement('div');
        m.id = 'creatureModal';
        m.className = 'modal';
        m.setAttribute('aria-hidden', 'true');
        document.body.appendChild(m);
      }
      if (!document.getElementById('creatureDetailModal')) {
        const d = document.createElement('div');
        d.id = 'creatureDetailModal';
        d.className = 'modal';
        d.setAttribute('aria-hidden', 'true');
        document.body.appendChild(d);
      }
    }
  } catch (e) { /* non-browser context */ }
  // Create or update a creature modal form inside #creatureModal (full Old Nugget UI)
  function openCreatureModal(creature = null) {
  if (!window.appState) window.appState = { creatures: [] };
  appState.editingCreature = creature && creature.id ? creature.id : null;

  const modal = document.getElementById('creatureModal');
  if (!modal) return console.warn('Creature modal container missing');

  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2 class="modal-title" id="creatureModalTitle">${creature ? 'Edit Creature' : 'Add Creature'}</h2>
        <button class="close-btn" id="closeCreatureBtn">&times;</button>
      </div>
      <div class="modal-body">
        <!-- Basic Information -->
        <div class="form-section">
          <div class="section-title">🏷️ Basic Information</div>
          <div class="form-row cols-2">
            <div class="form-group">
              <label class="form-label">Creature Name</label>
              <input type="text" class="form-control" id="creatureName" placeholder="Enter creature name" oninput="updateBadgePreview()">
            </div>
            <div class="form-group">
              <label class="form-label">Gender</label>
              <select class="form-control" id="creatureGender">
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
          </div>
          <div class="form-row cols-2">
            <div class="form-group">
              <label class="form-label">Current Level</label>
              <input type="number" class="form-control" id="creatureLevel" min="1" max="450" placeholder="Total level" oninput="updateBadgePreview()">
            </div>
            <div class="form-group">
              <label class="form-label">Creature Image</label>
              <div class="image-upload">
                <input type="file" id="creatureImage" accept="image/*" onchange="handleImageUpload(this)">
                <div class="image-upload-placeholder" id="imagePreview">
                  <div>📷</div>
                  <div style="font-size: 12px;">Upload Image</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Base Stats -->
        <div class="form-section">
          <div class="section-title">📊 Base Stats (Wild Points)</div>
          <p style="margin-bottom: 16px; color: #94a3b8; font-size: 14px;">Enter the stat points for each stat (used for Prized Bloodline badges)</p>
          <div class="form-row cols-3">
            <div class="form-group"><label class="form-label">Health Points</label><input type="number" class="form-control" id="baseStatHealth" min="0" placeholder="0" oninput="updateBadgePreview()"></div>
            <div class="form-group"><label class="form-label">Stamina Points</label><input type="number" class="form-control" id="baseStatStamina" min="0" placeholder="0" oninput="updateBadgePreview()"></div>
            <div class="form-group"><label class="form-label">Oxygen Points</label><input type="number" class="form-control" id="baseStatOxygen" min="0" placeholder="0"></div>
          </div>
          <div class="form-row cols-3">
            <div class="form-group"><label class="form-label">Food Points</label><input type="number" class="form-control" id="baseStatFood" min="0" placeholder="0" oninput="updateBadgePreview()"></div>
            <div class="form-group"><label class="form-label">Weight Points</label><input type="number" class="form-control" id="baseStatWeight" min="0" placeholder="0" oninput="updateBadgePreview()"></div>
            <div class="form-group"><label class="form-label">Melee Points</label><input type="number" class="form-control" id="baseStatMelee" min="0" placeholder="0" oninput="updateBadgePreview()"></div>
          </div>
        </div>

        <!-- Mutations -->
        <div class="form-section">
          <div class="section-title">🧬 Mutations</div>
          <p style="margin-bottom: 16px; color: #94a3b8; font-size: 14px;">Enter mutation points (remember: 1 mutation = 2 levels)</p>
          <div class="form-row cols-3">
            <div class="form-group"><label class="form-label">Health Mutations</label><input type="number" class="form-control" id="healthMutations" min="0" placeholder="0" oninput="updateBadgePreview()"></div>
            <div class="form-group"><label class="form-label">Stamina Mutations</label><input type="number" class="form-control" id="staminaMutations" min="0" placeholder="0"></div>
            <div class="form-group"><label class="form-label">Oxygen Mutations</label><input type="number" class="form-control" id="oxygenMutations" min="0" placeholder="0"></div>
          </div>
          <div class="form-row cols-3">
            <div class="form-group"><label class="form-label">Food Mutations</label><input type="number" class="form-control" id="foodMutations" min="0" placeholder="0"></div>
            <div class="form-group"><label class="form-label">Weight Mutations</label><input type="number" class="form-control" id="weightMutations" min="0" placeholder="0"></div>
            <div class="form-group"><label class="form-label">Melee Mutations</label><input type="number" class="form-control" id="meleeMutations" min="0" placeholder="0" oninput="updateBadgePreview()"></div>
          </div>
        </div>

        <!-- Domestic Levels -->
        <div class="form-section">
          <div class="section-title">📈 Domestic Level Distribution</div>
          <p style="margin-bottom: 16px; color: #94a3b8; font-size: 14px;">Track how many levels you've allocated to each stat after taming</p>
          <div class="form-row cols-3">
            <div class="form-group"><label class="form-label">Health Levels</label><input type="number" class="form-control" id="healthLevels" min="0" placeholder="0" oninput="updateBadgePreview()"></div>
            <div class="form-group"><label class="form-label">Stamina Levels</label><input type="number" class="form-control" id="staminaLevels" min="0" placeholder="0"></div>
            <div class="form-group"><label class="form-label">Oxygen Levels</label><input type="number" class="form-control" id="oxygenLevels" min="0" placeholder="0"></div>
          </div>
          <div class="form-row cols-3">
            <div class="form-group"><label class="form-label">Food Levels</label><input type="number" class="form-control" id="foodLevels" min="0" placeholder="0"></div>
            <div class="form-group"><label class="form-label">Weight Levels</label><input type="number" class="form-control" id="weightLevels" min="0" placeholder="0"></div>
            <div class="form-group"><label class="form-label">Melee Levels</label><input type="number" class="form-control" id="meleeLevels" min="0" placeholder="0" oninput="updateBadgePreview()"></div>
          </div>
        </div>

        <!-- Notes -->
        <div class="form-section">
          <div class="section-title">📝 Additional Notes</div>
          <textarea class="form-control" id="creatureNotes" placeholder="Notes about colors, stats, breeding goals, special abilities, etc." rows="3"></textarea>
        </div>

        <!-- Badge Preview -->
        <div class="badge-preview">
          <div class="section-title">🏆 Badge Preview</div>
          <div id="badgePreviewContent" class="badge-preview-content">Enter stats to see badge qualifications</div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="cancelCreatureBtn">Cancel</button>
        <button class="btn btn-primary" id="saveCreatureBtn">Save Creature</button>
      </div>
    </div>
  `;

  // Prefill if editing
  setTimeout(() => {
    try {
    if (creature) {
      document.getElementById('creatureName').value = creature.name || '';
      document.getElementById('creatureGender').value = creature.gender || 'Male';
      document.getElementById('creatureLevel').value = creature.level || '';
      document.getElementById('baseStatHealth').value = creature.baseStats?.Health || '';
      document.getElementById('baseStatStamina').value = creature.baseStats?.Stamina || '';
      document.getElementById('baseStatOxygen').value = creature.baseStats?.Oxygen || '';
      document.getElementById('baseStatFood').value = creature.baseStats?.Food || '';
      document.getElementById('baseStatWeight').value = creature.baseStats?.Weight || '';
      document.getElementById('baseStatMelee').value = creature.baseStats?.Melee || '';

      document.getElementById('healthMutations').value = creature.mutations?.Health || '';
      document.getElementById('staminaMutations').value = creature.mutations?.Stamina || '';
      document.getElementById('oxygenMutations').value = creature.mutations?.Oxygen || '';
      document.getElementById('foodMutations').value = creature.mutations?.Food || '';
      document.getElementById('weightMutations').value = creature.mutations?.Weight || '';
      document.getElementById('meleeMutations').value = creature.mutations?.Melee || '';

      document.getElementById('healthLevels').value = creature.domesticLevels?.Health || '';
      document.getElementById('staminaLevels').value = creature.domesticLevels?.Stamina || '';
      document.getElementById('oxygenLevels').value = creature.domesticLevels?.Oxygen || '';
      document.getElementById('foodLevels').value = creature.domesticLevels?.Food || '';
      document.getElementById('weightLevels').value = creature.domesticLevels?.Weight || '';
      document.getElementById('meleeLevels').value = creature.domesticLevels?.Melee || '';

      document.getElementById('creatureNotes').value = creature.notes || '';
      if (creature.image) {
      document.getElementById('imagePreview').innerHTML = `<img src="${creature.image}" alt="Preview" class="image-upload-preview">`;
      }
    }
    } catch (_) {}

    // Wire buttons
    document.getElementById('closeCreatureBtn')?.addEventListener('click', closeCreatureModal);
    document.getElementById('cancelCreatureBtn')?.addEventListener('click', closeCreatureModal);
    document.getElementById('saveCreatureBtn')?.addEventListener('click', () => saveCreatureFromForm());
  }, 20);

  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
  updateBadgePreview();
  }

  function closeCreatureModal() {
  const modal = document.getElementById('creatureModal');
  if (!modal) return;
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
  // do not wipe innerHTML so user file can remain for editing if needed
  }

  // Simple detail modal
  function openCreatureDetailModal(creature) {
    const modal = document.getElementById('creatureDetailModal');
    if (!modal) return console.warn('creatureDetailModal missing');
      // build a richer detail view including all six stats, mutations and domestic levels
      const created = creature.createdAt ? new Date(creature.createdAt).toLocaleString() : '';
      const updated = creature.updatedAt ? new Date(creature.updatedAt).toLocaleString() : '';
      const stats = creature.baseStats || {};
      const muts = creature.mutations || {};
      const levels = creature.domesticLevels || {};
      modal.innerHTML = `
        <div class="modal-content modal-creature-detail" style="max-width:820px; width:calc(100% - 40px);">
          <div class="modal-header">
            <h3 class="modal-title" id="creatureDetailTitle">${creature.name}</h3>
            <button class="close-btn" id="closeCreatureDetailBtn">&times;</button>
          </div>
          <div class="modal-body" style="max-height:70vh; overflow-y:auto; overflow-x:hidden;">
            <div style="display:flex; gap:18px; align-items:flex-start; flex-wrap:wrap;">
              <div style="flex:0 0 96px; max-width:96px;">
                ${creature.image ? `<img src="${creature.image}" class="creature-detail-image" style="width:96px;height:96px;border-radius:8px;object-fit:cover;">` : `<div class="creature-detail-image-placeholder" style="width:96px;height:96px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:36px;">${(SPECIES_DATABASE && SPECIES_DATABASE[creature.species]?.icon) || '🦖'}</div>`}
              </div>
              <div style="flex:1 1 320px; min-width:220px;">
                <div style="display:flex;align-items:center;gap:12px;justify-content:space-between;flex-wrap:wrap;">
                  <div>
                    <div style="font-size:20px;font-weight:700;">${creature.name} <span style="font-size:12px;color:#9ca3af;margin-left:6px;">${creature.gender || ''}</span></div>
                    <div style="color:#9ca3af;margin-top:6px;">Level ${creature.level || 1} • ${creature.species || ''}</div>
                  </div>
                  <div style="margin-left:auto;">${(window.BadgeSystem && BadgeSystem.generateBadgeHTML) ? (BadgeSystem.generateBadgeHTML(creature) || '') : ''}</div>
                </div>
                ${creature.notes ? `<div style="margin-top:10px;color:#cbd5e1;line-height:1.4;">${creature.notes}</div>` : ''}
              </div>
            </div>

            <div style="margin-top:14px;">
              <!-- Two rows of three stats each -->
              <div style="display:flex;gap:12px;flex-wrap:wrap;">
                <div style="display:flex;gap:12px;width:100%;">
                  ${['Health','Stamina','Oxygen'].map(stat => {
                    const base = stats[stat] || 0;
                    const mut = muts[stat] || 0;
                    const dom = levels[stat] || 0;
                    return `
                      <div style="flex:1 1 33%; min-width:120px;">
                        <div style="font-size:11px;color:#94a3b8;margin-bottom:6px;text-transform:uppercase;">${stat}</div>
                        <div style="background:rgba(255,255,255,0.04);border-radius:6px;padding:6px;display:flex;align-items:center;gap:8px;">
                          <div style="flex:1;">
                            <div style="height:8px;background:rgba(255,255,255,0.06);border-radius:6px;overflow:hidden;position:relative;">
                              <div style="position:absolute;left:0;top:0;height:100%;width:${Math.min(100, Math.round((base / Math.max(1, base+mut+dom)) * 100))}%;background:linear-gradient(90deg,#2563eb,#4f46e5);"></div>
                            </div>
                          </div>
                          <div style="min-width:70px;text-align:right;font-weight:600;color:#e6eef8;">${base}/${mut}/${dom}</div>
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>

                <div style="display:flex;gap:12px;width:100%;margin-top:10px;">
                  ${['Food','Weight','Melee'].map(stat => {
                    const base = stats[stat] || 0;
                    const mut = muts[stat] || 0;
                    const dom = levels[stat] || 0;
                    return `
                      <div style="flex:1 1 33%; min-width:120px;">
                        <div style="font-size:11px;color:#94a3b8;margin-bottom:6px;text-transform:uppercase;">${stat}</div>
                        <div style="background:rgba(255,255,255,0.04);border-radius:6px;padding:6px;display:flex;align-items:center;gap:8px;">
                          <div style="flex:1;">
                            <div style="height:8px;background:rgba(255,255,255,0.06);border-radius:6px;overflow:hidden;position:relative;">
                              <div style="position:absolute;left:0;top:0;height:100%;width:${Math.min(100, Math.round((base / Math.max(1, base+mut+dom)) * 100))}%;background:linear-gradient(90deg,#2563eb,#4f46e5);"></div>
                            </div>
                          </div>
                          <div style="min-width:70px;text-align:right;font-weight:600;color:#e6eef8;">${base}/${mut}/${dom}</div>
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            </div>

            <div style="margin-top:12px;color:#94a3b8;font-size:12px;">Created: ${created} • Updated: ${updated}</div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="closeCreatureDetailBtnFoot">Close</button>
            <button class="btn btn-primary" id="editCreatureFromDetail">Edit</button>
          </div>
        </div>
      `;
    const closeBtn = document.getElementById('closeCreatureDetailBtn');
      // wire both close buttons
      const closeBtnHeader = document.getElementById('closeCreatureDetailBtn');
      const closeBtnFoot = document.getElementById('closeCreatureDetailBtnFoot');
      if (closeBtnHeader) closeBtnHeader.onclick = () => closeCreatureDetailModal();
      if (closeBtnFoot) closeBtnFoot.onclick = () => closeCreatureDetailModal();
      const editBtn = document.getElementById('editCreatureFromDetail');
      if (editBtn) editBtn.onclick = () => { closeCreatureDetailModal(); openCreatureModal(creature); };
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
  if (addBtn) addBtn.onclick = () => { try { window.appState.currentSpecies = speciesName; } catch (e) {} ; openCreatureModal(null); };
    const backBtn = document.getElementById('backToSpeciesBtn');
    if (backBtn) backBtn.onclick = () => { if (typeof window.loadSpeciesPage === 'function') window.loadSpeciesPage(); };

    // Wire tabs (use event.currentTarget for robustness and prevent default)
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        try { e.preventDefault(); } catch (ex) {}
        const target = (e.currentTarget && e.currentTarget.getAttribute('data-target')) || btn.getAttribute('data-target');
        if (target) switchTab(target);
      });
    });

  // Wire view toggle buttons
  const cardViewBtn = document.getElementById('cardViewBtn');
  const listViewBtn = document.getElementById('listViewBtn');
  if (cardViewBtn) cardViewBtn.addEventListener('click', (e) => { e.preventDefault(); setCreatureView('card'); cardViewBtn.classList.add('active'); listViewBtn?.classList.remove('active'); });
  if (listViewBtn) listViewBtn.addEventListener('click', (e) => { e.preventDefault(); setCreatureView('list'); listViewBtn.classList.add('active'); cardViewBtn?.classList.remove('active'); });

  // Populate creatures grid using the full renderer
  try { loadCreaturesGrid(speciesName); } catch (e) { console.warn('loadCreaturesGrid failed', e); }
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

// --- Extended helpers copied from Old Nugget for exact UI behavior ---
// Handle image file input for the modal
function handleImageUpload(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const preview = document.getElementById('imagePreview');
    if (preview) preview.innerHTML = `<img src="${e.target.result}" alt="Preview" class="image-upload-preview">`;
  };
  reader.readAsDataURL(file);
}
window.handleImageUpload = handleImageUpload;

function updateBadgePreview() {
  try {
    const creature = {
      baseStats: {
        Health: parseInt(document.getElementById('baseStatHealth')?.value) || 0,
        Stamina: parseInt(document.getElementById('baseStatStamina')?.value) || 0,
        Food: parseInt(document.getElementById('baseStatFood')?.value) || 0,
        Weight: parseInt(document.getElementById('baseStatWeight')?.value) || 0,
        Melee: parseInt(document.getElementById('baseStatMelee')?.value) || 0
      }
    };
    const bloodline = (window.BadgeSystem && BadgeSystem.calculatePrizedBloodline) ? BadgeSystem.calculatePrizedBloodline(creature) : { qualified: false };
    const previewContent = document.getElementById('badgePreviewContent');
    if (!previewContent) return;
    if (bloodline.qualified) {
      const badgeClass = `badge-${bloodline.tier}`;
      previewContent.innerHTML = `<div class="badge ${badgeClass}">${bloodline.tier.toUpperCase()} BLOODLINE</div><span style="color:#94a3b8;">Minimum stat: ${bloodline.minStat} points</span>`;
    } else {
      previewContent.innerHTML = `<span style="color:#64748b;">No badge qualification yet</span><span style="color:#94a3b8;">• Need all 5 core stats ≥45 for Bronze</span>`;
    }
  } catch (e) { /* ignore */ }
}
window.updateBadgePreview = updateBadgePreview;

function generateId() {
  return 'creature_' + Date.now() + '_' + Math.random().toString(36).substr(2,9);
}

async function saveCreatureFromForm() {
  try {
    const name = (document.getElementById('creatureName')?.value || '').trim();
    if (!name) { alert('Please enter a creature name'); return; }
    const imageEl = document.querySelector('#imagePreview img');
    const creatureData = {
      id: appState.editingCreature || generateId(),
      name,
      species: appState.currentSpecies || null,
      gender: document.getElementById('creatureGender')?.value || 'Male',
      level: parseInt(document.getElementById('creatureLevel')?.value) || 1,
      image: imageEl ? imageEl.src : null,
      baseStats: {
        Health: parseInt(document.getElementById('baseStatHealth')?.value) || 0,
        Stamina: parseInt(document.getElementById('baseStatStamina')?.value) || 0,
        Oxygen: parseInt(document.getElementById('baseStatOxygen')?.value) || 0,
        Food: parseInt(document.getElementById('baseStatFood')?.value) || 0,
        Weight: parseInt(document.getElementById('baseStatWeight')?.value) || 0,
        Melee: parseInt(document.getElementById('baseStatMelee')?.value) || 0
      },
      mutations: {
        Health: parseInt(document.getElementById('healthMutations')?.value) || 0,
        Stamina: parseInt(document.getElementById('staminaMutations')?.value) || 0,
        Oxygen: parseInt(document.getElementById('oxygenMutations')?.value) || 0,
        Food: parseInt(document.getElementById('foodMutations')?.value) || 0,
        Weight: parseInt(document.getElementById('weightMutations')?.value) || 0,
        Melee: parseInt(document.getElementById('meleeMutations')?.value) || 0
      },
      domesticLevels: {
        Health: parseInt(document.getElementById('healthLevels')?.value) || 0,
        Stamina: parseInt(document.getElementById('staminaLevels')?.value) || 0,
        Oxygen: parseInt(document.getElementById('oxygenLevels')?.value) || 0,
        Food: parseInt(document.getElementById('foodLevels')?.value) || 0,
        Weight: parseInt(document.getElementById('weightLevels')?.value) || 0,
        Melee: parseInt(document.getElementById('meleeLevels')?.value) || 0
      },
      notes: document.getElementById('creatureNotes')?.value || '',
      createdAt: (appState.editingCreature && (appState.creatures.find(c => c.id === appState.editingCreature)?.createdAt)) || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

  // Try a direct credentialed POST to the API; avoid apiFetch here to prevent automatic
  // refresh/logout flows interrupting the modal. Fall back to local save on any failure.
  try {
    const payload = Object.assign({}, creatureData);
    const url = (typeof API_BASE === 'string' ? API_BASE.replace(/\/$/, '') : '') + '/api/creature';
    const resp = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: payload })
    });
    if (resp && resp.ok) {
      try { const body = await resp.json(); if (body && body.id) payload.id = body.id; } catch (e) {}
      const idx = appState.creatures.findIndex(c => c.id === appState.editingCreature || c.id === creatureData.id);
      if (idx >= 0) appState.creatures[idx] = payload; else appState.creatures.push(payload);
    } else {
      const idx = appState.creatures.findIndex(c => c.id === appState.editingCreature || c.id === creatureData.id);
      if (idx >= 0) appState.creatures[idx] = creatureData; else appState.creatures.push(creatureData);
    }
  } catch (e) {
    const idx = appState.creatures.findIndex(c => c.id === appState.editingCreature || c.id === creatureData.id);
    if (idx >= 0) appState.creatures[idx] = creatureData; else appState.creatures.push(creatureData);
  }

    // persist and refresh via main app hooks if present
    try { localStorage.setItem('arkCreatures', JSON.stringify(appState.creatures || [])); } catch (e) {}
    try { if (typeof saveData === 'function') saveData(); } catch (e) {}
    try { if (typeof closeCreatureModal === 'function') closeCreatureModal(); } catch (e) {}
    try { if (typeof loadSpeciesPage === 'function') loadSpeciesPage(); } catch (e) {}
    try { if (typeof updateStatsDashboard === 'function') updateStatsDashboard(); } catch (e) {}
  } catch (err) { console.error('saveCreatureFromForm failed', err); }
}

// Render creatures grid/cards exactly like Old Nugget
function loadCreaturesGrid(speciesName) {
  const grid = document.getElementById('creaturesGrid');
  if (!grid) return;
  const creatures = (appState.creatures || []).filter(c => (speciesName ? c.species === speciesName : true));
  grid.innerHTML = '';
  if (!creatures || creatures.length === 0) {
    grid.innerHTML = '<div class="no-creatures">No creatures saved for this species.</div>';
    return;
  }
  creatures.forEach(creature => {
    const isList = grid.classList.contains('list-view');
    const card = document.createElement('div');
    card.className = 'creature-card' + (isList ? ' list-row' : '');
    card.tabIndex = 0;

    const stats = creature.baseStats || {};
    const muts = creature.mutations || {};

    card.innerHTML = `
      <div class="creature-card-header">
        ${creature.image ? `<img class="creature-image" src="${creature.image}" alt="${creature.name}">` : `<div class="creature-image-placeholder">${(typeof SPECIES_DATABASE !== 'undefined' && SPECIES_DATABASE[creature.species]?.icon) || '🦖'}</div>`}
        <div class="creature-card-main">
          <div class="creature-name">${creature.name}</div>
          <div class="creature-meta">Level ${creature.level || 1} • ${creature.gender || ''} • ${creature.species || ''}</div>
          <div class="creature-stats">
            <div class="stat-item"><div class="stat-label">❤️</div><div class="stat-value">${(stats.Health||0)}/${(muts.Health||0)}/${(creature.domesticLevels?.Health||0)}</div></div>
            <div class="stat-item"><div class="stat-label">🏃</div><div class="stat-value">${(stats.Stamina||0)}/${(muts.Stamina||0)}/${(creature.domesticLevels?.Stamina||0)}</div></div>
            <div class="stat-item"><div class="stat-label">💨</div><div class="stat-value">${(stats.Oxygen||0)}/${(muts.Oxygen||0)}/${(creature.domesticLevels?.Oxygen||0)}</div></div>
            <div class="stat-item"><div class="stat-label">🍖</div><div class="stat-value">${(stats.Food||0)}/${(muts.Food||0)}/${(creature.domesticLevels?.Food||0)}</div></div>
            <div class="stat-item"><div class="stat-label">⚖️</div><div class="stat-value">${(stats.Weight||0)}/${(muts.Weight||0)}/${(creature.domesticLevels?.Weight||0)}</div></div>
            <div class="stat-item"><div class="stat-label">🗡️</div><div class="stat-value">${(stats.Melee||0)}/${(muts.Melee||0)}/${(creature.domesticLevels?.Melee||0)}</div></div>
          </div>
        </div>
        <div class="creature-card-actions">
          <button class="btn btn-secondary edit-creature" data-id="${creature.id}">Edit</button>
          <button class="btn btn-danger delete-creature" data-id="${creature.id}">Delete</button>
        </div>
      </div>
    `;

    // Edit and delete buttons
    card.querySelectorAll('.edit-creature').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); openCreatureModal(creature); }));
    card.querySelectorAll('.delete-creature').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); deleteCreature(creature.id); }));

    card.addEventListener('click', () => openCreatureDetailModal(creature));
    grid.appendChild(card);
  });
}
window.loadCreaturesGrid = loadCreaturesGrid;

function deleteCreature(id) {
  if (!id) return;
  const idx = appState.creatures.findIndex(c => c.id === id);
  if (idx === -1) return;
  if (!confirm('Delete this creature?')) return;
  appState.creatures.splice(idx,1);
  try { localStorage.setItem('arkCreatures', JSON.stringify(appState.creatures || [])); } catch (e) {}
  try { loadCreaturesGrid(appState.currentSpecies); } catch (e) {}
  try { updateStatsDashboard(); } catch (e) {}
}
window.deleteCreature = deleteCreature;

// Toggle between card/list views (based on Old Nugget UI)
function setCreatureView(view) {
  const grid = document.getElementById('creaturesGrid');
  if (!grid) return;
  if (view === 'list') grid.classList.add('list-view'); else grid.classList.remove('list-view');
}
window.setCreatureView = setCreatureView;

// Expose the modal-save helper under a scoped name so we don't clobber main.js saveCreature
window.saveCreatureForm = saveCreatureFromForm;
