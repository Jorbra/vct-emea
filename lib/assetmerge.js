// The pictures the pages show: the light copies in public/va/ (lib/valorant-local.json) in place of the originals,
// wherever a copy exists. The share pictures and the bot keep the originals (they need full addresses). Pure.
export function withLocal(assets, local) {
  const agents = {};
  for (const [k, a] of Object.entries(assets.agents || {})) agents[k] = { ...a, ...pick((local.agents || {})[k]) };
  const maps = {};
  for (const [k, m] of Object.entries(assets.maps || {})) maps[k] = { ...m, ...pick((local.maps || {})[k]) };
  return { ...assets, agents, maps };
}

/** Each ability's icon from its light copy. */
export function abilitiesWithLocal(list, local) {
  return (list || []).map((x) => ({ ...x, icon: (local && local[x.slot]) || x.icon }));
}

const pick = (o) => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v));
