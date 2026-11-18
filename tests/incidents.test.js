import test from 'node:test';
import assert from 'node:assert/strict';
import {createDemo,makeEmpty} from '../src/governance/core.js';
import {
  ensureIncidentState,seedDemoIncidents,validateIncidentState,parseCSVRows,parseIncidentCSV,
  importIncidents,resolveIncident,resolutionMinutes,incidentMetrics,incidentMonthly,incidentByService
} from '../src/governance/incidents.js';
import {seedDemoPerformance,metricValue} from '../src/governance/performance.js';

const today='2026-11-18';
const base='incident_id,service_id,priority,opened_at,resolved_at,summary\n';
const row=(id,service='s-core',priority='P2',opened='2026-11-18T08:00:00-03:00',closed='2026-11-18T09:00:00-03:00',summary='Incidente de prueba')=>
  [id,service,priority,opened,closed,summary].join(',');
const workspace=()=>ensureIncidentState(createDemo());

test('datos ficticios: incidentes etiquetados y validados',()=>{
 const state=seedDemoIncidents(workspace());
 assert.equal(state.kind,'demo');
 assert.equal(state.incidents.length,12);
 assert.equal(state.incidents.filter(x=>x.resolvedAt===null).length,1);
 assert.doesNotThrow(()=>validateIncidentState(state));
 assert.equal(seedDemoIncidents(state).incidents.length,12);
});

test('parser CSV: coma, punto y coma, comillas dobles y BOM',()=>{
 const state=workspace();
 const parsed=parseIncidentCSV('\uFEFF'+base+'E001,s-core,P2,2026-11-18T08:00:00-03:00,2026-11-18T08:30:00-03:00,"Error, intermitente y ""recurrente"""\r\n',state);
 assert.equal(parsed.length,1);
 assert.equal(parsed[0].summary,'Error, intermitente y "recurrente"');
 const separated='incident_id;service_id;priority;opened_at;resolved_at;summary\r\nE002;s-core;P3;2026-11-18T08:00:00Z;;"Prueba; con delimitador"\r\n';
 assert.equal(parseIncidentCSV(separated,state)[0].summary,'Prueba; con delimitador');
 assert.equal(parseCSVRows('a,b\n"foo\nbar",baz').length,2);
});

test('importación transaccional, deduplicación y actualización de un caso abierto',()=>{
 const state=workspace();
 const open=row('E100','s-core','P1','2026-11-18T08:00:00-03:00','','Conectividad degradada');
 const a=parseIncidentCSV(base+open+'\n',state);
 assert.deepEqual(importIncidents(state,a),{inserted:1,updated:0,unchanged:0,total:1});
 assert.deepEqual(importIncidents(state,a),{inserted:0,updated:0,unchanged:1,total:1});
 const closed=row('E100','s-core','P1','2026-11-18T08:00:00-03:00','2026-11-18T08:42:00-03:00','Conectividad degradada');
 assert.deepEqual(importIncidents(state,parseIncidentCSV(base+closed+'\n',state)),{inserted:0,updated:1,unchanged:0,total:1});
 assert.equal(resolutionMinutes(state.incidents[0]),42);
 assert.throws(()=>importIncidents(state,parseIncidentCSV(base+open+'\n',state)),/reabrir/);
 assert.equal(state.incidents.length,1);
});

test('archivo inválido no agrega ni modifica registros',()=>{
 const state=workspace();
 const correct=row('GOOD');
 const invalid=row('WRONG','servicio-que-no-existe');
 assert.throws(()=>parseIncidentCSV(base+correct+'\n'+invalid,state),/service_id desconocido/);
 assert.equal(state.incidents.length,0);
 importIncidents(state,parseIncidentCSV(base+correct,state));
 const original=JSON.stringify(state.incidents);
 assert.throws(()=>importIncidents(state,parseIncidentCSV(base+row('GOOD','s-network'),state)),/Conflicto/);
 assert.equal(JSON.stringify(state.incidents),original);
});

test('validación: ids duplicados, fechas sin zona, cierre anterior, columnas faltantes',()=>{
 const state=workspace();
 assert.throws(()=>parseIncidentCSV(base+row('dup')+'\n'+row('dup'),state),/repetido/);
 assert.throws(()=>parseIncidentCSV(base+row('D1','s-core','P1','2026-11-18T08:00:00','2026-11-18T09:00:00-03:00'),state),/zona horaria/);
 assert.throws(()=>parseIncidentCSV(base+row('D1','s-core','P9'),state),/prioridad/);
 assert.throws(()=>parseIncidentCSV(base+row('D1','s-core','P1','2026-11-18T09:00:00-03:00','2026-11-18T08:00:00-03:00'),state),/anterior/);
 assert.throws(()=>parseIncidentCSV('incident_id,priority\nA,P1',state),/Faltan columnas/);
 assert.throws(()=>parseCSVRows('a,b\n"sin cierre,b'),/comillas sin cerrar/);
});

test('cierre manual valida fecha y conserva servicio, prioridad y ticket',()=>{
 const state=workspace();
 importIncidents(state,parseIncidentCSV(base+row('M1','s-channel','P2','2026-11-18T10:00:00-03:00','', 'Ticket abierto'),state));
 assert.throws(()=>resolveIncident(state,'M1','2026-11-18T10:15:00'),/zona horaria/);
 assert.throws(()=>resolveIncident(state,'M1','2026-11-18T09:59:00-03:00'),/anterior/);
 const closed=resolveIncident(state,'M1','2026-11-18T11:15:00-03:00');
 assert.equal(resolutionMinutes(closed),75);
 assert.equal(closed.serviceId,'s-channel');
 assert.throws(()=>resolveIncident(state,'M1','2026-11-18T12:00:00-03:00'),/ya tiene/);
});

test('MTTR solo considera resueltos, ventana 90d y P1/P2 últimos 30d',()=>{
 const state=workspace();
 const csv=base
 +row('A','s-core','P1','2026-11-17T08:00:00-03:00','2026-11-17T09:00:00-03:00','Ticket A')+'\n'
 +row('B','s-channel','P2','2026-11-18T08:00:00-03:00','2026-11-18T08:30:00-03:00','Ticket B')+'\n'
 +row('C','s-core','P3','2026-11-18T08:00:00-03:00','','Ticket C')+'\n'
 +row('OLD','s-network','P1','2026-07-01T08:00:00-03:00','2026-07-01T13:00:00-03:00','Ticket antiguo');
 importIncidents(state,parseIncidentCSV(csv,state));
 const data=incidentMetrics(state,today);
 assert.equal(data.total,4);assert.equal(data.open,1);assert.equal(data.critical30,2);
 assert.equal(data.resolved90,2);assert.equal(data.mttr90,45);
 assert.equal(data.mttrHistorical,130);
 assert.equal(metricValue(state,'mttr_90d',today),45);
 assert.equal(metricValue(state,'critical_incidents_30d',today),2);
 assert.equal(metricValue(state,'open_incidents',today),1);
 assert.equal(incidentByService(state).find(x=>x.serviceId==='s-core').open,1);
});

test('serie mensual: aperturas por mes y MTTR de cierres del mes',()=>{
 const state=workspace();
 const csv=base
 +row('X','s-core','P1','2026-10-31T23:00:00-03:00','2026-11-01T01:00:00-03:00','Cruza de mes')+'\n'
 +row('Y','s-core','P3','2026-11-12T10:00:00-03:00','2026-11-12T11:00:00-03:00','Noviembre');
 importIncidents(state,parseIncidentCSV(csv,state));
 const months=incidentMonthly(state,today);
 assert.equal(months.length,6);
 const oct=months.find(x=>x.month==='2026-10'),nov=months.find(x=>x.month==='2026-11');
 assert.equal(oct.opened,1);assert.equal(oct.resolved,0);assert.equal(oct.mttr,null);
 assert.equal(nov.opened,1);assert.equal(nov.resolved,2);assert.equal(nov.mttr,90);
});

test('KPI de incidentes no informan falsos ceros sin registros',()=>{
 const state=ensureIncidentState(seedDemoPerformance(createDemo()));
 assert.equal(metricValue(state,'mttr_90d',today),null);
 assert.equal(metricValue(state,'critical_incidents_30d',today),null);
 assert.equal(metricValue(state,'open_incidents',today),null);
 const filled=seedDemoIncidents(state);
 assert.ok(metricValue(filled,'mttr_90d',today)>0);
});

test('copias de seguridad migradas sin incidentes preservan datos operativos',()=>{
 const state=makeEmpty();
 ensureIncidentState(state);
 assert.deepEqual(state.incidents,[]);
 assert.doesNotThrow(()=>validateIncidentState(state));
 assert.equal(incidentMonthly(state,today).length,6);
});
