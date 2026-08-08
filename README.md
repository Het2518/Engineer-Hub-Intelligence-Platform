<div align="center">

# Axioms

**Ask anything. Get answers grounded in your own engineering knowledge.**

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![Groq](https://img.shields.io/badge/LLM-Groq%20%2F%20Llama%203.3-f55036?style=flat-square)](https://groq.com)
[![ChromaDB](https://img.shields.io/badge/Vector%20DB-ChromaDB-orange?style=flat-square)](https://www.trychroma.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

</div>

---

Axioms is a self-hosted AI research assistant for engineering teams. Upload your runbooks, incident reports, architecture docs, and GitHub repos — then ask questions and get cited, grounded answers in seconds. No hallucinations. No data leaves your machine.

---

## Why Axioms?

Engineers spend 25–40% of their day hunting for information scattered across Notion, Confluence, GitHub, Slack, and Google Drive. On-call incidents get worse because the right runbook is buried somewhere no one can find at 3 AM.

Axioms fixes that. One place. Natural language. Instant, cited answers.

| | Generic AI (ChatGPT, Claude) | Axioms |
|---|:---:|:---:|
| Uses your private docs | ✗ | ✓ |
| Cites source files | ✗ | ✓ |
| Fully self-hosted | ✗ | ✓ |
| Persistent session memory | ✗ | ✓ |
| No hallucinations | ✗ | ✓ |

---

## How It Works

```
Your Question
     │
     ▼
Query Rewriter        ← makes follow-up questions self-contained
     │
     ├──────────────────────────┐
     ▼                          ▼
Vector Search (ChromaDB)    OKF Knowledge Layer
BM25 Keyword Search         (deterministic, high-trust docs)
     │                          │
     └──────────┬───────────────┘
                ▼
        RRF Score Fusion
        MMR Re-ranking
        Confidence Filtering   ← drops low-relevance chunks
                │
                ▼
         Groq LLM (Llama 3.3 70B)
         Streamed · Cited · Grounded
```

The **OKF (Open Knowledge Format) layer** gives structured docs like runbooks and post-mortems a 1.2× trust boost over raw vector results — so your most reliable knowledge always surfaces first.

---

## Features

- 💬 **Streaming chat** with session memory — follow-up questions just work
- 📄 **Document upload** — PDF, DOCX, Markdown, CSV, images (up to 50 MB)
- 🐙 **GitHub indexer** — index any public or private repository by URL
- 📚 **Knowledge Studio** — create and manage structured OKF documents in-browser
- 🔍 **Hybrid search** — vector + BM25 + RRF fusion + MMR diversity re-ranking
- 📎 **File-in-chat** — attach a file for ephemeral context without indexing it
- 🛡️ **Anti-hallucination** — multi-stage confidence filtering before every LLM call
- 📊 **Admin dashboard** — query counts, response times, document stats
- ⚡ **No Docker** — runs entirely on your local machine with one command

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 16, React 19, Vanilla CSS |
| **Backend** | FastAPI, Python 3.11+ |
| **LLM** | Groq API — `llama-3.3-70b-versatile` |
| **Embeddings** | `all-MiniLM-L6-v2` (runs locally, no API cost) |
| **Vector DB** | ChromaDB (local filesystem, no Docker) |
| **Keyword search** | BM25 (`rank-bm25`) |
| **Memory** | SQLite with WAL mode (async-safe) |
| **Doc parsing** | pypdf, python-docx, Pillow, markdown |
| **Observability** | LangSmith tracing, structlog |

---

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- Free [Groq API key](https://console.groq.com)

### 1 — Clone & configure

```bash
git clone https://github.com/Het2518/Engineer-Hub-Intelligence-Platform.git
cd Engineer-Hub-Intelligence-Platform
cp .env.example backend/.env
```

Open `backend/.env` and set:

```env
GROQ_API_KEY=gsk_your_key_here
```

### 2 — Launch (Windows)

```powershell
.\start.ps1
```

That's it. The script installs frontend deps on first run, then starts both services.

| Service | URL |
|---|---|
| App | http://localhost:3000 |
| API | http://localhost:8000 |
| Swagger | http://localhost:8000/docs |
| Health | http://localhost:8000/health |

### 2 — Launch (manual)

```bash
# Backend
cd backend && pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend && npm install && npm run dev
```

### 3 — Start using it

1. Go to **`/upload`** → drop in your runbooks, PDFs, or Markdown docs
2. Go to **`/chat`** → ask a question
3. Optionally, go to **`/github`** → index a GitHub repo by URL

---

## Project Structure

```
├── backend/
│   ├── main.py                 # FastAPI app entry point
│   ├── config.py               # All settings (Pydantic, env-driven)
│   ├── routers/
│   │   ├── chat.py             # POST /chat + session management
│   │   ├── upload.py           # POST /upload
│   │   ├── github.py           # POST /github-index
│   │   ├── knowledge.py        # OKF CRUD
│   │   └── stats.py            # GET /stats
│   └── services/
│       ├── retrieval.py        # Hybrid search pipeline
│       ├── llm.py              # LLM streaming + context building
│       ├── memory.py           # SQLite conversation history
│       ├── query_rewriter.py   # Follow-up question rewriting
│       ├── embedding.py        # Local sentence-transformer
│       ├── ingestion.py        # Text extraction
│       ├── okf_reader.py       # OKF bundle reader
│       └── okf_writer.py       # OKF doc generator
│
├── frontend/
│   ├── app/                    # Next.js pages (chat, upload, knowledge, admin)
│   ├── components/             # Chat bubbles, SourceCard, CodeBlock, Sidebar
│   └── hooks/useChat.js        # SSE streaming + session state
│
├── knowledge/                  # OKF knowledge bundle (Markdown + frontmatter)
│   ├── architecture/
│   ├── incidents/
│   ├── playbooks/
│   ├── runbooks/
│   └── standards/
│
├── .env.example                # All environment variable documentation
└── start.ps1                   # One-click launcher (Windows)
```

---

## API Reference

### Chat

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/chat` | Ask a question (streaming SSE or batch) |
| `GET` | `/chat/sessions` | List all sessions |
| `GET` | `/chat/sessions/{id}` | Load session history |
| `DELETE` | `/chat/sessions/{id}` | Delete a session |
| `PATCH` | `/chat/sessions/{id}` | Rename a session |
| `POST` | `/chat/parse-file` | Extract text for ephemeral context |

**SSE stream events:** `thinking` → `sources` → `token` (×N) → `done`

### Ingestion & Knowledge

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/upload` | Index a document |
| `POST` | `/github-index` | Index a GitHub repo |
| `GET` | `/sources` | List indexed documents |
| `CRUD` | `/knowledge` | OKF Knowledge Studio |

### System

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | ChromaDB + OKF + LLM status |
| `GET` | `/stats` | Usage statistics |

---

## Configuration

Key variables in `backend/.env`:

| Variable | Default | Description |
|---|---|---|
| `GROQ_API_KEY` | **required** | Groq API key |
| `LLM_CHAT_MODEL` | `llama-3.3-70b-versatile` | Model name |
| `GITHUB_TOKEN` | *(empty)* | For private repo indexing |
| `API_KEY` | *(empty)* | Bearer auth (leave empty to disable) |
| `OKF_ENABLED` | `true` | Deterministic knowledge layer |
| `OKF_TRUST_BOOST` | `1.2` | Score multiplier for OKF docs |
| `LANGCHAIN_TRACING_V2` | `false` | LangSmith observability |

See `.env.example` for the full list.

---

## Security

- **No token leakage** — GitHub tokens are masked in all logs and errors
- **SSRF protection** — GitHub URLs validated against strict regex before any network call
- **Path traversal prevention** — uploaded filenames are sanitized server-side
- **Duplicate detection** — SHA-256 content hash blocks re-indexing the same file
- **Rate limiting** — 20/min chat · 5/min upload · 3/min GitHub indexing
- **Grounded LLM** — hardcoded system prompt enforces citation and honesty rules

---

<div align="center">

Built for engineers who deserve better than Ctrl+F.

[GitHub](https://github.com/Het2518/Engineer-Hub-Intelligence-Platform) · [API Docs](http://localhost:8000/docs) · [Health](http://localhost:8000/health)

</div>
