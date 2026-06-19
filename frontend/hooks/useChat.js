"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { streamChat } from "../lib/streaming";

export function useChat() {
  const [messages, setMessages] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem("chat_messages");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {}
      }
    }
    return [];
  });
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem("chat_session_id");
      if (saved) return saved;
      const newId = crypto.randomUUID();
      sessionStorage.setItem("chat_session_id", newId);
      return newId;
    }
    return "";
  });
  const abortRef = useRef(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem("chat_messages", JSON.stringify(messages));
    }
  }, [messages]);

  const sendMessage = useCallback(async (question) => {
    if (!question.trim() || isLoading) return;

    // Add user message
    const userMsg = {
      id: crypto.randomUUID(),
      role: "user",
      content: question,
    };

    // Add placeholder assistant message
    const assistantMsgId = crypto.randomUUID();
    const assistantMsg = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setIsLoading(true);

    // Create new abort controller
    abortRef.current = new AbortController();

    try {
      await streamChat(
        question,
        {
          onSources: (sources) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId ? { ...m, sources } : m
              )
            );
          },
          onToken: (token) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId
                  ? { ...m, content: m.content + token }
                  : m
              )
            );
          },
          onDone: (knowledge_cards, response_time_ms) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId
                  ? { ...m, isStreaming: false, knowledge_cards, response_time_ms }
                  : m
              )
            );
            setIsLoading(false);
          },
          onError: (error) => {
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
        sessionId
      );
    } catch {
      setIsLoading(false);
    }
  }, [isLoading]);

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
    if (typeof window !== 'undefined') {
      sessionStorage.setItem("chat_session_id", newId);
      sessionStorage.removeItem("chat_messages");
    }
  }, [stopStreaming]);

  const loadSession = useCallback(async (id) => {
    if (id === sessionId) return;
    stopStreaming();
    setIsLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
      const res = await fetch(`${apiUrl}/chat/sessions/${id}`);
      if (res.ok) {
        const data = await res.json();
        const formatted = (data.messages || []).map((m, i) => ({
          id: `${id}-msg-${i}`,
          role: m.role,
          content: m.content
        }));
        setMessages(formatted);
        setSessionId(id);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem("chat_session_id", id);
          sessionStorage.setItem("chat_messages", JSON.stringify(formatted));
        }
      }
    } catch(e) {
      console.error("Failed to load session", e);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, stopStreaming]);

  return {
    messages,
    isLoading,
    sessionId,
    sendMessage,
    stopStreaming,
    clearMessages,
    loadSession,
  };
}
