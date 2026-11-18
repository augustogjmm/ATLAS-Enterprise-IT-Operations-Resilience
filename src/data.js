/**
 * Fictional infrastructure, services and governance assumptions.
 * No employer topology, transactions, telemetry or sensitive information.
 */
export const COMPONENTS = Object.freeze([
  { id: 'network-a', name: 'Core network A', kind: 'Network', site: 'DC North' },
  { id: 'compute-a', name: 'Compute cluster A', kind: 'Compute', site: 'DC North' },
  { id: 'data-a', name: 'Transactional DB A', kind: 'Data', site: 'DC North' },
  { id: 'identity-a', name: 'Identity service A', kind: 'Identity', site: 'DC North' },
  { id: 'batch-a', name: 'Reporting batch', kind: 'Batch', site: 'DC North' },
  { id: 'network-b', name: 'Core network B', kind: 'Network', site: 'DC South' },
  { id: 'compute-b', name: 'Compute cluster B', kind: 'Compute', site: 'DC South' },
  { id: 'data-b', name: 'Transactional DB B', kind: 'Data', site: 'DC South' },
  { id: 'identity-b', name: 'Identity service B', kind: 'Identity', site: 'DC South' },
  { id: 'cloud-api', name: 'Cloud integration API', kind: 'Cloud', site: 'Cloud region' }
]);

export const SERVICES = Object.freeze([
  { id: 'payments', name: 'Payments processing', owner: 'Payments IT', tier: 1, rto: 5, rpo: 0, failover: 9,
    paths: [['network-a', 'compute-a', 'data-a'], ['network-b', 'compute-b', 'data-b']] },
  { id: 'digital', name: 'Digital channels', owner: 'Digital Platforms', tier: 1, rto: 15, rpo: 5, failover: 7,
    paths: [['network-a', 'compute-a', 'data-a'], ['network-b', 'compute-b', 'data-b']] },
  { id: 'identity', name: 'Identity & access', owner: 'Security Engineering', tier: 1, rto: 30, rpo: 15, failover: 4,
    paths: [['network-a', 'identity-a'], ['network-b', 'identity-b']] },
  { id: 'integration', name: 'Enterprise API gateway', owner: 'Integration', tier: 2, rto: 30, rpo: 15, failover: 6,
    paths: [['network-a', 'compute-a'], ['network-b', 'compute-b']] },
  { id: 'helpdesk', name: 'Service management portal', owner: 'IT Operations', tier: 2, rto: 60, rpo: 60, failover: 6,
    paths: [['cloud-api', 'network-a'], ['cloud-api', 'network-b']] },
  { id: 'reporting', name: 'Regulatory reporting', owner: 'Data Platforms', tier: 2, rto: 120, rpo: 60, failover: 0,
    paths: [['batch-a', 'data-a']] }
]);

export const SCENARIOS = Object.freeze([
  { id: 'baseline', label: 'Baseline · nominal', category: 'Steady state',
    description: 'No simulated failure. Check redundancy, objectives and shared dependencies.',
    failed: [], manualRecovery: 0, dataLoss: 0 },
  { id: 'dc-north', label: 'Primary data center outage', category: 'Facility disruption',
    description: 'Full loss of DC North; alternate paths require service-specific recovery time.',
    failed: ['network-a', 'compute-a', 'data-a', 'identity-a', 'batch-a'],
    manualRecovery: 240, dataLoss: 0 },
  { id: 'dc-south', label: 'Secondary data center outage', category: 'Resilience erosion',
    description: 'Primary services continue, but several secondary paths are unavailable.',
    failed: ['network-b', 'compute-b', 'data-b', 'identity-b'],
    manualRecovery: 240, dataLoss: 0 },
  { id: 'cloud-outage', label: 'Cloud integration disruption', category: 'Provider outage',
    description: 'The shared API component is unavailable across both local service routes.',
    failed: ['cloud-api'], manualRecovery: 90, dataLoss: 0 },
  { id: 'dual-network', label: 'Multi-site network partition', category: 'Correlated failure',
    description: 'Both network cores are unavailable; redundant compute cannot prevent service loss.',
    failed: ['network-a', 'network-b'], manualRecovery: 150, dataLoss: 0 },
  { id: 'data-loss', label: 'Primary database loss · delayed replication', category: 'Data integrity',
    description: 'Primary database fails while the secondary route is still available; estimated 9-minute replication lag breaches strict RPOs.',
    failed: ['data-a'], manualRecovery: 130, dataLoss: 9 },
  { id: 'replica-lag', label: 'Replica unavailable · DR risk', category: 'Recovery readiness',
    description: 'The primary route is operational, but the secondary database cannot serve recovery.',
    failed: ['data-b'], manualRecovery: 120, dataLoss: 35 }
]);

export const INTERVENTIONS = Object.freeze([
  { id: 'none', title: 'Current controls', capex: 0, opex: 0, reduction: 0, appliesTo: [],
    rationale: 'No additional investment. Baseline recovery assumptions remain unchanged.' },
  { id: 'runbooks', title: 'Automated failover runbooks', capex: 90000, opex: 12000, reduction: 4,
    appliesTo: ['payments', 'digital', 'identity', 'integration'],
    rationale: 'Model a shorter cutover through rehearsed orchestration; no change to data-loss assumptions.' },
  { id: 'reporting', title: 'Reporting recovery automation', capex: 190000, opex: 28000, reduction: 130,
    appliesTo: ['reporting'],
    rationale: 'Reduce estimated manual restoration time, without claiming a fully redundant reporting service.' },
  { id: 'observability', title: 'Cross-domain observability', capex: 65000, opex: 18000, reduction: 2,
    appliesTo: ['payments', 'digital', 'identity', 'integration', 'helpdesk', 'reporting'],
    rationale: 'Model quicker identification and response; telemetry and detection benefits require real validation.' }
]);

export const BUDGET = Object.freeze({ capex: 1200000, opex: 2400000, currency: 'USD', period: 'annual' });
