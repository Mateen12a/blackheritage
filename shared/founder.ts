// The Founder perk: no platform fee on an organizer's first paid tickets.
// FOUNDER50 (50 tickets) and the earlier FOUNDER100 (100 tickets). The offer is
// closed to new organizers; see FOUNDER_OFFER_OPEN below.
export const FOUNDER_CODE = "FOUNDER50";
export const LEGACY_FOUNDER_CODE = "FOUNDER100";
export const FOUNDER_WAIVED_TICKETS = 50;

/**
 * Closed on 24 Nov 2026: new organizers no longer get a Founder perk.
 * Accounts that already hold FOUNDER50 or FOUNDER100 keep it (an admin can
 * still set or clear it per account in Admin -> Users).
 */
export const FOUNDER_OFFER_OPEN = false;

/** How many paid tickets this stored voucher waives in total. */
export function founderAllowance(voucher: unknown): number {
  if (voucher === FOUNDER_CODE) return FOUNDER_WAIVED_TICKETS;
  if (voucher === LEGACY_FOUNDER_CODE) return 100;
  return 0;
}

/** True for a code typed or linked at sign-up, old or new. */
export function isFounderCode(code: unknown): boolean {
  if (typeof code !== "string") return false;
  const c = code.trim().toUpperCase();
  return c === FOUNDER_CODE || c === LEGACY_FOUNDER_CODE;
}
