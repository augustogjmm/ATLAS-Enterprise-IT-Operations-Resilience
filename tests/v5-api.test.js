import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {createHandler} from '../worker/index.js';
import {makeEmpty} from '../src/governance/core.js';

function fixture() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../migrations/0001_atlas_v5.sql', import.meta.url), 'utf8'));
  const stamp='2026-11-18T00:00:00.000Z';
  for (const [id,name] of [['org-a','Organización A'],['org-b','Organización B']])
    sqlite.prepare('INSERT INTO atlas_tenants(id,name,created_at) VALUES(?,?,?)').run(id,name,stamp);
  for (const [org,email,role] of [
    ['org-a','owner@a.test','owner'],['org-a','admin@a.test','admin'],
    ['org-a','editor@a.test','editor'],['org-a','viewer@a.test','viewer'],
    ['org-a','auditor@a.test','auditor'],['org-b','owner@b.test','owner']
  ]) sqlite.prepare("INSERT INTO atlas_memberships(tenant_id,email,role,status,created_at,updated_at) VALUES(?,?,?,'active',?,?)")
    .run(org,email,role,stamp,stamp);
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
  return {sqlite,env,call};
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
