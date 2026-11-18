// Señales ejecutivas con reglas visibles; sin inventar telemetría ni datos faltantes.
import { severity, riskTreatment, actionOverdue, capacityStatus, teamStatus, continuity, availability, dashboard } from './core.js';

export const SIGNAL = Object.freeze({
  critical: {label:'Crítico',order:4},
  warning: {label:'Atención',order:3},
  ok: {label:'En control',order:1},
  unknown: {label:'Sin evaluar',order:0}
});
const asSignal=(level,reason)=>({level,label:SIGNAL[level].label,reason});
export function worstSignal(signals) {
  const known=signals.filter(s=>s && s.level!=='unknown');
  if(!known.length)return asSignal('unknown','No hay registros suficientes para evaluar esta dimensión.');
  return known.reduce((a,b)=>SIGNAL[a.level].order>=SIGNAL[b.level].order?a:b);
}
export function riskSignal(risk,actions,today) {
  if(risk.status==='validado')return asSignal('ok','Mitigación validada con evidencia.');
  if(risk.status==='aceptado')return asSignal('warning','Riesgo aceptado; revisar vigencia y autorización.');
  const score=severity(risk).score;
  const related=actions.filter(a=>a.riskId===risk.id);
  if(!related.length)return asSignal(score>=15?'critical':'warning','Riesgo abierto sin plan correctivo.');
  if(related.some(a=>actionOverdue(a,today)||a.status==='bloqueada'))
    return asSignal('critical','Plan asociado vencido o bloqueado.');
  if(score>=15)return asSignal('warning','Riesgo crítico con plan abierto; supervisar tratamiento.');
  return asSignal('warning','Riesgo abierto con plan registrado.');
}
export function actionSignal(action,today) {
  if(action.status==='completada')return asSignal('ok','Acción cerrada con evidencia.');
  if(action.status==='bloqueada'||actionOverdue(action,today))return asSignal('critical','Acción vencida o bloqueada.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(action.dueDate||''))
    return asSignal('unknown','No se registró una fecha válida.');
  const remain=Math.round((Date.parse(action.dueDate+'T12:00:00Z')-Date.parse(today+'T12:00:00Z'))/86400000);
  return remain<=7?asSignal('warning','Próxima a vencer en siete días o menos.')
    :asSignal('ok','Compromiso dentro de plazo.');
}
export function infrastructureSignal(asset){
  const s=capacityStatus(asset);
  if(s.utilization===null||!Number.isFinite(s.limit))return asSignal('unknown','Falta medición o umbral válido.');
  if(s.utilization>=s.limit)return asSignal('critical','Utilización igual o superior al umbral configurado.');
  if(s.limit-s.utilization<=10 || s.futureWarning)return asSignal('warning','Utilización cercana al umbral o proyección a tres meses comprometida.');
  return asSignal('ok','Capacidad operando debajo de umbrales y proyección.');
}
export function workforceSignal(team){
  const s=teamStatus(team);
  if(s.utilization===null||!Number.isFinite(s.coverage))return asSignal('unknown','Falta información de dotación o cobertura.');
  if(s.understaffed||s.coverageGap)return asSignal('critical','Sobrecarga o cobertura operativa inferior al 90%.');
  if(s.threshold-s.utilization<=10||s.coverage<95)return asSignal('warning','Dotación o cobertura cerca del umbral.');
  return asSignal('ok','Carga y cobertura dentro de objetivos.');
}
export function assessmentSignal(assessment) {
  const score=Number(assessment.score);
  if(!Number.isInteger(score)||score<1||score>5)return asSignal('unknown','Falta evaluación válida.');
  return score<=2?asSignal('critical','Madurez de 1–2/5; requiere evaluación de brecha.')
    :score===3?asSignal('warning','Madurez de 3/5; requiere evolución y seguimiento.')
    :asSignal('ok','Madurez de 4–5/5 conforme al criterio del assessment.');
}
export function serviceSignal(service,today){
  if(!service)return asSignal('unknown','Servicio sin registro.');
  const ratio=availability(service);
  const slaBroken=ratio!==null&&ratio<Number(service.targetPct);
  if(slaBroken)return asSignal('critical','Disponibilidad observada inferior al SLA objetivo.');
  if(service.drResult==='fallido')return asSignal('critical','Prueba de continuidad fallida.');
  if(service.drResult==='parcial')return asSignal('warning','Ejercicio de continuidad parcial.');
  if(service.drResult!=='aprobado'||!service.lastDRTest)return asSignal('unknown','Continuidad no evaluada; no es prueba de incumplimiento.');
  const last=Date.parse(service.lastDRTest+'T12:00:00Z'),now=Date.parse(today+'T12:00:00Z');
  if(!Number.isFinite(last)||last>now)return asSignal('unknown','Fecha de prueba inexistente o futura.');
  return Math.floor((now-last)/86400000)>180
    ?asSignal('warning','La prueba aprobada tiene más de 180 días; política de ejemplo.')
    :asSignal('ok','SLA observado y DR aprobado dentro de 180 días.');
}
export function verticalSignal(state,verticalId,today) {
 const all=[
   ...state.risks.filter(r=>r.verticalId===verticalId&&r.status==='abierto').map(r=>riskSignal(r,state.actions,today)),
   ...state.capacities.filter(r=>r.verticalId===verticalId).map(infrastructureSignal),
   ...state.teamCapacities.filter(r=>r.verticalId===verticalId).map(workforceSignal),
   ...state.assessments.filter(r=>r.verticalId===verticalId).map(assessmentSignal),
   ...state.services.filter(r=>r.verticalId===verticalId).map(r=>serviceSignal(r,today)),
   ...state.actions.filter(a=>state.risks.some(r=>r.id===a.riskId&&r.verticalId===verticalId)&&a.status!=='completada').map(a=>actionSignal(a,today))
 ];
 const signal=worstSignal(all),unknown=all.filter(s=>s.level==='unknown').length;
 return {...signal,unknown,assessed:all.length-unknown,total:all.length};
}
export function executiveSummary(state,today) {
 const counts=dashboard(state,today);
 const active=state.risks.filter(r=>r.status==='abierto');
 const blocked=state.actions.filter(a=>a.status==='bloqueada').length;
 const slaBreaches=state.services.filter(s=>availability(s)!==null&&availability(s)<Number(s.targetPct)).length;
 const unverified=state.services.filter(s=>Number(s.criticality)===1&&!continuity(s).ok).length;
 const pendingDecisions=state.decisions.filter(d=>d.status==='pendiente').length;
 const signals=[
   ...active.map(r=>riskSignal(r,state.actions,today)),
   ...state.capacities.map(infrastructureSignal),
   ...state.teamCapacities.map(workforceSignal),
   ...state.services.map(s=>serviceSignal(s,today)),
   ...state.actions.filter(a=>a.status!=='completada').map(a=>actionSignal(a,today)),
   ...state.assessments.map(assessmentSignal)
 ];
 const status=worstSignal(signals);
 const availabilityMeasured=state.services.map(availability).filter(v=>v!==null);
 const averageAvailability=availabilityMeasured.length
   ?availabilityMeasured.reduce((sum,v)=>sum+v,0)/availabilityMeasured.length:null;
 const criticalServices=state.services.filter(s=>Number(s.criticality)===1);
 const provenDR=criticalServices.filter(s=>serviceSignal(s,today).level==='ok').length;
 const priorities=[];
 if(counts.criticalUnmanaged)priorities.push(counts.criticalUnmanaged+' riesgo(s) crítico(s) sin plan');
 if(counts.overdue)priorities.push(counts.overdue+' acción(es) vencida(s)');
 if(slaBreaches)priorities.push(slaBreaches+' servicio(s) con SLA incumplido');
 if(counts.capacityAlerts+counts.teamAlerts)priorities.push((counts.capacityAlerts+counts.teamAlerts)+' alerta(s) de capacidad');
 if(unverified)priorities.push(unverified+' servicio(s) crítico(s) sin DR aprobado');
 const sentence=priorities.length
   ?'Priorizar '+priorities.slice(0,3).join(' · ')+'. Revisar responsables, medidas y evidencias antes del próximo comité.'
   :'Sin excepciones críticas registradas en los controles evaluados. Mantener pruebas, seguimiento y actualización de datos.';
 return {...counts,status,blocked,slaBreaches,unverified,pendingDecisions,averageAvailability,
   criticalServices:criticalServices.length,provenDR,priorities,sentence,
   signalCounts:{critical:signals.filter(x=>x.level==='critical').length,warning:signals.filter(x=>x.level==='warning').length,ok:signals.filter(x=>x.level==='ok').length,unknown:signals.filter(x=>x.level==='unknown').length}};
}
export function riskMatrix(risks){
 const open=risks.filter(r=>r.status==='abierto');
 return Array.from({length:5},(_,row)=>Array.from({length:5},(_,col)=>{
   const probability=5-row,impact=col+1,score=probability*impact;
   return {probability,impact,score,count:open.filter(r=>r.probability===probability&&r.impact===impact).length,
     level:score>=15?'critical':score>=9?'warning':'ok'};
 }));
}
