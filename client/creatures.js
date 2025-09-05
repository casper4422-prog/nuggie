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
  function openCreaturePage(speciesName) {
    if (!speciesName) return;
    if (!window.appState) window.appState = { creatures: [] };
    window.appState.currentSpecies = speciesName;
    // Render a minimal species detail view (main.js will also handle more complex behavior)
    const mainContent = document.getElementById('appMainContent');
    if (!mainContent) return;
    mainContent.innerHTML = `
      <section class="species-detail">
        <h2>${speciesName}</h2>
        <div id="speciesCreatureList">Loading creatures...</div>
        <div class="modal-actions">
          <button id="addCreatureBtn" class="btn btn-primary">Add Creature</button>
        </div>
      </section>
    `;

    // Wire add creature
    const addBtn = document.getElementById('addCreatureBtn');
    if (addBtn) addBtn.onclick = () => openCreatureModal(speciesName);

    // Populate creatures list
    const list = document.getElementById('speciesCreatureList');
    const creatures = (window.appState.creatures || []).filter(c => c.species === speciesName);
    if (!creatures || creatures.length === 0) {
      list.innerHTML = '<div class="no-creatures-yet">No creatures saved for this species.</div>';
    } else {
      list.innerHTML = creatures.map(c => `<div class="creature-list-item">${c.name} (${c.gender||'?'})</div>`).join('');
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
