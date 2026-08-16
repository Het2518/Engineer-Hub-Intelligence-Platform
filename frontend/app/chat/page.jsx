"use client";

import { useChat } from "../../hooks/useChat";
import { useChatExport } from "../../hooks/useChatExport";
import { MessageList } from "../../components/chat/MessageList";
import { MessageInput } from "../../components/chat/MessageInput";
import { useSearchParams } from "next/navigation";
import { useEffect, Suspense, useCallback } from "react";
import { Download, FileText, Zap } from "lucide-react";

function ChatPageContent() {
  const searchParams = useSearchParams();
  const urlSessionId = searchParams.get("id");

  const {
    messages,
    isLoading,
    isThinking,
    thinkingMeta,
    isCacheHit,
    sessionId,
    sendMessage,
    stopStreaming,
    clearMessages,
    loadSession,
    hydrated,
  } = useChat();

  // Export hook — derives session title from first user message
  const sessionTitle =
    messages.find((m) => m.role === "user")?.content?.slice(0, 60) || "Chat Session";
  const { exportMarkdown, exportJSON } = useChatExport(messages, sessionTitle);

  useEffect(() => {
    if (!hydrated) return;
    if (urlSessionId) {
      if (sessionId !== urlSessionId) loadSession(urlSessionId);
    } else {
      if (messages.length > 0 || (sessionId && sessionId !== urlSessionId)) {
        clearMessages();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlSessionId, hydrated]);

  // Fill the chat input with a follow-up suggestion
  const handleFollowUp = useCallback((suggestion) => {
    const input = document.querySelector("#chat-input");
    if (input) {
      input.value = suggestion;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.focus();
    }
  }, []);

  const hasMessages = messages.length > 0;

  return (
    <div
      className="flex flex-col flex-1 h-full min-w-0 bg-background transition-all duration-300"
      suppressHydrationWarning
    >
      {/* Top bar — export controls (only visible when there are messages) */}
      {hasMessages && (
        <div className="flex items-center justify-end gap-2 px-4 py-2 border-b border-border/40">
          <button
            id="export-markdown-btn"
            onClick={exportMarkdown}
            title="Export as Markdown"
            className="flex items-center gap-1.5 text-[0.75rem] font-medium text-muted-foreground/60
              hover:text-foreground px-2.5 py-1.5 rounded-lg hover:bg-muted/40 transition-all"
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export MD</span>
          </button>
          <button
            id="export-json-btn"
            onClick={exportJSON}
            title="Export as JSON"
            className="flex items-center gap-1.5 text-[0.75rem] font-medium text-muted-foreground/60
              hover:text-foreground px-2.5 py-1.5 rounded-lg hover:bg-muted/40 transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export JSON</span>
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <MessageList
          messages={messages}
          isThinking={isThinking}
          thinkingMeta={thinkingMeta}
          isCacheHit={isCacheHit}
          onFollowUp={handleFollowUp}
        />
      </div>

      <MessageInput
        onSend={sendMessage}
        isLoading={isLoading}
        onStop={stopStreaming}
      />
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="flex-1 h-full bg-background" />}>
      <ChatPageContent />
    </Suspense>
  );
}
