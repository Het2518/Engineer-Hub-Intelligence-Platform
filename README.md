# 🧠 Engineer Hub — AI Research Assistant v2

> **Hybrid OKF + Multi-RAG** engineering knowledge platform — deterministic retrieval from structured knowledge docs, augmented by semantic vector search.

---

## ✨ What's New in V2

| Feature | Description |
|---------|-------------|
| **OKF Layer** | Google's Open Knowledge Format — Markdown + YAML docs served before RAG |
| **Hybrid Retrieval** | OKF runs in parallel with ChromaDB; OKF results scored 1.2× higher |
| **Knowledge Studio** | Full CRUD UI at `/knowledge` — create, browse, edit OKF documents |
| **Session Management** | Delete and rename chat sessions from the sidebar |
| **Thinking Indicator** | Live OKF/RAG source counts displayed while the LLM retrieves context |
| **Dark Navy UI** | Complete V2 design system with glassmorphism and micro-animations |
| **No Docker** | Local-first — just Python venv + Node. No containers required. |

### ⚡ Engine Optimizations (v2.1 Major Updates)
- **Zero-Hallucination Retrieval**: Disabled the experimental HyDE (Hypothetical Document Embeddings) step. By directly using the user's exact query for semantic search, we cut retrieval latency by 2.5s and eliminated the risk of the LLM hallucinating bad search vectors.
- **Robust RRF Pipeline**: Disabled the overly strict MS-MARCO Cross-Encoder re-ranking phase. The Cross-Encoder penalized casually phrased prompts (e.g. asking about a personal resume). The pipeline now purely relies on highly-robust Reciprocal Rank Fusion (RRF) which perfectly marries exact keyword matches (BM25) with semantic vector similarities, guaranteeing personal documents and resumes are instantly found.
- **Realistic Confidence Normalization**: Built a custom dynamic normalization algorithm for RRF scores. Previously, Cross-Encoder logits caused relevant documents to falsely display a "0%" confidence. RRF scores are now properly normalized to display realistic `0-99%` confidence percentages (e.g., a top hit shows as 95%).
- **Silky Smooth UI Engine**: Re-engineered the frontend streaming handler. High-speed LLM APIs (like Groq) were pushing hundreds of tokens per second, choking `react-markdown` and freezing the user's browser. We implemented a 20fps invisible state-batching queue that effortlessly catches the stream and smoothly unrolls it onto the screen with a premium blinking AI cursor (`▋`).
- **Premium Sources Layout**: Redesigned the chat UI to display retrieved knowledge sources in a sleek, horizontally-scrollable compact row immediately *above* the AI's streaming answer, mirroring industry-standard RAG interfaces.

---

## 🏗️ Architecture

```
User Query
    │
    ▼
┌─────────────────────────────────┐
│         Hybrid Retrieval        │
│  ┌──────────────┐  ┌─────────┐  │
│  │  OKF Reader  │  │ChromaDB │  │
│  │ (Deterministic)│ │  (RAG)  │  │
│  │  score × 1.2x│  │         │  │
│  └──────┬───────┘  └────┬────┘  │
│         └──────┬─────────┘       │
│              merge + rank        │
└─────────────────┬───────────────┘
                  │
                  ▼
         LLM (Groq · Llama 3.3 70B)
                  │
                  ▼
           Streaming Answer
```

---

## 🚀 Quick Start

### 1. Clone & Setup

```bash
git clone <your-repo>
cd AI-Research\ Assistant
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env and add your API key:
# OPENAI_API_KEY=your-groq-key-here   (or OpenAI key)
```

### 3. Install Backend Dependencies

```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
```

### 4. Install Frontend Dependencies

```bash
cd frontend
npm install
```

### 5. Run (Windows — one-click)

```powershell
# From project root:
powershell -ExecutionPolicy Bypass -File start.ps1
```

### 5. Run (Manual)

```bash
# Terminal 1 — Backend
cd backend
venv\Scripts\activate          # Windows
uvicorn main:app --reload --port 8000

# Terminal 2 — Frontend
cd frontend
npm run dev
```

Open **http://localhost:3000** 🎉

---

## 📁 Project Structure

```
AI-Research Assistant/
├── backend/
│   ├── main.py                  ← FastAPI app entry point
│   ├── config.py                ← Settings (env vars)
│   ├── requirements.txt
│   ├── routers/
│   │   ├── chat.py              ← Chat + session management
│   │   ├── upload.py            ← Document ingestion (+ OKF dual-index)
│   │   ├── knowledge.py         ← OKF REST API
│   │   ├── sources.py
│   │   ├── stats.py
│   │   └── github.py
│   ├── services/
│   │   ├── retrieval.py         ← Hybrid OKF + RAG retrieval
│   │   ├── okf_reader.py        ← OKF v0.2 document reader/searcher
│   │   ├── okf_writer.py        ← OKF CRUD + auto-create on upload
│   │   ├── ingestion.py
│   │   ├── chunking.py
│   │   ├── embedding.py
│   │   ├── llm.py
│   │   └── memory.py
│   └── db/
│       ├── chroma.py
│       └── stats_store.py
│
├── frontend/
│   ├── app/
│   │   ├── chat/page.jsx        ← Chat with ThinkingIndicator
│   │   ├── knowledge/page.jsx   ← Knowledge Studio
│   │   ├── upload/page.jsx
│   │   ├── admin/page.jsx       ← V2 Dashboard
│   │   └── globals.css          ← Dark navy design system
│   ├── components/
│   │   ├── layout/Sidebar.jsx   ← V2 sidebar + session delete
│   │   ├── chat/
│   │   │   ├── MessageList.jsx  ← OKF-aware source split
│   │   │   ├── MessageInput.jsx
│   │   │   ├── SourceCard.jsx   ← OKF shield badge
│   │   │   └── ThinkingIndicator.jsx
│   │   └── knowledge/
│   │       ├── OKFDocumentCard.jsx
│   │       ├── OKFDocumentViewer.jsx
│   │       └── OKFCreateForm.jsx
│   └── hooks/useChat.js         ← Thinking state + OKF source counts
│
├── knowledge/                   ← OKF v0.2 Knowledge Bundle
│   ├── index.md
│   ├── runbooks/
│   │   ├── db-rollback.md
│   │   └── deploy-hotfix.md
│   ├── playbooks/
│   │   └── incident-response.md
│   ├── incidents/
│   │   └── 2026-q2-db-outage.md
│   ├── architecture/
│   │   └── system-overview.md
│   └── standards/
│       └── api-versioning.md
│
├── start.ps1                    ← Windows one-click launcher
└── .env.example
```

---

## 📚 OKF Knowledge Bundle

The `knowledge/` directory follows [Google's Open Knowledge Format (OKF) v0.2](https://cloud.google.com/blog/).

Each document is a Markdown file with YAML frontmatter:

```markdown
---
title: "Database Rollback Procedure"
type: Runbook
tags: [database, rollback, oncall]
description: "Step-by-step guide to safely roll back a failed DB migration."
trust:
  verified: true
  author: "platform-team"
---

## Steps
1. ...
```

### Supported types
| Type | Description |
|------|-------------|
| `Runbook` | Step-by-step operational procedures |
| `Playbook` | Incident response guides |
| `IncidentReport` | Post-mortems and outage logs |
| `Architecture` | System design docs |
| `Standard` | Engineering conventions/policies |
| `Metric` | KPIs and dashboards |

---

## 🌐 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | System health check |
| `POST` | `/chat` | Chat with SSE streaming |
| `GET` | `/chat/sessions` | List sessions |
| `DELETE` | `/chat/sessions/{id}` | Delete session |
| `PATCH` | `/chat/sessions/{id}` | Rename session |
| `POST` | `/upload` | Upload + dual-index document |
| `GET` | `/knowledge/` | List OKF documents |
| `GET` | `/knowledge/stats` | OKF bundle statistics |
| `GET` | `/knowledge/search?q=...` | Search OKF bundle |
| `GET` | `/knowledge/{id}` | Get OKF document |
| `POST` | `/knowledge/` | Create OKF document |
| `PUT` | `/knowledge/{id}` | Update OKF document |
| `DELETE` | `/knowledge/{id}` | Delete OKF document |
| `POST` | `/knowledge/reload` | Force-reload OKF cache |

Full interactive docs at **http://localhost:8000/docs**

---

## ⚙️ Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | required | Groq or OpenAI API key |
| `OPENAI_BASE_URL` | `https://api.groq.com/openai/v1` | LLM provider base URL |
| `OPENAI_CHAT_MODEL` | `llama-3.3-70b-versatile` | Chat model |
| `OKF_ENABLED` | `true` | Enable OKF layer |
| `OKF_TRUST_BOOST` | `1.2` | OKF score multiplier vs RAG |
| `OKF_MIN_SCORE` | `0.25` | Minimum OKF relevance score |
| `MULTI_QUERY_ENABLED` | `true` | Generate query variations |
| `CRAG_ENABLED` | `true` | Corrective RAG quality gate |

---

## 🔑 Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 · React 19 · Tailwind CSS v4 |
| Backend | FastAPI · Python 3.12+ |
| Vector DB | ChromaDB (local, persistent) |
| Knowledge | OKF v0.2 (Markdown + YAML) |
| LLM | Groq · Llama 3.3 70B (or OpenAI GPT-4o) |
| Embeddings | OpenAI `text-embedding-3-small` |
| Auth | Optional Bearer token |

---

*Built with ❤️ — Engineer Hub Intelligence Platform v2.0*
