# ATLAS V5 — Hitos de cierre para versión definitiva

**Control:** 19/11/2026. **Rama:** feature/atlas-v5-multiusuario-gobierno; PR #8.
Este documento no autoriza despliegue ni cambios de infraestructura.

**Condición irrevocable del proyecto:** costo monetario **USD 0**, sin plan Workers Paid,
suscripciones, dominios pagos ni recursos con cobro por uso. Solo se autoriza la
arquitectura conservadora de [costo cero](COSTO_CERO_ATLAS_V5.md); si una cuota se
agota, el servicio debe limitar operaciones, **nunca solicitar ni activar un upgrade**.
La verificación del plan real de Cloudflare está **bloqueada por permisos API 403**,
de modo que V5 debe permanecer sin publicar hasta comprobarlo por una vía autorizada.

## Acceso al producto

- **V4 publicada:** https://atlas-enterprise-it-operations-resilience.augusto-garciajm.workers.dev/ — datos demostrativos almacenados en el navegador.
- **V5 en desarrollo:** https://github.com/augustogjmm/ATLAS-Enterprise-IT-Operations-Resilience/pull/8 — sin dirección pública propia.

## Cuatro puertas objetivas

| Puerta | Criterio de salida | Estado |
|---|---|---|
| 1. Candidato local | Pruebas Node, Chromium V4/V5, RBAC, JWT firmado, D1 local, concurrencia y recuperación; topes de 20 workspaces, 10 miembros activos por organización y 2.000 eventos globales de auditoría | **En cierre** |
| 2. Identidad y datos remotos | Comprobar plan Workers Free y Zero Trust Free, **costo cero y cuotas disponibles**; Worker V5 y D1 aislados, Access deny-by-default, migraciones y cuentas sintéticas | **Bloqueada hasta verificar plan gratuito; sin activación** |
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
