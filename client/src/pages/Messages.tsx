import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  useConversations,
  useSendMessage,
  useOptimisticThread,
  type ConversationSummary,
} from "@/hooks/use-messages";
import { HeaderSkeleton, LoadError } from "@/components/AsyncStates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Loader2, SendHorizontal, ChevronLeft, MessageCircle, Store } from "lucide-react";

/**
 * Messaging: inbox on the left, thread on the right (desktop).
 * Mobile behaves like a chat app: inbox first, thread pushes over it,
 * back returns to the inbox.
 */

function initials(name: string) {
  return name.charAt(0).toUpperCase();
}

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return mins + "m";
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + "h";
  const days = Math.floor(hours / 24);
  if (days < 7) return days + "d";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function clock(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export default function Messages() {
  const { user } = useAuth();
  const [location, navigate] = useLocation();
  // wouter's location includes the query string; split it off.
  const [pathname, search] = location.split("?");
  const vendorParam = new URLSearchParams(search || "").get("vendor") || undefined;
  // /messages/:otherId selects a thread; bare /messages shows the inbox.
  const parts = pathname.split("/").filter(Boolean); // ["messages", maybe id]
  const selectedId = parts.length > 1 ? parts[1] : null;

  const conversations = useConversations();
  const me = user?._id as string | undefined;

  const isMobileSelection = selectedId !== null;
  const showThreadPane = isMobileSelection || typeof window === "undefined" || window.innerWidth >= 768;

  return (
    <div className="flex flex-col md:flex-row gap-6 md:gap-10 min-h-[70vh]">
      {/* Inbox column */}
      <section
        aria-label="Conversations"
        className={cn(
          "md:w-80 lg:w-96 shrink-0",
          isMobileSelection && "hidden md:block"
        )}
      >
        <div className="mb-6">
          <p className="eyebrow">Direct messages</p>
          <h1 className="mt-3 font-display text-3xl md:text-4xl font-bold text-ink tracking-tight">
            Inbox
          </h1>
          <div className="mt-4 h-0.5 w-16 bg-gold" aria-hidden="true" />
        </div>

        {conversations.isLoading ? (
          <div className="space-y-3" aria-label="Loading conversations">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 rounded-md bg-surface-2 animate-pulse" />
            ))}
          </div>
        ) : conversations.isError ? (
          <LoadError
            title="Couldn't load your conversations"
            onRetry={() => conversations.refetch()}
          />
        ) : !conversations.data || conversations.data.length === 0 ? (
          <div className="flex flex-col items-center text-center py-14 border border-dashed border-hairline rounded-md">
            <MessageCircle className="w-8 h-8 text-muted-ink/40 mb-3" aria-hidden="true" />
            <p className="font-medium text-ink text-sm">No conversations yet</p>
            <p className="mt-1 text-xs text-muted-ink max-w-[24ch]">
              Message a vendor from their profile and the chat lands here.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-5 border-hairline text-ink hover:bg-surface-2 hover:text-gold"
              onClick={() => navigate("/vendors")}
            >
              Browse vendors
            </Button>
          </div>
        ) : (
          <ul className="space-y-2">
            {(conversations.data || []).map((c: ConversationSummary) => (
              <li key={c.otherUserId}>
                <button
                  type="button"
                  onClick={() => navigate("/messages/" + c.otherUserId)}
                  aria-current={selectedId === c.otherUserId ? "true" : undefined}
                  className={cn(
                    "w-full text-left px-4 py-3.5 rounded-md border transition-colors flex items-start gap-3",
                    selectedId === c.otherUserId
                      ? "border-gold/60 bg-gold/5"
                      : "border-hairline bg-surface hover:bg-surface-2"
                  )}
                >
                  <span className="w-10 h-10 rounded-full bg-surface-2 border border-hairline flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-gold uppercase">
                      {initials(c.otherUsername)}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="font-medium text-sm text-ink truncate">
                        {c.otherUsername}
                      </span>
                      <span className="text-[11px] text-muted-ink shrink-0">
                        {timeAgo(c.lastMessageAt)}
                      </span>
                    </span>
                    {c.vendorTitle && (
                      <span className="flex items-center gap-1 text-[11px] text-gold mt-0.5">
                        <Store className="w-3 h-3" aria-hidden="true" />
                        {c.vendorTitle}
                      </span>
                    )}
                    <span className="block text-xs text-muted-ink truncate mt-0.5">
                      {c.lastMessage}
                    </span>
                  </span>
                  {c.unreadCount > 0 && (
                    <span className="ml-1 mt-1 h-5 min-w-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center shrink-0">
                      {c.unreadCount}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Thread column */}
      {showThreadPane && (
        <section aria-label="Chat" className="flex-1 min-w-0">
          {selectedId ? (
            <ChatThread
              key={selectedId}
              otherUserId={selectedId}
              me={me}
              vendorId={vendorParam}
            />
          ) : (
            <div className="hidden md:flex flex-col items-center justify-center text-center h-full min-h-[50vh] border border-dashed border-hairline rounded-md">
              <MessageCircle className="w-10 h-10 text-muted-ink/30 mb-4" aria-hidden="true" />
              <p className="font-display text-lg font-bold text-ink">Select a conversation</p>
              <p className="mt-1 text-sm text-muted-ink">
                Pick someone from the inbox, or start fresh from a vendor profile.
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function ChatThread({
  otherUserId,
  me,
  vendorId,
}: {
  otherUserId: string;
  me?: string;
  vendorId?: string;
}) {
  const [, navigate] = useLocation();
  const thread = useOptimisticThread(otherUserId, me);
  const sendMessage = useSendMessage();
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [thread.messages.length]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body || sendMessage.isPending) return;
    setDraft("");
    thread.addPending(body);
    sendMessage.mutate(
      { recipientId: otherUserId, vendorId, body },
      {
        onError: () => {
          setDraft(body); // restore the text so nothing typed is lost
        },
      },
    );
  };

  if (thread.isLoading) {
    return <HeaderSkeleton bare />;
  }

  if (thread.isError) {
    return (
      <LoadError
        title="Couldn't load this conversation"
        onRetry={() => thread.refetch()}
      />
    );
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-14rem)] md:h-[70vh] min-h-[380px]">
      {/* Chat header */}
      <div className="flex items-center gap-3 pb-4 mb-2 border-b border-hairline">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Back to inbox"
          className="md:hidden -ml-2 text-muted-ink hover:text-ink"
          onClick={() => navigate("/messages")}
        >
          <ChevronLeft className="w-5 h-5" aria-hidden="true" />
        </Button>
        <span className="w-9 h-9 rounded-full bg-surface-2 border border-hairline flex items-center justify-center shrink-0">
          <span className="text-sm font-bold text-gold uppercase">
            {initials(thread.other?.username || "?")}
          </span>
        </span>
        <div className="min-w-0">
          <p className="font-display font-bold text-ink truncate">
            {thread.other?.username || "Conversation"}
          </p>
          <p className="text-[11px] text-muted-ink">Replies usually within a day</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-2" aria-live="polite">
        {thread.messages.length === 0 ? (
          <p className="text-sm text-muted-ink text-center py-10">
            No messages yet. Say hello.
          </p>
        ) : (
          thread.messages.map((m) => {
            const mine = m.senderId === me;
            return (
              <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] md:max-w-[70%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed",
                    mine
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-surface border border-hairline text-ink rounded-bl-md"
                  )}
                >
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p
                    className={cn(
                      "text-[10px] mt-1 text-right",
                      mine ? "text-primary-foreground/70" : "text-muted-ink"
                    )}
                  >
                    {clock(m.createdAt)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      {/* Composer */}
      <form onSubmit={submit} className="pt-3 border-t border-hairline flex items-center gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Write a message…"
          aria-label="Write a message"
          className="h-11 bg-surface-2 border-hairline text-ink rounded-full focus-visible:border-gold focus-visible:ring-0"
          maxLength={2000}
        />
        <Button
          type="submit"
          size="icon"
          aria-label="Send message"
          disabled={!draft.trim() || sendMessage.isPending}
          className="h-11 w-11 rounded-full shrink-0 bg-primary text-primary-foreground hover:bg-gold-soft press"
        >
          {sendMessage.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : (
            <SendHorizontal className="w-4 h-4" aria-hidden="true" />
          )}
        </Button>
      </form>
      {sendMessage.isError && (
        <p className="text-xs text-red-400 mt-2" role="alert">
          {(sendMessage.error as Error)?.message || "Message failed to send"}
        </p>
      )}
    </div>
  );
}
