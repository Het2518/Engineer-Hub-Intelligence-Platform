---
type: IncidentReport
title: "Q2 2026 Database Outage — Post-Mortem"
description: "45-minute production database outage caused by a failed schema migration. Root cause: missing index on foreign key column."
tags: [incident, postmortem, database, migration, p1, 2026]
timestamp: 2026-06-15T00:00:00Z
provenance:
  source: "Platform Engineering Team"
trust:
  author: "platform-team"
  verified: true
---

# Q2 2026 Database Outage — Post-Mortem

**Severity:** P1  
**Duration:** 45 minutes (14:22 UTC – 15:07 UTC, June 12, 2026)  
**Impact:** ~35% of API requests failing with 500 errors. Write operations fully blocked.

## Timeline

| Time (UTC) | Event |
|-----------|-------|
| 14:15 | Migration `20260612_add_user_profile_index` deployed to production |
| 14:22 | Error rate spikes to 35% — PagerDuty alert fires |
| 14:27 | On-call engineer acknowledges, begins investigation |
| 14:35 | Root cause identified: migration locks `users` table during index creation |
| 14:40 | Decision: rollback migration |
| 14:52 | [Database rollback](../runbooks/db-rollback.md) executed successfully |
| 15:07 | Full service recovery confirmed |

## Root Cause

The migration added an index to the `user_profiles.user_id` foreign key column using `CREATE INDEX` (blocking) instead of `CREATE INDEX CONCURRENTLY` (non-blocking). PostgreSQL holds a full table lock during blocking index creation, causing all write queries to queue and eventually timeout.

## Contributing Factors

1. No staging load test was run before promoting the migration
2. The migration review checklist did not include checking for `CONCURRENTLY` on large tables
3. Rollback procedure was not pre-validated before the release

## Resolution

Applied `CREATE INDEX CONCURRENTLY` in a follow-up migration (deployed 48 hours later with zero downtime).

## Action Items

| Action | Owner | Status |
|--------|-------|--------|
| Add `CONCURRENTLY` check to migration review template | DBA Team | ✅ Done |
| Add staging load test to CI pipeline for migrations | DevOps | 🔄 In Progress |
| Document this pattern in DB standards | Platform | ✅ Done |

## Lessons Learned

- Always use `CREATE INDEX CONCURRENTLY` for large tables in production PostgreSQL
- Pre-validate rollback procedures before every major schema change
- Add observability on migration execution time in production

## Related
- [Database Rollback Runbook](../runbooks/db-rollback.md)
- [Incident Response Playbook](../playbooks/incident-response.md)
