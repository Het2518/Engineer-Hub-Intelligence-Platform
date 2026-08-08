---
type: Runbook
title: "Database Rollback Procedure"
description: "Steps to safely rollback a failed database migration in production"
tags: [database, rollback, migration, oncall, production]
resource: ""
timestamp: 2026-08-07T00:00:00Z
provenance:
  source: "Platform Engineering Team"
trust:
  author: "platform-team"
  last_modified: 2026-08-07
  verified: true
---

# Database Rollback Procedure

## When to Use
Use this runbook when a database migration has been applied to production and:
- The service is returning unexpected errors after the migration
- Data integrity checks fail post-migration
- The application fails to start due to schema mismatch

## Prerequisites
- Access to the production database console
- `db-admin` role permissions
- Service is currently degraded or down (this is a break-glass procedure)

## Steps

### 1. Stop affected services to prevent data corruption
```bash
# Scale down the service that uses this database
kubectl scale deployment <service-name> --replicas=0 -n production

# Verify pods are terminated
kubectl get pods -n production | grep <service-name>
```

### 2. Identify the failed migration
```sql
-- Check the most recent migrations applied
SELECT version, applied_at, description
FROM schema_migrations
ORDER BY applied_at DESC
LIMIT 10;
```

### 3. Run the rollback
```bash
# Navigate to the service directory
cd /app/<service-name>

# Rollback one migration step
python manage.py db rollback --steps=1

# Verify the rollback succeeded
python manage.py db current
```

### 4. Verify database integrity
```sql
-- Run these checks specific to your schema
SELECT COUNT(*) FROM <critical_table>;
SELECT * FROM schema_migrations ORDER BY applied_at DESC LIMIT 5;
```

### 5. Restart the service
```bash
kubectl scale deployment <service-name> --replicas=3 -n production

# Monitor startup logs
kubectl logs -f deployment/<service-name> -n production
```

### 6. Validate service health
- Check the service health endpoint: `GET /health`
- Monitor error rates in your observability platform for 10 minutes
- Confirm with the on-call engineer that the rollback is complete

## Post-Rollback
1. Create a post-mortem ticket immediately
2. Notify the team in the incident channel
3. Document the failed migration in the [Incidents log](../incidents/index.md)

## Related
- [Service Deploy & Hotfix](./deploy-hotfix.md)
- [On-Call Escalation Guide](./oncall-escalation.md)
- [Incident Response Playbook](../playbooks/incident-response.md)
