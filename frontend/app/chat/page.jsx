"use client";

import { useChat } from "../../hooks/useChat";
import { MessageList } from "../../components/chat/MessageList";
import { MessageInput } from "../../components/chat/MessageInput";
import { Trash2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";

function ChatPageContent() {
  const searchParams = useSearchParams();
  const urlSessionId = searchParams.get("id");
  const { messages, isLoading, sessionId, sendMessage, stopStreaming, clearMessages, loadSession } = useChat();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
  }, [urlSessionId]);

  return (
    <div className="flex flex-col flex-1 h-full min-w-0 bg-background transition-all duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0 bg-background/80 backdrop-blur-md z-10 sticky top-0">
        <div>
          <h1 className="font-semibold text-foreground text-xl flex items-center gap-2">
            Chat
            {mounted && sessionId && (
              <span className="text-[10px] font-mono bg-accent/10 text-accent px-2 py-0.5 rounded-full border border-accent/20">
                Memory Active: {sessionId.split("-")[0]}
              </span>
            )}
          </h1>
          <p className="text-muted-foreground text-xs mt-0.5 font-medium">
            Ask questions about your engineering knowledge base
          </p>
        </div>
        {mounted && messages.length > 0 && (
          <button
            onClick={clearMessages}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-muted-foreground hover:text-accent hover:bg-accent/10 border border-transparent hover:border-accent/20 transition-all duration-200"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear
          </button>
        )}
      </div>

      {/* Messages */}
      <MessageList messages={messages} />

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