/**
 * One shared server-sent-events connection per browser tab.
 *
 * Messages used to arrive on a 4s thread poll / 8s badge poll, which made
 * replies look late even though nothing was broken. The stream makes them
 * land as they are written; the polls stay in the hooks below as a fallback,
 * and stretch to a slow heartbeat while the stream is up so we are not
 * fetching the same thing twice.
 *
 * Frames are thin signals ("something changed"), never message bodies. Every
 * read still goes through the normal authenticated endpoints.
 */
import { useEffect, useState } from "react";
import { queryClient } from "@/lib/queryClient";

export type StreamStatus = "connecting" | "live" | "offline";

const MAX_FAILURES = 3;

let source: EventSource | null = null;
let consumers = 0;
let failures = 0;
let status: StreamStatus = "connecting";

const statusListeners = new Set<(next: StreamStatus) => void>();

function setStatus(next: StreamStatus) {
  if (status === next) return;
  status = next;
  statusListeners.forEach((listener) => listener(next));
}

/** True when pushes are flowing, so the polling fallback can slow down. */
export function isMessagesStreamLive(): boolean {
  return status === "live";
}

function refreshMessages() {
  queryClient.invalidateQueries({
    predicate: (query) => String(query.queryKey[0] ?? "").startsWith("/api/messages"),
  });
}

function connect() {
  if (source) return;
  if (typeof window === "undefined" || typeof EventSource === "undefined") {
    setStatus("offline");
    return;
  }
  const es = new EventSource("/api/messages/stream", { withCredentials: true });
  source = es;
  setStatus("connecting");

  es.onopen = () => {
    failures = 0;
    setStatus("live");
    // Catch anything that happened while we were disconnected.
    refreshMessages();
  };

  es.onmessage = () => {
    refreshMessages();
  };

  es.onerror = () => {
    setStatus("offline");
    failures += 1;
    // EventSource retries on its own, but a hard failure (signed out, proxy
    // blocking the stream) would otherwise hammer the endpoint forever.
    if (failures >= MAX_FAILURES) {
      es.close();
      source = null;
    }
  };
}

function disconnect() {
  if (source) {
    source.close();
    source = null;
  }
  failures = 0;
  setStatus("connecting");
}

/**
 * Keeps the stream open while any component needs it. Mount it once in the
 * dashboard shell; the refcount means extra callers are nearly free.
 */
export function useMessagesStream(enabled = true): StreamStatus {
  const [current, setCurrent] = useState<StreamStatus>(status);

  useEffect(() => {
    statusListeners.add(setCurrent);
    setCurrent(status);

    if (!enabled) {
      return () => {
        statusListeners.delete(setCurrent);
      };
    }

    consumers += 1;
    connect();

    return () => {
      statusListeners.delete(setCurrent);
      consumers -= 1;
      if (consumers <= 0) {
        consumers = 0;
        disconnect();
      }
    };
  }, [enabled]);

  return current;
}
