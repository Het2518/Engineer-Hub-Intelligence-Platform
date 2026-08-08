"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { streamChat } from "../lib/streaming";

export function useChat() {
  // Always start with empty/default state to match SSR — hydrate from
  // sessionStorage in a useEffect to avoid React hydration mismatch.
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingMeta, setThinkingMeta] = useState(null);
  const [sessionId, setSessionId] = useState("");
  const abortRef = useRef(null);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from sessionStorage after first client-side render
  useEffect(() => {
    const savedMessages = sessionStorage.getItem("chat_messages");
    if (savedMessages) {
      try { setMessages(JSON.parse(savedMessages)); } catch {}
    }
    const savedId = sessionStorage.getItem("chat_session_id");
    if (savedId) {
      setSessionId(savedId);
    } else {
      const newId = crypto.randomUUID();
      sessionStorage.setItem("chat_session_id", newId);
      setSessionId(newId);
    }
    setHydrated(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("chat_messages", JSON.stringify(messages));
    }
  }, [messages]);

  const sendMessage = useCallback(async (question, attachedFile = null) => {
    if ((!question.trim() && !attachedFile) || isLoading) return;

    const userMsg = {
      id: crypto.randomUUID(),
      role: "user",
      content: question,
      attachedFile: attachedFile,
    };

    const assistantMsgId = crypto.randomUUID();
    const assistantMsg = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setIsLoading(true);

    abortRef.current = new AbortController();

    // ── Stream batching to prevent MarkdownRenderer freeze ──
    let tokenBuffer = "";
    let lastFlushTime = Date.now();
    let flushTimer = null;

    const flushTokens = () => {
      if (!tokenBuffer) return;
      const toFlush = tokenBuffer;
      tokenBuffer = "";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId ? { ...m, content: m.content + toFlush } : m
        )
      );
      lastFlushTime = Date.now();
    };

    try {
      await streamChat(
        question,
        {
          onThinking: (meta) => {
            setIsThinking(true);
            setThinkingMeta(meta);
          },
          onSources: (sources) => {
            setIsThinking(false);
            setThinkingMeta(null);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId ? { ...m, sources } : m
              )
            );
          },
          onToken: (token) => {
            setIsThinking(false);
            tokenBuffer += token;
            
            // Flush at max 20fps to keep UI silky smooth and prevent React freeze
            if (Date.now() - lastFlushTime > 50) {
              flushTokens();
            } else if (!flushTimer) {
              flushTimer = setTimeout(() => {
                flushTokens();
                flushTimer = null;
              }, 50);
            }
          },
          onDone: ({ response_time_ms, context_used, okf_sources }) => {
            if (flushTimer) clearTimeout(flushTimer);
            flushTokens();
            setIsThinking(false);
            setThinkingMeta(null);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId
                  ? { ...m, isStreaming: false, response_time_ms, context_used, okf_sources }
                  : m
              )
            );
            setIsLoading(false);
          },
          onError: (error) => {
            if (flushTimer) clearTimeout(flushTimer);
            flushTokens();
            setIsThinking(false);
            setThinkingMeta(null);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId
                  ? {
                      ...m,
                      isStreaming: false,
                      error,
                      content: m.content || "An error occurred. Please check the backend connection.",
                    }
                  : m
              )
            );
            setIsLoading(false);
          },
        },
        abortRef.current.signal,
        undefined,
        sessionId,
        attachedFile ? [attachedFile] : null
      );
    } catch (e) {
      if (flushTimer) clearTimeout(flushTimer);
      flushTokens();
      setIsLoading(false);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? { ...m, isStreaming: false, error: e?.message || "Stream failed." }
            : m
        )
      );
    }
  }, [isLoading, sessionId]);

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    setIsLoading(false);
    setMessages((prev) =>
      prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m))
    );
  }, []);

  const clearMessages = useCallback(() => {
    stopStreaming();
    setMessages([]);
    const newId = crypto.randomUUID();
    setSessionId(newId);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("chat_session_id", newId);
      sessionStorage.removeItem("chat_messages");
    }
  }, [stopStreaming]);

  const loadSession = useCallback(async (id) => {
    if (id === sessionId) return;
    stopStreaming();
    setIsLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${apiUrl}/chat/sessions/${id}`);
      if (res.ok) {
        const data = await res.json();
        const formatted = (data.messages || []).map((m, i) => ({
          id: `${id}-msg-${i}`,
          role: m.role,
          content: m.content,
        }));
        setMessages(formatted);
        setSessionId(id);
        if (typeof window !== "undefined") {
          sessionStorage.setItem("chat_session_id", id);
          sessionStorage.setItem("chat_messages", JSON.stringify(formatted));
        }
      }
    } catch (e) {
      console.error("Failed to load session", e);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, stopStreaming]);

  return {
    messages,
    isLoading,
    isThinking,
    thinkingMeta,
    sessionId,
    sendMessage,
    stopStreaming,
    clearMessages,
    loadSession,
  };
}
