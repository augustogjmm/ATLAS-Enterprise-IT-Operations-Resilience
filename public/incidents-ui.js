import {incidentMetrics,incidentMonthly,incidentByService,resolutionMinutes,selectIncidents} from './lib/governance/incidents.js';
import {kpiResult} from './lib/governance/performance.js';

export function incidentsView(state,today,{esc,mini,semaphore,empty,nfmt,fmtPct},filters={}){
 const stats=incidentMetrics(state,today,filters),monthly=incidentMonthly(state,today,6,filters),services=incidentByService(state,filters);
 const filteredIncidents=selectIncidents(state,filters);
 const matchingScope=k=>(k.verticalId||'')===(filters.verticalId||'')&&!filters.serviceId;
 const filterOptions=(all,current)=>all.map(([value,label])=>'<option value="'+esc(value)+'"'+(value===current?' selected':'')+'>'+esc(label)+'</option>').join('');
 const verticalOptions=[['','Todas las verticales'],...state.verticals.map(v=>[v.id,v.name])];
 const serviceOptions=[['','Todos los servicios'],...state.services.filter(s=>!filters.verticalId||s.verticalId===filters.verticalId).map(x=>[x.id,x.name])];
 const scopeName=filters.serviceId?state.services.find(x=>x.id===filters.serviceId)?.name:(filters.verticalId?state.verticals.find(v=>v.id===filters.verticalId)?.name:'Consolidado corporativo');
 const filterBar='<section class="itsm-filter-bar"><div><span class="executive-overline">ALCANCE DEL ANÁLISIS</span><strong>'+esc(scopeName||'Consolidado')+'</strong><p>Los filtros afectan todas las mediciones y tendencias de esta vista; no modifican registros.</p></div><div class="itsm-filter-controls"><label>Vertical<select id="itsm-vertical-filter">'+filterOptions(verticalOptions,filters.verticalId||'')+'</select></label><label>Servicio<select id="itsm-service-filter">'+filterOptions(serviceOptions,filters.serviceId||'')+'</select></label></div></section>';
 const signal=(level,reason)=>semaphore({level,label:level==='critical'?'Crítico':level==='warning'?'Atención':level==='ok'?'En control':'Sin evaluar',reason});
 const fmtMinutes=value=>value===null?'S/D':nfmt(value)+' min';
 const set=filteredIncidents,has=!!set.length;
 const mttrKpi=state.kpis?.find(k=>k.metric==='mttr_90d'&&matchingScope(k)),criticalKpi=state.kpis?.find(k=>k.metric==='critical_incidents_30d'&&matchingScope(k));
 const mttrLevel=mttrKpi?kpiResult(state,mttrKpi,today).level:'unknown';
 const criticalLevel=criticalKpi?kpiResult(state,criticalKpi,today).level:'unknown';
 const evaluatedKpi=(kpi,level,description)=>kpi?signal(level,description):semaphore({level:'unknown',label:'Sin meta',reason:description});
 const riskLevel=!has?'unknown':stats.criticalOpen?'critical':stats.open?'warning':'ok';
 const max=Math.max(1,...monthly.map(m=>m.opened));
 const chart=monthly.map(slot=>{
   const label=new Intl.DateTimeFormat('es-AR',{month:'short',year:'2-digit',timeZone:'UTC'}).format(new Date(slot.month+'-01T12:00:00Z'));
   const pct=slot.opened/max*100;
   return `<div class="itsm-month"><div class="itsm-month-head"><span>${esc(label)}</span><strong>${slot.opened} ingreso(s)</strong></div>
    <div class="itsm-track" role="img" aria-label="${esc(slot.month)}: ${slot.opened} incidentes ingresados, ${slot.critical} prioritarios P1 y P2">
      <span class="itsm-bar" style="width:${pct}%"></span></div>
    <div class="itsm-month-foot"><span>P1/P2: ${slot.critical}</span><span>MTTR cerrados: ${esc(fmtMinutes(slot.mttr))}</span></div></div>`;
 }).join('');
 const byService=services.map(s=>{
  const isCritical=s.critical>0;
  return `<tr><td><span class="cell-title">${esc(s.name)}</span><span class="cell-meta">${esc(state.verticals.find(v=>v.id===s.verticalId)?.name||'Sin vertical')}</span></td>
  <td><strong class="number">${s.total}</strong></td><td>${s.open?signal(isCritical?'critical':'warning',s.open+' incidente(s) abierto(s)') : s.total?signal('ok','Sin incidentes pendientes') :signal('unknown','Sin incidentes registrados')} <span class="cell-meta">${s.open} abierto(s)</span></td>
  <td>${s.critical}</td><td class="number">${esc(fmtMinutes(s.mttr))}</td></tr>`;
 }).join('');
 const recent=[...set].sort((a,b)=>Date.parse(b.openedAt)-Date.parse(a.openedAt)).slice(0,30).map(it=>{
  const service=state.services.find(s=>s.id===it.serviceId);
  const open=it.resolvedAt===null;
  const level=open?['P1','P2'].includes(it.priority)?'critical':'warning':'ok';
  const opened=it.openedAt.replace('T',' ');
  return `<tr><td><span class="cell-title">${esc(it.id)}</span><span class="cell-meta">${esc(it.summary)}</span></td>
    <td>${esc(service?.name||it.serviceId)}</td><td>${esc(it.priority)}</td>
    <td>${esc(opened)}</td><td>${open?signal(level,'Incidente pendiente de resolución'):signal('ok','Resolución registrada')}</td>
    <td>${open?'—':esc(fmtMinutes(resolutionMinutes(it)))}</td>
    <td>${open?mini('Cerrar incidente','incident-close',it.id):'<span class="cell-meta">Cerrado</span>'}</td></tr>`;
 }).join('');
 return `<section class="executive-summary signal-border-${riskLevel}">
 <div class="executive-summary-upper"><div><span class="executive-overline">IT SERVICE MANAGEMENT / INCIDENT ANALYTICS</span>
 <h2>Incidentes, recuperación y tendencias.</h2>
 <p class="executive-summary-text">Importá incidentes de un CSV, seguí los casos abiertos y medí tiempos de recuperación. El MTTR utiliza diferencias entre fechas reales de apertura y resolución, no números de ejemplo fijados en el tablero.</p>
 <div class="summary-footnotes"><span>Períodos móviles: 30 y 90 días</span><span>Los meses se agrupan por fecha de origen del registro</span><span>CSV local; no se envía a servidores</span></div></div>
 <div class="summary-aside"><div class="summary-aside-header">INCIDENTES ABIERTOS</div><div class="summary-aside-value">${stats.open}</div><span>${stats.criticalOpen} abiertos P1 / P2</span>${signal(riskLevel,'Semáforo basado en abiertos P1/P2 y pendientes')}</div></div></section>
 ${filterBar}
 <div class="section-eyeline">01 / OPERACIÓN · KPIS CALCULADOS</div>
 <div class="itsm-kpi-grid">
  <article class="performance-kpi signal-border-${mttrLevel}"><div class="performance-kpi-top"><span class="executive-overline">MTTR · ÚLTIMOS 90 DÍAS</span>${evaluatedKpi(mttrKpi,mttrLevel,'MTTR comparado con la meta del KPI configurado; no equivale a downtime.')}</div><div class="performance-actual">${esc(fmtMinutes(stats.mttr90))}</div><p>Media desde apertura hasta resolución de ${stats.resolved90} incidente(s) cerrados en los últimos 90 días.</p></article>
  <article class="performance-kpi signal-border-${criticalLevel}"><div class="performance-kpi-top"><span class="executive-overline">P1 / P2 · ÚLTIMOS 30 DÍAS</span>${evaluatedKpi(criticalKpi,criticalLevel,'P1/P2 ingresados en 30 días, comparados con el KPI si existe.')}</div><div class="performance-actual">${has?stats.critical30:'S/D'}</div><p>Incidentes críticos ingresados en los últimos 30 días, incluyendo casos resueltos.</p></article>
  <article class="performance-kpi signal-border-${riskLevel}"><div class="performance-kpi-top"><span class="executive-overline">INCIDENTES PENDIENTES</span>${signal(riskLevel,'Casos sin fecha de resolución')}</div><div class="performance-actual">${has?stats.open:'S/D'}</div><p>${stats.criticalOpen} prioritarios P1/P2 abiertos de ${stats.total} registros históricos.</p></article>
  <article class="performance-kpi signal-border-unknown"><div class="performance-kpi-top"><span class="executive-overline">CIERRES · ÚLTIMOS 90 DÍAS</span>${semaphore({level:'unknown',label:'Medición',reason:'Cantidad observada de cierres; sin objetivo configurado.'})}</div><div class="performance-actual">${stats.resolved90}</div><p>Cierres utilizados para calcular MTTR. Los pendientes no entran en el promedio.</p></article>
 </div>
 <div class="section-eyeline">02 / HISTÓRICO MENSUAL</div>
 <div class="layout-two layout-equal">
 <section class="executive-panel"><div class="executive-panel-head"><div><span class="executive-overline">INCIDENTS OPENED / MONTH</span><h3>Volumen de incidentes</h3><p>Mes de apertura del registro, con identificación de prioridades P1/P2.</p></div></div>
  <div class="itsm-monthly">${chart}</div></section>
 <section class="executive-panel"><div class="executive-panel-head"><div><span class="executive-overline">RECOVERY TIME ANALYTICS</span><h3>Evolución del MTTR</h3><p>MTTR mensual calculado con incidentes resueltos en ese mes (fecha de cierre).</p></div></div>
  <div class="itsm-monthly">${monthly.map(slot=>{
    const label=new Intl.DateTimeFormat('es-AR',{month:'short',year:'2-digit',timeZone:'UTC'}).format(new Date(slot.month+'-01T12:00:00Z'));
    const peak=Math.max(1,...monthly.map(x=>x.mttr??0));
    return `<div class="itsm-month"><div class="itsm-month-head"><span>${esc(label)}</span><strong>${esc(fmtMinutes(slot.mttr))}</strong></div>
    <div class="itsm-track" role="img" aria-label="MTTR de ${esc(slot.month)}: ${esc(fmtMinutes(slot.mttr))}"><span class="itsm-bar mttr" style="width:${slot.mttr===null?0:slot.mttr/peak*100}%"></span></div>
    <div class="itsm-month-foot"><span>${slot.resolved} incidente(s) cerrados</span></div></div>`;
   }).join('')}</div></section></div>
 <div class="section-eyeline">03 / CATÁLOGO DE SERVICIOS · IMPACTO</div>
 <section class="executive-panel"><div class="executive-panel-head"><div><span class="executive-overline">SERVICE LEVELS / OPERATIONS</span><h3>Concentración por servicio</h3><p>Conteos y tiempos de resolución históricos, no ponderados por criticidad.</p></div></div>
 ${services.length?'<div class="table-wrap"><table class="data-table"><thead><tr><th>SERVICIO Y VERTICAL</th><th>TOTAL</th><th>ESTADO</th><th>P1/P2</th><th>MTTR HISTÓRICO</th></tr></thead><tbody>'+byService+'</tbody></table></div>':empty('Sin servicios','Definí servicios en Continuidad y SLA antes de importar incidentes.')}
 </section>
 <div class="section-eyeline">04 / INGESTIÓN Y SEGUIMIENTO</div>
 <div class="layout-two">
  <section class="executive-panel"><div class="executive-panel-head"><div><span class="executive-overline">DATA INGESTION / CSV</span><h3>Importar incidentes</h3><p>Cargá registros exportados de una herramienta ITSM mediante una plantilla controlada.</p></div></div>
   <div class="itsm-import-actions"><label for="incident-file" class="button button-primary">Seleccionar CSV</label><input type="file" id="incident-file" accept=".csv,text/csv,text/plain" hidden><button type="button" class="button button-subtle" data-command="incident-sample">Descargar ejemplo CSV</button></div>
   <div id="itsm-import-workspace" aria-live="polite"></div>
   <div class="itsm-schema"><strong>Columnas obligatorias</strong><code>incident_id, service_id, priority, opened_at, resolved_at, summary</code><p>Servicio por ID (ver tabla de servicios); prioridad P1–P4; fechas ISO 8601 con zona, por ejemplo <code>2026-11-18T10:30:00-03:00</code>. Dejá <code>resolved_at</code> vacío para casos abiertos.</p></div>
   <p class="mini-glossary">Importación transaccional: se rechaza el lote completo si una fila es inválida. Los IDs ya importados no se duplican; un incidente abierto puede actualizarse con una fecha de resolución. Máximo 2000 incidentes y archivo de 512 KB.</p>
   <p class="itsm-service-identifiers">IDs de servicios disponibles: ${state.services.map(s=>'<code>'+esc(s.id)+'</code> '+esc(s.name)).join(' · ')||'No hay servicios cargados.'}</p>
  </section>
  <section class="executive-panel"><div class="executive-panel-head"><div><span class="executive-overline">IMPORTANT DATA LIMITS</span><h3>Cómo interpretar los KPI</h3></div></div>
  <div class="itsm-principles"><p><strong>MTTR no es indisponibilidad.</strong> Tiempo de resolución del ticket no significa tiempo exacto fuera de servicio.</p>
  <p><strong>Disponibilidad/SLA</strong> siguen calculándose con sus minutos observados en el catálogo. El CSV no modifica esos valores sin evidencia de interrupciones reales.</p>
  <p><strong>Períodos y zonas horarias:</strong> las ventanas móviles se calculan por instantes UTC; cada mes se asigna usando la fecha y zona del registro original.</p>
  <p><strong>Privacidad:</strong> los incidentes permanecen en el navegador, sin autenticación ni envío remoto. No cargues información corporativa sensible en esta demo.</p></div>
  </section>
 </div>
 <section class="executive-panel"><div class="executive-panel-head"><div><span class="executive-overline">OPERATIONAL REGISTER / LAST 30</span><h3>Registro reciente de incidentes</h3><p>Se muestran los 30 incidentes más recientes. La exportación JSON incluye todo el conjunto.</p></div></div>
  ${recent?'<div class="table-wrap"><table class="data-table"><thead><tr><th>INCIDENTE</th><th>SERVICIO</th><th>PRIORIDAD</th><th>APERTURA CON ZONA</th><th>ESTADO</th><th>RESOLUCIÓN (MIN)</th><th>GESTIONAR</th></tr></thead><tbody>'+recent+'</tbody></table></div>':empty('Sin incidentes','Descargá el ejemplo CSV o importá tus propios registros de prueba.')}
 </section>`;
}
