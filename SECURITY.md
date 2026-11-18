# Seguridad y protección de la información — ATLAS

## Alcance de la demostración

ATLAS Governance es una aplicación pública, orientada a demostrar circuitos de gobierno y operaciones de TI. La versión actual almacena registros únicamente en `localStorage` del navegador. Cada navegador conserva sus propios cambios, y el usuario puede exportarlos o importar un respaldo JSON.

**No ingresar datos empresariales confidenciales, personales o regulados.** El almacenamiento local no ofrece las garantías de autenticación, auditoría, segregación ni control de acceso necesarias para uso corporativo.

Los registros precargados, incidentes, responsables, costos y escenarios son ficticios. Las alertas, KPI y conclusiones se calculan desde los registros que existen en cada navegador: **no constituyen medición real de infraestructura**.

## Controles implementados

- Sin endpoints públicos de escritura, autenticación externa, telemetría ni base de datos cloud en esta versión.
- Validación de estructura y consistencia de JSON importado; límite de tamaño de archivo.
- Presentación con escape HTML para los campos provistos por el usuario.
- Reglas que requieren evidencia antes de completar acciones y validar mitigaciones.
- Pruebas de modelo y navegador en GitHub Actions.
- Datos y cambios no se envían a servicios externos desde la aplicación.

## Limitaciones relevantes

- Borrar el almacenamiento del navegador elimina el estado local si no se exportó un respaldo.
- Los respaldos JSON no están cifrados.
- Personas con acceso al mismo perfil de navegador pueden ver los datos almacenados.
- No existen cuentas, roles, auditoría por usuario ni aprobación multiusuario.
- El registro local de un cierre no reemplaza una aprobación organizacional formal.

La futura incorporación de Cloudflare D1 deberá ir precedida de autenticación, aislamiento de organizaciones, permisos por rol, control de acceso a APIs, políticas de retención y pruebas de seguridad.


## V5 en desarrollo: postura de seguridad y controles pendientes

La rama `feature/atlas-v5-multiusuario-gobierno` añade validación criptográfica de JWT de Cloudflare Access en el Worker, segregación por `tenant_id`, RBAC verificado por servidor, control de revisión y auditoría de operaciones de workspace/membresía. Las solicitudes de escritura requieren encabezado anti-CSRF y verificación de origen; los cuerpos JSON se limitan mientras se reciben a 1 MiB por operación. Las restauraciones requieren rol `owner` o `admin`, generan revisión nueva y se auditan. La UI remota es opt-in, y V4 conserva su modo local sin solicitar sesiones por defecto. No se han habilitado aún Cloudflare Access, la base D1 ni el Worker V5.

**Esta implementación todavía no está aprobada para información real.** Las pruebas de seguridad y de usuario utilizan datos sintéticos y un backend simulado; deben completarse pruebas integradas de identidad y D1, procedimientos de backup/restauración, retención y eliminación, monitoreo de consumo y revisión de autorización antes de ponerla en producción. La auditoría de D1 no es un repositorio WORM ni prueba por sí sola cumplimiento regulatorio. No se registran tokens ni datos de workspaces en los eventos de auditoría.

## Reportes

No incluir contraseñas, tokens, identificadores internos, diagramas privados ni información sensible en issues públicos. Para comunicar una vulnerabilidad que pueda revelar datos, contactar al propietario mediante su perfil profesional antes de publicar detalles. No se declara auditoría externa ni un acuerdo de niveles de respuesta.
