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
    let revision=1, conflict=false, stored=createDemo();
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
      else if(path==='/api/v1/tenants/'+tenant+'/workspaces/'+id&&method==='PUT'){
        const received=req.postDataJSON();
        if(role==='viewer'){status=403;data={error:'Permiso insuficiente'};}
        else if(conflict||received.revision!==revision){status=409;data={error:'Conflicto de revisión'};}
        else{stored=received.state;revision++;data={id,revision};}
      }else{status=404;data={error:'Ruta inexistente'};}
      await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
    });
    await page.goto(base,{waitUntil:'networkidle'});
    return {page,requests,flipConflict:()=>{conflict=true;},revision:()=>revision,stored:()=>stored};
  }

  const editor=await setup();
  assert.equal(editor.requests.length,0,'V4 local no consulta la API V5 hasta solicitar conexión');
  const localData=await editor.page.evaluate(()=>localStorage.getItem('atlas-governance-workspace-v1'));
  assert.ok(localData);
  await editor.page.locator('[data-workspace-command="connect"]').click();
  await editor.page.locator('[data-workspace-command="open"]').waitFor();
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
  assert.equal(await editor.page.evaluate(()=>localStorage.getItem('atlas-governance-workspace-v1')),localData);
  editor.page.once('dialog',d=>d.accept());
  await editor.page.locator('[data-workspace-command="local"]').click();
  await editor.page.waitForFunction(()=>document.querySelector('#workspace-panel')?.textContent?.includes('V4 local'));
  assert.equal(await editor.page.evaluate(()=>localStorage.getItem('atlas-governance-workspace-v1')),localData);
  await editor.page.close();

  const viewer=await setup('viewer');
  await viewer.page.locator('[data-workspace-command="connect"]').click();
  await viewer.page.locator('[data-workspace-command="open"]').waitFor();
  await viewer.page.locator('[data-workspace-command="open"]').click();
  await viewer.page.getByText('Compartido: Gobierno Compartido').waitFor();
  await viewer.page.locator('[data-view="verticals"]').click();
  assert.equal(await viewer.page.locator('[data-open="vertical"]').first().isDisabled(),true,
    'Viewer no debe poder abrir formularios de edición');
  assert.equal(await viewer.page.locator('[data-workspace-command="create"]').isDisabled(),true);
  await viewer.page.close();

  assert.deepEqual(errors,[]);
  console.log('OK V5: local intacto; sesión y workspace; escritura r2; conflicto 409; reversión local; viewer sin edición.');
}finally{
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
}
