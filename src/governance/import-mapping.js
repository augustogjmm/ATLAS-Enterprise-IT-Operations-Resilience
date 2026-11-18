// V4 · Adaptador de exportaciones CSV ITSM con mapeo explícito y zona horaria verificable.
// No se conecta a ServiceNow, Jira ni ningún proveedor: transforma exclusivamente archivos locales.
import {parseCSVRows,parseIncidentCSV} from './incidents.js';

export const IMPORT_FIELDS=Object.freeze([
 {key:'incident_id',label:'Identificador de ticket',required:true},
 {key:'service_id',label:'Servicio afectado',required:true},
 {key:'priority',label:'Prioridad / severidad',required:true},
 {key:'opened_at',label:'Apertura',required:true},
 {key:'resolved_at',label:'Resolución',required:false},
 {key:'summary',label:'Descripción resumida',required:true}
]);
const ALIASES={
 incident_id:['incident_id','incident','incident number','number','issue key','issue id','key','ticket','ticket id','id del incidente','numero de incidente','nro incidente','id'],
 service_id:['service_id','service id','service','servicio','affected service','business service','servicio afectado','configuration item','ci'],
 priority:['priority','priority level','severity','prioridad','severidad','impact priority','priorite'],
 opened_at:['opened_at','opened','opened at','created','created at','created date','fecha apertura','fecha de apertura','fecha de creacion','inicio','fecha inicio'],
 resolved_at:['resolved_at','resolved','resolved at','closed at','closed','resolution date','resolved date','fecha de resolucion','fecha resolucion','fecha de cierre','fecha cierre'],
 summary:['summary','short description','short_description','title','subject','asunto','descripcion corta','descripcion','resumen','issue summary']
};
const normalized=s=>String(s??'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[_\-]+/g,' ').replace(/\s+/g,' ');
const present=s=>typeof s==='string'&&s.trim().length>0;
export function inspectIncidentCSV(text){
 const rows=parseCSVRows(text);
 const headers=rows[0].map(x=>x.trim());
 if(headers.some(x=>!x))throw new Error('El CSV tiene columnas sin nombre.');
 if(new Set(headers.map(normalized)).size!==headers.length)throw new Error('El encabezado contiene nombres de columna duplicados.');
 if(rows.length<2)throw new Error('El archivo no contiene filas de incidentes.');
 for(let i=1;i<rows.length;i++)if(rows[i].length!==headers.length)throw new Error('Fila '+(i+1)+': columnas inconsistentes.');
 return {headers,rows:rows.slice(1),previewRows:rows.slice(1,5)};
}
export function suggestColumnMapping(headers){
 const suggestions={};
 for(const field of IMPORT_FIELDS){
  const matches=headers.map((h,i)=>ALIASES[field.key].includes(normalized(h))?i:-1).filter(i=>i>=0);
  suggestions[field.key]=matches.length===1?String(matches[0]):'';
 }
 return suggestions;
}
export function uniqueMappedValues(rows,index,cap=50){
 if(index===''||index===null||index===undefined)return [];
 const i=Number(index);
 if(!Number.isSafeInteger(i)||i<0)return [];
 const values=[...new Set(rows.map(r=>r[i]?.trim()||'').filter(Boolean))];
 if(values.length>cap)throw new Error('Hay más de '+cap+' valores únicos. Normalizá el catálogo de servicios o prioridades antes de importar.');
 return values.sort((a,b)=>a.localeCompare(b,'es'));
}
export function suggestServiceMap(values,services){
 const mapping={};
 for(const raw of values){
  const exact=services.filter(s=>s.id===raw);
  const byName=services.filter(s=>normalized(s.name)===normalized(raw));
  mapping[raw]=(exact.length===1?exact:byName.length===1?byName:[])[0]?.id||'';
 }
 return mapping;
}
export function suggestPriorityMap(values){
 return Object.fromEntries(values.map(value=>[value,/^p[1-4]$/i.test(value.trim())?value.trim().toUpperCase():'']));
}
function strictTimezone(offset){
 if(offset==='Z')return 'Z';
 if(typeof offset!=='string'||!/^([+-])(\d{2}):(\d{2})$/.test(offset))throw new Error('Seleccioná una zona horaria explícita para las fechas sin zona.');
 const [,sign,hh,mm]=offset.match(/^([+-])(\d{2}):(\d{2})$/);
 if(Number(hh)>14||Number(mm)>59||(Number(hh)===14&&Number(mm)!==0))throw new Error('Desplazamiento UTC inválido.');
 return sign+hh+':'+mm;
}
function validParts(year,month,day,hour,min,sec){
 const t=new Date(Date.UTC(Number(year),Number(month)-1,Number(day),Number(hour),Number(min),Number(sec)));
 return t.getUTCFullYear()===Number(year)&&t.getUTCMonth()+1===Number(month)&&t.getUTCDate()===Number(day)&&t.getUTCHours()===Number(hour)&&t.getUTCMinutes()===Number(min)&&t.getUTCSeconds()===Number(sec);
}
export function canonicalTimestamp(raw,format='iso',offset=''){
 if(!present(raw))throw new Error('Fecha obligatoria ausente.');
 const value=raw.trim();
 const iso=value.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(Z|[+-]\d{2}:\d{2})?$/);
 const dmy=value.match(/^(\d{2})\/(\d{2})\/(\d{4})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
 if(format==='iso'&&iso){
   const [,year,month,day,hour,min,sec='00',zone]=iso;
   if(!validParts(year,month,day,hour,min,sec))throw new Error('Fecha inválida: '+value);
   const tz=zone?strictTimezone(zone):strictTimezone(offset);
   return year+'-'+month+'-'+day+'T'+hour+':'+min+':'+sec+tz;
 }
 if(format==='dmy'&&dmy){
   const [,day,month,year,hour,min,sec='00']=dmy;
   if(!validParts(year,month,day,hour,min,sec))throw new Error('Fecha inválida: '+value);
   return year+'-'+month+'-'+day+'T'+hour+':'+min+':'+sec+strictTimezone(offset);
 }
 throw new Error('Formato de fecha no compatible: '+value+'. Elegí ISO o DD/MM/AAAA.');
}
const csvQuote=value=>'"'+String(value??'').replace(/"/g,'""')+'"';
export function parseMappedIncidentCSV(text,state,config){
 const {headers,rows}=inspectIncidentCSV(text);
 const columns=config?.columns||{};
 const indices={};
 const selected=new Set();
 for(const field of IMPORT_FIELDS){
  const raw=columns[field.key];
  if((raw===undefined||raw==='')&&!field.required){indices[field.key]=-1;continue;}
  if(raw===undefined||raw===''||raw===null)throw new Error('Asigná una columna a «'+field.label+'».');
  const index=Number(raw);
  if(!Number.isSafeInteger(index)||index<0||index>=headers.length)throw new Error('Columna inválida para '+field.label+'.');
  if(selected.has(index))throw new Error('Una columna del CSV no puede utilizarse para dos campos.');
  selected.add(index);
  indices[field.key]=index;
 }
 const services=new Set(state.services.map(s=>s.id));
 const mapServices=config?.services||{},mapPriorities=config?.priorities||{};
 const prepared=[IMPORT_FIELDS.map(f=>f.key)];
 for(const [line,row] of rows.entries()){
  const rawService=row[indices.service_id].trim(),rawPriority=row[indices.priority].trim();
  const serviceId=mapServices[rawService],priority=mapPriorities[rawPriority];
  if(!services.has(serviceId))throw new Error('Fila '+(line+2)+': asigná un servicio válido a «'+rawService+'».');
  if(!['P1','P2','P3','P4'].includes(priority))throw new Error('Fila '+(line+2)+': asigná prioridad P1–P4 a «'+rawPriority+'».');
  const opened=canonicalTimestamp(row[indices.opened_at],config.format||'iso',config.offset||'');
  const originalResolved=indices.resolved_at===-1?'':row[indices.resolved_at];
  const closed=present(originalResolved)?canonicalTimestamp(originalResolved,config.format||'iso',config.offset||''):'';
  prepared.push([
   row[indices.incident_id].trim(),serviceId,priority,opened,closed,row[indices.summary].trim()
  ]);
 }
 const canonical=prepared.map(row=>row.map(csvQuote).join(',')).join('\n');
 return parseIncidentCSV(canonical,state);
}
