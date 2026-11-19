// ATLAS V5: puerta de arquitectura SIN servicios de pago ni despliegue.
// Solo controla la plantilla del repositorio; NO demuestra el plan real de la cuenta.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const exactKeys=(value, keys, label) => {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value), label+' debe ser un objeto');
  assert.deepEqual(Object.keys(value).sort(), keys.slice().sort(), label+' contiene recursos o parámetros no autorizados');
};

export function inspectZeroCostTemplate(raw) {
  // La plantilla usa comentarios de línea completa. No eliminar // dentro de https://.
  const text=raw.split('\n').filter(line=>!line.trimStart().startsWith('//')).join('\n');
  const config=JSON.parse(text);
  exactKeys(config,['name','main','compatibility_date','assets','d1_databases','vars'],'Worker V5');
  assert.equal(config.name,'atlas-enterprise-v5','No reutilizar Worker V4');
  assert.equal(config.main,'./worker/index.js');
  assert.match(config.compatibility_date,/^\d{4}-\d{2}-\d{2}$/);
  exactKeys(config.assets,['directory','binding','run_worker_first'],'Static Assets');
  assert.equal(config.assets.directory,'./dist');
  assert.equal(config.assets.binding,'ASSETS');
  assert.deepEqual(config.assets.run_worker_first,['/api/*']);
  assert.equal(config.d1_databases.length,1,'Solo una D1 V5 gratuita y aislada');
  const db=config.d1_databases[0];
  exactKeys(db,['binding','database_name','database_id'],'D1 V5');
  assert.equal(db.binding,'ATLAS_DB');
  assert.equal(db.database_name,'atlas-v5');
  assert.equal(db.database_id,'REEMPLAZAR_UUID_REAL_D1','No cargar IDs reales ni conectar bases existentes');
  exactKeys(config.vars,['ACCESS_TEAM_DOMAIN','ACCESS_AUD'],'Variables de Access');
  assert.equal(config.vars.ACCESS_TEAM_DOMAIN,'https://REEMPLAZAR.cloudflareaccess.com');
  assert.equal(config.vars.ACCESS_AUD,'REEMPLAZAR_AUD_DE_ACCESS');
  return {worker:config.name,d1:db.database_name,approvedBindings:['ASSETS','ATLAS_DB'],templateIsolated:true};
}

if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const result=inspectZeroCostTemplate(readFileSync('config/wrangler.v5.example.jsonc','utf8'));
  console.log('OK ATLAS V5 costo cero (plantilla): '+result.worker+', una D1 aislada, assets, sin servicios pagos.');
  console.log('El plan real y los límites del total de la cuenta requieren verificación manual antes de activar servicios.');
}
