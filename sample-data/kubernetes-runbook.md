# Kubernetes Troubleshooting Runbook

## Overview

This runbook covers common Kubernetes issues encountered by our engineering team and the steps to diagnose and resolve them.

---

## Common Issues

### 1. Pod in CrashLoopBackOff

**Symptoms:** Pod repeatedly crashes and restarts. `kubectl get pods` shows `CrashLoopBackOff`.

**Diagnosis:**
```bash
# Check pod status
kubectl get pods -n <namespace>

# Check pod events
kubectl describe pod <pod-name> -n <namespace>

# Check container logs (current)
kubectl logs <pod-name> -n <namespace>

# Check previous container logs (before crash)
kubectl logs <pod-name> -n <namespace> --previous
```

**Common Causes & Fixes:**

1. **Application startup failure** — Check environment variables, secrets, and config maps
   ```bash
   kubectl get configmap -n <namespace>
   kubectl get secrets -n <namespace>
   ```

2. **OOMKilled (Out of Memory)** — Increase memory limits in deployment
   ```yaml
   resources:
     limits:
       memory: "512Mi"  # Increase this
   ```

3. **Liveness probe failing** — Check probe configuration and application health endpoint
   ```bash
   kubectl describe pod <pod-name> | grep -A 10 "Liveness"
   ```

---

### 2. Pod Stuck in Pending State

**Symptoms:** Pod status shows `Pending` for extended period.

**Diagnosis:**
```bash
kubectl describe pod <pod-name> -n <namespace>
# Look for: "Insufficient cpu", "Insufficient memory", "no nodes available"
```

**Common Causes & Fixes:**

1. **Insufficient cluster resources** — Scale up node group or reduce resource requests
   ```bash
   kubectl get nodes
   kubectl describe node <node-name> | grep -A 10 "Allocated resources"
   ```

2. **Node selector / affinity mismatch** — Check node labels
   ```bash
   kubectl get nodes --show-labels
   ```

3. **PVC not bound** — Check PersistentVolumeClaim status
   ```bash
   kubectl get pvc -n <namespace>
   ```

---

### 3. Service Not Reachable

**Symptoms:** Service returns connection refused or times out.

**Diagnosis:**
```bash
# Check service
kubectl get svc -n <namespace>

# Check endpoints (should not be empty)
kubectl get endpoints <service-name> -n <namespace>

# Test from inside cluster
kubectl run debug --image=curlimages/curl -it --rm -- curl http://<service-name>.<namespace>.svc.cluster.local:<port>/health
```

**Common Causes:**
- Label selector mismatch between Service and Pod
- Pods not running/ready
- Network policy blocking traffic

---

### 4. High Memory/CPU Usage

**Symptoms:** Pods are consuming more resources than expected.

**Diagnosis:**
```bash
# Check resource usage
kubectl top pods -n <namespace>
kubectl top nodes

# Check HPA (Horizontal Pod Autoscaler)
kubectl get hpa -n <namespace>
kubectl describe hpa <hpa-name> -n <namespace>
```

**Fixes:**
1. Scale up: `kubectl scale deployment <name> --replicas=5 -n <namespace>`
2. Adjust resource limits in deployment spec
3. Check for memory leaks in application logs

---

### 5. Failed Deployment / Rollout Stuck

**Symptoms:** `kubectl rollout status` shows deployment not completing.

**Diagnosis:**
```bash
# Check rollout status
kubectl rollout status deployment/<name> -n <namespace>

# Check deployment events
kubectl describe deployment <name> -n <namespace>

# Check replicaset
kubectl get rs -n <namespace>
```

**Rollback:**
```bash
# Rollback to previous version
kubectl rollout undo deployment/<name> -n <namespace>

# Rollback to specific revision
kubectl rollout undo deployment/<name> --to-revision=3 -n <namespace>

# Check rollout history
kubectl rollout history deployment/<name> -n <namespace>
```

---

### 6. Secret or ConfigMap Not Found

**Symptoms:** Pod fails with error about missing secret or environment variable.

**Fix:**
```bash
# List secrets
kubectl get secrets -n <namespace>

# Create secret from literals
kubectl create secret generic <name> \
  --from-literal=API_KEY=your-key \
  -n <namespace>

# Create from .env file
kubectl create secret generic <name> \
  --from-env-file=.env \
  -n <namespace>
```

---

## Useful One-Liners

```bash
# Get all pods across all namespaces
kubectl get pods -A

# Watch pods in real-time
kubectl get pods -n <namespace> -w

# Delete all failed pods
kubectl delete pods --field-selector=status.phase=Failed -n <namespace>

# Force delete stuck pod
kubectl delete pod <pod-name> -n <namespace> --force --grace-period=0

# Exec into a running container
kubectl exec -it <pod-name> -n <namespace> -- /bin/bash

# Port-forward a service locally
kubectl port-forward svc/<service-name> 8080:8080 -n <namespace>

# View resource quotas
kubectl describe resourcequota -n <namespace>

# Check node conditions
kubectl describe nodes | grep -A 5 "Conditions"
```

---

## Escalation Path

1. **First:** Check this runbook and pod logs
2. **Second:** Check Grafana dashboards for cluster metrics
3. **Third:** Check `#platform-oncall` Slack channel
4. **Fourth:** Page on-call via PagerDuty if SEV-1/2
