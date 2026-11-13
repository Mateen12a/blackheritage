/**
 * A ticket tier's sale window. `saleOpen` / `saleClose` are optional ISO
 * dates set in the tier editor (Early Bird ends on a date, Regular starts on
 * one). Older data stored `saleOpen: false` to switch a tier off, so a boolean
 * false still means "not on sale".
 */
export type TierSaleState = "on" | "upcoming" | "closed" | "off";

export interface TierWindow {
  saleOpen?: string | boolean | null;
  saleClose?: string | null;
}

export function tierSaleState(tier: TierWindow | null | undefined, now: number = Date.now()): TierSaleState {
  if (!tier || tier.saleOpen === false) return "off";
  if (tier.saleClose) {
    const close = Date.parse(tier.saleClose);
    if (Number.isFinite(close) && close < now) return "closed";
  }
  if (typeof tier.saleOpen === "string" && tier.saleOpen) {
    const open = Date.parse(tier.saleOpen);
    if (Number.isFinite(open) && open > now) return "upcoming";
  }
  return "on";
}

export function isTierOnSale(tier: TierWindow | null | undefined, now: number = Date.now()): boolean {
  return tierSaleState(tier, now) === "on";
}
