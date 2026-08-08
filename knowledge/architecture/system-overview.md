---
type: Architecture
title: "System Overview"
description: "High-level architecture of the AI Research Assistant platform — services, data flows, and infrastructure components"
tags: [architecture, system-design, services, infrastructure, overview]
timestamp: 2026-08-07T00:00:00Z
provenance:
  source: "Engineering Team"
trust:
  author: "engineering-team"
  verified: true
---

# System Overview

## Architecture Summary

The AI Research Assistant is a full-stack RAG (Retrieval-Augmented Generation) platform with a **Hybrid OKF + Vector** knowledge layer.

## Components

```
┌─────────────────────────────────────────────────────────┐
│                     FRONTEND (Next.js)                   │
│   Chat │ Upload │ GitHub │ Knowledge Studio │ Admin       │
└─────────────────────────┬───────────────────────────────┘
                          │ HTTP / SSE
┌─────────────────────────▼───────────────────────────────┐
│                     BACKEND (FastAPI)                    │
│                                                          │
│  Routers: /chat  /upload  /github  /knowledge  /stats   │
│                                                          │
│  Services:                                               │
│   ├── OKF Reader (knowledge/ directory)                  │
│   ├── Hybrid Search (OKF + ChromaDB + BM25)              │
│   ├── LLM Service (Groq / OpenAI streaming)              │
│   ├── Embedding Service (all-MiniLM-L6-v2)               │
│   └── Memory Service (SQLite chat history)               │
└──────┬──────────────────────────────┬────────────────────┘
       │                              │
┌──────▼──────┐              ┌────────▼───────┐
│ ChromaDB    │              │ OKF Bundle      │
│ (Vector DB) │              │ knowledge/*.md  │
│ ./vectorstore│              │ (Git-native)    │
└─────────────┘              └────────────────┘
```

## Data Flow: User Query

1. User submits question via Chat UI
2. FastAPI `/chat` endpoint receives request
3. **OKF Reader** searches `knowledge/` for matching docs (deterministic, high-trust)
4. **Hybrid Retrieval** runs vector + BM25 search in ChromaDB (semantic)
5. OKF results merged with RAG results (OKF ranked first with 20% trust boost)
6. CRAG quality gate filters out irrelevant chunks
7. LLM generates streaming response grounded in filtered context
8. SSE streams tokens back to frontend

## Data Flow: Document Ingestion

1. User uploads file via Upload UI
2. File streamed to disk → SHA-256 duplicate check
3. Text extracted (PDF/DOCX/Image Vision/CSV)
4. Chunked with syntax-aware splitting (code) or markdown-aware (docs)
5. Embedded and stored in ChromaDB with metadata
6. If doc_type matches (runbook/playbook/incident): auto-generates OKF file

## Related
- [Standards](../standards/api-versioning.md)
