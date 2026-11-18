// ATLAS Governance: motor de dominio puro y verificable.
// No simula monitoreo productivo ni toma decisiones sin evidencias.
export const SCHEMA_VERSION = 1;
export const DOMAINS = ['Arquitectura', 'Operaciones', 'Capacity', 'Continuidad', 'Gobierno', 'Seguridad', 'Proveedores'];
export const DEMO_DATE = '2026-11-18';

export function makeEmpty() {
  return { version: SCHEMA_VERSION, kind: 'local', verticals: [], services: [], assessments: [],
    capacities: [], teamCapacities: [], risks: [], actions: [], decisions: [], events: [] };
}

export function createDemo() {
  const state = makeEmpty();
  state.kind = 'demo';
  state.verticals = [
    {id:'v-infra',name:'Infraestructura & Plataformas',owner:'Gerencia de Infraestructura',description:'Data centers, cómputo, almacenamiento y virtualización'},
    {id:'v-net',name:'Networking & Conectividad',owner:'Gerencia de Redes',description:'Conectividad, enlaces, perímetro y disponibilidad de red'},
    {id:'v-cloud',name:'Cloud & Arquitectura',owner:'Arquitectura Empresarial',description:'Arquitectura híbrida, plataformas cloud e integración'},
    {id:'v-ops',name:'Operaciones IT',owner:'Gerencia de Operaciones',description:'Gestión de servicios, incidentes y continuidad operativa'}
  ];
  state.services = [
    {id:'s-core',verticalId:'v-infra',name:'Core transaccional',owner:'Plataformas',criticality:1,periodMinutes:43200,downtimeMinutes:62,targetPct:99.95,rtoMin:30,rpoMin:5,lastDRTest:'2026-05-04',drResult:'parcial',drEvidence:'Ejercicio ficticio: pendiente repetir prueba.'},
    {id:'s-channel',verticalId:'v-cloud',name:'Canales digitales',owner:'Cloud & Arquitectura',criticality:1,periodMinutes:43200,downtimeMinutes:10,targetPct:99.9,rtoMin:60,rpoMin:15,lastDRTest:'2026-09-16',drResult:'aprobado',drEvidence:'Ejercicio simulado documentado.'},
    {id:'s-network',verticalId:'v-net',name:'Conectividad entre sitios',owner:'Networking',criticality:1,periodMinutes:43200,downtimeMinutes:0,targetPct:99.95,rtoMin:30,rpoMin:0,lastDRTest:'',drResult:'sin-evaluar',drEvidence:''},
    {id:'s-itsm',verticalId:'v-ops',name:'Plataforma ITSM',owner:'Operaciones',criticality:2,periodMinutes:43200,downtimeMinutes:23,targetPct:99.5,rtoMin:120,rpoMin:60,lastDRTest:'2026-10-12',drResult:'aprobado',drEvidence:'Ensayo ficticio de restauración.'}
  ];
  state.assessments = [
    {id:'as-1',verticalId:'v-infra',domain:'Capacity',score:2,finding:'Crecimiento de almacenamiento sin reserva suficiente.',owner:'Gerencia de Infraestructura',evidence:'Inventario de prueba ficticio',date:'2026-11-10'},
    {id:'as-2',verticalId:'v-net',domain:'Continuidad',score:2,finding:'Dependencia de proveedor y ejercicio DR pendiente.',owner:'Gerencia de Redes',evidence:'Matriz ficticia de enlaces',date:'2026-11-13'},
    {id:'as-3',verticalId:'v-cloud',domain:'Arquitectura',score:4,finding:'Revisión de estándares actualizada.',owner:'Arquitectura Empresarial',evidence:'Registro simulado',date:'2026-11-11'},
    {id:'as-4',verticalId:'v-ops',domain:'Operaciones',score:3,finding:'Reforzar análisis de incidentes recurrentes.',owner:'Gerencia de Operaciones',evidence:'Informe sintético',date:'2026-11-14'}
  ];
  state.capacities = [
    {id:'c-san',verticalId:'v-infra',name:'Storage corporativo',unit:'TB',used:83,total:96,growthPct:4.5,thresholdPct:85,owner:'Gerencia de Infraestructura'},
    {id:'c-comp',verticalId:'v-infra',name:'Capacidad de cómputo',unit:'vCPU',used:580,total:900,growthPct:3,thresholdPct:80,owner:'Gerencia de Infraestructura'},
    {id:'c-enlace',verticalId:'v-net',name:'Enlace principal',unit:'Gbps',used:6.2,total:10,growthPct:6,thresholdPct:80,owner:'Gerencia de Redes'},
    {id:'c-cloud',verticalId:'v-cloud',name:'Reserva de cómputo cloud',unit:'vCPU',used:142,total:200,growthPct:5,thresholdPct:80,owner:'Arquitectura Empresarial'}
  ];
  state.teamCapacities = [
    {id:'tc-infra',verticalId:'v-infra',name:'Operación de plataformas',availableFte:14,allocatedFte:12,coveragePct:95,thresholdPct:90,owner:'Gerencia de Infraestructura',skillsGap:'Documentación de turnos'},
    {id:'tc-net',verticalId:'v-net',name:'Ingeniería de conectividad',availableFte:9,allocatedFte:7.5,coveragePct:92,thresholdPct:90,owner:'Gerencia de Redes',skillsGap:'Cobertura de reemplazos'},
    {id:'tc-cloud',verticalId:'v-cloud',name:'Arquitectura híbrida',availableFte:6,allocatedFte:5,coveragePct:100,thresholdPct:90,owner:'Arquitectura Empresarial',skillsGap:'Reforzar observabilidad'},
    {id:'tc-ops',verticalId:'v-ops',name:'Centro de operaciones',availableFte:16,allocatedFte:14,coveragePct:94,thresholdPct:90,owner:'Gerencia de Operaciones',skillsGap:'Entrenamiento DRP'}
  ];
  state.risks = [
    {id:'r-san',verticalId:'v-infra',serviceId:'s-core',assessmentId:'as-1',capacityId:'c-san',title:'Saturación de almacenamiento crítico',description:'Capacidad utilizada por encima del umbral, con crecimiento mensual.',owner:'Gerencia de Infraestructura',probability:4,impact:5,status:'abierto',evidence:'',source:'assessment',createdAt:'2026-11-10'},
    {id:'r-net',verticalId:'v-net',serviceId:'s-network',assessmentId:'as-2',capacityId:'',title:'Recuperación de conectividad sin ensayo validado',description:'Dependencia de redundancia y pruebas de continuidad incompletas.',owner:'Gerencia de Redes',probability:3,impact:5,status:'abierto',evidence:'',source:'assessment',createdAt:'2026-11-13'},
    {id:'r-core-dr',verticalId:'v-infra',serviceId:'s-core',assessmentId:'',capacityId:'',title:'RTO/RPO del core requiere reverificación',description:'Último resultado de continuidad parcial.',owner:'Gerencia de Infraestructura',probability:3,impact:5,status:'abierto',evidence:'',source:'continuidad',createdAt:'2026-11-12'}
  ];
  state.actions = [
    {id:'ac-san',riskId:'r-san',title:'Evaluar ampliación y optimización de storage',owner:'Infraestructura',dueDate:'2026-11-25',status:'en-curso',evidence:'',createdAt:'2026-11-11'},
    {id:'ac-dr',riskId:'r-core-dr',title:'Repetir prueba de recuperación del core',owner:'Continuidad IT',dueDate:'2026-11-15',status:'pendiente',evidence:'',createdAt:'2026-11-12'}
  ];
  state.decisions = [
    {id:'d-1',riskId:'r-san',title:'Evaluar alternativas de capacidad y presupuesto',owner:'Comité de Tecnología',dueDate:'2026-11-27',status:'pendiente',evidence:'',createdAt:'2026-11-13'}
  ];
  state.events = [
    {id:'e-1',date:'2026-11-13',type:'committee',text:'Se creó una decisión de comité vinculada a un riesgo de capacidad'},
    {id:'e-2',date:'2026-11-12',type:'action',text:'Se registró un plan correctivo asociado a continuidad'}
  ];
  return state;
}

export function assertValidState(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state) || state.version !== SCHEMA_VERSION)
    throw new Error('Formato o versión de datos incompatible.');
  const keys = ['verticals','services','assessments','capacities','teamCapacities','risks','actions','decisions','events'];
  for (const k of keys) {
    if (!Array.isArray(state[k]) || state[k].length > 3000) throw new Error('Datos incompletos en ' + k);
    const ids = new Set();
    for (const item of state[k]) {
      if (!item || typeof item.id !== 'string' || item.id.length > 90 || ids.has(item.id)) throw new Error('IDs duplicados o inválidos en ' + k);
      ids.add(item.id);
    }
  }
  if (state.verticals.length > 100 || state.events.length > 3000) throw new Error('El archivo supera el límite admitido.');
  const ids=new Set(state.verticals.map(v=>v.id));
  const isStr=x=>typeof x==='string'&&x.length<=1500;
  const finite=x=>typeof x==='number'&&Number.isFinite(x);
  const validDate=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x);
  for(const v of state.verticals){
    if(!isStr(v.name)||!isStr(v.owner)||!isStr(v.description))throw new Error('Vertical con campos inválidos.');
  }
  for(const a of state.assessments){
    if(!ids.has(a.verticalId)||!Number.isInteger(a.score)||a.score<1||a.score>5||!isStr(a.finding)||!isStr(a.owner)||!isStr(a.domain)||!isStr(a.evidence))
      throw new Error('Assessment con datos inválidos.');
  }
  for(const c of state.capacities){
    if(!ids.has(c.verticalId)||!isStr(c.name)||!isStr(c.unit)||!isStr(c.owner)||!finite(c.used)||!finite(c.total)||c.used<0||c.total<=0||!finite(c.growthPct)||c.growthPct<0||c.growthPct>100||!finite(c.thresholdPct)||c.thresholdPct<=0||c.thresholdPct>100)
      throw new Error('Capacity con datos inválidos.');
  }
  for(const t of state.teamCapacities){
    if(!ids.has(t.verticalId)||!isStr(t.name)||!isStr(t.owner)||!isStr(t.skillsGap)||!finite(t.availableFte)||t.availableFte<=0||!finite(t.allocatedFte)||t.allocatedFte<0||!finite(t.coveragePct)||t.coveragePct<0||t.coveragePct>100||!finite(t.thresholdPct)||t.thresholdPct<=0||t.thresholdPct>100)
      throw new Error('Capacity de equipo con datos inválidos.');
  }
  for(const r of state.risks){
    if(!ids.has(r.verticalId)||!isStr(r.title)||!isStr(r.description)||!isStr(r.owner)||!isStr(r.evidence)||!Number.isInteger(r.probability)||r.probability<1||r.probability>5||!Number.isInteger(r.impact)||r.impact<1||r.impact>5||!['abierto','validado','aceptado'].includes(r.status))
      throw new Error('Riesgo con datos inválidos.');
  }
  const risks=new Set(state.risks.map(r=>r.id));
  for(const a of state.actions){
    if(!risks.has(a.riskId)||!isStr(a.title)||!isStr(a.owner)||!isStr(a.evidence)||!validDate(a.dueDate)||!['pendiente','en-curso','bloqueada','completada'].includes(a.status))
      throw new Error('Acción con datos inválidos.');
  }
  for(const v of state.services){
    if(!ids.has(v.verticalId)||!isStr(v.name)||!isStr(v.owner)||!isStr(v.drEvidence)||!finite(v.periodMinutes)||v.periodMinutes<=0||!finite(v.downtimeMinutes)||v.downtimeMinutes<0||v.downtimeMinutes>v.periodMinutes||!finite(v.targetPct)||v.targetPct<0||v.targetPct>100||!finite(v.rtoMin)||v.rtoMin<0||!finite(v.rpoMin)||v.rpoMin<0||!['sin-evaluar','aprobado','parcial','fallido'].includes(v.drResult))
      throw new Error('Servicio con datos inválidos.');
  }
  for(const d of state.decisions){
    if(d.riskId&&!risks.has(d.riskId))throw new Error('Decisión con riesgo inexistente.');
    if(!isStr(d.title)||!isStr(d.owner)||!isStr(d.evidence)||!validDate(d.dueDate)||!['pendiente','resuelta'].includes(d.status))
      throw new Error('Decisión con datos inválidos.');
  }
  for(const e of state.events){
    if(!isStr(e.text)||!isStr(e.type)||!isStr(e.date))throw new Error('Registro de auditoría inválido.');
  }
  return state;
}

export function pct(used,total) {
  const a=Number(used),b=Number(total);
  return Number.isFinite(a)&&Number.isFinite(b)&&a>=0&&b>0 ? a/b*100 : null;
}
export function availability(service) {
  const period=Number(service.periodMinutes),down=Number(service.downtimeMinutes);
  if (!Number.isFinite(period)||period<=0||!Number.isFinite(down)||down<0||down>period) return null;
  return 100*(period-down)/period;
}
export function capacityStatus(asset) {
  const utilization=pct(asset.used,asset.total);
  const limit=Number(asset.thresholdPct);
  const growth=Number(asset.growthPct);
  const forecast=utilization===null||!Number.isFinite(growth)||growth<0 ? null : utilization*Math.pow(1+growth/100,3);
  return { utilization, forecast, limit, warning:utilization!==null && utilization>=limit,
    futureWarning:forecast!==null && forecast>=limit };
}
export function teamStatus(team) {
  const utilization=pct(team.allocatedFte,team.availableFte);
  const coverage=Number(team.coveragePct),threshold=Number(team.thresholdPct);
  const understaffed=utilization!==null&&utilization>=threshold;
  const coverageGap=Number.isFinite(coverage)&&coverage<90;
  return {utilization,coverage,threshold,understaffed,coverageGap,warning:understaffed||coverageGap};
}
export function registerTeamCapacity(state,record,today,idFactory){
  const utilization=pct(record.allocatedFte,record.availableFte);
  const coverage=Number(record.coveragePct),limit=Number(record.thresholdPct);
  if(utilization===null||!Number.isFinite(coverage)||coverage<0||coverage>100||!Number.isFinite(limit)||limit<=0||limit>100)
    throw new Error('Revisá dotación, asignación, cobertura y umbral.');
  if(!record.name?.trim()||!state.verticals.some(v=>v.id===record.verticalId))throw new Error('Equipo o vertical inválidos.');
  const team={id:idFactory('tc'),verticalId:record.verticalId,name:record.name.trim(),
    availableFte:Number(record.availableFte),allocatedFte:Number(record.allocatedFte),
    coveragePct:coverage,thresholdPct:limit,owner:record.owner?.trim()||'Sin asignar',
    skillsGap:record.skillsGap?.trim()||''};
  state.teamCapacities.unshift(team);
  addEvent(state,'team','Evaluación de capacidad del equipo '+team.name,today);
  let risk=null;
  if(teamStatus(team).warning){
    risk={id:idFactory('r'),verticalId:team.verticalId,serviceId:'',assessmentId:'',capacityId:'',teamCapacityId:team.id,
      title:'Capacidad de equipo comprometida: '+team.name,
      description:'Carga '+utilization.toFixed(1)+'%; cobertura '+coverage+'%. Registrar plan de dotación, priorización o formación.',
      owner:team.owner,probability:3,impact:4,status:'abierto',evidence:'',source:'team-capacity',createdAt:today};
    state.risks.unshift(risk);
    addEvent(state,'risk','Riesgo generado por capacidad o cobertura insuficiente de equipo',today);
  }
  return {team,risk};
}
export function severity(risk) {
  const p=Number(risk.probability),i=Number(risk.impact);
  if (!Number.isInteger(p)||!Number.isInteger(i)||p<1||p>5||i<1||i>5) throw new Error('Impacto y probabilidad entre 1 y 5.');
  const score=p*i;
  return {score,label:score>=15?'Crítico':score>=9?'Alto':score>=5?'Medio':'Bajo'};
}
export function riskTreatment(risk, actions) {
  if (risk.status==='validado') return 'Mitigación validada';
  if (risk.status==='aceptado') return 'Aceptado';
  return actions.some(action=>action.riskId===risk.id) ? 'Con plan' : 'Sin plan';
}
export function actionOverdue(action,today) {
  return action.status!=='completada' && typeof action.dueDate==='string' && /^\d{4}-\d{2}-\d{2}$/.test(action.dueDate) && action.dueDate<today;
}
export function continuity(service) {
  const status=service.drResult;
  if (status==='aprobado') return {label:'Prueba aprobada',ok:true};
  if (status==='parcial') return {label:'Prueba parcial',ok:false};
  if (status==='fallido') return {label:'Prueba fallida',ok:false};
  return {label:'Sin evaluar',ok:false};
}
export function dashboard(state,today) {
  const active=state.risks.filter(r=>r.status==='abierto');
  const unmanaged=active.filter(r=>!state.actions.some(a=>a.riskId===r.id));
  const criticalUnmanaged=unmanaged.filter(r=>severity(r).score>=15);
  const overdue=state.actions.filter(a=>actionOverdue(a,today));
  const capacityAlerts=state.capacities.filter(c=>capacityStatus(c).warning);
  const teamAlerts=state.teamCapacities.filter(c=>teamStatus(c).warning);
  const drGaps=state.services.filter(s=>Number(s.criticality)===1&&!continuity(s).ok);
  const lowAssessments=state.assessments.filter(a=>Number(a.score)<=2);
  const avgAssessment=state.assessments.length?state.assessments.reduce((sum,a)=>sum+Number(a.score),0)/state.assessments.length:null;
  return {activeRisks:active.length,unmanaged:unmanaged.length,criticalUnmanaged:criticalUnmanaged.length,
    overdue:overdue.length,capacityAlerts:capacityAlerts.length,teamAlerts:teamAlerts.length,drGaps:drGaps.length,
    lowAssessments:lowAssessments.length,averageAssessment:avgAssessment,
    riskTreatmentPct:active.length?100*(active.length-unmanaged.length)/active.length:null};
}
export function addEvent(state,type,text,today) {
  state.events.unshift({id:'evt-'+Math.random().toString(36).slice(2),date:today,type,text});
  state.events=state.events.slice(0,100);
}
export function linkedRisk(state, linkKey, linkId) {
  return state.risks.find(r=>r[linkKey]===linkId&&r.status==='abierto');
}
export function registerAssessment(state,record,today,idFactory) {
  const score=Number(record.score);
  if(!Number.isInteger(score)||score<1||score>5) throw new Error('La madurez debe estar entre 1 y 5.');
  if(!state.verticals.some(v=>v.id===record.verticalId)) throw new Error('Vertical inexistente.');
  if(!record.finding?.trim()||!record.owner?.trim()) throw new Error('Indicá hallazgo y responsable.');
  const assessment={id:idFactory('as'),verticalId:record.verticalId,domain:record.domain,score,finding:record.finding.trim(),owner:record.owner.trim(),evidence:record.evidence?.trim()||'',date:today};
  state.assessments.unshift(assessment);
  addEvent(state,'assessment','Assessment registrado en '+assessment.domain,today);
  let risk=null;
  if(score<=2) {
    risk={id:idFactory('r'),verticalId:record.verticalId,serviceId:'',assessmentId:assessment.id,capacityId:'',
      title:'Brecha de '+assessment.domain+': '+assessment.finding.slice(0,85),
      description:assessment.finding,owner:assessment.owner,probability:3,impact:score===1?5:4,
      status:'abierto',evidence:'',source:'assessment',createdAt:today};
    state.risks.unshift(risk);
    addEvent(state,'risk','Riesgo generado automáticamente por assessment de madurez '+score+'/5',today);
  }
  return {assessment,risk};
}
export function registerCapacity(state,record,today,idFactory) {
  const utilized=pct(record.used,record.total);
  const threshold=Number(record.thresholdPct);
  const growth=Number(record.growthPct);
  if(utilized===null||!Number.isFinite(threshold)||threshold<=0||threshold>100||!Number.isFinite(growth)||growth<0||growth>100)
    throw new Error('Revisá capacidad, crecimiento y umbral.');
  if(!record.name?.trim()||!record.unit?.trim()||!state.verticals.some(v=>v.id===record.verticalId))
    throw new Error('Indicá recurso, unidad y vertical.');
  const asset={id:idFactory('c'),verticalId:record.verticalId,name:record.name.trim(),unit:record.unit.trim(),
    used:Number(record.used),total:Number(record.total),growthPct:growth,thresholdPct:threshold,owner:record.owner?.trim()||'Sin asignar'};
  state.capacities.unshift(asset);
  addEvent(state,'capacity','Medición registrada: '+asset.name,today);
  let risk=null;
  if(utilized>=threshold) {
    risk={id:idFactory('r'),verticalId:asset.verticalId,serviceId:'',assessmentId:'',capacityId:asset.id,
      title:'Capacidad sobre umbral: '+asset.name,description:'Utilización '+utilized.toFixed(1)+'% frente al umbral de '+threshold+'%.',
      owner:asset.owner,probability:4,impact:4,status:'abierto',evidence:'',source:'capacity',createdAt:today};
    state.risks.unshift(risk);
    addEvent(state,'risk','Riesgo generado automáticamente por superar el umbral de capacidad',today);
  }
  return {asset,risk};
}
export function registerAction(state,record,today,idFactory) {
  if(!state.risks.some(r=>r.id===record.riskId&&r.status==='abierto')) throw new Error('Seleccioná un riesgo abierto.');
  if(!record.title?.trim()||!record.owner?.trim()||!/^\d{4}-\d{2}-\d{2}$/.test(record.dueDate||'')) throw new Error('Título, responsable y vencimiento son obligatorios.');
  const action={id:idFactory('ac'),riskId:record.riskId,title:record.title.trim(),owner:record.owner.trim(),
    dueDate:record.dueDate,status:'pendiente',evidence:'',createdAt:today};
  state.actions.unshift(action);
  addEvent(state,'action','Plan de acción asignado a '+action.owner,today);
  return action;
}
export function completeAction(state,id,evidence,today) {
  const a=state.actions.find(x=>x.id===id);
  if(!a) throw new Error('Acción inexistente.');
  if(a.status==='completada') throw new Error('La acción ya está completa.');
  if(!evidence||evidence.trim().length<8) throw new Error('Registrá evidencia de al menos ocho caracteres.');
  a.status='completada';a.evidence=evidence.trim();a.completedAt=today;
  addEvent(state,'action','Acción completada con evidencia: '+a.title,today);
  return a;
}
export function validateRisk(state,id,evidence,today) {
  const r=state.risks.find(x=>x.id===id);
  if(!r||r.status!=='abierto') throw new Error('Solo se validan riesgos abiertos.');
  const actions=state.actions.filter(a=>a.riskId===id);
  if(!actions.length||actions.some(a=>a.status!=='completada')) throw new Error('Primero completá todas las acciones vinculadas.');
  if(!evidence||evidence.trim().length<12) throw new Error('La validación requiere evidencia verificable.');
  r.status='validado';r.evidence=evidence.trim();r.validatedAt=today;
  addEvent(state,'risk','Mitigación validada con evidencia: '+r.title,today);
  return r;
}
