// ATLAS · Catálogo de KPI y seguimiento de OKR.
// Todos los valores surgen de registros del workspace; no hay KPIs ficticios de pantalla.
import {dashboard,availability} from './core.js';
import {serviceSignal} from './insights.js';
import {incidentMetrics} from './incidents.js';

export const METRICS = Object.freeze({
 critical_unmanaged:{label:'Riesgos críticos sin plan',unit:'cantidad',direction:'lower',description:'Riesgos abiertos con exposición ≥15/25 y ninguna acción vinculada.'},
 overdue_actions:{label:'Acciones vencidas',unit:'cantidad',direction:'lower',description:'Acciones no completadas cuya fecha objetivo ya pasó.'},
 risk_coverage:{label:'Cobertura de tratamiento',unit:'%',direction:'higher',description:'Porcentaje de riesgos abiertos con al menos una acción vinculada.'},
 capacity_alerts:{label:'Alertas de capacity',unit:'cantidad',direction:'lower',description:'Recursos sobre umbral + equipos sobrecargados o con cobertura inferior al 90%.'},
 dr_verified:{label:'Continuidad crítica validada',unit:'%',direction:'higher',description:'Servicios Tier 1 con DR aprobado en los últimos 180 días y SLA observado cumplido.'},
 sla_compliance:{label:'Cumplimiento de SLA',unit:'%',direction:'higher',description:'Porcentaje de servicios con disponibilidad registrada que cumplen su propio objetivo.'},
 availability_mean:{label:'Disponibilidad media de servicios',unit:'%',direction:'higher',description:'Promedio simple, no ponderado, de disponibilidad calculada de servicios con registros.'},
 assessment_maturity:{label:'Madurez media de assessments',unit:'/5',direction:'higher',description:'Media aritmética de scores de madurez (1–5), sin ponderación por vertical.'},
 team_coverage:{label:'Cobertura media de equipos',unit:'%',direction:'higher',description:'Media no ponderada de cobertura operativa de equipos registrados.'},
 decisions_overdue:{label:'Decisiones de comité vencidas',unit:'cantidad',direction:'lower',description:'Compromisos pendientes con fecha objetivo anterior a hoy.'},
 mttr_90d:{label:'MTTR de incidentes (90 días)',unit:'min',direction:'lower',description:'Media de minutos entre apertura y resolución de incidentes cerrados en los últimos 90 días.'},
 critical_incidents_30d:{label:'Incidentes P1/P2 (30 días)',unit:'cantidad',direction:'lower',description:'Número de incidentes P1 y P2 abiertos en los últimos 30 días; incluye casos resueltos.'},
 open_incidents:{label:'Incidentes abiertos',unit:'cantidad',direction:'lower',description:'Incidentes que todavía no tienen fecha/hora de resolución registrada.'}
});
export const KPI_OPTIONS=Object.entries(METRICS).map(([key,val])=>[key,val.label]);
const idValid=id=>typeof id==='string'&&id.length>0&&id.length<=90;
const textValid=(value,min=1,max=180)=>typeof value==='string'&&value.trim().length>=min&&value.trim().length<=max;
const numValid=v=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=1e9;
const dateValid=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v);
export function ensurePerformanceState(state){
  if(!state||typeof state!=='object')throw new Error('Estado de ATLAS inválido.');
  for(const k of ['kpis','objectives','keyResults'])if(!Array.isArray(state[k]))state[k]=[];
  return state;
}
export function seedDemoPerformance(state){
  ensurePerformanceState(state);
  if(state.kpis.length||state.objectives.length||state.keyResults.length)return state;
  state.kpis=[
    {id:'kpi-risks',name:'Riesgos críticos sin plan',metric:'critical_unmanaged',target:0,owner:'Gerencia de Tecnología',verticalId:''},
    {id:'kpi-dr',name:'Cobertura de DR para servicios críticos',metric:'dr_verified',target:100,owner:'Continuidad IT',verticalId:''},
    {id:'kpi-risk-coverage',name:'Tratamiento de riesgos activos',metric:'risk_coverage',target:100,owner:'Gobierno de Tecnología',verticalId:''},
    {id:'kpi-actions',name:'Compromisos vencidos',metric:'overdue_actions',target:0,owner:'PMO Tecnológica',verticalId:''},
    {id:'kpi-sla',name:'Servicios con SLA cumplido',metric:'sla_compliance',target:100,owner:'Operaciones IT',verticalId:''},
    {id:'kpi-mttr',name:'Tiempo medio de resolución',metric:'mttr_90d',target:60,owner:'Operaciones IT',verticalId:''},
    {id:'kpi-p1p2',name:'Incidentes prioritarios P1/P2',metric:'critical_incidents_30d',target:1,owner:'Gestión de Incidentes',verticalId:''}
  ];
  state.objectives=[
    {id:'okr-resilience',title:'Elevar el control de servicios críticos',owner:'Dirección de Tecnología',verticalId:'',startDate:'2026-11-01',dueDate:'2026-12-31',status:'activo'},
    {id:'okr-execution',title:'Fortalecer el cierre de compromisos de gestión',owner:'Gobierno de Tecnología',verticalId:'',startDate:'2026-11-01',dueDate:'2026-12-31',status:'activo'}
  ];
  state.keyResults=[
    {id:'kr-risk',objectiveId:'okr-resilience',kpiId:'kpi-risks',baseline:1,target:0},
    {id:'kr-dr',objectiveId:'okr-resilience',kpiId:'kpi-dr',baseline:33.3,target:100},
    {id:'kr-treat',objectiveId:'okr-execution',kpiId:'kpi-risk-coverage',baseline:66.7,target:100},
    {id:'kr-deadline',objectiveId:'okr-execution',kpiId:'kpi-actions',baseline:1,target:0}
  ];
  return state;
}
export function metricValue(state,key,today){
  ensurePerformanceState(state);
  const base=dashboard(state,today);
  const incidents=incidentMetrics(state,today);
  const measured=state.services.map(s=>({service:s,value:availability(s)})).filter(x=>x.value!==null);
  switch(key){
    case 'critical_unmanaged':return state.risks.length?base.criticalUnmanaged:null;
    case 'overdue_actions':return state.actions.length?base.overdue:null;
    case 'risk_coverage':return base.riskTreatmentPct;
    case 'capacity_alerts':return state.capacities.length+state.teamCapacities.length?base.capacityAlerts+base.teamAlerts:null;
    case 'dr_verified':{
      const critical=state.services.filter(s=>Number(s.criticality)===1);
      return critical.length?100*critical.filter(s=>serviceSignal(s,today).level==='ok').length/critical.length:null;
    }
    case 'sla_compliance':return measured.length?100*measured.filter(x=>x.value>=Number(x.service.targetPct)).length/measured.length:null;
    case 'availability_mean':return measured.length?measured.reduce((a,b)=>a+b.value,0)/measured.length:null;
    case 'assessment_maturity':return base.averageAssessment;
    case 'team_coverage':return state.teamCapacities.length?state.teamCapacities.reduce((n,t)=>n+Number(t.coveragePct),0)/state.teamCapacities.length:null;
    case 'decisions_overdue':return state.decisions.length?state.decisions.filter(d=>d.status==='pendiente'&&d.dueDate<today).length:null;
    case 'mttr_90d':return incidents.mttr90;
    case 'critical_incidents_30d':return incidents.total?incidents.critical30:null;
    case 'open_incidents':return incidents.total?incidents.open:null;
    default:throw new Error('Métrica no admitida.');
  }
}
export function targetReached(value,target,direction){
  if(value===null||!numValid(value)||!numValid(target))return null;
  return direction==='lower'?value<=target:value>=target;
}
export function kpiResult(state,kpi,today){
  const spec=METRICS[kpi.metric];
  if(!spec)throw new Error('Indicador no reconocido.');
  const value=metricValue(state,kpi.metric,today);
  const reached=targetReached(value,kpi.target,spec.direction);
  let level='unknown';
  if(reached===true)level='ok';
  else if(reached===false){
    // Atender desviaciones menores y priorizar incumplimientos significativos.
    const delta=spec.direction==='higher'?kpi.target-value:value-kpi.target;
    const scale=Math.max(1,Math.abs(kpi.target));
    level=delta/scale<=.10?'warning':'critical';
  }
  return {value,target:kpi.target,reached,level,unit:spec.unit,direction:spec.direction,description:spec.description};
}
export function keyResultProgress(state,result,today){
  const parent=state.objectives.find(o=>o.id===result.objectiveId);
  if(parent?.status==='cerrado'&&parent.closureResults?.[result.id])return parent.closureResults[result.id];
  const kpi=state.kpis.find(k=>k.id===result.kpiId);
  if(!kpi)return {progress:null,level:'unknown',value:null,reason:'KPI vinculado inexistente.'};
  const value=metricValue(state,kpi.metric,today);
  if(value===null||!numValid(value))return {progress:null,level:'unknown',value:null,reason:'No hay registros para calcular el KPI.'};
  const {baseline,target}=result;
  if(!numValid(baseline)||!numValid(target))return {progress:null,level:'unknown',value,reason:'Línea base o meta inválida.'};
  const direction=METRICS[kpi.metric].direction;
  const achieved=targetReached(value,target,direction);
  let progress=baseline===target?(achieved?100:0):100*(value-baseline)/(target-baseline);
  progress=Math.max(0,Math.min(100,progress));
  const level=progress>=100?'ok':progress>=50?'warning':'critical';
  return {value,progress,level,reason:achieved?'Meta lograda.':'Resultado en evolución respecto de la línea base.'};
}
export function objectiveProgress(state,objective,today){
  if(objective.status==='cerrado'&&objective.closureProgress)return objective.closureProgress;
  const results=state.keyResults.filter(k=>k.objectiveId===objective.id);
  if(!results.length)return {progress:null,level:'unknown',tracked:0,total:0,reason:'Sin resultados clave.'};
  const measured=results.map(r=>keyResultProgress(state,r,today)).filter(r=>r.progress!==null);
  if(!measured.length)return {progress:null,level:'unknown',tracked:0,total:results.length,reason:'Sin datos para medir resultados clave.'};
  const progress=measured.reduce((sum,r)=>sum+r.progress,0)/measured.length;
  const incomplete=measured.length<results.length;
  const level=incomplete?'warning':progress>=100?'ok':progress>=50?'warning':'critical';
  return {progress,level,tracked:measured.length,total:results.length,
    reason:incomplete?'Avance parcial: hay KR sin mediciones.':'Media simple del progreso de los KR medidos.'};
}
export function validatePerformanceState(state){
  ensurePerformanceState(state);
  for(const key of ['kpis','objectives','keyResults']){
    if(state[key].length>500)throw new Error('Se superó el límite de '+key);
    const ids=new Set();
    for(const record of state[key]){
      if(!record||!idValid(record.id)||ids.has(record.id))throw new Error('ID duplicado o inválido en '+key);
      ids.add(record.id);
    }
  }
  for(const k of state.kpis){
    if(!METRICS[k.metric]||!textValid(k.name)||!textValid(k.owner)||!numValid(k.target)||!textValid(k.verticalId||'',0,90))
      throw new Error('KPI con definición inválida.');
    if(k.verticalId&&!state.verticals.some(v=>v.id===k.verticalId))throw new Error('KPI asociado a vertical inexistente.');
  }
  for(const o of state.objectives){
    if(!textValid(o.title)||!textValid(o.owner)||!dateValid(o.startDate)||!dateValid(o.dueDate)||o.dueDate<o.startDate||!['activo','cerrado'].includes(o.status)||!textValid(o.verticalId||'',0,90))
      throw new Error('Objetivo con datos inválidos.');
    if(o.verticalId&&!state.verticals.some(v=>v.id===o.verticalId))throw new Error('Objetivo asociado a vertical inexistente.');
  }
  for(const kr of state.keyResults){
    if(!state.objectives.some(o=>o.id===kr.objectiveId)||!state.kpis.some(k=>k.id===kr.kpiId)||!numValid(kr.baseline)||!numValid(kr.target))
      throw new Error('Resultado clave sin vínculo o meta válida.');
    const kpi=state.kpis.find(k=>k.id===kr.kpiId),dir=METRICS[kpi.metric].direction;
    if(dir==='higher'&&kr.target<kr.baseline||dir==='lower'&&kr.target>kr.baseline)
      throw new Error('La meta debe mejorar respecto de la línea base.');
  }
  return state;
}
export function addKpi(state,record,idFactory){
  ensurePerformanceState(state);
  if(record.target===undefined||record.target===null||String(record.target).trim()==='')throw new Error('Indicá una meta numérica para el KPI.');
  const kpi={id:idFactory('kpi'),name:record.name?.trim()||'',metric:record.metric,
    target:Number(record.target),owner:record.owner?.trim()||'',verticalId:record.verticalId||''};
  state.kpis.push(kpi);
  try{validatePerformanceState(state)}catch(err){state.kpis.pop();throw err;}
  return kpi;
}
export function addObjective(state,record,idFactory){
  ensurePerformanceState(state);
  const obj={id:idFactory('okr'),title:record.title?.trim()||'',owner:record.owner?.trim()||'',
    verticalId:record.verticalId||'',startDate:record.startDate,dueDate:record.dueDate,status:'activo'};
  state.objectives.push(obj);
  try{validatePerformanceState(state)}catch(err){state.objectives.pop();throw err;}
  return obj;
}
export function addKeyResult(state,record,idFactory){
  ensurePerformanceState(state);
  if(record.baseline===undefined||String(record.baseline).trim()===''||record.target===undefined||String(record.target).trim()==='')throw new Error('Indicá línea base y meta numéricas.');
  const result={id:idFactory('kr'),objectiveId:record.objectiveId,kpiId:record.kpiId,
    baseline:Number(record.baseline),target:Number(record.target)};
  state.keyResults.push(result);
  try{validatePerformanceState(state)}catch(err){state.keyResults.pop();throw err;}
  return result;
}
export function closeObjective(state,id,today,evidence){
  const objective=state.objectives.find(o=>o.id===id);
  if(!objective||objective.status!=='activo')throw new Error('Solo se cierran objetivos activos.');
  const progress=objectiveProgress(state,objective,today);
  if(progress.progress===null||progress.tracked!==progress.total||progress.total===0)throw new Error('No se puede cerrar sin todos los KR medidos.');
  if(!textValid(evidence,8,1500))throw new Error('El cierre requiere evidencia de al menos ocho caracteres.');
  const results=state.keyResults.filter(r=>r.objectiveId===id);
  objective.closureResults=Object.fromEntries(results.map(r=>[r.id,keyResultProgress(state,r,today)]));
  objective.closureProgress={...progress,reason:'Progreso registrado al momento del cierre; no cambia con mediciones posteriores.'};
  objective.status='cerrado';objective.closedAt=today;objective.closureEvidence=evidence.trim();
  return objective;
}
