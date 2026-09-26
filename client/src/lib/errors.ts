/**
 * Turning failed requests into something readable.
 *
 * Before this, queryClient threw `${res.status}: ${rawBody}`, so a failed
 * login toast read `401: Unauthorized` and a 500 from a proxy read
 * `502: <!DOCTYPE html>...`. Everything that shows an error should go through
 * here instead.
 */

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export const OFFLINE_MESSAGE =
  "We could not reach the server. Check your internet connection and try again.";
export const SESSION_EXPIRED_MESSAGE =
  "Your session has expired. Sign in again to keep going.";
export const SERVER_BUSY_MESSAGE =
  "The server is restarting or busy. Give it a few seconds, then try again.";
export const GENERIC_MESSAGE =
  "Something went wrong on our side. Try again in a moment.";

/** What to say for a status when the server sent nothing useful. */
export function messageForStatus(status: number): string {
  if (status === 0) return OFFLINE_MESSAGE;
  if (status === 400) return "Something in that form needs fixing. Check the fields and try again.";
  if (status === 401) return SESSION_EXPIRED_MESSAGE;
  if (status === 403) return "Your account cannot do that. Sign in with the right account, or ask the organizer to grant access.";
  if (status === 404) return "We could not find that. It may have been removed, or the link is wrong.";
  if (status === 409) return "That already exists. Try a different name or value.";
  if (status === 413) return "That file is too large. Try a smaller one.";
  if (status === 422) return "Some of those details were rejected. Check them and try again.";
  if (status === 429) return "Too many attempts. Wait a minute, then try again.";
  if (status === 503) return SERVER_BUSY_MESSAGE;
  if (status >= 500) return SERVER_BUSY_MESSAGE;
  return GENERIC_MESSAGE;
}

// Bare status words the API uses as messages. They are not sentences, so they
// get replaced with the status-based copy above.
const BARE_CODES = new Set([
  "error",
  "failed",
  "forbidden",
  "internal server error",
  "invalid request",
  "admin access required",
  "admin only",
  "not authenticated",
  "not found",
  "not logged in",
  "nothing to update",
  "organizer access required",
  "sync failed",
  "unauthorized",
  "unknown theme",
  "bad request",
  "sign in first",
  "unprocessable entity",
  "method not allowed",
]);

/**
 * Accept a message from the server only when it reads like a sentence someone
 * wrote for a user: no markup, no stack traces, no JSON, not a bare code.
 */
export function cleanServerMessage(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  if (!text || text.length > 200) return null;
  if (/[<>{}\\]/.test(text)) return null;
  if (/\n|\bat \w+.*\(.*:\d+:\d+\)/.test(text)) return null;
  if (BARE_CODES.has(text.toLowerCase().replace(/[.!]+$/, ""))) return null;
  return text;
}

/** Pull `{ message }` or `{ error }` out of a response body, whatever it is. */
async function readBodyMessage(res: Response): Promise<string | null> {
  const raw = await res.text().catch(() => "");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return cleanServerMessage(parsed?.message) || cleanServerMessage(parsed?.error);
  } catch {
    return cleanServerMessage(raw);
  }
}

/** Build the error for a failed response. Never throws, never leaks the body. */
export async function errorFromResponse(res: Response): Promise<ApiError> {
  const serverMessage = await readBodyMessage(res);
  return new ApiError(res.status, serverMessage || messageForStatus(res.status));
}

/** Readable text for anything caught in a try/catch. */
export function errorMessage(err: unknown, fallback = GENERIC_MESSAGE): string {
  if (err instanceof ApiError) return err.message;
  // fetch() rejects with a TypeError when the network or DNS fails.
  if (err instanceof TypeError) return OFFLINE_MESSAGE;
  if (err instanceof Error) return cleanServerMessage(err.message) || fallback;
  return fallback;
}
