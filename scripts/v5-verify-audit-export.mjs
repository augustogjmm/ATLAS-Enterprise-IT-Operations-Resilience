#!/usr/bin/env node
// Verificación offline de exportaciones ATLAS V5. No envía datos a ningún servicio.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

export function verifyAuditExport(file) {
  if(!file || typeof file!=='object' || !Array.isArray(file.events) ||
     !Number.isSafeInteger(file.eventCount) || file.eventCount!==file.events.length ||
     typeof file.tenantId!=='string' || file.tenantId.length===0 ||
     file.integrity?.algorithm!=='SHA-256' ||
     file.integrity?.encoding!=='JSON.stringify(events)' ||
     !/^[0-9a-f]{64}$/.test(file.integrity?.sha256||''))
    throw new Error('Formato o conteo de exportación inválidos');
  const ids=new Set();
  for(const event of file.events){
    if(typeof event?.id!=='string'||!event.id||ids.has(event.id))
      throw new Error('Evento duplicado o sin ID');
    ids.add(event.id);
  }
  const actual=createHash('sha256').update(JSON.stringify(file.events),'utf8').digest('hex');
  if(actual!==file.integrity.sha256)throw new Error('La huella SHA-256 no coincide: archivo alterado o corrupto');
  return {tenantId:file.tenantId,eventCount:file.eventCount,sha256:actual};
}

if(process.argv[1] && import.meta.url===new URL('file://'+process.argv[1]).href){
  try{
    if(process.argv.length!==3)throw new Error('Uso: node scripts/v5-verify-audit-export.mjs archivo.json');
    const file=JSON.parse(await readFile(process.argv[2],'utf8'));
    const verified=verifyAuditExport(file);
    console.log('OK ATLAS V5: auditoría íntegra',verified);
  }catch(error){console.error('ERROR ATLAS V5:',error.message);process.exitCode=1;}
}
