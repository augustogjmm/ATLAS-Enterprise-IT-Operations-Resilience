import {METRICS,kpiResult,keyResultProgress,objectiveProgress} from './lib/governance/performance.js';

// Vista ejecutiva sin lógica de escritura: toda operación se realiza mediante los formularios ATLAS.
export function performanceView(state,today,{esc,mini,semaphore,empty,nfmt,fmtPct}){
  const kpis=state.kpis||[],objectives=state.objectives||[];
  const values=kpis.map(k=>({k,r:kpiResult(state,k,today)}));
  const measured=objectives.map(o=>objectiveProgress(state,o,today)).filter(x=>x.progress!==null);
  const mean=measured.length?measured.reduce((sum,x)=>sum+x.progress,0)/measured.length:null;
  const format=(value,unit)=>value===null?'S/D':unit==='cantidad'?nfmt(value):unit==='/5'?nfmt(value)+' / 5':fmtPct(value);
  const badge=(level,reason)=>semaphore({level,label:{ok:'En meta',warning:'Atención',critical:'Desviado',unknown:'Sin evaluar'}[level],reason});
  const kpiMarkup=values.map(({k,r})=>`<article class="performance-kpi signal-border-${r.level}">
   <div class="performance-kpi-top"><span class="executive-overline">INDICADOR / ${esc(METRICS[k.metric].label)}</span>${badge(r.level,r.description)}</div>
   <h3>${esc(k.name)}</h3><div class="performance-actual">${esc(format(r.value,r.unit))}</div>
   <div class="performance-target">META <strong>${esc(format(k.target,r.unit))}</strong><span> ${r.direction==='lower'?'máximo':'mínimo'}</span></div>
   <p>${esc(r.description)}</p><div class="performance-kpi-owner">RESPONSABLE · ${esc(k.owner)}</div>
   </article>`).join('');
  const objectiveMarkup=objectives.map(obj=>{
   const p=objectiveProgress(state,obj,today),results=(state.keyResults||[]).filter(kr=>kr.objectiveId===obj.id);
   const status=badge(p.level,p.reason);
   const body=results.map(kr=>{
    const res=keyResultProgress(state,kr,today),kpi=kpis.find(k=>k.id===kr.kpiId);
    const unit=METRICS[kpi?.metric]?.unit||'';
    return `<div class="okr-result"><div class="okr-result-head"><strong>${esc(kpi?.name||'Indicador no disponible')}</strong>${badge(res.level,res.reason)}</div>
      <div class="okr-result-values"><span>BASE ${esc(format(kr.baseline,unit))}</span><span>ACTUAL ${esc(format(res.value,unit))}</span><span>META ${esc(format(kr.target,unit))}</span></div>
      <div class="okr-progress small" role="img" aria-label="Avance de KR: ${res.progress===null?'sin datos':nfmt(res.progress)+'%'}"><span style="width:${res.progress??0}%"></span></div></div>`;
   }).join('');
   return `<article class="okr-card signal-border-${p.level}"><div class="okr-card-head"><div><span class="executive-overline">OBJETIVO · ${obj.status==='activo'?'EN SEGUIMIENTO':'CERRADO'}</span>
    <h3>${esc(obj.title)}</h3><p>${esc(obj.owner)} · ${esc(obj.startDate)} → ${esc(obj.dueDate)}</p></div>${status}</div>
    <div class="okr-total"><strong>${p.progress===null?'Sin datos':nfmt(p.progress)+'%'}</strong><span>${p.tracked} de ${p.total} KR medidos</span></div>
    <div class="okr-progress" role="img" aria-label="Avance del objetivo: ${p.progress===null?'sin datos':nfmt(p.progress)+'%'}"><span style="width:${p.progress??0}%"></span></div>
    <div class="okr-results">${body||empty('Sin resultados clave','Vinculá un KPI con línea base y meta.')}</div>
    <div class="okr-card-foot"><span>${esc(p.reason)}</span><div class="item-actions">
      ${obj.status==='activo'?mini('+ Resultado clave','kr',obj.id):''}
      ${obj.status==='activo'&&p.progress!==null&&p.tracked===p.total?mini('Cerrar objetivo','okr-close',obj.id,'secondary'):''}
    </div></div></article>`;
  }).join('');
  const measuredKpis=values.filter(({r})=>r.level!=='unknown');
  const problems=values.filter(({r})=>r.level==='critical').length;
  return `<section class="executive-summary signal-border-${problems?'critical':measuredKpis.length?'warning':'unknown'}">
    <div class="executive-summary-upper"><div><span class="executive-overline">EXECUTIVE PERFORMANCE / KPI & OKR</span><h2>Resultados tecnológicos con evidencia.</h2>
      <p class="executive-summary-text">Indicadores calculados desde riesgos, servicios, capacity, assessments, acciones y comité. Los resultados clave avanzan cuando cambian los registros, no por porcentajes cargados a mano.</p>
      <div class="summary-footnotes"><span>${kpis.length} KPI · ${values.filter(x=>x.r.level==='ok').length} en meta · ${problems} desviados</span><span>Datos ficticios iniciales o locales · Sin telemetría en vivo</span></div></div>
      <div class="summary-aside"><div class="summary-aside-header">AVANCE MEDIO DE OKR</div><div class="summary-aside-value">${mean===null?'S/D':nfmt(mean)+'%'}</div><span>${measured.length} objetivo(s) con resultados medidos</span></div></div></section>
    <div class="section-eyeline">01 / INDICADORES DE DESEMPEÑO</div>
    <section class="executive-panel"><div class="executive-panel-head"><div><span class="executive-overline">PERFORMANCE CONTROL</span><h3>KPI · valores, metas y responsables</h3><p>El estado y la medición se recalculan usando las reglas descritas en cada indicador.</p></div>${mini('+ Nuevo KPI','kpi')}${!kpis.length&&!objectives.length?mini('Cargar ejemplos','seed-performance','','secondary'):''}</div>
      ${kpiMarkup?'<div class="performance-kpi-grid">'+kpiMarkup+'</div>':empty('No hay KPI configurados','Registrá un indicador con meta y responsable.')}
    </section>
    <div class="section-eyeline">02 / OBJETIVOS Y RESULTADOS CLAVE</div>
    <section class="executive-panel"><div class="executive-panel-head"><div><span class="executive-overline">OBJECTIVES & KEY RESULTS</span><h3>OKR tecnológicos</h3><p>Los KR comparan línea base, resultado actual y meta. Las metas sin registros aparecen como «Sin evaluar».</p></div><div class="item-actions">${mini('+ Nuevo objetivo','okr')}${kpis.length&&objectives.length?mini('+ Resultado clave','kr','','secondary'):''}</div></div>
      ${objectiveMarkup?'<div class="okr-grid">'+objectiveMarkup+'</div>':empty('Sin OKR definidos','Creá un objetivo y agregale resultados clave relacionados con KPI.')}
    </section>
    <div class="executive-board-note">El avance de cada KR se interpola entre su línea base y su meta (0–100 %). Los KPI expresan datos calculados del workspace, no monitoreo real. Las metas, responsables y fechas son editables al crear nuevos registros; el cierre de un objetivo requiere todos sus KR medidos.</div>`;
}
