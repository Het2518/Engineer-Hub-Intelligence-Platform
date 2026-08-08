---
description: 'Auto-generated from uploaded file: DataDesk_Complete_Documentation.md'
provenance:
  ingestion: auto-upload
  source: DataDesk_Complete_Documentation.md
tags:
- documentation
timestamp: '2026-08-08T09:13:22Z'
title: Datadesk Complete Documentation
trust:
  author: auto-ingestion
  verified: false
type: Standard
---

# DataDesk — Complete Technical & Feature Documentation

> A full-stack SQL practice platform with real-time query execution, AI tutoring, gamification, and a community discussion system. Built on React + Vite (frontend) and Node.js + Express + MongoDB (backend).

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Application Architecture](#2-application-architecture)
3. [Deployment Infrastructure](#3-deployment-infrastructure)
4. [Authentication System (Deep Dive)](#4-authentication-system-deep-dive)
5. [Security Layers](#5-security-layers)
6. [Backend API Reference](#6-backend-api-reference)
7. [Database Models](#7-database-models)
8. [Frontend Pages & Routing](#8-frontend-pages--routing)
9. [Feature Deep Dives](#9-feature-deep-dives)
10. [AI Integration (Groq)](#10-ai-integration-groq)
11. [Gamification System](#11-gamification-system)
12. [State Management](#12-state-management)
13. [UI Design System](#13-ui-design-system)

---

## 1. Project Overview

**DataDesk** is a full-featured SQL learning and interview preparation platform. Users can practice SQL queries across multiple real-world database schemas (ecommerce, movies, hospital, etc.), receive instant feedback, get AI-powered hints, and compete on a global leaderboard.

### Key Capabilities

| Capability | Description |
|---|---|
| **In-browser SQL Execution** | Runs SQLite queries entirely in the browser via a WebAssembly worker. No server round-trips for SQL. |
| **AI Tutor** | Powered by Groq (Llama 3.1 8B). Provides hints, validates solutions, and generates reference solutions. |
| **Progress Sync** | User progress is persisted on the server and synced to the browser on login. |
| **Gamification** | XP, daily streaks, badges, ELO rating, and a global leaderboard. |
| **ER Diagram Viewer** | Interactive schema diagram built with React Flow + Dagre auto-layout. |
| **Community Discussions** | Per-question comment threads with upvotes. |
| **Company Interview Prep** | Filter questions by company (Google, Meta, Amazon, etc.). |
| **Custom Dataset Sandbox** | Upload your own CSV/SQLite data and practice with it. |
| **Interview Simulator** | AI-powered mock interview with graded questions. |

---

## 2. Application Architecture

```
sql-practice-platform/
├── frontend/               ← React + Vite SPA
│   ├── src/
│   │   ├── pages/          ← Top-level route pages
│   │   ├── features/       ← Feature-grouped components
│   │   │   ├── ai/         ← AI Hint, Tutor, Solution Review panels
│   │   │   ├── gamification/   ← Leaderboard modal, badge display
│   │   │   ├── practice/   ← Question card, editor, results panel
│   │   │   ├── profile/    ← Profile view, settings modal
│   │   │   └── visualizers/    ← ER Diagram, charts, execution plan
│   │   ├── hooks/          ← useAuth, useQueryExecution, useFocusTrap
│   │   ├── stores/         ← Zustand global state stores
│   │   ├── lib/            ← Axios API client, Groq client
│   │   ├── data/           ← Static question bank and DB schemas
│   │   ├── shared/ui/      ← Header, Button, ToastSystem
│   │   └── styles/         ← Global CSS, CSS variables, per-page CSS
│   └── vercel.json         ← SPA rewrite rule for Vercel deployment
│
└── backend/                ← Node.js + Express REST API
    ├── server.js           ← Entry point, middleware setup, route mounting
    └── src/
        ├── config/         ← MongoDB connection, environment validation
        ├── controllers/    ← Business logic (auth, progress, comments...)
        ├── middleware/      ← Auth (JWT), CSRF, rate limiting, validation
        ├── models/         ← Mongoose schemas (User, UserProgress, etc.)
        ├── routes/         ← Route definitions
        └── utils/          ← JWT helpers, API response helpers
```

### Data Flow Diagram

```
Browser (React)
    │
    ├── SQL Query  ──► sql.js WebAssembly Worker ──► Result (local, instant)
    │
    └── API Call ──► Axios (with CSRF header + HttpOnly cookie)
                         │
                         ▼
                 Express API (Render)
                         │
                         ├── CSRF Middleware   (validates X-CSRF-Token header)
                         ├── Auth Middleware   (validates JWT from cookie)
                         ├── Rate Limiter      (per-IP request throttling)
                         └── MongoDB (Atlas)   (persists users, progress)
```

---

## 3. Deployment Infrastructure

| Service | Platform | URL |
|---|---|---|
| **Frontend** | Vercel | `sql-practice-sepia.vercel.app` |
| **Backend API** | Render | `datadesk-backend.onrender.com` |
| **Database** | MongoDB Atlas | Cluster: `wi6d2qp.mongodb.net` |

### Frontend Deploy (Vercel)
- Every `git push` to `main` triggers an automatic Vercel build.
- `vercel.json` contains a catch-all rewrite (`/(.*) → /index.html`) so that React Router can handle all page routes client-side. Without this, directly visiting `/profile` or `/practice/ecommerce` would return a Vercel `

---
*Content truncated at 5,000 chars. Full document is indexed in the vector knowledge base. Edit this file to add curated content and set `trust.verified: true`.*