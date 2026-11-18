// ATLAS · ITSM Incident Management: ingestión CSV, validación y analítica determinista.
// Sin fetch ni conectores: el CSV se procesa exclusivamente dentro del navegador.
export const REQUIRED_COLUMNS=['incident_id','service_id','priority','opened_at','resolved_at','summary'];
export const PRIORITIES=['P1','P2','P3','P4'];
const MAX_ROWS=2000;
const DATE_PATTERN=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})$/;
const ONE_DAY=86400000;
const isText=(s,maximum=300)=>typeof s==='string'&&s.length>0&&s.length<=maximum;
const validDate=s=>typeof s==='string'&&DATE_PATTERN.test(s)&&Number.isFinite(Date.parse(s));
const boundedDate=(value,label)=>{
  if(!validDate(value))throw new Error(label+': fecha/hora ISO 8601 con zona horaria obligatoria (ej. 2026-11-18T10:30:00-03:00).');
  return value;
};

export function ensureIncidentState(state){
  if(!state||typeof state!=='object'||Array.isArray(state))throw new Error('Workspace inválido.');
  if(!Array.isArray(state.incidents))state.incidents=[];
  return state;
}
export function seedDemoIncidents(state){
  ensureIncidentState(state);
  if(state.incidents.length)return state;
  const samples=[
    ['DEMO-101','s-core','P1','2026-07-08T09:15:00-03:00','2026-07-08T10:35:00-03:00','Degradación de base transaccional (ejemplo ficticio)'],
    ['DEMO-102','s-channel','P2','2026-07-21T14:20:00-03:00','2026-07-21T15:05:00-03:00','Intermitencia en canales digitales (ejemplo ficticio)'],
    ['DEMO-103','s-network','P2','2026-08-10T08:30:00-03:00','2026-08-10T09:10:00-03:00','Conmutación de enlace (ejemplo ficticio)'],
    ['DEMO-104','s-core','P1','2026-08-24T11:10:00-03:00','2026-08-24T13:10:00-03:00','Retraso de procesos críticos (ejemplo ficticio)'],
    ['DEMO-105','s-itsm','P3','2026-09-05T10:00:00-03:00','2026-09-05T10:30:00-03:00','Error de integración ITSM (ejemplo ficticio)'],
    ['DEMO-106','s-channel','P2','2026-09-15T12:00:00-03:00','2026-09-15T12:40:00-03:00','Timeout en API de canales (ejemplo ficticio)'],
    ['DEMO-107','s-core','P1','2026-10-02T07:00:00-03:00','2026-10-02T08:45:00-03:00','Incidente de saturación (ejemplo ficticio)'],
    ['DEMO-108','s-network','P2','2026-10-16T17:00:00-03:00','2026-10-16T17:35:00-03:00','Pérdida intermitente de conectividad (ejemplo ficticio)'],
    ['DEMO-109','s-channel','P1','2026-11-04T09:25:00-03:00','2026-11-04T10:15:00-03:00','Respuesta degradada en canales (ejemplo ficticio)'],
    ['DEMO-110','s-itsm','P3','2026-11-06T08:30:00-03:00','2026-11-06T09:00:00-03:00','Falla de notificación de tickets (ejemplo ficticio)'],
    ['DEMO-111','s-core','P2','2026-11-10T16:10:00-03:00','2026-11-10T17:05:00-03:00','Incidente de procesamiento batch (ejemplo ficticio)'],
    ['DEMO-112','s-network','P2','2026-11-17T11:05:00-03:00',null,'Análisis de pérdida parcial de conectividad (ejemplo ficticio)']
  ];
  state.incidents=samples.map(([id,serviceId,priority,openedAt,resolvedAt,summary])=>({id,serviceId,priority,openedAt,resolvedAt,summary}));
  return state;
}
export function validateIncidentState(state){
  ensureIncidentState(state);
  if(state.incidents.length>MAX_ROWS)throw new Error('El máximo es '+MAX_ROWS+' incidentes por workspace.');
  const ids=new Set(),services=new Set(state.services.map(s=>s.id));
  for(const it of state.incidents){
    if(!it||!isText(it.id,90)||ids.has(it.id))throw new Error('Identificador de incidente vacío, demasiado largo o duplicado.');
    ids.add(it.id);
    if(!services.has(it.serviceId))throw new Error('El incidente '+it.id+' tiene un servicio inexistente.');
    if(!PRIORITIES.includes(it.priority))throw new Error('Prioridad inválida en '+it.id+'.');
    if(!isText(it.summary,300))throw new Error('Descripción inválida en '+it.id+'.');
    boundedDate(it.openedAt,'Apertura de '+it.id);
    if(it.resolvedAt!==null){
      boundedDate(it.resolvedAt,'Resolución de '+it.id);
      if(Date.parse(it.resolvedAt)<Date.parse(it.openedAt))throw new Error('La resolución antecede a la apertura de '+it.id+'.');
    }
  }
  return state;
}
// Parser de texto delimitado con comillas dobles, comillas escapadas, BOM y saltos de línea.
export function parseCSVRows(text){
  if(typeof text!=='string'||!text.trim())throw new Error('El archivo CSV está vacío.');
  if(text.length>1024*1024)throw new Error('Archivo CSV demasiado grande.');
  const clean=text.replace(/^\uFEFF/,'');
  const firstLine=clean.split(/\r?\n/,1)[0];
  const delimiter=firstLine.includes(';')&&!firstLine.includes(',')?';':',';
  const rows=[];let row=[],field='',quoted=false,endedQuote=false;
  for(let i=0;i<clean.length;i++){
    const c=clean[i];
    if(quoted){
      if(c==='"'&&clean[i+1]==='"'){field+='"';i++;}
      else if(c==='"') {quoted=false;endedQuote=true;}
      else field+=c;
      continue;
    }
    if(c==='"'&&field==='') {quoted=true;endedQuote=false;continue;}
    if(endedQuote&&c!==' '&&c!=='\t'&&c!==delimiter&&c!=='\r'&&c!=='\n')
      throw new Error('CSV mal formado: texto después del cierre de comillas.');
    if(c===delimiter){row.push(field);field='';endedQuote=false;continue;}
    if(c==='\r'&&clean[i+1]==='\n')continue;
    if(c==='\n'||c==='\r'){row.push(field);if(row.some(x=>x.trim()!==''))rows.push(row);row=[];field='';endedQuote=false;continue;}
    if(c==='"')throw new Error('CSV mal formado: comillas en campo sin escapar.');
    field+=c;
    if(field.length>5000)throw new Error('Campo CSV excesivamente largo.');
  }
  if(quoted)throw new Error('CSV mal formado: comillas sin cerrar.');
  row.push(field);if(row.some(x=>x.trim()!==''))rows.push(row);
  if(!rows.length)throw new Error('El archivo CSV está vacío.');
  if(rows.length>MAX_ROWS+1)throw new Error('Demasiadas filas; el máximo es '+MAX_ROWS+'.');
  return rows;
}
export function parseIncidentCSV(text,state){
  ensureIncidentState(state);
  const rows=parseCSVRows(text);
  const columns=rows[0].map(x=>x.trim().toLowerCase());
  if(new Set(columns).size!==columns.length)throw new Error('Hay columnas duplicadas en el encabezado.');
  const absent=REQUIRED_COLUMNS.filter(k=>!columns.includes(k));
  if(absent.length)throw new Error('Faltan columnas: '+absent.join(', ')+'.');
  const seen=new Set(),services=new Set(state.services.map(s=>s.id)),incidents=[];
  for(let i=1;i<rows.length;i++){
    const cols=rows[i];const line=i+1;
    if(cols.length!==columns.length)throw new Error('Fila '+line+': se esperaban '+columns.length+' columnas y hay '+cols.length+'.');
    const rec=Object.fromEntries(columns.map((name,j)=>[name,cols[j].trim()]));
    const id=rec.incident_id;
    if(!isText(id,90))throw new Error('Fila '+line+': incident_id inválido.');
    if(seen.has(id))throw new Error('Fila '+line+': incident_id repetido en el CSV: '+id+'.');
    seen.add(id);
    if(!services.has(rec.service_id))throw new Error('Fila '+line+': service_id desconocido: '+rec.service_id+'. Revisá el catálogo de servicios.');
    const priority=rec.priority.toUpperCase();
    if(!PRIORITIES.includes(priority))throw new Error('Fila '+line+': prioridad válida P1 a P4.');
    if(!isText(rec.summary,300))throw new Error('Fila '+line+': summary obligatorio y máximo 300 caracteres.');
    boundedDate(rec.opened_at,'Fila '+line+' · opened_at');
    const resolvedAt=rec.resolved_at||null;
    if(resolvedAt){
      boundedDate(resolvedAt,'Fila '+line+' · resolved_at');
      if(Date.parse(resolvedAt)<Date.parse(rec.opened_at))throw new Error('Fila '+line+': resolución anterior a apertura.');
    }
    incidents.push({id,serviceId:rec.service_id,priority,openedAt:rec.opened_at,resolvedAt,summary:rec.summary});
  }
  if(!incidents.length)throw new Error('El CSV no contiene incidentes.');
  return incidents;
}
export function importIncidents(state,candidates){
  ensureIncidentState(state);validateIncidentState(state);
  if(!Array.isArray(candidates))throw new Error('Importación inválida.');
  const current=new Map(state.incidents.map(r=>[r.id,r])),next=[...state.incidents],seen=new Set();
  let inserted=0,updated=0,unchanged=0;
  for(const row of candidates){
    if(!row||typeof row.id!=='string'||seen.has(row.id))throw new Error('El lote contiene incidentes duplicados.');
    seen.add(row.id);
    const old=current.get(row.id);
    if(!old){next.push({...row});inserted++;continue;}
    if(old.serviceId!==row.serviceId||old.priority!==row.priority||Date.parse(old.openedAt)!==Date.parse(row.openedAt)||old.summary!==row.summary)
      throw new Error('Conflicto de datos para '+row.id+': el identificador existe con información distinta.');
    if(old.resolvedAt===row.resolvedAt || old.resolvedAt&&row.resolvedAt&&Date.parse(old.resolvedAt)===Date.parse(row.resolvedAt)){unchanged++;continue;}
    if(old.resolvedAt!==null||row.resolvedAt===null)throw new Error('No se permite reabrir o modificar una resolución existente ('+row.id+').');
    const index=next.findIndex(x=>x.id===row.id);next[index]={...old,resolvedAt:row.resolvedAt};updated++;
  }
  const tentative={...state,incidents:next};
  validateIncidentState(tentative); // Transacción: recién ahora se aplican cambios.
  state.incidents=next;
  return {inserted,updated,unchanged,total:state.incidents.length};
}
export function resolutionMinutes(incident){
  return incident.resolvedAt===null?null:(Date.parse(incident.resolvedAt)-Date.parse(incident.openedAt))/60000;
}
const mean=values=>values.length?values.reduce((sum,v)=>sum+v,0)/values.length:null;
function rangeLastDays(today,days){
  const end=Date.parse(today+'T23:59:59.999Z');
  return {start:Date.parse(today+'T00:00:00.000Z')-(days-1)*ONE_DAY,end};
}
function within(date,range){const ts=Date.parse(date);return ts>=range.start&&ts<=range.end;}
export function incidentMetrics(state,today){
  ensureIncidentState(state);
  const set=state.incidents,last30=rangeLastDays(today,30),last90=rangeLastDays(today,90);
  const last30Opened=set.filter(it=>within(it.openedAt,last30));
  const last90Resolved=set.filter(it=>it.resolvedAt&&within(it.resolvedAt,last90));
  const open=set.filter(it=>it.resolvedAt===null);
  return {
    total:set.length,open:open.length,criticalOpen:open.filter(it=>it.priority==='P1'||it.priority==='P2').length,
    critical30:last30Opened.filter(it=>it.priority==='P1'||it.priority==='P2').length,
    opened30:last30Opened.length,resolved90:last90Resolved.length,
    mttr90:mean(last90Resolved.map(resolutionMinutes)),
    mttrHistorical:mean(set.filter(x=>x.resolvedAt).map(resolutionMinutes))
  };
}
export function incidentMonthly(state,today,months=6){
  ensureIncidentState(state);
  const endMonth=today.slice(0,7);
  const yy=Number(endMonth.slice(0,4)),mm=Number(endMonth.slice(5,7));
  const slots=Array.from({length:months},(_,i)=>{
    const date=new Date(Date.UTC(yy,mm-1-(months-1-i),1,12));
    return {month:date.toISOString().slice(0,7),opened:0,critical:0,resolved:0,mttr:null,_times:[]};
  });
  const index=new Map(slots.map(slot=>[slot.month,slot]));
  for(const it of state.incidents){
    const opening=index.get(it.openedAt.slice(0,7));
    if(opening){opening.opened++;if(['P1','P2'].includes(it.priority))opening.critical++;}
    if(it.resolvedAt){
      const closing=index.get(it.resolvedAt.slice(0,7));
      if(closing){closing.resolved++;closing._times.push(resolutionMinutes(it));}
    }
  }
  return slots.map(({_times,...s})=>({...s,mttr:mean(_times)}));
}
export function incidentByService(state){
  ensureIncidentState(state);
  return state.services.map(service=>{
    const records=state.incidents.filter(i=>i.serviceId===service.id);
    const resolved=records.filter(i=>i.resolvedAt!==null);
    return {serviceId:service.id,name:service.name,verticalId:service.verticalId,
      total:records.length,open:records.length-resolved.length,
      critical:records.filter(i=>i.priority==='P1'||i.priority==='P2').length,
      mttr:mean(resolved.map(resolutionMinutes))};
  });
}
export const SAMPLE_CSV='incident_id,service_id,priority,opened_at,resolved_at,summary\n'
 +'DEMO-NEW-201,s-core,P2,2026-11-18T08:00:00-03:00,2026-11-18T08:45:00-03:00,Incidente de ejemplo en plataforma crítica\n'
 +'DEMO-NEW-202,s-channel,P3,2026-11-18T10:30:00-03:00,,Incidente abierto de ejemplo\n';
