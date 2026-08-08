---
type: Runbook
title: "Service Deploy & Emergency Hotfix"
description: "Procedures for deploying code and applying emergency hotfixes to production"
tags: [deploy, hotfix, kubernetes, production, ci-cd]
timestamp: 2026-08-07T00:00:00Z
provenance:
  source: "DevOps Team"
trust:
  author: "devops-team"
  verified: true
---

# Service Deploy & Emergency Hotfix

## Standard Deploy

### Steps
1. Merge PR to `main` branch — CI/CD pipeline auto-deploys to staging
2. Verify staging: `GET https://staging.api.internal/health`
3. Promote to production: `gh workflow run deploy-production.yml`
4. Monitor for 15 minutes post-deploy

## Emergency Hotfix (Break-Glass)

### When to Use
P0/P1 incidents requiring a code fix outside the normal release cycle.

### Steps

```bash
# 1. Create hotfix branch from production tag
git checkout -b hotfix/TICKET-123 $(git describe --tags --abbrev=0)

# 2. Apply the fix, commit with conventional commit format
git commit -m "fix: resolve critical auth bypass (TICKET-123)"

# 3. Push and open PR — request emergency review
git push origin hotfix/TICKET-123

# 4. After approval, deploy directly
kubectl set image deployment/<service> <container>=<image>:<hotfix-tag> -n production

# 5. Verify deployment rollout
kubectl rollout status deployment/<service> -n production
```

## Related
- [Database Rollback](./db-rollback.md)
- [Incident Response Playbook](../playbooks/incident-response.md)
