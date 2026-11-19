// ATLAS V5: invariantes mínimos verificados en el servidor.
// No confundir estos controles con un workflow de aprobación o SOX formal.
const isDate = value => typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
const evidence = (value,min) => typeof value==='string' && value.trim().length>=min;
const items = (state,key) => Array.isArray(state[key])?state[key]:[];
const same = (a,b) => JSON.stringify(a)===JSON.stringify(b);

export class GovernanceRuleError extends Error {
  constructor(message){super(message);this.name='GovernanceRuleError';}
}
const deny = message => {throw new GovernanceRuleError(message);};

function checkClosedRecords(state){
  const actions=items(state,'actions');
  const byRisk=new Map();
  for(const action of actions){
    if(!byRisk.has(action.riskId))byRisk.set(action.riskId,[]);
    byRisk.get(action.riskId).push(action);
    if(action.status==='completada' &&
      (!evidence(action.evidence,8)||!isDate(action.completedAt)))
      deny('Las acciones completadas requieren evidencia y fecha de cierre.');
  }
  for(const risk of items(state,'risks')){
    if(risk.status!=='validado')continue;
    const linked=byRisk.get(risk.id)||[];
    if(!evidence(risk.evidence,12)||!isDate(risk.validatedAt)||
       !linked.length||linked.some(a=>a.status!=='completada'))
      deny('La mitigación de un riesgo requiere evidencia y todas sus acciones completadas.');
  }
  for(const decision of items(state,'decisions')){
    if(decision.status==='resuelta' &&
       (!evidence(decision.evidence,8)||!isDate(decision.closedAt)))
      deny('Las decisiones resueltas requieren evidencia de cierre.');
  }
  for(const objective of items(state,'objectives')){
    if(objective.status!=='cerrado')continue;
    if(!evidence(objective.closureEvidence,8)||!isDate(objective.closedAt)||
       !objective.closureResults||typeof objective.closureResults!=='object'||
       !objective.closureProgress||typeof objective.closureProgress!=='object')
      deny('Los objetivos cerrados requieren evidencia y resultados congelados.');
  }
}
function preserveFinalized(before,after,key,closed){
  const current=new Map(items(after,key).map(record=>[record.id,record]));
  for(const old of items(before,key)){
    if(!closed(old))continue;
    const newest=current.get(old.id);
    if(!newest||!same(old,newest))
      deny('Un registro ya cerrado no puede ser eliminado ni alterado: '+key+'.');
  }
}
function preserveIncidents(before,after){
  const current=new Map(items(after,'incidents').map(x=>[x.id,x]));
  for(const old of items(before,'incidents')){
    const newer=current.get(old.id);
    if(!newer)deny('No se permite eliminar incidentes históricos.');
    for(const field of ['id','serviceId','priority','openedAt','summary']){
      if(old[field]!==newer[field])
        deny('No se permite reescribir la identidad o el origen de un incidente.');
    }
    if(old.resolvedAt!==null&&old.resolvedAt!==newer.resolvedAt)
      deny('No se permite reabrir ni modificar una resolución de incidente.');
  }
}
export function validateGovernanceWorkflow(state,previous=null){
  checkClosedRecords(state);
  if(!previous)return state;
  preserveFinalized(previous,state,'actions',x=>x.status==='completada');
  preserveFinalized(previous,state,'risks',x=>x.status==='validado'||x.status==='aceptado');
  preserveFinalized(previous,state,'decisions',x=>x.status==='resuelta');
  preserveFinalized(previous,state,'objectives',x=>x.status==='cerrado');
  preserveIncidents(previous,state);
  const beforeRisks=new Map(items(previous,'risks').map(r=>[r.id,r]));
  for(const risk of items(state,'risks')){
    if(risk.status==='aceptado'&&beforeRisks.get(risk.id)?.status!=='aceptado')
      deny('La aceptación formal del riesgo requiere un workflow autorizado todavía no implementado.');
  }
  return state;
}
