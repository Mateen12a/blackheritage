import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

export interface ConversationSummary {
  otherUserId: string;
  otherUsername: string;
  vendorId: string | null;
  vendorTitle: string | null;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  recipientId: string;
  vendorId?: string | null;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export interface ThreadPayload {
  messages: ChatMessage[];
  other: { id: string; username: string };
}

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.message || "Request failed");
  }
  return res.json();
}

export function useConversations() {
  return useQuery<ConversationSummary[]>({
    queryKey: ["/api/messages/conversations"],
    queryFn: () => getJSON("/api/messages/conversations"),
    refetchInterval: 8000,
  });
}

export function useThread(otherUserId: string | null) {
  return useQuery<ThreadPayload>({
    queryKey: ["/api/messages", otherUserId],
    queryFn: () => getJSON("/api/messages/" + otherUserId),
    enabled: !!otherUserId,
    refetchInterval: 4000,
  });
}

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { recipientId: string; vendorId?: string; body: string }) => {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || "Message could not be sent");
      }
      return res.json();
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["/api/messages", vars.recipientId] });
      qc.invalidateQueries({ queryKey: ["/api/messages/conversations"] });
      qc.invalidateQueries({ queryKey: ["/api/messages/unread/count"] });
    },
  });
}

export function useUnreadCount() {
  const q = useQuery<{ count: number }>({
    queryKey: ["/api/messages/unread/count"],
    queryFn: () => getJSON("/api/messages/unread/count"),
    refetchInterval: 8000,
  });
  return q.data?.count ?? 0;
}

/**
 * Live "typing" feel without websockets: while the thread query polls every
 * 4s, this composes a smooth append by blending polled data with freshly sent
 * messages, so the sent bubble lands instantly instead of on the next poll.
 */
export function useOptimisticThread(otherUserId: string | null, myId?: string) {
  const thread = useThread(otherUserId);
  const qc = useQueryClient();
  const [pending, setPending] = useState<ChatMessage[]>([]);

  // Viewing a thread means its messages are read (the GET marks them server
  // side), so refresh the unread badge immediately instead of waiting for
  // the next poll.
  useEffect(() => {
    if (thread.data && otherUserId) {
      qc.invalidateQueries({ queryKey: ["/api/messages/unread/count"] });
    }
  }, [thread.data?.messages.length, otherUserId, qc, thread.data]);

  // Drop pending messages once the poll confirms them.
  useEffect(() => {
    if (!thread.data) return;
    setPending((p) =>
      p.filter((msg) => !thread.data!.messages.some((m) => m.body === msg.body && m.senderId === myId)),
    );
  }, [thread.data, myId]);

  const addPending = (body: string) => {
    setPending((p) => [
      ...p,
      {
        id: "pending-" + Date.now(),
        senderId: myId || "me",
        recipientId: otherUserId || "",
        body,
        readAt: null,
        createdAt: new Date().toISOString(),
      },
    ]);
  };

  return {
    messages: [...(thread.data?.messages || []), ...pending],
    other: thread.data?.other,
    isLoading: thread.isLoading,
    isError: thread.isError,
    error: thread.error,
    refetch: thread.refetch,
    addPending,
  };
}
