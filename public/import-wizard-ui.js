// Editor guiado para mapear columnas y equivalencias. No procesa datos en red.
import {IMPORT_FIELDS,uniqueMappedValues,suggestServiceMap,suggestPriorityMap} from './lib/governance/import-mapping.js';

export function importWizardView(draft,state,{esc}){
 const quote=v=>esc(v??'');
 const select=(name,options,current)=>'<select name="'+name+'" aria-label="'+quote(name)+'">'+options.map(([value,label])=>'<option value="'+quote(value)+'"'+(String(current)===String(value)?' selected':'')+'>'+quote(label)+'</option>').join('')+'</select>';
 const options=[['','— Seleccionar columna —'],...draft.headers.map((h,i)=>[String(i),h])];
 const columns=draft.columns||{};
 const services=uniqueMappedValues(draft.rows,columns.service_id);
 const priorities=uniqueMappedValues(draft.rows,columns.priority);
 const defaultService=suggestServiceMap(services,state.services);
 const defaultPriority=suggestPriorityMap(priorities);
 const serviceRows=services.map((raw,i)=>{
  const current=(draft.services&&draft.services[raw]!==undefined)?draft.services[raw]:defaultService[raw];
  return '<label class="mapping-row"><span class="mapping-raw">'+quote(raw)+'</span>'+select('service_'+i,[['','— Relacionar servicio —'],...state.services.map(s=>[s.id,s.name+' ('+s.id+')'])],current)+'</label>';
 }).join('');
 const priorityRows=priorities.map((raw,i)=>{
  const current=(draft.priorities&&draft.priorities[raw]!==undefined)?draft.priorities[raw]:defaultPriority[raw];
  return '<label class="mapping-row"><span class="mapping-raw">'+quote(raw)+'</span>'+select('priority_'+i,[['','— Interpretación pendiente —'],...['P1','P2','P3','P4'].map(p=>[p,p])],current)+'</label>';
 }).join('');
 const header='<div class="mapping-wizard-top"><div><span class="executive-overline">IMPORTACIÓN CONTROLADA / PASO 1 DE 2</span><h4>Validar el mapeo del CSV</h4><p>Detectamos '+draft.rows.length+' fila(s). Confirmá columnas, servicios, prioridades y el tratamiento de fechas antes de incorporar los registros.</p></div><button type="button" class="mini-button secondary" data-command="cancel-incident-import">Cancelar</button></div>';
 const mappingFields=IMPORT_FIELDS.map(field=>'<label class="mapping-field"><span>'+quote(field.label)+(field.required?' *':' (opcional)')+'</span>'+select('col_'+field.key,options,columns[field.key]??'')+'</label>').join('');
 const formatOptions=[['iso','ISO: AAAA-MM-DD HH:mm o formato ISO con zona'],['dmy','Local: DD/MM/AAAA HH:mm']];
 const selectedFormat=draft.format||'iso';
 const timezone=draft.offset||'';
 const dateOptions='<div class="mapping-dates"><label class="mapping-field"><span>Formato del archivo</span>'+select('date_format',formatOptions,selectedFormat)+'</label><label class="mapping-field"><span>Zona para timestamps sin zona</span><input type="text" name="timezone_offset" value="'+quote(timezone)+'" placeholder="-03:00, Z, +01:00" maxlength="6"></label></div>';
 const previewRows=draft.rows.slice(0,3).map(row=>'<tr>'+draft.headers.map((h,i)=>'<td>'+quote(row[i]||'')+'</td>').join('')+'</tr>').join('');
 const table='<div class="table-wrap mapping-sample"><table class="data-table"><thead><tr>'+draft.headers.map(h=>'<th>'+quote(h)+'</th>').join('')+'</tr></thead><tbody>'+previewRows+'</tbody></table></div>';
 return '<section class="mapping-wizard" aria-label="Mapeo de incidentes">'+header+
 '<form id="incident-mapping-form"><div class="mapping-subtitle">01 · Columnas de origen</div><div class="mapping-columns">'+mappingFields+'</div>'+
 '<div class="mapping-subtitle">02 · Fechas sin zona horaria</div>'+dateOptions+
 '<p class="mapping-hint">Si el archivo ya incluye Z o un desplazamiento UTC, se respeta. Si no, escribí explícitamente la zona que corresponde al registro. No asumimos horarios locales.</p>'+
 '<div class="mapping-subtitle">03 · Asociar valores del archivo</div>'+
 '<div class="mapping-values"><div><h5>Servicio del archivo → catálogo ATLAS</h5>'+ (services.length?serviceRows:'<p class="mapping-hint">Elegí primero la columna de servicio.</p>')+'</div>'+
 '<div><h5>Prioridad original → P1–P4</h5>'+(priorities.length?priorityRows:'<p class="mapping-hint">Elegí primero la columna de prioridad.</p>')+'</div></div>'+
 '<div class="mapping-subtitle">04 · Previsualización de las primeras filas</div>'+table+
 '<div class="mapping-wizard-foot"><p>No se guardará ninguna fila hasta superar todas las validaciones y confirmar el lote completo.</p>'+
 '<button class="button button-primary" type="button" data-command="apply-incident-import">Validar e importar CSV</button></div></form></section>';
}
