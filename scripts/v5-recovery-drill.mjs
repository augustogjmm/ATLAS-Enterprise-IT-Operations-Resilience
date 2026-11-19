// Ensayo local de recuperación: NO usa Cloudflare D1 remota ni credenciales productivas.
// Exporta SQLite, verifica checksum/integridad y prueba lectura/escritura restaurada con Worker real.
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,copyFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {createHandler} from '../worker/index.js';
import {makeEmpty} from '../src/governance/core.js';

const folder=mkdtempSync(join(tmpdir(),'atlas-v5-recovery-'));
const source=join(folder,'original.sqlite'),backup=join(folder,'respaldo.sqlite'),
      restore=join(folder,'restaurado.sqlite');
const checksum=bytes=>createHash('sha256').update(bytes).digest('hex');
function binding(db){
 return {
  prepare(sql){
   let args=[];
   return {
    bind(...parameters){args=parameters;return this;},
    async first(){return db.prepare(sql).get(...args)||null;},
    async all(){return {results:db.prepare(sql).all(...args)};},
    async run(){return {meta:db.prepare(sql).run(...args)};}
   };
  },
  async batch(statements){
   db.exec('BEGIN');
   try{
    const results=[];
    for(const item of statements)results.push(await item.run());
    db.exec('COMMIT');
    return results;
   }catch(e){db.exec('ROLLBACK');throw e;}
  }
 };
}
const handler=createHandler({verify:async()=>({
 email:'owner@recovery.test',sub:'synthetic-access-id',name:'Recovery owner'
})});
const api=async(db,method,path,payload)=>{
 const req=new Request('https://atlas.example'+path,{
  method,
  headers:{'Content-Type':'application/json',...(method==='GET'?{}:{'X-Atlas-CSRF':'v5'})},
  ...(payload===undefined?{}:{body:JSON.stringify(payload)})
 });
 const response=await handler(req,{ATLAS_DB:binding(db)});
 return {status:response.status,body:await response.json()};
};
const root='/api/v1/tenants/org-recovery/workspaces';
function integrity(db){
 assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
 const verdict=db.prepare('PRAGMA integrity_check').all();
 assert.equal(verdict.length,1);
 assert.equal(verdict[0].integrity_check,'ok');
 const tables=db.prepare("SELECT name FROM sqlite_master WHERE name LIKE 'atlas_%' AND type='table'").all();
 assert.equal(tables.length,5,'Las cinco tablas de ATLAS V5 deben existir');
}
let db,restored;
try {
 db=new DatabaseSync(source);
 db.exec('PRAGMA foreign_keys=ON'); // SQLite local, D1 lo impone sin este PRAGMA.
 for(const file of ['0001_atlas_v5.sql','0002_atlas_v5_history.sql'])
  db.exec(readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'));
 integrity(db);
 const now='2026-11-18T00:00:00Z';
 db.prepare('INSERT INTO atlas_tenants(id,name,created_at) VALUES(?,?,?)')
  .run('org-recovery','Homologación sintética',now);
 db.prepare("INSERT INTO atlas_memberships(tenant_id,email,role,status,created_at,updated_at) VALUES(?,?,?,'active',?,?)")
  .run('org-recovery','owner@recovery.test','owner',now,now);
 const created=await api(db,'POST',root,{name:'Recuperación ATLAS',state:makeEmpty()});
 assert.equal(created.status,201,JSON.stringify(created.body));
 const id=created.body.id,path=root+'/'+id;
 const updated=makeEmpty();
 updated.verticals.push({id:'vertical-1',name:'Infraestructura',owner:'Gerencia',description:'Datos de prueba'});
 assert.equal((await api(db,'PUT',path,{revision:1,state:updated})).status,200);
 integrity(db);
 assert.equal(db.prepare('SELECT count(*) AS c FROM atlas_audit_events').get().c,2);
 assert.equal(db.prepare('SELECT count(*) AS c FROM atlas_workspace_revisions').get().c,2);
 // El comando VACUUM INTO es solo una herramienta para el ensayo SQLite local,
 // NO se debe utilizar como procedimiento de exportación directo contra Cloudflare D1.
 db.exec("VACUUM INTO '"+backup.replaceAll("'","''")+"'");
 const originalChecksum=checksum(readFileSync(backup));
 assert.match(originalChecksum,/^[a-f0-9]{64}$/);
 const mutated=Buffer.from(readFileSync(backup));
 mutated[0]^=0x01;
 assert.notEqual(checksum(mutated),originalChecksum,
  'Un artefacto alterado debe ser detectado por checksum');
 db.close();db=null;
 copyFileSync(backup,restore);
 assert.equal(checksum(readFileSync(restore)),originalChecksum);
 restored=new DatabaseSync(restore);
 restored.exec('PRAGMA foreign_keys=ON');
 integrity(restored);
 const loaded=await api(restored,'GET',path);
 assert.equal(loaded.status,200);
 assert.equal(loaded.body.revision,2);
 assert.equal(loaded.body.state.verticals[0].name,'Infraestructura');
 assert.equal(restored.prepare('SELECT count(*) AS c FROM atlas_audit_events').get().c,2);
 assert.equal(restored.prepare('SELECT count(*) AS c FROM atlas_workspace_revisions').get().c,2);
 const revisions=await api(restored,'GET',path+'/revisions');
 assert.deepEqual(revisions.body.revisions.map(x=>x.revision),[2,1]);
 const changed=structuredClone(loaded.body.state);
 changed.verticals[0].description='Seguimiento posterior a restauración';
 const next=await api(restored,'PUT',path,{revision:2,state:changed});
 assert.equal(next.status,200,JSON.stringify(next.body));
 assert.equal(next.body.revision,3);
 const rollback=await api(restored,'PUT',path+'/revisions/1/restore',{revision:3});
 assert.equal(rollback.status,200,JSON.stringify(rollback.body));
 assert.equal(rollback.body.revision,4);
 integrity(restored);
 const final=await api(restored,'GET',path);
 assert.deepEqual(final.body.state.verticals,[]);
 const audit=await api(restored,'GET','/api/v1/tenants/org-recovery/audit');
 assert.equal(audit.status,200);
 assert.deepEqual(audit.body.events.map(x=>x.action).sort(),
  ['workspace.created','workspace.restored','workspace.updated','workspace.updated']);
 console.log('OK V5 DR local: SQLite exportado, checksum SHA-256, restore separado, integridad FK, lectura/escritura y restauración histórica con Worker real.');
}finally{
 try{db?.close();}catch{}
 try{restored?.close();}catch{}
 rmSync(folder,{recursive:true,force:true});
}
