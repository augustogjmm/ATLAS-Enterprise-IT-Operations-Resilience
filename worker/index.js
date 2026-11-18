import {makeEmpty, assertValidState} from '../src/governance/core.js';
import {ensurePerformanceState, validatePerformanceState} from '../src/governance/performance.js';
import {ensureIncidentState, validateIncidentState} from '../src/governance/incidents.js';
import {verifyAccessToken, AccessError} from './auth.js';

// API V5 aislada del frontend V4. No se publica ni conecta sin Access y D1.
const ROLES = Object.freeze({
  owner: ['read','write','members','privileged-members','audit'],
  admin: ['read','write','members','audit'],
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
  } catch (error) { throw new ApiError('Respaldo V4 inválido: ' + error.message); }
  return state;
}
async function readBody(request) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || ''))
    throw new ApiError('Se requiere Content-Type application/json', 415);
  const hinted = Number(request.headers.get('content-length') || 0);
  if (hinted > 1024 * 1024) throw new ApiError('Máximo 1 MiB por operación', 413);
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > 1024 * 1024) throw new ApiError('Máximo 1 MiB por operación', 413);
  try { return JSON.parse(raw); } catch { throw new ApiError('JSON inválido'); }
}
async function memberFor(db, tenantId, identity) {
  if (!validId(tenantId)) throw new ApiError('Organización inválida', 404);
  const member = await db.prepare(
    "SELECT m.tenant_id, m.email, m.access_sub, m.role FROM atlas_memberships m JOIN atlas_tenants t ON t.id=m.tenant_id WHERE m.tenant_id=? AND m.email=? AND m.status='active' AND t.status='active'"
  ).bind(tenantId, identity.email).first();
  if (!member) throw new ApiError('Organización no autorizada', 403);
  if (member.access_sub && member.access_sub !== identity.sub) throw new ApiError('Identidad no coincide con la registrada', 403);
  if (!member.access_sub) {
    await db.prepare("UPDATE atlas_memberships SET access_sub=?,updated_at=? WHERE tenant_id=? AND email=? AND access_sub IS NULL")
      .bind(identity.sub, new Date().toISOString(), tenantId, identity.email).run();
    const pinned = await db.prepare('SELECT access_sub FROM atlas_memberships WHERE tenant_id=? AND email=?')
      .bind(tenantId, identity.email).first();
    if (pinned?.access_sub !== identity.sub) throw new ApiError('Identidad registrada para otro inicio de sesión', 403);
  }
  return member;
}
async function getWorkspace(db, tenantId, id) {
  if (!validId(id)) throw new ApiError('Workspace inválido', 404);
  const row = await db.prepare(
    'SELECT id,tenant_id,name,revision,state_json,created_at,updated_at,updated_by FROM atlas_workspaces WHERE id=? AND tenant_id=?'
  ).bind(id, tenantId).first();
  if (!row) throw new ApiError('Workspace inexistente', 404);
  return row;
}
const publicWorkspace = row => ({id:row.id,name:row.name,revision:row.revision,
  state:JSON.parse(row.state_json),updatedAt:row.updated_at,updatedBy:row.updated_by});
function originCheck(request) {
  if (!['POST','PUT','PATCH','DELETE'].includes(request.method)) return;
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) throw new ApiError('Origen no permitido', 403);
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
        await db.batch([
          db.prepare('INSERT INTO atlas_workspaces(id,tenant_id,name,revision,state_json,created_by,updated_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)')
            .bind(id,tenantId,name,1,JSON.stringify(state),identity.email,identity.email,now,now),
          db.prepare('INSERT INTO atlas_audit_events(id,tenant_id,workspace_id,actor_email,action,previous_revision,new_revision,metadata_json,occurred_at) VALUES(?,?,?,?,?,?,?,?,?)')
            .bind(auditId,tenantId,id,identity.email,'workspace.created',null,1,JSON.stringify({name}),now)
        ]);
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
        await getWorkspace(db,tenantId,path[5]);
        const state=normalizeState(data.state);
        const now=new Date().toISOString(),newRevision=expected+1;
        // D1.batch ejecuta las instrucciones en una única transacción.
        // Verificar la revisión ANTES de actualizar evita auditar escrituras rechazadas.
        const outcome=await db.batch([
          db.prepare('INSERT INTO atlas_audit_events(id,tenant_id,workspace_id,actor_email,action,previous_revision,new_revision,metadata_json,occurred_at) SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM atlas_workspaces WHERE id=? AND tenant_id=? AND revision=?)')
            .bind(crypto.randomUUID(),tenantId,path[5],identity.email,'workspace.updated',expected,newRevision,
              JSON.stringify({kind:state.kind,risks:state.risks.length,actions:state.actions.length,incidents:state.incidents.length}),
              now,path[5],tenantId,expected),
          db.prepare('UPDATE atlas_workspaces SET state_json=?,revision=revision+1,updated_by=?,updated_at=? WHERE id=? AND tenant_id=? AND revision=?')
            .bind(JSON.stringify(state),identity.email,now,path[5],tenantId,expected)
        ]);
        if (outcome[1]?.meta?.changes !== 1)
          throw new ApiError('Conflicto de edición: recargá el workspace antes de guardar',409);
        return reply({id:path[5],revision:newRevision,updatedAt:now});
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
        const email=decodeURIComponent(path[5]).trim().toLowerCase();
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
        const now=new Date().toISOString();
        await db.batch([
          db.prepare(
            "INSERT INTO atlas_memberships(tenant_id,email,access_sub,role,status,created_at,updated_at) VALUES(?,?,NULL,?,?,?,?) ON CONFLICT(tenant_id,email) DO UPDATE SET role=excluded.role,status=excluded.status,updated_at=excluded.updated_at"
          ).bind(tenantId,email,data.role,data.status,now,now),
          db.prepare('INSERT INTO atlas_audit_events(id,tenant_id,workspace_id,actor_email,action,metadata_json,occurred_at) VALUES(?,?,NULL,?,?,?,?)')
            .bind(crypto.randomUUID(),tenantId,identity.email,'membership.changed',JSON.stringify({target:email,role:data.role,status:data.status}),now)
        ]);
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
