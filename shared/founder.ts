// The Founder perk: no platform fee on an organizer's first paid tickets.
// New organizers get FOUNDER50. Accounts created under the earlier offer keep
// FOUNDER100 and the 100 tickets they were promised.
export const FOUNDER_CODE = "FOUNDER50";
export const LEGACY_FOUNDER_CODE = "FOUNDER100";
export const FOUNDER_WAIVED_TICKETS = 50;

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
