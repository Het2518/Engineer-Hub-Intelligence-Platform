/**
 * hooks/useChatExport.js — Export chat session as Markdown or JSON.
 *
 * Usage:
 *   const { exportMarkdown, exportJSON } = useChatExport(messages, sessionTitle);
 */

export function useChatExport(messages = [], title = "Chat Session") {
  function exportMarkdown() {
    const lines = [
      `# ${title}`,
      `> Exported on ${new Date().toLocaleString()}`,
      "",
    ];

    for (const msg of messages) {
      if (msg.role === "user") {
        lines.push(`## 🙋 Question`, "", msg.content, "");
      } else if (msg.role === "assistant") {
        lines.push(`## 🤖 Answer`, "", msg.content, "");
        if (msg.sources?.length) {
          lines.push(`### Sources`);
          for (const s of msg.sources) {
            lines.push(`- **${s.filename}** (${s.doc_type}) — confidence ${s.confidence}%`);
          }
          lines.push("");
        }
        if (msg.meta?.response_time_ms) {
          lines.push(`_Response time: ${Math.round(msg.meta.response_time_ms)}ms_`, "");
        }
      }
      lines.push("---", "");
    }

    const content = lines.join("\n");
    _download(`${_slug(title)}.md`, content, "text/markdown");
  }

  function exportJSON() {
    const data = {
      title,
      exported_at: new Date().toISOString(),
      message_count: messages.length,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        sources: m.sources ?? [],
        meta: m.meta ?? {},
      })),
    };
    _download(
      `${_slug(title)}.json`,
      JSON.stringify(data, null, 2),
      "application/json",
    );
  }

  return { exportMarkdown, exportJSON };
}

function _download(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

function _slug(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50) || "chat-export";
}
