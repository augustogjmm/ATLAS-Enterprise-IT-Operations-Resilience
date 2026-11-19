# ATLAS V5 — Hitos de cierre para versión definitiva

**Control:** 19/11/2026. **Rama:** feature/atlas-v5-multiusuario-gobierno; PR #8.
Este documento no autoriza despliegue ni cambios de infraestructura.

## Acceso al producto

- **V4 publicada:** https://atlas-enterprise-it-operations-resilience.augusto-garciajm.workers.dev/ — datos demostrativos almacenados en el navegador.
- **V5 en desarrollo:** https://github.com/augustogjmm/ATLAS-Enterprise-IT-Operations-Resilience/pull/8 — sin dirección pública propia.

## Cuatro puertas objetivas

| Puerta | Criterio de salida | Estado |
|---|---|---|
| 1. Candidato local | Pruebas Node, Chromium V4/V5, RBAC, JWT firmado, D1 local, concurrencia, respaldo y restauración sin errores | **En cierre** |
| 2. Identidad y datos remotos | Autorización expresa de costos, Worker V5 y D1 aislados, Access deny-by-default, migraciones, tenant y owner sintéticos | **Pendiente de autorización** |
| 3. Homologación | Dos cuentas Access reales, permisos, revocaciones, revisión 409, restauración completa de D1, medición de límites y monitoreo | **Pendiente del entorno real** |
| 4. Publicación | Pruebas de aceptación funcional, controles de seguridad y accesibilidad, go/no-go, URL V5 documentada y rollback | **No iniciada** |

Las pruebas locales no equivalen a producción. No declarar RPO/RTO, autenticación de identidades reales, cumplimiento regulatorio ni backup D1 remoto sin evidencia.

## Control cruzado obligatorio

1. Comprobar SHA y estado del PR, el main de V4 y la configuración Cloudflare.
2. Validar sintaxis, comportamiento de API y tests locales antes de cada commit.
3. Subir un cambio controlado y comprobar la ejecución GitHub Actions del **mismo SHA**.
4. Revisar Cloudflare Builds, mensajes del PR y notificaciones por correo: un test verde no implica un preview correcto.
5. Si se presenta una falla, registrar causa, corrección y nueva ejecución; no declarar cierre prematuro.

**Control de Preview V5:** Cloudflare auto_build está apagado solamente para esta rama hasta autorizar y configurar una Preview real. GitHub Actions sigue ejecutándose.

**Bloqueos de versión definitiva:** costos aceptados; identidades Access; persistencia D1; recuperación real; pruebas funcionales y aprobación final. Sin esos hitos solo puede declararse una versión candidata, nunca una V5 definitiva.
