import test from 'node:test';
import assert from 'node:assert/strict';
import {makeEmpty} from '../src/governance/core.js';
import {validateGovernanceWorkflow,GovernanceRuleError} from '../worker/governance-rules.js';

function baseline(){
  const state=makeEmpty();
  state.verticals.push({id:'v1',name:'Operaciones',owner:'Gerencia',description:''});
  state.risks.push({id:'r1',verticalId:'v1',serviceId:'',assessmentId:'',capacityId:'',
    title:'Riesgo 1',description:'',owner:'IT',probability:3,impact:4,
    status:'abierto',evidence:'',source:'manual',createdAt:'2026-11-18'});
  state.actions.push({id:'a1',riskId:'r1',title:'Corregir',owner:'IT',
    dueDate:'2026-12-01',status:'pendiente',evidence:'',createdAt:'2026-11-18'});
  return state;
}
const closedAction=state=>{
  state.actions[0].status='completada';
  state.actions[0].evidence='Evidencia de ejecución verificable';
  state.actions[0].completedAt='2026-11-18';
  return state;
};
const closedRisk=state=>{
  closedAction(state);
  state.risks[0].status='validado';
  state.risks[0].evidence='Evidencia de mitigación independiente';
  state.risks[0].validatedAt='2026-11-18';
  return state;
};
const shouldDeny=fn=>assert.throws(fn,GovernanceRuleError);

test('workflow V5: cierre de acciones exige evidencia y fecha',()=>{
  const s=baseline();validateGovernanceWorkflow(s);
  s.actions[0].status='completada';
  shouldDeny(()=>validateGovernanceWorkflow(s));
  s.actions[0].evidence='Evidencia suficiente';
  shouldDeny(()=>validateGovernanceWorkflow(s));
  s.actions[0].completedAt='2026-11-18';
  validateGovernanceWorkflow(s);
});
test('workflow V5: validación de riesgos necesita planes completos y evidencia',()=>{
  const s=baseline();
  s.risks[0].status='validado';s.risks[0].evidence='Mitigación documentada';s.risks[0].validatedAt='2026-11-18';
  shouldDeny(()=>validateGovernanceWorkflow(s));
  closedAction(s);
  validateGovernanceWorkflow(s);
  s.actions[0].status='en-curso';
  shouldDeny(()=>validateGovernanceWorkflow(s));
});
test('workflow V5: decisiones y objetivos cerrados requieren evidencia verificable',()=>{
  const s=baseline();
  s.decisions.push({id:'d1',riskId:'r1',title:'Revisión',owner:'IT',dueDate:'2026-12-01',status:'resuelta',evidence:'',closedAt:'2026-11-18'});
  shouldDeny(()=>validateGovernanceWorkflow(s));
  s.decisions[0].evidence='Acta documentada';validateGovernanceWorkflow(s);
  s.objectives=[{id:'o1',status:'cerrado',closureEvidence:'Aprobado',closedAt:'2026-11-18'}];
  shouldDeny(()=>validateGovernanceWorkflow(s));
  s.objectives[0].closureEvidence='Evidencia de cierre formal';
  s.objectives[0].closureResults={};s.objectives[0].closureProgress={};
  validateGovernanceWorkflow(s);
});
test('workflow V5: registro cerrado es inmutable tras guardarse',()=>{
  const old=closedRisk(baseline());
  const edit=structuredClone(old);
  edit.actions[0].evidence='Evidencia editada después del cierre';
  shouldDeny(()=>validateGovernanceWorkflow(edit,old));
  const erase=structuredClone(old);erase.actions=[];
  shouldDeny(()=>validateGovernanceWorkflow(erase,old));
  const reopen=structuredClone(old);reopen.risks[0].status='abierto';
  shouldDeny(()=>validateGovernanceWorkflow(reopen,old));
  validateGovernanceWorkflow(structuredClone(old),old);
});
test('workflow V5: no permite modificar o eliminar incidentes originales',()=>{
  const old=baseline();
  old.incidents=[{id:'i1',serviceId:'s1',priority:'P1',openedAt:'2026-11-18T11:00:00Z',resolvedAt:null,summary:'Prueba'}];
  const closed=structuredClone(old);closed.incidents[0].resolvedAt='2026-11-18T12:00:00Z';
  validateGovernanceWorkflow(closed,old);
  const edit=structuredClone(old);edit.incidents[0].summary='Registro modificado';
  shouldDeny(()=>validateGovernanceWorkflow(edit,old));
  const removed=structuredClone(old);removed.incidents=[];
  shouldDeny(()=>validateGovernanceWorkflow(removed,old));
  const reopened=structuredClone(closed);reopened.incidents[0].resolvedAt=null;
  shouldDeny(()=>validateGovernanceWorkflow(reopened,closed));
});
test('workflow V5: riesgo aceptado no puede inventarse desde editor sin flujo formal',()=>{
  const old=baseline();
  const next=structuredClone(old);next.risks[0].status='aceptado';
  shouldDeny(()=>validateGovernanceWorkflow(next,old));
});
