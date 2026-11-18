import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, relative, extname } from 'node:path';
import { once } from 'node:events';
import { chromium } from 'playwright';

const root=resolve('dist'),artifacts=resolve('test-artifacts'),errors=[];
const contentTypes={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8'};
const server=createServer(async(req,res)=>{
 try{
  const path=decodeURIComponent(new URL(req.url||'/', 'http://localhost').pathname);
  const target=resolve(root,'.'+(path==='/'?'/index.html':path));
  const rel=relative(root,target);
  if(rel==='..'||rel.startsWith('..\\')||rel.startsWith('../')){res.writeHead(403).end();return;}
  const bytes=await readFile(target);
  res.writeHead(200,{'content-type':contentTypes[extname(target)]||'application/octet-stream','cache-control':'no-store'});res.end(bytes);
 }catch(err){res.writeHead(404).end('Not Found');}
});
const browser=await chromium.launch({headless:true});
try{
 server.listen(0,'127.0.0.1');await once(server,'listening');
 await mkdir(artifacts,{recursive:true});
 const url='http://127.0.0.1:'+server.address().port;
 const page=await browser.newPage({viewport:{width:1440,height:900},acceptDownloads:true});
 page.on('pageerror',error=>errors.push('desktop: '+error.message));
 await page.goto(url,{waitUntil:'networkidle'});
 assert.match(await page.title(),/Gobierno/);
 assert.match(await page.locator('h1').innerText(),/Gobernar la operación/i);
 assert.equal((await page.locator('.kpi-value').allInnerTexts())[0],'1');
 assert.ok(await page.getByText('De la brecha a la acción').isVisible());
 await page.screenshot({path:resolve(artifacts,'atlas-governance-desktop.png'),fullPage:true});

 // Evaluación -> riesgo automático sin plan
 await page.locator('button[data-view="assessments"]').click();
 await page.getByRole('button',{name:'Nuevo assessment'}).click();
 await page.locator('[name="verticalId"]').selectOption('v-cloud');
 await page.locator('[name="domain"]').selectOption('Seguridad');
 await page.locator('[name="score"]').selectOption('2');
 await page.locator('[name="owner"]').fill('Equipo de Seguridad');
 await page.locator('[name="finding"]').fill('Controles de acceso de contingencia no documentados');
 await page.locator('[name="evidence"]').fill('Assessment interno de demostración');
 await page.locator('#dialog-submit').click();
 assert.ok(await page.getByText('Controles de acceso de contingencia no documentados').count()>0);
 await page.locator('button[data-view="risks"]').click();
 const riskRow=page.locator('tr').filter({hasText:'Brecha de Seguridad'});
 assert.equal(await riskRow.count(),1);
 assert.ok((await riskRow.innerText()).includes('Sin plan'));

 // Riesgo -> plan con responsable y plazo
 await riskRow.getByRole('button',{name:'Crear plan'}).click();
 await page.locator('[name="title"]').fill('Documentar y ensayar accesos de contingencia');
 await page.locator('[name="owner"]').fill('Responsable de Seguridad');
 await page.locator('[name="dueDate"]').fill('2026-12-01');
 await page.locator('#dialog-submit').click();
 const nowPlanned=page.locator('tr').filter({hasText:'Brecha de Seguridad'});
 assert.ok((await nowPlanned.innerText()).includes('Con plan'));

 // Plan -> cierre con evidencia
 await page.locator('button[data-view="actions"]').click();
 const actionRow=page.locator('tr').filter({hasText:'Documentar y ensayar accesos'});
 await actionRow.getByRole('button',{name:'Completar + evidencia'}).click();
 await page.locator('[name="evidence"]').fill('Acta de ensayo con controles y responsable validados');
 await page.locator('#dialog-submit').click();
 assert.ok((await page.locator('tr').filter({hasText:'Documentar y ensayar accesos'}).innerText()).includes('Completada'));

 // Acción completada -> mitigación validada independiente
 await page.locator('button[data-view="risks"]').click();
 await page.locator('tr').filter({hasText:'Brecha de Seguridad'}).getByRole('button',{name:'Validar mitigación'}).click();
 await page.locator('[name="evidence"]').fill('Validación ejecutiva del plan y del resultado de continuidad');
 await page.locator('#dialog-submit').click();
 assert.ok((await page.locator('tr').filter({hasText:'Brecha de Seguridad'}).innerText()).includes('Mitigación validada'));

 // Capacity -> riesgo generado
 await page.locator('button[data-view="capacity"]').click();
 await page.getByRole('button',{name:'Nueva medición'}).click();
 await page.locator('[name="verticalId"]').selectOption('v-infra');
 await page.locator('[name="name"]').fill('Capacidad de pruebas E2E');
 await page.locator('[name="used"]').fill('92');
 await page.locator('[name="total"]').fill('100');
 await page.locator('[name="unit"]').fill('TB');
 await page.locator('[name="thresholdPct"]').fill('85');
 await page.locator('[name="growthPct"]').fill('3');
 await page.locator('[name="owner"]').fill('Infraestructura E2E');
 await page.locator('#dialog-submit').click();
 await page.locator('button[data-view="risks"]').click();
 assert.equal(await page.locator('tr').filter({hasText:'Capacidad sobre umbral: Capacidad de pruebas E2E'}).count(),1);

 // Persistencia y exportación
 await page.reload({waitUntil:'networkidle'});
 await page.locator('button[data-view="risks"]').click();
 assert.equal(await page.locator('tr').filter({hasText:'Capacidad sobre umbral: Capacidad de pruebas E2E'}).count(),1);
 const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Exportar respaldo'}).click()]);
 const saved=JSON.parse(await readFile(await download.path(),'utf8'));
 assert.ok(saved.risks.some(r=>r.title.includes('Capacidad de pruebas E2E')));
 assert.ok(saved.risks.some(r=>r.status==='validado'&&r.title.includes('Brecha de Seguridad')));
 await page.screenshot({path:resolve(artifacts,'atlas-governance-riesgos.png'),fullPage:true});

 // Continuidad editable
 await page.locator('button[data-view="continuity"]').click();
 await page.locator('tr').filter({hasText:'Conectividad entre sitios'}).getByRole('button',{name:'Actualizar'}).click();
 await page.locator('[name="drResult"]').selectOption('aprobado');
 await page.locator('[name="lastDRTest"]').fill('2026-11-18');
 await page.locator('[name="drEvidence"]').fill('Ensayo ficticio registrado para E2E');
 await page.locator('#dialog-submit').click();
 assert.ok((await page.locator('tr').filter({hasText:'Conectividad entre sitios'}).innerText()).includes('Prueba aprobada'));

 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 mobile.on('pageerror',error=>errors.push('mobile: '+error.message));
 await mobile.goto(url,{waitUntil:'networkidle'});
 assert.equal((await mobile.locator('.kpi-value').allInnerTexts())[0],'1');
 await mobile.locator('button[data-view="capacity"]').click();
 const overflow=await mobile.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
 assert.ok(overflow<=1,'Desbordamiento horizontal en móvil: '+overflow);
 await mobile.screenshot({path:resolve(artifacts,'atlas-governance-mobile.png'),fullPage:true});
 await mobile.close();
 await page.close();
 assert.deepEqual(errors,[]);
 console.log('OK: assessment, riesgo automático, plan, evidencia, validación, capacity, continuidad, persistencia, exportación y móvil.');
}finally{await browser.close();server.close();}
