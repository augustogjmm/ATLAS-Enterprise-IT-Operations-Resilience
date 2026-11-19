// Controles del shell ATLAS V4 conectados al estado existente de ATLAS V5.
import {ATLAS_DOMAINS} from './executive-command.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const modules=[['overview','Inicio'],['operations','Análisis operativo'],['performance','Indicadores'],['incidents','Incidentes'],['verticals','Verticales'],['capacity','Capacidad'],['risks','Riesgos'],['continuity','Continuidad'],['actions','Planes'],['committee','Comité']];
export function mountAtlasShell({getState,getWorkspace,navigate}){
 const search=document.getElementById('atlas-search');
 const input=document.getElementById('atlas-search-input');
 const results=document.getElementById('atlas-search-results');
 const alerts=document.getElementById('atlas-notifications');
 const status=document.getElementById('atlas-organization');
 const session=document.getElementById('atlas-session');
 function update(){
  const ws=getWorkspace();
  const selected=ws.session?.tenants?.find(t=>t.tenant_id===ws.tenant);
  status.textContent=selected?.name||'Workspace local';
  session.textContent=ws.id?'V5 · '+ws.role:'MODO DEMOSTRACIÓN';
 }
 function entries(){
  const state=getState();
  return [
   ...modules.map(([route,title])=>({kind:'Módulo',title,route})),
   ...ATLAS_DOMAINS.map(([title])=>({kind:'Dominio',title,route:'overview',domain:title})),
   ...(state.decisions||[]).map(d=>({kind:'Decisión',title:d.title,route:'committee'})),
   ...(state.risks||[]).filter(r=>r.status==='abierto').map(r=>({kind:'Riesgo',title:r.title,route:'risks'}))
  ];
 }
 function drawSearch(){
  const query=input.value.trim().toLocaleLowerCase('es');
  const hits=entries().filter(x=>(x.title+' '+x.kind).toLocaleLowerCase('es').includes(query)).slice(0,15);
  results.innerHTML=hits.length?hits.map(x=>'<button type="button" class="atlas-hit" data-shell-route="'+esc(x.route)+'"'+
   (x.domain?' data-shell-domain="'+esc(x.domain)+'"':'')+'><span>'+esc(x.title)+'</span><small>'+esc(x.kind)+'</small></button>').join(''):
   '<p>No se encontraron registros o módulos.</p>';
 }
 function openSearch(){update();drawSearch();search.showModal();input.focus();}
 const searchButton=document.getElementById('atlas-search-open');
 searchButton.addEventListener('click',openSearch);
 input.addEventListener('input',drawSearch);
 search.addEventListener('click',event=>{
  const button=event.target.closest('[data-shell-route]');
  if(button){
   search.close();navigate(button.dataset.shellRoute);
   if(button.dataset.shellDomain){
    const item=[...document.querySelectorAll('[data-command-domain]')].find(x=>x.dataset.commandDomain===button.dataset.shellDomain);
    item?.click();
   }
  }
  if(event.target.dataset.shellClose!==undefined)search.close();
 });
 document.addEventListener('keydown',event=>{
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){
   event.preventDefault();if(search.open)search.close();else openSearch();
  }
 });
 const notificationsButton=document.getElementById('atlas-notifications-open');
 notificationsButton.addEventListener('click',()=>{
  const state=getState(),risks=(state.risks||[]).filter(r=>r.status==='abierto'),
    decisions=(state.decisions||[]).filter(d=>d.status==='pendiente'),
    incidents=(state.incidents||[]).filter(i=>i.resolvedAt===null||i.resolvedAt===undefined);
  const rows=[['Riesgos abiertos',risks.length,'risks'],['Decisiones pendientes',decisions.length,'committee'],['Incidentes sin resolver',incidents.length,'incidents']];
  document.getElementById('atlas-notifications-results').innerHTML=rows.map(([name,n,route])=>
    '<button type="button" class="atlas-hit" data-shell-route="'+route+'"><span>'+esc(name)+'</span><small>'+n+' registros</small></button>').join('');
  alerts.showModal();
 });
 alerts.addEventListener('click',event=>{
  const target=event.target.closest('[data-shell-route]');
  if(target){alerts.close();navigate(target.dataset.shellRoute);}
  if(event.target.dataset.shellClose!==undefined)alerts.close();
 });
 document.getElementById('atlas-profile-open').addEventListener('click',()=>{
  update();document.getElementById('workspace-panel')?.scrollIntoView({behavior:'smooth',block:'start'});
 });
 update();return {update};
}
