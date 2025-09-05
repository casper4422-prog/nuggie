/* ui-exact.js
   Injects exact DOM fragments from Old Nugget into the current app shell at runtime so
   index.html remains unchanged. Idempotent and defensive: re-run safe.
*/
(function(){
  function safeHTML(html){
    const tpl = document.createElement('template');
    tpl.innerHTML = html.trim();
    return tpl.content;
  }

  function injectHeader() {
    if (document.querySelector('.theme-exact .header')) return; // already injected
    const headerHTML = `
      <header class="header">
        <div class="header-content">
          <div class="header-top">
            <div class="logo"><div class="logo-icon">🦕</div> DINO NUGGIES</div>
            <div class="header-actions">
              <button class="btn btn-secondary" id="openTribeBtn_injected">🏛️ Tribe Settings</button>
            </div>
          </div>
          <div class="header-subtitle">Ark Creature Management System Brought to You By Casper4422. Grow Your Armies Here!</div>
          <div class="header-status">Work in Progress, please report any issues or bugs to casper.4422</div>
        </div>
      </header>
    `;
    const mainApp = document.getElementById('mainApp');
    if (!mainApp) return;
    // insert header before mainApp's first child
    const node = safeHTML(headerHTML);
    mainApp.insertBefore(node, mainApp.firstChild);
    // wire injected tribe button to existing handler if present
    const injectedBtn = document.getElementById('openTribeBtn_injected');
    if (injectedBtn) injectedBtn.addEventListener('click', () => { try { if (typeof showTribeSettings === 'function') showTribeSettings(); else console.warn('showTribeSettings not available'); } catch(e){} });
  }

  function injectSpeciesPage() {
    // If species grid exists, skip
    if (document.getElementById('speciesGrid')) return;
    const speciesHTML = `
      <div id="speciesPage">
        <div class="stats-grid" id="statsGrid_injected">
          <div class="stat-card"><div class="stat-number" id="totalCreatures">0</div><div class="stat-label">Total Creatures</div></div>
          <div class="stat-card"><div class="stat-number" id="speciesTracked">0</div><div class="stat-label">Species Tracked</div></div>
          <div class="stat-card"><div class="stat-number" id="bossReadySpecies">0</div><div class="stat-label">Boss Ready Species</div></div>
          <div class="stat-card"><div class="stat-number" id="prizedBloodlines">0</div><div class="stat-label">Prized Bloodlines</div></div>
          <div class="stat-card"><div class="stat-number" id="highestLevel">1</div><div class="stat-label">Highest Level</div></div>
        </div>
        <div class="main-content">
          <div class="species-controls">
            <div class="search-box"><span class="search-icon">🔍</span><input type="text" class="search-input" id="searchInput" placeholder="Search species by name or type..."></div>
            <select class="filter-select" id="categoryFilter"></select>
            <select class="filter-select" id="rarityFilter"></select>
          </div>
          <div class="species-grid" id="speciesGrid"></div>
        </div>
      </div>
    `;
    const appMain = document.getElementById('appMainContent') || document.getElementById('mainApp');
    if (!appMain) return;
    appMain.appendChild(safeHTML(speciesHTML));

    // Populate category options with a helpful default list (matches Old Nugget)
    const cat = document.getElementById('categoryFilter');
    const cats = ["","carnivore","herbivore","omnivore","flyer","combat","utility","transport","harvesting","boss"];
    cats.forEach(c => { const opt = document.createElement('option'); opt.value = c; opt.textContent = c || 'All Categories'; cat.appendChild(opt); });
    const rar = document.getElementById('rarityFilter');
    const rars = ["","common","uncommon","rare","legendary","event","mission","tek"];
    rars.forEach(r => { const opt = document.createElement('option'); opt.value = r; opt.textContent = r || 'All Rarities'; rar.appendChild(opt); });

    // Wire search/filter to existing filterSpecies() if present, else fallback to dispatching an input event
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.addEventListener('input', () => { try { if (typeof filterSpecies === 'function') filterSpecies(); else { const ev = new Event('input'); searchInput.dispatchEvent(ev); } } catch(e){} });
    }
    if (cat) cat.addEventListener('change', () => { try { if (typeof filterSpecies === 'function') filterSpecies(); } catch(e){} });
    if (rar) rar.addEventListener('change', () => { try { if (typeof filterSpecies === 'function') filterSpecies(); } catch(e){} });
  }

  // Apply theme-exact stylesheet if present, else load it
  function ensureStyles() {
    if (document.querySelector('link[href="theme-exact.css"]')) return Promise.resolve();
    return new Promise((resolve) => {
      const l = document.createElement('link');
      l.rel = 'stylesheet'; l.href = 'theme-exact.css';
      l.onload = () => resolve(); l.onerror = () => resolve(); document.head.appendChild(l);
    });
  }

  async function init() {
    await ensureStyles();
    document.documentElement.classList.add('theme-exact');
    try { injectHeader(); } catch (e) { console.warn('injectHeader failed', e); }
    try { injectSpeciesPage(); } catch (e) { console.warn('injectSpeciesPage failed', e); }
    // Refresh any existing UI views
    try { if (typeof updateStatsDashboard === 'function') updateStatsDashboard(); } catch (e) {}
    try { if (typeof loadSpeciesPage === 'function') loadSpeciesPage(); } catch (e) {}
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') init(); else document.addEventListener('DOMContentLoaded', init);
})();
