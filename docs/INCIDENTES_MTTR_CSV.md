# ATLAS — Incidentes ITSM, MTTR y series históricas (V3)

## Propósito

Incorporar información periódica de incidentes a ATLAS sin recurrir a cifras artificiales en tarjetas o a conectores pagos. El módulo permite **importar CSV localmente**, registrar incidentes pendientes y su resolución, calcular KPI trazables y mostrar tendencias de los últimos seis meses.

**Datos iniciales:** conjunto de 12 incidentes completamente ficticios e identificados como demostración. Su presencia no representa monitorización o integración real. Para uso público, no cargar información corporativa confidencial.

## Esquema de importación

Encabezado obligatorio, orden flexible, separado por coma o punto y coma:

```csv
incident_id,service_id,priority,opened_at,resolved_at,summary
E-1001,s-core,P1,2026-11-18T08:00:00-03:00,2026-11-18T09:15:00-03:00,Degradación del procesamiento
E-1002,s-channel,P2,2026-11-18T10:30:00-03:00,,Incidente pendiente de resolución
```

- `incident_id`: identificador estable y único (hasta 90 caracteres).
- `service_id`: ID exacto de un servicio ya registrado en el catálogo de ATLAS. No se infieren asociaciones.
- `priority`: P1, P2, P3 o P4.
- `opened_at`: fecha y hora ISO 8601, **con zona horaria explícita**, p. ej. `2026-11-18T08:00:00-03:00` o `2026-11-18T11:00:00Z`.
- `resolved_at`: fecha/hora con zona horaria explícita; vacío si aún está abierto.
- `summary`: descripción del incidente, máximo 300 caracteres.

El parser acepta UTF-8 con BOM, comillas dobles, comillas escapadas, saltos de línea en campos entrecomillados y punto y coma. Los campos se validan antes de guardar.

## Reglas de importación

- Tamaño de archivo máximo **512 KB** y máximo de **2.000 incidentes** en el workspace.
- **Transaccional:** una fila inválida rechaza el lote íntegro, sin insertar registros parciales.
- **Idempotencia:** un mismo `incident_id` con idénticos campos se omite al reimportar.
- **Actualización limitada:** si un ID ya existe como abierto y el nuevo registro conserva su servicio, prioridad, apertura y resumen, puede agregarse `resolved_at` para cerrarlo. No se permite reabrir ni reemplazar una resolución existente.
- Si un ID ya existe con otro servicio, prioridad, fecha de apertura o descripción, se rechaza el lote por conflicto.
- El usuario confirma el lote antes de aplicarlo.
- El botón **Cerrar incidente** permite registrar una hora de resolución ISO con zona sin volver a importar.
- Los datos se guardan exclusivamente en `localStorage`; los respaldos JSON incluyen incidentes, KPI y OKR.

## Indicadores y definiciones

| Métrica | Definición |
|---|---|
| Incidentes abiertos | Tickets sin `resolved_at`, independientemente de su prioridad o antigüedad |
| Incidentes críticos abiertos | Tickets pendientes P1 o P2 |
| P1/P2 últimos 30 días | Tickets P1 y P2 **abiertos (ingresados)** en la ventana móvil de 30 días, estén cerrados o no |
| Cierres últimos 90 días | Tickets con `resolved_at` dentro de la ventana móvil de 90 días |
| MTTR últimos 90 días | Promedio de minutos desde `opened_at` hasta `resolved_at` para tickets cerrados **durante los últimos 90 días** |
| MTTR histórico por servicio | Promedio de minutos de resolución de todos los tickets cerrados de ese servicio |
| Volumen mensual | Número de tickets por mes según fecha de apertura |
| MTTR mensual | Media de duración de los tickets **resueltos en ese mes** |

Los períodos móviles utilizan los instantes UTC y el día de referencia. Los meses se agrupan por la **fecha en la zona horaria original registrada en el CSV**; el propio archivo debe definirla.

La fórmula es:

```
duración_i (minutos) = (resolución_i - apertura_i) / 60.000 ms
MTTR = suma(duración_i) / cantidad_de_incidentes_resueltos
```

Los incidentes abiertos **no entran** en el cálculo de MTTR; se muestran por separado. Si no hay tickets cerrados en el período, el MTTR se identifica **Sin datos**, no como 0 minutos.

## Tres KPI nuevos vinculables a OKR

- `mttr_90d`: tiempo medio de resolución de tickets cerrados en los últimos 90 días (minutos), objetivo de mejora **decreciente**.
- `critical_incidents_30d`: número de tickets P1/P2 ingresados en 30 días, objetivo decreciente.
- `open_incidents`: tickets sin resolución, objetivo decreciente.

La plataforma pasa de 10 a **13 indicadores calculables**. En instalaciones nuevas, la demostración incluye objetivos ilustrativos de 60 min de MTTR y 1 incidente P1/P2 en 30 días; estos valores **no son estándares del sector** ni SLA reales. Los usuarios con datos editados pueden incorporar indicadores nuevos sin perder sus registros.

## Diferencia entre MTTR y disponibilidad

**MTTR de incidentes no equivale a downtime.** Un ticket puede abrirse antes de que un servicio se interrumpa y cerrarse después de su recuperación. Por eso ATLAS **no modifica automáticamente** `downtimeMinutes`, SLA o disponibilidad al importar incidentes. Esos indicadores conservan su fuente y requieren mediciones propias de indisponibilidad.

Tampoco se calculan aquí MTBF, porcentaje de incidentes resueltos dentro del SLA, causa raíz automática o disponibilidad de negocio: esas métricas requieren fuentes y definiciones adicionales.

## Seguridad y límites

- Los archivos CSV se leen y validan **en el navegador**. No se envían por red ni se exponen como archivos remotos.
- La interfaz escapa campos controlados por usuario antes de incorporarlos al HTML.
- No hay login, permisos, segregación de organizaciones ni auditoría independiente. No usar datos bancarios, productivos, personales ni información sensible.
- No se habilita Cloudflare D1, servicios externos ni planes pagos nuevos.
- El histórico sirve para tendencias de tickets cargados, **no es un historial de monitoreo verificado**.

## Pruebas

`tests/incidents.test.js`: parser, transaccionalidad, idempotencia, duplicados, timestamps, cierres, períodos, MTTR, series y conservación del estado.

`scripts/governance-smoke.mjs`: importación CSV desde Chromium, cálculo de duración, cierre manual, persistencia, captura escritorio/móvil y regresión de los flujos de gobierno anteriores.

## Evolución prevista (fuera de alcance)

1. ETL configurable y mapeo de columnas para exportaciones distintas de Jira Service Management, ServiceNow u otras herramientas.
2. Importación de objetivos SLA con ventanas de afectación y calendario para medir cumplimiento por ticket.
3. Segmentación KPI/OKR por servicio, criticidad y vertical.
4. Reportes ejecutivos por período, auditoría multiusuario y sincronización segura con autenticación.
