import test from 'node:test';
import assert from 'node:assert/strict';
import {createDemo,makeEmpty,registerAction} from '../src/governance/core.js';
import {
 METRICS,ensurePerformanceState,seedDemoPerformance,metricValue,kpiResult,keyResultProgress,objectiveProgress,
 validatePerformanceState,addKpi,addObjective,addKeyResult,closeObjective
} from '../src/governance/performance.js';
const day='2026-11-18';
let serial=0;
const uid=p=>p+'-t-'+(++serial);

test('catálogo de KPI ofrece fórmulas y unidades concretas',()=>{
 assert.equal(METRICS.critical_unmanaged.direction,'lower');
 assert.equal(METRICS.dr_verified.unit,'%');
 assert.equal(Object.keys(METRICS).length,10);
});

test('nuevos KPI se calculan a partir de los datos del modelo',()=>{
 const s=seedDemoPerformance(createDemo());
 assert.equal(s.kpis.length,5);
 assert.equal(s.objectives.length,2);
 assert.equal(metricValue(s,'critical_unmanaged',day),1);
 assert.equal(metricValue(s,'overdue_actions',day),1);
 assert.ok(Math.abs(metricValue(s,'risk_coverage',day)-66.6666666667)<.01);
 assert.ok(Math.abs(metricValue(s,'dr_verified',day)-33.3333333333)<.01);
 assert.equal(metricValue(s,'sla_compliance',day),75);
 assert.equal(kpiResult(s,s.kpis[0],day).level,'critical');
});

test('los dominios vacíos no informan un falso cumplimiento de KPI',()=>{
 const s=ensurePerformanceState(makeEmpty());
 assert.equal(metricValue(s,'critical_unmanaged',day),null);
 assert.equal(metricValue(s,'overdue_actions',day),null);
 assert.equal(metricValue(s,'decisions_overdue',day),null);
 assert.equal(metricValue(s,'capacity_alerts',day),null);
 assert.equal(metricValue(s,'risk_coverage',day),null);
 assert.equal(metricValue(s,'dr_verified',day),null);
 const kpi={id:'k',name:'Riesgos',metric:'critical_unmanaged',target:0,owner:'Gobierno',verticalId:''};
 assert.equal(kpiResult(s,kpi,day).level,'unknown');
});

test('riesgo con plan genera progreso sin alterar manualmente el KR',()=>{
 const s=seedDemoPerformance(createDemo());
 const kr=s.keyResults.find(r=>r.id==='kr-risk');
 assert.equal(keyResultProgress(s,kr,day).progress,0);
 registerAction(s,{riskId:'r-net',title:'Probar continuidad WAN',owner:'Networking',dueDate:'2026-12-01'},day,uid);
 assert.equal(metricValue(s,'critical_unmanaged',day),0);
 assert.equal(keyResultProgress(s,kr,day).progress,100);
 assert.equal(kpiResult(s,s.kpis[0],day).level,'ok');
});

test('cierre de objetivo exige evidencia y conserva fotografía de resultados',()=>{
 const s=seedDemoPerformance(createDemo());
 const o=s.objectives[0],kr=s.keyResults.find(r=>r.id==='kr-risk');
 assert.throws(()=>closeObjective(s,o.id,day,''),/evidencia/);
 closeObjective(s,o.id,day,'Acta de comité con mediciones, responsables y fechas');
 assert.equal(o.status,'cerrado');assert.equal(o.closedAt,day);
 const closedProgress=objectiveProgress(s,o,day).progress;
 assert.ok(closedProgress>=0&&closedProgress<1);
 registerAction(s,{riskId:'r-net',title:'Controlar continuidad WAN',owner:'Networking',dueDate:'2026-12-01'},day,uid);
 assert.equal(keyResultProgress(s,kr,day).progress,0);
 assert.equal(objectiveProgress(s,o,day).progress,closedProgress);
});

test('se pueden crear nuevos KPI, objetivos y resultados clave, validando metas',()=>{
 const s=ensurePerformanceState(makeEmpty());
 const k=addKpi(s,{name:'Madurez IT',metric:'assessment_maturity',target:4,owner:'Operaciones'},uid);
 const o=addObjective(s,{title:'Aumentar madurez de IT',owner:'Gerencia IT',startDate:'2026-11-18',dueDate:'2027-02-10'},uid);
 const kr=addKeyResult(s,{objectiveId:o.id,kpiId:k.id,baseline:2,target:4},uid);
 assert.equal(kr.objectiveId,o.id);
 assert.equal(objectiveProgress(s,o,day).progress,null);
 assert.doesNotThrow(()=>validatePerformanceState(s));
 assert.throws(()=>addKeyResult(s,{objectiveId:o.id,kpiId:k.id,baseline:4,target:1},uid),/meta debe mejorar/);
 assert.throws(()=>addKpi(s,{name:'Métrica',metric:'inventada',target:0,owner:'IT'},uid),/KPI/);
 assert.throws(()=>addObjective(s,{title:'Fechas inválidas',owner:'IT',startDate:'2027-01-01',dueDate:'2026-01-01'},uid),/Objetivo/);
});

test('mantiene compatibilidad con respaldos anteriores que no tienen KPI/OKR',()=>{
 const old=createDemo();
 assert.equal(old.kpis,undefined);
 const migrated=ensurePerformanceState(old);
 assert.equal(migrated.risks.length,3);
 assert.deepEqual(migrated.kpis,[]);
 assert.deepEqual(migrated.objectives,[]);
 assert.deepEqual(migrated.keyResults,[]);
 validatePerformanceState(migrated);
 const demo=seedDemoPerformance(migrated);
 assert.equal(demo.kpis.length,5);
 assert.equal(seedDemoPerformance(demo).kpis.length,5);
});
