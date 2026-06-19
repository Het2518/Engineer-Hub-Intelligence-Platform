# Platform Architecture Overview

## System Overview

Our platform is a microservices-based architecture deployed on AWS EKS (Elastic Kubernetes Service). Services communicate via REST APIs and an async event bus (Apache Kafka).

---

## Core Services

### API Gateway
- **Technology:** Kong Gateway
- **Role:** Single entry point for all external traffic
- **Responsibilities:** Rate limiting, authentication, routing, SSL termination
- **Upstream services:** All internal microservices

### Auth Service
- **Technology:** Python (FastAPI)
- **Database:** PostgreSQL (user store), Redis (sessions/tokens)
- **Role:** JWT issuance, OAuth, session management
- **Port:** 8080

### User Service
- **Technology:** Node.js (Express)
- **Database:** PostgreSQL (`users_db`)
- **Role:** User profiles, preferences, account management
- **Port:** 3001

### Payment Service
- **Technology:** Python (FastAPI)
- **Database:** PostgreSQL (`payments_db`), Redis (idempotency keys)
- **External integrations:** Stripe API, PayPal API
- **Role:** Payment processing, refunds, billing
- **Port:** 8082
- **Queue:** Kafka topic `payment-events`

### Order Service
- **Technology:** Java (Spring Boot)
- **Database:** PostgreSQL (`orders_db`)
- **Cache:** Redis
- **Role:** Order lifecycle management, inventory coordination
- **Port:** 8083
- **Queue:** Consumes `payment-events`, produces `order-events`

### Notification Service
- **Technology:** Node.js
- **Queue:** Consumes `order-events`, `payment-events`
- **External:** SendGrid (email), Twilio (SMS), Firebase (push)
- **Role:** Email, SMS, push notification delivery
- **Port:** 3002

### Billing Service
- **Technology:** Python (FastAPI)
- **Database:** PostgreSQL (`billing_db`)
- **Role:** Invoice generation, subscription management
- **Port:** 8084
- **Queue:** Consumes `payment-events`

### Analytics Service
- **Technology:** Python
- **Database:** ClickHouse (OLAP)
- **Role:** Business metrics, dashboards, reporting
- **Port:** 8085

---

## Data Flow

### Payment Flow
```
User → API Gateway → Payment Service → Stripe API
                                     → PostgreSQL (payments_db)
                                     → Kafka (payment-events)
                                           ↓
                              ┌─────────────────────────┐
                              │   Order Service         │
                              │   Billing Service       │
                              │   Notification Service  │
                              └─────────────────────────┘
```

### Authentication Flow
```
User → API Gateway → Auth Service → PostgreSQL (users)
                                  → Redis (sessions)
                   ← JWT Token ←
```

---

## Infrastructure

### Kubernetes
- **Cluster:** AWS EKS, 3 node groups
- **Namespaces:** `auth-service`, `payment-service`, `order-service`, `notification-service`, `billing-service`, `monitoring`
- **Service mesh:** Istio (mTLS between services)

### Databases
| Service | Database | Type | Host |
|---------|----------|------|------|
| Auth | users_db | PostgreSQL 15 | rds-auth.internal |
| User | users_db | PostgreSQL 15 | rds-users.internal |
| Payment | payments_db | PostgreSQL 15 | rds-payments.internal |
| Order | orders_db | PostgreSQL 15 | rds-orders.internal |
| Billing | billing_db | PostgreSQL 15 | rds-billing.internal |
| Analytics | analytics | ClickHouse | clickhouse.internal |

### Message Queue
- **Technology:** Apache Kafka (MSK)
- **Topics:**
  - `payment-events` — Payment completed/failed/refunded
  - `order-events` — Order created/updated/cancelled
  - `user-events` — User created/updated/deleted

### Cache
- **Technology:** Redis (ElastiCache)
- **Usage:** Sessions, rate limiting, idempotency keys, query caching
- **TTL Strategy:** Sessions: 7 days, Rate limits: sliding window, Idempotency: 24h

### CDN & Storage
- **CDN:** CloudFront
- **Object Storage:** S3 (user uploads, invoice PDFs, audit logs)

---

## Monitoring & Observability

- **Metrics:** Prometheus + Grafana
- **Logging:** Fluentd → OpenSearch
- **Tracing:** Jaeger (distributed tracing)
- **Alerting:** PagerDuty (SEV-1/2), Slack (#alerts channel for SEV-3/4)
- **Dashboards:** Grafana Cloud

---

## Deployment

- **CI/CD:** GitHub Actions → ECR → ArgoCD
- **Strategy:** Rolling updates (default), Blue/Green for payment service
- **Environments:** dev → staging → production
- **Rollback:** ArgoCD rollback (automated on error rate > 5%)

---

## Service Communication

| From | To | Protocol | Auth |
|------|----|----------|------|
| API Gateway | All services | REST/HTTP | JWT |
| Services (sync) | Other services | REST/HTTP | mTLS (Istio) |
| Services (async) | Kafka | Kafka protocol | SASL/SCRAM |
| Payment Service | Stripe | HTTPS | API Key |
| Notification Service | SendGrid | HTTPS | API Key |
