// End-to-end sin Cloudflare remoto: interfaz real + Worker real + SQLite (emulación D1).
// Las identidades se inyectan SOLO desde Playwright; producción verifica JWT de Access.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,relative,extname} from 'node:path';
import {once} from 'node:events';
import {DatabaseSync} from 'node:sqlite';
import {chromium} from 'playwright';
import {createHandler} from '../worker/index.js';
import {AccessError} from '../worker/auth.js';
import {makeEmpty} from '../src/governance/core.js';

const db=new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys=ON'); // D1 lo aplica automáticamente.
for(const filename of ['0001_atlas_v5.sql','0002_atlas_v5_history.sql']){
  db.exec(await readFile(new URL('../migrations/'+filename,import.meta.url),'utf8'));
}
const now='2026-11-18T00:00:00.000Z';
for(const [id,name] of [['org-a','Empresa A'],['org-b','Empresa B']])
  db.prepare('INSERT INTO atlas_tenants(id,name,created_at) VALUES(?,?,?)').run(id,name,now);
for(const [tenant,email,role] of [
 ['org-a','owner@a.test','owner'],['org-a','editor@a.test','editor'],
 ['org-a','viewer@a.test','viewer'],['org-b','owner@b.test','owner']])
  db.prepare("INSERT INTO atlas_memberships(tenant_id,email,role,status,created_at,updated_at) VALUES(?,?,?,'active',?,?)")
    .run(tenant,email,role,now,now);
const binding={
  prepare(sql){
    let args=[];
    return {
      bind(...params){args=params;return this;},
      async first(){return db.prepare(sql).get(...args)||null;},
      async all(){return {results:db.prepare(sql).all(...args)};},
      async run(){return {meta:db.prepare(sql).run(...args)};}
    };
  },
  async batch(statements){
    db.exec('BEGIN');
    try{
      const result=[];
      for(const item of statements)result.push(await item.run());
      db.exec('COMMIT');
      return result;
    }catch(error){db.exec('ROLLBACK');throw error;}
  }
};
const handler=createHandler({verify:async request=>{
  const email=request.headers.get('X-Local-Test-Identity');
  if(!email)throw new AccessError('Identity missing',401);
  return {email,sub:'sub-'+email,name:'Local synthetic identity'};
}});
const env={ATLAS_DB:binding};
const errors=[];
const root=resolve('dist');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8'};
const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    const pathname=decodeURIComponent(url.pathname);
    const filename=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    const rel=relative(root,filename);
    if(rel==='..'||rel.startsWith('../')||rel.startsWith('..\\')){
      res.writeHead(403).end();return;
    }
    const content=await readFile(filename);
    res.writeHead(200,{'content-type':types[extname(filename)]||'application/octet-stream','cache-control':'no-store'});
    res.end(content);
  }catch{res.writeHead(404).end('Not found');}
});
let browser;
try{
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const base='http://127.0.0.1:'+server.address().port;
  const direct=async(email,method,path,data)=>{
    const headers={'X-Local-Test-Identity':email,'Content-Type':'application/json',...(method==='GET'?{}:{'X-Atlas-CSRF':'v5'})};
    const response=await handler(new Request(base+path,{method,headers,...(data===undefined?{}:{body:JSON.stringify(data)})}),env);
    return {status:response.status,body:await response.json()};
  };
  const created=await direct('owner@a.test','POST','/api/v1/tenants/org-a/workspaces',{name:'ATLAS compartido',state:makeEmpty()});
  assert.equal(created.status,201);
  const id=created.body.id,basePath='/api/v1/tenants/org-a/workspaces/'+id;
  browser=await chromium.launch({headless:true,...(process.env.CI?{channel:'chrome'}:{})});
  const sessions=[];
  async function session(email){
    const context=await browser.newContext({viewport:{width:1280,height:850},acceptDownloads:true});
    let requests=0;
    await context.route('**/api/v1/**',async route=>{
      requests++;
      const original=route.request();
      const headers=new Headers(await original.allHeaders());
      headers.set('X-Local-Test-Identity',email);
      const method=original.method(),data=original.postData();
      const req=new Request(original.url(),{method,headers,...(data===null?{}:{body:data})});
      const response=await handler(req,env);
      await route.fulfill({status:response.status,contentType:'application/json',body:await response.text()});
    });
    const page=await context.newPage();
    page.on('pageerror',e=>errors.push(email+': '+e.message));
    await page.goto(base,{waitUntil:'networkidle'});
    const current={page,context,requests:()=>requests};sessions.push(current);
    assert.equal(current.requests(),0,'V4 no debe realizar llamadas API espontáneas');
    return current;
  }
  async function open(s){
    await s.page.locator('[data-workspace-command="connect"]').click();
    await s.page.locator('[data-workspace-command="open"]').waitFor({timeout:10000});
    await s.page.locator('[data-workspace-command="open"]').click();
    await s.page.getByText('Compartido: ATLAS compartido').waitFor();
  }
  async function addVertical(s,name){
    await s.page.locator('[data-view="verticals"]').click();
    await s.page.locator('[data-open="vertical"]').first().click();
    await s.page.locator('#field-name').fill(name);
    await s.page.locator('#field-owner').fill('Operaciones IT');
    await s.page.locator('#dialog-submit').click();
  }
  const owner=await session('owner@a.test');
  const editor=await session('editor@a.test');
  const viewer=await session('viewer@a.test');
  const localOwner=await owner.page.evaluate(()=>localStorage.getItem('atlas-governance-workspace-v1'));
  await Promise.all([open(owner),open(editor),open(viewer)]);
  assert.equal((await direct('viewer@a.test','GET',basePath)).status,200);
  await viewer.page.locator('[data-view="verticals"]').click();
  assert.equal(await viewer.page.locator('[data-open="vertical"]').first().isDisabled(),true);
  const illicit=await viewer.page.evaluate(async(path)=>{
    const res=await fetch(path,{method:'PUT',credentials:'same-origin',
      headers:{'Content-Type':'application/json','X-Atlas-CSRF':'v5'},
      body:JSON.stringify({revision:1,state:{}})});
    return res.status;
  },basePath);
  assert.equal(illicit,403,'El servidor impide escritura viewer aunque se fuerce fetch');
  assert.equal((await direct('owner@a.test','GET','/api/v1/tenants/org-b/workspaces/'+id)).status,403);

  await addVertical(owner,'Vertical desde owner');
  await owner.page.waitForFunction(()=>document.querySelector('#workspace-panel')?.textContent?.includes('r2'));
  await addVertical(editor,'Edición conflictiva');
  await editor.page.getByText('CAMBIOS SIN CONFIRMAR').waitFor();
  let ws=await direct('viewer@a.test','GET',basePath);
  assert.equal(ws.body.revision,2);
  assert.equal(ws.body.state.verticals.length,1);
  assert.equal(ws.body.state.verticals[0].name,'Vertical desde owner');
  const archive=editor.page.waitForEvent('download');
  await editor.page.locator('[data-workspace-command="backup"]').click();
  const downloaded=await archive;
  assert.ok(downloaded.suggestedFilename().includes('sin-confirmar'));
  assert.equal(await owner.page.evaluate(()=>localStorage.getItem('atlas-governance-workspace-v1')),localOwner,
    'Persistencia remota nunca sobrescribe localStorage V4');

  editor.page.once('dialog',dialog=>dialog.accept());
  await editor.page.locator('[data-workspace-command="reload"]').click();
  await editor.page.waitForFunction(()=>document.querySelector('#workspace-panel')?.textContent?.includes('r2'));
  await addVertical(editor,'Segunda edición reconciliada');
  await editor.page.waitForFunction(()=>document.querySelector('#workspace-panel')?.textContent?.includes('r3'));
  ws=await direct('viewer@a.test','GET',basePath);
  assert.deepEqual(ws.body.state.verticals.map(v=>v.name),
    ['Vertical desde owner','Segunda edición reconciliada']);

  await owner.page.locator('[data-workspace-command="reload"]').click();
  await owner.page.waitForFunction(()=>document.querySelector('#workspace-panel')?.textContent?.includes('r3'));
  await owner.page.locator('[data-workspace-command="history"]').click();
  await owner.page.locator('#workspace-restore-revision').waitFor();
  await owner.page.locator('#workspace-restore-revision').selectOption('1');
  owner.page.once('dialog',dialog=>dialog.accept());
  await owner.page.locator('[data-workspace-command="restore"]').click();
  await owner.page.waitForFunction(()=>document.querySelector('#workspace-panel')?.textContent?.includes('r4'));
  ws=await direct('viewer@a.test','GET',basePath);
  assert.equal(ws.body.revision,4);
  assert.deepEqual(ws.body.state.verticals,[]);
  const audit=await direct('owner@a.test','GET','/api/v1/tenants/org-a/audit');
  assert.deepEqual(audit.body.events.map(x=>x.action).sort(),
    ['workspace.created','workspace.restored','workspace.updated','workspace.updated']);

  const revoke=await direct('owner@a.test','PUT','/api/v1/tenants/org-a/members/editor@a.test',
    {role:'editor',status:'revoked'});
  assert.equal(revoke.status,200);
  await addVertical(editor,'Intento después de revocación');
  await editor.page.getByText('CAMBIOS SIN CONFIRMAR').waitFor();
  assert.equal((await direct('editor@a.test','GET',basePath)).status,403);
  ws=await direct('owner@a.test','GET',basePath);
  assert.equal(ws.body.revision,4,'Revocación no debe modificar el workspace');
  const finalAudit=await direct('owner@a.test','GET','/api/v1/tenants/org-a/audit');
  assert.equal(finalAudit.body.events[0].action,'membership.changed');
  assert.deepEqual(errors,[]);
  console.log('OK V5 multiusuario: Worker real+SQLite; owner/editor/viewer; conflicto y reconciliación; descarga; revocación; restauración y auditoría; V4 local intacta.');
} finally {
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
  db.close();
}
