// SSE streaming utility for chat responses

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function streamChat(
  question,
  callbacks,
  signal,
  filterDocType
) {
  try {
    const response = await fetch(`${API_BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question,
        stream: true,
        filter_doc_type: filterDocType,
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
    case "sources":
      callbacks.onSources?.(event.sources);
      break;
    case "token":
      callbacks.onToken?.(event.content);
      break;
    case "done":
      callbacks.onDone?.(event.knowledge_cards, event.response_time_ms);
      break;
    case "error":
      callbacks.onError?.(event.message);
      break;
  }
}
