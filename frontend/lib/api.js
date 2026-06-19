// API client for the Engineering Intelligence Hub backend

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

class ApiClient {
  constructor(base) {
    this.base = base;
  }

  async uploadFile(file) {
    const form = new FormData();
    form.append("file", file);

    const res = await fetch(`${this.base}/upload`, {
      method: "POST",
      body: form,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || `Upload failed: ${res.status}`);
    }

    return res.json();
  }

  async indexGitHub(repoUrl, branch) {
    const res = await fetch(`${this.base}/github-index`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repo_url: repoUrl, branch }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || `GitHub indexing failed: ${res.status}`);
    }

    return res.json();
  }

  async chatNonStreaming(question, filterDocType) {
    const res = await fetch(`${this.base}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, stream: false, filter_doc_type: filterDocType }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || `Chat failed: ${res.status}`);
    }

    return res.json();
  }

  chatStream(question, filterDocType) {
    return null; 
  }

  async getSources() {
    const res = await fetch(`${this.base}/sources`);
    if (!res.ok) throw new Error("Failed to fetch sources");
    return res.json();
  }

  async getStats() {
    const res = await fetch(`${this.base}/stats`);
    if (!res.ok) throw new Error("Failed to fetch stats");
    return res.json();
  }

  async healthCheck() {
    try {
      const res = await fetch(`${this.base}/health`, { signal: AbortSignal.timeout(3000) });
      return res.ok;
    } catch {
      return false;
    }
  }

  getStreamUrl(question) {
    return `${this.base}/chat`;
  }

  getBase() {
    return this.base;
  }
}

export const api = new ApiClient(API_BASE);
