// BadgeSystem — complete badge calculation and rendering engine.
// Sections: Prized Bloodline | Boss Ready | Underdog | Utility/Harvester | Collector
(function () {

  // ── Shared helpers ────────────────────────────────────────────────────────

  // Compute total effective stat points: base + (mutations × 2) + domestic levels
  function calcTotal(base, muts, dom) {
    return (Number(base) || 0) + ((Number(muts) || 0) * 2) + (Number(dom) || 0);
  }

  // Case-insensitive species membership check (partial match)
  function speciesIn(creatureSpecies, list) {
    const s = (creatureSpecies || '').toLowerCase();
    return list.some(n => s.includes(n));
  }

  // Resolve tier → CSS class
  const TIER_CSS = {
    bronze: 'badge-bronze',
    silver: 'badge-silver',
    gold:   'badge-gold',
    diamond:'badge-diamond',
    gamma:  'badge-bronze',
    beta:   'badge-silver',
    alpha:  'badge-gold',
    titan:  'badge-diamond',
  };

  // Resolve badge id + tier → display emoji
  function emojiFor(id, tier) {
    id   = (id   || '').toLowerCase();
    tier = (tier || '').toLowerCase();

    // Prized Bloodline
    if (id === 'prized_bloodline') {
      if (tier === 'diamond') return '💎';
      if (tier === 'gold')    return '🥇';
      if (tier === 'silver')  return '🥈';
      return '🥉';
    }

    // Boss Ready — core tiers
    if (id === 'boss_gamma_ready')  return '⭐';
    if (id === 'boss_beta_ready')   return '⭐⭐';
    if (id === 'boss_alpha_ready')  return '⭐⭐⭐';
    if (id === 'boss_titan_slayer') return '⚡';

    // Boss Ready — role badges
    if (id === 'boss_tank')      return '🛡️';
    if (id === 'boss_dps')       return '⚔️';
    if (id === 'boss_juggernaut')return '💪';
    if (id === 'boss_bruiser')   return '🪓';

    // Underdog
    if (id.startsWith('underdog')) {
      if (tier === 'titan') return '🐾💎';
      if (tier === 'alpha') return '🐾🥇';
      if (tier === 'beta')  return '🐾🥈';
      return '🐾🥉';
    }

    // Utility — Yield Harvester
    if (id === 'util_yield') {
      if (tier === 'diamond') return '⛏️💎';
      if (tier === 'gold')    return '⛏️🥇';
      if (tier === 'silver')  return '⛏️🥈';
      return '⛏️🥉';
    }

    // Utility — Specialized Gatherer
    if (id === 'util_gatherer') {
      if (tier === 'diamond') return '🌿💎';
      if (tier === 'gold')    return '🌿🥇';
      if (tier === 'silver')  return '🌿🥈';
      return '🌿🥉';
    }

    // Utility — Cargo Transport
    if (id === 'util_cargo') {
      if (tier === 'diamond') return '📦💎';
      if (tier === 'gold')    return '📦🥇';
      if (tier === 'silver')  return '📦🥈';
      return '📦🥉';
    }

    // Utility — Mobile Refinery
    if (id === 'util_refinery') {
      if (tier === 'diamond') return '🔥💎';
      if (tier === 'gold')    return '🔥🥇';
      if (tier === 'silver')  return '🔥🥈';
      return '🔥🥉';
    }

    // Utility — Gemstone Specialist
    if (id === 'util_gemstone') {
      if (tier === 'diamond') return '💍💎';
      if (tier === 'gold')    return '💍🥇';
      if (tier === 'silver')  return '💍🥈';
      return '💍🥉';
    }

    // Collector — Boss Slayer track
    if (id.startsWith('collector_boss_slayer')) {
      if (tier === 'diamond') return '🗡️💎';
      if (tier === 'gold')    return '🗡️🥇';
      if (tier === 'silver')  return '🗡️🥈';
      return '🗡️🥉';
    }

    // Collector — Master Harvester track
    if (id.startsWith('collector_harvester')) {
      if (tier === 'diamond') return '🪓💎';
      if (tier === 'gold')    return '🪓🥇';
      if (tier === 'silver')  return '🪓🥈';
      return '🪓🥉';
    }

    // Collector — Transport Specialist track
    if (id.startsWith('collector_transport')) {
      if (tier === 'diamond') return '🗺️💎';
      if (tier === 'gold')    return '🗺️🥇';
      if (tier === 'silver')  return '🗺️🥈';
      return '🗺️🥉';
    }

    return '🏆';
  }

  // ── Meta lists ─────────────────────────────────────────────────────────────

  // Creatures eligible for Boss Ready (NOT eligible for Underdog)
  // Allosaurus intentionally excluded — Casper moved it to Underdog eligibility
  const META_LIST = [
    'rex', 'giganotosaurus', 'carcharodontosaurus', 'therizinosaurus',
    'deinonychus', 'megatherium', 'yutyrannus', 'daeodon', 'woolly rhino',
    'shadowmane', 'reaper', 'rock drake', 'megalosaurus', 'spino',
    'baryonyx', 'velonasaur', 'managarmr'
  ];

  // ── Badge System ───────────────────────────────────────────────────────────

  const BadgeSystem = {

    calculateTotal: calcTotal,

    // ── Prized Bloodline ───────────────────────────────────────────────────
    // Wild base stats only (Health, Stamina, Food, Weight, Melee).
    // All 5 must meet the threshold — one weak stat disqualifies.
    calculatePrizedBloodline(creature) {
      try {
        if (!creature || !creature.baseStats) return { qualified: false, tier: null, minStat: 0 };
        const core = ['Health', 'Stamina', 'Food', 'Weight', 'Melee'];
        const values = core.map(s => Number(creature.baseStats[s] || 0));
        const nonZero = values.filter(v => v > 0);
        if (nonZero.length < core.length) return { qualified: false, tier: null, minStat: 0, id: 'prized_bloodline', name: 'Prized Bloodline' };
        const minStat = Math.min(...values);

        let tier = null;
        if (values.every(v => v >= 60)) tier = 'diamond';
        else if (values.every(v => v >= 55)) tier = 'gold';
        else if (values.every(v => v >= 50)) tier = 'silver';
        else if (values.every(v => v >= 45)) tier = 'bronze';

        return {
          qualified: tier !== null,
          tier,
          minStat,
          id: 'prized_bloodline',
          name: 'Prized Bloodline',
          meta: tier === 'diamond' ? { announce: true } : {}
        };
      } catch (e) { return { qualified: false, tier: null, minStat: 0 }; }
    },

    // ── Boss Ready ──────────────────────────────────────────────────────────
    // Meta creatures only. Formula: base + (muts × 2) + domestic.
    // Returns an array — a creature can have both a tier badge AND role badges.
    calculateBossReady(creature) {
      try {
        if (!creature) return [];
        const species = (creature.species || '').toLowerCase();
        if (!META_LIST.some(n => species.includes(n))) return [];

        const base = creature.baseStats    || {};
        const muts = creature.mutations    || {};
        const dom  = creature.domesticLevels || {};

        const hp     = calcTotal(base.Health  || 0, muts.Health  || 0, dom.Health  || 0);
        const melee  = calcTotal(base.Melee   || 0, muts.Melee   || 0, dom.Melee   || 0);
        const stam   = calcTotal(base.Stamina || 0, muts.Stamina || 0, dom.Stamina || 0);
        const weight = calcTotal(base.Weight  || 0, muts.Weight  || 0, dom.Weight  || 0);

        const badges = [];

        // Core difficulty tier (only highest applies)
        if      (hp >= 150 && melee >= 150) badges.push({ id: 'boss_titan_slayer', name: 'Titan Slayer',  tier: 'titan' });
        else if (hp >= 125 && melee >= 125) badges.push({ id: 'boss_alpha_ready',  name: 'Alpha Ready',   tier: 'alpha' });
        else if (hp >= 100 && melee >= 100) badges.push({ id: 'boss_beta_ready',   name: 'Beta Ready',    tier: 'beta'  });
        else if (hp >= 75  && melee >= 75 ) badges.push({ id: 'boss_gamma_ready',  name: 'Gamma Ready',   tier: 'gamma' });

        // Specialized roles (independent of tier — can stack)
        if (hp    >= 175) badges.push({ id: 'boss_tank',      name: 'Boss Tank',      tier: 'gold' });
        if (melee >= 175) badges.push({ id: 'boss_dps',       name: 'Boss DPS',       tier: 'gold' });
        if (hp >= 125 && stam   >= 125) badges.push({ id: 'boss_juggernaut', name: 'Boss Juggernaut', tier: 'gold' });
        if (hp >= 125 && weight >= 125) badges.push({ id: 'boss_bruiser',    name: 'Boss Bruiser',    tier: 'gold' });

        return badges.map(b => ({ id: b.id, name: b.name, qualified: true, tier: b.tier, meta: { hp, melee } }));
      } catch (e) { return []; }
    },

    // ── Underdog ────────────────────────────────────────────────────────────
    // Non-meta creatures only. Same stat formula as Boss Ready.
    calculateUnderdog(creature) {
      try {
        if (!creature) return [];
        const species = (creature.species || '').toLowerCase();
        if (META_LIST.some(n => species.includes(n))) return [];

        const base = creature.baseStats    || {};
        const muts = creature.mutations    || {};
        const dom  = creature.domesticLevels || {};

        const hp    = calcTotal(base.Health || 0, muts.Health || 0, dom.Health || 0);
        const melee = calcTotal(base.Melee  || 0, muts.Melee  || 0, dom.Melee  || 0);

        const badges = [];
        if      (hp >= 160 && melee >= 160) badges.push({ id: 'underdog_titan',    name: 'Underdog Titan',    tier: 'titan' });
        else if (hp >= 140 && melee >= 140) badges.push({ id: 'underdog_legend',   name: 'Underdog Legend',   tier: 'alpha' });
        else if (hp >= 115 && melee >= 115) badges.push({ id: 'underdog_hero',     name: 'Underdog Hero',     tier: 'beta'  });
        else if (hp >= 90  && melee >= 90 ) badges.push({ id: 'underdog_champion', name: 'Underdog Champion', tier: 'gamma' });

        return badges.map(b => ({ id: b.id, name: b.name, qualified: true, tier: b.tier, meta: { hp, melee } }));
      } catch (e) { return []; }
    },

    // ── Utility & Harvester ─────────────────────────────────────────────────
    // Species-gated. Each category has its own eligible list and formula.
    calculateUtilityHarvester(creature) {
      try {
        if (!creature || !creature.species) return [];
        const s    = creature.species;
        const base = creature.baseStats    || {};
        const muts = creature.mutations    || {};
        const dom  = creature.domesticLevels || {};

        const meleeT  = calcTotal(base.Melee   || 0, muts.Melee   || 0, dom.Melee   || 0);
        const weightT = calcTotal(base.Weight  || 0, muts.Weight  || 0, dom.Weight  || 0);
        const stamT   = calcTotal(base.Stamina || 0, muts.Stamina || 0, dom.Stamina || 0);

        // Specialized Gatherer uses sum of all domestic levels (how invested the owner is across all stats)
        const totalDom = Object.values(dom).reduce((sum, v) => sum + (Number(v) || 0), 0);

        const badges = [];

        // Helper: tier from value + thresholds [bronze, silver, gold, diamond]
        function tier4(val, t) {
          if (val >= t[3]) return 'diamond';
          if (val >= t[2]) return 'gold';
          if (val >= t[1]) return 'silver';
          if (val >= t[0]) return 'bronze';
          return null;
        }
        function tier3(val, t) { // 3 tiers: bronze/silver/gold
          if (val >= t[2]) return 'gold';
          if (val >= t[1]) return 'silver';
          if (val >= t[0]) return 'bronze';
          return null;
        }

        // A — Yield Harvesters (Melee total | 80/105/130/155)
        if (speciesIn(s, ['ankylosaurus','doedicurus','castoroides','mammoth','magmasaur','therizinosaurus'])) {
          const t = tier4(meleeT, [80, 105, 130, 155]);
          if (t) badges.push({ id: 'util_yield', name: 'Yield Harvester', tier: t });
        }

        // B — Specialized Gatherers (total domestic levels | 50/70/90/110)
        if (speciesIn(s, ['therizinosaurus','gigantopithecus','kairuku','mantis','moschops','achatina'])) {
          const t = tier4(totalDom, [50, 70, 90, 110]);
          if (t) badges.push({ id: 'util_gatherer', name: 'Specialized Gatherer', tier: t });
        }

        // C — Cargo Transport (Weight total | 80/105/130/155)
        if (speciesIn(s, ['argentavis','quetzal','gasbags','paraceratherium','mosasaurus','dunkleosteus'])) {
          const t = tier4(weightT, [80, 105, 130, 155]);
          if (t) badges.push({ id: 'util_cargo', name: 'Cargo Transport', tier: t });
        }

        // D — Mobile Refinery (min of Weight + Stamina | 75/100/125/150)
        if (speciesIn(s, ['argentavis','castoroides','thorny dragon','phoenix','magmasaur','equus'])) {
          const t = tier4(Math.min(weightT, stamT), [75, 100, 125, 150]);
          if (t) badges.push({ id: 'util_refinery', name: 'Mobile Refinery', tier: t });
        }

        // E — Gemstone Specialists (Melee total | 80/105/130/155)
        if (speciesIn(s, ['ankylosaurus','roll rat','phoenix','karkinos'])) {
          const t = tier4(meleeT, [80, 105, 130, 155]);
          if (t) badges.push({ id: 'util_gemstone', name: 'Gemstone Specialist', tier: t });
        }

        return badges.map(b => ({ id: b.id, name: b.name, qualified: true, tier: b.tier, meta: {} }));
      } catch (e) { return []; }
    },

    // ── Collector Badges ────────────────────────────────────────────────────
    // Takes the FULL creature array (not a single creature).
    // Counts by species badgeCategories: combat | harvesting | transport.
    // Only the highest tier per track is awarded.
    calculateCollectorBadges(allCreatures) {
      try {
        if (!Array.isArray(allCreatures) || !allCreatures.length) return [];
        const db = (typeof window !== 'undefined' && window.SPECIES_DATABASE) || {};

        let combat = 0, harvesting = 0, transport = 0;
        allCreatures.forEach(c => {
          const sp   = db[c.species] || {};
          const cats = sp.badgeCategories || [];
          if (cats.includes('combat'))     combat++;
          if (cats.includes('harvesting')) harvesting++;
          if (cats.includes('transport'))  transport++;
        });

        const badges = [];

        // Boss Slayer track (5 / 15 / 30 / 50)
        if      (combat >= 50) badges.push({ id: 'collector_boss_slayer_4', name: 'Apex Legend',     tier: 'diamond', count: combat });
        else if (combat >= 30) badges.push({ id: 'collector_boss_slayer_3', name: 'Alpha Predator',  tier: 'gold',    count: combat });
        else if (combat >= 15) badges.push({ id: 'collector_boss_slayer_2', name: 'Veteran Slayer',  tier: 'silver',  count: combat });
        else if (combat >= 5)  badges.push({ id: 'collector_boss_slayer_1', name: 'Novice Hunter',   tier: 'bronze',  count: combat });

        // Master Harvester track (3 / 10 / 20 / 35)
        if      (harvesting >= 35) badges.push({ id: 'collector_harvester_4', name: 'Mining Mogul',    tier: 'diamond', count: harvesting });
        else if (harvesting >= 20) badges.push({ id: 'collector_harvester_3', name: 'Resource Lord',   tier: 'gold',    count: harvesting });
        else if (harvesting >= 10) badges.push({ id: 'collector_harvester_2', name: 'Industrialist',   tier: 'silver',  count: harvesting });
        else if (harvesting >= 3)  badges.push({ id: 'collector_harvester_1', name: 'Gatherer',        tier: 'bronze',  count: harvesting });

        // Transport Specialist track (3 / 8 / 15 / 25)
        if      (transport >= 25) badges.push({ id: 'collector_transport_4', name: 'Transport Tycoon',  tier: 'diamond', count: transport });
        else if (transport >= 15) badges.push({ id: 'collector_transport_3', name: 'Fleet Commander',   tier: 'gold',    count: transport });
        else if (transport >= 8)  badges.push({ id: 'collector_transport_2', name: 'Logistics Expert',  tier: 'silver',  count: transport });
        else if (transport >= 3)  badges.push({ id: 'collector_transport_1', name: 'Pack Mule',         tier: 'bronze',  count: transport });

        return badges.map(b => ({ id: b.id, name: b.name, qualified: true, tier: b.tier, meta: { count: b.count } }));
      } catch (e) { return []; }
    },

    // ── Aggregate (per-creature) ─────────────────────────────────────────────
    // Called on a single creature. Returns all earned badges.
    calculateAchievements(creature) {
      try {
        const ach = [];

        const prized = BadgeSystem.calculatePrizedBloodline(creature);
        if (prized && prized.qualified) ach.push(prized);

        BadgeSystem.calculateBossReady(creature).forEach(b => { if (b.qualified) ach.push(b); });
        BadgeSystem.calculateUnderdog(creature).forEach(b => { if (b.qualified) ach.push(b); });
        BadgeSystem.calculateUtilityHarvester(creature).forEach(b => { if (b.qualified) ach.push(b); });

        return ach.map(a => ({ id: a.id, name: a.name, tier: a.tier, qualified: true, meta: a.meta || a }));
      } catch (e) { return []; }
    },

    // ── Rendering ───────────────────────────────────────────────────────────
    // Small inline badge HTML for creature cards (up to 3 badges).
    generateBadgeHTML(creature) {
      try {
        const ach = BadgeSystem.calculateAchievements(creature);
        if (!ach.length) return '';
        return ach.slice(0, 3).map(a => {
          const cls   = TIER_CSS[a.tier] || 'badge-bronze';
          const emoji = emojiFor(a.id, a.tier);
          const label = `${a.name}${a.tier ? ' (' + a.tier + ')' : ''}`;
          return `<span class="badge ${cls}" role="img" aria-label="${label}" title="${label}">${emoji}</span>`;
        }).join(' ');
      } catch (e) { return ''; }
    },

    // Detailed badge HTML for modals / profile (shows emoji + full name).
    generateBadgeDetailHTML(creature) {
      try {
        const ach = BadgeSystem.calculateAchievements(creature);
        if (!ach.length) return '';
        return ach.map(a => {
          const emoji = emojiFor(a.id, a.tier);
          const label = `${a.name}${a.tier ? ' (' + a.tier + ')' : ''}`;
          return `<div class="badge-detail-item"><span class="badge-emoji" aria-hidden="true">${emoji}</span> <span class="badge-text">${label}</span></div>`;
        }).join('');
      } catch (e) { return ''; }
    },

    // Collector badge HTML — pass the full creature array.
    generateCollectorBadgeHTML(allCreatures) {
      try {
        const ach = BadgeSystem.calculateCollectorBadges(allCreatures);
        if (!ach.length) return '';
        return ach.map(a => {
          const emoji = emojiFor(a.id, a.tier);
          const label = `${a.name} (${a.meta?.count || 0})`;
          const cls   = TIER_CSS[a.tier] || 'badge-bronze';
          return `<div class="badge-detail-item"><span class="badge ${cls} badge-emoji">${emoji}</span> <span class="badge-text">${label}</span></div>`;
        }).join('');
      } catch (e) { return ''; }
    }
  };

  if (typeof window !== 'undefined') window.BadgeSystem = BadgeSystem;
})();
