import { COMPONENTS, SERVICES, SCENARIOS, INTERVENTIONS, BUDGET } from './data.js';

const byId = (list, id) => list.find(item => item.id === id);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/**
 * Deterministic, scenario-based impact model.
 * A service's paths are alternative *complete* dependency chains.
 * Only an intact path can carry a service. Recovery figures are assumptions.
 */
export function evaluateScenario(scenarioId = 'baseline', interventionId = 'none') {
  const scenario = byId(SCENARIOS, scenarioId);
  const intervention = byId(INTERVENTIONS, interventionId);
  if (!scenario) throw new RangeError('Unknown scenario: ' + scenarioId);
  if (!intervention) throw new RangeError('Unknown intervention: ' + interventionId);

  const failed = new Set(scenario.failed);
  const components = COMPONENTS.map(component => ({
    ...component, failed: failed.has(component.id)
  }));
  const services = SERVICES.map(service => {
    const routeStatuses = service.paths.map(path => path.every(id => !failed.has(id)));
    const primaryUp = routeStatuses[0];
    const alternateUp = routeStatuses.slice(1).some(Boolean);
    const reduction = intervention.appliesTo.includes(service.id) ? intervention.reduction : 0;

    let state;
    let restorationMinutes = 0;
    if (primaryUp) {
      state = service.paths.length > 1 && !alternateUp ? 'EXPOSED' :
        service.paths.length === 1 ? 'SINGLE_PATH' : 'HEALTHY';
    } else if (alternateUp) {
      state = 'FAILOVER';
      restorationMinutes = Math.max(1, service.failover - reduction);
    } else {
      state = 'OUTAGE';
      restorationMinutes = Math.max(1, scenario.manualRecovery - reduction);
    }

    const outage = state === 'FAILOVER' || state === 'OUTAGE';
    const assumedLoss = outage ? scenario.dataLoss : 0;
    const rtoBreach = outage && restorationMinutes > service.rto;
    const rpoBreach = outage && assumedLoss > service.rpo;
    const readinessWarning = !outage && !alternateUp && service.paths.length > 1;
    const weight = service.tier === 1 ? 3 : 1;
    const riskFactor = state === 'OUTAGE' ? 1 : state === 'FAILOVER' ? 0.55 :
      state === 'EXPOSED' ? 0.35 : state === 'SINGLE_PATH' ? 0.25 : 0;
    return {
      ...service,
      state, failedRoutes: routeStatuses.filter(ok => !ok).length,
      hasAlternate: alternateUp, restorationMinutes, assumedLoss,
      rtoBreach, rpoBreach, readinessWarning,
      impacted: outage, weight, riskFactor
    };
  });

  const affected = services.filter(service => service.impacted);
  const breaches = services.filter(service => service.rtoBreach || service.rpoBreach);
  const weightedTotal = services.reduce((sum, service) => sum + service.weight, 0);
  const weightedRisk = services.reduce((sum, service) =>
    sum + service.weight * clamp(service.riskFactor + (service.rtoBreach ? 0.12 : 0), 0, 1), 0);
  const riskIndex = Math.round(weightedRisk / weightedTotal * 100);

  return {
    scenario, intervention, components, services,
    summary: {
      totalServices: services.length,
      affected: affected.length,
      breaches: breaches.length,
      tierOneAffected: affected.filter(service => service.tier === 1).length,
      reducedRedundancy: services.filter(service => service.readinessWarning).length,
      riskIndex,
      modeledCapex: BUDGET.capex + intervention.capex,
      modeledOpex: BUDGET.opex + intervention.opex
    },
    assumptions: [
      'Rutas y tiempos de recuperación ficticios; no son mediciones de disponibilidad ni resultados de DR validados.',
      'Una ruta alternativa es un supuesto del modelo, no evidencia de una contingencia probada.',
      'RTO y RPO son objetivos; los tiempos de recuperación y la pérdida potencial de datos son estimaciones.',
      'Las inversiones solo modifican los tiempos estimados declarados; no garantizan resultados reales.'
    ]
  };
}

export function compareIntervention(scenarioId, interventionId) {
  const before = evaluateScenario(scenarioId, 'none');
  const after = evaluateScenario(scenarioId, interventionId);
  return {
    before, after,
    breachDelta: before.summary.breaches - after.summary.breaches,
    riskDelta: before.summary.riskIndex - after.summary.riskIndex,
    capexDelta: after.summary.modeledCapex - before.summary.modeledCapex,
    opexDelta: after.summary.modeledOpex - before.summary.modeledOpex
  };
}
