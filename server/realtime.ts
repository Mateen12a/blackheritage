/**
 * Server-sent events hub.
 *
 * The app runs as a single pm2 process, so an in-process registry is enough:
 * one entry per signed-in user, holding every open stream that user has
 * (one per browser tab). Messages are pushed as soon as they are written, so
 * the client never has to guess with a poll — the existing polling stays in
 * place purely as a fallback for when the stream drops.
 *
 * Frames carry only ids and a type. The client reacts by re-reading through
 * the normal authenticated endpoints, which keeps authorization in one place
 * and avoids duplicating message bodies into a second channel.
 */
import type { Response } from "express";

interface StreamClient {
  id: number;
  res: Response;
}

const clientsByUser = new Map<string, Set<StreamClient>>();
let nextClientId = 1;

/** Keeps proxies from closing an idle connection (nginx defaults to 60s). */
const HEARTBEAT_MS = 25_000;

const heartbeat = setInterval(() => {
  clientsByUser.forEach((set) => {
    set.forEach((client) => {
      try {
        client.res.write(": ping\n\n");
      } catch {
        // The close handler removes dead clients; nothing to do here.
      }
    });
  });
}, HEARTBEAT_MS);
// Never hold the process open just for a heartbeat.
if (typeof (heartbeat as any).unref === "function") (heartbeat as any).unref();

/**
 * Registers an open SSE response for a user. Returns an unsubscribe function
 * that is safe to call more than once (close handlers can fire twice).
 */
export function subscribeToStream(userId: string, res: Response): () => void {
  const client: StreamClient = { id: nextClientId++, res };
  let set = clientsByUser.get(userId);
  if (!set) {
    set = new Set();
    clientsByUser.set(userId, set);
  }
  set.add(client);

  let released = false;
  return () => {
    if (released) return;
    released = true;
    const current = clientsByUser.get(userId);
    if (!current) return;
    current.delete(client);
    if (current.size === 0) clientsByUser.delete(userId);
  };
}

/**
 * Pushes a frame to every open stream for one user.
 * `type` is the only thing the client switches on.
 */
export function publishToUser(
  userId: string | undefined | null,
  type: string,
  payload: Record<string, unknown> = {},
): void {
  if (!userId) return;
  const set = clientsByUser.get(userId);
  if (!set || set.size === 0) return;
  let frame: string;
  try {
    frame = `data: ${JSON.stringify({ type, ...payload, at: Date.now() })}\n\n`;
  } catch {
    return;
  }
  set.forEach((client) => {
    try {
      client.res.write(frame);
    } catch {
      // Broken pipe: the close handler will clean it up.
    }
  });
}
