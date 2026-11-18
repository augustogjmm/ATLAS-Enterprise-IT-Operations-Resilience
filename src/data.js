/**
 * Fictional infrastructure, services and governance assumptions.
 * No employer topology, transactions, telemetry or sensitive information.
 */
export const COMPONENTS = Object.freeze([
  { id: 'network-a', name: 'Red principal A', kind: 'Network', site: 'DC Norte' },
  { id: 'compute-a', name: 'Clúster de cómputo A', kind: 'Compute', site: 'DC Norte' },
  { id: 'data-a', name: 'Base transaccional A', kind: 'Data', site: 'DC Norte' },
  { id: 'identity-a', name: 'Identidad A', kind: 'Identity', site: 'DC Norte' },
  { id: 'batch-a', name: 'Procesamiento de reportes', kind: 'Batch', site: 'DC Norte' },
  { id: 'network-b', name: 'Red secundaria B', kind: 'Network', site: 'DC Sur' },
  { id: 'compute-b', name: 'Clúster de cómputo B', kind: 'Compute', site: 'DC Sur' },
  { id: 'data-b', name: 'Base transaccional B', kind: 'Data', site: 'DC Sur' },
  { id: 'identity-b', name: 'Identidad B', kind: 'Identity', site: 'DC Sur' },
  { id: 'cloud-api', name: 'API de integración cloud', kind: 'Cloud', site: 'Región cloud' }
]);

export const SERVICES = Object.freeze([
  { id: 'payments', name: 'Procesamiento de pagos', owner: 'Tecnología de pagos', tier: 1, rto: 5, rpo: 0, failover: 9,
    paths: [['network-a', 'compute-a', 'data-a'], ['network-b', 'compute-b', 'data-b']] },
  { id: 'digital', name: 'Canales digitales', owner: 'Plataformas digitales', tier: 1, rto: 15, rpo: 5, failover: 7,
    paths: [['network-a', 'compute-a', 'data-a'], ['network-b', 'compute-b', 'data-b']] },
  { id: 'identity', name: 'Identidad y accesos', owner: 'Ingeniería de seguridad', tier: 1, rto: 30, rpo: 15, failover: 4,
    paths: [['network-a', 'identity-a'], ['network-b', 'identity-b']] },
  { id: 'integration', name: 'Gateway corporativo de APIs', owner: 'Integración', tier: 2, rto: 30, rpo: 15, failover: 6,
    paths: [['network-a', 'compute-a'], ['network-b', 'compute-b']] },
  { id: 'helpdesk', name: 'Portal de gestión de servicios', owner: 'Operaciones TI', tier: 2, rto: 60, rpo: 60, failover: 6,
    paths: [['cloud-api', 'network-a'], ['cloud-api', 'network-b']] },
  { id: 'reporting', name: 'Reportes regulatorios', owner: 'Plataformas de datos', tier: 2, rto: 120, rpo: 60, failover: 0,
    paths: [['batch-a', 'data-a']] }
]);

export const SCENARIOS = Object.freeze([
  { id: 'baseline', label: 'Operación normal · sin incidentes', category: 'Operación normal',
    description: 'Sin fallas simuladas. Evaluá la redundancia, los objetivos y las dependencias compartidas.',
    failed: [], manualRecovery: 0, dataLoss: 0 },
  { id: 'dc-north', label: 'Caída del data center principal', category: 'Falla de sitio',
    description: 'Full loss of DC Norte; alternate paths require service-specific recovery time.',
    failed: ['network-a', 'compute-a', 'data-a', 'identity-a', 'batch-a'],
    manualRecovery: 240, dataLoss: 0 },
  { id: 'dc-south', label: 'Caída del data center secundario', category: 'Redundancia comprometida',
    description: 'Los servicios principales continúan, pero varias rutas de contingencia quedan indisponibles.',
    failed: ['network-b', 'compute-b', 'data-b', 'identity-b'],
    manualRecovery: 240, dataLoss: 0 },
  { id: 'cloud-outage', label: 'Interrupción de integración cloud', category: 'Caída de proveedor',
    description: 'El componente de API compartido está indisponible para ambas rutas locales.',
    failed: ['cloud-api'], manualRecovery: 90, dataLoss: 0 },
  { id: 'dual-network', label: 'Falla de red en ambos sitios', category: 'Falla correlacionada',
    description: 'Las dos redes centrales están indisponibles: el cómputo redundante no evita la interrupción de servicios.',
    failed: ['network-a', 'network-b'], manualRecovery: 150, dataLoss: 0 },
  { id: 'data-loss', label: 'Caída de base primaria · replicación demorada', category: 'Integridad de datos',
    description: 'Falla la base primaria mientras la ruta secundaria sigue disponible; se estiman nueve minutos de retraso de replicación que pueden exceder el RPO.',
    failed: ['data-a'], manualRecovery: 130, dataLoss: 9 },
  { id: 'replica-lag', label: 'Réplica indisponible · riesgo de DR', category: 'Preparación de recuperación',
    description: 'La ruta primaria funciona, pero la base secundaria no está disponible para una recuperación.',
    failed: ['data-b'], manualRecovery: 120, dataLoss: 35 }
]);

export const INTERVENTIONS = Object.freeze([
  { id: 'none', title: 'Controles actuales', capex: 0, opex: 0, reduction: 0, appliesTo: [],
    rationale: 'Sin inversión adicional. Se mantienen los supuestos originales de recuperación.' },
  { id: 'runbooks', title: 'Automatización de procedimientos de contingencia', capex: 90000, opex: 12000, reduction: 4,
    appliesTo: ['payments', 'digital', 'identity', 'integration'],
    rationale: 'Se modela una conmutación más rápida mediante orquestación ensayada, sin modificar los supuestos de pérdida de datos.' },
  { id: 'reporting', title: 'Automatización de recuperación de reportes', capex: 190000, opex: 28000, reduction: 130,
    appliesTo: ['reporting'],
    rationale: 'Se reduce el tiempo estimado de recuperación manual, sin suponer redundancia completa en el servicio de reportes.' },
  { id: 'observability', title: 'Observabilidad de extremo a extremo', capex: 65000, opex: 18000, reduction: 2,
    appliesTo: ['payments', 'digital', 'identity', 'integration', 'helpdesk', 'reporting'],
    rationale: 'Se modela una detección y respuesta más rápida; sus beneficios requieren validación con datos reales.' }
]);

export const BUDGET = Object.freeze({ capex: 1200000, opex: 2400000, currency: 'USD', period: 'annual' });
