import test from 'node:test';
import assert from 'node:assert/strict';
import {RemoteWorkspaces,RemoteWorkspaceError,canEditWorkspace,canManageMembers,canAudit} from '../public/remote-workspaces.js';

test('cliente V5 inicia sin solicitudes y envía credenciales solo al origen propio',async()=>{
  const calls=[];
  const api=new RemoteWorkspaces(async (url,options)=>{
    calls.push({url,options});
    return new Response(JSON.stringify({tenants:[]}),{status:200,headers:{'content-type':'application/json'}});
  });
  assert.equal(calls.length,0);
  await api.session();
  assert.equal(calls[0].url,'/api/v1/session');
  assert.equal(calls[0].options.credentials,'same-origin');
  assert.equal(calls[0].options.cache,'no-store');
  assert.equal(calls[0].options.method,'GET');
});

test('cliente V5 incluye revision y state al guardar; no envía JSON por GET',async()=>{
  const calls=[];
  const api=new RemoteWorkspaces(async (url,options)=>{
    calls.push({url,options});
    return Response.json({revision:2});
  });
  const state={version:1,verticals:[{id:'test'}]};
  assert.deepEqual(await api.save('org/a','w 1',1,state),{revision:2});
  assert.equal(calls[0].url,'/api/v1/tenants/org%2Fa/workspaces/w%201');
  assert.equal(calls[0].options.method,'PUT');
  assert.deepEqual(JSON.parse(calls[0].options.body),{revision:1,state});
  await api.open('org-a','workspace-1');
  assert.equal(calls[1].options.method,'GET');
  assert.equal(calls[1].options.body,undefined);
});

test('HTTP 409 y errores de red son visibles y no se transforman en éxito',async()=>{
  const conflict=new RemoteWorkspaces(async()=>Response.json({error:'Conflicto de edición'},{status:409}));
  await assert.rejects(conflict.save('org','w',1,{}),e=>e instanceof RemoteWorkspaceError&&e.status===409&&/Conflicto/.test(e.message));
  const offline=new RemoteWorkspaces(async()=>{throw new Error('network down');});
  await assert.rejects(offline.session(),e=>e instanceof RemoteWorkspaceError&&e.status===0&&/local/.test(e.message));
});

test('roles visuales orientativos: el acceso real se valida en backend',()=>{
  assert.equal(canEditWorkspace('editor'),true);
  assert.equal(canEditWorkspace('auditor'),false);
  assert.equal(canEditWorkspace('viewer'),false);
  assert.equal(canManageMembers('admin'),true);
  assert.equal(canManageMembers('editor'),false);
  assert.equal(canAudit('auditor'),true);
  assert.equal(canAudit('viewer'),false);
});
