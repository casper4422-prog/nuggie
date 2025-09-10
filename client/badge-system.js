// Lightweight BadgeSystem: calculates achievements and renders small badge HTML.
(function(){
  const BadgeSystem = {
    // Determine prized bloodline qualification using legacy Old Nugget rules.
    // Legacy core stats omitted Oxygen and used thresholds: Bronze >=45, Silver >=50, Gold >=55
    calculatePrizedBloodline(creature){
      if (!creature || !creature.baseStats) return { qualified: false, tier: null, minStat: 0 };
      const core = ['Health','Stamina','Food','Weight','Melee'];
      const values = core.map(s => Number(creature.baseStats?.[s] || 0));
      // ignore zeros when computing min (legacy filtered zero values)
      const positive = values.filter(v => typeof v === 'number' && v > 0);
      const minStat = positive.length > 0 ? Math.min(...positive) : 0;

  const qualifiedBronze = positive.length === core.length && values.every(v => v >= 45);
  const qualifiedSilver = positive.length === core.length && values.every(v => v >= 50);
  const qualifiedGold = positive.length === core.length && values.every(v => v >= 55);
  const qualifiedDiamond = positive.length === core.length && values.every(v => v >= 60);

  if (qualifiedDiamond) return { qualified: true, tier: 'diamond', minStat, id: 'prized_bloodline', name: 'Prized Bloodline', meta: { announce: true } };
  if (qualifiedGold) return { qualified: true, tier: 'gold', minStat, id: 'prized_bloodline', name: 'Prized Bloodline' };
  if (qualifiedSilver) return { qualified: true, tier: 'silver', minStat, id: 'prized_bloodline', name: 'Prized Bloodline' };
  if (qualifiedBronze) return { qualified: true, tier: 'bronze', minStat, id: 'prized_bloodline', name: 'Prized Bloodline' };
      return { qualified: false, tier: null, minStat, id: 'prized_bloodline', name: 'Prized Bloodline' };
    },

    // Legacy helper to format stat displays like "base/mutations/levels"
    formatStatDisplay(basePoints, mutations, levels) {
      return `${basePoints || 0}/${mutations || 0}/${levels || 0}`;
    },

    // Legacy helper to compute total effective stat (1 mutation = 2 levels)
    calculateTotal(basePoints, mutations, levels, scaling = 1) {
      const mutationLevels = (mutations || 0) * 2;
      return ((basePoints || 0) + mutationLevels + (levels || 0)) * (scaling || 1);
    },

  // Mutation Master and Tank achievements removed per request

    // Boss Ready calculations per provided rules (uses total = base + mutations*2 + domesticLevels)
    calculateBossReady(creature){
      try {
        if (!creature) return [];
        const base = creature.baseStats || {};
        const muts = creature.mutations || {};
        const dom = creature.domesticLevels || {};

        const healthTotal = BadgeSystem.calculateTotal(base.Health || 0, muts.Health || 0, dom.Health || 0);
        const meleeTotal = BadgeSystem.calculateTotal(base.Melee || 0, muts.Melee || 0, dom.Melee || 0);
        const staminaTotal = BadgeSystem.calculateTotal(base.Stamina || 0, muts.Stamina || 0, dom.Stamina || 0);
        const weightTotal = BadgeSystem.calculateTotal(base.Weight || 0, muts.Weight || 0, dom.Weight || 0);

        const badges = [];
        // Main difficulty tiers (require both Health and Melee thresholds)
        if (healthTotal >= 150 && meleeTotal >= 150) badges.push({ id: 'boss_titan_slayer', name: 'Titan Slayer', qualified: true, tier: 'titan', meta:{ healthTotal, meleeTotal } });
        else if (healthTotal >= 125 && meleeTotal >= 125) badges.push({ id: 'boss_alpha_ready', name: 'Alpha Ready', qualified: true, tier: 'alpha', meta:{ healthTotal, meleeTotal } });
        else if (healthTotal >= 100 && meleeTotal >= 100) badges.push({ id: 'boss_beta_ready', name: 'Beta Ready', qualified: true, tier: 'beta', meta:{ healthTotal, meleeTotal } });
        else if (healthTotal >= 75 && meleeTotal >= 75) badges.push({ id: 'boss_gamma_ready', name: 'Gamma Ready', qualified: true, tier: 'gamma', meta:{ healthTotal, meleeTotal } });

        // Specialized role badges (can exist independently)
        if (healthTotal >= 175) badges.push({ id: 'boss_tank', name: 'Boss Tank', qualified: true, tier: 'gold', meta:{ healthTotal } });
        if (meleeTotal >= 175) badges.push({ id: 'boss_dps', name: 'Boss DPS', qualified: true, tier: 'gold', meta:{ meleeTotal } });
        if (healthTotal >= 125 && staminaTotal >= 125) badges.push({ id: 'boss_juggernaut', name: 'Boss Juggernaut', qualified: true, tier: 'gold', meta:{ healthTotal, staminaTotal } });
        if (healthTotal >= 125 && weightTotal >= 125) badges.push({ id: 'boss_bruiser', name: 'Boss Bruiser', qualified: true, tier: 'gold', meta:{ healthTotal, weightTotal } });

        // Normalize to minimal shape like other calculators
        return badges.map(b => ({ id: b.id, name: b.name, qualified: !!b.qualified, tier: b.tier || null, meta: b.meta || {} }));
      } catch (e) { return []; }
    },

    // Underdog calculations: exclude canonical meta-boss species, use harsher thresholds
    calculateUnderdog(creature){
      try {
        if (!creature) return [];
        const ineligible = [
          'rex','giganotosaurus','carcharodontosaurus','therizinosaurus','deinonychus','megatherium','yutyrannus','daeodon','woolly rhino','shadowmane','reaper','rock drake'
        ];
        const species = (creature.species || '').toString().toLowerCase();
        // If species is one of the revised meta boss creatures, do not award underdog tiers
        if (ineligible.some(n => species.indexOf(n) !== -1)) return [];

        const base = creature.baseStats || {};
        const muts = creature.mutations || {};
        const dom = creature.domesticLevels || {};
        const healthTotal = BadgeSystem.calculateTotal(base.Health || 0, muts.Health || 0, dom.Health || 0);
        const meleeTotal = BadgeSystem.calculateTotal(base.Melee || 0, muts.Melee || 0, dom.Melee || 0);
        const badges = [];
        if (healthTotal >= 160 && meleeTotal >= 160) badges.push({ id: 'underdog_titan', name: 'Underdog Titan', qualified: true, tier: 'titan', meta:{ healthTotal, meleeTotal } });
        else if (healthTotal >= 140 && meleeTotal >= 140) badges.push({ id: 'underdog_legend', name: 'Underdog Legend', qualified: true, tier: 'alpha', meta:{ healthTotal, meleeTotal } });
        else if (healthTotal >= 115 && meleeTotal >= 115) badges.push({ id: 'underdog_hero', name: 'Underdog Hero', qualified: true, tier: 'beta', meta:{ healthTotal, meleeTotal } });
        else if (healthTotal >= 90 && meleeTotal >= 90) badges.push({ id: 'underdog_champion', name: 'Underdog Champion', qualified: true, tier: 'gamma', meta:{ healthTotal, meleeTotal } });

        return badges.map(b => ({ id: b.id, name: b.name, qualified: !!b.qualified, tier: b.tier || null, meta: b.meta || {} }));
      } catch (e) { return []; }
    },

    // Aggregate all achievement calculators into a list
    calculateAchievements(creature){
      try {
        const ach = [];
  // Prized is a single-object result
  const prized = BadgeSystem.calculatePrizedBloodline(creature);
  if (prized && prized.qualified) ach.push(prized);
  // (Mutation Master and Tank removed)
  // Boss Ready may return multiple badges
  const bossBadges = BadgeSystem.calculateBossReady(creature) || [];
  bossBadges.forEach(b => { if (b && b.qualified) ach.push(b); });
  // Underdog may return multiple badges (and will be empty for ineligible species)
  const underdogBadges = BadgeSystem.calculateUnderdog(creature) || [];
  underdogBadges.forEach(b => { if (b && b.qualified) ach.push(b); });

  // Normalize and return
  return ach.filter(a => a && a.qualified).map(a => ({ id: a.id, name: a.name, tier: a.tier, meta: a }));
      } catch (e) { return []; }
    },

    // Return a small HTML snippet for a creature's badges using emojis (accessible)
    generateBadgeHTML(creature){
      try {
        const achievements = BadgeSystem.calculateAchievements(creature) || [];
        if (!achievements || achievements.length === 0) return '';

        // Helper: map an achievement id + tier to a single emoji (or short emoji string)
        function emojiFor(a){
          const id = (a.id || '').toString().toLowerCase();
          const tier = (a.tier || '').toString().toLowerCase();

          // Prized uses tier-specific medals / diamond
          if (id === 'prized_bloodline'){
            if (tier === 'diamond') return '💎';
            if (tier === 'gold') return '🥇';
            if (tier === 'silver') return '🥈';
            return '🥉';
          }

          // Tank (only boss-specific tank badge uses shield emoji)
          if (id === 'boss_tank') return '🛡️';

          // Boss difficulty tiers: represent by star count
          if (id === 'boss_gamma_ready') return '⭐';
          if (id === 'boss_beta_ready') return '⭐⭐';
          if (id === 'boss_alpha_ready') return '⭐⭐⭐';
          if (id === 'boss_titan_slayer') return '⭐⭐⭐⭐';

          // Boss roles
          if (id === 'boss_dps') return '⚔️';
          if (id === 'boss_juggernaut') return '💪';
          if (id === 'boss_bruiser') return '🪓';

          // Underdog badges: paw + optional stars by tier
          if (id.indexOf('underdog') === 0) {
            if (tier === 'titan') return '🐾⭐⭐⭐';
            if (tier === 'alpha') return '🐾⭐⭐';
            if (tier === 'beta') return '🐾⭐';
            return '🐾';
          }

          // Fallback: a trophy
          return '🏆';
        }

        // Map semantic tiers to visual classes used by CSS (preserve styling hooks)
        const visualMap = {
          'bronze': 'badge-bronze', 'silver': 'badge-silver', 'gold': 'badge-gold',
          'gamma': 'badge-bronze', 'beta': 'badge-silver', 'alpha': 'badge-gold', 'titan': 'badge-gold'
        };

        // Render up to 3 emoji badges, keep full text in title/aria-label for screen-readers
        return achievements.slice(0,3).map(a => {
          const tier = (a.tier || '').toString().toLowerCase();
          const cls = visualMap[tier] || `badge-${tier || 'bronze'}`;
          const emoji = emojiFor(a);
          const title = (typeof escapeHtml === 'function') ? escapeHtml(`${a.name}${a.tier ? ` (${a.tier})` : ''}`) : `${a.name}${a.tier ? ` (${a.tier})` : ''}`;
          const aria = (typeof escapeHtml === 'function') ? escapeHtml(`${a.name} ${a.tier || ''}`) : `${a.name} ${a.tier || ''}`;
          return `<span class="badge ${cls}" role="img" aria-label="${aria}" title="${title}">${emoji}</span>`;
        }).join(' ');
      } catch (e) { return ''; }
    }
  };

  // Export to window
  if (typeof window !== 'undefined') window.BadgeSystem = BadgeSystem;
})();
