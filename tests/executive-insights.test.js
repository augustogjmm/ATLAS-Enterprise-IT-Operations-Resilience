import test from 'node:test';
import assert from 'node:assert/strict';
import {createDemo,makeEmpty} from '../src/governance/core.js';
import {
  SIGNAL,worstSignal,riskSignal,actionSignal,infrastructureSignal,workforceSignal,
  assessmentSignal,serviceSignal,verticalSignal,executiveSummary,riskMatrix
} from '../src/governance/insights.js';
const day='2026-11-18';

test('semaforización con semántica y estado sin evaluar',()=>{
 assert.equal(worstSignal([]).level,'unknown');
 assert.equal(worstSignal([{level:'unknown'},{level:'ok'}]).level,'ok');
 assert.equal(worstSignal([{level:'warning'},{level:'critical'},{level:'ok'}]).level,'critical');
 assert.deepEqual(Object.keys(SIGNAL),['critical','warning','ok','unknown']);
});

test('riesgos críticos sin plan, con plan, vencidos y mitigados',()=>{
 const s=createDemo();
 assert.equal(riskSignal(s.risks.find(r=>r.id==='r-net'),s.actions,day).level,'critical');
 assert.equal(riskSignal(s.risks.find(r=>r.id==='r-san'),s.actions,day).level,'warning');
 assert.equal(riskSignal(s.risks.find(r=>r.id==='r-core-dr'),s.actions,day).level,'critical');
 assert.equal(riskSignal({...s.risks[0],status:'validado'},s.actions,day).level,'ok');
});
test('acciones con semáforo según fecha, bloqueo o evidencia',()=>{
 assert.equal(actionSignal({status:'completada',dueDate:'2026-11-01'},day).level,'ok');
 assert.equal(actionSignal({status:'bloqueada',dueDate:'2026-12-01'},day).level,'critical');
 assert.equal(actionSignal({status:'pendiente',dueDate:'2026-11-15'},day).level,'critical');
 assert.equal(actionSignal({status:'pendiente',dueDate:'2026-11-23'},day).level,'warning');
 assert.equal(actionSignal({status:'pendiente',dueDate:'2026-12-10'},day).level,'ok');
});
test('capacity con alertas por umbral configurable y proyección',()=>{
 assert.equal(infrastructureSignal({used:85,total:100,thresholdPct:85,growthPct:0}).level,'critical');
 assert.equal(infrastructureSignal({used:68,total:100,thresholdPct:85,growthPct:0}).level,'ok');
 assert.equal(infrastructureSignal({used:77,total:100,thresholdPct:85,growthPct:0}).level,'warning');
 assert.equal(infrastructureSignal({used:69,total:100,thresholdPct:85,growthPct:10}).level,'warning');
 assert.equal(workforceSignal({allocatedFte:8,availableFte:10,thresholdPct:90,coveragePct:89}).level,'critical');
 assert.equal(workforceSignal({allocatedFte:8,availableFte:10,thresholdPct:90,coveragePct:92}).level,'warning');
});
test('assessments: madurez 2 roja, 3 ámbar, 4 verde',()=>{
 assert.equal(assessmentSignal({score:2}).level,'critical');
 assert.equal(assessmentSignal({score:3}).level,'warning');
 assert.equal(assessmentSignal({score:4}).level,'ok');
 assert.equal(assessmentSignal({score:0}).level,'unknown');
});
test('continuidad: disponibilidad y estado DRP separados',()=>{
 const s=createDemo();
 assert.equal(serviceSignal(s.services.find(a=>a.id==='s-core'),day).level,'critical'); // SLA incumplido
 assert.equal(serviceSignal(s.services.find(a=>a.id==='s-network'),day).level,'unknown'); // sin prueba
 assert.equal(serviceSignal(s.services.find(a=>a.id==='s-channel'),day).level,'ok');
 assert.equal(serviceSignal({...s.services[1],lastDRTest:'2026-01-01'},day).level,'warning');
 assert.equal(serviceSignal({...s.services[1],drResult:'fallido'},day).level,'critical');
});
test('matriz 5x5 incluye solo riesgos abiertos por casilla',()=>{
 const s=createDemo(),matrix=riskMatrix(s.risks);
 assert.equal(matrix.length,5);assert.ok(matrix.every(x=>x.length===5));
 assert.equal(matrix.flat().reduce((total,c)=>total+c.count,0),3);
 assert.equal(matrix[1][4].count,1); // P4 I5
 assert.equal(matrix[2][4].count,2); // P3 I5
 assert.equal(riskMatrix([]).flat().reduce((total,c)=>total+c.count,0),0);
});
test('síntesis ejecutiva no inventa KPI cuando no hay datos',()=>{
 const s=makeEmpty(),x=executiveSummary(s,day);
 assert.equal(x.status.level,'unknown');
 assert.equal(x.averageAvailability,null);
 assert.equal(x.riskTreatmentPct,null);
 assert.equal(x.criticalServices,0);
 assert.equal(verticalSignal(s,'missing',day).level,'unknown');
});
test('tablero y verticales reflejan cambios en riesgo y acción',()=>{
 const s=createDemo();
 const before=executiveSummary(s,day);
 assert.equal(before.criticalUnmanaged,1);
 assert.equal(before.overdue,1);
 assert.equal(before.slaBreaches,1);
 assert.equal(before.pendingDecisions,1);
 const v=verticalSignal(s,'v-net',day);
 assert.equal(v.level,'critical');
 const risk=s.risks.find(r=>r.id==='r-net');
 s.actions.push({id:'a-plan',riskId:risk.id,title:'Control',owner:'Redes',dueDate:'2026-12-01',status:'pendiente',evidence:'',createdAt:day});
 const after=executiveSummary(s,day);
 assert.equal(after.criticalUnmanaged,0);
 assert.equal(after.activeRisks,3);
});
