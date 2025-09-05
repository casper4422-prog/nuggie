// ui-inject.js: Injects exact UI structure and theme from Old Nugget.html at runtime
(function(){
  // Resolve a base path for assets relative to this script tag so dynamic injection works
  function resolveBasePath() {
    try {
      var cur = document.currentScript && document.currentScript.src;
      if (!cur) {
        var scripts = document.getElementsByTagName('script');
        cur = scripts[scripts.length-1] && scripts[scripts.length-1].src;
      }
      if (!cur) return './';
      return cur.replace(/\/[^/]*$/, '/');
    } catch (e) { return './'; }
  }

  function injectTheme() {
    var base = resolveBasePath();
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    // ensure correct path even when ui-inject.js was appended dynamically
    link.href = base + 'theme-exact.css';
    link.onload = function(){ console.log('[UI-INJECT] theme-exact.css loaded from', link.href); };
    link.onerror = function(){ console.warn('[UI-INJECT] failed to load theme-exact.css from', link.href); };
    document.head.appendChild(link);
    document.documentElement.classList.add('theme-exact');
  }

  function injectHeader() {
    // prefer #mainApp if present, fallback to body
    var mainApp = document.getElementById('mainApp') || document.getElementById('mainContainer') || document.body;
    if (!mainApp) return;
    // Remove any existing header inside our container
    var oldHeader = mainApp.querySelector('.header');
    if (oldHeader) oldHeader.remove();
    // Insert exact header from Old Nugget
    var header = document.createElement('header');
    header.className = 'header';
    header.innerHTML = '<div class="header-content">' +
      '<div class="header-top">' +
        '<div class="logo"><div class="logo-icon">🦕</div>DINO NUGGIES</div>' +
        '<div class="header-actions">' +
          '<button class="btn btn-secondary" id="openTribeBtn">🏛️ Tribe Settings</button>' +
        '</div>' +
      '</div>' +
      '<div class="header-subtitle">Ark Creature Management System Brought to You By Casper4422. Grow Your Armies Here!</div>' +
      '<div class="header-status">Work in Progress, please report any issues or bugs to casper.4422</div>' +
    '</div>';
    // Prepend header to container
    if (mainApp.firstChild) mainApp.insertBefore(header, mainApp.firstChild);
    else mainApp.appendChild(header);
  }

  function runInject() {
    try { injectTheme(); } catch (e) { console.warn('[UI-INJECT] injectTheme error', e); }
    try { injectHeader(); } catch (e) { console.warn('[UI-INJECT] injectHeader error', e); }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runInject);
  } else {
    // DOM already ready — run immediately
    setTimeout(runInject, 0);
  }

})();
