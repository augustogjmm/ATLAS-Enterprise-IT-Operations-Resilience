// Integra JWT RS256 válido, identidad Access, RBAC y SQLite sin Cloudflare remoto.
// El servidor de claves es simulado; las firmas NO se omiten ni se falsifican.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {createHandler} from '../worker/index.js';
import {verifyAccessToken} from '../worker/auth.js';
import {makeEmpty} from '../src/governance/core.js';

async function setup() {
  const sqlite=new DatabaseSync(':memory:');
  for(const migration of ['0001_atlas_v5.sql','0002_atlas_v5_history.sql']){
    sqlite.exec(readFileSync(new URL('../migrations/'+migration,import.meta.url),'utf8'));
  }
  const stamp='2026-11-18T00:00:00Z';
  for(const [id,name] of [['org-a','Organización A'],['org-b','Organización B']])
    sqlite.prepare('INSERT INTO atlas_tenants(id,name,created_at) VALUES(?,?,?)').run(id,name,stamp);
  for(const [org,email,role] of [
    ['org-a','owner@a.test','owner'],
    ['org-a','editor@a.test','editor'],
    ['org-a','viewer@a.test','viewer'],
    ['org-b','owner@b.test','owner']
  ])sqlite.prepare("INSERT INTO atlas_memberships(tenant_id,email,role,status,created_at,updated_at) VALUES(?,?,?,'active',?,?)")
    .run(org,email,role,stamp,stamp);
  const rsa=await crypto.subtle.generateKey({
    name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'
  },true,['sign','verify']);
  const jwk=await crypto.subtle.exportKey('jwk',rsa.publicKey);
  jwk.kid='atlas-v5-signed-integration-key';
  const origin='https://atlas-v5-integration.cloudflareaccess.com';
  const aud='atlas-v5-test-only-audience';
  const env={ACCESS_TEAM_DOMAIN:origin,ACCESS_AUD:aud};
  const fakeJwks=async url=>{
    assert.equal(url,origin+'/cdn-cgi/access/certs');
    return Response.json({keys:[jwk]});
  };
  const db={
    prepare(sql){
      let args=[];
      return {
        bind(...values){args=values;return this;},
        async first(){return sqlite.prepare(sql).get(...args)||null;},
        async all(){return {results:sqlite.prepare(sql).all(...args)};},
        async run(){return {meta:sqlite.prepare(sql).run(...args)};}
      };
    },
    async batch(commands){
      sqlite.exec('BEGIN');
      try{
        const result=[];
        for(const command of commands)result.push(await command.run());
        sqlite.exec('COMMIT');
        return result;
      }catch(error){sqlite.exec('ROLLBACK');throw error;}
    }
  };
  const handler=createHandler({
    verify:(request,binding)=>verifyAccessToken(request,binding,fakeJwks)
  });
  const toBase64=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
  async function token(email,sub='access-'+email,override={}){
    const now=Math.floor(Date.now()/1000);
    const header=toBase64({alg:'RS256',typ:'JWT',kid:jwk.kid});
    const payload=toBase64({
      iss:origin,aud,sub,email,iat:now-10,nbf:now-10,exp:now+900,...override
    });
    const unsigned=header+'.'+payload;
    const signature=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',rsa.privateKey,new TextEncoder().encode(unsigned));
    return unsigned+'.'+Buffer.from(signature).toString('base64url');
  }
  async function request(jwt,method,path,data,headers={}){
    const req=new Request('https://atlas.example'+path,{
      method,
      headers:{
        ...(jwt?{'Cf-Access-Jwt-Assertion':jwt}:{}),
        'Content-Type':'application/json',
        ...(method==='GET'?{}:{'X-Atlas-CSRF':'v5'}),
        ...headers
      },
      ...(data===undefined?{}:{body:JSON.stringify(data)})
    });
    const response=await handler(req,{...env,ATLAS_DB:db});
    return {status:response.status,body:await response.json()};
  }
  return {sqlite,token,request};
}

test('V5 integrado: Access RS256 firmado controla sesión, tenant, permisos y revocación',async()=>{
  const {sqlite,token,request}=await setup();
  try{
    const owner=await token('owner@a.test');
    const viewer=await token('viewer@a.test');
    const editor=await token('editor@a.test');
    const outsider=await token('owner@b.test');
    const root='/api/v1/tenants/org-a/workspaces';
    assert.equal((await request(null,'GET','/api/v1/session')).status,401,
      'No es posible obtener sesión sin token firmado');
    assert.equal((await request(owner,'GET','/api/v1/session')).status,200);
    assert.deepEqual((await request(owner,'GET','/api/v1/session')).body.tenants.map(t=>t.tenant_id),['org-a']);
    const created=await request(owner,'POST',root,{name:'Integración firmada',state:makeEmpty()});
    assert.equal(created.status,201);
    const path=root+'/'+created.body.id;
    assert.equal((await request(viewer,'GET',path)).status,200);
    assert.equal((await request(viewer,'PUT',path,{revision:1,state:makeEmpty()})).status,403);
    assert.equal((await request(editor,'PUT',path,{revision:1,state:makeEmpty()})).status,200);
    assert.equal((await request(owner,'GET',path)).body.revision,2);
    assert.equal((await request(outsider,'GET',path)).status,403);
    assert.equal((await request(viewer,'GET','/api/v1/tenants/org-b/workspaces')).status,403);

    // La primera lectura fija email+sub; otro sujeto con el mismo email no suplanta acceso.
    const impersonator=await token('owner@a.test','acceso-dispositivo-diferente');
    assert.equal((await request(impersonator,'GET',root)).status,403);
    const forgedAudience=await token('owner@a.test',undefined,{aud:'otro-servicio'});
    assert.equal((await request(forgedAudience,'GET',root)).status,401);
    const expired=await token('owner@a.test',undefined,{exp:Math.floor(Date.now()/1000)-10});
    assert.equal((await request(expired,'GET',root)).status,401);
    const tampered=owner.split('.');
    tampered[1]=Buffer.from(JSON.stringify({email:'owner@b.test',sub:'access-owner@b.test'})).toString('base64url');
    assert.equal((await request(tampered.join('.'),'GET',root)).status,401);

    assert.equal((await request(owner,'PUT','/api/v1/tenants/org-a/members/editor@a.test',
      {role:'editor',status:'revoked'})).status,200);
    assert.equal((await request(editor,'GET',path)).status,403);
    assert.equal((await request(editor,'PUT',path,{revision:2,state:makeEmpty()})).status,403);
    assert.equal((await request(owner,'GET',path)).body.revision,2);
    const audits=await request(owner,'GET','/api/v1/tenants/org-a/audit');
    assert.deepEqual(audits.body.events.map(e=>e.action).sort(),
      ['membership.changed','workspace.created','workspace.updated']);
    assert.equal(sqlite.prepare('SELECT count(*) AS n FROM atlas_audit_events').get().n,3);
  }finally{sqlite.close();}
});

test('V5 integrado: CSRF, JWT de otro emisor y permisos permanecen fail-closed',async()=>{
  const {sqlite,token,request}=await setup();
  try{
    const owner=await token('owner@a.test');
    const root='/api/v1/tenants/org-a/workspaces';
    assert.equal((await request(owner,'POST',root,{name:'Prueba'},
      {'X-Atlas-CSRF':''})).status,403);
    assert.equal((await request(owner,'POST',root,{name:'Prueba'},
      {'Origin':'https://evil.example'})).status,403);
    assert.equal((await request(owner,'POST',root,{name:'Prueba'},
      {'Sec-Fetch-Site':'cross-site'})).status,403);
    const anotherIssuer=await token('owner@a.test',undefined,
      {iss:'https://otro.cloudflareaccess.com'});
    assert.equal((await request(anotherIssuer,'GET',root)).status,401);
    const unknown=await token('unknown@a.test');
    assert.equal((await request(unknown,'GET','/api/v1/session')).status,200);
    assert.deepEqual((await request(unknown,'GET','/api/v1/session')).body.tenants,[]);
    assert.equal((await request(unknown,'GET',root)).status,403);
    assert.equal(sqlite.prepare('SELECT count(*) AS n FROM atlas_workspaces').get().n,0);
  }finally{sqlite.close();}
});
