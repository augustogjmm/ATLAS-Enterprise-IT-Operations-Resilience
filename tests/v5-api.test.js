import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {createHandler} from '../worker/index.js';
import {makeEmpty} from '../src/governance/core.js';

function fixture() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys=ON'); // Simula enforcement obligatorio de D1.
  sqlite.exec(readFileSync(new URL('../migrations/0001_atlas_v5.sql', import.meta.url), 'utf8'));
  sqlite.exec(readFileSync(new URL('../migrations/0002_atlas_v5_history.sql', import.meta.url), 'utf8'));
  const stamp='2026-11-18T00:00:00.000Z';
  for (const [id,name] of [['org-a','Organización A'],['org-b','Organización B']])
    sqlite.prepare('INSERT INTO atlas_tenants(id,name,created_at) VALUES(?,?,?)').run(id,name,stamp);
  for (const [org,email,role] of [
    ['org-a','owner@a.test','owner'],['org-a','admin@a.test','admin'],
    ['org-a','editor@a.test','editor'],['org-a','viewer@a.test','viewer'],
    ['org-a','auditor@a.test','auditor'],['org-b','owner@b.test','owner']
  ]) sqlite.prepare("INSERT INTO atlas_memberships(tenant_id,email,role,status,created_at,updated_at) VALUES(?,?,?,'active',?,?)")
    .run(org,email,role,stamp,stamp);
  let beforeNextBatch=null;
  const binding = {
    prepare(sql) {
      let args=[];
      return {
        bind(...params) {args=params;return this;},
        async first() {return sqlite.prepare(sql).get(...args) || null;},
        async all() {return {results:sqlite.prepare(sql).all(...args)};},
        async run() {return {meta:sqlite.prepare(sql).run(...args)};}
      };
    },
    async batch(statements) {
      // Deterministic interleaving: revocation after memberFor(), before transaction.
      const hook=beforeNextBatch;beforeNextBatch=null;
      if(hook)hook(sqlite);
      sqlite.exec('BEGIN');
      try {
        const results=[];
        for(const stmt of statements) results.push(await stmt.run());
        sqlite.exec('COMMIT');
        return results;
      } catch(error) {sqlite.exec('ROLLBACK');throw error;}
    }
  };
  const env={ATLAS_DB:binding};
  const handler=createHandler({verify:async request=>{
    const email=request.headers.get('X-Test-Email');
    if (!email) throw Object.assign(new Error('Sin identidad'),{status:401});
    return {email,sub:'access-'+email,name:'Cuenta de prueba'};
  }});
  async function call(email, method, path, body, extra={}) {
    const headers={'X-Test-Email':email,'Content-Type':'application/json','X-Atlas-CSRF':'v5',...extra};
    const req=new Request('https://atlas.example'+path,{
      method,headers,...(body===undefined?{}:{body:JSON.stringify(body)})
    });
    const response=await handler(req,env);
    return {status:response.status,body:await response.json()};
  }
  return {sqlite,env,call,beforeBatch:hook=>{beforeNextBatch=hook;}};
}

test('multi-tenant: sesión sin permisos sobre otra organización',async()=>{
  const {call}=fixture();
  const session=await call('viewer@a.test','GET','/api/v1/session');
  assert.equal(session.status,200);
  assert.deepEqual(session.body.tenants.map(t=>t.tenant_id),['org-a']);
  const forbidden=await call('viewer@a.test','GET','/api/v1/tenants/org-b/workspaces');
  assert.equal(forbidden.status,403);
  assert.equal((await call('stranger@a.test','GET','/api/v1/tenants/org-a/workspaces')).status,403);
});

test('RBAC: viewer, auditor y editor no administran miembros',async()=>{
  const {call}=fixture();
  const path='/api/v1/tenants/org-a/workspaces';
  assert.equal((await call('viewer@a.test','POST',path,{name:'Privado'})).status,403);
  assert.equal((await call('auditor@a.test','POST',path,{name:'Privado'})).status,403);
  const created=await call('editor@a.test','POST',path,{name:'Operaciones',state:makeEmpty()});
  assert.equal(created.status,201);
  assert.equal(created.body.revision,1);
  const id=created.body.id;
  assert.equal((await call('viewer@a.test','GET',path+'/'+id)).status,200);
  assert.equal((await call('viewer@a.test','PUT',path+'/'+id,{revision:1,state:makeEmpty()})).status,403);
  assert.equal((await call('editor@a.test','GET','/api/v1/tenants/org-a/audit')).status,403);
  assert.equal((await call('auditor@a.test','GET','/api/v1/tenants/org-a/audit')).status,200);
});

test('persistencia: revisión optimista y auditoría separada de eventos editables',async()=>{
  const {call,sqlite}=fixture();
  const base='/api/v1/tenants/org-a/workspaces';
  const created=await call('owner@a.test','POST',base,{name:'Gobierno',state:makeEmpty()});
  const id=created.body.id;
  const state=makeEmpty();state.verticals.push({id:'v-a',name:'Operaciones',owner:'IT',description:''});
  const first=await call('editor@a.test','PUT',base+'/'+id,{revision:1,state});
  assert.equal(first.status,200);
  assert.equal(first.body.revision,2);
  const stale=await call('admin@a.test','PUT',base+'/'+id,{revision:1,state:makeEmpty()});
  assert.equal(stale.status,409);
  const current=await call('viewer@a.test','GET',base+'/'+id);
  assert.equal(current.body.revision,2);
  assert.equal(current.body.state.verticals[0].id,'v-a');
  const audits=await call('auditor@a.test','GET','/api/v1/tenants/org-a/audit');
  assert.deepEqual(audits.body.events.map(e=>e.action).sort(),['workspace.created','workspace.updated']);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM atlas_audit_events').get().count,2);
});

test('scope: incluso con ID de workspace válido no se puede leer ni escribir otra organización',async()=>{
  const {call}=fixture();
  const made=await call('owner@b.test','POST','/api/v1/tenants/org-b/workspaces',{name:'B'});
  assert.equal(made.status,201);
  const foreign='/api/v1/tenants/org-a/workspaces/'+made.body.id;
  assert.equal((await call('owner@a.test','GET',foreign)).status,404);
  assert.equal((await call('owner@a.test','PUT',foreign,{revision:1,state:makeEmpty()})).status,404);
  assert.equal((await call('viewer@a.test','GET','/api/v1/tenants/org-b/audit')).status,403);
});

test('gobierno: privilegios de owner, administración y revocación',async()=>{
  const {call}=fixture();
  const p='/api/v1/tenants/org-a/members/new@a.test';
  assert.equal((await call('admin@a.test','PUT',p,{role:'owner',status:'active'})).status,403);
  assert.equal((await call('owner@a.test','PUT',p,{role:'viewer',status:'active'})).status,200);
  assert.equal((await call('new@a.test','GET','/api/v1/tenants/org-a/workspaces')).status,200);
  assert.equal((await call('owner@a.test','PUT',p,{role:'viewer',status:'revoked'})).status,200);
  assert.equal((await call('new@a.test','GET','/api/v1/tenants/org-a/workspaces')).status,403);
  assert.equal((await call('owner@a.test','PUT','/api/v1/tenants/org-a/members/owner@a.test',{role:'viewer',status:'active'})).status,403);
});

test('validación y fail-closed: JSON, respaldo, origen y binding',async()=>{
  const {call,env}=fixture();
  const path='/api/v1/tenants/org-a/workspaces';
  assert.equal((await call('owner@a.test','POST',path,{name:'X',state:{version:99}})).status,400);
  assert.equal((await call('owner@a.test','POST',path,{name:'X'},{Origin:'https://malicioso.test'})).status,403);
  assert.equal((await call('owner@a.test','POST',path,{name:'X'},{'X-Atlas-CSRF':''})).status,403);
  assert.equal((await call('owner@a.test','POST',path,{name:'X'},{'Sec-Fetch-Site':'cross-site'})).status,403);
  const unconfigured=await createHandler({verify:async()=>({email:'owner@a.test',sub:'x'})})(
    new Request('https://atlas.example/api/v1/session'),{});
  assert.equal(unconfigured.status,503);
  env.ATLAS_DB=null;
});

test('historial: retiene las últimas cinco revisiones sin perder auditoría',async()=>{
  const {call,sqlite}=fixture();
  const base='/api/v1/tenants/org-a/workspaces';
  const created=await call('owner@a.test','POST',base,{name:'Con historial',state:makeEmpty()});
  assert.equal(created.status,201);
  const id=created.body.id,endpoint=base+'/'+id;
  assert.equal((await call('viewer@a.test','GET',endpoint+'/revisions')).status,403);
  const initial=await call('auditor@a.test','GET',endpoint+'/revisions');
  assert.deepEqual(initial.body.revisions.map(x=>x.revision),[1]);
  for(let revision=1;revision<=6;revision++){
    const state=makeEmpty();
    for(let n=0;n<revision;n++){
      state.verticals.push({id:'vert-'+n,name:'Vertical '+n,owner:'Infraestructura',description:''});
    }
    const saved=await call('editor@a.test','PUT',endpoint,{revision,state});
    assert.equal(saved.status,200);
    assert.equal(saved.body.revision,revision+1);
  }
  const history=await call('auditor@a.test','GET',endpoint+'/revisions');
  assert.deepEqual(history.body.revisions.map(x=>x.revision),[7,6,5,4,3]);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM atlas_workspace_revisions WHERE workspace_id=?').get(id).count,5);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM atlas_audit_events WHERE workspace_id=?').get(id).count,7);
  assert.equal(Object.hasOwn(history.body.revisions[0],'state_json'),false,
    'El listado no expone snapshots completos');
});

test('restauración: solo owner/admin, nueva revisión y trazabilidad',async()=>{
  const {call,sqlite}=fixture();
  const base='/api/v1/tenants/org-a/workspaces';
  const made=await call('owner@a.test','POST',base,{name:'Recuperación',state:makeEmpty()});
  const endpoint=base+'/'+made.body.id;
  const s=makeEmpty();
  s.verticals.push({id:'infra',name:'Infraestructura',owner:'Gerencia',description:'Laboratorio'});
  assert.equal((await call('editor@a.test','PUT',endpoint,{revision:1,state:s})).status,200);
  assert.equal((await call('viewer@a.test','PUT',endpoint+'/revisions/1/restore',{revision:2})).status,403);
  assert.equal((await call('editor@a.test','PUT',endpoint+'/revisions/1/restore',{revision:2})).status,403);
  const restored=await call('admin@a.test','PUT',endpoint+'/revisions/1/restore',{revision:2});
  assert.equal(restored.status,200);
  assert.deepEqual({revision:restored.body.revision,from:restored.body.restoredFrom},{revision:3,from:1});
  const current=await call('viewer@a.test','GET',endpoint);
  assert.equal(current.body.revision,3);
  assert.deepEqual(current.body.state.verticals,[]);
  const stale=await call('owner@a.test','PUT',endpoint+'/revisions/1/restore',{revision:2});
  assert.equal(stale.status,409);
  const missing=await call('owner@a.test','PUT',endpoint+'/revisions/999/restore',{revision:3});
  assert.equal(missing.status,404);
  const audit=await call('auditor@a.test','GET','/api/v1/tenants/org-a/audit');
  const restorations=audit.body.events.filter(e=>e.action==='workspace.restored');
  assert.equal(restorations.length,1);
  assert.equal(restorations[0].metadata.sourceRevision,1);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM atlas_workspace_revisions WHERE workspace_id=?').get(made.body.id).count,3);
});

test('restauración: no puede acceder a otra organización aunque conozca su ID',async()=>{
  const {call}=fixture();
  const base='/api/v1/tenants/org-b/workspaces';
  const created=await call('owner@b.test','POST',base,{name:'Privado',state:makeEmpty()});
  const alien='/api/v1/tenants/org-a/workspaces/'+created.body.id+'/revisions';
  assert.equal((await call('owner@a.test','GET',alien)).status,404);
  assert.equal((await call('owner@a.test','PUT',alien+'/1/restore',{revision:1})).status,404);
  assert.equal((await call('owner@a.test','GET',base+'/'+created.body.id+'/revisions')).status,403);
});

test('límite de tamaño: rechaza cuerpo mayor a 1 MiB sin Content-Length',async()=>{
  const {call}=fixture();
  const large='x'.repeat(1024*1024+100);
  const response=await call('owner@a.test','POST','/api/v1/tenants/org-a/workspaces',{name:large,state:makeEmpty()});
  assert.equal(response.status,413);
});

test('gobierno de costos: máximo diez workspaces por organización, rechazo sin auditoría extra',async()=>{
  const {call,sqlite}=fixture();
  const base='/api/v1/tenants/org-a/workspaces';
  for(let n=0;n<10;n++){
    const made=await call('owner@a.test','POST',base,{name:'Espacio '+n,state:makeEmpty()});
    assert.equal(made.status,201);
  }
  const over=await call('owner@a.test','POST',base,{name:'Exceso',state:makeEmpty()});
  assert.equal(over.status,429);
  assert.match(over.body.error,/límite de 10 workspaces/);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM atlas_workspaces WHERE tenant_id=?').get('org-a').n,10);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM atlas_audit_events WHERE tenant_id=?').get('org-a').n,10);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM atlas_workspace_revisions WHERE tenant_id=?').get('org-a').n,10);
  // El cupo de otra organización no depende de las operaciones de org-a.
  assert.equal((await call('owner@b.test','POST','/api/v1/tenants/org-b/workspaces',{name:'Independiente'})).status,201);
  assert.equal((await call('viewer@a.test','GET',base)).status,200);
});

test('servidor V5: JSON no puede fabricar cierres de riesgos ni alterar evidencias finalizadas',async()=>{
  const {call,sqlite}=fixture();
  const root='/api/v1/tenants/org-a/workspaces';
  const state=makeEmpty();
  state.verticals.push({id:'v1',name:'Operaciones',owner:'IT',description:''});
  state.risks.push({id:'r1',verticalId:'v1',serviceId:'',assessmentId:'',capacityId:'',title:'Riesgo',
    description:'',owner:'IT',probability:4,impact:5,status:'abierto',evidence:'',source:'manual',createdAt:'2026-11-18'});
  state.actions.push({id:'a1',riskId:'r1',title:'Corregir',owner:'IT',dueDate:'2026-12-01',
    status:'pendiente',evidence:'',createdAt:'2026-11-18'});
  const created=await call('owner@a.test','POST',root,{name:'Políticas',state});
  assert.equal(created.status,201);
  const endpoint=root+'/'+created.body.id;
  const forged=structuredClone(state);forged.risks[0].status='validado';forged.risks[0].evidence='Evidencia ficticia';forged.risks[0].validatedAt='2026-11-18';
  const forbidden=await call('editor@a.test','PUT',endpoint,{revision:1,state:forged});
  assert.equal(forbidden.status,422);
  assert.equal((await call('viewer@a.test','GET',endpoint)).body.revision,1);
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM atlas_audit_events').get().n,1);
  const completed=structuredClone(state);
  completed.actions[0].status='completada';completed.actions[0].evidence='Evidencia de tarea concluida';completed.actions[0].completedAt='2026-11-18';
  assert.equal((await call('editor@a.test','PUT',endpoint,{revision:1,state:completed})).status,200);
  completed.risks[0].status='validado';completed.risks[0].evidence='Evidencia de mitigación verificada';
  completed.risks[0].validatedAt='2026-11-18';
  assert.equal((await call('editor@a.test','PUT',endpoint,{revision:2,state:completed})).status,200);
  const altered=structuredClone(completed);altered.actions[0].evidence='Cierre alterado';
  assert.equal((await call('admin@a.test','PUT',endpoint,{revision:3,state:altered})).status,422);
  assert.equal((await call('viewer@a.test','GET',endpoint)).body.revision,3);
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM atlas_audit_events').get().n,3);
});

test('revocación concurrente: permisos de editor se verifican DENTRO de la creación D1',async()=>{
  const {call,sqlite,beforeBatch}=fixture();
  const root='/api/v1/tenants/org-a/workspaces';
  beforeBatch(db=>db.prepare(
    "UPDATE atlas_memberships SET status='revoked' WHERE tenant_id=? AND email=?"
  ).run('org-a','editor@a.test'));
  const response=await call('editor@a.test','POST',root,{name:'No se debe crear'});
  assert.equal(response.status,403);
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM atlas_workspaces').get().n,0);
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM atlas_workspace_revisions').get().n,0);
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM atlas_audit_events').get().n,0);
});

test('revocación concurrente: escritura iniciada antes de revocar no puede modificar ni auditar',async()=>{
  const {call,sqlite,beforeBatch}=fixture();
  const root='/api/v1/tenants/org-a/workspaces';
  const created=await call('owner@a.test','POST',root,{name:'Protegido',state:makeEmpty()});
  assert.equal(created.status,201);
  const path=root+'/'+created.body.id;
  const altered=makeEmpty();
  altered.verticals.push({id:'v1',name:'Infraestructura',owner:'IT',description:''});
  beforeBatch(db=>db.prepare(
    "UPDATE atlas_memberships SET status='revoked' WHERE tenant_id=? AND email=?"
  ).run('org-a','editor@a.test'));
  const response=await call('editor@a.test','PUT',path,{revision:1,state:altered});
  assert.equal(response.status,403);
  const current=await call('viewer@a.test','GET',path);
  assert.equal(current.body.revision,1);
  assert.deepEqual(current.body.state.verticals,[]);
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM atlas_audit_events').get().n,1);
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM atlas_workspace_revisions').get().n,1);
});

test('cambio de rol concurrente: admin degradado no puede restaurar una versión antigua',async()=>{
  const {call,sqlite,beforeBatch}=fixture();
  const root='/api/v1/tenants/org-a/workspaces';
  const created=await call('owner@a.test','POST',root,{name:'Histórico',state:makeEmpty()});
  assert.equal(created.status,201);
  const path=root+'/'+created.body.id;
  const modified=makeEmpty();
  modified.verticals.push({id:'v1',name:'Plataformas',owner:'IT',description:''});
  assert.equal((await call('owner@a.test','PUT',path,{revision:1,state:modified})).status,200);
  beforeBatch(db=>db.prepare(
    "UPDATE atlas_memberships SET role='viewer' WHERE tenant_id=? AND email=?"
  ).run('org-a','admin@a.test'));
  const rejected=await call('admin@a.test','PUT',path+'/revisions/1/restore',{revision:2});
  assert.equal(rejected.status,403);
  const current=await call('viewer@a.test','GET',path);
  assert.equal(current.body.revision,2);
  assert.deepEqual(current.body.state.verticals.map(v=>v.name),['Plataformas']);
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM atlas_audit_events').get().n,2);
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM atlas_workspace_revisions').get().n,2);
});
