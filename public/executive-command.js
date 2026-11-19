// ATLAS Identity 1.0 — vista ejecutiva vinculada al estado real de V5.
// Las ocho categorías son la taxonomía aprobada: una categoría sin registros muestra "Sin datos".
import {availability,capacityStatus,severity} from './lib/governance/core.js';

export const ATLAS_DOMAINS=[
  ['Infraestructura','server',/infraestructura|storage|c[oó]mputo|data.center|virtualizaci[oó]n/i,'verticals'],
  ['Conectividad','network',/redes|network|conectividad|enlace|wan|lan/i,'verticals'],
  ['Seguridad','shield',/seguridad|security|identidad|acceso/i,'assessments'],
  ['Continuidad','infinity',/continuidad|resiliencia|drp|backup|recuperaci[oó]n/i,'continuity'],
  ['Cloud y plataformas','cloud',/cloud|nube|plataforma/i,'capacity'],
  ['Aplicaciones','apps',/aplicaci[oó]n|sistema|canales|software|itsm/i,'verticals'],
  ['Datos','database',/datos|data|base de datos|sql|storage/i,'capacity'],
  ['Integraciones','network',/integraci[oó]n|middleware|api|mensajer[ií]a/i,'verticals']
];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const d2=v=>String(v).padStart(2,'0');

const glyphs={
 server:'<rect x="4" y="4" width="16" height="7" rx="2"/><rect x="4" y="13" width="16" height="7" rx="2"/><path d="M7 7h.01M7 16h.01M11 7h6M11 16h6"/>',
 network:'<circle cx="12" cy="4" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><path d="M12 6v5M12 11l-7 6M12 11l7 6"/>',
 shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>',
 infinity:'<path d="M6 16c-5 0-5-8 0-8 5 0 7 8 12 8s5-8 0-8-7 8-12 8Z"/>',
 cloud:'<path d="M20 17H7a4 4 0 0 1-1-7.9A6 6 0 0 1 17.4 10 3.5 3.5 0 0 1 20 17Z"/>',
 apps:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
 database:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/>'
};
const iconSvg=name=>'<svg class="command-glyph" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" fill="none" aria-hidden="true">'+(glyphs[name]||glyphs.network)+'</svg>';

const pct=v=>Number.isFinite(v)?new Intl.NumberFormat('es-AR',{maximumFractionDigits:2,minimumFractionDigits:2}).format(v)+'%':'Sin datos';
const empty='Sin datos';
let lens='Panorama',selected='',selectedDecision='';
const lenses=['Panorama','Dependencias','Disponibilidad','Capacidad','Riesgo'];
export function executiveModel(s){
 const isDemo=s.kind==='demo'||s.kind==='custom';
 const vs=s.verticals||[],services=s.services||[],capacity=s.capacities||[],risks=s.risks||[],incidents=s.incidents||[],decisions=s.decisions||[];
 const critical=services.filter(x=>Number(x.criticality)===1);
 const av=services.map(availability).filter(Number.isFinite);
 // Disponibilidad agregada ponderada por período; no promediar porcentajes de períodos distintos.
 const valid=services.filter(x=>Number.isFinite(availability(x)));
 const duration=valid.reduce((n,x)=>n+Number(x.periodMinutes),0);
 const availabilityTotal=duration?100*valid.reduce((n,x)=>n+Number(x.periodMinutes)-Number(x.downtimeMinutes),0)/duration:null;
 const activeRisks=risks.filter(x=>x.status==='abierto');
 const pending=decisions.filter(x=>x.status==='pendiente');
 const openIncidents=incidents.filter(x=>x.resolvedAt===null||x.resolvedAt===undefined);
 const domains=ATLAS_DOMAINS.map(([name,icon,match,route])=>{
   const ownerVerticals=vs.filter(x=>match.test(x.name+' '+x.description));
   const ids=new Set(ownerVerticals.map(x=>x.id));
   const associatedServices=services.filter(x=>ids.has(x.verticalId)||match.test(x.name));
   const associatedCapacity=capacity.filter(x=>ids.has(x.verticalId)||match.test(x.name));
   const associatedRisks=activeRisks.filter(x=>ids.has(x.verticalId)||match.test(x.title+' '+x.description));
   const a=associatedServices.map(availability).filter(Number.isFinite);
   const used=associatedCapacity.map(capacityStatus).map(x=>x.utilization).filter(Number.isFinite);
   const risk=associatedRisks.some(x=>severity(x).score>=15)?'Alto':associatedRisks.length?'Seguimiento':'Sin riesgos registrados';
   const alert=associatedRisks.length>0||associatedCapacity.some(x=>capacityStatus(x).warning);
   return {name,icon,route,services:associatedServices,capacity:associatedCapacity,risks:associatedRisks,verticals:ownerVerticals,
     availability:a.length?a.reduce((n,x)=>n+x,0)/a.length:null,utilization:used.length?used.reduce((n,x)=>n+x,0)/used.length:null,
     risk,status:alert?'Seguimiento':(ownerVerticals.length||associatedServices.length||associatedCapacity.length)?'Con registros':'Sin datos'};
 });
 return {domains,availability:availabilityTotal,critical:critical.length,pending,activeRisks,openIncidents,
   decisions,events:(s.events||[]).slice(-4).reverse(),isDemo,hasRecords:vs.length+services.length+risks.length+decisions.length>0};
}
function domainSub(d){
 if(lens==='Disponibilidad')return 'Disponibilidad · '+pct(d.availability);
 if(lens==='Capacidad')return 'Utilización · '+pct(d.utilization);
 if(lens==='Riesgo')return 'Riesgos abiertos · '+d.risks.length+' / '+d.risk;
 if(lens==='Dependencias')return d.services.length+' servicios · '+d.verticals.length+' verticales';
 return d.services.length+' servicios · '+d.capacity.length+' capacidades';
}
function domainDetail(d){
 return '<div class="command-inspector"><div><span class="command-eyebrow">DOMINIO / INFORMACIÓN CONTEXTUAL</span><h3>'+esc(d.name)+'</h3></div>'+
  '<div class="command-inspector-grid"><span>Estado <b>'+esc(d.status)+'</b></span><span>Disponibilidad <b>'+esc(pct(d.availability))+'</b></span>'+
  '<span>Capacidad <b>'+esc(pct(d.utilization))+'</b></span><span>Riesgo <b>'+esc(d.risk)+'</b></span></div>'+
  '<p>'+esc(d.verticals.map(v=>v.name+' · '+v.owner).join(' | ')||'No hay verticales asociadas a esta categoría.')+'</p>'+
  '<button type="button" data-view="'+esc(d.route)+'" class="command-link">Abrir módulo relacionado ↗</button>'+
  '<button type="button" data-command-ui="close" class="command-link">Cerrar detalle ×</button></div>';
}
export function renderExecutiveCommand(s){
 const m=executiveModel(s);const left=m.domains.slice(0,4),right=m.domains.slice(4);
 const domainButton=d=>'<button type="button" class="command-domain '+(d.status==='Seguimiento'?'is-watch ':'')+(selected===d.name?'is-selected':'')+
  '" data-command-domain="'+esc(d.name)+'" aria-pressed="'+(selected===d.name)+'"><span class="command-domain-icon">'+iconSvg(d.icon)+'</span><span class="command-domain-copy"><strong>'+esc(d.name)+'</strong><small>'+esc(domainSub(d))+'</small><span class="command-domain-state">'+esc(d.status)+'</span></span></button>';
 const kpis=[['Disponibilidad',pct(m.availability)],['Componentes críticos',String(m.critical)],['Decisiones abiertas',String(m.pending.length)],['Riesgos prioritarios',String(m.activeRisks.length)],['Incidentes relevantes',String(m.openIncidents.length)]];
 const dec=m.pending.slice(0,3);
 return '<div class="command" data-contract="ATLAS-V4-Identity-1.0">'+
 '<section class="command-hero"><div><span class="command-eyebrow">CENTRO DE GOBIERNO TECNOLÓGICO / 01</span><h1>Visibilidad para decidir<span>.</span></h1>'+
 '<p>Una perspectiva integral del Core, la disponibilidad, los riesgos y la operación tecnológica.</p></div>'+
 '<button type="button" class="command-quiet" data-view="committee">Vista comité ↗</button></section>'+
 '<div class="command-data-label">'+(m.isDemo?'DATOS DEMOSTRATIVOS O EDITADOS · NO ES MONITOREO EN TIEMPO REAL':'REGISTROS DEL WORKSPACE · SIN MONITOREO EN TIEMPO REAL')+'</div>'+
 '<section class="command-kpis" aria-label="Indicadores ejecutivos"><div class="command-kpi-intro"><small>LECTURA EJECUTIVA</small><em>La operación, hoy.</em></div>'+
 kpis.map(([label,value],i)=>'<div class="command-kpi"><b>'+esc(value)+'</b><span>'+esc(label)+'</span><small>'+esc(i===0?'Calculado de registros':i===1?'Servicios de criticidad 1':i===2?'Pendientes':i===3?'Riesgos abiertos':'Incidentes sin resolver')+'</small></div>').join('')+'</section>'+
 '<section class="command-primary"><article class="command-map"><header class="command-map-head"><h2>Ecosistema tecnológico</h2><div class="command-lenses" role="group" aria-label="Perspectivas del ecosistema">'+
 lenses.map(x=>'<button type="button" data-command-lens="'+x+'" aria-pressed="'+(x===lens)+'" class="'+(x===lens?'on':'')+'">'+x+'</button>').join('')+'</div></header>'+
 '<div class="command-map-area" data-lens="'+esc(lens)+'"><svg class="command-connections" viewBox="0 0 1000 460" preserveAspectRatio="none" aria-label="Vínculos conceptuales de los ocho dominios con Core">'+
 m.domains.map((d,i)=>{const left=i<4,position=i%4,y=64+position*110;return '<path class="command-connection '+(d.status==='Seguimiento'?'is-watch ':'')+(selected===d.name?'is-selected':'')+'" data-domain-link="'+esc(d.name)+'" d="M '+(left?278:722)+' '+y+' C '+(left?398:602)+' '+y+', '+(left?386:614)+' 230, '+(left?490:510)+' 230" />'}).join('')+
 '</svg><div class="command-domain-column command-left">'+left.map(domainButton).join('')+'</div>'+
 '<button type="button" data-command-ui="core" class="command-core" aria-label="Abrir detalle de Core"><span class="command-core-symbol">'+iconSvg('network')+'</span><strong>Core</strong><small>'+esc(pct(m.availability))+' DISPONIBILIDAD</small><span class="command-core-state">'+(m.availability===null?'SIN DATOS':'CON REGISTROS')+'</span></button>'+
 '<div class="command-domain-column command-right">'+right.map(domainButton).join('')+'</div></div>'+
 '<div class="command-map-foot"><span>● Con registros &nbsp; ● Seguimiento &nbsp; Perspectiva: <b>'+esc(lens)+'</b></span>'+
 '<button type="button" class="command-link" data-view="verticals">Explorar arquitectura →</button></div>'+
 (selected==='Core'?'<div class="command-inspector"><span class="command-eyebrow">CORE / ESTADO INTEGRADO</span><h3>Core</h3><p>'+
 esc(m.critical)+' servicios críticos registrados; disponibilidad agregada '+esc(pct(m.availability))+'. Información procedente del workspace.</p>'+
 '<button type="button" data-view="continuity" class="command-link">Abrir continuidad →</button><button type="button" data-command-ui="close" class="command-link">Cerrar ×</button></div>':
 m.domains.some(d=>d.name===selected)?domainDetail(m.domains.find(d=>d.name===selected)):'')+'</article>'+
 '<aside class="command-decisions"><span class="command-eyebrow">✦ ATLAS / DECISION INTELLIGENCE</span><h2>Prioridades de dirección.</h2>'+
 '<p>Información tecnológica convertida en decisiones con impacto, responsables y plazo.</p>'+
 (dec.length?dec.map((d,i)=>'<button type="button" class="command-decision" data-command-decision="'+esc(d.id)+'"><span>'+d2(i+1)+'</span><div><strong>'+esc(d.title)+'</strong>'+
 '<small>'+esc(d.owner||'Sin responsable')+' · '+esc(d.dueDate||'Sin fecha')+'</small><small>'+esc(m.activeRisks.find(r=>r.id===d.riskId)?.title||'Sin riesgo asociado')+'</small></div></button>').join(''):
 '<p class="command-empty">No hay decisiones pendientes registradas.</p>')+
 (selectedDecision?(()=>{
 const chosen=dec.find(d=>d.id===selectedDecision);
 const risk=m.activeRisks.find(r=>r.id===chosen?.riskId);
 return chosen?'<div class="command-decision-detail"><span class="command-eyebrow">DECISIÓN / DETALLE</span><h3>'+esc(chosen.title)+'</h3>'+
 '<p>Responsable: '+esc(chosen.owner||'Sin asignar')+'</p><p>Fecha objetivo: '+esc(chosen.dueDate||'Sin fecha')+'</p>'+
 '<p>Riesgo relacionado: '+esc(risk?.title||'Sin riesgo asociado')+'</p>'+
 '<p>Impacto: '+esc(risk?.description||'No documentado')+'</p>'+
 '<p>Recomendación: '+esc(risk?.treatment||'Consultar el plan de acción del registro')+'</p>'+
 '<button class="command-detail-link" type="button" data-view="committee">Ver decisión en comité →</button>'+
 '<button class="command-detail-link" type="button" data-command-ui="close">Cerrar detalle ×</button></div>':'';
 })():'')+
 '<button type="button" class="command-decision-go" data-view="committee">Abrir plan de decisiones →</button></aside></section>'+
 '<section class="command-bottom"><article class="command-bottom-card"><h2>Pulso operativo</h2>'+
 (m.events.length?m.events.map(e=>'<div class="command-event"><time>'+esc(e.date||'—')+'</time><span>'+esc(e.text)+'</span></div>').join(''):
 '<p class="command-empty">Sin eventos registrados.</p>')+'</article>'+
 '<article class="command-bottom-card"><h2>Estado por dominio</h2><div class="command-domain-strip">'+m.domains.map(d=>'<button type="button" data-command-domain="'+esc(d.name)+'">'+iconSvg(d.icon)+'<strong>'+esc(d.name)+'</strong><small class="'+(d.status==='Seguimiento'?'is-watch':'')+'">'+esc(d.status)+'</small></button>').join('')+'</div></article></section>'+
 '<p class="command-disclaimer">ATLAS / Estado derivado exclusivamente de los registros disponibles. Las categorías sin información muestran Sin datos; no existen integraciones de monitoreo real.</p>'+
 '</div>';
}
export function handleExecutiveCommand(event,s,rerender,openForm){
 const restoreFocus=selector=>{rerender();document.querySelector(selector)?.focus({preventScroll:true});};
 const domain=event.target.closest('[data-command-domain]');
 if(domain){
  selectedDecision='';selected=selected===domain.dataset.commandDomain?'':domain.dataset.commandDomain;
  const focused=[...document.querySelectorAll('.command-domain')].find(x=>x.dataset.commandDomain===selected);
  restoreFocus(focused?'.command-domain[data-command-domain="'+CSS.escape(domain.dataset.commandDomain)+'"]':
    '.command-core');
  return true;
 }
 const perspective=event.target.closest('[data-command-lens]');
 if(perspective){
  lens=perspective.dataset.commandLens;selected='';selectedDecision='';
  restoreFocus('[data-command-lens="'+CSS.escape(lens)+'"]');return true;
 }
 const action=event.target.closest('[data-command-ui]');
 if(action){selected=action.dataset.commandUi==='core'?'Core':'';selectedDecision='';
  restoreFocus('[data-command-ui="core"]');return true;}
 const decision=event.target.closest('[data-command-decision]');
 if(decision){
  selectedDecision=selectedDecision===decision.dataset.commandDecision?'':decision.dataset.commandDecision;
  selected='';restoreFocus('[data-command-decision="'+CSS.escape(decision.dataset.commandDecision)+'"]');return true;
 }
 return false;
}
