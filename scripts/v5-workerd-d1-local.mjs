// Prueba de workerd + Cloudflare D1 LOCAL con Miniflare.
// No requiere cuenta, tokens, autenticación remota ni despliegue.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Miniflare} from 'miniflare';
import {build} from 'esbuild';
import {makeEmpty} from '../src/governance/core.js';

const entry=[
  "import {createHandler} from './worker/index.js';",
  "import {AccessError} from './worker/auth.js';",
  "// Verificador sintético exclusivo del test; el Worker productivo usa Access.",
  "const verify=async request=>{",
  "const email=request.headers.get('X-Atlas-Local-Test-Identity');",
  "if(!email)throw new AccessError();",
  "return {email,sub:'test-sub-'+email,name:'Usuario de laboratorio'};",
  "};",
  "export default {fetch:createHandler({verify})};"
].join('\n');
const built=await build({
  stdin:{contents:entry,resolveDir:process.cwd(),sourcefile:'v5-test-entry.js',loader:'js'},
  bundle:true,write:false,platform:'browser',format:'esm',target:'es2022'
});
const mf=new Miniflare({
  modules:true,script:built.outputFiles[0].text,
  // La versión workerd incluida con Miniflare en CI admite fechas hasta 2026-08-06.
  // Este ajuste es SOLO del test local; la plantilla V5 mantiene su fecha original.
  compatibilityDate:'2026-08-06',
  d1Databases:{ATLAS_DB:'00000000-0000-0000-0000-000000000005'}
});
try{
  const db=await mf.getD1Database('ATLAS_DB');
  for(const name of ['0001_atlas_v5.sql','0002_atlas_v5_history.sql']){
    // D1.exec interpreta líneas de manera distinta a SQLite; cada sentencia completa
    // se ejecuta con D1.prepare/run para probar el API real sin romper CREATE multilínea.
    const sql=(await readFile(new URL('../migrations/'+name,import.meta.url),'utf8'))
      .split('\n').filter(line=>!line.trimStart().startsWith('--')).join('\n');
    for(const statement of sql.split(';').map(x=>x.trim()).filter(Boolean))
      await db.prepare(statement).run();
  }
  // D1 bloquea PRAGMA integrity_check: validar esquema y constraints con sentencias admitidas.
  assert.equal((await db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name LIKE 'atlas_%'").first()).n,5);
  const stamp='2026-11-18T00:00:00.000Z';
  for(const [id,name] of [['org-a','Empresa A'],['org-b','Empresa B']])
    await db.prepare('INSERT INTO atlas_tenants(id,name,created_at) VALUES(?,?,?)')
      .bind(id,name,stamp).run();
  for(const [tenant,email,role] of [
    ['org-a','owner@a.test','owner'],
    ['org-a','admin@a.test','admin'],
    ['org-a','editor@a.test','editor'],
    ['org-a','viewer@a.test','viewer'],
    ['org-b','owner@b.test','owner']
  ])await db.prepare(
    "INSERT INTO atlas_memberships(tenant_id,email,role,status,created_at,updated_at) VALUES(?,?,?,'active',?,?)"
  ).bind(tenant,email,role,stamp,stamp).run();

  const call=async(email,method,path,data,extra={})=>{
    const headers={
      ...(email?{'X-Atlas-Local-Test-Identity':email}:{}),
      'Content-Type':'application/json',
      ...(method==='GET'?{}:{'X-Atlas-CSRF':'v5'}),...extra
    };
    const response=await mf.dispatchFetch('http://localhost:8787'+path,{
      method,headers,...(data===undefined?{}:{body:JSON.stringify(data)})
    });
    return {status:response.status,body:await response.json()};
  };
  const root='/api/v1/tenants/org-a/workspaces';
  assert.equal((await call('','GET',root)).status,401);
  assert.equal((await call('viewer@a.test','POST',root,{name:'Prohibido'})).status,403);
  const made=await call('owner@a.test','POST',root,{name:'ATLAS D1 local',state:makeEmpty()});
  assert.equal(made.status,201,JSON.stringify(made));
  const path=root+'/'+made.body.id;
  assert.equal((await call('viewer@a.test','GET',path)).body.revision,1);
  const stateA=makeEmpty();
  stateA.verticals.push({id:'a',name:'Plataformas',owner:'IT',description:''});
  const stateB=makeEmpty();
  stateB.verticals.push({id:'b',name:'Conectividad',owner:'IT',description:''});
  const concurrent=await Promise.all([
    call('owner@a.test','PUT',path,{revision:1,state:stateA}),
    call('editor@a.test','PUT',path,{revision:1,state:stateB})
  ]);
  assert.deepEqual(concurrent.map(x=>x.status).sort(),[200,409],
    'La revisión optimista debe funcionar también con D1 local real');
  assert.equal((await call('viewer@a.test','PUT',path,{revision:2,state:stateA})).status,403);
  assert.equal((await call('owner@b.test','GET',path)).status,403);
  assert.equal((await call('owner@a.test','PUT',path,{revision:2,state:stateA},
    {'X-Atlas-CSRF':''})).status,403);
  const latest=await call('viewer@a.test','GET',path);
  assert.equal(latest.body.revision,2);
  assert.equal(latest.body.state.verticals.length,1);
  const count=await db.prepare(
    'SELECT count(*) AS n FROM atlas_audit_events WHERE tenant_id=? AND workspace_id=?'
  ).bind('org-a',made.body.id).first();
  assert.equal(count.n,2);
  const history=await call('owner@a.test','GET',path+'/revisions');
  assert.deepEqual(history.body.revisions.map(x=>x.revision),[2,1]);
  const restored=await call('owner@a.test','PUT',path+'/revisions/1/restore',{revision:2});
  assert.equal(restored.status,200,JSON.stringify(restored));
  assert.equal(restored.body.revision,3);
  assert.deepEqual((await call('viewer@a.test','GET',path)).body.state.verticals,[]);
  // La misma sentencia UPSERT de membresía y su auditoría se prueban contra D1 real local.
  const member='/api/v1/tenants/org-a/members/test-member@a.test';
  assert.equal((await call('admin@a.test','PUT',member,
    {role:'viewer',status:'active'})).status,200);
  assert.equal((await call('test-member@a.test','GET',root)).status,200);
  assert.equal((await call('admin@a.test','PUT',member,
    {role:'owner',status:'active'})).status,403);
  assert.equal((await call('owner@a.test','PUT',member,
    {role:'admin',status:'active'})).status,200);
  assert.equal((await call('admin@a.test','PUT',member,
    {role:'viewer',status:'revoked'})).status,403);
  assert.equal((await call('owner@a.test','PUT',member,
    {role:'admin',status:'revoked'})).status,200);
  assert.equal((await call('test-member@a.test','GET',root)).status,403);
  const membershipAudits=await db.prepare(
    "SELECT COUNT(*) AS n FROM atlas_audit_events WHERE tenant_id=? AND action='membership.changed'"
  ).bind('org-a').first();
  assert.equal(membershipAudits.n,3);
  assert.equal((await db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name LIKE 'atlas_%'").first()).n,5);

  // D1.batch debe abortar toda la transacción si una sentencia falla.
  const before=await db.prepare('SELECT count(*) AS n FROM atlas_audit_events').first();
  await assert.rejects(db.batch([
    db.prepare("INSERT INTO atlas_audit_events(id,tenant_id,actor_email,action,metadata_json,occurred_at) VALUES('rollback-test','org-a','owner@a.test','test.rollback','{}',?)").bind(stamp),
    db.prepare("INSERT INTO atlas_workspaces(id,tenant_id,name,revision,state_json,created_by,updated_by,created_at,updated_at) VALUES('invalid-fk','invalid-tenant','invalid',1,'{}','x','x',?,?)").bind(stamp,stamp)
  ]));
  const after=await db.prepare('SELECT count(*) AS n FROM atlas_audit_events').first();
  assert.equal(after.n,before.n);
  console.log('OK V5 workerd/D1: migraciones, roles y membresías, concurrencia 409, auditoría, restauración y rollback transaccional en Miniflare local.');
}finally{await mf.dispose();}
