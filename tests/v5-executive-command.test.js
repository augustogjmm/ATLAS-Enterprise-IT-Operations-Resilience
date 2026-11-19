import test from 'node:test';
import assert from 'node:assert/strict';
import {makeEmpty,createDemo} from '../src/governance/core.js';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
// El frontend importa desde dist/lib tras build; en Node la fuente es src/.
const source=readFileSync(resolve('public/executive-command.js'),'utf8');
const coreUrl=pathToFileURL(resolve('src/governance/core.js')).href;
const adapted=source.replace("'./lib/governance/core.js'",JSON.stringify(coreUrl));
const {ATLAS_DOMAINS,executiveModel,renderExecutiveCommand}=await import('data:text/javascript;base64,'+Buffer.from(adapted).toString('base64'));

test('Contrato V4: 8 dominios, 5 perspectivas y título exacto',()=>{
 const html=renderExecutiveCommand(makeEmpty());
 assert.equal(ATLAS_DOMAINS.length,8);
 assert.match(html,/Visibilidad para decidir<span>\.<\/span>/);
 assert.equal((html.match(/data-command-lens=/g)||[]).length,5);
 assert.equal((html.match(/class="command-domain /g)||[]).length,8);
 assert.match(html,/Sin datos/);
 assert.doesNotMatch(html,/99,97%|24 COMPONENTES|Core bancario/);
});

test('Vista ejecutiva usa registros reales del workspace, no métricas de HTML',()=>{
 const s=createDemo();
 const m=executiveModel(s);
 assert.equal(m.critical,s.services.filter(x=>x.criticality===1).length);
 assert.equal(m.pending.length,s.decisions.filter(x=>x.status==='pendiente').length);
 assert.equal(m.activeRisks.length,s.risks.filter(x=>x.status==='abierto').length);
 assert.equal(m.priorityRisks.length,s.risks.filter(x=>x.status==='abierto'&&x.probability*x.impact>=9).length);
 assert.ok(m.availability>0 && m.availability<=100);
 const h=renderExecutiveCommand(s);
 assert.ok(h.includes('DATOS DEMOSTRATIVOS'));
 assert.ok(h.includes('Evaluar alternativas de capacidad y presupuesto'));
 assert.ok(!h.includes('20 de noviembre'));
});

test('Escapado de registros evita HTML inyectado en decisiones',()=>{
 const s=makeEmpty();
 s.decisions.push({id:'x',title:'<img src=x onerror=alert(1)>',status:'pendiente',owner:'Comité',dueDate:'2026-11-19'});
 const h=renderExecutiveCommand(s);
 assert.ok(h.includes('&lt;img'));
 assert.ok(!h.includes('<img src=x onerror=alert(1)>'));
});
