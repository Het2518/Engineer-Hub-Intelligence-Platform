---
type: Standard
title: "API Versioning Standard"
description: "Engineering standard for versioning REST APIs across all services"
tags: [api, versioning, standard, rest, conventions]
timestamp: 2026-08-07T00:00:00Z
provenance:
  source: "Engineering Leadership"
trust:
  author: "engineering-leadership"
  verified: true
---

# API Versioning Standard

## Rule

All REST APIs **must** use URL-path versioning:
```
https://api.example.com/v1/resource
https://api.example.com/v2/resource
```

Header-based and query-param versioning are **not permitted** for public APIs.

## Versioning Policy

| Scenario | Action |
|---------|--------|
| New non-breaking features | Add to current version with no version bump |
| Breaking change (field removal, type change) | Bump major version (v1 → v2) |
| Deprecation | Run both versions for **minimum 6 months** |
| Sunset | 30-day advance notice via changelog + email |

## Deprecation Header

When a version is deprecated, include in response:
```http
Deprecation: true
Sunset: Sat, 01 Jan 2027 00:00:00 GMT
Link: <https://api.example.com/v2/resource>; rel="successor-version"
```

## Breaking vs Non-Breaking Changes

**Non-Breaking (allowed without version bump):**
- Adding new optional fields to responses
- Adding new endpoints
- Adding new optional query parameters

**Breaking (requires new version):**
- Removing or renaming fields
- Changing field types
- Changing HTTP status codes
- Removing endpoints

## Related
- [System Overview](../architecture/system-overview.md)
