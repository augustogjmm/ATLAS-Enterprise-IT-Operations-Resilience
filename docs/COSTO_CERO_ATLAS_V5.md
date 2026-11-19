# ATLAS V5 — Política de costo monetario cero

**Decisión del proyecto (19/11/2026): gasto permitido = USD 0.** El objetivo es una demostración multiusuario pequeña, no un sistema comercial con disponibilidad o escala garantizadas. Nunca autorizar por defecto un plan pago, compra de dominio, facturación por uso o servicio accesorio.

## Arquitectura admitida (y solo bajo sus planes Free)

| Recurso | Cuota pública Free documentada | Condición |
|---|---|---|
| Cloudflare Workers Free | 100.000 solicitudes al día, compartidas por cuenta; CPU 10 ms por invocación | Si se agota, el API puede fallar, sin migrar a Workers Paid |
| Workers Static Assets | Solicitudes a archivos estáticos sin costo y sin límite de cantidad | Solo la ruta `/api/*` ejecuta Worker |
| Cloudflare D1 Free | 5.000.000 filas leídas/día y 100.000 escritas/día, compartidas por cuenta | Los errores por cuota deben tratarse como indisponibilidad, sin upgrade |
| D1 Free | Hasta 10 bases por cuenta, 500 MB por base y 5 GB por cuenta | Crear como máximo **una D1 nueva y aislada** para V5, únicamente tras confirmar cuota libre |
| D1 Time Travel Free | Ventana de recuperación de 7 días | No sustituye los ensayos y respaldos exportados |
| Cloudflare Access / Zero Trust Free | Plan $0 para equipos de menos de 50 usuarios | Empezar con dos identidades de prueba; no contratar asientos pagos |

**Fuentes oficiales y fecha de verificación:** 19/11/2026.
- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/
- https://developers.cloudflare.com/d1/platform/pricing/
- https://developers.cloudflare.com/d1/platform/limits/
- https://www.cloudflare.com/es-la/products/access/

Las cuotas son de la **cuenta completa**, no de ATLAS. Las limitaciones y precios pueden cambiar. Procesar JWT, JSON grande y reglas de gobierno podría exceder 10 ms de CPU en Workers Free: debe medirse con la ejecución real antes de aprobar lanzamiento. No se garantiza disponibilidad de producción.

## Barreras técnicas ya controladas

1. `scripts/v5-zero-cost-gate.mjs` inspecciona la plantilla V5: solo se admiten un Worker nuevo llamado `atlas-enterprise-v5`, Static Assets con acceso a Worker solo en `/api/*`, una D1 independiente `atlas-v5` y variables Access. Cualquier binding o parámetro adicional hace fallar la CI.
2. `tests/v5-zero-cost-gate.test.js` comprueba que se rechazan recursos potencialmente cobrables (R2, KV, Queues, AI, Durable Objects, CPU del plan pago y bases/Workers ajenos).
3. La API limita la demo a **10 workspaces por organización, 20 workspaces globales, 10 miembros activos por organización y 2.000 eventos de auditoría globales**. Al agotarse la auditoría, **bloquea nuevas escrituras sin borrar evidencia**, devuelve HTTP 429 y mantiene las consultas. Las condiciones de capacidad se verifican dentro de las transacciones SQL y no se crean versiones ni eventos falsos. El tamaño máximo de 1 MiB por solicitud y cinco revisiones retenidas acota los snapshots. **No hay purga automática ni desbloqueo sin procedimiento explícito de conservación de evidencia.**
4. El preflight de seguridad prohíbe credenciales, archivos de configuración de despliegue raíz y publicación automática.
5. La preview automática de Cloudflare para la rama V5 sigue desactivada. Ninguno de estos controles crea servicios.

**Acción al llegar al límite de auditoría:** detener operaciones de escritura y preservar todo el historial. Una futura solución gratuita de exportación integral, retención y archivo deberá aprobarse antes de volver a aceptar nuevas escrituras. El endpoint actual de auditoría muestra solamente los últimos 100 eventos por organización: **no constituye una exportación completa**. El tope garantiza un crecimiento acotado, no un archivo oficial inmutable ni continuidad de servicio.

**Límite del gate:** inspecciona una **plantilla**, no el estado de facturación. No puede demostrar por sí solo que un futuro despliegue costará USD 0. Si alguien sustituye la plantilla o configura servicios manualmente en Cloudflare, la CI no detectará automáticamente esa mutación externa. Se requiere verificación externa previa a activar cualquier recurso.

## Verificaciones obligatorias antes de permitir uso remoto

- [ ] Comprobar en el panel de Cloudflare, con acceso de solo lectura suficiente, que la cuenta está en **Workers Free** y que Zero Trust / Access está en **Free**, sin planes de consumo pagos.
- [ ] Confirmar que las demás aplicaciones de la cuenta dejan margen real de solicitudes, CPU y cuotas D1, incluida una plaza de base libre. No tocar la D1 de otros proyectos.
- [ ] Confirmar que Access puede configurarse sin adquirir licencias ni realizar upgrade; limitar el piloto a **dos usuarios** y siempre por debajo de las plazas gratuitas.
- [ ] Evaluar las condiciones de pago o datos de tarjeta que solicite el proveedor antes de cualquier aceptación, aunque indique $0.
- [ ] Activar solo si hay autorización expresa para **recursos Free** y una verificación de costo monetario cero; nunca aceptar por defecto un upgrade.
- [ ] Medir latencia, consumo CPU, filas leídas/escritas y recuperación remota. Establecer un procedimiento para degradar a modo local al agotar las cuotas.
- [ ] Verificar en el panel que las tarifas y el consumo efectivo se mantienen en **USD 0**, sin cobros por dominio, logs ni otros complementos.

**Bloqueo actual:** la consulta de suscripciones y Zero Trust por API devuelve HTTP 403 por permisos insuficientes. No se verificó el nivel de facturación efectivo. Por lo tanto, **V5 no se despliega**.

## Accesos

- V4 demostrativa publicada, sin D1 remoto: https://atlas-enterprise-it-operations-resilience.augusto-garciajm.workers.dev/
- V5 solo código en PR, sin URL de producto: https://github.com/augustogjmm/ATLAS-Enterprise-IT-Operations-Resilience/pull/8

**Criterio de decisión:** si el proveedor exige pagar para cualquiera de las características imprescindibles, se debe simplificar la función o utilizar una alternativa gratuita. No hay excepción automática al presupuesto de USD 0.
