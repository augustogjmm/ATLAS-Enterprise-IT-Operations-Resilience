# ATLAS V5 — Procedimiento de homologación, respaldo y recuperación

**Estado:** procedimiento preparado, **no ejecutado en Cloudflare**. ATLAS V4 publicada en `main` sigue siendo el entorno de referencia. Esta guía utiliza únicamente datos ficticios y no autoriza una puesta en producción.

## 1. Alcance y límites

- Servicio propuesto: **un Worker V5 independiente**, D1 propia `atlas-v5`, Cloudflare Access limitado a usuarios preautorizados; **no reutilizar** la base `chamaquin-seg` ni modificar el Worker de V4.
- Acceso por `owner`, `admin`, `editor`, `auditor`, `viewer`. Las reglas efectivas se validan **en el Worker**, no en los controles visuales. Ante un cambio de membresía, el backend vuelve a comprobar privilegios dentro de D1 y registra el rol/estado anterior y el posterior en el mismo lote; la bitácora sigue sin ser WORM.
- Persistencia del workspace mediante revisiones optimistas; escritura concurrente rechazada con HTTP 409; historial acotado a 5 versiones, con restauración autorizada como revisión nueva.
- Límite deliberado de **10 workspaces por organización**; tamaño máximo **1 MiB de JSON por escritura**. Son topes de aplicación, no límites garantizados del plan Cloudflare.
- **No utilizar datos confidenciales, personales ni bancarios**. Las pruebas con SQLite y navegadores locales no equivalen a validar el runtime Cloudflare ni Cloudflare Access real.
- **No se garantiza todavía ningún RPO ni RTO de producción**: se deberán medir en un ejercicio real de recuperación.

## 2. Puertas de aprobación previas al despliegue

| Control | Evidencia de aprobación necesaria |
|---|---|
| Autorización del propietario | Permiso explícito para crear D1, Access y Worker V5 por separado |
| Costos | Confirmación de plan, facturación/requisitos de activación de Access y límites vigentes |
| Identidad | Equipo/organización Access propia, aplicación y audiencia, allowlist, usuarios de prueba |
| Tenant inicial | Alta de `atlas_tenants` y usuario `owner` autorizados por proceso controlado |
| Seguridad | Pruebas de JWT firmado, expiración, revocación, CSRF, aislamiento entre tenants |
| Persistencia | Aplicación ordenada de migraciones 0001 y 0002, integridad referencial y consultas básicas |
| Recuperación | Respaldo exportado, validación de integridad, restauración comprobada en entorno separado |
| Observabilidad | Revisar logs sin tokens ni JSON completos; alertas/manual de consumo |
| Verificación final | Pruebas de navegador, regresión V4, accesos no autorizados, rollback |

Si cualquiera de las puertas falla, **NO GO**: no publicar V5 ni migrar datos.

## 3. Pruebas locales sin costo Cloudflare

Ejecutar en la rama V5 (Node >=22):

```sh
npm run check
node scripts/v5-release-preflight.mjs
npm test
npm run build
# Ejecutables tras instalar Playwright para CI, según quality.yml:
node scripts/browser-smoke.mjs
node scripts/governance-smoke.mjs
node scripts/v5-browser-smoke.mjs
node scripts/v5-multiuser-smoke.mjs
node scripts/v5-recovery-drill.mjs
```

**Seguridad de identidad sin recursos externos:** `tests/v5-signed-access-api.test.js` emite JWT RS256 firmados con claves efímeras, implementa en memoria un endpoint JWKS de prueba y conecta el verificador criptográfico con la API real. Verifica también suplantación, audiencias incorrectas, expiración y revocación. Ningún JWT de prueba es válido para un servicio real.

**Bloqueo de despliegues inadvertidos:** `scripts/v5-release-preflight.mjs` es parte obligatoria de la CI. Detecta archivos `.dev.vars` / `.env` versionados, configuración de despliegue raíz y comandos de publicación en scripts o workflows. La plantilla V5 conserva placeholders sin credenciales. Cuando se autorice crear infraestructura aislada, cambiar el gate explícitamente en un PR distinto sujeto a revisión.

La última prueba utiliza el **Worker real importado**, migraciones SQL aplicadas sobre SQLite en memoria y **tres contextos independientes** de Chromium, con identidades sintéticas inyectadas **solo por el test**. Verifica owner/editor/viewer, conflicto de guardado, reconciliación, exportación de respaldo, restauración y revocación. No hay D1 remota ni credenciales reales.

**Ejercicio de recuperación local:** `scripts/v5-recovery-drill.mjs` exporta SQLite usando `VACUUM INTO` **solo en el runner local**, verifica el SHA-256 del archivo exportado y el de su copia restaurada, ejecuta `PRAGMA integrity_check` y `foreign_key_check`, consulta revisiones y auditoría, y prueba actualización y recuperación histórica posteriores. Simula alteración para comprobar el rechazo por checksum. **No es una herramienta de backup compatible con Cloudflare D1 remota.** La integridad SHA-256 por sí sola no demuestra autenticidad de origen; en un entorno real se requiere control de acceso, protección del respaldo y cadena de custodia. La restauración oficial de D1 seguirá pendiente hasta que se autorice su activación.

## 4. Preflight Cloudflare (solo cuando se autorice)

1. Confirmar que la URL y el contenido del Worker V4 original siguen accesibles, sin cambios.
2. Verificar con documentación actual los límites de Workers, Static Assets, D1 y Access, incluidos posibles requisitos de facturación de Zero Trust. No asumir costo cero sin esa confirmación.
3. Preparar **nuevo** Worker V5 y **nueva** D1 aislada; impedir que ramas/PR públicos permitan despliegues automáticos o exposición de credenciales.
4. Configurar Access antes de exponer una URL; validar JWT RS256, issuer, audience y política `deny by default`. Nunca usar `X-Local-Test-Identity` (solo existe en tests).
5. Aplicar en orden `migrations/0001_atlas_v5.sql` y `migrations/0002_atlas_v5_history.sql` a la nueva D1. No ejecutar contra bases ajenas. Cloudflare D1 **aplica claves foráneas automáticamente y prohíbe** `PRAGMA foreign_keys=ON`; verificar su integridad con consultas de solo lectura. En SQLite local sí debe habilitarse `PRAGMA foreign_keys=ON` antes de aplicar migraciones.
6. Registrar una única organización sintética y un `owner` preaprobado. La API **no** ofrece alta pública de organizaciones. Probar inicio de sesión, permisos, auditoría, revocación y restauración.
7. Probar la misma revisión desde dos navegadores físicos o cuentas separadas; observar HTTP 409, descarga de respaldo y ausencia de sobrescrituras.

### Consultas SQL de verificación (solo lectura)

```sql
SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'atlas_%' ORDER BY name;
SELECT tenant_id, COUNT(*) AS workspaces FROM atlas_workspaces GROUP BY tenant_id;
SELECT tenant_id, workspace_id, COUNT(*) AS revisiones
  FROM atlas_workspace_revisions GROUP BY tenant_id, workspace_id;
SELECT tenant_id, action, COUNT(*) AS eventos
  FROM atlas_audit_events GROUP BY tenant_id, action ORDER BY tenant_id, action;
-- En D1, comprobar restricciones FK con pruebas controladas de INSERT rechazado;
-- varios PRAGMA de integridad están restringidos a diferencia de SQLite local.
```

La tabla de revisiones deberá conservar como máximo 5 entradas por workspace. Si se detectan errores de integridad, suspender cambios y no ejecutar restauraciones automatizadas.

## 5. Respaldo y restauración

**Protección de cambios no confirmados:** ATLAS ofrece una acción de conciliación solo lectura y una advertencia de salida. La copia pendiente existe solamente en la memoria de la pestaña. Para preservar ese contenido ante cierre del navegador, descargar manualmente el JSON antes de salir. La comparación exitosa confirma el estado pero no significa que una pérdida de red haya registrado dos operaciones.

**Respaldo individual del usuario:** seleccionar un workspace y descargar **Exportar respaldo** en JSON. Este archivo puede contener toda la información del workspace: tratarlo como sensible, guardar en lugar autorizado y no subirlo a un repositorio público. Si hay conflicto 409 o falla de red, descargar **Exportar cambios** *antes* de recargar o volver a V4 local. El respaldo del navegador no sustituye al backup completo de D1.

**Respaldo de base:** antes de toda migración o liberación, un administrador deberá usar la función oficial de exportación/backup disponible en D1 según el plan y la documentación vigente. Registrar fecha, base, ambiente, integridad, responsable y lugar protegido. Verificar que se incluyan `atlas_tenants`, `atlas_memberships`, `atlas_workspaces`, `atlas_workspace_revisions` y `atlas_audit_events`; no publicar el archivo.

**Restauración de un workspace:** `owner` o `admin` selecciona una de las últimas 5 versiones, confirma el riesgo de sobrescritura y ejecuta la restauración. El servidor exige la revisión actual y registra `workspace.restored`, autor, revisión anterior, origen y nueva revisión; no borra el historial de auditoría.

**Restauración ante corrupción de D1:** no escribir sobre el entorno original hasta tener copia y diagnóstico. Restaurar **en un ambiente separado**, ejecutar los controles de integridad compatibles con el entorno (en SQLite nativo, `PRAGMA integrity_check` y `PRAGMA foreign_key_check`; en D1, consultas permitidas y comprobación de restricciones), comparar conteos y datos sintéticos, probar roles y JWT y habilitar tráfico solo tras aprobación. Si se sospecha compromiso de identidad, revocar el acceso antes de recuperar datos.

## 6. Casos de incidentes operativos

| Síntoma | Acción segura |
|---|---|
| Access 401/403 | Comprobar equipo/audiencia, política, JWT, membresía y su asociación `access_sub`; no desactivar Access |
| HTTP 400 (JSON o correo inválido) | Verificar que el cuerpo de la solicitud sea un objeto JSON, no `null`, una lista ni un valor simple; revisar el formato y codificación del correo. El backend rechaza estos datos sin mutar registros ni dejar una auditoría de éxito |\n| HTTP 409 | Usar «Verificar guardado en servidor». Si los datos remotos difieren, exportar cambios no confirmados y reconciliar manualmente; no repetir el PUT automáticamente |
| HTTP 422 | Revisar evidencia y reglas de cierre; no forzar escritura directa en SQL |
| HTTP 429 | Se alcanzó el cupo de workspaces; revisar capacidad antes de cambiar el límite |
| HTTP 503 | D1 o configuración de Access no disponible; mantener V4 local como alternativa |
| Respuesta perdida después del PUT | Leer revisión actual con «Verificar guardado en servidor»; el servidor podría haber aplicado la operación. Si el estado coincide, continuar sin duplicarla; si difiere, exportar y resolver el conflicto |
| Espera agotada en cliente (15 segundos) | El cliente interrumpe la consulta o escritura sin reintentar automáticamente. Para PUT/POST se desconoce si el servidor llegó a confirmar: verificar el workspace remoto y exportar cambios pendientes antes de cualquier nuevo envío |
| Acceso revocado durante una escritura | El Worker vuelve a verificar permisos en SQL; ante HTTP 403 conservar y exportar cambios locales, contactar a un `owner` sin intentar eludir los controles |
| Restauración no confirmada | Evitar reintentar a ciegas; consultar la revisión actual y auditoría |
| HTTP 409 por revisión histórica depurada | Si una revisión desaparece durante una restauración, el Worker detiene la transacción sin cambiar el workspace ni auditar una restauración inexistente. Consultar historial y seleccionar una versión disponible |
| Pérdida de propietario | Recuperación de membresía mediante procedimiento administrativo auditado; no crear bypass en frontend |
| Promoción o revocación denegada | Verificar quién tiene el rol `owner` y el rol efectivo del destinatario. Una promoción concurrente del destinatario o revocación del administrador invalida la solicitud; no eludir la verificación con SQL manual |

## 7. Rollback y gobierno de cambios

- No fusionar ni desplegar V5 hasta que la checklist y la homologación de Cloudflare estén aprobadas.
- Mantener el Worker V4 independiente como alternativa inmediata para uso local; **V4 no sincroniza datos de V5**.
- Ante falla en V5, restringir acceso al Worker nuevo, conservar respaldos, registrar incidente, responsable y decisiones; **no borrar D1** como mecanismo de rollback.
- Las operaciones administrativas manuales en D1 pueden eludir la auditoría de aplicación: requieren un registro externo de cambios. La bitácora V5 no es inmutable/WORM y no representa por sí sola conformidad SOX o BCRA.
- Antes de permitir uso real: definir privacidad y retención de datos, proceso de autorización/SoD, monitoreo de consumo, prevención de pérdidas y observabilidad.

## 8. Criterios de cierre de homologación

Una homologación satisfactoria exige pruebas de **dos identidades reales** en el runtime Cloudflare, deny-by-default, persistencia D1 consistente, recuperación verificada, respaldo descargable, métricas de consumo y ejecución de la suite CI. Los tests locales actuales cubren lógica y rutas, pero **no satisfacen por sí solos** ese criterio.


## Exportación completa de auditoría desde la interfaz

En un workspace remoto, un miembro con rol `owner`, `admin` o `auditor` puede seleccionar **Exportar auditoría completa**. La interfaz consulta páginas de hasta 100 eventos con cursor `beforeAt/beforeId` y entrega **un solo JSON** al finalizar correctamente todas las consultas. Si falla una página o aparecen identificadores repetidos, no entrega un archivo parcial.

El JSON contiene `tenantId`, fecha de exportación, conteo, advertencia sobre concurrencia y lista de eventos. **Contiene correos de usuarios**, por lo que debe almacenarse de forma privada. Verificar el conteo y calcular/verificar un hash SHA-256 del archivo al archivarlo. El archivo descargado **no es un backup de D1** ni una auditoría WORM. Al ser una lectura paginada, no garantiza consistencia transaccional frente a altas simultáneas: para un cierre de evidencia, suspender escrituras y comparar el conteo con la base antes y después.

La UI no borra ni rota registros; si se alcanza el máximo global de 2.000, las escrituras permanecen bloqueadas. La política de archivo, recuperación de evidencia y desbloqueo exige un procedimiento administrativo aprobado, todavía pendiente. No utilizar datos reales en esta demo sin completar homologación.


### Integridad comprobable del archivo exportado

Cada respuesta paginada informa el conteo de eventos de su organización. El cliente exige que el conteo permanezca estable entre páginas y que el total recuperado coincida antes de generar la descarga; si detecta altas concurrentes o una respuesta truncada, **no descarga** el archivo. Este control no sustituye una transacción D1 de lectura ni protege contra alteraciones de eventos ya existentes por un administrador de base de datos.

El archivo contiene `integrity.algorithm=SHA-256`, `integrity.encoding=JSON.stringify(events)` e `integrity.sha256`. La huella cubre exclusivamente `events`; no cubre `tenantId`, `exportedAt` ni otros metadatos del envoltorio. Para verificar el archivo **sin transmitir datos a terceros**, ejecutar:

```sh
node scripts/v5-verify-audit-export.mjs atlas-v5-auditoria-org-demo-AAAA-MM-DD.json
```

El verificador rechaza alteraciones de eventos, conteos inconsistentes y IDs duplicados. Para custodia formal, almacenar aparte un hash SHA-256 **del archivo completo**, el contexto de exportación y controles independientes de acceso. Una huella incorporada en el mismo archivo no demuestra autenticidad frente a un atacante capaz de modificar ambos elementos. La V5 sigue en etapa demostrativa, sin retención WORM ni garantía de evidencia regulatoria.
