import {
  DOMAINS, makeEmpty, createDemo, assertValidState, dashboard, severity, riskTreatment,
  actionOverdue, capacityStatus, availability, continuity, registerAssessment,
  registerCapacity, registerAction, completeAction, validateRisk, addEvent
} from './lib/governance/core.js';

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
 const s=dashboard(state,today());
 const risky=state.risks.filter(r=>r.status==='abierto').sort((a,b)=>severity(b).score-severity(a).score);
 const alerts=risky.filter(r=>!state.actions.some(a=>a.riskId===r.id)).slice(0,5);
 const due=state.actions.filter(a=>a.status!=='completada').sort((a,b)=>a.dueDate.localeCompare(b.dueDate)).slice(0,5);
 const dr=state.services.filter(s=>Number(s.criticality)===1&&!continuity(s).ok);
 const cap=state.capacities.filter(c=>capacityStatus(c).warning);
 return `<div class="grid-kpis">
   <article class="kpi danger"><div class="kpi-label">RIESGOS CRÍTICOS SIN PLAN</div><div class="kpi-value">${s.criticalUnmanaged}</div><div class="kpi-hint">${s.unmanaged} riesgos abiertos sin tratamiento de ${s.activeRisks} activos</div></article>
   <article class="kpi warn"><div class="kpi-label">ACCIONES VENCIDAS</div><div class="kpi-value">${s.overdue}</div><div class="kpi-hint">Plazos superados, sin evidencia de cierre</div></article>
   <article class="kpi warn"><div class="kpi-label">SERVICIOS CRÍTICOS / DR NO VALIDADO</div><div class="kpi-value">${s.drGaps}</div><div class="kpi-hint">Prueba parcial, fallida o no evaluada</div></article>
   <article class="kpi"><div class="kpi-label">RECURSOS CON ALERTA DE CAPACIDAD</div><div class="kpi-value">${s.capacityAlerts}</div><div class="kpi-hint">Medición utilizada ≥ umbral definido</div></article>
 </div>
 <div class="section-eyeline">01 / SITUACIÓN OPERATIVA Y EXPOSICIÓN</div>
 <div class="layout-two">
  <section class="panel"><div class="panel-head"><div><h2>Riesgos que requieren decisión</h2><p>Priorizados por probabilidad × impacto; sin plan asociado.</p></div>${mini('Registrar riesgo','risk')}</div>
   ${alerts.length?'<ul class="list">'+alerts.map(r=>`<li><div class="item-line"><div><div class="item-title">${esc(r.title)}</div><div class="item-detail">${esc(getVertical(r.verticalId)?.name||'Sin vertical')} · Responsable: ${esc(r.owner)} · Riesgo ${severity(r).score}/25</div></div><div class="item-actions">${tag('Sin plan','red')}${mini('Crear plan','action',r.id)}</div></div></li>`).join('')+'</ul>':empty('Sin riesgos pendientes de plan','Los riesgos abiertos tienen un tratamiento registrado.')}
  </section>
  <section class="panel"><div class="panel-head"><div><h2>Compromisos próximos</h2><p>Acciones abiertas ordenadas por vencimiento.</p></div>${mini('Ver acciones','view:actions','','secondary')}</div>
   ${due.length?'<ul class="list">'+due.map(a=>`<li><div class="item-line"><div><div class="item-title">${esc(a.title)}</div><div class="item-detail">${esc(a.owner)} · Vence ${esc(a.dueDate)}</div></div>${actionOverdue(a,today())?tag('Vencida','red'):tag(a.status==='en-curso'?'En curso':'Pendiente','amber')}</div></li>`).join('')+'</ul>':empty('Sin acciones pendientes','Registrá planes asociados a riesgos para iniciar el seguimiento.')}
  </section>
 </div>
 <div class="section-eyeline">02 / GOBIERNO DE LA CONTINUIDAD</div>
 <div class="layout-two layout-equal">
  <section class="panel"><div class="panel-head"><div><h2>Continuidad sin evidencia suficiente</h2><p>Servicios de criticidad 1 sin ensayo DR aprobado.</p></div>${mini('Abrir continuidad','view:continuity','','secondary')}</div>
  ${dr.length?'<ul class="list">'+dr.map(s=>`<li><div class="item-line"><div><div class="item-title">${esc(s.name)}</div><div class="item-detail">RTO objetivo: ${esc(s.rtoMin)} min · RPO objetivo: ${esc(s.rpoMin)} min</div></div>${tag(continuity(s).label,'amber')}</div></li>`).join('')+'</ul>':empty('Continuidad registrada','No hay servicios críticos con pruebas pendientes según los registros.')}
  </section>
  <section class="panel"><div class="panel-head"><div><h2>Capacidad en umbral</h2><p>Mediciones que requieren evaluación de crecimiento.</p></div>${mini('Cargar capacidad','capacity')}</div>
  ${cap.length?'<ul class="list">'+cap.slice(0,6).map(c=>`<li><div class="item-line"><div><div class="item-title">${esc(c.name)}</div><div class="item-detail">${esc(getVertical(c.verticalId)?.name||'')} · Umbral ${nfmt(c.thresholdPct)}%</div></div>${tag(fmtPct(capacityStatus(c).utilization),'amber')}</div></li>`).join('')+'</ul>':empty('Sin alertas vigentes','Los recursos cargados permanecen bajo los umbrales definidos.')}
  </section>
 </div>
 <div class="section-eyeline">03 / RECORRIDO DE GESTIÓN</div>
 <section class="panel"><div class="process-flow"><div class="process-step"><strong>01 / EVALUAR</strong><p>Registrar un assessment o medición de capacidad.</p></div><div class="process-step"><strong>02 / DETECTAR</strong><p>El sistema crea un riesgo por brechas de madurez o capacidad.</p></div><div class="process-step"><strong>03 / ACTUAR</strong><p>Asignar un plan, responsable, fecha y evidencia.</p></div><div class="process-step"><strong>04 / VALIDAR</strong><p>Confirmar acciones y validar el cierre del riesgo.</p></div></div></section>
 <div class="section-eyeline">04 / ACTIVIDAD REGISTRADA</div>
 <section class="panel"><ul class="list">${state.events.length?state.events.slice(0,7).map(e=>`<li><div class="item-line"><div><div class="item-title">${esc(e.text)}</div><div class="item-detail">${esc(e.date)} · ${esc(e.type)}</div></div></div></li>`).join(''):'<li>Sin actividad todavía.</li>'}</ul></section>`;
}
function verticalsView(){
 const cards=state.verticals.map(v=>{
   const assessments=state.assessments.filter(a=>a.verticalId===v.id);
   const mean=assessments.length?assessments.reduce((a,b)=>a+Number(b.score),0)/assessments.length:null;
   const risks=state.risks.filter(r=>r.verticalId===v.id&&r.status==='abierto');
   const without=risks.filter(r=>riskTreatment(r,state.actions)==='Sin plan');
   const capacities=state.capacities.filter(c=>c.verticalId===v.id&&capacityStatus(c).warning);
   return `<article class="vertical-card"><div class="vertical-head"><div><h3>${esc(v.name)}</h3><p>${esc(v.description)}<br>Responsable: ${esc(v.owner)}</p></div>${tag(without.length?'Prioridad de gestión':'En control',without.length?'amber':'neutral')}</div>
   <div class="vertical-stats"><div class="vertical-stat"><span>MADUREZ / 5</span><strong>${mean===null?'—':nfmt(mean)}</strong></div><div class="vertical-stat"><span>RIESGOS SIN PLAN</span><strong>${without.length}</strong></div><div class="vertical-stat"><span>CAPACITY ALERTAS</span><strong>${capacities.length}</strong></div></div>
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
 <div class="modal-note">Automatización real: al registrar una medición sobre el umbral, ATLAS crea un riesgo vinculado con estado «Sin plan». La proyección no es telemetría: se calcula exclusivamente con los valores ingresados.</div></section>`;
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
