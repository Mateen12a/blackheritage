/**
 * Nigerian states, for filtering events by where they actually are.
 *
 * Events store one free-text `location` ("Wave Beach, Elegushi, Lekki Phase 1,
 * Lagos"), so there is no field to group on. This module maps that text back to
 * a state by matching known place names, which means state filtering works on
 * the data that already exists and keeps working for locations nobody typed
 * yet: add a town to `aliases` and it lands in the right state.
 *
 * The longest alias that matches wins, so "Victoria Island, Lagos" resolves to
 * Lagos through the longer, more specific token rather than the state name.
 */

export type Region = {
  key: string;
  name: string;
  aliases: string[];
};

export const NIGERIAN_STATES: Region[] = [
  { key: "abia", name: "Abia", aliases: ["abia", "umuahia", "aba"] },
  { key: "adamawa", name: "Adamawa", aliases: ["adamawa", "yola", "mubi"] },
  { key: "akwa-ibom", name: "Akwa Ibom", aliases: ["akwa ibom", "uyo", "eket", "ikot ekpene"] },
  { key: "anambra", name: "Anambra", aliases: ["anambra", "awka", "onitsha", "nnewi"] },
  { key: "bauchi", name: "Bauchi", aliases: ["bauchi", "azare"] },
  { key: "bayelsa", name: "Bayelsa", aliases: ["bayelsa", "yenagoa"] },
  { key: "benue", name: "Benue", aliases: ["benue", "makurdi", "gboko"] },
  { key: "borno", name: "Borno", aliases: ["borno", "maiduguri"] },
  { key: "cross-river", name: "Cross River", aliases: ["cross river", "calabar", "obudu"] },
  { key: "delta", name: "Delta", aliases: ["delta state", "asaba", "warri", "sapele"] },
  { key: "ebonyi", name: "Ebonyi", aliases: ["ebonyi", "abakaliki"] },
  { key: "edo", name: "Edo", aliases: ["edo state", "benin city", "benin", "auchi"] },
  { key: "ekiti", name: "Ekiti", aliases: ["ekiti", "ado ekiti", "ado-ekiti"] },
  { key: "enugu", name: "Enugu", aliases: ["enugu", "nsukka"] },
  { key: "gombe", name: "Gombe", aliases: ["gombe"] },
  { key: "imo", name: "Imo", aliases: ["imo state", "owerri", "okigwe"] },
  { key: "jigawa", name: "Jigawa", aliases: ["jigawa", "dutse"] },
  { key: "kaduna", name: "Kaduna", aliases: ["kaduna", "zaria", "kafanchan"] },
  { key: "kano", name: "Kano", aliases: ["kano"] },
  { key: "katsina", name: "Katsina", aliases: ["katsina", "daura"] },
  { key: "kebbi", name: "Kebbi", aliases: ["kebbi", "birnin kebbi"] },
  { key: "kogi", name: "Kogi", aliases: ["kogi", "lokoja", "okene"] },
  { key: "kwara", name: "Kwara", aliases: ["kwara", "ilorin", "offa"] },
  { key: "nasarawa", name: "Nasarawa", aliases: ["nasarawa", "lafia", "keffi"] },
  { key: "niger", name: "Niger", aliases: ["niger state", "minna", "suleja", "bida"] },
  { key: "ogun", name: "Ogun", aliases: ["ogun state", "abeokuta", "sagamu", "ota", "ijebu ode"] },
  { key: "ondo", name: "Ondo", aliases: ["ondo", "akure", "ore"] },
  { key: "osun", name: "Osun", aliases: ["osun", "osogbo", "ile ife", "ilesa"] },
  { key: "oyo", name: "Oyo", aliases: ["oyo state", "ibadan", "ogbomosho", "iseyin"] },
  { key: "plateau", name: "Plateau", aliases: ["plateau", "jos", "bukuru"] },
  { key: "sokoto", name: "Sokoto", aliases: ["sokoto"] },
  { key: "taraba", name: "Taraba", aliases: ["taraba", "jalingo"] },
  { key: "yobe", name: "Yobe", aliases: ["yobe", "damaturu"] },
  { key: "zamfara", name: "Zamfara", aliases: ["zamfara", "gusau"] },
  { key: "rivers", name: "Rivers", aliases: ["rivers state", "port harcourt", "bonny", "eleme"] },
  { key: "fct", name: "Abuja (FCT)", aliases: ["abuja", "fct", "wuse", "maitama", "garki", "gwarinpa", "asokoro", "jabi", "kubwa", "utako", "life camp", "wuye"] },
  { key: "lagos", name: "Lagos", aliases: ["lagos", "lekki", "ikeja", "victoria island", "ikoyi", "yaba", "surulere", "ajah", "ikorodu", "badagry", "epe", "oniru", "elegushi", "festac", "gbagada", "oshodi", "apapa", "magodo", "ojota", "ikate"] },
];

function hasPlace(haystack: string, needle: string): boolean {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(haystack);
}

/** The state a free-text location sits in, or null when nothing matches. */
export function stateForLocation(location?: string | null): Region | null {
  if (!location) return null;
  let best: Region | null = null;
  let bestLength = 0;
  for (const region of NIGERIAN_STATES) {
    for (const alias of region.aliases) {
      if (alias.length > bestLength && hasPlace(location, alias)) {
        best = region;
        bestLength = alias.length;
      }
    }
  }
  return best;
}

export type StateOption = { key: string; name: string; count: number };

/**
 * States that actually have events in the list, with counts. Only states with
 * inventory become options, so a filter chip never leads to an empty page.
 * Lagos and Abuja lead, then it is count order.
 */
export function stateOptionsForEvents(
  events: { location?: string | null }[] | undefined,
): StateOption[] {
  const counts = new Map<string, number>();
  for (const event of events ?? []) {
    const region = stateForLocation(event.location);
    if (!region) continue;
    counts.set(region.key, (counts.get(region.key) ?? 0) + 1);
  }
  const rank = (key: string) => (key === "lagos" ? 0 : key === "fct" ? 1 : 2);
  return NIGERIAN_STATES.filter((region) => counts.has(region.key))
    .map((region) => ({ key: region.key, name: region.name, count: counts.get(region.key)! }))
    .sort(
      (a, b) =>
        rank(a.key) - rank(b.key) || b.count - a.count || a.name.localeCompare(b.name),
    );
}
