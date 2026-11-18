# ADR-001 — Deterministic simulation before live integrations

**Status:** Accepted for MVP · **Date:** 2026-11-18

## Context

The portfolio objective is to demonstrate architecture governance, business-service impact and technology management decisions. Collecting genuine telemetry requires credentials, tenant access, infrastructure inventory and privacy/security controls. None are appropriate for an open demonstration repository.

## Decision

Build an explainable, zero-dependency static application with synthetic scenario data, pure decision logic, automated tests and a Cloudflare-ready build directory. Keep all assumptions visible and the decision/export engine separate from presentation.

## Consequences

**Advantages:** reproducibility, no provider lock-in at the model layer, no billable database, no real secrets, predictable test fixtures and straightforward source review.

**Trade-offs:** no production observability, no dynamic topology discovery, no remote persistence, no real RTO or availability measurements. A higher-fidelity DR engine will require operational evidence and a significantly richer dependency model.

## Revisit when

A real data source, multi-user workflow, authenticated evidence repository or verified Cloudflare deployment requires a backend. Select Worker services (D1, KV or Durable Objects) only once their consistency and workload needs are demonstrated.
