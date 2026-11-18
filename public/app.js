import { COMPONENTS, SCENARIOS, INTERVENTIONS, BUDGET } from './lib/data.js';
import { evaluateScenario, compareIntervention } from './lib/engine.js';

const $ = id => document.getElementById(id);
const scenarioSelect = $('scenario-select');
const interventionSelect = $('intervention-select');
const labelForState = {
  HEALTHY: 'Operativo',
  EXPOSED: 'Redundancia reducida',
  SINGLE_PATH: 'Ruta única de recuperación',
  FAILOVER: 'Contingencia en curso',
  OUTAGE: 'Servicio indisponible'
};
const money = value => new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0
}).format(value);
const validSlugs = /^[a-z0-9-]+$/;

for (const scenario of SCENARIOS) {
  const option = document.createElement('option');
  option.value = scenario.id;
  option.textContent = scenario.label;
  scenarioSelect.append(option);
}
for (const intervention of INTERVENTIONS) {
  const option = document.createElement('option');
  option.value = intervention.id;
  option.textContent = intervention.title;
  interventionSelect.append(option);
}
scenarioSelect.value = 'dc-north';
interventionSelect.value = 'none';

function drawTopology(outcome) {
  const sites = [
    { name: 'DC Norte', caption: 'Sitio principal', symbol: '◫' },
    { name: 'DC Sur', caption: 'Sitio de contingencia', symbol: '◈' },
    { name: 'Región cloud', caption: 'Servicios compartidos', symbol: '☷' }
  ];
  const failed = new Set(outcome.scenario.failed);
  // Visual indicators describe the synthetic scenario, not monitored infrastructure.
  const markup = sites.map(site => {
    const nodes = COMPONENTS.filter(node => node.site === site.name);
    const affected = nodes.filter(node => failed.has(node.id)).length;
    const status = affected ? `${affected} EN FALLA` : 'DISPONIBLE';
    return `<article class="site ${affected ? 'site-failed' : ''}" aria-label="${site.name}: ${status}">
      <div class="site-title"><div><strong>${site.name}</strong><span class="site-subtitle">${site.caption}</span></div>
        <span class="site-count">${status}</span></div>
      <div class="site-nodes">
        ${nodes.map(node => `<div class="node ${failed.has(node.id) ? 'failed' : ''}">
          <span class="node-status" aria-hidden="true"></span>
          <span class="node-glyph" aria-hidden="true">${site.symbol}</span>
          <span>${node.name}</span></div>`).join('')}
      </div>
    </article>`;
  }).join('');
  $('topology').innerHTML = markup;
}

function drawServices(outcome) {
  $('service-rows').innerHTML = outcome.services.map(service => {
    const recovery = service.impacted
      ? `${service.restorationMinutes} min / ${service.rto} min`
      : `Sin interrupción / ${service.rto} min`;
    const loss = service.impacted
      ? `${service.assumedLoss} min / ${service.rpo} min`
      : `Sin interrupción / ${service.rpo} min`;
    return `<tr>
      <td><div class="service-name">${service.name}</div><div class="service-owner">${service.owner}</div></td>
      <td><span class="tier ${service.tier === 1 ? 'critical' : ''}">CRIT. ${service.tier}</span></td>
      <td><span class="state-pill ${service.state}">${labelForState[service.state]}</span></td>
      <td><span class="recovery-value ${service.rtoBreach ? 'breached' : ''}">${recovery}</span></td>
      <td><span class="recovery-value ${service.rpoBreach ? 'breached' : ''}">${loss}</span></td>
    </tr>`;
  }).join('');
}

function drawManagement(outcome) {
  const { summary, intervention, scenario } = outcome;
  const comparison = compareIntervention(scenario.id, intervention.id);
  $('posture-critical').textContent = summary.tierOneAffected
    ? `${summary.tierOneAffected} / 3 servicios críticos afectados`
    : 'Sin interrupciones de criticidad 1';
  $('posture-redundancy').textContent = `${summary.reducedRedundancy} servicios sin ruta alternativa disponible`;
  $('posture-decision').textContent = summary.breaches
    ? 'Priorizar los objetivos de recuperación incumplidos'
    : summary.reducedRedundancy
      ? 'Restablecer la capacidad de contingencia'
      : summary.affected
        ? 'Validar la contingencia y sus evidencias'
        : 'Mantener las pruebas y los controles de continuidad';

  $('investment-name').textContent = intervention.title;
  $('investment-rationale').textContent = intervention.rationale;
  $('comparison-risk').textContent = comparison.riskDelta ? `−${comparison.riskDelta}` : '0';
  $('comparison-breaches').textContent = comparison.breachDelta ? `−${comparison.breachDelta}` : '0';
  $('budget-opex').textContent = money(summary.modeledOpex);
  $('budget-capex').textContent = money(summary.modeledCapex);
  $('opex-bar').style.width = `${Math.min(100, summary.modeledOpex / (BUDGET.opex + 100000) * 100)}%`;
  $('capex-bar').style.width = `${Math.min(100, summary.modeledCapex / (BUDGET.capex + 250000) * 100)}%`;
  $('budget-change').textContent = intervention.id === 'none'
    ? 'Presupuesto simulado sin gasto adicional'
    : `Costo adicional estimado: ${money(comparison.capexDelta)} de CAPEX único + ${money(comparison.opexDelta)} de OPEX anual`;
}

function updateExecutiveBrief(outcome) {
  const { summary, intervention } = outcome;
  const headline = $('brief-headline');
  const description = $('brief-description');
  const panel = $('executive-brief');
  if (summary.breaches > 0) {
    headline.textContent = 'Revisar objetivos de recuperación comprometidos';
    description.textContent = `${summary.breaches} servicio(s) exceden sus objetivos simulados. Priorizá la continuidad, la verificación de dependencias y la evidencia del procedimiento de recuperación.`;
    panel.dataset.severity = 'high';
  } else if (summary.affected > 0) {
    headline.textContent = 'Validar la respuesta de contingencia';
    description.textContent = `${summary.affected} servicio(s) requieren recuperación. Contrastá los tiempos estimados con los ensayos documentados antes de comprometer niveles de servicio.`;
    panel.dataset.severity = 'medium';
  } else if (summary.reducedRedundancy > 0) {
    headline.textContent = 'El servicio continúa, la redundancia no';
    description.textContent = 'Sin interrupciones operativas simuladas, pero con rutas de recuperación comprometidas. Priorizá la restauración de capacidad secundaria.';
    panel.dataset.severity = 'medium';
  } else {
    headline.textContent = 'Mantener la preparación de continuidad';
    description.textContent = 'Los servicios modelados operan sin incidentes simulados. Mantené ejercicios de recuperación y controles de dependencias.';
    panel.dataset.severity = 'normal';
  }
  if (intervention.id !== 'none') {
    description.textContent += ' La alternativa seleccionada modifica supuestos de recuperación, no representa una mejora ya validada.';
  }
}

function render() {
  const scenarioId = scenarioSelect.value;
  const interventionId = interventionSelect.value;
  if (!validSlugs.test(scenarioId) || !validSlugs.test(interventionId)) return;
  const outcome = evaluateScenario(scenarioId, interventionId);
  const { summary, scenario } = outcome;

  $('metric-services').textContent = summary.totalServices;
  $('metric-affected').textContent = summary.affected;
  $('metric-breaches').textContent = summary.breaches;
  $('metric-risk').textContent = summary.riskIndex;
  $('risk-fill').style.width = `${summary.riskIndex}%`;
  document.querySelector('.accent-card')?.style.setProperty('--risk-angle', `${summary.riskIndex * 3.6}deg`);
  $('impact-tag').textContent = summary.affected ? 'REQUIERE ACCIÓN' : 'SIN INTERRUPCIONES';
  $('breach-tag').textContent = summary.breaches ? 'REVISAR PRIORIDAD' : 'OBJETIVOS CUMPLIDOS';
  $('scenario-label').textContent = scenario.label;
  $('scenario-category').textContent = scenario.category.toUpperCase();
  $('scenario-description').textContent = scenario.description;
  $('live-region').textContent =
    `${scenario.label}: ${summary.affected} servicios afectados, ${summary.breaches} objetivos de recuperación incumplidos.`;

  drawTopology(outcome);
  drawServices(outcome);
  drawManagement(outcome);
  updateExecutiveBrief(outcome);
}

function exportAssessment() {
  const outcome = evaluateScenario(scenarioSelect.value, interventionSelect.value);
  const evidence = {
    product: 'ATLAS · Centro Ejecutivo de Operaciones de TI',
    modelVersion: '0.1.0',
    exportedAt: new Date().toISOString(),
    classification: 'DEMOSTRACIÓN FICTICIA — NO SON DATOS OPERATIVOS REALES',
    scenario: outcome.scenario,
    intervention: outcome.intervention,
    summary: outcome.summary,
    services: outcome.services,
    components: outcome.components,
    assumptions: outcome.assumptions
  };
  const blob = new Blob([JSON.stringify(evidence, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `atlas-${outcome.scenario.id}-assessment.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

scenarioSelect.addEventListener('change', render);
interventionSelect.addEventListener('change', render);
$('export-btn').addEventListener('click', exportAssessment);
render();
