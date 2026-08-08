// SSE streaming utility for chat responses

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function streamChat(
  question,
  callbacks,
  signal,
  filterDocType,
  sessionId,
  attachedFiles = null
) {
  try {
    const response = await fetch(`${API_BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question,
        stream: true,
        filter_doc_type: filterDocType,
        session_id: sessionId,
        attached_files: attachedFiles,
      }),
      signal,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: response.statusText }));
      callbacks.onError?.(err.detail || `Request failed: ${response.status}`);
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      callbacks.onError?.("No response body");
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") return;

        try {
          const event = JSON.parse(data);
          handleEvent(event, callbacks);
        } catch {
          // Skip malformed events
        }
      }
    }
  } catch (err) {
    if (err.name === "AbortError") return;
    callbacks.onError?.(err.message || "Stream failed");
  }
}

function handleEvent(event, callbacks) {
  switch (event.type) {
    case "thinking":
      callbacks.onThinking?.({
        okf_sources: event.okf_sources || 0,
        rag_sources: event.rag_sources || 0,
        total: event.total || 0,
      });
      break;
    case "sources":
      callbacks.onSources?.(event.sources);
      break;
    case "token":
      callbacks.onToken?.(event.content);
      break;
    case "done":
      callbacks.onDone?.({
        response_time_ms: event.response_time_ms,
        context_used: event.context_used || 0,
        okf_sources: event.okf_sources || 0,
      });
      break;
    case "error":
      callbacks.onError?.(event.message);
      break;
  }
}
