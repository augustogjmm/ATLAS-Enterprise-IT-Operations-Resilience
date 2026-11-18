import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateScenario, compareIntervention } from '../src/engine.js';
import { COMPONENTS, SERVICES, SCENARIOS } from '../src/data.js';

test('baseline does not report operational outages', () => {
  const outcome = evaluateScenario();
  assert.equal(outcome.summary.totalServices, SERVICES.length);
  assert.equal(outcome.summary.affected, 0);
  assert.equal(outcome.summary.breaches, 0);
});

test('primary site outage triggers failover and reporting outage', () => {
  const result = evaluateScenario('dc-north');
  assert.equal(result.services.find(x => x.id === 'payments').state, 'FAILOVER');
  assert.equal(result.services.find(x => x.id === 'reporting').state, 'OUTAGE');
  assert.equal(result.services.find(x => x.id === 'payments').rtoBreach, true);
  assert.equal(result.services.find(x => x.id === 'digital').rtoBreach, false);
});

test('secondary site outage erodes redundancy without service interruption', () => {
  const outcome = evaluateScenario('dc-south');
  assert.equal(outcome.summary.affected, 0);
  assert.ok(outcome.summary.reducedRedundancy > 0);
});

test('cloud outage affects service desk but not payments', () => {
  const outcome = evaluateScenario('cloud-outage');
  assert.equal(outcome.services.find(x => x.id === 'helpdesk').state, 'OUTAGE');
  assert.equal(outcome.services.find(x => x.id === 'payments').state, 'HEALTHY');
});

test('dual network failure disables both payment paths', () => {
  const outcome = evaluateScenario('dual-network');
  assert.equal(outcome.services.find(x => x.id === 'payments').state, 'OUTAGE');
  assert.ok(outcome.summary.tierOneAffected >= 1);
});

test('data loss scenario explicitly evaluates RPO on interrupted services', () => {
  const outcome = evaluateScenario('data-loss');
  assert.equal(outcome.services.find(x => x.id === 'payments').rpoBreach, true);
  assert.equal(outcome.services.find(x => x.id === 'digital').rpoBreach, true);
  assert.equal(outcome.services.find(x => x.id === 'identity').rpoBreach, false);
});

test('runbook intervention reduces modeled recovery without changing failed nodes', () => {
  const base = evaluateScenario('dc-north');
  const improved = evaluateScenario('dc-north', 'runbooks');
  assert.equal(base.services.find(x => x.id === 'payments').restorationMinutes, 9);
  assert.equal(improved.services.find(x => x.id === 'payments').restorationMinutes, 5);
  assert.equal(improved.services.find(x => x.id === 'payments').rtoBreach, false);
  assert.deepEqual(base.components.filter(x => x.failed).map(x => x.id),
    improved.components.filter(x => x.failed).map(x => x.id));
});

test('reporting automation cannot fabricate a healthy alternate path', () => {
  const outcome = evaluateScenario('dc-north', 'reporting');
  const service = outcome.services.find(x => x.id === 'reporting');
  assert.equal(service.state, 'OUTAGE');
  assert.equal(service.restorationMinutes, 110);
});

test('financial deltas are deterministic and transparent', () => {
  const result = compareIntervention('dc-north', 'runbooks');
  assert.equal(result.capexDelta, 90000);
  assert.equal(result.opexDelta, 12000);
  assert.equal(result.breachDelta, 1);
});

test('unknown scenario and intervention are rejected', () => {
  assert.throws(() => evaluateScenario('not-a-real-incident'), RangeError);
  assert.throws(() => evaluateScenario('baseline', 'made-up'), RangeError);
});

test('every component referenced in a service route exists', () => {
  const componentIds = new Set(COMPONENTS.map(x => x.id));
  for (const service of SERVICES) for (const path of service.paths) {
    assert.ok(path.length > 0);
    for (const id of path) assert.ok(componentIds.has(id), id);
  }
});

test('scenario failures always reference known components', () => {
  const componentIds = new Set(COMPONENTS.map(x => x.id));
  for (const scenario of SCENARIOS) for (const id of scenario.failed) {
    assert.ok(componentIds.has(id), id);
  }
});
