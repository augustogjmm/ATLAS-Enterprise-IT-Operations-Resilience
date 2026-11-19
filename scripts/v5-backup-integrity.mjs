// ATLAS V5: cadena de custodia de respaldos SQLite de homologación local.
// No interactúa con Cloudflare ni sustituye su procedimiento oficial de exportación.
import {createHash,timingSafeEqual} from 'node:crypto';

const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export function createBackupManifest(bytes,{database='atlas-v5-local',counts}={}){
  if(!Buffer.isBuffer(bytes)||!bytes.length)throw new Error('Respaldo SQLite vacío o inválido');
  if(!counts||!Object.keys(counts).length||Object.values(counts).some(n=>!Number.isSafeInteger(n)||n<0))
    throw new Error('Conteos de respaldo inválidos');
  return {format:'atlas-v5-sqlite-backup-v1',database,
    byteLength:bytes.length,sha256:sha256(bytes),counts:{...counts}};
}
export function verifyBackupManifest(bytes,manifest){
  if(!Buffer.isBuffer(bytes)||!manifest||manifest.format!=='atlas-v5-sqlite-backup-v1'||
     !Number.isSafeInteger(manifest.byteLength)||manifest.byteLength<=0||
     !/^[0-9a-f]{64}$/.test(manifest.sha256||'')||!manifest.counts||
     Object.values(manifest.counts).some(n=>!Number.isSafeInteger(n)||n<0))
    throw new Error('Manifiesto de respaldo inválido');
  if(bytes.length!==manifest.byteLength)throw new Error('El tamaño del respaldo difiere del manifiesto');
  const expected=Buffer.from(manifest.sha256,'hex');
  const actual=Buffer.from(sha256(bytes),'hex');
  if(!timingSafeEqual(actual,expected))
    throw new Error('El respaldo fue alterado o está corrupto: SHA-256 no coincide');
  return manifest;
}
export function verifyRestoredCounts(db,manifest){
  for(const [table,count] of Object.entries(manifest.counts)){
    if(!/^atlas_[a-z_]+$/.test(table))throw new Error('Nombre de tabla no autorizado en manifiesto');
    const actual=db.prepare('SELECT COUNT(*) AS count FROM '+table).get().count;
    if(actual!==count)throw new Error('Conteo restaurado diferente en '+table+': '+actual+' != '+count);
  }
  return true;
}
