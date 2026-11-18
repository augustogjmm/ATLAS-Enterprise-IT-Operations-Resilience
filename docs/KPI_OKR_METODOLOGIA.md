# ATLAS — KPI y OKR tecnológicos (V2)

## Propósito

Medir resultados tecnológicos verificables sin inventar métricas ni capturas de monitoreo. **Los KPI se calculan exclusivamente desde registros que existen en el workspace local**. Los OKR permiten asociar esos indicadores a compromisos con responsables, plazo, línea base y meta.

Todos los datos iniciales son ficticios; los ejemplos no representan resultados de ninguna empresa ni sistemas productivos.

## Indicadores disponibles

| Código | Indicador | Fórmula / definición | Dirección |
|---|---|---|---|
| `critical_unmanaged` | Riesgos críticos sin plan | Riesgos abiertos con exposición ≥ 15/25 y ninguna acción asociada | Menor |
| `overdue_actions` | Acciones vencidas | Acciones no completadas con fecha objetivo anterior al día actual | Menor |
| `risk_coverage` | Cobertura de tratamiento | Riesgos abiertos con ≥1 acción / riesgos abiertos × 100 | Mayor |
| `capacity_alerts` | Alertas de capacidad | Recursos sobre umbral + equipos con sobrecarga o cobertura inferior al 90 % | Menor |
| `dr_verified` | Continuidad crítica validada | Tier 1 con SLA cumplido y prueba DR aprobada en los últimos 180 días / Tier 1 total × 100 | Mayor |
| `sla_compliance` | Cumplimiento de SLA | Servicios con disponibilidad calculable y objetivo cumplido / servicios medidos × 100 | Mayor |
| `availability_mean` | Disponibilidad media | Promedio **simple** de disponibilidad por servicio con datos | Mayor |
| `assessment_maturity` | Madurez de assessments | Promedio simple de calificaciones registradas, entre 1 y 5 | Mayor |
| `team_coverage` | Cobertura de equipos | Promedio simple de la cobertura operativa de los equipos cargados | Mayor |
| `decisions_overdue` | Decisiones de comité vencidas | Decisiones pendientes con fecha objetivo anterior al día actual | Menor |

**Sin información suficiente** (por ejemplo, sin servicios para evaluar SLA o sin riesgos para analizar cobertura), el KPI devuelve `null` y se representa como «Sin evaluar», no como «0 %» ni como cumplimiento.

**No implementado:** MTTR, MTBF, disponibilidad ponderada, SLA calculado desde incidentes CSV y presupuestos reales. No se incorporan cifras sintéticas para simular dichos KPI.

## KPI ITSM incorporados en V3

| Código | Indicador | Fórmula / definición | Dirección |
|---|---|---|---|
| `mttr_90d` | MTTR (90 días) | Promedio de minutos entre apertura y resolución de tickets cerrados en los últimos 90 días | Menor |
| `critical_incidents_30d` | P1/P2 (30 días) | Número de tickets P1/P2 ingresados durante los últimos 30 días, resueltos o abiertos | Menor |
| `open_incidents` | Incidentes pendientes | Tickets sin fecha de resolución | Menor |

La versión V3 ofrece **13 KPI**. Los tres nuevos derivan exclusivamente de los incidentes cargados en el navegador. MTTR no equivale a duración de caída del servicio y no altera los indicadores SLA ni la disponibilidad registrada. Ver [contrato CSV y metodología MTTR](INCIDENTES_MTTR_CSV.md).

## Evaluación de metas

Cada KPI posee nombre, métrica predefinida, meta y responsable. Sus unidades y dirección de mejora provienen del catálogo.

- **Verde:** valor actual cumple o supera la meta en la dirección adecuada.
- **Ámbar:** desvío no superior al 10 % de la escala de meta (mínimo una unidad de referencia).
- **Rojo:** desvío superior al 10 %.
- **Gris:** datos insuficientes.

Este semáforo de KPI es distinto del semáforo operativo (que usa umbrales y tratamiento de riesgos). Las reglas son explícitas y testeadas.

## Resultados clave

Los KR enlazan un objetivo y un KPI, una **línea base** y una **meta final**. El progreso se obtiene por:

```text
avance (%) = limitar[0,100]((valor actual - línea base) / (meta - línea base) × 100)
```

Una meta menor que la línea base es apropiada para KPI donde la mejora consiste en disminuir el valor (p. ej. «riesgos sin plan»). La meta no puede retroceder respecto de la dirección de mejora del indicador.

Los objetivos agrupan el progreso de sus KR como promedio simple. Se presenta cuántos KR pudieron medirse; si algunos carecen de datos, se advierte expresamente.

**Cierre:** un objetivo solo puede cerrarse si todos sus KR tienen medición, y exige una evidencia textual. Se guardan resultados y avance al momento del cierre para evitar que cambios posteriores reescriban su historial. Un objetivo cerrado puede tener avance inferior al 100 %; «cerrado» no equivale a «cumplido».

## Ejemplos de automatización

1. El responsable registra una brecha de madurez 2/5; ATLAS genera un riesgo automáticamente.
2. El comité asigna un plan con responsable y fecha.
3. Disminuye la cantidad de riesgos sin plan y mejora la cobertura de tratamiento.
4. Los KPI vinculados actualizan su valor y los KR relacionados recalculan su avance.
5. Se completa el plan con evidencia y se valida el riesgo por separado.
6. El objetivo puede cerrarse con acta de evidencia, preservando la medición de ese momento.

## Compatibilidad de datos

La información permanece en el mismo `localStorage` que utiliza ATLAS Governance. Los registros anteriores se conservan y solo se agregan los campos `kpis`, `objectives`, `keyResults` cuando faltan.

- Un espacio nuevo inicia con ejemplos de KPI y OKR **ficticios**.
- Un espacio existente ya personalizado no recibe objetivos inventados de manera automática.
- La pantalla permite cargar ejemplos voluntariamente, sin sobrescribir riesgos ni servicios existentes.
- La exportación/importación JSON incluye los nuevos campos.
- No hay sincronización multiusuario, autenticación, D1 ni edición de datos productivos.

## Pruebas

`tests/performance.test.js` cubre fórmulas, no-datos, metas, cambios en riesgos, migración y cierre con evidencia. `scripts/governance-smoke.mjs` cubre interfaz, altas de KPI/OKR, vínculos, recarga, respaldo y otras funciones de Gobierno.

## Próximos pasos

1. Importación verificable de incidentes ITSM desde CSV y cálculo trazable de MTTR, incidentes recurrentes y SLA por período.
2. KPI por vertical/servicio y series históricas.
3. Integración entre backlog de acciones, comité y decisiones presupuestarias.
4. Backend seguro y multiusuario con permisos, auditoría e identidad, previa evaluación de Cloudflare D1.
