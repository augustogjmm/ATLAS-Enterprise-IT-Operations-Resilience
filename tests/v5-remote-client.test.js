import test from 'node:test';
import assert from 'node:assert/strict';
import {RemoteWorkspaces,RemoteWorkspaceError,canEditWorkspace,canManageMembers,canAudit,canRestore} from '../public/remote-workspaces.js';

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
  assert.equal(calls[0].options.headers['X-Atlas-CSRF'],'v5');
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
  assert.equal(canRestore('owner'),true);
  assert.equal(canRestore('admin'),true);
  assert.equal(canRestore('editor'),false);
});

test('historial remoto y restauración envían revisión esperada y cabecera CSRF',async()=>{
  const calls=[];
  const api=new RemoteWorkspaces(async (url,options)=>{
    calls.push({url,options});
    return Response.json(options.method==='GET'?{revisions:[{revision:2},{revision:1}]}:{revision:3,restoredFrom:1});
  });
  const list=await api.revisions('org-a','w-1');
  assert.deepEqual(list.revisions.map(r=>r.revision),[2,1]);
  const restored=await api.restore('org-a','w-1',1,2);
  assert.deepEqual(restored,{revision:3,restoredFrom:1});
  assert.equal(calls[1].url,'/api/v1/tenants/org-a/workspaces/w-1/revisions/1/restore');
  assert.equal(calls[1].options.method,'PUT');
  assert.equal(calls[1].options.headers['X-Atlas-CSRF'],'v5');
  assert.deepEqual(JSON.parse(calls[1].options.body),{revision:2});
});

 
test('timeout de escritura informa estado incierto sin repetir PUT',async()=>{
  let requests=0;
  const api=new RemoteWorkspaces((url,options)=>new Promise((resolve,reject)=>{
    requests++;
    options.signal.addEventListener('abort',()=>reject(new DOMException('abortado','AbortError')),{once:true});
  }),'/api/v1',20);
  await assert.rejects(api.save('org','w',2,{version:1}),e=>
    e instanceof RemoteWorkspaceError&&e.status===0&&/podría haberse aplicado/.test(e.message));
  assert.equal(requests,1,'Un PUT incierto nunca debe reintentarse automáticamente');
});

test('timeout de GET recomienda consultar otra vez sin indicar escritura incierta',async()=>{
  const api=new RemoteWorkspaces((url,options)=>new Promise((resolve,reject)=>{
    options.signal.addEventListener('abort',()=>reject(new DOMException('abortado','AbortError')),{once:true});
  }),'/api/v1',15);
  await assert.rejects(api.session(),e=>e instanceof RemoteWorkspaceError &&
    /intentar la consulta nuevamente/.test(e.message) && !/podría haberse aplicado/.test(e.message));
});

test('el cliente limpia el temporizador después de una respuesta válida',async()=>{
  let signal;
  const api=new RemoteWorkspaces(async(url,options)=>{
    signal=options.signal;
    return Response.json({tenants:[]});
  },'/api/v1',20);
  await api.session();
  await new Promise(resolve=>setTimeout(resolve,50));
  assert.equal(signal.aborted,false,'El temporizador no debe dispararse después de finalizar');
  assert.throws(()=>new RemoteWorkspaces(async()=>Response.json({}),'/api/v1',0),RangeError);
});

test('exportación completa de auditoría recorre páginas, sin credenciales externas ni duplicados',async()=>{
  const calls=[];
  const api=new RemoteWorkspaces(async(url,options)=>{
    calls.push({url,options});
    const query=new URL(url,'https://atlas.test').searchParams;
    const hasCursor=query.has('beforeAt');
    return Response.json(hasCursor
      ?{events:[{id:'evt-1',occurred_at:'2026-11-17T00:00:00.000Z'}],nextCursor:null}
      :{events:[{id:'evt-2',occurred_at:'2026-11-18T00:00:00.000Z'}],
        nextCursor:{beforeAt:'2026-11-18T00:00:00.000Z',beforeId:'evt-2'}});
  });
  const result=await api.exportAudit('org/a');
  assert.equal(result.eventCount,2);
  assert.deepEqual(result.events.map(x=>x.id),['evt-2','evt-1']);
  assert.equal(result.tenantId,'org/a');
  assert.equal(calls.length,2);
  assert.equal(calls[0].url,'/api/v1/tenants/org%2Fa/audit/export');
  assert.match(calls[1].url,/beforeAt=2026-11-18T00%3A00%3A00.000Z/);
  assert.ok(calls.every(x=>x.options.credentials==='same-origin'&&x.options.method==='GET'));
});

test('exportación de auditoría no entrega resultados parciales ante fallo o repetición',async()=>{
  let n=0;
  const partial=new RemoteWorkspaces(async()=>{
    n++;
    if(n===2)return Response.json({error:'Auditoría no disponible'},{status:503});
    return Response.json({events:[{id:'one'}],nextCursor:{beforeAt:'2026-11-18T00:00:00.000Z',beforeId:'one'}});
  });
  await assert.rejects(partial.exportAudit('org'),e=>e.status===503);
  const duplicated=new RemoteWorkspaces(async()=>Response.json({
    events:[{id:'one'}],nextCursor:{beforeAt:'2026-11-18T00:00:00.000Z',beforeId:'one'}
  }));
  await assert.rejects(duplicated.exportAudit('org'),/duplicados/);
});
