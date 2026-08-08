"use client";

import { useChat } from "../../hooks/useChat";
import { MessageList } from "../../components/chat/MessageList";
import { MessageInput } from "../../components/chat/MessageInput";
import { Trash2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";

function ChatPageContent() {
  const searchParams = useSearchParams();
  const urlSessionId = searchParams.get("id");
  const { messages, isLoading, isThinking, thinkingMeta, sessionId, sendMessage, stopStreaming, clearMessages, loadSession } = useChat();
  const sessionLabel = typeof sessionId === "string" && sessionId ? sessionId.split("-")[0] : "";

  useEffect(() => {
    if (urlSessionId) {
      if (sessionId !== urlSessionId) {
         loadSession(urlSessionId);
      }
    } else {
      // No ID in URL means start a fresh chat
      if (messages.length > 0 || (sessionId && sessionId !== urlSessionId)) {
         clearMessages();
      }
    }
    // Intentionally react to URL changes only; the current render provides the latest state values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlSessionId]);

  return (
    <div className="flex flex-col flex-1 h-full min-w-0 bg-background transition-all duration-300" suppressHydrationWarning>
      {/* Messages */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <MessageList messages={messages} isThinking={isThinking} thinkingMeta={thinkingMeta} />
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
