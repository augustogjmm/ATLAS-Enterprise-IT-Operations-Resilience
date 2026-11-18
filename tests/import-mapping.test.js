import test from 'node:test';
import assert from 'node:assert/strict';
import {createDemo} from '../src/governance/core.js';
import {seedDemoIncidents,incidentMetrics,incidentMonthly,incidentByService,selectIncidents,importIncidents} from '../src/governance/incidents.js';
import {seedDemoPerformance,metricValue,kpiResult,scopeWorkspace} from '../src/governance/performance.js';
import {
 inspectIncidentCSV,suggestColumnMapping,uniqueMappedValues,suggestServiceMap,
 suggestPriorityMap,canonicalTimestamp,parseMappedIncidentCSV
} from '../src/governance/import-mapping.js';

const day='2026-11-18',make=()=>seedDemoIncidents(seedDemoPerformance(createDemo()));
const configured=(header,rows,overrides={})=>{
 const state=make(),text=[header,...rows].join('\n'),p=inspectIncidentCSV(text);
 const columns=suggestColumnMapping(p.headers);
 return {state,text,config:{columns,services:suggestServiceMap(uniqueMappedValues(p.rows,columns.service_id),state.services),
   priorities:suggestPriorityMap(uniqueMappedValues(p.rows,columns.priority)),format:'iso',offset:'',...overrides}};
};

test('detección de encabezados con alias, acentos y guiones bajos',()=>{
 const names=['incident_id','service_id','priority','opened_at','resolved_at','summary'];
 assert.deepEqual(suggestColumnMapping(names),Object.fromEntries(names.map((x,i)=>[x,String(i)])));
 const foreign=['Issue key','Affected Service','Severity','Created Date','Resolution Date','Short Description'];
 assert.deepEqual(suggestColumnMapping(foreign),Object.fromEntries(names.map((x,i)=>[x,String(i)])));
 const spanish=['Número de incidente','Servicio','Prioridad','Fecha de apertura','Fecha de resolución','Descripción'];
 const map=suggestColumnMapping(spanish);
 assert.equal(map.incident_id,'0');assert.equal(map.resolved_at,'4');assert.equal(map.summary,'5');
});

test('archivo de columnas no canónicas con servicios por nombre y valores de prioridad',()=>{
 const {state,text,config}=configured(
 'Issue key,Service,Severity,Created Date,Resolution Date,Short Description',
 ['DEMO-EXT-01,Core transaccional,Alta,2026-11-18T10:00:00-03:00,2026-11-18T11:30:00-03:00,Prueba de contingencia',
  'DEMO-EXT-02,Canales digitales,Media,2026-11-18T11:00:00-03:00,,Prueba abierta']
 );
 assert.equal(config.services['Core transaccional'],'s-core');
 assert.equal(config.priorities.Alta,'');
 config.priorities={Alta:'P1',Media:'P3'};
 const output=parseMappedIncidentCSV(text,state,config);
 assert.deepEqual(output.map(x=>x.priority),['P1','P3']);
 assert.equal(output[0].serviceId,'s-core');
 assert.equal(output[1].resolvedAt,null);
 const result=importIncidents(state,output);
 assert.equal(result.inserted,2);
 assert.equal(importIncidents(state,output).unchanged,2);
});

test('importación local DD/MM/AAAA exige zona explícita, no la supone',()=>{
 const {state,text,config}=configured(
 'Número de incidente;Servicio;Prioridad;Fecha de apertura;Fecha de resolución;Descripción',
 ['D-100;Core transaccional;P2;18/11/2026 08:30;18/11/2026 10:00;Prueba local'],
 {format:'dmy'}
 );
 assert.throws(()=>parseMappedIncidentCSV(text,state,config),/zona horaria/);
 config.offset='-03:00';
 const parsed=parseMappedIncidentCSV(text,state,config);
 assert.equal(parsed[0].openedAt,'2026-11-18T08:30:00-03:00');
 assert.equal(parsed[0].resolvedAt,'2026-11-18T10:00:00-03:00');
 assert.equal(Date.parse(parsed[0].resolvedAt)-Date.parse(parsed[0].openedAt),90*60000);
});

test('ISO sin zona exige consentimiento y el valor con zona no se altera',()=>{
 assert.throws(()=>canonicalTimestamp('2026-11-18 10:30','iso',''),/zona horaria/);
 assert.equal(canonicalTimestamp('2026-11-18 10:30','iso','Z'),'2026-11-18T10:30:00Z');
 assert.equal(canonicalTimestamp('2026-11-18T10:30:00-03:00','iso','+02:00'),'2026-11-18T10:30:00-03:00');
 assert.throws(()=>canonicalTimestamp('31/02/2026 09:00','dmy','-03:00'),/Fecha inválida/);
 assert.throws(()=>canonicalTimestamp('18/11/2026 09:00','dmy','+15:00'),/UTC inválido/);
});

test('faltantes, columnas duplicadas y prioridades no interpretadas detienen la carga',()=>{
 const {state,text,config}=configured(
 'Issue key,Service,Severity,Created Date,Resolution Date,Short Description',
 ['E1,Core transaccional,Severe,2026-11-18T10:00:00Z,,Incidente ambiguo']
 );
 const before=state.incidents.length;
 assert.throws(()=>parseMappedIncidentCSV(text,state,config),/prioridad P1/);
 config.priorities.Severe='P1';
 config.columns.service_id=config.columns.priority;
 assert.throws(()=>parseMappedIncidentCSV(text,state,config),/dos campos/);
 assert.equal(state.incidents.length,before);
});

test('rechaza aliases de servicio sin asociación e importación parcial',()=>{
 const {state,text,config}=configured(
 'Ticket,Servicio,Prioridad,Apertura,Fecha de cierre,Asunto',
 ['BAD,Servicio no catalogado,P1,2026-11-18T10:00:00-03:00,,Prueba no válida']
 );
 config.columns.opened_at='3';
 assert.throws(()=>parseMappedIncidentCSV(text,state,config),/asigná un servicio/);
 assert.equal(state.incidents.length,12);
});

test('métricas y tendencias cambian al seleccionar vertical o servicio',()=>{
 const state=make();
 const all=incidentMetrics(state,day),network=incidentMetrics(state,day,{verticalId:'v-net'});
 assert.equal(all.total,12);
 assert.equal(network.total,3);
 assert.equal(network.open,1);
 assert.equal(incidentMetrics(state,day,{serviceId:'s-core'}).total,4);
 assert.equal(incidentMetrics(state,day,{verticalId:'v-net',serviceId:'s-core'}).total,0);
 assert.equal(incidentMonthly(state,day,6,{verticalId:'v-net'}).reduce((n,m)=>n+m.opened,0),3);
 assert.equal(incidentByService(state,{verticalId:'v-net'}).length,1);
 assert.equal(selectIncidents(state,{verticalId:'v-net'}).every(x=>x.serviceId==='s-network'),true);
});

test('KPI se segmentan por vertical y sus OKR evalúan el valor segmentado',()=>{
 const state=make();
 assert.equal(metricValue(state,'critical_unmanaged',day,{verticalId:'v-net'}),1);
 assert.equal(metricValue(state,'critical_unmanaged',day,{verticalId:'v-infra'}),0);
 assert.equal(metricValue(state,'open_incidents',day,{verticalId:'v-net'}),1);
 assert.equal(metricValue(state,'open_incidents',day,{verticalId:'v-cloud'}),0);
 assert.equal(scopeWorkspace(state,'v-net').services.length,1);
 assert.throws(()=>scopeWorkspace(state,'v-no-existe'),/no existe/);
 const kpi={id:'kpi-net',name:'Pendientes de Redes',metric:'open_incidents',target:0,owner:'Networking',verticalId:'v-net'};
 assert.equal(kpiResult(state,kpi,day).level,'critical');
 kpi.verticalId='v-cloud';
 assert.equal(kpiResult(state,kpi,day).level,'ok');
});

test('no interpreta ausencia de incidentes en un área como cumplimiento verde',()=>{
 const state=make();
 state.incidents=state.incidents.filter(i=>i.serviceId!=='s-itsm');
 assert.equal(metricValue(state,'mttr_90d',day,{verticalId:'v-ops'}),null);
 assert.equal(metricValue(state,'open_incidents',day,{verticalId:'v-ops'}),null);
});
