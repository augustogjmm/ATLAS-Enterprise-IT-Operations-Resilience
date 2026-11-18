import {
  DOMAINS, makeEmpty, createDemo, assertValidState, dashboard, severity, riskTreatment,
  actionOverdue, capacityStatus, availability, continuity, registerAssessment,
  registerCapacity, teamStatus, registerTeamCapacity, registerAction, completeAction, validateRisk, addEvent
} from './lib/governance/core.js';
import {worstSignal, riskSignal, actionSignal, infrastructureSignal, workforceSignal, assessmentSignal, serviceSignal, verticalSignal, executiveSummary, riskMatrix} from './lib/governance/insights.js';

const STORAGE_KEY='atlas-governance-workspace-v1';
const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const num=v=>new Intl.NumberFormat('es-AR',{maximumFractionDigits:1}).format(Number(v));
const fmtPct=v=>v===null||!Number.isFinite(v)?'Sin datos':num(v)+' %';
const nfmt=v=>new Intl.NumberFormat('es-AR',{maximumFractionDigits:2}).format(Number(v));
const short=v=>v&&v.length>75?v.slice(0,72)+'…':v;
const empty=(title='Sin registros',body='Podés cargar información desde el botón superior.')=>'<div class="empty-state"><strong>'+esc(title)+'</strong>'+esc(body)+'</div>';
const tag=(text,tone='neutral')=>'<span class="tag '+tone+'">'+esc(text)+'</span>';
const semaphore=signal=>'<span class="signal-chip signal-'+signal.level+'" title="'+esc(signal.reason)+'"><i aria-hidden="true"></i>'+esc(signal.label)+'</span>';
const signalLine=(name,signal,detail='',navigate='')=>'<div class="signal-line"><div class="signal-line-label"><span>'+esc(name)+'</span><small>'+esc(detail)+'</small></div>'+semaphore(signal)+(navigate?'<button class="signal-arrow" type="button" data-open="view:'+esc(navigate)+'" aria-label="Ver '+esc(name)+'">↗</button>':'')+'</div>';
const indicator=(label,value,description,signal)=>'<article class="executive-kpi signal-border-'+signal.level+'"><div class="executive-kpi-head"><span>'+esc(label)+'</span>'+semaphore(signal)+'</div><strong>'+esc(value)+'</strong><p>'+esc(description)+'</p></article>';
const percentBar=(percent,signal,limit)=>'<div class="capacity-track" role="img" aria-label="Utilización '+nfmt(percent)+' por ciento; umbral '+nfmt(limit)+' por ciento"><span class="capacity-fill capacity-'+signal.level+'" style="width:'+Math.max(0,Math.min(100,percent||0))+'%"></span><i class="capacity-threshold" style="left:'+Math.max(0,Math.min(100,limit||0))+'%" aria-hidden="true"></i></div>';
const heatmap=(risks)=>'<div class="heatmap-frame"><div class="heatmap-y-label">PROBABILIDAD ↑</div><div class="heatmap-container"><div class="heatmap-grid">'+riskMatrix(risks).flat().map(c=>'<button type="button" data-open="view:risks" class="heatmap-cell heatmap-'+c.level+(c.count?' populated':'')+'" aria-label="Probabilidad '+c.probability+', impacto '+c.impact+': '+c.count+' riesgos abiertos" title="P '+c.probability+' × I '+c.impact+' = '+c.score+'/25 · '+c.count+' riesgos">'+(c.count?'<b>'+c.count+'</b>':'<small>·</small>')+'</button>').join('')+'</div><div class="heatmap-x-label">IMPACTO →</div></div></div>';
const mini=(label,open,id='',style='')=>'<button class="mini-button '+style+'" type="button" data-open="'+esc(open)+'" data-id="'+esc(id)+'">'+esc(label)+'</button>';
const getVertical=id=>state.verticals.find(v=>v.id===id);
const getRisk=id=>state.risks.find(r=>r.id===id);
const getService=id=>state.services.find(s=>s.id===id);
const idFactory=prefix=>prefix+'-'+crypto.randomUUID();
const viewMeta={
 overview:['Visión ejecutiva','Alertas accionables y seguimiento de prioridades'],
 verticals:['Verticales y equipos','Gobierno por dominio y responsables'],
 capacity:['Capacity management','Utilización, umbrales y proyección de tres meses'],
 assessments:['Assessments','Madurez, evidencias y brechas de las verticales'],
 risks:['Registro de riesgos','Exposición, tratamiento y cobertura de planes'],
 actions:['Planes de acción','Compromisos, vencimientos y evidencia de ejecución'],
 continuity:['Continuidad y disponibilidad','Objetivos SLA, estado DRP y resultados observados'],
 committee:['Comité de Tecnología','Decisiones, responsables y compromisos ejecutivos']
};
let view='overview';
let modal=null;
let toastTimeout=null;
let storageOK=true;

function load(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY);
    if(raw)return assertValidState(JSON.parse(raw));
    const data=createDemo();
    localStorage.setItem(STORAGE_KEY,JSON.stringify(data));return data;
  }catch(err){storageOK=false;return createDemo();}
}
let state=load();
function save(message){
  state.kind=state.kind==='demo'?'custom':state.kind;
  assertValidState(state);
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));storageOK=true;}
  catch(err){storageOK=false;notice('No se pudo guardar. Exportá un respaldo; el navegador bloqueó el almacenamiento.',true)}
  render();
  if(message)notice(message);
}
function notice(message,error=false){const el=$('toast');el.textContent=message;el.className='toast show'+(error?' error':'');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>el.className='toast',4300)}
function overview(){
 const ts=today(), x=executiveSummary(state,ts);
 const untreated=state.risks.filter(r=>r.status==='abierto'&&riskSignal(r,state.actions,ts).level==='critical')
   .sort((a,b)=>severity(b).score-severity(a).score).slice(0,4);
 const due=state.actions.filter(a=>a.status!=='completada')
   .sort((a,b)=>a.dueDate.localeCompare(b.dueDate)).slice(0,4);
 const dimension=[
  ['Riesgos',worstSignal(state.risks.filter(r=>r.status==='abierto').map(r=>riskSignal(r,state.actions,ts))),x.activeRisks+' abiertos','risks'],
  ['Capacity',worstSignal([...state.capacities.map(infrastructureSignal),...state.teamCapacities.map(workforceSignal)]),x.capacityAlerts+x.teamAlerts+' alertas','capacity'],
  ['Continuidad',worstSignal(state.services.filter(s=>Number(s.criticality)===1).map(s=>serviceSignal(s,ts))),x.criticalServices+' servicios críticos','continuity'],
  ['Ejecución',worstSignal(state.actions.filter(a=>a.status!=='completada').map(a=>actionSignal(a,ts))),x.overdue+' vencidas','actions'],
  ['Assessments',worstSignal(state.assessments.map(assessmentSignal)),x.lowAssessments+' brechas','assessments']
 ];
 const financeSignal=x.pendingDecisions?{level:'warning',label:'Atención',reason:'Existen decisiones abiertas para comité.'}:{level:state.decisions.length?'ok':'unknown',label:state.decisions.length?'En control':'Sin evaluar',reason:'Sin decisiones pendientes registradas.'};
 const riskCritical=x.criticalUnmanaged?{level:'critical',label:'Crítico',reason:'Hay riesgos críticos sin tratamiento'}:{level:x.unmanaged?'warning':x.activeRisks?'ok':'unknown',label:x.unmanaged?'Atención':x.activeRisks?'En control':'Sin evaluar',reason:'Cobertura de tratamiento registrada'};
 const overdueSignal=x.overdue?{level:'critical',label:'Crítico',reason:'Existen acciones vencidas'}:{level:state.actions.length?'ok':'unknown',label:state.actions.length?'En control':'Sin evaluar',reason:'No se registran acciones vencidas'};
 const continuitySignal=x.unverified?{level:'warning',label:'Atención',reason:'Continuidad de servicios críticos no validada'}:{level:x.criticalServices?'ok':'unknown',label:x.criticalServices?'En control':'Sin evaluar',reason:'Estado de pruebas de continuidad'};
 const capacitySignal=x.capacityAlerts+x.teamAlerts?{level:'critical',label:'Crítico',reason:'Capacidad o equipos exceden umbrales'}:{level:state.capacities.length+state.teamCapacities.length?'ok':'unknown',label:state.capacities.length+state.teamCapacities.length?'En control':'Sin evaluar',reason:'Controles de capacidad registrados'};
 const availSignal=x.slaBreaches?{level:'critical',label:'Crítico',reason:'Incumplimiento observado de SLA'}:{level:x.averageAvailability!==null?'ok':'unknown',label:x.averageAvailability!==null?'En control':'Sin evaluar',reason:'Disponibilidad calculada a partir de registros'};
 const verticalRows=state.verticals.map(v=>{
   const signal=verticalSignal(state,v.id,ts);
   const count=state.risks.filter(r=>r.verticalId===v.id&&r.status==='abierto').length;
   const cap=worstSignal([...state.capacities.filter(c=>c.verticalId===v.id).map(infrastructureSignal),...state.teamCapacities.filter(c=>c.verticalId===v.id).map(workforceSignal)]);
   const cont=worstSignal(state.services.filter(s=>s.verticalId===v.id).map(serv=>serviceSignal(serv,ts)));
   const due=state.actions.filter(a=>a.status!=='completada'&&state.risks.some(r=>r.verticalId===v.id&&r.id===a.riskId));
   const acts=worstSignal(due.map(a=>actionSignal(a,ts)));
   return '<tr><td><div class="executive-table-title">'+esc(v.name)+'</div><div class="executive-table-meta">'+esc(v.owner)+'</div></td><td>'+semaphore(signal)+'</td><td><span class="mono-n">'+count+'</span> abiertos</td><td>'+semaphore(cap)+'</td><td>'+semaphore(cont)+'</td><td>'+semaphore(acts)+'</td></tr>';
 }).join('');
 return `<section class="executive-summary signal-border-${x.status.level}" aria-label="Síntesis ejecutiva">
  <div class="executive-summary-upper">
    <div><span class="executive-overline">EXECUTIVE SITUATION REPORT / ${esc(ts)}</span>
      <h2>Estado de la operación <span class="executive-status-mark">${semaphore(x.status)}</span></h2>
      <p class="executive-summary-text">${esc(x.sentence)}</p>
      <div class="summary-footnotes"><span>Indicadores derivados de ${state.verticals.length} verticales y ${state.services.length} servicios</span><span>Datos del navegador · No es telemetría en vivo</span></div>
    </div>
    <div class="summary-aside"><div class="summary-aside-header">FRENTE DE DECISIONES</div><div class="summary-aside-value">${x.pendingDecisions}</div><span>Temas pendientes de comité</span><div class="summary-aside-bottom">${semaphore(financeSignal)} ${mini('Ver comité ↗','view:committee','','secondary')}</div></div>
  </div>
 </section>
 <div class="section-eyeline">01 / PANEL DE CONTROL · EXCEPCIONES PRIORITARIAS</div>
 <div class="executive-dashboard">
  <div class="executive-kpis">
   ${indicator('RIESGOS CRÍTICOS SIN PLAN',x.criticalUnmanaged,'Exposición ≥15/25 sin acción asignada',riskCritical)}
   ${indicator('ACCIONES VENCIDAS',x.overdue,'Compromisos sin evidencia de cierre',overdueSignal)}
   ${indicator('CONTINUIDAD NO VALIDADA',x.unverified,'Servicios Tier 1 sin prueba DR aprobada',continuitySignal)}
   ${indicator('ALERTAS DE CAPACIDAD',x.capacityAlerts+x.teamAlerts,'Recursos y equipos fuera de umbral',capacitySignal)}
  </div>
  <section class="executive-panel readiness-panel"><div class="executive-panel-head"><div><span class="executive-overline">DOMINIOS DE CONTROL</span><h3>Lectura gerencial</h3></div></div>
    ${dimension.map(d=>signalLine(...d)).join('')}
  </section>
 </div>
 <div class="executive-microline">
  <div><span class="micro-label">DISPONIBILIDAD MEDIA OBSERVADA</span><strong>${x.averageAvailability===null?'S/D':fmtPct(x.averageAvailability)}</strong>${semaphore(availSignal)}<small>Promedio simple entre servicios con datos · no ponderado</small></div>
  <div><span class="micro-label">DR APROBADO VIGENTE</span><strong>${x.criticalServices?x.provenDR+'/'+x.criticalServices:'S/D'}</strong>${semaphore(continuitySignal)}<small>Tier 1 · criterio ilustrativo: prueba ≤180 días</small></div>
  <div><span class="micro-label">TRATAMIENTO DE RIESGOS</span><strong>${x.riskTreatmentPct===null?'S/D':fmtPct(x.riskTreatmentPct)}</strong>${semaphore(riskCritical)}<small>Abiertos con al menos una acción</small></div>
 </div>
 <div class="section-eyeline">02 / HEALTH CHECK · VERTICALES TECNOLÓGICAS</div>
 <section class="executive-panel"><div class="executive-panel-head"><div><span class="executive-overline">TECHNOLOGY GOVERNANCE MATRIX</span><h3>Semáforo por vertical</h3><p>Estado consolidado según la peor señal registrada; gris indica información ausente.</p></div>${mini('Abrir verticales ↗','view:verticals','','secondary')}</div>
  ${verticalRows?'<div class="table-wrap"><table class="data-table executive-data-table"><thead><tr><th>VERTICAL / RESPONSABLE</th><th>ESTADO</th><th>RIESGOS</th><th>CAPACITY</th><th>CONTINUIDAD</th><th>ACCIONES</th></tr></thead><tbody>'+verticalRows+'</tbody></table></div>':empty('Sin verticales registradas','Agregá una vertical para habilitar el semáforo consolidado.')}
 </section>
 <div class="section-eyeline">03 / RISK INTELLIGENCE · PRIORIZACIÓN</div>
 <div class="layout-two executive-lower">
  <section class="executive-panel"><div class="executive-panel-head"><div><span class="executive-overline">RISK EXPOSURE / 5 × 5</span><h3>Matriz de riesgos</h3><p>Riesgos abiertos por probabilidad e impacto. Los tonos son niveles de exposición, no estados de tratamiento.</p></div>${mini('Registro de riesgos ↗','view:risks','','secondary')}</div>
   ${heatmap(state.risks)}<div class="heatmap-legend"><span><i class="legend-spot heatmap-ok"></i> Bajo / medio</span><span><i class="legend-spot heatmap-warning"></i> Alto</span><span><i class="legend-spot heatmap-critical"></i> Crítico</span></div>
  </section>
  <section class="executive-panel"><div class="executive-panel-head"><div><span class="executive-overline">FOLLOW-UP / GOVERNANCE</span><h3>Acciones y riesgos prioritarios</h3><p>Excepciones que requieren responsable, plan o decisión.</p></div></div>
   <div class="executive-priority-list">
    ${untreated.length?untreated.map(r=>'<div class="priority-record">'+semaphore(riskSignal(r,state.actions,ts))+'<div><strong>'+esc(r.title)+'</strong><small>'+esc(r.owner)+' · exposición '+severity(r).score+'/25</small></div>'+mini('Crear plan ↗','action',r.id)+'</div>').join(''):empty('Sin riesgos críticos pendientes','No hay riesgos críticos sin tratamiento registrados.')}
    ${due.filter(a=>actionSignal(a,ts).level==='critical').map(a=>'<div class="priority-record">'+semaphore(actionSignal(a,ts))+'<div><strong>'+esc(a.title)+'</strong><small>'+esc(a.owner)+' · vence '+esc(a.dueDate)+'</small></div>'+mini('Ver acciones ↗','view:actions','','secondary')+'</div>').join('')}
   </div>
  </section>
 </div>
 <div class="section-eyeline">04 / TRAZABILIDAD DE GESTIÓN</div>
 <section class="executive-panel"><div class="executive-panel-head"><div><h3>De la brecha al cierre verificable</h3><p>Un riesgo no se considera mitigado únicamente por haber completado la acción.</p></div></div>
  <div class="process-flow"><div class="process-step"><strong>01 / EVALUAR</strong><p>Assessment o capacidad registrada.</p></div><div class="process-step"><strong>02 / IDENTIFICAR</strong><p>Riesgo y criticidad calculados.</p></div><div class="process-step"><strong>03 / EJECUTAR</strong><p>Plan, responsable, plazo y evidencia.</p></div><div class="process-step"><strong>04 / VALIDAR</strong><p>Verificación independiente del cierre.</p></div></div>
 </section>
 `;
}

function verticalsView(){
 const cards=state.verticals.map(v=>{
   const assessments=state.assessments.filter(a=>a.verticalId===v.id);
   const mean=assessments.length?assessments.reduce((a,b)=>a+Number(b.score),0)/assessments.length:null;
   const risks=state.risks.filter(r=>r.verticalId===v.id&&r.status==='abierto');
   const without=risks.filter(r=>riskTreatment(r,state.actions)==='Sin plan');
   const capacities=state.capacities.filter(c=>c.verticalId===v.id&&capacityStatus(c).warning);
   const teams=state.teamCapacities.filter(c=>c.verticalId===v.id&&teamStatus(c).warning);
   return `<article class="vertical-card"><div class="vertical-head"><div><h3>${esc(v.name)}</h3><p>${esc(v.description)}<br>Responsable: ${esc(v.owner)}</p></div>${tag(without.length?'Prioridad de gestión':'En control',without.length?'amber':'neutral')}</div>
   <div class="vertical-stats"><div class="vertical-stat"><span>MADUREZ / 5</span><strong>${mean===null?'—':nfmt(mean)}</strong></div><div class="vertical-stat"><span>RIESGOS SIN PLAN</span><strong>${without.length}</strong></div><div class="vertical-stat"><span>CAPACITY ALERTAS</span><strong>${capacities.length+teams.length}</strong></div></div>
   </article>`;
 }).join('');
 return `<section class="panel"><div class="panel-head"><div><h2>Verticales tecnológicas</h2><p>Dominio, accountability, madurez y exposición agregada.</p></div>${mini('Agregar vertical','vertical')}</div><div class="vertical-grid">${cards||empty('No hay verticales','Agregá una unidad de gestión para empezar.')}</div></section>`;
}
function capacityView(){
 const rows=state.capacities.map(c=>{
 const x=capacityStatus(c);
 return `<tr><td><span class="cell-title">${esc(c.name)}</span><span class="cell-meta">${esc(getVertical(c.verticalId)?.name||'')} · ${esc(c.owner)}</span></td><td class="number">${nfmt(c.used)} / ${nfmt(c.total)} ${esc(c.unit)}</td>
 <td><div class="priority ${x.warning?'warn':''}"><i class="dot"></i><span class="number">${fmtPct(x.utilization)}</span></div><div class="progress ${x.warning?'alert':''}"><span style="width:${Math.min(x.utilization||0,100)}%"></span></div><span class="cell-meta">Umbral: ${nfmt(x.limit)} %</span></td><td class="${x.futureWarning?'text-warn':'text-good'}">${fmtPct(x.forecast)}<span class="cell-meta">Crecimiento: ${nfmt(c.growthPct)}% mensual</span></td><td>${tag(x.warning?'Supera umbral':x.futureWarning?'Alerta proyectada':'Dentro del umbral',x.warning?'red':x.futureWarning?'amber':'neutral')}</td></tr>`;
 }).join('');
 return `<section class="panel"><div class="panel-head"><div><h2>Capacidad y previsión</h2><p>Utilización por recurso y proyección compuesta de tres meses (supuesto de crecimiento constante).</p></div>${mini('+ Nueva medición','capacity')}</div>
 ${rows?'<div class="table-wrap"><table class="data-table"><thead><tr><th>RECURSO / VERTICAL</th><th>USO Y TOTAL</th><th>UTILIZACIÓN</th><th>PROYECCIÓN 3 MESES</th><th>ESTADO</th></tr></thead><tbody>'+rows+'</tbody></table></div>':empty('Sin mediciones','Agregá una capacidad para registrar uso, límite y crecimiento.')}
 <div class="modal-note">Automatización real: al registrar una medición sobre el umbral, ATLAS crea un riesgo vinculado con estado «Sin plan». La proyección no es telemetría: se calcula exclusivamente con los valores ingresados.</div></section>
 <section class="panel"><div class="panel-head"><div><h2>Capacidad de los equipos y cobertura</h2><p>FTE disponibles, FTE asignados, capacidad de guardias y brechas de habilidades por equipo; no evalúa personas individuales.</p></div>${mini('+ Registrar capacidad de equipo','team')}</div>
 ${state.teamCapacities.length?'<div class="table-wrap"><table class="data-table"><thead><tr><th>EQUIPO / VERTICAL</th><th>ASIGNACIÓN / DISPONIBILIDAD</th><th>CARGA DE TRABAJO</th><th>COBERTURA</th><th>BRECHAS / SITUACIÓN</th></tr></thead><tbody>'+
 state.teamCapacities.map(t=>{const z=teamStatus(t);return `<tr><td><span class="cell-title">${esc(t.name)}</span><span class="cell-meta">${esc(getVertical(t.verticalId)?.name||'')} · ${esc(t.owner)}</span></td><td>${nfmt(t.allocatedFte)} / ${nfmt(t.availableFte)} FTE</td><td>${fmtPct(z.utilization)}<span class="cell-meta">Umbral de carga: ${nfmt(z.threshold)}%</span></td><td>${fmtPct(z.coverage)}</td><td>${tag(z.warning?'Requiere atención':'Dentro del umbral',z.warning?'amber':'neutral')}<span class="cell-meta">${esc(t.skillsGap||'Sin brechas informadas')}</span></td></tr>`;}).join('')+'</tbody></table></div>':empty('Sin registros de equipos','Registrá disponibilidad, asignación y cobertura de los equipos por vertical.')}
 <div class="modal-note">Si la carga alcanza el umbral, o la cobertura de guardias cae por debajo del 90%, se genera automáticamente un riesgo asociado al equipo. Los FTE son capacidad del área, no indicadores de desempeño individual.</div></section>`;
}
function assessmentsView(){
 const rows=state.assessments.map(a=>{
 const risk=state.risks.find(r=>r.assessmentId===a.id);
 return `<tr><td><span class="cell-title">${esc(a.domain)}</span><span class="cell-meta">${esc(getVertical(a.verticalId)?.name||'')}</span></td><td>${tag(a.score+'/5',Number(a.score)<=2?'red':Number(a.score)===3?'amber':'neutral')}</td>
 <td><span class="cell-title">${esc(a.finding)}</span><span class="cell-meta">Evidencia: ${esc(short(a.evidence)||'No indicada')}</span></td><td>${esc(a.owner)}<span class="cell-meta">${esc(a.date)}</span></td><td>${risk?tag('Riesgo vinculado',risk.status==='abierto'?'amber':'neutral'):Number(a.score)<=2?tag('Sin vinculación','red'):tag('Sin brecha crítica','neutral')}</td></tr>`;
 }).join('');
 return `<section class="panel"><div class="panel-head"><div><h2>Assessments por dominio</h2><p>Calificación de madurez (1 a 5) con hallazgo, responsable y evidencia.</p></div>${mini('+ Nuevo assessment','assessment')}</div>
 ${rows?'<div class="table-wrap"><table class="data-table"><thead><tr><th>DOMINIO / VERTICAL</th><th>MADUREZ</th><th>HALLAZGO / EVIDENCIA</th><th>RESPONSABLE / FECHA</th><th>TRAZABILIDAD</th></tr></thead><tbody>'+rows+'</tbody></table></div>':empty('Sin evaluaciones','Registrá un assessment para comenzar a medir la madurez.')}
 <div class="modal-note">Regla automática demostrable: una puntuación de madurez de 1 o 2 crea un riesgo vinculado. Una evaluación de 3 a 5 queda registrada sin crear riesgos artificiales.</div></section>`;
}
function risksView(){
 const rows=state.risks.map(r=>{
 const sev=severity(r),treat=riskTreatment(r,state.actions),actions=state.actions.filter(a=>a.riskId===r.id);
 const canValidate=r.status==='abierto'&&actions.length>0&&actions.every(a=>a.status==='completada');
 return `<tr><td><span class="cell-title">${esc(r.title)}</span><span class="cell-meta">${esc(short(r.description))}</span></td><td>${esc(getVertical(r.verticalId)?.name||'')}<span class="cell-meta">${esc(r.owner)}</span></td>
 <td>${tag(sev.label+' '+sev.score+'/25',sev.score>=15?'red':sev.score>=9?'amber':'neutral')}</td><td>${tag(treat,treat==='Sin plan'?'red':treat==='Con plan'?'amber':'neutral')}<span class="cell-meta">${actions.length} acción(es) asociadas</span></td>
 <td><div class="item-actions">${r.status==='abierto'?mini('Crear plan','action',r.id):''}${canValidate?mini('Validar mitigación','validate',r.id,'secondary'):''}</div></td></tr>`;
 }).join('');
 const s=dashboard(state,today());
 return `<div class="grid-kpis">
 <article class="kpi"><div class="kpi-label">RIESGOS ABIERTOS</div><div class="kpi-value">${s.activeRisks}</div><div class="kpi-hint">Pendientes de evaluación y tratamiento</div></article>
 <article class="kpi danger"><div class="kpi-label">RIESGOS SIN PLAN</div><div class="kpi-value">${s.unmanaged}</div><div class="kpi-hint">Requieren una acción asignada</div></article>
 <article class="kpi warn"><div class="kpi-label">CRÍTICOS SIN PLAN</div><div class="kpi-value">${s.criticalUnmanaged}</div><div class="kpi-hint">Prioridad elevada</div></article>
 <article class="kpi"><div class="kpi-label">COBERTURA DE TRATAMIENTO</div><div class="kpi-value">${s.riskTreatmentPct===null?'—':num(s.riskTreatmentPct)+'%'}</div><div class="kpi-hint">Riesgos abiertos con al menos una acción</div></article></div>
 <section class="panel"><div class="panel-head"><div><h2>Mapa de exposición</h2><p>Probabilidad × impacto, tratamientos y acciones asociadas.</p></div>${mini('+ Registrar riesgo','risk')}</div>
 ${rows?'<div class="table-wrap"><table class="data-table"><thead><tr><th>RIESGO</th><th>VERTICAL / RESPONSABLE</th><th>EXPOSICIÓN</th><th>TRATAMIENTO</th><th>OPERAR</th></tr></thead><tbody>'+rows+'</tbody></table></div>':empty('Sin riesgos','Registrá un riesgo o generá uno automáticamente desde una evaluación.')}
 </section>`;
}
function actionsView(){
 const rows=state.actions.map(a=>{
 const risk=getRisk(a.riskId);
 return `<tr><td><span class="cell-title">${esc(a.title)}</span><span class="cell-meta">Riesgo: ${esc(risk?.title||'Sin relación')}</span></td><td>${esc(a.owner)}</td><td>${esc(a.dueDate)}${actionOverdue(a,today())?'<span class="cell-meta text-danger">VENCIDA</span>':''}</td>
 <td>${tag(a.status==='completada'?'Completada':a.status==='en-curso'?'En curso':a.status==='bloqueada'?'Bloqueada':'Pendiente',a.status==='completada'?'neutral':actionOverdue(a,today())?'red':'amber')}</td>
 <td><div class="item-actions">${a.status!=='completada'?mini('Completar + evidencia','complete',a.id):tag('Evidencia registrada','neutral')}</div></td></tr>`;
 }).join('');
 return `<section class="panel"><div class="panel-head"><div><h2>Planes y compromisos</h2><p>Una acción se considera completada solo cuando se registra evidencia.</p></div>${mini('+ Crear plan','action')}</div>
 ${rows?'<div class="table-wrap"><table class="data-table"><thead><tr><th>ACCIÓN / RIESGO</th><th>RESPONSABLE</th><th>VENCIMIENTO</th><th>ESTADO</th><th>SEGUIMIENTO</th></tr></thead><tbody>'+rows+'</tbody></table></div>':empty('Sin planes','Primero registrá un riesgo abierto y asignale una acción correctiva.')}
 <div class="modal-note">Completar una acción no elimina automáticamente el riesgo: la mitigación requiere una validación independiente con evidencia y todas las acciones cerradas.</div></section>`;
}
function continuityView(){
 const rows=state.services.map(s=>{
  const a=availability(s),pass=a!==null&&a>=Number(s.targetPct),c=continuity(s);
  return `<tr><td><span class="cell-title">${esc(s.name)}</span><span class="cell-meta">${esc(getVertical(s.verticalId)?.name||'')} · Criticidad ${esc(s.criticality)}</span></td>
  <td><span class="number ${pass?'text-good':'text-danger'}">${fmtPct(a)}</span><span class="cell-meta">Objetivo SLA: ${nfmt(s.targetPct)}%</span><span class="cell-meta">Período: ${nfmt(s.periodMinutes)} min</span></td>
  <td>${nfmt(s.downtimeMinutes)} min<span class="cell-meta">Registrados en el período</span></td><td>RTO ${nfmt(s.rtoMin)} / RPO ${nfmt(s.rpoMin)} min</td>
  <td>${tag(c.label,c.ok?'neutral':'amber')}<span class="cell-meta">Última prueba: ${esc(s.lastDRTest||'Sin registro')}</span></td><td>${mini('Actualizar','service',s.id)}</td></tr>`;
 }).join('');
 return `<section class="panel"><div class="panel-head"><div><h2>Disponibilidad registrada y preparación de DR</h2><p>Disponibilidad calculada por servicio (minutos del período vs. minutos de caída) y resultado de pruebas.</p></div>${mini('+ Agregar servicio','service')}</div>
 ${rows?'<div class="table-wrap"><table class="data-table"><thead><tr><th>SERVICIO</th><th>DISPONIBILIDAD / SLA</th><th>INDISPONIBILIDAD</th><th>OBJETIVOS</th><th>CONTINUIDAD</th><th>OPERAR</th></tr></thead><tbody>'+rows+'</tbody></table></div>':empty('Sin servicios','Registrá servicios y mediciones para calcular disponibilidad.')}
 <div class="modal-note">Los datos de demostración son ficticios. Disponibilidad = (minutos del período − minutos de caída) / minutos del período. La aprobación DR se registra por separado: una buena disponibilidad no equivale a continuidad probada.</div></section>`;
}
function committeeView(){
 const rows=state.decisions.map(d=>{
 const risk=getRisk(d.riskId);
 return `<tr><td><span class="cell-title">${esc(d.title)}</span><span class="cell-meta">${risk?'Riesgo: '+esc(risk.title):'Decisión general'}</span></td><td>${esc(d.owner)}</td><td>${esc(d.dueDate)}</td>
 <td>${tag(d.status==='resuelta'?'Resuelta':'Pendiente',d.status==='resuelta'?'neutral':'amber')}</td><td>${d.status==='pendiente'?mini('Registrar resolución','decision-close',d.id):tag('Con evidencia','neutral')}</td></tr>`;
 }).join('');
 return `<section class="panel"><div class="panel-head"><div><h2>Decisiones del Comité de Tecnología</h2><p>Compromisos ejecutivos con responsable, plazo, riesgo asociado y evidencia de resolución.</p></div>${mini('+ Nueva decisión','decision')}</div>
 ${rows?'<div class="table-wrap"><table class="data-table"><thead><tr><th>DECISIÓN</th><th>RESPONSABLE</th><th>FECHA OBJETIVO</th><th>ESTADO</th><th>SEGUIMIENTO</th></tr></thead><tbody>'+rows+'</tbody></table></div>':empty('Sin decisiones','Registrá un compromiso para llevar seguimiento de comité.')}
 </section>`;
}
function render(){
 const meta=viewMeta[view]||viewMeta.overview;
 $('view-title').textContent=meta[0];$('view-subtitle').textContent=meta[1];
 $('breadcrumb-current').textContent=meta[0].toUpperCase();
 $('environment-label').textContent=state.kind==='demo'?'DATOS FICTICIOS DE DEMOSTRACIÓN':state.kind==='local'?'ESPACIO LOCAL SIN DATOS DE DEMOSTRACIÓN':'DATOS LOCALES EDITADOS · PUEDE CONTENER EJEMPLOS FICTICIOS';
 const pages={overview,verticals:verticalsView,capacity:capacityView,assessments:assessmentsView,risks:risksView,actions:actionsView,continuity:continuityView,committee:committeeView};
 $('view-root').innerHTML=(pages[view]||overview)();
 for(const node of document.querySelectorAll('[data-view]'))node.classList.toggle('selected',node.dataset.view===view);
}

const input=(name,label,type='text',value='',options={})=>`<div class="field ${options.wide?'wide':''}"><label for="field-${esc(name)}">${esc(label)}</label><input id="field-${esc(name)}" name="${esc(name)}" type="${esc(type)}" value="${esc(value)}" ${options.required?'required':''} ${options.min!==undefined?'min="'+esc(options.min)+'"':''} ${options.max!==undefined?'max="'+esc(options.max)+'"':''} ${options.step?'step="'+esc(options.step)+'"':''} maxlength="180"></div>`;
const select=(name,label,values,value='',wide=false)=>`<div class="field ${wide?'wide':''}"><label for="field-${esc(name)}">${esc(label)}</label><select id="field-${esc(name)}" name="${esc(name)}" required>${values.map(x=>`<option value="${esc(x[0])}" ${x[0]===value?'selected':''}>${esc(x[1])}</option>`).join('')}</select></div>`;
const textarea=(name,label,value='',required=true)=>`<div class="field wide"><label for="field-${esc(name)}">${esc(label)}</label><textarea id="field-${esc(name)}" name="${esc(name)}" maxlength="1500" ${required?'required':''}>${esc(value)}</textarea></div>`;
const vertOptions=()=>state.verticals.map(v=>[v.id,v.name]);
const riskOptions=()=>state.risks.filter(r=>r.status==='abierto').map(r=>[r.id,r.title]);
const serviceOptions=()=>[['','Sin asociar'],...state.services.map(s=>[s.id,s.name])];
const drOptions=[['sin-evaluar','Sin evaluar'],['aprobado','Prueba aprobada'],['parcial','Prueba parcial'],['fallido','Prueba fallida']];

function openForm(type,id=''){
 if(type.startsWith('view:')){switchView(type.slice(5));return;}
 const v=vertOptions(),r=riskOptions();let title,description='',fields='',submit='Guardar registro';
 if(type==='vertical'){title='Nueva vertical';fields=input('name','Nombre de la vertical','text','',{required:true,wide:true})+input('owner','Responsable','text','',{required:true})+textarea('description','Alcance y responsabilidades');}
 else if(type==='assessment'){title='Registrar assessment';description='Madurez 1–2 genera un riesgo vinculado automáticamente.';fields=select('verticalId','Vertical',v)+select('domain','Dimensión',DOMAINS.map(x=>[x,x]))+select('score','Madurez',[[1,'1 — Crítica'],[2,'2 — Inicial'],[3,'3 — Definida'],[4,'4 — Gestionada'],[5,'5 — Optimizada']])+input('owner','Responsable','text','',{required:true})+textarea('finding','Hallazgo o brecha')+textarea('evidence','Referencia de evidencia (opcional)','',false);}
 else if(type==='capacity'){title='Registrar medición de capacidad';description='El uso igual o superior al umbral registra un riesgo sin plan automáticamente.';fields=select('verticalId','Vertical',v)+input('name','Recurso o servicio','text','',{required:true})+input('used','Utilizado','number','',{required:true,min:0,step:'any'})+input('total','Capacidad total','number','',{required:true,min:0.001,step:'any'})+input('unit','Unidad (TB, vCPU, Gbps...)','text','TB',{required:true})+input('thresholdPct','Umbral de alerta (%)','number','80',{required:true,min:1,max:100,step:'any'})+input('growthPct','Crecimiento mensual estimado (%)','number','3',{required:true,min:0,max:100,step:'any'})+input('owner','Responsable','text','',{required:true});}
 else if(type==='team'){title='Capacidad de un equipo';description='La carga sobre el umbral o cobertura inferior al 90% genera un riesgo vinculado.';fields=select('verticalId','Vertical',v)+input('name','Equipo o función','text','',{required:true})+input('availableFte','Capacidad disponible (FTE)','number','',{required:true,min:0.1,step:'any'})+input('allocatedFte','Carga asignada (FTE)','number','',{required:true,min:0,step:'any'})+input('coveragePct','Cobertura operativa / guardias (%)','number','100',{required:true,min:0,max:100,step:'any'})+input('thresholdPct','Umbral de carga (%)','number','90',{required:true,min:1,max:100,step:'any'})+input('owner','Responsable del equipo','text','',{required:true})+textarea('skillsGap','Brechas de capacidades o reemplazos', '', false);}
 else if(type==='risk'){title='Registrar riesgo';fields=input('title','Nombre del riesgo','text','',{required:true,wide:true})+select('verticalId','Vertical',v)+select('serviceId','Servicio afectado (opcional)',serviceOptions())+input('owner','Responsable del riesgo','text','',{required:true})+select('probability','Probabilidad',[[1,'1 — Rara'],[2,'2 — Poco probable'],[3,'3 — Posible'],[4,'4 — Probable'],[5,'5 — Muy probable']])+select('impact','Impacto',[[1,'1 — Menor'],[2,'2 — Bajo'],[3,'3 — Medio'],[4,'4 — Alto'],[5,'5 — Crítico']])+textarea('description','Descripción y consecuencias');}
 else if(type==='action'){title='Nuevo plan correctivo';description='Las acciones deben vincularse con un riesgo abierto.';fields=select('riskId','Riesgo a tratar',r,id)+input('title','Acción comprometida','text','',{required:true,wide:true})+input('owner','Responsable de ejecución','text','',{required:true})+input('dueDate','Fecha comprometida','date',today(),{required:true})+textarea('description','Criterio de cumplimiento / notas','',false);}
 else if(type==='complete'){const a=state.actions.find(x=>x.id===id);if(!a)return notice('Acción inexistente.',true);title='Completar acción';description='La evidencia es obligatoria y el cierre queda trazado.';fields='<div class="modal-note">'+esc(a.title)+'</div>'+textarea('evidence','Evidencia de ejecución');submit='Registrar cierre';}
 else if(type==='validate'){const risk=getRisk(id);if(!risk)return notice('Riesgo inexistente.',true);title='Validar mitigación';description='El riesgo solo se cierra con todas las acciones completas y evidencia de validación.';fields='<div class="modal-note">'+esc(risk.title)+'</div>'+textarea('evidence','Evidencia de validación de mitigación');submit='Validar riesgo';}
 else if(type==='service'){const s=getService(id);title=s?'Actualizar servicio':'Registrar servicio';description='Disponibilidad calculada con minutos observados. DRP evaluado por separado.';fields=input('name','Servicio','text',s?.name||'',{required:true})+select('verticalId','Vertical',v,s?.verticalId||'')+input('owner','Responsable','text',s?.owner||'',{required:true})+select('criticality','Criticidad',[[1,'1 — Crítico'],[2,'2 — Importante'],[3,'3 — Estándar']],s?.criticality||1)+input('periodMinutes','Minutos del período','number',s?.periodMinutes??43200,{required:true,min:1,step:'1'})+input('downtimeMinutes','Minutos de caída','number',s?.downtimeMinutes??0,{required:true,min:0,step:'1'})+input('targetPct','Objetivo SLA (%)','number',s?.targetPct??99.9,{required:true,min:0,max:100,step:'any'})+input('rtoMin','RTO objetivo (min)','number',s?.rtoMin??60,{required:true,min:0,step:'any'})+input('rpoMin','RPO objetivo (min)','number',s?.rpoMin??15,{required:true,min:0,step:'any'})+select('drResult','Resultado del último ejercicio DR',drOptions,s?.drResult||'sin-evaluar')+input('lastDRTest','Fecha de prueba DR','date',s?.lastDRTest||'')+textarea('drEvidence','Evidencia del ejercicio',s?.drEvidence||'',false);}
 else if(type==='decision'){title='Nueva decisión de comité';fields=input('title','Decisión o compromiso','text','',{required:true,wide:true})+select('riskId','Riesgo vinculado (opcional)',[['','Sin relación'],...state.risks.map(r=>[r.id,r.title])])+input('owner','Responsable','text','',{required:true})+input('dueDate','Fecha objetivo','date',today(),{required:true});}
 else if(type==='decision-close'){const d=state.decisions.find(x=>x.id===id);if(!d)return notice('Decisión inexistente.',true);title='Resolver decisión de comité';fields='<div class="modal-note">'+esc(d.title)+'</div>'+textarea('evidence','Acta o evidencia de resolución');submit='Registrar resolución';}
 else return;
 modal={type,id};
 $('dialog-title').textContent=title;$('dialog-desc').textContent=description;
 $('form-fields').innerHTML=fields;$('dialog-submit').textContent=submit;
 $('record-dialog').showModal();
 const first=$('record-dialog').querySelector('input,select,textarea');first?.focus();
}
function closeForm(){if($('record-dialog').open)$('record-dialog').close();modal=null}
function textRequired(v,label){if(!v||!String(v).trim())throw new Error('Indicá '+label+'.');return String(v).trim()}
function submitRecord(data){
 const type=modal.type,id=modal.id,ts=today();
 const req=(k,label)=>textRequired(data[k],label);
 if(type==='vertical'){
  if(state.verticals.length>=100)throw new Error('Límite de verticales alcanzado.');
  state.verticals.push({id:idFactory('v'),name:req('name','nombre'),owner:req('owner','responsable'),description:data.description?.trim()||''});
  addEvent(state,'vertical','Se creó una nueva vertical',ts);
 }else if(type==='assessment')registerAssessment(state,{...data,owner:req('owner','responsable'),finding:req('finding','hallazgo')},ts,idFactory);
 else if(type==='capacity')registerCapacity(state,{...data,name:req('name','recurso'),unit:req('unit','unidad'),owner:req('owner','responsable')},ts,idFactory);
 else if(type==='team')registerTeamCapacity(state,{...data,name:req('name','equipo'),owner:req('owner','responsable')},ts,idFactory);
 else if(type==='risk'){
  severity({probability:Number(data.probability),impact:Number(data.impact)});
  state.risks.unshift({id:idFactory('r'),verticalId:data.verticalId,serviceId:data.serviceId||'',assessmentId:'',capacityId:'',
   title:req('title','riesgo'),description:req('description','descripción'),owner:req('owner','responsable'),
   probability:Number(data.probability),impact:Number(data.impact),status:'abierto',evidence:'',source:'manual',createdAt:ts});
  addEvent(state,'risk','Se registró un riesgo manualmente',ts);
 }else if(type==='action')registerAction(state,{...data,title:req('title','acción'),owner:req('owner','responsable')},ts,idFactory);
 else if(type==='complete')completeAction(state,id,req('evidence','evidencia'),ts);
 else if(type==='validate')validateRisk(state,id,req('evidence','evidencia'),ts);
 else if(type==='service'){
  const period=Number(data.periodMinutes),down=Number(data.downtimeMinutes),target=Number(data.targetPct);
  const rto=Number(data.rtoMin),rpo=Number(data.rpoMin);
  if(!Number.isInteger(period)||period<=0||!Number.isInteger(down)||down<0||down>period||!Number.isFinite(target)||target<0||target>100||rto<0||rpo<0||!Number.isFinite(rto)||!Number.isFinite(rpo))throw new Error('Revisá período, caída, SLA, RTO y RPO.');
  if(data.drResult==='aprobado'&&(!data.lastDRTest||!data.drEvidence?.trim()))throw new Error('La aprobación de un ejercicio DR necesita fecha y evidencia.');
  const values={name:req('name','servicio'),verticalId:data.verticalId,owner:req('owner','responsable'),criticality:Number(data.criticality),periodMinutes:period,downtimeMinutes:down,targetPct:target,rtoMin:rto,rpoMin:rpo,lastDRTest:data.lastDRTest||'',drResult:data.drResult,drEvidence:data.drEvidence?.trim()||''};
  if(id){const old=getService(id);if(!old)throw new Error('Servicio inexistente.');Object.assign(old,values);}
  else state.services.unshift({id:idFactory('s'),...values});
  addEvent(state,'continuity',id?'Se actualizó el servicio '+values.name:'Se registró el servicio '+values.name,ts);
 }else if(type==='decision'){
  if(!state.risks.some(r=>r.id===data.riskId)&&data.riskId)throw new Error('Riesgo asociado inválido.');
  state.decisions.unshift({id:idFactory('d'),riskId:data.riskId||'',title:req('title','decisión'),owner:req('owner','responsable'),dueDate:req('dueDate','fecha'),status:'pendiente',evidence:'',createdAt:ts});
  addEvent(state,'committee','Se registró una decisión del comité',ts);
 }else if(type==='decision-close'){
  const dec=state.decisions.find(d=>d.id===id);if(!dec||dec.status!=='pendiente')throw new Error('La decisión ya fue resuelta.');
  const evidence=req('evidence','evidencia');if(evidence.length<8)throw new Error('Indicá evidencia de resolución de al menos ocho caracteres.');
  dec.status='resuelta';dec.evidence=evidence;dec.closedAt=ts;
  addEvent(state,'committee','Decisión del comité resuelta: '+dec.title,ts);
 }
}
function switchView(v){if(!viewMeta[v])return;view=v;render();$('main').focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}
document.addEventListener('click',e=>{
 const nav=e.target.closest('[data-view]');if(nav){switchView(nav.dataset.view);return;}
 const item=e.target.closest('[data-open]');if(item){openForm(item.dataset.open,item.dataset.id||'');return;}
 const cmd=e.target.closest('[data-command]');if(!cmd)return;
 if(cmd.dataset.command==='export'){
  const content=JSON.stringify({...state,exportedAt:new Date().toISOString()},null,2);
  const objectUrl=URL.createObjectURL(new Blob([content],{type:'application/json'}));
  const a=document.createElement('a');a.href=objectUrl;a.download='atlas-governance-respaldo-'+today()+'.json';document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(objectUrl),1500);notice('Respaldo JSON descargado.');
 }
 if(cmd.dataset.command==='demo'&&confirm('¿Reemplazar los datos locales actuales por la demostración ficticia? Exportá un respaldo si querés conservarlos.')){
  state=createDemo();save('Demostración restaurada.');state.kind='demo';localStorage.setItem(STORAGE_KEY,JSON.stringify(state));render();
 }
 if(cmd.dataset.command==='empty'&&confirm('¿Vaciar todos los registros locales? Esta acción no se puede deshacer sin un respaldo exportado.')){
  state=makeEmpty();save('Espacio local vacío preparado.');switchView('verticals');
 }
});
$('record-form').addEventListener('submit',e=>{
 e.preventDefault();if(!modal)return;
 const data=Object.fromEntries(new FormData(e.currentTarget).entries());
 try{submitRecord(data);closeForm();save('Registro guardado y tablero actualizado.')}catch(err){notice(err.message||'No se pudo registrar.',true)}
});
$('dialog-x').addEventListener('click',closeForm);
$('dialog-cancel').addEventListener('click',closeForm);
$('record-dialog').addEventListener('close',()=>modal=null);
$('import-file').addEventListener('change',async e=>{
 const file=e.target.files?.[0];e.target.value='';if(!file)return;
 if(file.size>1024*1024)return notice('El archivo supera 1 MB.',true);
 try{
  const data=JSON.parse(await file.text());assertValidState(data);
  if(!confirm('¿Reemplazar todos los registros locales por este respaldo?'))return;
  state=data;state.kind='custom';save('Respaldo importado.');switchView('overview');
 }catch(err){notice('No se importó: '+(err.message||'JSON inválido'),true)}
});
window.addEventListener('storage',e=>{
 if(e.key!==STORAGE_KEY)return;
 try{state=e.newValue?assertValidState(JSON.parse(e.newValue)):createDemo();render();notice('Los registros fueron actualizados desde otra pestaña.')}catch{notice('No se pudo sincronizar esta pestaña.',true)}
});
render();
if(!storageOK)notice('El almacenamiento local no está disponible: los cambios no persistirán.',true);
