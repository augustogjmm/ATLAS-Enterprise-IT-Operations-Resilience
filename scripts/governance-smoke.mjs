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
const browser=await chromium.launch({headless:true, ...(process.env.CI?{channel:'chrome'}:{})});
try{
 server.listen(0,'127.0.0.1');await once(server,'listening');
 await mkdir(artifacts,{recursive:true});
 const url='http://127.0.0.1:'+server.address().port;
 const page=await browser.newPage({viewport:{width:1440,height:900},acceptDownloads:true});
 page.on('pageerror',error=>errors.push('desktop: '+error.message));
 await page.goto(url,{waitUntil:'networkidle'});
 await page.locator('#workspace-tools').evaluate(el=>el.open=true);
 assert.match(await page.title(),/Gobierno/);
 assert.match(await page.locator('.command-hero h1').innerText(),/Visibilidad para decidir/i);
 assert.equal(await page.locator('.command-domain').count(),8);
 await page.locator('button[data-view="operations"]').click();
 assert.equal(await page.locator('link[href="./executive.css"]').count(),1);
 assert.ok(await page.locator('.executive-summary').isVisible());
 assert.equal(await page.locator('.executive-kpi').count(),4);
 assert.equal(await page.locator('.heatmap-cell').count(),25);
 assert.equal(await page.locator('.executive-data-table tbody tr').count(),4);
 assert.ok(await page.locator('.signal-chip.signal-critical').count()>0);
 assert.ok(await page.getByText('Semáforo por vertical').isVisible());
 const executiveSkin=await page.locator('.page-frame').evaluate(el=>getComputedStyle(el).backgroundColor);
 assert.ok(executiveSkin!=='rgb(0, 0, 0)');
 assert.equal((await page.locator('.executive-kpi strong').allInnerTexts())[0],'1');
 assert.equal(await page.locator('#view-title').innerText(),'Análisis operativo');
 await page.screenshot({path:resolve(artifacts,'atlas-governance-desktop.png'),fullPage:true});
 // Ingestión ITSM: importar dos incidentes, calcular recuperación, cerrar y persistir.
 await page.locator('button[data-view="incidents"]').click();
 assert.ok(await page.getByText('Incidentes, recuperación y tendencias.').isVisible());
 assert.equal(await page.locator('.itsm-month').count(),12); // dos series de seis meses
 assert.ok(await page.locator('tr').filter({hasText:'DEMO-112'}).count()>0);
 const incidentCSV=[
 'incident_id,service_id,priority,opened_at,resolved_at,summary',
 'CSV-E2E-01,s-core,P2,2026-11-18T10:00:00-03:00,2026-11-18T10:42:00-03:00,"Ticket, resuelto"',
 'CSV-E2E-02,s-channel,P1,2026-11-18T12:30:00-03:00,,Incidente pendiente'
 ].join(String.fromCharCode(10));
 await page.locator('#incident-file').setInputFiles({name:'importacion-itsm-smoke.csv',mimeType:'text/csv',buffer:Buffer.from(incidentCSV)});
 await page.locator('#incident-mapping-form').waitFor({state:'visible'});
 assert.equal(await page.locator('[name="col_incident_id"]').inputValue(),'0');
 assert.equal(await page.locator('[name="service_0"]').inputValue(),'s-channel');
 assert.equal(await page.locator('[name="service_1"]').inputValue(),'s-core');
 page.once('dialog',d=>d.accept());
 await page.getByRole('button',{name:'Validar e importar CSV'}).click();
 await page.waitForFunction(()=>document.querySelector('#view-root')?.textContent?.includes('CSV-E2E-01'));
 assert.equal(await page.locator('tr').filter({hasText:'CSV-E2E-01'}).count(),1);
 assert.ok((await page.locator('tr').filter({hasText:'CSV-E2E-01'}).innerText()).includes('42 min'));
 const openRow=page.locator('tr').filter({hasText:'CSV-E2E-02'});
 await openRow.getByRole('button',{name:'Cerrar incidente'}).click();
 await page.locator('[name="resolvedAt"]').fill('2026-11-18T13:30:00-03:00');
 await page.locator('#dialog-submit').click();
 assert.ok((await page.locator('tr').filter({hasText:'CSV-E2E-02'}).innerText()).includes('60 min'));
 await page.screenshot({path:resolve(artifacts,'atlas-it-sm-incidentes.png'),fullPage:true}); 
 // Filtrado real por vertical: ninguna tarjeta o listado ajeno al alcance.
 await page.locator('#itsm-vertical-filter').selectOption('v-net');
 assert.equal(await page.locator('tr').filter({hasText:'CSV-E2E-01'}).count(),0);
 assert.equal(await page.locator('tr').filter({hasText:'CSV-E2E-02'}).count(),0);
 assert.equal(await page.locator('#itsm-service-filter option').count(),2);
 await page.locator('#itsm-vertical-filter').selectOption('');

 // Importación de un CSV con columnas de terceros, nombres de servicio y hora DMY sin zona.
 const external=[
  'Número de incidente;Servicio;Severidad;Fecha de apertura;Fecha de cierre;Descripción',
  'EXT-SMOKE-01;Core transaccional;Alta;18/11/2026 08:00;18/11/2026 08:40;Incidente de mapeo'
 ].join(String.fromCharCode(10));
 await page.locator('#incident-file').setInputFiles({name:'formato-externo.csv',mimeType:'text/csv',buffer:Buffer.from(external)});
 await page.locator('#incident-mapping-form').waitFor({state:'visible'});
 assert.equal(await page.locator('[name="col_summary"]').inputValue(),'5');
 assert.equal(await page.locator('[name="service_0"]').inputValue(),'s-core');
 await page.locator('[name="priority_0"]').selectOption('P1');
 await page.locator('[name="date_format"]').selectOption('dmy');
 await page.locator('[name="timezone_offset"]').fill('-03:00');
 page.once('dialog',d=>d.accept());
 await page.getByRole('button',{name:'Validar e importar CSV'}).click();
 await page.waitForFunction(()=>document.querySelector('#view-root')?.textContent?.includes('EXT-SMOKE-01'));
 assert.ok((await page.locator('tr').filter({hasText:'EXT-SMOKE-01'}).innerText()).includes('40 min'));
 await page.screenshot({path:resolve(artifacts,'atlas-it-sm-mapping.png'),fullPage:true});


 // KPI y OKR: catálogos calculados, altas operativas y relaciones entre registros.
 await page.locator('button[data-view="performance"]').click();
 assert.equal(await page.locator('.performance-kpi').count(),7);
 assert.equal(await page.locator('.okr-card').count(),2);
 assert.ok((await page.locator('.performance-kpi').first().innerText()).includes('Riesgos críticos sin plan'));
 await page.getByRole('button',{name:'Nuevo KPI'}).click();
 await page.locator('[name="metric"]').selectOption('capacity_alerts');
 await page.locator('[name="name"]').fill('Capacidad bajo umbral');
 await page.locator('[name="target"]').fill('0');
 await page.locator('[name="owner"]').fill('Operaciones IT');
 await page.locator('#dialog-submit').click();
 assert.equal(await page.locator('.performance-kpi').count(),8);
 await page.getByRole('button',{name:'Nuevo objetivo'}).click();
 await page.locator('[name="title"]').fill('Reducir exposición de capacidad');
 await page.locator('[name="owner"]').fill('Gerencia IT');
 await page.locator('[name="startDate"]').fill('2026-11-18');
 await page.locator('[name="dueDate"]').fill('2027-02-01');
 await page.locator('#dialog-submit').click();
 assert.equal(await page.locator('.okr-card').count(),3);
 const ourOkr=page.locator('.okr-card').filter({hasText:'Reducir exposición de capacidad'});
 await ourOkr.getByRole('button',{name:'Resultado clave'}).click();
 await page.locator('[name="kpiId"]').selectOption({label:'Capacidad bajo umbral'});
 await page.locator('[name="baseline"]').fill('1');
 await page.locator('[name="target"]').fill('0');
 await page.locator('#dialog-submit').click();
 assert.ok((await page.locator('.okr-card').filter({hasText:'Reducir exposición de capacidad'}).innerText()).includes('Capacidad bajo umbral'));
 await page.screenshot({path:resolve(artifacts,'atlas-kpi-okr-desktop.png'),fullPage:true});


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
 assert.ok(await riskRow.locator('.signal-chip.signal-warning').count()>0); // Riesgo 3×4 = 12, nivel alto (no crítico)

 // Riesgo -> plan con responsable y plazo
 await riskRow.getByRole('button',{name:'Crear plan'}).click();
 await page.locator('[name="title"]').fill('Documentar y ensayar accesos de contingencia');
 await page.locator('[name="owner"]').fill('Responsable de Seguridad');
 await page.locator('[name="dueDate"]').fill('2026-12-01');
 await page.locator('#dialog-submit').click();
 const nowPlanned=page.locator('tr').filter({hasText:'Brecha de Seguridad'});
 assert.ok((await nowPlanned.innerText()).includes('Con plan'));
 assert.ok(await nowPlanned.locator('.signal-chip.signal-warning').count()>0);

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
 assert.ok(await page.locator('tr').filter({hasText:'Brecha de Seguridad'}).locator('.signal-chip.signal-ok').count()>0);

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
 await page.locator('button[data-view="incidents"]').click();
 assert.equal(await page.locator('tr').filter({hasText:'CSV-E2E-01'}).count(),1);
 assert.equal(await page.locator('tr').filter({hasText:'CSV-E2E-02'}).count(),1);

 await page.locator('button[data-view="performance"]').click();
 assert.equal(await page.locator('.performance-kpi').count(),8);
 assert.equal(await page.locator('.okr-card').count(),3);
 await page.locator('button[data-view="risks"]').click();
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
 assert.ok((await page.locator('tr').filter({hasText:'Conectividad entre sitios'}).innerText()).includes('Prueba aprobada') || await page.locator('tr').filter({hasText:'Conectividad entre sitios'}).locator('.signal-chip.signal-ok').count()>0);

 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 mobile.on('pageerror',error=>errors.push('mobile: '+error.message));
 await mobile.goto(url,{waitUntil:'networkidle'});
 await mobile.locator('#workspace-tools').evaluate(el=>el.open=true);
 assert.equal(await mobile.locator('.command-domain').count(),8);
 await mobile.locator('button[data-view="operations"]').click();
 assert.equal((await mobile.locator('.executive-kpi strong').allInnerTexts())[0],'1');
 assert.equal(await mobile.locator('.heatmap-cell').count(),25);
 await mobile.locator('button[data-view="incidents"]').click();
 assert.ok(await mobile.locator('.itsm-kpi-grid').isVisible());
 await mobile.screenshot({path:resolve(artifacts,'atlas-it-sm-movil.png'),fullPage:true});
 await mobile.locator('button[data-view="capacity"]').click();
 const overflow=await mobile.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
 assert.ok(overflow<=1,'Desbordamiento horizontal en móvil: '+overflow);
 await mobile.screenshot({path:resolve(artifacts,'atlas-governance-mobile.png'),fullPage:true});
 await mobile.close();
 await page.close();
 assert.deepEqual(errors,[]);
 console.log('OK: assessment, riesgo automático, plan, evidencia, validación, capacity, continuidad, persistencia, exportación y móvil.');
}finally{await browser.close();server.close();}
