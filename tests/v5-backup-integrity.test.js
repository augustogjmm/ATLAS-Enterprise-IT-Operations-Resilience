import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createBackupManifest,verifyBackupManifest,verifyRestoredCounts} from '../scripts/v5-backup-integrity.mjs';

test('manifiesto de SQLite confirma tamaño y digest; falla cerrado ante corrupción',()=>{
 const bytes=Buffer.from('SQLite synthetic for manifest tests');
 const manifest=createBackupManifest(bytes,{counts:{atlas_tenants:1}});
 assert.equal(verifyBackupManifest(bytes,manifest).sha256,manifest.sha256);
 const altered=Buffer.from(bytes);altered[0]^=1;
 assert.throws(()=>verifyBackupManifest(altered,manifest),/SHA-256/);
 assert.throws(()=>verifyBackupManifest(bytes.subarray(1),manifest),/tamaño/);
 assert.throws(()=>verifyBackupManifest(bytes,{...manifest,sha256:'x'}),/inválido/);
});

test('reconciliación de conteos detecta restauración incompleta y tabla no autorizada',()=>{
 const sqlite=new DatabaseSync(':memory:');
 try{
  sqlite.exec('CREATE TABLE atlas_tenants(id TEXT); INSERT INTO atlas_tenants VALUES (\'a\');');
  const bytes=Buffer.from('SQLite local manifest');
  const manifest=createBackupManifest(bytes,{counts:{atlas_tenants:1}});
  assert.equal(verifyRestoredCounts(sqlite,manifest),true);
  sqlite.exec("DELETE FROM atlas_tenants");
  assert.throws(()=>verifyRestoredCounts(sqlite,manifest),/Conteo restaurado diferente/);
  assert.throws(()=>verifyRestoredCounts(sqlite,{...manifest,counts:{'sqlite_master; DROP TABLE':0}}),/no autorizado/);
 }finally{sqlite.close();}
});
