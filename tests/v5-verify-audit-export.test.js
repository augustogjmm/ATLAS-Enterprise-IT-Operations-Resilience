import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {verifyAuditExport} from '../scripts/v5-verify-audit-export.mjs';

function fixture(){
  const events=[{id:'a',occurred_at:'2026-11-19T00:00:00Z',action:'workspace.created'}];
  return {tenantId:'org-a',eventCount:events.length,events,
    integrity:{algorithm:'SHA-256',encoding:'JSON.stringify(events)',
      sha256:createHash('sha256').update(JSON.stringify(events)).digest('hex')}};
}

test('verificador offline confirma exportación íntegra',()=>{
  assert.equal(verifyAuditExport(fixture()).eventCount,1);
});

test('verificador offline rechaza cambios en eventos, conteo y duplicados',()=>{
  const changed=fixture();changed.events[0].action='workspace.deleted';
  assert.throws(()=>verifyAuditExport(changed),/SHA-256/);
  const count=fixture();count.eventCount=2;
  assert.throws(()=>verifyAuditExport(count),/Formato o conteo/);
  const duplicated=fixture();duplicated.events.push({...duplicated.events[0]});duplicated.eventCount=2;
  duplicated.integrity.sha256=createHash('sha256').update(JSON.stringify(duplicated.events)).digest('hex');
  assert.throws(()=>verifyAuditExport(duplicated),/duplicado/);
});
