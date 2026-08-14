/**
 * lib/api.js — HTTP client for the AI-Research Assistant backend.
 *
 * All network calls go through this module so the backend URL
 * is never hard-coded in component or hook files.
 */

import { API_BASE } from "./constants";

class ApiClient {
  constructor(base) {
    this.base = base;
  }

  /** Upload and index a document into the knowledge base. */
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

  /** Extract text from a file for use in a single chat context (not indexed). */
  async parseChatFile(file) {
    const form = new FormData();
    form.append("file", file);

    const res = await fetch(`${this.base}/chat/parse-file`, {
      method: "POST",
      body: form,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || `Parse failed: ${res.status}`);
    }

    return res.json();
  }

  /** Index a GitHub repository into the knowledge base. */
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

  /** Non-streaming chat — returns the full answer in one response. */
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

  /** Return the list of indexed document sources. */
  async getSources() {
    const res = await fetch(`${this.base}/sources`);
    if (!res.ok) throw new Error("Failed to fetch sources");
    return res.json();
  }

  /** Return admin usage stats. */
  async getStats() {
    const res = await fetch(`${this.base}/stats`);
    if (!res.ok) throw new Error("Failed to fetch stats");
    return res.json();
  }

  /** Returns true if the backend is reachable. */
  async healthCheck() {
    try {
      const res = await fetch(`${this.base}/health`, {
        signal: AbortSignal.timeout(3000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /** Return the base URL (used by streaming.js to build the /chat endpoint). */
  getBase() {
    return this.base;
  }
}

export const api = new ApiClient(API_BASE);
