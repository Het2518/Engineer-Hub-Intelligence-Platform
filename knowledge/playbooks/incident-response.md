---
type: Playbook
title: "Incident Response Playbook"
description: "Standard process for detecting, triaging, resolving, and documenting production incidents"
tags: [incident, oncall, response, escalation, p0, p1, p2]
timestamp: 2026-08-07T00:00:00Z
provenance:
  source: "Engineering Leadership"
trust:
  author: "engineering-leadership"
  verified: true
---

# Incident Response Playbook

## Severity Levels

| Level | Definition | Response Time | Example |
|-------|-----------|--------------|---------|
| **P0** | Complete outage, data loss risk | Immediate (< 5 min) | All users cannot login |
| **P1** | Major feature broken, significant user impact | < 15 min | Payments failing for 30%+ users |
| **P2** | Partial degradation, workaround exists | < 1 hour | Slow API responses |
| **P3** | Minor issue, minimal user impact | Next business day | UI cosmetic bug |

## Response Process

### Step 1: Detect & Declare (0-5 min)
1. Alert fires in PagerDuty / monitoring
2. On-call engineer acknowledges
3. Declare incident severity (P0/P1/P2)
4. Create incident channel: `#incident-YYYY-MM-DD-description`

### Step 2: Triage (5-15 min)
1. Identify the blast radius: How many users affected?
2. Identify the failing component (service, database, third-party API?)
3. Check recent deploys: `git log --since="2 hours ago"`
4. Check relevant dashboards and logs

### Step 3: Communicate
```
[INCIDENT UPDATE - P{level}]
Time: {timestamp}
Status: Investigating / Identified / Mitigating / Resolved
Impact: {description of user impact}
Current Action: {what you are doing right now}
ETA: {estimated resolution time or "unknown"}
Next Update: {time of next update}
```

### Step 4: Mitigate
- **If recent deploy caused it:** [Rollback the deploy](../runbooks/deploy-hotfix.md)
- **If database issue:** [Database Rollback](../runbooks/db-rollback.md)
- **If third-party API:** Enable circuit breaker / fallback mode

### Step 5: Resolve & Post-Mortem
1. Confirm resolution — monitor for 30 min after fix
2. Post final update in incident channel
3. Schedule post-mortem within 48 hours
4. Document in [Incidents log](../incidents/index.md)

## Escalation Path
```
On-Call Engineer → Tech Lead → Engineering Manager → CTO
(15 min no progress) → (30 min P0/P1) → (1 hour P0)
```

## Related
- [Database Rollback](../runbooks/db-rollback.md)
- [Deploy & Hotfix](../runbooks/deploy-hotfix.md)