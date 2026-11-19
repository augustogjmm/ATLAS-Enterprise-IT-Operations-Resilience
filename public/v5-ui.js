import {RemoteWorkspaces,canEditWorkspace,canAudit,canManageMembers,canRestore} from './remote-workspaces.js';

// Controlador opt-in. Nunca transmite datos de V4 sin confirmación expresa.
export function mountRemoteV5({getState,getLocal,replaceState,notice,validateState}) {
  const api=new RemoteWorkspaces();
  const s={session:null,tenant:'',workspaces:[],choice:'',role:'',id:'',name:'',revision:0,
    busy:false,conflict:false,error:'',details:'',revisions:[],pending:null};
  const active=()=>Boolean(s.id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const option=(id,title,selected)=>'<option value="'+esc(id)+'"'+(id===selected?' selected':'')+'>'+esc(title)+'</option>';
  const button=(id,title,disabled=false)=>'<button type="button" class="button button-subtle" data-workspace-command="'+id+'"'+(disabled?' disabled':'')+'>'+esc(title)+'</button>';
  const bar=()=>document.getElementById('workspace-panel');

  function render() {
    const el=bar();if(!el)return;
    let out='<span class="workspace-title">ATLAS V5 · Workspaces</span>';
    out+='<span class="workspace-status '+(s.conflict?'alert':active()?'secure':'')+'">'+
      esc(s.conflict?'CAMBIOS SIN CONFIRMAR':s.busy?'Guardando / cargando…':active()?'Compartido: '+s.name+' · '+s.role+' · r'+s.revision:'V4 local · navegador')+'</span>';
    if(!s.session)out+=button('connect','Conectar V5',s.busy);
    else {
      out+='<label class="workspace-field">Organización <select id="workspace-tenant"'+(s.busy?' disabled':'')+'>'+
        s.session.tenants.map(x=>option(x.tenant_id,x.name,s.tenant)).join('')+'</select></label>';
      out+='<label class="workspace-field">Workspace <select id="workspace-select"'+(s.busy?' disabled':'')+'>'+
        option('','Seleccionar workspace',s.choice)+s.workspaces.map(x=>option(x.id,x.name,s.choice)).join('')+'</select></label>';
      out+=button('open','Abrir workspace',s.busy||!s.choice);
      out+=button('create','Crear workspace',s.busy||!canEditWorkspace(s.role));
      if(active()){
        out+=button('reload','Recargar servidor',s.busy);
        if(canAudit(s.role))out+=button('audit','Ver auditoría',s.busy);
        if(canAudit(s.role))out+=button('history','Historial / recuperación',s.busy);
        if(canManageMembers(s.role))out+=button('members','Ver miembros',s.busy);
        if(canManageMembers(s.role))out+=button('manage','Administrar rol',s.busy);
      }
    }
    if(active())out+=button('local','Volver a V4 local',s.busy);
    if(s.conflict){
      if(s.pending&&active())out+=button('verify','Verificar guardado en servidor',s.busy);
      out+=button('backup','Exportar cambios',false);
    }
    if(s.error)out+='<div class="workspace-warning"><strong>Atención:</strong> '+esc(s.error)+'</div>';
    out+='<span class="workspace-help">La conexión es opcional. No se cargan datos locales al servidor sin tu autorización.</span>';
    if(s.details)out+='<div class="workspace-break"></div><div class="workspace-details">'+s.details+'</div>';
    el.innerHTML=out;
    const indicator=document.querySelector('.storage-indicator');
    if(indicator)indicator.innerHTML='<span class="indicator"></span> '+(active()?'D1 · PERSISTENCIA COMPARTIDA':'DATOS LOCALES DEL NAVEGADOR');
    const side=document.querySelector('.sidebar-foot p');
    if(side)side.textContent=active()?'Workspace remoto sujeto a control de acceso. Solo utilizar información ficticia de demostración.':'Demostración funcional. No conecta infraestructura real. Los datos no se comparten entre dispositivos.';
    const footer=document.querySelector('.footer span:nth-child(2)');
    if(footer)footer.textContent=active()?'V5 · Persistencia compartida · Datos de demostración':'Proyecto demostrativo · Persistencia local por navegador · Datos ficticios iniciales';
    const env=document.getElementById('environment-label');
    if(env&&active())env.textContent='WORKSPACE V5 · '+s.name+' · REVISIÓN '+s.revision;
    for(const k of ['demo','empty']){
      const item=document.querySelector('[data-command="'+k+'"]');
      if(item){item.disabled=active();item.title=active()?'Reinicio no disponible para workspaces compartidos':'';}
    }
    const importer=document.getElementById('import-file');
    if(importer)importer.disabled=active()&&!canEditWorkspace(s.role);
    const csv=document.getElementById('incident-file');
    if(csv)csv.disabled=active()&&!canEditWorkspace(s.role);
    if(active()&&!canEditWorkspace(s.role)){
      document.querySelectorAll('#view-root [data-open]').forEach(item=>{
        if(!item.dataset.open.startsWith('view:'))item.disabled=true;
      });
    }
  }

  function permitted() {
    if(!active())return true;
    if(s.busy){notice('Operación remota pendiente; esperá confirmación.',true);return false;}
    if(s.conflict){notice('Edición sin confirmar: exportá los cambios y recargá el servidor.',true);return false;}
    if(!canEditWorkspace(s.role)){notice('El rol '+s.role+' permite consultar pero no editar.',true);return false;}
    return true;
  }
  function exportBackup(){
    const text=JSON.stringify({...getState(),exportedAt:new Date().toISOString()},null,2);
    const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;
    a.download='atlas-'+(active()?'v5-sin-confirmar':'v4-local')+'-'+new Date().toISOString().slice(0,10)+'.json';
    document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
  }
  async function persist(state,message){
    if(!active()||!permitted())return false;
    const tenant=s.tenant,id=s.id,rev=s.revision,copy=structuredClone(state);
    // Si se pierde el ACK, conservar exactamente el intento para compararlo con D1.
    // Nunca volver a ejecutar un PUT automáticamente: podría duplicar cambios/auditoría.
    s.pending={tenant,id,revision:rev,state:copy};
    s.busy=true;s.error='';render();
    try{
      const result=await api.save(tenant,id,rev,copy);
      if(!Number.isSafeInteger(result.revision)||result.revision!==rev+1)
        throw new Error('Revisión inesperada; se requiere reconciliación.');
      s.revision=result.revision;s.conflict=false;s.pending=null;
      notice(message||'Revisión '+s.revision+' guardada correctamente.');
      return true;
    }catch(err){
      s.conflict=true;
      s.error=(err.status===409?'Hay una revisión más reciente en el servidor. ':'No pudo verificarse el guardado. ')+
        (err.message||'Fallo remoto')+'. Exportá un respaldo antes de descartar estos cambios.';
      notice(s.error,true);
      return false;
    }finally{s.busy=false;render();}
  }
  async function chooseTenant(tenant){
    if(s.busy)return;
    if(active()&&tenant!==s.tenant){s.error='Volvé al modo local para cambiar de organización.';render();return;}
    if(!s.session?.tenants.some(t=>t.tenant_id===tenant))return;
    s.tenant=tenant;s.choice='';s.details='';s.error='';s.busy=true;render();
    try{
      const result=await api.list(tenant);
      s.workspaces=result.workspaces;s.role=result.role;s.choice=s.workspaces[0]?.id||'';
    }catch(err){s.error=err.message;s.role='';s.workspaces=[];}
    finally{s.busy=false;render();}
  }
  async function act(command){
    if(s.busy&&command!=='backup')return;
    try {
      if(command==='backup'){exportBackup();notice('Archivo de respaldo descargado.');return;}
      if(command==='connect'){
        s.busy=true;s.error='';render();
        const session=await api.session();
        if(!Array.isArray(session.tenants)||!session.tenants.length)
          throw new Error('No existen organizaciones habilitadas para tu identidad.');
        s.session=session;s.busy=false;
        await chooseTenant(session.tenants[0].tenant_id);
        if(!s.error)notice('Identidad V5 validada. Seleccioná o creá un workspace.');
        return;
      }
      if(command==='local'){
        if(s.conflict&&!confirm('Existen cambios sin confirmar. Exportá un respaldo antes de descartarlos. ¿Volver al modo local?'))return;
        s.id='';s.name='';s.revision=0;s.conflict=false;s.error='';s.details='';s.revisions=[];s.pending=null;
        replaceState(getLocal());render();
        notice('V4 local restaurada sin sobrescribir datos remotos.');
        return;
      }
      if(command==='open'){
        if(!s.choice)return notice('Seleccioná un workspace.',true);
        if(s.conflict&&!confirm('Hay cambios sin guardar. Exportá antes de reemplazarlos. ¿Continuar?'))return;
        s.busy=true;render();
        const item=await api.open(s.tenant,s.choice);
        const data=validateState(item.state);
        replaceState(data);
        s.id=item.id;s.name=item.name;s.revision=item.revision;
        s.conflict=false;s.error='';s.details='';s.revisions=[];s.pending=null;
        notice('Workspace V5 cargado. Revisión '+s.revision+'.');return;
      }
      if(command==='create'){
        if(!canEditWorkspace(s.role))return notice('Rol sin permiso de creación.',true);
        const name=prompt('Nombre del nuevo workspace V5:');
        if(!name?.trim())return;
        const copyLocal=confirm('¿Copiar información de tu navegador al nuevo workspace remoto?\nAceptar = copiar local; Cancelar = empezar vacío.');
        if(copyLocal&&!confirm('Confirmá que los datos son ficticios y autorizás su envío al servidor.'))return;
        const snapshot=copyLocal?validateState(getLocal()):null;
        s.busy=true;render();
        const item=await api.create(s.tenant,name.trim(),snapshot??undefined);
        s.busy=false;
        await chooseTenant(s.tenant);
        s.choice=item.id;
        await act('open');
        notice('Workspace V5 creado. V4 local se conserva intacta.');
        return;
      }
      if(command==='reload'){
        if(!active())return;
        // La confirmación sobre cambios sin guardar se realiza una sola vez en «open».
        // Doble confirm() bloqueaba la recuperación tras un 409.
        s.choice=s.id;await act('open');return;
      }
      if(command==='verify'&&active()&&s.conflict&&s.pending){
        const attempt=s.pending;
        // Comparación de SOLO lectura: no sobrescribe nada y no genera auditoría.
        s.busy=true;s.error='';render();
        const record=await api.open(attempt.tenant,attempt.id);
        if(s.tenant!==attempt.tenant||s.id!==attempt.id)
          throw new Error('El workspace seleccionado cambió. No se realizó reconciliación.');
        const checked=validateState(record.state);
        if(JSON.stringify(checked)===JSON.stringify(attempt.state)){
          s.revision=record.revision;s.pending=null;s.conflict=false;s.error='';s.details='';
          notice('El servidor conserva los mismos datos enviados. Revisión '+record.revision+
            ' verificada mediante lectura, sin repetir la escritura.');
        }else{
          s.error='El servidor conserva una versión diferente (revisión '+
            record.revision+'). Los cambios actuales siguen sin confirmarse. '+
            'Exportá el respaldo antes de recargar o reconciliar manualmente.';
          notice(s.error,true);
        }
        return;
      }
      if(command==='history'&&active()&&canAudit(s.role)){
        s.busy=true;render();
        const result=await api.revisions(s.tenant,s.id);
        s.revisions=Array.isArray(result.revisions)?result.revisions:[];
        s.details='<strong>Historial y recuperación</strong><p>Se conservan hasta cinco versiones del workspace. Una restauración crea una nueva revisión y queda auditada; no elimina el historial de acciones del sistema.</p>'+
          '<div class="table-wrap"><table class="data-table"><thead><tr><th>REVISIÓN</th><th>AUTOR</th><th>FECHA</th></tr></thead><tbody>'+
          s.revisions.map(x=>'<tr><td>'+esc(x.revision)+'</td><td>'+esc(x.actor_email)+'</td><td>'+esc(x.created_at)+'</td></tr>').join('')+'</tbody></table></div>';
        if(canRestore(s.role)&&s.revisions.length>1)
          s.details+='<label class="workspace-field">Versión para restaurar <select id="workspace-restore-revision">'+
            s.revisions.filter(x=>x.revision!==s.revision).map(x=>option(String(x.revision),'Revisión '+x.revision,String(s.revisions[1]?.revision))).join('')+
            '</select></label>'+button('restore','Restaurar versión seleccionada');
        return;
      }
      if(command==='restore'&&active()&&canRestore(s.role)){
        if(s.conflict)return notice('Primero exportá o resolvé los cambios sin guardar.',true);
        const target=Number(document.getElementById('workspace-restore-revision')?.value);
        if(!Number.isSafeInteger(target)||!s.revisions.some(x=>x.revision===target)||target===s.revision)
          return notice('Seleccioná una revisión histórica válida.',true);
        if(!confirm('¿Restaurar la revisión '+target+'? Se reemplazarán los datos actuales de este workspace, creando una nueva revisión auditada. Exportá primero un respaldo si es necesario.'))return;
        s.busy=true;s.error='';render();
        try {
          await api.restore(s.tenant,s.id,target,s.revision);
          const current=await api.open(s.tenant,s.id);
          const checked=validateState(current.state);
          replaceState(checked);
          s.revision=current.revision;s.conflict=false;s.details='';s.revisions=[];
          notice('Revisión '+target+' restaurada como nueva revisión '+current.revision+'.');
        }catch(err){
          s.pending=null;s.conflict=true;
          s.error='La restauración no pudo verificarse. Evitá nuevas escrituras, exportá tus datos y recargá el workspace: '+(err.message||'fallo remoto');
          notice(s.error,true);
        }
        return;
      }
      if(command==='audit'&&active()&&canAudit(s.role)){
        s.busy=true;render();
        const result=await api.audit(s.tenant);
        s.details='<strong>Eventos de auditoría recientes</strong><div class="table-wrap"><table class="data-table"><thead><tr><th>FECHA</th><th>ACTOR</th><th>EVENTO</th><th>REVISIÓN</th></tr></thead><tbody>'+
          result.events.slice(0,30).map(x=>'<tr><td>'+esc(x.occurred_at)+'</td><td>'+esc(x.actor_email)+'</td><td>'+esc(x.action)+'</td><td>'+esc(x.new_revision??'—')+'</td></tr>').join('')+'</tbody></table></div>';
        return;
      }
      if(command==='members'&&active()&&canManageMembers(s.role)){
        s.busy=true;render();
        const result=await api.members(s.tenant);
        s.details='<strong>Miembros autorizados</strong><div class="table-wrap"><table class="data-table"><thead><tr><th>USUARIO</th><th>ROL</th><th>ESTADO</th></tr></thead><tbody>'+
          result.members.map(x=>'<tr><td>'+esc(x.email)+'</td><td>'+esc(x.role)+'</td><td>'+esc(x.status)+'</td></tr>').join('')+'</tbody></table></div>';
        return;
      }
      if(command==='manage'&&active()&&canManageMembers(s.role)){
        const email=prompt('Email del miembro que querés invitar o actualizar:');
        if(!email?.trim())return;
        const role=prompt('Rol (owner / admin / editor / auditor / viewer):','viewer');
        if(!['owner','admin','editor','auditor','viewer'].includes(role))return notice('Rol inválido.',true);
        const status=prompt('Estado (active / revoked):','active');
        if(!['active','revoked'].includes(status))return notice('Estado inválido.',true);
        if(!confirm('¿Confirmás el cambio de acceso '+email+' → '+role+' ('+status+')?'))return;
        s.busy=true;render();
        await api.setMember(s.tenant,email.trim().toLowerCase(),role,status);
        s.busy=false;await act('members');notice('Membresía modificada.');return;
      }
    }catch(err){
      s.error=err.message||'Error de comunicación remota';
      notice(s.error,true);
    }finally{s.busy=false;render();}
  }
  // Advertir antes de cerrar/refrescar una pestaña con un guardado remoto incierto.
  // No persiste datos sensibles silenciosamente en sessionStorage/localStorage.
  window.addEventListener('beforeunload',event=>{
    if(active()&&(s.conflict||s.busy)){
      event.preventDefault();
      event.returnValue='';
    }
  });
  document.addEventListener('click',event=>{
    const item=event.target.closest('[data-workspace-command]');
    if(item){event.preventDefault();void act(item.dataset.workspaceCommand);}
  });
  document.addEventListener('change',event=>{
    if(event.target?.id==='workspace-tenant')void chooseTenant(event.target.value);
    if(event.target?.id==='workspace-select'){s.choice=event.target.value;render();}
  });
  render();
  return {active,permitted,persist,render,exportBackup,canWrite:()=>!active()||canEditWorkspace(s.role),
    state:()=>({...s,session:s.session?{tenants:s.session.tenants}:null})};
}
