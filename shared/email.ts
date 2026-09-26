/**
 * One email rule for the whole app, shared by the browser forms and the API
 * so both agree on what a usable address looks like.
 *
 * Stricter than "contains an @" and stricter than a bare `\S+@\S+`: the domain
 * needs a real dot and a letters-only ending, which is where most typos live
 * ("ada@gmail" instead of "ada@gmail.com"). It stays permissive about the
 * local part, so plus-addressing and unusual-but-valid hosts still work.
 */
export const EMAIL_PATTERN =
  /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/;

/** Shown next to any rejected email field. One phrasing everywhere. */
export const EMAIL_HINT = "Enter a valid email address, like ada@example.com";

export function isValidEmail(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const address = value.trim();
  if (address.length < 6 || address.length > 254) return false;
  if (address.includes("..")) return false;
  return EMAIL_PATTERN.test(address);
}

/** Trim only. Never lowercase: older accounts stored mixed-case addresses. */
export function normalizeEmail(value: string): string {
  return value.trim();
}
