<h1 align="center">
  <br />
  🧠 Engineer Hub Intelligence Platform
  <br />
  <sub><sup>AI Research Assistant v2.0</sup></sub>
</h1>

<p align="center">
  <b>A production-grade, hybrid RAG platform built for engineering teams.</b><br />
  Ask questions. Get grounded, cited answers from your own documentation, runbooks, incident reports, and codebases.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-2.0.0-blue?style=flat-square" />
  <img src="https://img.shields.io/badge/backend-FastAPI-009688?style=flat-square&logo=fastapi" />
  <img src="https://img.shields.io/badge/frontend-Next.js_16-black?style=flat-square&logo=next.js" />
  <img src="https://img.shields.io/badge/LLM-Groq_%2F_Llama_3.3_70B-f55036?style=flat-square" />
  <img src="https://img.shields.io/badge/vector_db-ChromaDB-orange?style=flat-square" />
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" />
</p>

---

## Table of Contents

1. [Motivation & Problem Statement](#1-motivation--problem-statement)
2. [System Overview](#2-system-overview)
3. [Software Requirements Specification (SRS)](#3-software-requirements-specification-srs)
4. [Architecture](#4-architecture)
5. [Project Structure](#5-project-structure)
6. [Tech Stack](#6-tech-stack)
7. [API Reference](#7-api-reference)
8. [Quick Start](#8-quick-start)
9. [Configuration Reference](#9-configuration-reference)
10. [Feature Flags](#10-feature-flags)
11. [Knowledge Studio (OKF)](#11-knowledge-studio-okf)
12. [Security Model](#12-security-model)
13. [Observability](#13-observability)
14. [Contributing](#14-contributing)

---

## 1. Motivation & Problem Statement

### The Problem

Modern engineering teams generate enormous amounts of institutional knowledge — runbooks, incident post-mortems, architecture diagrams, internal wikis, Slack threads, GitHub repositories, and onboarding guides. This knowledge is:

- **Scattered** across dozens of tools (Notion, Confluence, GitHub, Google Drive, Jira, Slack)
- **Siloed** — a junior engineer cannot easily find why a production decision was made 18 months ago
- **Stale** — outdated docs are often indistinguishable from current ones
- **Inaccessible at 3 AM** — when an on-call engineer faces an outage, they must manually search through dozens of pages

The result: engineers waste **25–40% of their workday** searching for information instead of building. Incident MTTR (Mean Time To Resolution) is inflated by poor knowledge access. Critical institutional knowledge walks out the door when senior engineers leave.

### The Solution

**Engineer Hub Intelligence Platform** is a self-hosted, AI-powered research assistant that:

1. **Ingests** your existing documentation (PDFs, Markdown, DOCX), GitHub repositories, and structured knowledge bundles
2. **Indexes** them into a hybrid vector + keyword search engine with deterministic OKF overlays
3. **Answers** natural language questions with **grounded, cited responses** — every factual claim is traceable to a source document
4. **Remembers** conversation context across sessions — no need to re-explain background every time
5. **Never hallucinates** — a multi-stage filtering and grounding pipeline ensures the LLM only uses retrieved facts

### Why Not Just Use ChatGPT / Claude?

| Feature | ChatGPT/Claude | This Platform |
|---|---|---|
| Uses your private docs | ❌ | ✅ |
| Cites specific source files | ❌ | ✅ |
| Works offline / self-hosted | ❌ | ✅ |
| No data leaves your org | ❌ | ✅ |
| Grounded (no hallucination) | ❌ | ✅ |
| Persistent memory by session | ❌ | ✅ |
| Runbook / incident format aware | ❌ | ✅ |

---

## 2. System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     User (Engineer)                             │
│              Asks: "Why did the DB go down in Q2?"              │
└──────────────────────────────┬──────────────────────────────────┘
                               │ HTTP + SSE
┌──────────────────────────────▼──────────────────────────────────┐
│               Next.js 16 Frontend (localhost:3000)              │
│   Chat · Upload · GitHub Index · Knowledge Studio · Admin       │
└──────────────────────────────┬──────────────────────────────────┘
                               │ REST API
┌──────────────────────────────▼──────────────────────────────────┐
│              FastAPI Backend (localhost:8000)                    │
│                                                                 │
│  ┌──────────────┐  ┌───────────┐  ┌──────────┐  ┌──────────┐  │
│  │  Query       │  │  Hybrid   │  │   LLM    │  │  Memory  │  │
│  │  Rewriter    │→ │  Search   │→ │  Service │  │  SQLite  │  │
│  └──────────────┘  └───────────┘  └──────────┘  └──────────┘  │
│                         │                                       │
│            ┌────────────┴─────────────┐                        │
│            │                          │                        │
│   ┌────────▼──────┐        ┌──────────▼──────┐               │
│   │  ChromaDB     │        │  OKF Knowledge  │               │
│   │  Vector+BM25  │        │  Bundle         │               │
│   │  + RRF Fusion │        │  (Markdown)     │               │
│   └───────────────┘        └─────────────────┘               │
└─────────────────────────────────────────────────────────────────┘
```

**Key design principle:** No Docker. No cloud databases. The entire system runs locally with a single PowerShell command.

---

## 3. Software Requirements Specification (SRS)

### 3.1 Functional Requirements

#### FR-01: Document Ingestion
- The system SHALL accept document uploads in formats: `.pdf`, `.docx`, `.doc`, `.txt`, `.md`, `.json`, `.csv`, `.png`, `.jpg`, `.jpeg`
- The system SHALL reject files exceeding 50 MB with an HTTP 413 response
- The system SHALL detect and reject duplicate uploads (SHA-256 content hash) with HTTP 409
- The system SHALL auto-classify document types (incident report, runbook, architecture, readme, documentation) based on filename keywords
- The system SHALL automatically create OKF knowledge entries for runbooks, playbooks, and incident reports on upload

#### FR-02: GitHub Repository Indexing
- The system SHALL clone and index any public GitHub repository given a `https://github.com/owner/repo` URL
- The system SHALL support private repositories when a `GITHUB_TOKEN` is configured
- The system SHALL index source code files (`.py`, `.js`, `.ts`, `.go`, `.java`, `.rs`, `.cpp`, `.md`, `.yaml`, `.sql`, `.tf`, etc.)
- The system SHALL skip binary files, lock files, and files exceeding 500 KB
- The system SHALL support optional branch selection

#### FR-03: Natural Language Chat (RAG)
- The system SHALL accept natural language questions up to 4,000 characters
- The system SHALL retrieve the top-K most relevant documents using hybrid search
- The system SHALL stream the LLM response token-by-token via Server-Sent Events (SSE)
- The system SHALL include cited sources with confidence percentages in every response
- The system SHALL display a "thinking" indicator while retrieval is in progress
- The system SHALL support attaching files directly in chat for ephemeral context (not indexed)
- The system SHALL support non-streaming mode for programmatic use

#### FR-04: Conversation Memory
- The system SHALL maintain persistent conversation history per session using SQLite
- The system SHALL support loading any past session by URL parameter (`?id=<session_id>`)
- The system SHALL automatically rewrite follow-up questions into standalone queries using conversation history
- The system SHALL cap history at 40 messages per session (last 20 sent to LLM)
- The system SHALL support renaming and deleting sessions via API

#### FR-05: Hybrid Retrieval
- The system SHALL perform vector similarity search using ChromaDB with cosine distance
- The system SHALL perform BM25 keyword search over the local corpus in parallel
- The system SHALL fuse vector and BM25 scores using Reciprocal Rank Fusion (RRF)
- The system SHALL integrate OKF deterministic results with a configurable trust boost (default 1.2×)
- The system SHALL filter retrieved chunks using absolute (≥30%) and relative (≥72% of top score) confidence thresholds
- The system SHALL deduplicate near-identical chunks using SequenceMatcher (≥88% similarity)

#### FR-06: OKF Knowledge Studio
- The system SHALL provide a CRUD interface for structured knowledge documents (OKF format)
- The system SHALL support OKF document types: runbook, playbook, incident, architecture, standard
- The system SHALL display knowledge health metrics (stale documents, trust levels)
- The system SHALL allow in-browser creation and editing of structured knowledge documents

#### FR-07: Admin Dashboard
- The system SHALL display usage statistics: total queries, average response time, documents, chunks, repositories
- The system SHALL report ChromaDB and OKF health via `/health` endpoint

### 3.2 Non-Functional Requirements

#### NFR-01: Performance
- The system SHOULD deliver a first response token within 3 seconds for typical queries
- Vector search SHOULD complete within 500 ms for knowledge bases up to 10,000 chunks
- The system SHALL NOT block the async event loop during file I/O or git clone (all use `asyncio.to_thread`)

#### NFR-02: Reliability
- The LLM service SHALL retry failed completions once with a 1.5-second backoff
- If all LLM retries fail, the system SHALL return the best matching raw document excerpt — it SHALL NOT return an empty response
- ChromaDB and OKF failures SHALL be isolated and logged; the system SHALL NOT crash on subsystem errors

#### NFR-03: Security
- GitHub tokens SHALL NOT appear in logs, error messages, or URLs
- File uploads SHALL be validated for extension and size before reading content into memory
- Uploaded filenames SHALL be sanitized (path traversal characters stripped)
- GitHub URLs SHALL be validated against a strict regex to prevent SSRF
- API key authentication SHALL be enforced when `API_KEY` is configured

#### NFR-04: Anti-Hallucination
- The LLM SHALL operate with a system prompt that enforces strict grounding rules
- Retrieved chunks SHALL pass absolute AND relative confidence filters before reaching the LLM
- The LLM SHALL be instructed to explicitly state when retrieved context is insufficient
- Context window SHALL be capped at ~5,500 characters to prevent irrelevant documents from diluting answers

#### NFR-05: Scalability
- BM25 corpus SHALL be capped at 200 documents to prevent OOM on large knowledge bases
- Context injected to the LLM SHALL be capped at 5 documents × 1,200 chars each
- Session message history SHALL be pruned to the latest 40 messages per session

### 3.3 System Constraints

| Constraint | Value |
|---|---|
| Maximum file upload size | 50 MB |
| Maximum extracted text length | 500,000 characters |
| Maximum question length | 4,000 characters |
| Maximum response tokens | 3,000 |
| LLM temperature | 0.3 (reproducible, low-hallucination) |
| History sent to LLM per turn | Last 20 messages |
| Max messages stored per session | 40 |
| BM25 corpus limit | 200 chunks |
| Max documents in LLM context | 5 chunks |
| Max chars per context chunk | 1,200 |
| Max total context chars | 5,500 |
| Near-duplicate threshold | 88% SequenceMatcher ratio |
| Rate limits | Chat: 20/min · Upload: 5/min · GitHub: 3/min |

---

## 4. Architecture

### 4.1 High-Level Architecture

```
┌──────────────────── FRONTEND (Next.js 16) ────────────────────────┐
│  /chat      — Streaming SSE chat with memory                      │
│  /upload    — Drag-and-drop document ingestion                    │
│  /github    — GitHub repository indexer                           │
│  /knowledge — OKF Knowledge Studio (CRUD)                         │
│  /admin     — Usage statistics dashboard                          │
└───────────────────────────────┬───────────────────────────────────┘
                                │ REST + SSE
┌──────────────────────── BACKEND (FastAPI) ────────────────────────┐
│                                                                    │
│  Routers: chat · upload · github · knowledge · sources · stats    │
│                                                                    │
│  Services:                                                         │
│    retrieval.py   → Hybrid (OKF + Vector + BM25 + RRF + MMR)     │
│    llm.py         → LLM streaming, context building, grounding    │
│    memory.py      → SQLite conversation history (async-safe)      │
│    query_rewriter → Follow-up question contextualization          │
│    embedding.py   → Local all-MiniLM-L6-v2 embeddings            │
│    ingestion.py   → Text extraction (PDF, DOCX, MD, CSV, image)  │
│    okf_reader.py  → OKF bundle reader + semantic search          │
│    okf_writer.py  → OKF document generator + auto-creation       │
│                                                                    │
│  Storage:                                                          │
│    ./vectorstore  → ChromaDB persistent collection               │
│    ./uploads      → Uploaded files + SQLite chat DB              │
│    ./knowledge    → OKF Markdown knowledge bundle                │
└────────────────────────────────────────────────────────────────────┘
```

### 4.2 Retrieval Pipeline (V2 Multi-RAG)

```
User Question
     │
     ▼
┌─────────────────────┐
│  1. Query Rewriter  │  Rewrites follow-up Qs into standalone queries
│  (LLM, temp=0.0)   │  using last 4 conversation turns
└──────────┬──────────┘
           │ Rewritten query (parallel fork)
     ┌─────┴──────────────────────────┐
     │                                │
     ▼                                ▼
┌────────────────┐          ┌──────────────────────┐
│  2a. Vector    │          │  2b. OKF Lookup      │
│  ChromaDB      │          │  (Deterministic,     │
│  cosine sim    │          │  High-Trust Layer)   │
└────────┬───────┘          └──────────┬───────────┘
         │                             │
         ▼                             │
┌────────────────┐                     │
│  2c. BM25      │                     │
│  Keyword       │                     │
│  Search        │                     │
└────────┬───────┘                     │
         ▼                             │
┌────────────────────────┐             │
│  3. RRF Fusion         │             │
│  Reciprocal Rank       │             │
│  Fusion score merge    │             │
└────────┬───────────────┘             │
         ▼                             │
┌────────────────────────┐             │
│  4. MMR Re-ranking     │             │
│  Diversity control     │             │
└────────┬───────────────┘             │
         ▼                             ▼
┌──────────────────────────────────────────────────┐
│  5. Merge & Deduplicate                          │
│  OKF results (1.2× trust boost) first            │
│  Duplicate RAG results removed by content hash   │
│  → Top-K final results                           │
└─────────────────────┬────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────┐
│  6. LLM Context Building                            │
│  · Absolute floor: drop chunks < 30% confidence     │
│  · Sort by confidence descending                    │
│  · Relative floor: drop if < 72% of top score       │
│  · Near-duplicate dedup (≥88% SequenceMatcher)      │
│  · Cap: 5 chunks × 1,200 chars = ~5,500 chars max   │
└─────────────────────┬───────────────────────────────┘
                      ▼
               ┌─────────────┐
               │  LLM Stream │  Groq / Llama 3.3 70B
               │  SSE tokens │  temp=0.3, max_tokens=3000
               └─────────────┘
```

### 4.3 OKF Knowledge Layer

The **Open Knowledge Format (OKF)** layer is a deterministic, high-trust knowledge source that sits *above* the probabilistic vector search layer. OKF documents are Markdown files with YAML frontmatter stored in `./knowledge/`.

```
knowledge/
├── architecture/     — System design docs, ADRs
├── incidents/        — Post-mortems, outage reports
├── playbooks/        — Response playbooks
├── runbooks/         — Step-by-step operational guides
└── standards/        — API versioning, coding standards
```

**Why OKF over pure RAG?**
- **Exact content** — no chunking artifacts, full document context
- **Trust levels** — `gold | silver | bronze` signal reliability
- **Staleness tracking** — documents can be explicitly marked stale
- **1.2× trust boost** — OKF results score higher than equivalent RAG results

---

## 5. Project Structure

```
AI-Research Assistant/
├── backend/
│   ├── main.py                   # FastAPI app, lifespan, middleware
│   ├── config.py                 # Pydantic settings (all env vars)
│   ├── limiter.py                # SlowAPI rate limiter singleton
│   ├── requirements.txt
│   ├── db/
│   │   ├── chroma.py             # ChromaDB client + collection factory
│   │   └── stats_store.py        # SQLite usage statistics
│   ├── routers/
│   │   ├── chat.py               # POST /chat + session management
│   │   ├── upload.py             # POST /upload + parse-file
│   │   ├── github.py             # POST /github-index
│   │   ├── knowledge.py          # OKF CRUD endpoints
│   │   ├── sources.py            # GET /sources
│   │   └── stats.py              # GET /stats
│   └── services/
│       ├── retrieval.py          # Hybrid search (OKF + Vector + BM25 + RRF + MMR)
│       ├── llm.py                # LLM streaming, context building, grounding
│       ├── memory.py             # SQLite conversation history (async-safe)
│       ├── query_rewriter.py     # Follow-up query contextualization
│       ├── embedding.py          # all-MiniLM-L6-v2 local embeddings
│       ├── ingestion.py          # Text extraction (PDF/DOCX/MD/CSV/image)
│       ├── chunking.py           # Recursive character text splitter
│       ├── okf_reader.py         # OKF bundle reader + semantic search
│       ├── okf_writer.py         # OKF doc generator + auto-creation
│       └── evaluation.py         # RAGAS evaluation harness
│
├── frontend/
│   ├── app/
│   │   ├── chat/page.jsx         # Chat interface (SSE streaming + memory)
│   │   ├── upload/page.jsx       # Document upload UI
│   │   ├── github/page.jsx       # GitHub indexer UI
│   │   ├── knowledge/page.jsx    # OKF Knowledge Studio
│   │   ├── admin/page.jsx        # Usage statistics dashboard
│   │   ├── globals.css           # Design system (tokens, components)
│   │   └── layout.jsx            # Root layout (sidebar, theme)
│   ├── components/
│   │   ├── chat/
│   │   │   ├── MessageList.jsx   # Message rendering (user + AI bubbles)
│   │   │   ├── MessageInput.jsx  # Input box + file attach + stop button
│   │   │   ├── StreamingMessage.jsx  # Token-by-token streaming renderer
│   │   │   ├── MarkdownRenderer.jsx  # Full markdown + code block renderer
│   │   │   ├── SourceCard.jsx    # Cited source display card
│   │   │   ├── CodeBlock.jsx     # Syntax-highlighted code + copy/download
│   │   │   ├── ThinkingIndicator.jsx # Pre-stream retrieval progress
│   │   │   └── Mermaid.jsx       # Mermaid diagram renderer
│   │   ├── knowledge/
│   │   │   ├── OKFCreateForm.jsx
│   │   │   ├── OKFDocumentCard.jsx
│   │   │   └── OKFDocumentViewer.jsx
│   │   ├── layout/Sidebar.jsx    # Navigation sidebar with session list
│   │   └── upload/FileDropzone.jsx
│   ├── hooks/useChat.js          # Chat state, SSE streaming, session mgmt
│   └── lib/api.js                # Backend API client
│
├── knowledge/                    # OKF knowledge bundle (Markdown)
├── sample-data/                  # Example documents for testing
├── vectorstore/                  # ChromaDB storage (auto-created)
├── .env.example                  # All configurable environment variables
├── start.ps1                     # One-click Windows launcher
└── README.md
```

---

## 6. Tech Stack

### Backend

| Component | Technology | Reason |
|---|---|---|
| Web framework | FastAPI 0.115+ | Async-native, auto OpenAPI docs, SSE support |
| LLM provider | Groq API (OpenAI-compatible) | Ultra-low latency, free tier, Llama 3.3 70B |
| LLM model | `llama-3.3-70b-versatile` | Best open-source model for grounded Q&A |
| Embeddings | `all-MiniLM-L6-v2` (local) | Fast, no API cost, good semantic quality |
| Vector DB | ChromaDB (local filesystem) | Zero infrastructure — no Docker required |
| BM25 | `rank-bm25` | Lightweight keyword search for exact term matching |
| Conversation memory | SQLite (WAL mode, async) | Zero infrastructure, persistent, indexed |
| Document parsing | pypdf, python-docx, Pillow, markdown | All common engineering doc formats |
| OKF format | python-frontmatter (YAML + Markdown) | Human-readable, git-friendly knowledge format |
| Rate limiting | SlowAPI | Per-endpoint rate limits |
| Tracing | LangSmith + langchain | Production observability |
| Logging | structlog | Structured, filterable JSON logs |

### Frontend

| Component | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | React 19 + JavaScript |
| Styling | Vanilla CSS (CSS custom properties design system) |
| Markdown rendering | react-markdown + remark-gfm |
| Icons | lucide-react |
| UI primitives | Radix UI (Dialog, Tabs, Tooltip, Progress) |
| SSE streaming | `eventsource-parser` |

---

## 7. API Reference

Interactive Swagger UI: `http://localhost:8000/docs`

### Chat

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/chat` | Ask a question. SSE streaming (`stream: true`) or batch |
| `GET` | `/chat/sessions` | List all past conversation sessions |
| `GET` | `/chat/sessions/{id}` | Get message history for a session |
| `DELETE` | `/chat/sessions/{id}` | Delete a session |
| `PATCH` | `/chat/sessions/{id}` | Rename a session |
| `POST` | `/chat/parse-file` | Extract text for ephemeral chat context (not indexed) |

**Chat Request Body:**
```json
{
  "question": "How does authentication work in our API?",
  "stream": true,
  "session_id": "abc-123",
  "filter_doc_type": "runbook",
  "attached_files": [
    { "filename": "spec.pdf", "content": "<extracted text>" }
  ]
}
```

**SSE Event Types (streaming):**

| Event type | Payload | Description |
|---|---|---|
| `thinking` | `{okf_sources, rag_sources, total}` | Retrieval in progress |
| `sources` | `[{filename, doc_type, confidence, is_okf, ...}]` | Sources found |
| `token` | `{content: "..."}` | LLM token stream |
| `error` | `{message}` | Stream error |
| `done` | `{response_time_ms, context_used, okf_sources}` | Completion |

### Ingestion

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/upload` | Upload and index a document |
| `POST` | `/github-index` | Clone and index a GitHub repository |
| `GET` | `/sources` | List all indexed documents |

### OKF Knowledge Studio

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/knowledge` | List all OKF documents |
| `POST` | `/knowledge` | Create a new OKF document |
| `GET` | `/knowledge/{id}` | Get a specific OKF document |
| `PUT` | `/knowledge/{id}` | Update an OKF document |
| `DELETE` | `/knowledge/{id}` | Delete an OKF document |

### System

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | ChromaDB status, OKF status, LLM config |
| `GET` | `/stats` | Usage statistics |

---

## 8. Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- A [Groq API key](https://console.groq.com/) (free tier available)

### 1. Clone

```bash
git clone https://github.com/Het2518/Engineer-Hub-Intelligence-Platform.git
cd Engineer-Hub-Intelligence-Platform
```

### 2. Configure

```bash
cp .env.example backend/.env
```

Edit `backend/.env` and add your Groq API key:

```env
GROQ_API_KEY=gsk_your_key_here
```

### 3. Start (Windows — One Command)

```powershell
.\start.ps1
```

This automatically checks for `.env`, installs frontend dependencies on first run, starts FastAPI on port 8000, starts Next.js on port 3000, and streams both logs.

### 4. Start (Manual)

**Backend:**
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

### 5. Index Your First Document

1. Open `http://localhost:3000/upload`
2. Drop a PDF, DOCX, or Markdown file
3. Go to `http://localhost:3000/chat`
4. Ask a question about the document

---

## 9. Configuration Reference

| Variable | Default | Description |
|---|---|---|
| `GROQ_API_KEY` | *(required)* | Groq API key |
| `LLM_CHAT_MODEL` | `llama-3.3-70b-versatile` | Groq model name |
| `LLM_BASE_URL` | `https://api.groq.com/openai/v1` | OpenAI-compatible base URL |
| `CHROMA_PERSIST_DIR` | `./vectorstore` | ChromaDB storage path |
| `UPLOAD_DIR` | `./uploads` | Uploaded files + SQLite DB path |
| `GITHUB_TOKEN` | *(empty)* | GitHub PAT for private repo access |
| `API_KEY` | *(empty)* | Bearer token for API auth (empty = disabled) |
| `CORS_ORIGINS` | `http://localhost:3000` | Allowed frontend origins |
| `LOG_LEVEL` | `INFO` | Logging verbosity |
| `TOP_K_VECTOR` | `10` | Vector search candidate count |
| `TOP_K_FINAL` | `7` | Final documents after re-ranking |
| `OKF_ENABLED` | `true` | Enable OKF deterministic layer |
| `OKF_KNOWLEDGE_DIR` | `./knowledge` | OKF bundle directory |
| `OKF_TRUST_BOOST` | `1.2` | Score multiplier for OKF results |
| `OKF_MIN_SCORE` | `0.25` | Minimum relevance for OKF results |
| `OKF_AUTO_CREATE_ON_UPLOAD` | `true` | Auto-create OKF docs for runbooks/incidents |
| `LANGCHAIN_TRACING_V2` | `false` | Enable LangSmith tracing |
| `LANGCHAIN_API_KEY` | *(empty)* | LangSmith API key |

---

## 10. Feature Flags

| Feature | Flag | Default | Effect when enabled |
|---|---|---|---|
| OKF Knowledge Layer | `OKF_ENABLED` | `true` | Deterministic, high-trust document lookup |
| Multi-Query Expansion | `MULTI_QUERY_ENABLED` | `true` | Better recall on indirect questions |
| CRAG Quality Gate | `CRAG_ENABLED` | `true` | Filters irrelevant chunks before LLM |
| Self-RAG Critique | `SELF_RAG_CRITIQUE` | `true` | Post-generation grounding check |
| Web Search Fallback | `WEB_SEARCH_FALLBACK` | `false` | DuckDuckGo when KB has <3 results |

---

## 11. Knowledge Studio (OKF)

### OKF Document Structure

```markdown
---
title: "Database Rollback Procedure"
okf_type: runbook
trust_level: gold
tags: [database, postgres, recovery, production]
resource: "https://internal-wiki/db-rollback"
is_stale: false
source_id: runbooks/db-rollback
---

## Overview
Step-by-step guide to rolling back a PostgreSQL database...
```

### OKF Types

| Type | Description | Typical Trust |
|---|---|---|
| `runbook` | Step-by-step operational procedures | gold/silver |
| `playbook` | Incident response playbooks | gold |
| `incident` | Post-mortem reports | silver |
| `architecture` | System design documents | silver/gold |
| `standard` | Coding and API standards | gold |

### Auto-Creation

When you upload a file with keywords like `runbook`, `playbook`, `incident`, or `postmortem` in the filename, the system **automatically creates an OKF entry** alongside the ChromaDB vector index — giving you dual-path retrieval from a single upload.

---

## 12. Security Model

| Threat | Mitigation |
|---|---|
| Unauthorized API access | Bearer token auth (`API_KEY` env var) |
| Token leakage in logs | GitHub token masked in all log output and error messages |
| SSRF via GitHub URL | Strict regex: `^https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/?$` |
| Path traversal in uploads | Filename sanitized with `Path(raw).name` |
| OOM via large file | Streamed to disk in 64 KB chunks; size rejected before full read |
| Duplicate data explosion | SHA-256 content hash — HTTP 409 on duplicate |
| Token budget explosion | Extracted text capped at 500k chars; LLM context at 5,500 chars |
| Prompt injection | System prompt is hardcoded server-side — users cannot override it |
| Rate abuse | SlowAPI: 20/min chat, 5/min upload, 3/min GitHub |

---

## 13. Observability

### Health Check

```bash
curl http://localhost:8000/health
```

```json
{
  "status": "ok",
  "version": "2.0.0",
  "llm_model": "llama-3.3-70b-versatile",
  "chromadb": { "status": "ok", "chunks": 2847 },
  "okf": { "status": "ok", "documents": 12 }
}
```

### LangSmith Tracing

```env
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=ls__your_key
LANGCHAIN_PROJECT=engineer-hub-v2
```

Every `stream_answer` call is decorated with `@traceable` — your LangSmith dashboard shows full input/output traces, latency, and token usage.

---

## 14. Contributing

### Adding a New OKF Document Type

1. Add the type to `okf_writer.py` type mappings
2. Create a subdirectory under `knowledge/`
3. Add routing to `routers/knowledge.py`
4. Update the `OKFCreateForm.jsx` dropdown

### Extending the Retrieval Pipeline

The pipeline in `services/retrieval.py` is modular:
1. Implement `async def your_search(question: str) -> List[RetrievalResult]`
2. Run it as an `asyncio.Task` in parallel with the existing pipeline
3. Merge and deduplicate using `_content_key()`

---

<p align="center">
  Built with ❤️ for engineering teams who deserve better than Ctrl+F.<br/>
  <a href="https://github.com/Het2518/Engineer-Hub-Intelligence-Platform">GitHub</a> ·
  <a href="http://localhost:8000/docs">API Docs</a> ·
  <a href="http://localhost:8000/health">Health</a>
</p>
