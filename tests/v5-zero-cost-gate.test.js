import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectZeroCostTemplate} from '../scripts/v5-zero-cost-gate.mjs';
const base=readFileSync('config/wrangler.v5.example.jsonc','utf8');
function change(fn) {
  const config=JSON.parse(base.split('\n').filter(line=>!line.trimStart().startsWith('//')).join('\n'));
  fn(config);
  return JSON.stringify(config);
}
test('V5: configuración permitida solo con Worker aislado, D1 y Static Assets',()=>{
  const result=inspectZeroCostTemplate(base);
  assert.equal(result.templateIsolated,true);
  assert.deepEqual(result.approvedBindings,['ASSETS','ATLAS_DB']);
});
test('V5: prohíbe recursos adicionales que podrían generar costos',()=>{
  for(const key of ['r2_buckets','kv_namespaces','queues','ai','vectorize','durable_objects','triggers','unsafe','observability']){
    assert.throws(()=>inspectZeroCostTemplate(change(c=>{c[key]=[];})),/no autorizados/);
  }
});
test('V5: no permite Worker productivo ni base existente',()=>{
  assert.throws(()=>inspectZeroCostTemplate(change(c=>{c.name='atlas-enterprise-it-operations-resilience';})),/No reutilizar/);
  assert.throws(()=>inspectZeroCostTemplate(change(c=>{c.d1_databases[0].database_name='chamaquin-seg';})),/atlas-v5/);
  assert.throws(()=>inspectZeroCostTemplate(change(c=>{c.d1_databases[0].database_id='valid-real-uuid';})),/No cargar IDs/);
});
test('V5: bloquea binding extra, CPU pagada y activación remota accidental',()=>{
  assert.throws(()=>inspectZeroCostTemplate(change(c=>{c.limits={cpu_ms:300000};})),/no autorizados/);
  assert.throws(()=>inspectZeroCostTemplate(change(c=>{c.d1_databases.push({...c.d1_databases[0]});})),/Solo una/);
  assert.throws(()=>inspectZeroCostTemplate(change(c=>{c.vars.STRIPE_SECRET='foo';})),/no autorizados/);
});
