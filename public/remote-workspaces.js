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
  constructor(fetcher=(url,options)=>fetch(url,options), base='/api/v1') {
    this.fetcher=fetcher;
    this.base=base;
  }
  async request(path,{method='GET',body}={}) {
    let response;
    try {
      response=await this.fetcher(this.base+path,{
        method,
        cache:'no-store',
        credentials:'same-origin',
        headers:{Accept:'application/json',...(body===undefined?{}:{'Content-Type':'application/json','X-Atlas-CSRF':'v5'})},
        ...(body===undefined?{}:{body:JSON.stringify(body)})
      });
    } catch {
      throw new RemoteWorkspaceError('No se pudo contactar al servidor V5. El contenido local no fue modificado.');
    }
    let result;
    try{result=await response.json();}
    catch{throw new RemoteWorkspaceError('La API V5 respondió con un formato inválido.',response.status);}
    if(!response.ok)throw new RemoteWorkspaceError(
      typeof result?.error==='string'?result.error:'Error de servidor V5',response.status);
    return result;
  }
  session(){return this.request('/session');}
  list(tenantId){return this.request('/tenants/'+segment(tenantId)+'/workspaces');}
  open(tenantId,id){return this.request('/tenants/'+segment(tenantId)+'/workspaces/'+segment(id));}
  create(tenantId,name,state){return this.request('/tenants/'+segment(tenantId)+'/workspaces',{method:'POST',body:{name,state}});}
  save(tenantId,id,revision,state){return this.request('/tenants/'+segment(tenantId)+'/workspaces/'+segment(id),{method:'PUT',body:{revision,state}});}
  audit(tenantId){return this.request('/tenants/'+segment(tenantId)+'/audit');}
  members(tenantId){return this.request('/tenants/'+segment(tenantId)+'/members');}
  setMember(tenantId,email,role,status){
    return this.request('/tenants/'+segment(tenantId)+'/members/'+segment(email),{method:'PUT',body:{role,status}});
  }
}
export const canEditWorkspace = role => ['owner','admin','editor'].includes(role);
export const canManageMembers = role => ['owner','admin'].includes(role);
export const canAudit = role => ['owner','admin','auditor'].includes(role);
