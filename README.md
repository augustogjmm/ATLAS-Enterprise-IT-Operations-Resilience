# ATLAS
### Enterprise IT Operations & Resilience · Executive Technology Command Center

**Architecture | IT Operations | Business Continuity | Technology Governance**

> An interactive, reproducible **synthetic enterprise simulator** for demonstrating how infrastructure dependencies translate into recovery objectives, service risk and investment decisions. This is an independently developed portfolio project—not an employer system, not live telemetry, and not a validated disaster-recovery solution.

**Owner:** Augusto García Juárez Matorras · [LinkedIn](https://www.linkedin.com/in/augustog/) · [Executive portfolio](https://github.com/augustogjmm)

## The executive problem

Dashboards report what is failing; leaders also need to understand **which business capabilities are at risk, what recovery objectives can realistically be met, and where investment changes the outcome**. ATLAS demonstrates a transparent, testable decision model for those discussions.

## Interactive MVP

| Capability | What you can explore |
|---|---|
| Enterprise architecture | Synthetic primary/secondary data centers and a cloud API dependency |
| Business service impact | Complete alternate dependency paths for six modeled services |
| Continuity | Primary-site, secondary-site, cloud, correlated-network and data-loss disruptions |
| Recovery objectives | Compare estimated restoration and assumed data loss against RTO/RPO |
| Management decisions | Compare transparent recovery-time adjustments and illustrative CAPEX/OPEX |
| Evidence | Export JSON with scenario, assumptions, per-service status and budget model |

**Important:** No claim of measured availability, predictive risk, security certification, financial returns, or operational recovery. The risk index is a deterministic prioritization heuristic, not a probability.

### Design principles

- **Explainability before complexity** — every derived status has an explicit underlying assumption.
- **Business services first** — infrastructure is modeled through complete dependency chains.
- **Resilience is not just redundancy** — an alternate path may recover too slowly to meet an RTO.
- **Architecture is inseparable from governance** — all interventions display modeled costs and limitations.
- **No invented employer outcomes** — infrastructure and budgets are wholly fictional.

## Run locally

Node.js 22 or newer is recommended; no package installation or cloud account is required.

```bash
npm run check
npm test
npm run build
```

Then serve the generated `dist/` directory using any static HTTP server, for example:

```bash
python -m http.server 8080 --directory dist
```

Open [http://localhost:8080](http://localhost:8080). Do not open `index.html` directly with the `file://` protocol because browsers restrict module imports.

## Cloudflare-first hosting

The build output is a static asset directory (`dist/`) suitable for **Cloudflare Workers Static Assets**. We intentionally avoid Vercel-specific configuration and paid external data integrations. Hosting is **not deployed yet**; configure a Worker project and connect GitHub only after reviewing the MVP, account permissions and current Cloudflare free-plan limits.

See the [architecture and decision model](docs/ARCHITECTURE.md), [ADR-001](docs/ADR-001-static-simulation.md) and [five-minute executive walkthrough](docs/DEMO_GUIDE.md).

## Safety and limitations

No employer topology, customer data, credentials, API tokens or actual incidents. Simulation is browser-only with no persistent backend and no external data fetches. This repository is intentionally an **MVP**, not a CMDB, ITSM platform or real monitoring system. See [SECURITY.md](SECURITY.md).

**Licensing:** No general reuse license has been assigned yet; terms should be agreed before adding a LICENSE file.
