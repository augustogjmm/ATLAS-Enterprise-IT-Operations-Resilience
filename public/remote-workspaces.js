// Cliente ATLAS V5: modo remoto explícito, separado de la V4 local.
// Los roles son informativos en la UI: el Worker verifica cada permiso.
export class RemoteWorkspaceError extends Error {
  constructor(message, status=0) {
    super(message);
    this.name='RemoteWorkspaceError';
    this.status=status;
  }
}
const segment=value=>encodeURIComponent(String(value));

export class RemoteWorkspaces {
  constructor(fetcher=(url,options)=>fetch(url,options), base='/api/v1', timeoutMs=15000) {
    if (!Number.isFinite(timeoutMs) || timeoutMs<1)
      throw new RangeError('Tiempo de espera V5 inválido');
    this.fetcher=fetcher;
    this.base=base;
    this.timeoutMs=timeoutMs;
  }
  async request(path,{method='GET',body}={}) {
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),this.timeoutMs);
    let response,result;
    try {
      response=await this.fetcher(this.base+path,{
        method,
        cache:'no-store',
        credentials:'same-origin',
        signal:controller.signal,
        headers:{Accept:'application/json',...(body===undefined?{}:{'Content-Type':'application/json','X-Atlas-CSRF':'v5'})},
        ...(body===undefined?{}:{body:JSON.stringify(body)})
      });
      result=await response.json();
    } catch {
      if(controller.signal.aborted){
        const warning=method==='GET'
          ? 'Podés intentar la consulta nuevamente.'
          : 'La operación podría haberse aplicado en el servidor. Consultá su estado antes de repetirla.';
        throw new RemoteWorkspaceError('Tiempo de espera agotado en V5. '+warning+' Los datos locales no fueron modificados.');
      }
      if(response)throw new RemoteWorkspaceError('La API V5 respondió con un formato inválido.',response.status);
      throw new RemoteWorkspaceError('No se pudo contactar al servidor V5. El contenido local no fue modificado.');
    } finally {clearTimeout(timeout);}
    if(!response.ok)throw new RemoteWorkspaceError(
      typeof result?.error==='string'?result.error:'Error de servidor V5',response.status);
    return result;
  }
  session(){return this.request('/session');}
  list(tenantId){return this.request('/tenants/'+segment(tenantId)+'/workspaces');}
  open(tenantId,id){return this.request('/tenants/'+segment(tenantId)+'/workspaces/'+segment(id));}
  create(tenantId,name,state){return this.request('/tenants/'+segment(tenantId)+'/workspaces',{method:'POST',body:{name,state}});}
  save(tenantId,id,revision,state){return this.request('/tenants/'+segment(tenantId)+'/workspaces/'+segment(id),{method:'PUT',body:{revision,state}});}
  revisions(tenantId,id){return this.request('/tenants/'+segment(tenantId)+'/workspaces/'+segment(id)+'/revisions');}
  restore(tenantId,id,targetRevision,currentRevision){
    return this.request('/tenants/'+segment(tenantId)+'/workspaces/'+segment(id)+'/revisions/'+segment(targetRevision)+'/restore',
      {method:'PUT',body:{revision:currentRevision}});
  }
  audit(tenantId){return this.request('/tenants/'+segment(tenantId)+'/audit');}
  auditPage(tenantId,cursor=null){
    const base='/tenants/'+segment(tenantId)+'/audit/export';
    if(cursor===null)return this.request(base);
    if(!cursor || typeof cursor.beforeAt!=='string' || typeof cursor.beforeId!=='string')
      throw new RemoteWorkspaceError('Cursor de auditoría inválido');
    return this.request(base+'?beforeAt='+segment(cursor.beforeAt)+'&beforeId='+segment(cursor.beforeId));
  }
  async exportAudit(tenantId){
    const events=[],seenIds=new Set(),seenCursors=new Set();
    let cursor=null;
    // El backend admite hasta 2.000 eventos globales, pero no descargar un archivo
    // incompleto si una página falla o se repite un cursor.
    for(let pageNumber=0;pageNumber<21;pageNumber++){
      const page=await this.auditPage(tenantId,cursor);
      if(!Array.isArray(page?.events)||page.events.length>100)
        throw new RemoteWorkspaceError('Respuesta de auditoría inválida: se canceló la exportación.');
      for(const event of page.events){
        if(typeof event?.id!=='string'||seenIds.has(event.id))
          throw new RemoteWorkspaceError('La auditoría contiene eventos duplicados o inválidos. Exportación cancelada.');
        seenIds.add(event.id);events.push(event);
      }
      if(page.nextCursor===null){
        return {tenantId,exportedAt:new Date().toISOString(),eventCount:events.length,
          notice:'Exportación paginada; las escrituras concurrentes pueden cambiar el conjunto durante la lectura.',
          events};
      }
      if(!page.nextCursor || !page.events.length)
        throw new RemoteWorkspaceError('Paginación de auditoría incompleta.');
      const key=JSON.stringify(page.nextCursor);
      if(seenCursors.has(key))throw new RemoteWorkspaceError('Cursor de auditoría repetido.');
      seenCursors.add(key);cursor=page.nextCursor;
    }
    throw new RemoteWorkspaceError('Exportación interrumpida: exceso de páginas de auditoría.');
  }

  members(tenantId){return this.request('/tenants/'+segment(tenantId)+'/members');}
  setMember(tenantId,email,role,status){
    return this.request('/tenants/'+segment(tenantId)+'/members/'+segment(email),{method:'PUT',body:{role,status}});
  }
}
export const canEditWorkspace = role => ['owner','admin','editor'].includes(role);
export const canManageMembers = role => ['owner','admin'].includes(role);
export const canAudit = role => ['owner','admin','auditor'].includes(role);
export const canRestore = role => ['owner','admin'].includes(role);
