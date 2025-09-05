// ui-inject.js: Injects exact UI structure and theme from Old Nugget.html at runtime
(function(){
  function injectTheme() {
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'theme-exact.css';
    link.onload = function(){ console.log('[UI-INJECT] theme-exact.css loaded'); };
    document.head.appendChild(link);
    document.documentElement.classList.add('theme-exact');
  }
  function injectHeader() {
    var mainApp = document.getElementById('mainApp');
    if (!mainApp) return;
    // Remove any existing header
    var oldHeader = mainApp.querySelector('.header');
    if (oldHeader) oldHeader.remove();
    // Insert exact header from Old Nugget
    var header = document.createElement('header');
    header.className = 'header';
    header.innerHTML = `<div class="header-content">
      <div class="header-top">
        <div class="logo"><div class="logo-icon">🦕</div>DINO NUGGIES</div>
        <div class="header-actions">
          <button class="btn btn-secondary" id="openTribeBtn">🏛️ Tribe Settings</button>
        </div>
      </div>
      <div class="header-subtitle">Ark Creature Management System Brought to You By Casper4422. Grow Your Armies Here!</div>
      <div class="header-status">Work in Progress, please report any issues or bugs to casper.4422</div>
    </div>`;
    mainApp.prepend(header);
  }
  document.addEventListener('DOMContentLoaded', function(){
    injectTheme();
    injectHeader();
  });
})();
