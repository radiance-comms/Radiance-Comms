// utils/estimator.js
// Pricing & estimator based on Radiance Comms pricing provided by the user.
const PRICING = {
  currency: 'USD',
  bundles: {
    starter: { name: 'Starter Bundle', price: 45, note: 'Tier 1 Server Setup + Sprout Bot Pack (Save $10)' },
    growth: { name: 'Growth Bundle', price: 75, note: 'Tier 2 Server Setup + Blossom Bot Pack (Save $15)' },
    ultimate: { name: 'Ultimate Kingdom Bundle', priceRange: [120, 150], note: 'VIP Build + Full Custom Bot (8–10 commands) + priority & 2w support' }
  },
  aesthetics: {
    custom_rules_embeds: 5,
    ticket_system_setup: 8,
    basic_role_cleanup: 10,
    full_server_revamp: 20
  },
  addons: {
    extra_revision: 3,
    public_bot_config: 5,
    channel_headers_banners: 5,
    rush_delivery: 15,
    post_launch_maintenance_week: 10
  },
  command: {
    basic: 5,
    medium: 10,
    advancedRange: [15, 20]
  },
  botPacks: {
    sprout: { name: 'Sprout Bot Pack', price: 20, includes: '3 Basic + 1 Medium' },
    blossom: { name: 'Blossom Bot Pack', price: 45, includes: '3 Medium + 1 Advanced' },
    garden: { name: 'Garden Bot Pack', price: 75, includes: '5 Medium + 2 Advanced' }
  },
  tiers: {
    tier1: { name: 'Little Meadow', price: 15, details: 'Up to 15 channels, basic roles, auto-roles & welcome' },
    tier2: { name: 'Floral Garden', price: 35, details: 'Complete channel structure, embeds, ticket system' },
    tier3: { name: 'Rainbow Paradise', price: 60, details: 'Premium server setup + 3–5 custom commands' },
    tier4: { name: 'Radiant Kingdom', priceRange: [100, 150], details: 'VIP Build + custom bot (8–10 commands) + 2w support' }
  },
  defaults: {
    depositPercent: 30,
    rounding: 'nearest'
  },
  convertDefaults: {
    nitroBasicUSD: 4.99,
    nitroRegularUSD: 9.99,
    robuxPerUSD: 80
  }
};

function roundValue(v, mode = 'nearest') {
  if (mode === 'up') return Math.ceil(v);
  if (mode === 'down') return Math.floor(v);
  return Math.round(v);
}

function estimateOrder(order = {}, options = {}) {
  const cfg = PRICING;
  const taxRate = typeof options.taxRate === 'number' ? options.taxRate : 0.0;
  const convert = Object.assign({}, cfg.convertDefaults, options.convertRates || {});
  const rounding = options.rounding || cfg.defaults.rounding;

  const breakdown = [];
  let minTotal = 0;
  let maxTotal = 0;
  let subtotalMin = 0;
  let subtotalMax = 0;

  function addItem(label, amountMin, amountMax = null) {
    if (amountMax === null) amountMax = amountMin;
    breakdown.push({ label, min: amountMin, max: amountMax });
    subtotalMin += amountMin;
    subtotalMax += amountMax;
  }

  if (order.type === 'bundle' && order.bundle) {
    const b = cfg.bundles[order.bundle];
    if (!b) throw new Error('Unknown bundle');
    if (b.priceRange) addItem(`${b.name}`, b.priceRange[0], b.priceRange[1]);
    else addItem(`${b.name}`, b.price);
  }

  if (order.tier) {
    const t = cfg.tiers[order.tier];
    if (!t) throw new Error('Unknown tier');
    if (t.priceRange) addItem(`${t.name}`, t.priceRange[0], t.priceRange[1]);
    else addItem(`${t.name}`, t.price);
  }

  if (Array.isArray(order.aestheticItems)) {
    for (const key of order.aestheticItems) {
      const p = cfg.aesthetics[key];
      if (typeof p === 'number') addItem(key.replace(/_/g, ' '), p);
    }
  }

  if (order.addons) {
    const a = order.addons;
    if (a.extraRevisions && a.extraRevisions > 0) addItem(`Extra revisions x${a.extraRevisions}`, cfg.addons.extra_revision * a.extraRevisions);
    if (a.publicBots && a.publicBots > 0) addItem(`Public bot config x${a.publicBots}`, cfg.addons.public_bot_config * a.publicBots);
    if (a.headers && a.headers > 0) addItem(`Channel headers & banners x${a.headers}`, cfg.addons.channel_headers_banners * a.headers);
    if (a.rush) addItem('Rush delivery', cfg.addons.rush_delivery);
    if (a.maintenanceWeeks && a.maintenanceWeeks > 0) addItem(`Post-launch maintenance (${a.maintenanceWeeks} week(s))`, cfg.addons.post_launch_maintenance_week * a.maintenanceWeeks);
  }

  if (order.commands) {
    const c = order.commands;
    if (c.basic && c.basic > 0) addItem(`Basic commands x${c.basic}`, cfg.command.basic * c.basic);
    if (c.medium && c.medium > 0) addItem(`Medium commands x${c.medium}`, cfg.command.medium * c.medium);

    if (c.advanced && c.advanced > 0) {
      if (typeof c.advancedUnitPrice === 'number') {
        addItem(`Advanced commands x${c.advanced}`, c.advancedUnitPrice * c.advanced);
      } else {
        const [minAdv, maxAdv] = cfg.command.advancedRange;
        addItem(`Advanced commands x${c.advanced}`, minAdv * c.advanced, maxAdv * c.advanced);
      }
    }
  }

  if (order.botPack) {
    const p = cfg.botPacks[order.botPack];
    if (!p) throw new Error('Unknown bot pack');
    addItem(p.name, p.price);
  }

  if (Array.isArray(order.customFeatures)) {
    for (const f of order.customFeatures) {
      const price = Number(f.price) || 0;
      addItem(f.name, price);
    }
  }

  minTotal = subtotalMin;
  maxTotal = subtotalMax;

  if (rounding) {
    minTotal = roundValue(minTotal, rounding);
    maxTotal = roundValue(maxTotal, rounding);
  }

  const taxMin = roundValue(minTotal * taxRate, rounding);
  const taxMax = roundValue(maxTotal * taxRate, rounding);
  const totalWithTaxMin = minTotal + taxMin;
  const totalWithTaxMax = maxTotal + taxMax;

  function convertAll(amountUSD) {
    return {
      usd: amountUSD,
      nitroBasic: amountUSD / convert.nitroBasicUSD,
      nitroRegular: amountUSD / convert.nitroRegularUSD,
      robux: amountUSD * convert.robuxPerUSD
    };
  }

  const result = {
    breakdown,
    subtotal: { min: subtotalMin, max: subtotalMax },
    subtotalRounded: { min: minTotal, max: maxTotal },
    taxRate,
    tax: { min: taxMin, max: taxMax },
    total: { withoutTax: { min: minTotal, max: maxTotal }, withTax: { min: totalWithTaxMin, max: totalWithTaxMax } },
    conversions: {
      withoutTax: { min: convertAll(minTotal), max: convertAll(maxTotal) },
      withTax: { min: convertAll(totalWithTaxMin), max: convertAll(totalWithTaxMax) }
    },
    meta: { rounding, convertRates: convert }
  };

  return result;
}

module.exports = { PRICING, estimateOrder };
