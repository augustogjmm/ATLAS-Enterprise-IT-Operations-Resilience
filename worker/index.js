import {makeEmpty, assertValidState} from '../src/governance/core.js';
import {ensurePerformanceState, validatePerformanceState} from '../src/governance/performance.js';
import {ensureIncidentState, validateIncidentState} from '../src/governance/incidents.js';
import {verifyAccessToken, AccessError} from './auth.js';
import {validateGovernanceWorkflow,GovernanceRuleError} from './governance-rules.js';

// API V5 aislada del frontend V4. No se publica ni conecta sin Access y D1.
const MAX_WORKSPACES_PER_TENANT = 10; // Límite deliberado de la demo en plan gratuito.
const MAX_WORKSPACES_TOTAL = 20; // Evita sumar organizaciones hasta agotar D1 Free.
const MAX_MEMBERS_PER_TENANT = 10; // Piloto pequeño; Access Free se mide por cuenta.
const MAX_AUDIT_EVENTS_TOTAL = 2000; // Evita crecimiento ilimitado; jamás borra evidencia.
const ROLES = Object.freeze({
  owner: ['read','write','members','privileged-members','audit','restore'],
  admin: ['read','write','members','audit','restore'],
  editor: ['read','write'],
  auditor: ['read','audit'],
  viewer: ['read']
});
export const can = (role, permission) => Boolean(ROLES[role]?.includes(permission));

class ApiError extends Error {
  constructor(message, status = 400, details = {}) { super(message); this.status = status; this.details = details; }
}
const headers = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer'
};
const reply = (body, status = 200) => new Response(JSON.stringify(body), {status, headers});
const problem = (message, status, details) => reply({error: message, ...(details || {})}, status);
function requirePermission(role, permission) {
  if (!can(role, permission)) throw new ApiError('Permiso insuficiente', 403);
}
function validId(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value);
}
function validEmail(value) {
  return typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
function normalizeState(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ApiError('Estado inválido');
  let state;
  try {
    state = structuredClone(input);
    assertValidState(state); // Preserva semántica y formato V4.
    ensurePerformanceState(state);
    ensureIncidentState(state);
    validatePerformanceState(state);
    validateIncidentState(state);
    validateGovernanceWorkflow(state);
  } catch (error) { throw new ApiError('Respaldo V4 inválido: ' + error.message,
    error instanceof GovernanceRuleError ? 422 : 400); }
  return state;
}
async function readBody(request) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || ''))
    throw new ApiError('Se requiere Content-Type application/json', 415);
  const hinted = Number(request.headers.get('content-length') || 0);
  if (hinted > 1024 * 1024) throw new ApiError('Máximo 1 MiB por operación', 413);
  // Rechazar el exceso mientras se lee, incluso si Content-Length fue omitido o falsificado.
  const reader=request.body?.getReader();
  if (!reader) throw new ApiError('Cuerpo JSON obligatorio',400);
  let bytes=0;const chunks=[];
  try {
    while (true) {
      const {done,value}=await reader.read();
      if (done) break;
      bytes+=value.byteLength;
      if (bytes>1024*1024) {await reader.cancel();throw new ApiError('Máximo 1 MiB por operación',413);}
      chunks.push(value);
    }
  } finally {reader.releaseLock();}
  const buffer=new Uint8Array(bytes);let offset=0;
  for (const chunk of chunks) {buffer.set(chunk,offset);offset+=chunk.byteLength;}
  let data;
  try { data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(buffer)); }
  catch { throw new ApiError('JSON inválido'); }
  // Todas las rutas mutadoras esperan propiedades de un objeto; null,
  // listas y escalares deben responder 400, nunca un error interno 500.
  if (!data || typeof data!=='object' || Array.isArray(data))
    throw new ApiError('El cuerpo JSON debe ser un objeto',400);
  return data;
}
async function memberFor(db, tenantId, identity) {
  if (!validId(tenantId)) throw new ApiError('Organización inválida', 404);
  const member = await db.prepare(
    "SELECT m.tenant_id, m.email, m.access_sub, m.role FROM atlas_memberships m JOIN atlas_tenants t ON t.id=m.tenant_id WHERE m.tenant_id=? AND m.email=? AND m.status='active' AND t.status='active'"
  ).bind(tenantId, identity.email).first();
  if (!member) throw new ApiError('Organización no autorizada', 403);
  if (member.access_sub && member.access_sub !== identity.sub) throw new ApiError('Identidad no coincide con la registrada', 403);
  if (!member.access_sub) {
    await db.prepare(
      "UPDATE atlas_memberships SET access_sub=?,updated_at=? "+
      "WHERE tenant_id=? AND email=? AND access_sub IS NULL AND status='active' "+
      "AND EXISTS(SELECT 1 FROM atlas_tenants WHERE id=? AND status='active')"
    ).bind(identity.sub, new Date().toISOString(), tenantId, identity.email, tenantId).run();
  }
  // Releer membresía y rol DESPUÉS de fijar el sujeto. Una revocación o
  // degradación entre la primera consulta y el bind no debe autorizar la ruta.
  const current=await db.prepare(
    "SELECT m.tenant_id,m.email,m.access_sub,m.role FROM atlas_memberships m "+
    "JOIN atlas_tenants t ON t.id=m.tenant_id "+
    "WHERE m.tenant_id=? AND m.email=? AND m.status='active' AND t.status='active'"
  ).bind(tenantId, identity.email).first();
  if(!current || current.access_sub!==identity.sub)
    throw new ApiError('Acceso revocado o identidad registrada para otra sesión',403);
  return current;
}
async function getWorkspace(db, tenantId, id) {
  if (!validId(id)) throw new ApiError('Workspace inválido', 404);
  const row = await db.prepare(
    'SELECT id,tenant_id,name,revision,state_json,created_at,updated_at,updated_by FROM atlas_workspaces WHERE id=? AND tenant_id=?'
  ).bind(id, tenantId).first();
  if (!row) throw new ApiError('Workspace inexistente', 404);
  return row;
}


function liveMembershipSql(permission){
  // El permiso se verifica nuevamente EN la sentencia de escritura D1.
  // Evita que una petición autorizada inicialmente escriba tras revocación concurrente.
  const roles=permission==='restore'?"'owner','admin'":"'owner','admin','editor'";
  return 'EXISTS(SELECT 1 FROM atlas_memberships m JOIN atlas_tenants t ON t.id=m.tenant_id '+
    "WHERE m.tenant_id=? AND m.email=? AND m.access_sub=? AND m.status='active' "+
    "AND t.status='active' AND m.role IN ("+roles+"))";
}
const liveMembershipArgs=(tenantId,identity)=>[tenantId,identity.email,identity.sub];
async function requireStillAllowed(db,tenantId,identity,permission){
  const row=await db.prepare(
    "SELECT m.role FROM atlas_memberships m JOIN atlas_tenants t ON t.id=m.tenant_id "+
    "WHERE m.tenant_id=? AND m.email=? AND m.access_sub=? AND m.status='active' AND t.status='active'"
  ).bind(...liveMembershipArgs(tenantId,identity)).first();
  if(!row||!can(row.role,permission))
    throw new ApiError('Acceso revocado o permisos modificados durante la operación',403);
}

// Gestión de membresías: control de privilegios efectuado en el mismo SQL de escritura.
// El guard compara el rol ACTUAL del actor y del destinatario (no un snapshot anterior).
const memberChangeGuard =
  "EXISTS(SELECT 1 FROM atlas_memberships actor JOIN atlas_tenants tenant ON tenant.id=actor.tenant_id "+
  "WHERE actor.tenant_id=? AND actor.email=? AND actor.access_sub=? "+
  "AND actor.status='active' AND tenant.status='active' AND actor.role IN ('owner','admin') "+
  "AND (actor.role='owner' OR (? NOT IN ('owner','admin') AND "+
  "NOT EXISTS(SELECT 1 FROM atlas_memberships recipient "+
  "WHERE recipient.tenant_id=? AND recipient.email=? AND recipient.role IN ('owner','admin')))))";
const memberChangeArgs=(tenantId,identity,target,role)=>[
  tenantId,identity.email,identity.sub,role,tenantId,target
];
// Un miembro ya activo puede actualizar su rol; un miembro nuevo o revocado
// solo puede activarse cuando queda espacio. El guard corre en la transacción.
const memberCapacityGuard =
  "(? <> 'active' OR EXISTS(SELECT 1 FROM atlas_memberships current "+
  "WHERE current.tenant_id=? AND current.email=? AND current.status='active') "+
  "OR (SELECT COUNT(*) FROM atlas_memberships m "+
  "WHERE m.tenant_id=? AND m.status='active') < ?)";
const memberCapacityArgs=(tenantId,target,status)=>[
  status,tenantId,target,tenantId,MAX_MEMBERS_PER_TENANT
];

// Al alcanzar el tope de evidencia, congelar las escrituras antes que borrar
// registros de auditoría. Las lecturas continúan funcionando.
const auditCapacitySql='(SELECT COUNT(*) FROM atlas_audit_events) < ?';
async function requireAuditCapacity(db){
  const row=await db.prepare('SELECT COUNT(*) AS total FROM atlas_audit_events').first();
  if(row?.total>=MAX_AUDIT_EVENTS_TOTAL)
    throw new ApiError('Límite global de '+MAX_AUDIT_EVENTS_TOTAL+
      ' eventos de auditoría: escrituras bloqueadas sin borrado automático',429);
}

function storeRevision(db,tenantId,workspaceId,revision,email,at,auditId) {
  return db.prepare(
    'INSERT INTO atlas_workspace_revisions(tenant_id,workspace_id,revision,state_json,actor_email,created_at) '+
    'SELECT ?,?,?,w.state_json,?,? FROM atlas_workspaces w WHERE w.id=? AND w.tenant_id=? AND w.revision=? '+
    'AND EXISTS(SELECT 1 FROM atlas_audit_events WHERE id=?)'
  ).bind(tenantId,workspaceId,revision,email,at,workspaceId,tenantId,revision,auditId);
}
function pruneRevisions(db,tenantId,workspaceId,auditId) {
  return db.prepare(
    'DELETE FROM atlas_workspace_revisions WHERE tenant_id=? AND workspace_id=? '+
    'AND EXISTS(SELECT 1 FROM atlas_audit_events WHERE id=?) '+
    'AND revision NOT IN(SELECT revision FROM atlas_workspace_revisions WHERE tenant_id=? AND workspace_id=? ORDER BY revision DESC LIMIT 5)'
  ).bind(tenantId,workspaceId,auditId,tenantId,workspaceId);
}
const publicWorkspace = row => ({id:row.id,name:row.name,revision:row.revision,
  state:JSON.parse(row.state_json),updatedAt:row.updated_at,updatedBy:row.updated_by});
function originCheck(request) {
  if (!['POST','PUT','PATCH','DELETE'].includes(request.method)) return;
  // El header custom evita envíos desde formularios cross-site y es exigido también a clientes API.
  // No confiar exclusivamente en la cookie de Cloudflare Access como defensa CSRF.
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) throw new ApiError('Origen no permitido', 403);
  if (request.headers.get('X-Atlas-CSRF') !== 'v5')
    throw new ApiError('Falta control CSRF de ATLAS',403);
  const site=request.headers.get('Sec-Fetch-Site');
  if (site && !['same-origin','none'].includes(site))
    throw new ApiError('Solicitud desde otro origen',403);
}
function extractPath(pathname) {
  const path = pathname.split('/').filter(Boolean);
  // /api/v1/tenants/:tenantId/(workspaces|members|audit)
  if (path[0] !== 'api' || path[1] !== 'v1') throw new ApiError('Ruta inexistente', 404);
  return path;
}

// Solo para inyección de dependencias en pruebas. Producción llama sin parámetros.
export function createHandler({verify = verifyAccessToken} = {}) {
  return async function handle(request, env) {
    try {
      if (!env?.ATLAS_DB) throw new ApiError('Persistencia V5 no configurada', 503);
      originCheck(request);
      const identity = await verify(request, env);
      const db = env.ATLAS_DB;
      const path = extractPath(new URL(request.url).pathname);
      if (path.length === 3 && path[2] === 'session' && request.method === 'GET') {
        const rows = await db.prepare(
          "SELECT m.tenant_id,t.name,m.role FROM atlas_memberships m JOIN atlas_tenants t ON t.id=m.tenant_id WHERE m.email=? AND m.status='active' AND t.status='active' AND (m.access_sub IS NULL OR m.access_sub=?) ORDER BY t.name"
        ).bind(identity.email, identity.sub).all();
        return reply({identity:{email:identity.email,name:identity.name},tenants:rows.results});
      }
      if (path.length < 5 || path[2] !== 'tenants') throw new ApiError('Ruta inexistente', 404);
      const tenantId=path[3], resource=path[4];
      const member=await memberFor(db, tenantId, identity);
      if (resource==='workspaces' && path.length===5 && request.method==='GET') {
        requirePermission(member.role,'read');
        const rows=await db.prepare(
          'SELECT id,name,revision,updated_at,updated_by FROM atlas_workspaces WHERE tenant_id=? ORDER BY updated_at DESC LIMIT 100'
        ).bind(tenantId).all();
        return reply({workspaces:rows.results,role:member.role});
      }
      if (resource==='workspaces' && path.length===5 && request.method==='POST') {
        requirePermission(member.role,'write');
        const data=await readBody(request);
        const name=typeof data.name==='string'?data.name.trim():'';
        if (!name || name.length > 100) throw new ApiError('Nombre de workspace inválido');
        const state=normalizeState(data.state ?? makeEmpty());
        const id=crypto.randomUUID(),auditId=crypto.randomUUID(),now=new Date().toISOString();
        const created=await db.batch([
          db.prepare(
            'INSERT INTO atlas_workspaces(id,tenant_id,name,revision,state_json,created_by,updated_by,created_at,updated_at) '+
            'SELECT ?,?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM atlas_workspaces WHERE tenant_id=?) < ? '+
            'AND (SELECT COUNT(*) FROM atlas_workspaces) < ? AND '+auditCapacitySql+
            ' AND '+liveMembershipSql('write')
          ).bind(id,tenantId,name,1,JSON.stringify(state),identity.email,identity.email,now,now,
            tenantId,MAX_WORKSPACES_PER_TENANT,MAX_WORKSPACES_TOTAL,
            MAX_AUDIT_EVENTS_TOTAL,...liveMembershipArgs(tenantId,identity)),
          db.prepare(
            'INSERT INTO atlas_audit_events(id,tenant_id,workspace_id,actor_email,action,previous_revision,new_revision,metadata_json,occurred_at) '+
            'SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM atlas_workspaces WHERE id=? AND tenant_id=?)'
          ).bind(auditId,tenantId,id,identity.email,'workspace.created',null,1,JSON.stringify({name}),now,id,tenantId),
          storeRevision(db,tenantId,id,1,identity.email,now,auditId)
        ]);
        if (created[0]?.meta?.changes !== 1){
          await requireStillAllowed(db,tenantId,identity,'write');
          await requireAuditCapacity(db);
          const total=await db.prepare('SELECT COUNT(*) AS total FROM atlas_workspaces').first();
          if(total?.total>=MAX_WORKSPACES_TOTAL)
            throw new ApiError('Se alcanzó el límite global de '+MAX_WORKSPACES_TOTAL+' workspaces de la demo gratuita',429);
          throw new ApiError('Se alcanzó el límite de '+MAX_WORKSPACES_PER_TENANT+' workspaces por organización',429);
        }
        return reply({id,name,revision:1},201);
      }
      if (resource==='workspaces' && path.length===6 && request.method==='GET') {
        requirePermission(member.role,'read');
        return reply(publicWorkspace(await getWorkspace(db,tenantId,path[5])));
      }
      if (resource==='workspaces' && path.length===6 && request.method==='PUT') {
        requirePermission(member.role,'write');
        const data=await readBody(request);
        const expected=data.revision;
        if (!Number.isSafeInteger(expected) || expected<1) throw new ApiError('Revisión esperada obligatoria');
        const current=await getWorkspace(db,tenantId,path[5]);
        if(current.revision!==expected)
          throw new ApiError('Conflicto de edición: el workspace ya tiene una revisión más reciente',409);
        const state=normalizeState(data.state);
        try {validateGovernanceWorkflow(state,JSON.parse(current.state_json));}
        catch(error) {
          if(error instanceof GovernanceRuleError)throw new ApiError(error.message,422);
          throw error;
        }
        const now=new Date().toISOString(),newRevision=expected+1,auditId=crypto.randomUUID();
        // D1.batch ejecuta las instrucciones en una única transacción.
        // Verificar la revisión ANTES de actualizar evita auditar escrituras rechazadas.
        const outcome=await db.batch([
          db.prepare('INSERT INTO atlas_audit_events(id,tenant_id,workspace_id,actor_email,action,previous_revision,new_revision,metadata_json,occurred_at) '+
            'SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM atlas_workspaces WHERE id=? AND tenant_id=? AND revision=?) '+
            'AND '+liveMembershipSql('write')+' AND '+auditCapacitySql)
            .bind(auditId,tenantId,path[5],identity.email,'workspace.updated',expected,newRevision,
              JSON.stringify({kind:state.kind,risks:state.risks.length,actions:state.actions.length,incidents:state.incidents.length}),
              now,path[5],tenantId,expected,...liveMembershipArgs(tenantId,identity),
              MAX_AUDIT_EVENTS_TOTAL),
          db.prepare('UPDATE atlas_workspaces SET state_json=?,revision=revision+1,updated_by=?,updated_at=? '+
            'WHERE id=? AND tenant_id=? AND revision=? AND '+liveMembershipSql('write')+
            ' AND EXISTS(SELECT 1 FROM atlas_audit_events WHERE id=?)')
            .bind(JSON.stringify(state),identity.email,now,path[5],tenantId,expected,
              ...liveMembershipArgs(tenantId,identity),auditId),
          storeRevision(db,tenantId,path[5],newRevision,identity.email,now,auditId),
          pruneRevisions(db,tenantId,path[5],auditId)
        ]);
        if (outcome[1]?.meta?.changes !== 1){
          await requireStillAllowed(db,tenantId,identity,'write');
          await requireAuditCapacity(db);
          throw new ApiError('Conflicto de edición: recargá el workspace antes de guardar',409);
        }
        return reply({id:path[5],revision:newRevision,updatedAt:now});
      }
      if (resource==='workspaces' && path.length===7 && path[6]==='revisions' && request.method==='GET') {
        requirePermission(member.role,'audit');
        await getWorkspace(db,tenantId,path[5]);
        const rows=await db.prepare(
          'SELECT revision,actor_email,created_at FROM atlas_workspace_revisions WHERE tenant_id=? AND workspace_id=? ORDER BY revision DESC LIMIT 5'
        ).bind(tenantId,path[5]).all();
        return reply({workspaceId:path[5],revisions:rows.results,retained:5});
      }
      if (resource==='workspaces' && path.length===9 && path[6]==='revisions' && path[8]==='restore' && request.method==='PUT') {
        requirePermission(member.role,'restore');
        const target=Number(path[7]);
        if (!Number.isSafeInteger(target) || target<1) throw new ApiError('Revisión histórica inválida',400);
        const data=await readBody(request);
        const expected=data.revision;
        if (!Number.isSafeInteger(expected) || expected<1) throw new ApiError('Revisión actual esperada obligatoria',400);
        await getWorkspace(db,tenantId,path[5]);
        const historic=await db.prepare(
          'SELECT revision FROM atlas_workspace_revisions WHERE tenant_id=? AND workspace_id=? AND revision=?'
        ).bind(tenantId,path[5],target).first();
        if (!historic) throw new ApiError('La revisión no está en el historial retenido',404);
        const now=new Date().toISOString(),newRevision=expected+1,auditId=crypto.randomUUID();
        const results=await db.batch([
          db.prepare(
            'INSERT INTO atlas_audit_events(id,tenant_id,workspace_id,actor_email,action,previous_revision,new_revision,metadata_json,occurred_at) '+
            'SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM atlas_workspaces WHERE tenant_id=? AND id=? AND revision=?) '+
            'AND '+liveMembershipSql('restore')+
            ' AND EXISTS(SELECT 1 FROM atlas_workspace_revisions WHERE tenant_id=? AND workspace_id=? AND revision=?)'+
            ' AND '+auditCapacitySql
          ).bind(auditId,tenantId,path[5],identity.email,'workspace.restored',expected,newRevision,
            JSON.stringify({sourceRevision:target}),now,tenantId,path[5],expected,
            ...liveMembershipArgs(tenantId,identity),tenantId,path[5],target,
            MAX_AUDIT_EVENTS_TOTAL),
          db.prepare(
            'UPDATE atlas_workspaces SET state_json=(SELECT state_json FROM atlas_workspace_revisions WHERE tenant_id=? AND workspace_id=? AND revision=?), '+
            'revision=revision+1,updated_by=?,updated_at=? WHERE id=? AND tenant_id=? AND revision=? '+
            'AND '+liveMembershipSql('restore')+
            ' AND EXISTS(SELECT 1 FROM atlas_workspace_revisions WHERE tenant_id=? AND workspace_id=? AND revision=?)'+
            ' AND EXISTS(SELECT 1 FROM atlas_audit_events WHERE id=?)'
          ).bind(tenantId,path[5],target,identity.email,now,path[5],tenantId,expected,
            ...liveMembershipArgs(tenantId,identity),tenantId,path[5],target,auditId),
          storeRevision(db,tenantId,path[5],newRevision,identity.email,now,auditId),
          pruneRevisions(db,tenantId,path[5],auditId)
        ]);
        if (results[1]?.meta?.changes !== 1){
          await requireStillAllowed(db,tenantId,identity,'restore');
          // Una depuración concurrente debe fallar sin escribir NULL ni auditoría.
          const stillHistoric=await db.prepare(
            'SELECT 1 AS present FROM atlas_workspace_revisions WHERE tenant_id=? AND workspace_id=? AND revision=?'
          ).bind(tenantId,path[5],target).first();
          if(!stillHistoric)
            throw new ApiError('La revisión histórica ya no está disponible',409);
          await requireAuditCapacity(db);
          throw new ApiError('Conflicto de edición: recargá el workspace antes de restaurar',409);
        }
        return reply({id:path[5],revision:newRevision,restoredFrom:target,updatedAt:now});
      }
      // Exportación paginada sin servicios adicionales ni pérdida de eventos antiguos.
      // Cursor compuesto: orden estable incluso cuando dos eventos comparten timestamp.
      if (resource==='audit' && path.length===6 && path[5]==='export' && request.method==='GET') {
        requirePermission(member.role,'audit');
        const params=new URL(request.url).searchParams;
        const beforeAt=params.get('beforeAt'),beforeId=params.get('beforeId');
        if ((beforeAt===null)!==(beforeId===null) ||
          (beforeAt!==null && (!/^\\d{4}-\\d\\d-\\d\\dT\\d\\d:\\d\\d:\\d\\d(?:\\.\\d+)?Z$/.test(beforeAt) ||
            beforeId.length===0 || beforeId.length>100)))
          throw new ApiError('Cursor de auditoría inválido',400);
        const sql='SELECT id,workspace_id,actor_email,action,previous_revision,new_revision,metadata_json,occurred_at FROM atlas_audit_events WHERE tenant_id=?'+
          (beforeAt===null?'':' AND (occurred_at < ? OR (occurred_at = ? AND id < ?))')+
          ' ORDER BY occurred_at DESC,id DESC LIMIT 101';
        const args=beforeAt===null?[tenantId]:[tenantId,beforeAt,beforeAt,beforeId];
        const records=(await db.prepare(sql).bind(...args).all()).results;
        const hasMore=records.length>100;
        const page=records.slice(0,100);
        const last=page.at(-1);
        return reply({events:page.map(x=>({...x,metadata:JSON.parse(x.metadata_json),metadata_json:undefined})),
          nextCursor:hasMore?{beforeAt:last.occurred_at,beforeId:last.id}:null});
      }
      if (resource==='audit' && path.length===5 && request.method==='GET') {
        requirePermission(member.role,'audit');
        const events=await db.prepare(
          'SELECT id,workspace_id,actor_email,action,previous_revision,new_revision,metadata_json,occurred_at FROM atlas_audit_events WHERE tenant_id=? ORDER BY occurred_at DESC,id DESC LIMIT 100'
        ).bind(tenantId).all();
        return reply({events:events.results.map(x=>({...x,metadata:JSON.parse(x.metadata_json),metadata_json:undefined}))});
      }
      if (resource==='members' && path.length===5 && request.method==='GET') {
        requirePermission(member.role,'audit');
        const rows=await db.prepare(
          'SELECT email,role,status,created_at,updated_at FROM atlas_memberships WHERE tenant_id=? ORDER BY email LIMIT 100'
        ).bind(tenantId).all();
        return reply({members:rows.results});
      }
      if (resource==='members' && path.length===6 && request.method==='PUT') {
        requirePermission(member.role,'members');
        let email;
        try { email=decodeURIComponent(path[5]).trim().toLowerCase(); }
        catch { throw new ApiError('Correo inválido',400); }
        if (!validEmail(email)) throw new ApiError('Correo inválido');
        if (email===identity.email) throw new ApiError('No podés modificar tu propio acceso',403);
        const data=await readBody(request);
        if (!Object.keys(ROLES).includes(data.role) || !['active','revoked'].includes(data.status))
          throw new ApiError('Rol o estado inválido');
        const prior=await db.prepare('SELECT role FROM atlas_memberships WHERE tenant_id=? AND email=?')
          .bind(tenantId,email).first();
        if ((['owner','admin'].includes(data.role) || ['owner','admin'].includes(prior?.role)) &&
            !can(member.role,'privileged-members'))
          throw new ApiError('Solo owner puede administrar roles privilegiados',403);
        const now=new Date().toISOString(),auditId=crypto.randomUUID();
        const guardArgs=memberChangeArgs(tenantId,identity,email,data.role);
        const capacityArgs=memberCapacityArgs(tenantId,email,data.status);
        const results=await db.batch([
          // Capturar el estado ANTERIOR dentro de la misma transacción y no desde
          // el pre-chequeo (que podría haber quedado desactualizado).
          db.prepare(
            "INSERT INTO atlas_audit_events(id,tenant_id,workspace_id,actor_email,action,metadata_json,occurred_at) "+
            "SELECT ?,?,NULL,?,'membership.changed',"+
            "json_object('target',?,'previousRole',"+
            "(SELECT role FROM atlas_memberships WHERE tenant_id=? AND email=?),"+
            "'previousStatus',"+
            "(SELECT status FROM atlas_memberships WHERE tenant_id=? AND email=?),"+
            "'role',?,'status',?),? WHERE "+memberChangeGuard+" AND "+memberCapacityGuard+
            " AND "+auditCapacitySql
          ).bind(auditId,tenantId,identity.email,email,tenantId,email,
            tenantId,email,data.role,data.status,now,...guardArgs,...capacityArgs,
            MAX_AUDIT_EVENTS_TOTAL),
          db.prepare(
            "INSERT INTO atlas_memberships(tenant_id,email,access_sub,role,status,created_at,updated_at) "+
            "SELECT ?,?,NULL,?,?,?,? WHERE "+memberChangeGuard+" AND "+memberCapacityGuard+
            " AND EXISTS(SELECT 1 FROM atlas_audit_events WHERE id=?) "+
            "ON CONFLICT(tenant_id,email) DO UPDATE SET role=excluded.role,status=excluded.status,updated_at=excluded.updated_at "+
            "WHERE "+memberChangeGuard+" AND "+memberCapacityGuard+
            " AND EXISTS(SELECT 1 FROM atlas_audit_events WHERE id=?)"
          ).bind(tenantId,email,data.role,data.status,now,now,...guardArgs,...capacityArgs,
            auditId,...guardArgs,...capacityArgs,auditId)
        ]);
        if(results[1]?.meta?.changes!==1){
          await requireStillAllowed(db,tenantId,identity,'members');
          const latest=await db.prepare('SELECT role,status FROM atlas_memberships WHERE tenant_id=? AND email=?')
            .bind(tenantId,email).first();
          if(!can(member.role,'privileged-members') &&
              (['owner','admin'].includes(data.role)||['owner','admin'].includes(latest?.role)))
            throw new ApiError('Solo owner puede administrar roles privilegiados',403);
          if(data.status==='active'&&latest?.status!=='active'){
            const usage=await db.prepare(
              "SELECT COUNT(*) AS active_count FROM atlas_memberships WHERE tenant_id=? AND status='active'"
            ).bind(tenantId).first();
            if(usage?.active_count>=MAX_MEMBERS_PER_TENANT)
              throw new ApiError('Se alcanzó el límite de '+MAX_MEMBERS_PER_TENANT+' usuarios activos por organización gratuita',429);
          }
          await requireAuditCapacity(db);
          throw new ApiError('Permisos de administración modificados durante la operación',403);
        }
        if(results[0]?.meta?.changes!==1)
          throw new ApiError('No se pudo verificar la auditoría de membresía',500);
        return reply({email,role:data.role,status:data.status});
      }
      throw new ApiError('Ruta o método inexistente',404);
    } catch (error) {
      const status=error instanceof AccessError || error instanceof ApiError ? error.status : 500;
      if (status===500) console.error('ATLAS V5 API error:', error?.name || 'Unknown');
      return problem(status===500?'Error interno de ATLAS':error.message,status,error?.details);
    }
  };
}
export default { fetch: createHandler() };
