---
type: Index
title: "Engineering Knowledge Base"
description: "Canonical engineering knowledge bundle — runbooks, playbooks, incident history, architecture, and standards. OKF v0.2 compliant."
tags: [engineering, knowledge-base, canonical]
timestamp: 2026-08-07T00:00:00Z
---

# Engineering Knowledge Base

This is the **OKF-compliant** (Open Knowledge Format v0.2) knowledge bundle for the AI Research Assistant.
All documents here are **canonical, human-verified sources of truth** — they take priority over uploaded documents in retrieval.

## Categories

- [Runbooks](./runbooks/index.md) — Step-by-step operational procedures for common tasks
- [Playbooks](./playbooks/index.md) — Incident response and escalation guides
- [Incidents](./incidents/index.md) — Post-mortem reports and incident history
- [Architecture](./architecture/index.md) — System design, service maps, and infrastructure docs
- [Standards](./standards/index.md) — Engineering standards, API contracts, and coding conventions

## How to Add Knowledge

1. Choose the right category above
2. Create a new `.md` file in the category directory
3. Add the required YAML frontmatter (see any existing file as a template)
4. Fill in the `type`, `title`, `description`, `tags`, and `timestamp` fields
5. Write the content in Markdown
6. Cross-link to related documents using standard `[text](./path.md)` syntax

> The AI assistant reads this knowledge bundle with **higher trust** than uploaded PDFs or GitHub repositories.
> Documents marked `trust.verified: true` are served with **100% confidence** for matching queries.
