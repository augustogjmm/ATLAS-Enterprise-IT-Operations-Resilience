# ATLAS Governance V1 — Diseño funcional y criterios de aceptación

**Propósito:** primer circuito integrado de gobierno tecnológico. El objetivo no es monitorear infraestructura: es registrar hechos, evaluar brechas, asignar responsabilidades y cerrar compromisos mediante evidencias.

## Alcance entregado

### Unidades de gobierno
- Verticales y equipos con responsable y ámbito.
- Evaluaciones de madurez por dominio: Arquitectura, Operaciones, Capacity, Continuidad, Gobierno, Seguridad y Proveedores.
- Capacidad de infraestructura: total, utilizada, unidad, umbral, tasa de crecimiento mensual; proyección exponencial a tres meses.
- Capacidad de equipos: FTE disponibles y comprometidos, cobertura de guardias, brechas de competencias y responsables. Se registra la capacidad del área, **no el desempeño individual de empleados**.
- Servicios de negocio: criticidad, responsable, período observado, minutos de interrupción, objetivo SLA, RTO/RPO, última prueba DR y su evidencia.
- Riesgos con probabilidad e impacto (1 a 5), responsable y referencia al origen.
- Planes correctivos con responsable, fecha y estado, vinculados a riesgos.
- Decisiones de Comité de Tecnología con responsable, riesgo vinculado, fecha y evidencia.

### Reglas automáticas implementadas

1. Assessment de madurez 1 o 2 → crea riesgo vinculado con estado «Sin plan».
2. Registro de capacidad de infraestructura con utilización igual o superior a umbral → crea riesgo vinculado con estado «Sin plan».
3. Capacity de equipos con carga igual o superior al umbral **o** cobertura operativa menor a 90 % → crea riesgo vinculado.
4. Riesgos críticos sin plan, acciones vencidas, capacity en alerta y servicios críticos con DR no aprobado se calculan automáticamente.
5. La existencia de una acción vinculada representa «Con plan»; completar una acción requiere evidencia.
6. Validar una mitigación exige todas las acciones vinculadas completadas y un segundo registro de evidencia. **Completar una acción no equivale a cerrar un riesgo**.

### Cálculos auditables
- Exposición = probabilidad × impacto, de 1 a 25. Crítico ≥ 15, alto 9–14, medio 5–8, bajo 1–4.
- Utilización = usado / total × 100.
- Proyección de capacity = utilización actual × (1 + crecimiento mensual / 100)³.
- Carga del equipo = FTE asignados / FTE disponibles × 100.
- Disponibilidad = (minutos del período - minutos de interrupción) / minutos del período × 100.
- SLA incumplido si disponibilidad calculada es inferior al objetivo del servicio.
- Acciones vencidas si vencimiento < fecha del día y estado ≠ completada.
- Preparación DR no validada si un servicio crítico no tiene resultado «Prueba aprobada».

### Modo de persistencia
Los registros se guardan en **localStorage** con una versión de esquema, por navegador y origen. Se puede descargar JSON como respaldo, importar y restaurar la demostración. Sin sesiones, datos compartidos, APIs de terceros ni infraestructura monitoreada.

**Limitación intencional de seguridad:** ATLAS funciona públicamente como demo. No cuenta con autenticación ni control de acceso sobre un backend: por eso **no se cargan datos empresariales privados y no se incorpora D1 hasta diseñar acceso seguro**. Un usuario puede explorar y modificar su espacio local sin afectar el de otros visitantes, pero el almacenamiento del navegador no constituye una plataforma empresarial multiusuario.

## Prueba funcional obligatoria

1. Crear un assessment de madurez 2 en una vertical; comprobar riesgo vinculado con estado «Sin plan».
2. Crear una acción con responsable y fecha; comprobar estado «Con plan».
3. Completar con evidencia; intentar validar con evidencia insuficiente (debe fallar).
4. Validar mitigación con evidencia suficiente; comprobar que el riesgo queda registrado como validado.
5. Crear capacity superior al umbral; comprobar la creación de riesgo.
6. Crear capacity de equipo con cobertura inferior a 90 %; comprobar riesgo vinculado.
7. Actualizar evidencia de ensayo DR de un servicio; verificar estado e indicadores.
8. Recargar la página y comprobar persistencia; exportar datos y revisar JSON.
9. Verificar diseño y navegación en escritorio y móvil, ausencia de errores JavaScript.
10. Comprobar que el simulador de resiliencia histórico sigue accesible en `/simulador.html`.

## Evolución prevista (no implementada)

- **D1 y autenticación:** usuarios, roles, verticales asignadas, permisos, auditoría por actor, control de importaciones, respaldos, migración segura de datos y aislamiento por organización.
- **KPI/OKR:** objetivos, resultados clave, responsables, períodos, fórmula, fuente, metas y evidencias.
- **Incidentes/ITSM:** importaciones CSV, calidad de datos, indicadores de incidentes, MTTR, SLA de servicios, análisis de tendencias.
- **Continuidad avanzada:** planificación, fechas obligatorias de revisión, resultados RTO/RPO medidos, evidencias, riesgos, planes y aprobaciones por niveles.
- **Action Management avanzado:** estados de bloqueo, dependencias, notificaciones, recordatorios y seguimiento periódico.
- **Capacity avanzado:** histórico de mediciones, tendencias reales, forecasting con supuestos y fuentes verificables.

Todos los datos precargados se identifican como ficticios. Los motores de cálculo nunca deberán aparentar un sistema de monitoreo real.
