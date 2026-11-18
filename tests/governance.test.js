import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDemo,makeEmpty,assertValidState,dashboard,capacityStatus,availability,severity,riskTreatment,
  registerAssessment,registerCapacity,registerTeamCapacity,teamStatus,registerAction,completeAction,validateRisk,actionOverdue
} from '../src/governance/core.js';
const date='2026-11-18';
let next=0;
const uid=prefix=>prefix+'-test-'+(++next);

test('datos de demostración etiquetados y dashboard derivado de los registros',()=>{
 const s=createDemo(),metrics=dashboard(s,date);
 assert.equal(s.kind,'demo');
 assert.equal(metrics.activeRisks,3);
 assert.equal(metrics.unmanaged,1);
 assert.equal(metrics.criticalUnmanaged,1);
 assert.equal(metrics.overdue,1);
 assert.equal(metrics.drGaps,2);
 assert.equal(metrics.capacityAlerts,1);
 assert.ok(metrics.averageAssessment>2);
});

test('disponibilidad: fórmula con minutos e invalidez detectable',()=>{
 assert.ok(Math.abs(availability({periodMinutes:1000,downtimeMinutes:10})-99)<0.00001);
 assert.equal(availability({periodMinutes:0,downtimeMinutes:3}),null);
 assert.equal(availability({periodMinutes:100,downtimeMinutes:150}),null);
});

test('capacity: proyección compuesta y alerta sobre el umbral',()=>{
 const x=capacityStatus({used:90,total:100,thresholdPct:85,growthPct:5});
 assert.equal(x.warning,true);assert.ok(x.forecast>104);
 assert.equal(capacityStatus({used:0,total:0,thresholdPct:85,growthPct:0}).utilization,null);
});

test('assessment con puntuación baja genera riesgo trazable sin plan',()=>{
 const s=createDemo(),r=registerAssessment(s,{verticalId:'v-cloud',domain:'Gobierno',score:2,finding:'Sin revisión anual aprobada',owner:'Arquitectura',evidence:'Acta no disponible'},date,uid);
 assert.ok(r.risk);
 assert.equal(r.risk.assessmentId,r.assessment.id);
 assert.equal(riskTreatment(r.risk,s.actions),'Sin plan');
 assert.equal(dashboard(s,date).unmanaged,2);
});

test('assessment con buen nivel no crea riesgos',()=>{
 const s=createDemo(),before=s.risks.length;
 const r=registerAssessment(s,{verticalId:'v-ops',domain:'Operaciones',score:4,finding:'Controles adecuados',owner:'IT Ops'},date,uid);
 assert.equal(r.risk,null);assert.equal(s.risks.length,before);
});

test('capacity fuera del umbral genera riesgo y se vincula con su medición',()=>{
 const s=createDemo();
 const {asset,risk}=registerCapacity(s,{verticalId:'v-cloud',name:'Cluster de pruebas',unit:'vCPU',used:91,total:100,thresholdPct:80,growthPct:2,owner:'Cloud'},date,uid);
 assert.equal(risk.capacityId,asset.id);
 assert.equal(severity(risk).label,'Crítico');
});

test('circuito completo: assessment -> riesgo -> plan -> evidencia -> cierre',()=>{
 const s=createDemo();
 const {risk}=registerAssessment(s,{verticalId:'v-ops',domain:'Continuidad',score:1,finding:'Prueba anual de recuperación no realizada',owner:'Continuidad'},date,uid);
 assert.throws(()=>validateRisk(s,risk.id,'evidencia de cierre',date),/acciones/);
 const a=registerAction(s,{riskId:risk.id,title:'Realizar simulacro de recuperación',owner:'Continuidad',dueDate:'2026-11-20'},date,uid);
 assert.equal(riskTreatment(risk,s.actions),'Con plan');
 assert.throws(()=>completeAction(s,a.id,'ok',date),/ocho/);
 completeAction(s,a.id,'Acta de recuperación y resultado validado',date);
 assert.equal(s.actions.find(x=>x.id===a.id).status,'completada');
 assert.throws(()=>validateRisk(s,risk.id,'breve',date),/evidencia/);
 validateRisk(s,risk.id,'Acta validada por responsable de continuidad',date);
 assert.equal(riskTreatment(risk,s.actions),'Mitigación validada');
 assert.equal(risk.status,'validado');
 assert.ok(s.events.some(e=>e.type==='risk'&&e.text.includes('validada')));
});

test('un riesgo con acciones pendientes no puede cerrarse',()=>{
 const s=createDemo();
 assert.throws(()=>validateRisk(s,'r-san','Evidencia suficientemente detallada',date),/todas las acciones/);
});

test('el vencimiento se calcula sobre la fecha y el estado',()=>{
 assert.equal(actionOverdue({status:'pendiente',dueDate:'2026-11-17'},date),true);
 assert.equal(actionOverdue({status:'completada',dueDate:'2026-11-17'},date),false);
 assert.equal(actionOverdue({status:'en-curso',dueDate:date},date),false);
});

test('importación: estructura inválida y duplicados rechazados',()=>{
 const s=makeEmpty();
 assert.doesNotThrow(()=>assertValidState(s));
 assert.throws(()=>assertValidState({...s,version:2}),/versión/);
 assert.throws(()=>assertValidState({...s,risks:[{id:'x'},{id:'x'}]}),/duplicados/);
});

test('validaciones de registros impiden mediciones imposibles',()=>{
 const s=createDemo();
 assert.throws(()=>registerCapacity(s,{verticalId:'v-cloud',name:'Error',used:1,total:0,thresholdPct:80,growthPct:1,unit:'TB'},date,uid),/capacidad/);
 assert.throws(()=>registerAssessment(s,{verticalId:'v-cloud',domain:'Gobierno',score:8,finding:'Hallazgo',owner:'Equipo'},date,uid),/madurez/);
 assert.throws(()=>registerAction(s,{riskId:'no-existe',title:'Plan',owner:'Equipo',dueDate:date},date,uid),/riesgo/);
});

test('capacity de equipos: carga, cobertura, y generación de riesgo',()=>{
 const s=createDemo();
 assert.equal(s.teamCapacities.length,4);
 const normal=teamStatus({availableFte:10,allocatedFte:7,coveragePct:95,thresholdPct:90});
 assert.equal(normal.warning,false);
 const {team,risk}=registerTeamCapacity(s,{verticalId:'v-ops',name:'Guardia de operaciones',availableFte:8,allocatedFte:9,coveragePct:75,thresholdPct:90,owner:'Operaciones',skillsGap:'Relevo de guardias'},date,uid);
 assert.equal(risk.teamCapacityId,team.id);
 assert.equal(riskTreatment(risk,s.actions),'Sin plan');
 assert.equal(dashboard(s,date).teamAlerts,1);
});
