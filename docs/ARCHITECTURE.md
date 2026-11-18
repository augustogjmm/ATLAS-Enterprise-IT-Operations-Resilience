# ATLAS — Architecture and decision model

> **Classification:** synthetic reference implementation; no real business or employer data.

## Purpose

Present enterprise IT complexity in a form that a Head of IT, Infrastructure Manager, Technology Director or architecture governance board can interrogate. The first version is an **explainable simulation**, not a monitoring product.

## Logical layers

```text
Browser (responsive command center)
  ├── Scenario selector and executive KPIs
  ├── Component grouping / dependency view
  ├── Service recovery objective matrix
  ├── Management investment comparisons
  └── Downloadable synthetic evidence (JSON)
          |
          v
Static deterministic domain model
  ├── src/data.js    : assets, alternate dependency paths, services, incidents
  └── src/engine.js  : blast-radius evaluation and recovery comparison
          |
          v
No persistent backend / no secrets / no exchange APIs
```

The `scripts/build.mjs` process copies `public/` and `src/` into `dist/` as browser-compatible ECMAScript modules. No dependency download is required.

## Impact semantics

A business service defines ordered **complete alternative dependency paths**. The first route represents the nominal primary path. Each path is available only if every component is healthy.

- **HEALTHY:** primary route and at least one alternative are available.
- **EXPOSED:** primary route is available, but all alternatives are unavailable.
- **SINGLE_PATH:** primary route is healthy and the service is defined without redundancy.
- **FAILOVER:** primary route is disrupted, at least one complete alternative is healthy. Model service interruption during estimated failover.
- **OUTAGE:** no complete route is healthy. Model estimated manual restoration.

The model checks estimated recovery minutes against RTO and estimated data loss against RPO **only after simulated interruption**. It does not equate an alternate route with proven automatic failover.

Risk index is an *illustrative weighted prioritization heuristic*, not a predictive probability or compliance score. Tier 1 services carry weight 3; Tier 2 carry weight 1. Each posture has an explicit risk factor (healthy 0; single path 0.25; exposed 0.35; failover 0.55; outage 1). A modeled RTO breach adds up to 0.12 before a per-service cap at 1. Score is normalized to 100 and rounded.

## Managerial intervention semantics

Interventions reduce modeled recovery time for a defined list of services. They never change network availability, topology, RPO, outage root causes or assumed architectural redundancy. Costs are fictional, and effects are assumptions rather than measured benefits.

CAPEX is treated as a modeled one-time investment *within the comparison*; the budgeting view shows a fictional annual baseline. Do not interpret the combined display as an accounting forecast.

## Security, privacy and reliability

- No user authentication, uploads, backend writes or outbound network calls.
- No API credentials or employer topology.
- Scenario selection operates entirely in the browser.
- Export is a local JSON download containing synthetic inputs and outcomes, not sensitive environment state.
- Reproducibility checks: `npm run check`, `npm test`, `npm run build`.
- Cloud hosting intended through Cloudflare Workers Static Assets. No production deployment is asserted.

## Known limitations

This is intentionally **not** a CMDB, an ITSM platform, a real-time observability system or a certified DR solution. It lacks discovery, live incident feeds, SLA measurement, failure probability estimation, procurement approvals, synchronization, audit identity, and evidence of real recovery exercises.

Future work may introduce documented service ownership, dependency graph validation, scheduled tabletop exercise histories, independent failure classes, incident timelines, capacity planning and controlled decision approvals. Those features are proposals, not completed functionality.
