import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,relative,extname} from 'node:path';
import {once} from 'node:events';
import {chromium} from 'playwright';
import {createDemo} from '../src/governance/core.js';

const root=resolve('dist'),errors=[];
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8'};
const server=createServer(async(request,response)=>{
  try {
    const path=decodeURIComponent(new URL(request.url,'http://localhost').pathname);
    const file=resolve(root,'.'+(path==='/'?'/index.html':path));
    const rel=relative(root,file);
    if(rel==='..'||rel.startsWith('../')||rel.startsWith('..\\')){response.writeHead(403).end();return;}
    const bytes=await readFile(file);
    response.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream','cache-control':'no-store'});
    response.end(bytes);
  } catch{response.writeHead(404).end('Not found');}
});
let browser;
try{
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const base='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true,...(process.env.CI?{channel:'chrome'}:{})});

  async function setup(role='editor'){
    const page=await browser.newPage({viewport:{width:1300,height:850},acceptDownloads:true});
    page.on('pageerror',e=>errors.push(e.message));
    const requests=[];
    const historical=createDemo();
    let revision=role==='owner'?2:1, conflict=false, dropAck=false, stored=createDemo();
    if(role==='owner')stored.verticals.push({id:'v-owner-added',name:'Restaurar después',owner:'IT',description:'Prueba V5'});
    const tenant='org-demo',id='ws-demo';
    await page.route('**/api/v1/**',async route=>{
      const req=route.request(),url=new URL(req.url()),method=req.method(),path=url.pathname;
      requests.push({method,path});
      let status=200,data={};
      if(path==='/api/v1/session'&&method==='GET')
        data={identity:{email:role+'@example.test'},tenants:[{tenant_id:tenant,name:'Demo ATLAS'}]};
      else if(path==='/api/v1/tenants/'+tenant+'/workspaces'&&method==='GET')
        data={role,workspaces:[{id,name:'Gobierno Compartido',revision}]};
      else if(path==='/api/v1/tenants/'+tenant+'/workspaces/'+id&&method==='GET')
        data={id,name:'Gobierno Compartido',revision,state:stored};
      else if(path==='/api/v1/tenants/'+tenant+'/audit/export'&&method==='GET'){
        if(!['owner','admin','auditor'].includes(role)){status=403;data={error:'Permiso insuficiente'};}
        else if(url.searchParams.has('beforeAt'))
          data={events:[{id:'audit-1',actor_email:'owner@example.test',action:'workspace.created',occurred_at:'2026-11-17T12:00:00.000Z'}],nextCursor:null};
        else
          data={events:[{id:'audit-2',actor_email:'owner@example.test',action:'workspace.updated',occurred_at:'2026-11-18T12:00:00.000Z'}],
            nextCursor:{beforeAt:'2026-11-18T12:00:00.000Z',beforeId:'audit-2'}};
      }
      else if(path==='/api/v1/tenants/'+tenant+'/workspaces/'+id+'/revisions'&&method==='GET'){
        if(['owner','admin','auditor'].includes(role))
          data={revisions:[{revision,actor_email:'owner@example.test',created_at:'2026-11-18T12:00:00Z'},...(revision>1?[{revision:1,actor_email:'owner@example.test',created_at:'2026-11-18T11:00:00Z'}]:[])],retained:5};
        else{status=403;data={error:'Permiso insuficiente'};}
      }
      else if(path==='/api/v1/tenants/'+tenant+'/workspaces/'+id+'/revisions/1/restore'&&method==='PUT'){
        const received=req.postDataJSON();
        if(!['owner','admin'].includes(role)){status=403;data={error:'Rol insuficiente'};}
        else if(received.revision!==revision){status=409;data={error:'Conflicto de revisión'};}
        else{stored=structuredClone(historical);revision++;data={id,revision,restoredFrom:1};}
      }
      else if(path==='/api/v1/tenants/'+tenant+'/workspaces/'+id&&method==='PUT'){
        const received=req.postDataJSON();
        if(role==='viewer'){status=403;data={error:'Permiso insuficiente'};}
        else if(conflict||received.revision!==revision){status=409;data={error:'Conflicto de revisión'};}
        else{
          stored=received.state;revision++;data={id,revision};
          if(dropAck){dropAck=false;await route.abort('failed');return;}
        }
      }else{status=404;data={error:'Ruta inexistente'};}
      await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
    });
    await page.goto(base,{waitUntil:'networkidle'});
    return {page,requests,flipConflict:()=>{conflict=true;},loseAckOnce:()=>{dropAck=true;},revision:()=>revision,stored:()=>stored};
  }

  const editor=await setup();
  assert.equal(editor.requests.length,0,'V4 local no consulta la API V5 hasta solicitar conexión');
  const localData=await editor.page.evaluate(()=>localStorage.getItem('atlas-governance-workspace-v1'));
  assert.ok(localData);
  await editor.page.locator('[data-workspace-command="connect"]').click();
  await editor.page.locator('[data-workspace-command="open"]').waitFor({timeout:4000});
  await editor.page.locator('[data-workspace-command="open"]').click();
  await editor.page.getByText('Compartido: Gobierno Compartido').waitFor();
  assert.ok((await editor.page.locator('#workspace-panel').innerText()).includes('editor'));

  await editor.page.locator('[data-view="verticals"]').click();
  await editor.page.locator('[data-open="vertical"]').first().click();
  await editor.page.locator('#field-name').fill('Vertical V5 compartida');
  await editor.page.locator('#field-owner').fill('Director de Tecnología');
  await editor.page.locator('#dialog-submit').click();
  await editor.page.waitForFunction(()=>document.querySelector('#workspace-panel')?.textContent?.includes('r2'));
  assert.equal(editor.revision(),2);
  assert.ok(editor.stored().verticals.some(x=>x.name==='Vertical V5 compartida'));
  assert.equal(await editor.page.evaluate(()=>localStorage.getItem('atlas-governance-workspace-v1')),localData,
    'El guardado V5 no pisa el estado V4 del navegador');

  editor.flipConflict();
  await editor.page.locator('[data-open="vertical"]').first().click();
  await editor.page.locator('#field-name').fill('Cambio pendiente V5');
  await editor.page.locator('#field-owner').fill('Arquitectura');
  await editor.page.locator('#dialog-submit').click();
  await editor.page.getByText('CAMBIOS SIN CONFIRMAR').waitFor();
  assert.equal(editor.revision(),2,'No se pierden revisiones en conflicto');
  assert.ok(await editor.page.locator('[data-workspace-command="backup"]').isVisible());
  const beforeVerify=editor.requests.filter(x=>x.method==='PUT').length;
  await editor.page.locator('[data-workspace-command="verify"]').click();
  await editor.page.waitForFunction(()=>document.querySelector('#workspace-panel')?.textContent?.includes('versión diferente'));
  assert.ok(await editor.page.getByText('CAMBIOS SIN CONFIRMAR').isVisible());
  assert.equal(editor.requests.filter(x=>x.method==='PUT').length,beforeVerify,
    'Verificar una revisión diferente no debe reintentar el PUT');
  assert.equal(await editor.page.evaluate(()=>localStorage.getItem('atlas-governance-workspace-v1')),localData);
  editor.page.once('dialog',d=>d.accept());
  await editor.page.locator('[data-workspace-command="local"]').click();
  await editor.page.waitForFunction(()=>document.querySelector('#workspace-panel')?.textContent?.includes('V4 local'));
  assert.equal(await editor.page.evaluate(()=>localStorage.getItem('atlas-governance-workspace-v1')),localData);
  await editor.page.close();

  // Un corte de red puede perder la respuesta DESPUÉS de que D1 ya guardó el PUT.
  // La reconciliación debe confirmar por GET, sin repetir escritura ni perder cambios.
  const uncertain=await setup('editor');
  await uncertain.page.locator('[data-workspace-command="connect"]').click();
  await uncertain.page.locator('[data-workspace-command="open"]').waitFor();
  await uncertain.page.locator('[data-workspace-command="open"]').click();
  await uncertain.page.getByText('Compartido: Gobierno Compartido').waitFor();
  const uncertainLocal=await uncertain.page.evaluate(()=>localStorage.getItem('atlas-governance-workspace-v1'));
  uncertain.loseAckOnce();
  await uncertain.page.locator('[data-view="verticals"]').click();
  await uncertain.page.locator('[data-open="vertical"]').first().click();
  await uncertain.page.locator('#field-name').fill('Operación guardada sin confirmación');
  await uncertain.page.locator('#field-owner').fill('Sistemas');
  await uncertain.page.locator('#dialog-submit').click();
  await uncertain.page.getByText('CAMBIOS SIN CONFIRMAR').waitFor();
  assert.equal(uncertain.revision(),2,'El servidor persistió aunque se perdió la respuesta');
  assert.equal(uncertain.requests.filter(x=>x.method==='PUT').length,1);
  assert.ok(await uncertain.page.locator('[data-workspace-command="verify"]').isVisible());
  await uncertain.page.locator('[data-workspace-command="verify"]').click();
  await uncertain.page.waitForFunction(()=>document.querySelector('#workspace-panel')?.textContent?.includes('r2'));
  assert.equal(uncertain.requests.filter(x=>x.method==='PUT').length,1,
    'Verificar resultado no repite un PUT previamente confirmado en la base');
  assert.equal(await uncertain.page.locator('[data-workspace-command="backup"]').count(),0);
  assert.ok(uncertain.stored().verticals.some(x=>x.name==='Operación guardada sin confirmación'));
  assert.equal(await uncertain.page.evaluate(()=>localStorage.getItem('atlas-governance-workspace-v1')),uncertainLocal);
  await uncertain.page.close();

  const viewer=await setup('viewer');
  await viewer.page.locator('[data-workspace-command="connect"]').click();
  await viewer.page.locator('[data-workspace-command="open"]').waitFor();
  await viewer.page.locator('[data-workspace-command="open"]').click();
  await viewer.page.getByText('Compartido: Gobierno Compartido').waitFor();
  await viewer.page.locator('[data-view="verticals"]').click();
  assert.equal(await viewer.page.locator('[data-open="vertical"]').first().isDisabled(),true,
    'Viewer no debe poder abrir formularios de edición');
  assert.equal(await viewer.page.locator('[data-workspace-command="create"]').isDisabled(),true);
  assert.equal(await viewer.page.locator('[data-workspace-command="history"]').count(),0);
  await viewer.page.close();

  const owner=await setup('owner');
  await owner.page.locator('[data-workspace-command="connect"]').click();
  await owner.page.locator('[data-workspace-command="open"]').waitFor();
  await owner.page.locator('[data-workspace-command="open"]').click();
  await owner.page.getByText('Compartido: Gobierno Compartido').waitFor();
  assert.equal(owner.revision(),2);
  assert.ok(owner.stored().verticals.some(x=>x.id==='v-owner-added'));
  const auditDownload=owner.page.waitForEvent('download');
  await owner.page.locator('[data-workspace-command="audit-export"]').click();
  const auditFile=await auditDownload;
  assert.match(auditFile.suggestedFilename(),/^atlas-v5-auditoria-org-demo-.*\.json$/);
  const exported=JSON.parse(await (await import('node:fs/promises')).readFile(await auditFile.path(),'utf8'));
  assert.equal(exported.eventCount,2);
  assert.deepEqual(exported.events.map(x=>x.id),['audit-2','audit-1']);
  assert.equal(owner.requests.filter(x=>x.path.endsWith('/audit/export')&&x.method==='GET').length,2);
  assert.equal(owner.requests.filter(x=>x.method==='PUT').length,0,'Exportar auditoría no escribe datos');
  await owner.page.locator('[data-workspace-command="history"]').click();
  await owner.page.locator('#workspace-restore-revision').waitFor();
  assert.equal(await owner.page.locator('#workspace-restore-revision').inputValue(),'1');
  owner.page.once('dialog',d=>d.accept());
  await owner.page.locator('[data-workspace-command="restore"]').click();
  await owner.page.waitForFunction(()=>document.querySelector('#workspace-panel')?.textContent?.includes('r3'));
  assert.equal(owner.revision(),3);
  assert.equal(owner.stored().verticals.some(x=>x.id==='v-owner-added'),false);
  assert.ok(owner.requests.some(x=>x.path.endsWith('/revisions/1/restore')&&x.method==='PUT'));
  await owner.page.close();

  assert.deepEqual(errors,[]);
  console.log('OK V5: local intacto; sesión y workspace; HTTP 409; respuesta perdida reconciliada por GET sin PUT duplicado; viewer sin edición; recuperación owner r3.');
}finally{
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
}
