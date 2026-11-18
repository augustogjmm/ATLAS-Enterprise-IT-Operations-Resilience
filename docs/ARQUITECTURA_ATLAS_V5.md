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

Todos los permisos se verifican en el **servidor**, nunca solo en botones. Cada consulta SQL incluye un alcance explícito `tenant_id`; un UUID de workspace de otra organización siempre responde sin datos. Los miembros revocados pierden la autorización a nivel API. Nadie puede cambiar su propia membresía desde esta API.

**Fuera de esta fase:** aprobadores independientes de riesgos, segregación por vertical o registro individual (ABAC), SSO corporativo real e integración de directorios. No afirmar que estos controles ya están implementados.

### 3. Persistencia

Migración `migrations/0001_atlas_v5.sql`:

- `atlas_tenants`: organizaciones activas/suspendidas.
- `atlas_memberships`: correo, `sub` verificado, rol, estado.
- `atlas_workspaces`: snapshot completo V4 de cada espacio, revisión incremental, fechas y autor.
- `atlas_audit_events`: creación, actualización y modificaciones de acceso.

Se preservan las estructuras y cálculos de V4; no se cambia `SCHEMA_VERSION=1` del dominio mientras los registros sean compatibles. La importación de JSON histórico exige aprobación del usuario y no reemplaza automáticamente los datos remotos.

La edición exige `revision`. Dos editores que intenten modificar la misma revisión no pueden pisarse silenciosamente: la segunda escritura recibe **HTTP 409**. Actualización y evento de auditoría se ejecutan en un lote D1 transaccional; el cambio se registra con identidad, fecha y revisión. En esta fase, el snapshot tiene un límite de 1 MiB y la bitácora lista hasta 100 eventos recientes.

**Importante:** la auditoría está separada de `state.events` editable por usuarios, pero no es inmutable frente a un administrador de la propia base de datos. Una auditoría de cumplimiento formal precisará retención controlada, integridad/almacenamiento externo y procedimiento de revisión.

### 4. API V5

| Método | Ruta (prefijo `/api/v1`) | Uso |
|---|---|---|
| GET | `/session` | Identidad firmada y organizaciones autorizadas |
| GET | `/tenants/:tenant/workspaces` | Listado acotado |
| POST | `/tenants/:tenant/workspaces` | Crear vacío o cargar snapshot V4 validado |
| GET | `/tenants/:tenant/workspaces/:id` | Leer estado y revisión |
| PUT | `/tenants/:tenant/workspaces/:id` | Guardar con control de concurrencia |
| GET | `/tenants/:tenant/audit` | Bitácora solo para roles autorizados |
| GET | `/tenants/:tenant/members` | Directorio controlado |
| PUT | `/tenants/:tenant/members/:email` | Alta, cambio de rol o revocación por usuario privilegiado |

No existen endpoints anónimos de escritura. Las mutaciones requieren JSON, controlan origen, tamaño y permisos. No se permite CORS abierto. Todas las respuestas API usan `Cache-Control: no-store`.

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
5. Crear D1 nueva (después de la autorización), ejecutar `migrations/0001_atlas_v5.sql` con protección de datos. Provisionar en forma controlada un registro en `atlas_tenants` y una membresía inicial `owner` de correo autorizado.
6. Activar Cloudflare Access para **V5 únicamente**, con lista de correos autorizados y audiencia propia; restringir producción y previews.
7. Probar denegación sin JWT, acceso de editor/viewer/auditor, revocación, fuga entre organizaciones, conflicto 409 y exportación/recuperación de respaldo.
8. Conectar la UI V4 a la API bajo **modo multiusuario explícito**, sin sobrescribir `localStorage` ni migrar automáticamente. Incorporar selector de organización/workspace, tratamiento visible de conflictos y diálogo de importación.
9. Desplegar V5 solo después de validar el circuito completo. Mantener rollback a V4 y procedimientos de respaldo y restauración.

**Punto de avance actual:** infraestructura lógica, controles de acceso, esquema SQL, API y pruebas; **integración visual de workspace remoto, activación de Access, provisionamiento D1 y publicación V5 quedan pendientes**.

### 7. Gobierno técnico de V5

- **Seguridad:** acceso por mínimo privilegio; no cargar datos bancarios ni personales en la demo; no usar contraseñas caseras ni secretos en código.
- **Cambios:** PR con revisión y CI, sin despliegue automático desde esta rama y sin push directo a `main`.
- **Calidad:** prueba de identidad firmada, aislamiento multi-tenant, RBAC, idempotencia y concurrencia; reproducir las pruebas V4.
- **Disponibilidad:** V4 se mantiene independiente como fallback. V5 se habilita gradualmente.
- **Datos:** alta y revocación formal de miembros; definir clasificación, ciclo de vida, exportación, respaldo, restauración y plazos de conservación antes de uso real.
- **Observabilidad:** bitácora de cambios orientada a auditoría sin registrar tokens, datos completos ni archivos de usuarios en logs.
- **Responsabilidades:** solo los roles adecuados pueden administrar accesos; un proceso de aprobación independiente requiere siguiente iteración.
