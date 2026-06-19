# Authentication Service Documentation

## Overview

The Authentication Service is the central identity and access management system for our platform. It handles user registration, login, session management, and OAuth integrations.

**Service Owner:** Platform Team  
**Deployed on:** Kubernetes (EKS) — `auth-service` namespace  
**Repository:** github.com/org/auth-service  
**Port:** 8080  

---

## Architecture

```
Client → API Gateway → Auth Service → PostgreSQL (users)
                                    → Redis (sessions/tokens)
                                    → OAuth Providers (Google, GitHub)
```

The auth service sits behind the API Gateway and is responsible for:
- Issuing JWT access tokens (15-minute expiry)
- Issuing refresh tokens (7-day expiry, stored in Redis)
- Validating tokens on behalf of downstream services
- Managing OAuth 2.0 flows for social login

---

## Authentication Flow

### Standard Login (Email/Password)

1. Client sends `POST /auth/login` with `{email, password}`
2. Auth Service queries PostgreSQL to fetch user record
3. Validates bcrypt-hashed password
4. Issues JWT access token (signed with RS256 private key)
5. Issues refresh token, stored in Redis with TTL of 7 days
6. Returns `{access_token, refresh_token, expires_in: 900}`

### OAuth 2.0 Flow (Google/GitHub)

1. Client redirects to `GET /auth/oauth/{provider}/authorize`
2. Auth service redirects to OAuth provider
3. Provider redirects back to `/auth/oauth/{provider}/callback` with code
4. Auth service exchanges code for provider access token
5. Fetches user profile from provider
6. Creates or updates user record in PostgreSQL
7. Issues JWT + refresh token, same as standard login

---

## Token Structure

### Access Token (JWT)

```json
{
  "sub": "user-uuid-here",
  "email": "user@example.com",
  "roles": ["engineer", "admin"],
  "iat": 1716678400,
  "exp": 1716679300,
  "iss": "auth.internal.org"
}
```

### Token Validation

Other services validate tokens by:
1. Calling `GET /auth/validate` with the Bearer token, OR
2. Using the public JWKS endpoint `GET /.well-known/jwks.json` for local validation

---

## Token Expiration & Refresh

- Access Token: **15 minutes**
- Refresh Token: **7 days**
- Refresh endpoint: `POST /auth/refresh` with `{refresh_token}`
- Refresh tokens are rotated on every use (sliding window)
- Revoked tokens are stored in a Redis blocklist

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_PRIVATE_KEY` | RS256 private key (PEM) |
| `JWT_PUBLIC_KEY` | RS256 public key (PEM) |
| `GOOGLE_CLIENT_ID` | Google OAuth app client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth app secret |
| `GITHUB_CLIENT_ID` | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth app secret |

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /auth/login | Standard email/password login |
| POST | /auth/register | New user registration |
| POST | /auth/logout | Revoke refresh token |
| POST | /auth/refresh | Refresh access token |
| GET | /auth/validate | Validate access token |
| GET | /auth/oauth/{provider}/authorize | Start OAuth flow |
| GET | /auth/oauth/{provider}/callback | OAuth callback |
| GET | /.well-known/jwks.json | Public key set |

---

## Rate Limiting

- Login attempts: **5 per minute per IP**
- Registration: **10 per hour per IP**
- Token refresh: **60 per hour per user**
- Implemented using Redis sliding window counters

---

## Security Considerations

- Passwords hashed with bcrypt (cost factor 12)
- Tokens signed with RS256 (asymmetric)
- Refresh tokens are single-use and rotated
- All endpoints served over HTTPS only
- CORS restricted to whitelisted domains
- SQL injection prevented via parameterized queries

---

## Deployment

```yaml
# Kubernetes deployment snippet
apiVersion: apps/v1
kind: Deployment
metadata:
  name: auth-service
  namespace: auth-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: auth-service
  template:
    spec:
      containers:
        - name: auth-service
          image: org/auth-service:v2.4.1
          ports:
            - containerPort: 8080
          resources:
            requests:
              cpu: "100m"
              memory: "256Mi"
            limits:
              cpu: "500m"
              memory: "512Mi"
```

---

## On-Call Runbook

If the auth service is down:
1. Check pod status: `kubectl get pods -n auth-service`
2. Check logs: `kubectl logs -n auth-service -l app=auth-service`
3. Verify PostgreSQL connectivity
4. Verify Redis connectivity
5. If token validation is failing, check JWT key rotation in Vault
6. Escalate to Platform Team (#platform-oncall) if unresolved after 15 min
