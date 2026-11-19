# ATLAS V5 — Arquitectura multiusuario, persistencia y gobierno

**Estado:** primera implementación aislada en rama de desarrollo; **NO desplegada**.  
**Base verificada:** V4 integrada en `main`, merge de PR #7 (`dc4a25e`).  
**Contrato:** no alterar la V4 existente ni incurrir en nuevos cargos. No añadir información confidencial o personal a esta demo.

## Decisión de arquitectura (ADR V5-001)

Mantenemos el **monolito modular** y todas las reglas de dominio y visualizaciones V4; incorporamos una capa de API separada, autenticación delegada y almacenamiento de bajo costo.

```text
ATLAS V4 vigente                    ATLAS V5 (separado, sin publicar)
Workers Static Assets público       Workers Static Assets + script solo en /api/*
localStorage por navegador          Cloudflare Access (autenticación)
                                    JWT RS256 validado por Worker
                                    autorización por organización y rol
                                    D1 (SQLite) por binding ATLAS_DB
                                    estados V4 por workspace + revisión
                                    bitácora de auditoría de servidor
```

No se propone microservicios, Kubernetes, contenedores, Supabase, R2, colas, KV, correo transaccional, bases por usuario ni suscripciones adicionales. D1 aloja tablas multi-tenant, **no una base por cliente**. Las vistas y KPI siguen recalculándose con el motor ya implementado.

### 1. Identidad y acceso

Cloudflare Access autentica usuarios de la aplicación V5. La aplicación valida **criptográficamente** `Cf-Access-Jwt-Assertion` (algoritmo RS256, firma mediante JWKS HTTPS de la cuenta, `iss`, `aud`, vencimiento, `sub` y correo). **Jamás** se confía en un encabezado `X-User` o correo provisto por el cliente. `ctx.access` no está disponible en el script de Workers Static Assets: esta validación explícita es indispensable.

Cloudflare Access **aún no está activado** en la cuenta. Según la documentación de noviembre de 2026, su registro en el plan Zero Trust Free puede requerir datos de pago incluso si no cobra la suscripción. **No activarlo ni aceptar términos económicos sin autorización específica.** La aplicación falla en modo cerrado sin `ACCESS_AUD`, `ACCESS_TEAM_DOMAIN` o D1.

La organización del usuario debe existir y el correo debe estar preautorizado en `atlas_memberships`. En el primer acceso exitoso, el `sub` se asocia a la membresía. La identidad de una organización nunca autoriza automáticamente el ingreso a otra.

### 2. Autorización (RBAC)

| Rol | Consultar workspace | Editar | Leer auditoría | Administrar miembros |
|---|---:|---:|---:|---:|
| `owner` | Sí | Sí | Sí | Sí, incluso roles privilegiados |
| `admin` | Sí | Sí | Sí | Sí, excepto owner/admin |
| `editor` | Sí | Sí | No | No |
| `auditor` | Sí | No | Sí | No |
| `viewer` | Sí | No | No | No |

Todos los permisos se verifican en el **servidor**, nunca solo en botones. Cada consulta SQL incluye un alcance explícito `tenant_id`; un UUID de workspace de otra organización siempre responde sin datos. Los miembros revocados pierden la autorización a nivel API. Nadie puede cambiar su propia membresía desde esta API. La gestión de roles revalida la autoridad del actor y el rol real del destinatario en el SQL de escritura (no confía solo en la consulta inicial). La bitácora de cambios de acceso guarda el rol/estado previo y el nuevo usando una lectura transaccional, sin registrar operaciones denegadas.

**Fuera de esta fase:** aprobadores independientes de riesgos, segregación por vertical o registro individual (ABAC), SSO corporativo real e integración de directorios. No afirmar que estos controles ya están implementados.

### 3. Persistencia

Migración `migrations/0001_atlas_v5.sql` (sin `PRAGMA foreign_keys=ON` porque D1 impone integridad referencial y no permite ejecutar esa sentencia; en SQLite nativo los fixtures la habilitan):

- `atlas_tenants`: organizaciones activas/suspendidas.
- `atlas_memberships`: correo, `sub` verificado, rol, estado.
- `atlas_workspaces`: snapshot completo V4 de cada espacio, revisión incremental, fechas y autor.
- `atlas_audit_events`: creación, actualización y modificaciones de acceso.

Se preservan las estructuras y cálculos de V4; no se cambia `SCHEMA_VERSION=1` del dominio mientras los registros sean compatibles. La importación de JSON histórico exige aprobación del usuario y no reemplaza automáticamente los datos remotos.

**Permisos frente a carreras:** creación, modificación y restauración consultan la membresía al comienzo de cada solicitud y la revalidan nuevamente dentro de las sentencias transaccionales de D1. Si un administrador revoca o degrada el rol antes de confirmar, la operación termina en HTTP 403 sin registrar escritura, revisión ni evento de auditoría. La CI reproduce esa intercalación de manera determinista con SQLite nativo.

La edición exige `revision`. Dos editores que intenten modificar la misma revisión no pueden pisarse silenciosamente: la segunda escritura recibe **HTTP 409**. Se agregó historial acotado a las **últimas cinco versiones de cada workspace** (`migrations/0002_atlas_v5_history.sql`): las versiones antiguas se depuran al guardar, para limitar almacenamiento en D1. Los roles `owner` y `admin` pueden restaurar una versión previa, creando una revisión nueva y un evento `workspace.restored` con referencia a la revisión fuente. `auditor` puede consultar metadatos históricos sin restaurar; `editor` y `viewer` no consultan versiones previas. Actualización y evento de auditoría se ejecutan en un lote D1 transaccional; el cambio se registra con identidad, fecha y revisión. En esta fase, el snapshot tiene un límite de 1 MiB y la bitácora lista hasta 100 eventos recientes.

**Importante:** la auditoría está separada de `state.events` editable por usuarios, pero no es inmutable frente a un administrador de la propia base de datos. Una auditoría de cumplimiento formal precisará retención controlada, integridad/almacenamiento externo y procedimiento de revisión.

### 4. API V5

| Método | Ruta (prefijo `/api/v1`) | Uso |
|---|---|---|
| GET | `/session` | Identidad firmada y organizaciones autorizadas |
| GET | `/tenants/:tenant/workspaces` | Listado acotado |
| POST | `/tenants/:tenant/workspaces` | Crear vacío o cargar snapshot V4 validado |
| GET | `/tenants/:tenant/workspaces/:id` | Leer estado y revisión |
| PUT | `/tenants/:tenant/workspaces/:id` | Guardar con control de concurrencia |
| GET | `/tenants/:tenant/workspaces/:id/revisions` | Historial de hasta cinco revisiones (auditor, admin, owner) |
| PUT | `/tenants/:tenant/workspaces/:id/revisions/:revision/restore` | Restauración auditable como nueva revisión (owner/admin) |
| GET | `/tenants/:tenant/audit` | Bitácora solo para roles autorizados |
| GET | `/tenants/:tenant/audit/export` | Exportación paginada de toda la auditoría por cursor (`beforeAt`, `beforeId`), hasta 100 eventos por página, roles owner/admin/auditor |
| GET | `/tenants/:tenant/members` | Directorio controlado |
| PUT | `/tenants/:tenant/members/:email` | Alta, cambio de rol o revocación por usuario privilegiado |

No existen endpoints anónimos de escritura. Las mutaciones requieren JSON, controlan origen, tamaño y permisos. No se permite CORS abierto. Todas las respuestas API usan `Cache-Control: no-store`.

**Endurecimiento adicional:** toda mutación exige `X-Atlas-CSRF: v5`; se rechaza `Origin` distinto del origen de la app y `Sec-Fetch-Site` ajeno. El cuerpo JSON se recibe de forma incremental con un límite efectivo de 1 MiB aunque el cliente omita o falsifique `Content-Length`. No es una autenticación sustituta de Cloudflare Access: las dos defensas se aplican.

### 5. Estrategia económica

**Sin costo nuevo activado en esta rama.** Solo se agregan código, tests y migración; no se crea D1, ni Access, ni otro Worker. La V4 pública sigue exactamente igual.

Cloudflare indica en su documentación de noviembre 2026 para Workers Free: D1 incluye hasta **5 millones de filas leídas/día, 100.000 escritas/día, 5 GB totales y 10 bases**, con bloqueo de consultas al alcanzar el límite diario. Estas cuotas **no sustituyen** la verificación del plan y el uso real de la cuenta. Los archivos estáticos son gratuitos; las llamadas al Worker consumen las cuotas de Workers. Antes de habilitar V5, corroborar Workers Free, políticas de facturación, cuotas y advertencias del panel. No promover automáticamente a un plan pago.

Referencias oficiales:
- https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/
- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/d1/platform/pricing/
- https://developers.cloudflare.com/workers/configuration/cloudflare-access/
- https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
- https://developers.cloudflare.com/learning-paths/clientless-access/initial-setup/create-zero-trust-org/

### 6. Preparación de despliegue controlado (pendiente)

1. Finalizar PR, ejecutar `npm run check`, `npm test`, `npm run build` y las pruebas Chromium vigentes. Corregir cualquier falla antes de fusionar.
2. Confirmar que V4 funciona con su URL `workers.dev` y que permanece sin cambios.
3. Verificar plan gratuito de Cloudflare, posibles datos de pago para Access y permiso explícito para activarlo.
4. Preparar V5 **en un Worker independiente**; copiar `config/wrangler.v5.example.jsonc` a la configuración de la rama de despliegue e incluir valores reales, sin credenciales en GitHub.
5. Crear D1 nueva (después de la autorización), ejecutar **en orden** `migrations/0001_atlas_v5.sql` y `migrations/0002_atlas_v5_history.sql` con protección de datos. Provisionar en forma controlada un registro en `atlas_tenants` y una membresía inicial `owner` de correo autorizado.
6. Activar Cloudflare Access para **V5 únicamente**, con lista de correos autorizados y audiencia propia; restringir producción y previews.
7. Probar denegación sin JWT, acceso de editor/viewer/auditor, revocación, fuga entre organizaciones, conflicto 409 y exportación/recuperación de respaldo.
8. **Implementado en la rama V5:** UI de conexión explícita y selección de organización/workspace, edición con revisión, modo solo lectura, consulta de auditoría y miembros, exportación ante conflictos y confirmación al crear un workspace copiando V4. Se utiliza el `localStorage` V4 solo en modo local; no hay migración silenciosa. La UI de administración de roles es funcional pero provisional (diálogos nativos), pendiente de rediseño para la experiencia ejecutiva.
9. Desplegar V5 solo después de validar el circuito completo. Mantener rollback a V4 y procedimientos de respaldo y restauración.

**Punto de avance actual:** API, esquema SQL, autenticación firmada, autorización RBAC, aislamiento de organizaciones, interfaz opt-in V5 y pruebas automatizadas de navegador **implementadas en la rama de desarrollo**. CI valida pruebas de dominio, autenticación firmada, API y gobierno, junto con dos suites de navegador V4 y dos suites V5; la homologación contra Access y D1 remotos permanece pendiente. Pendiente: activar Access, crear y provisionar D1 (previa autorización), probar endpoints sobre recursos Cloudflare reales, revisión de seguridad y despliegue independiente. La V4 pública no se modificó.

**Seguridad de publicación:** `.gitignore` excluye credenciales locales (`.dev.vars`, `.env`), cachés Cloudflare, bases SQLite de prueba y artefactos de navegador. La CI ejecuta `scripts/v5-release-preflight.mjs`: comprueba que no se versionen credenciales, no se incorpore configuración raíz de despliegue, no existan acciones de publicación automática y sigan disponibles los controles de respaldo y migración. Este gate deliberadamente impide publicar V5 accidentalmente y deberá ser revisado bajo un PR autorizado cuando corresponda.

**Endurecimiento de claves:** el verificador valida formato y consistencia temporal de `iat`, `exp`, `nbf` y longitud de identidad; ante una clave `kid` que todavía no figura en caché, solicita JWKS nuevamente con límite de consultas para evitar abuso por tokens inválidos. Se verifican la rotación y el rechazo de valores mal tipados. La rotación de JWKS es un compromiso operativo entre disponibilidad y frescura, no una revocación instantánea.

**Recuperación comprobable local:** `scripts/v5-recovery-drill.mjs` usa las migraciones SQL, ejecuta operaciones con el Worker real, exporta una copia SQLite **solo dentro del runner**, compara SHA-256, comprueba `integrity_check` y `foreign_key_check`, recupera la base en una ruta separada y comprueba nuevas escrituras, rollback histórico y conservación de la bitácora. No ejecuta la herramienta oficial de exportación de D1 ni valida un RPO/RTO en Cloudflare.

**Prueba criptográfica integrada:** `tests/v5-signed-access-api.test.js` genera un par RSA de prueba, firma JWT temporales y verifica el Worker real contra un JWKS sintético sin red. Comprueba autenticación, aislamiento de tenant, asociación de `sub`, denegación para viewer, revocación aunque el JWT siga vigente, auditoría y protecciones CSRF. No reemplaza Cloudflare Access real ni un test de D1 real.

**Validaciones incrementales:** los guardados remotos requieren evidencia para acciones completadas, riesgos validados, decisiones resueltas y objetivos cerrados; el servidor rechaza intentos de alterar o eliminar registros ya finalizados o cambiar el origen de un incidente (HTTP 422). Esta política evita la omisión directa de validaciones visuales, aunque no sustituye una aprobación independiente formal. La suite ejecuta ahora `scripts/v5-multiuser-smoke.mjs`: **Worker real + SQLite local + varios contextos Chromium**, con identidades ficticias y pruebas de concurrencia/revocación. Ver [runbook operativo](RUNBOOK_OPERACION_RECUPERACION_V5.md).

### 7. Comportamiento de la interfaz opt-in

- La pantalla pública se abre en **V4 local**, sin solicitudes a `/api/v1` en el arranque.
- «Conectar V5» ejecuta la verificación de sesión. Recién entonces se listan organizaciones y workspaces permitidos.
- «Abrir workspace» carga un snapshot compartido y su revisión. Navegación, formularios, KPI y CSV reutilizan el motor funcional V4, pero los guardados se envían al Worker.
- En un workspace remoto de lectura, los formularios se bloquean visualmente, además de estar prohibidos por el servidor. El rol se consulta desde la API y nunca se considera suficiente para autorizar operaciones de backend.
- Las modificaciones remotas se serializan: mientras se guarda una revisión, se bloquean nuevas escrituras. La operación solo se confirma visualmente tras recibir respuesta del servidor.
- Ante HTTP 409 o fallo que impida confirmar la escritura, se suspenden más cambios remotos, se conservan los datos editados en memoria y se ofrece exportación JSON. Recargar o volver al modo local requiere confirmación.
- Ante pérdida de respuesta del servidor, **Verificar guardado en servidor** consulta la revisión remota mediante GET autenticado y compara el snapshot con el intento pendiente. Si coinciden, confirma esa revisión sin generar otro PUT; si difieren, mantiene los datos del navegador y pide exportar/reconciliar. No hay reintento automático de escrituras inciertas.
- La pestaña presenta aviso al cerrar o recargar si hay una operación remota pendiente o un guardado sin confirmar. **Los cambios no confirmados permanecen solo en memoria**; ATLAS no los copia silenciosamente al `localStorage` de V4.
- «Volver a V4 local» recupera el snapshot local preexistente, sin escribir en D1 ni borrar archivos `localStorage`.
- «Crear workspace» admite comenzar vacío. La copia de registros locales requiere dos confirmaciones explícitas para evitar transmisión accidental de datos.

**Cupo de crecimiento:** el backend admite como máximo **10 workspaces por organización**. El control está incluido de forma atómica en el `INSERT` SQL y devuelve HTTP 429 si el cupo se agotó, sin añadir entradas espurias al historial ni a la auditoría. Es un límite intencional de la demostración, no una capacidad máxima de Cloudflare. No elimina workspaces existentes ni datos de V4.

**Costo incremental de historial:** cada versión retenida ocupa almacenamiento D1, por lo que la retención automática de cinco versiones limita crecimiento, pero NO garantiza que las cuotas gratuitas sean suficientes para cualquier número de workspaces. Antes de desplegar, definir máximo de organizaciones/workspaces y alertas de capacidad; medir filas leídas/escritas y tamaño real de la base.

**Límites de esta etapa:** no hay sincronización en vivo, resolución automática de conflictos, aprobaciones multiusuario por flujo, firma inmutable de actas ni pruebas contra Cloudflare Access/D1 reales. Los metadatos de auditoría se escriben en D1 solo después de instalarlo y provisionarlo. Las pruebas de navegador utilizan una API simulada con respuestas controladas. Incluyen restauración de revisiones en Chromium. En CI se valida además la migración SQL con SQLite nativo, la retención de cinco versiones, restauración con control de concurrencia y la denegación entre organizaciones.

### 8. Gobierno técnico de V5

- **Seguridad:** acceso por mínimo privilegio; no cargar datos bancarios ni personales en la demo; no usar contraseñas caseras ni secretos en código.
- **Cambios:** PR con revisión y CI, sin despliegue automático desde esta rama y sin push directo a `main`.
- **Calidad:** prueba de identidad firmada, aislamiento multi-tenant, RBAC, idempotencia y concurrencia; reproducir las pruebas V4.
- **Disponibilidad:** V4 se mantiene independiente como fallback. V5 se habilita gradualmente.
- **Datos:** alta y revocación formal de miembros; definir clasificación, ciclo de vida, exportación, respaldo, restauración y plazos de conservación antes de uso real.
- **Observabilidad:** bitácora de cambios orientada a auditoría sin registrar tokens, datos completos ni archivos de usuarios en logs.
- **Responsabilidades:** solo los roles adecuados pueden administrar accesos; un proceso de aprobación independiente requiere siguiente iteración.
