// Lightweight BadgeSystem: calculates simple badge qualification and renders small badge HTML.
(function(){
  const BadgeSystem = {
    // Determine prized bloodline qualification based on simple rule-set.
    // This is intentionally conservative and easy to read — adjust later for game rules.
    calculatePrizedBloodline(creature){
      if (!creature || !creature.baseStats) return { qualified: false, tier: null, minStat: 0 };
      const core = ['Health','Stamina','Oxygen','Food','Weight'];
      const values = core.map(s => Number(creature.baseStats?.[s] || 0));
      const minStat = Math.min(...values);
      // Bronze: all core >=45, Silver >=60, Gold >=75 (example thresholds)
      const qualifiedBronze = values.every(v => v >= 45);
      const qualifiedSilver = values.every(v => v >= 60);
      const qualifiedGold = values.every(v => v >= 75);
      if (qualifiedGold) return { qualified: true, tier: 'gold', minStat };
      if (qualifiedSilver) return { qualified: true, tier: 'silver', minStat };
      if (qualifiedBronze) return { qualified: true, tier: 'bronze', minStat };
      return { qualified: false, tier: null, minStat };
    },

    // Return a small HTML snippet for a creature's badges (safe if not qualified)
    generateBadgeHTML(creature){
      try {
        const res = BadgeSystem.calculatePrizedBloodline(creature);
        if (!res.qualified) return '';
        const cls = `badge-${res.tier}`;
        return `<span class="badge ${cls}">${res.tier.toUpperCase()} BLOODLINE</span>`;
      } catch (e) {
        return '';
      }
    }
  };

  // Export to window
  if (typeof window !== 'undefined') window.BadgeSystem = BadgeSystem;
})();
