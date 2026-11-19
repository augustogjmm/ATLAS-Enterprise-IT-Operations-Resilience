// GATE DE SEGURIDAD PRE-PUBLICACIÓN: ATLAS V5 debe seguir sin despliegue/secretos.
// Se retira o ajusta únicamente mediante PR revisado tras autorización formal.
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';

const source=path=>readFileSync(path,'utf8');
const tracked=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const forbidden=/(^|\/)(\.dev\.vars(?:\..*)?|\.env(?:\..*)?|\.wrangler|\.miniflare)(\/|$)/i;
const ignored=new Set(['.env.example']);
const suspicious=tracked.filter(path=>forbidden.test(path)&&!ignored.has(path));
assert.deepEqual(suspicious,[],
  'No debe existir ningún archivo de secretos, estado del emulador ni credenciales versionado.');
const rootConfigs=['wrangler.jsonc','wrangler.json','wrangler.toml','cloudflare.config.ts'];
for(const path of rootConfigs)
  assert.equal(existsSync(path),false,
    'V5 debe permanecer sin un fichero de despliegue raíz: '+path);
const example=source('config/wrangler.v5.example.jsonc');
for(const marker of ['"name": "atlas-enterprise-v5"','"database_name": "atlas-v5"',
  'REEMPLAZAR_UUID_REAL_D1','REEMPLAZAR_AUD_DE_ACCESS','REEMPLAZAR.cloudflareaccess.com'])
  assert.ok(example.includes(marker),'Falta placeholder o nombre independiente en plantilla: '+marker);
const pkg=JSON.parse(source('package.json'));
for(const [key,value] of Object.entries(pkg.scripts||{})){
  assert.ok(!/(wrangler|cloudflare|(?:^|\s)cf)\s+deploy\b/i.test(value),
    'No debe existir despliegue productivo automático en scripts npm: '+key);
}
const workflows=tracked.filter(x=>/\.github\/workflows\/[^/]+\.ya?ml$/.test(x));
assert.ok(workflows.length>0,'No se encontraron workflows de calidad');
for(const file of workflows){
  const content=source(file);
  assert.ok(!/(?:wrangler-action@|wrangler\s+deploy\b|\bcf\s+deploy\b|cloudflare\/pages-action@)/i.test(content),
    'Workflow con posible publicación automática requiere autorización: '+file);
}
for(const path of ['migrations/0001_atlas_v5.sql','migrations/0002_atlas_v5_history.sql',
  'docs/RUNBOOK_OPERACION_RECUPERACION_V5.md','worker/auth.js',
  'tests/v5-signed-access-api.test.js','scripts/v5-multiuser-smoke.mjs',
  'scripts/v5-zero-cost-gate.mjs','tests/v5-zero-cost-gate.test.js',
  'docs/COSTO_CERO_ATLAS_V5.md'])
  assert.equal(existsSync(path),true,'Falta control de migración, recuperación o pruebas: '+path);
console.log('OK ATLAS V5 preflight: sin secretos versionados, sin despliegues automáticos, migraciones/rollback y pruebas de JWT presentes.');
