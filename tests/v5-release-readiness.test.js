import test from 'node:test';
import assert from 'node:assert/strict';
import {assessV5Readiness,RELEASE_CHECKS} from '../scripts/v5-release-readiness.mjs';

test('ATLAS V5 queda bloqueada sin evidencia externa del plan Free y Access',()=>{
  const r=assessV5Readiness(null);
  assert.equal(r.go,false);
  assert.deepEqual(r.missing,RELEASE_CHECKS);
});
test('HTTP 403, campos faltantes y pseudo-aprobaciones no desbloquean el release',()=>{
  const submitted=Object.fromEntries(RELEASE_CHECKS.map(k=>[k,true]));
  submitted.accessFreeVerified='true';
  submitted.zeroChargeVerified=false;
  submitted.ownerApprovedDeployment=403;
  const r=assessV5Readiness(submitted);
  assert.equal(r.go,false);
  assert.ok(r.missing.includes('accessFreeVerified'));
  assert.ok(r.missing.includes('zeroChargeVerified'));
  assert.ok(r.missing.includes('ownerApprovedDeployment'));
});
test('la lista de controles nunca se considera aprobada por defecto',()=>{
  const submitted=Object.fromEntries(RELEASE_CHECKS.map(k=>[k,true]));
  assert.equal(assessV5Readiness(submitted).go,true);
  delete submitted.d1FreeVerified;
  assert.equal(assessV5Readiness(submitted).go,false);
});
