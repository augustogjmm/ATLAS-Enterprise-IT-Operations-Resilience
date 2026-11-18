# ATLAS V4 — Importación ITSM flexible y KPI por vertical

## Qué cambia

La importación CSV ahora incluye un **asistente de mapeo en el navegador**. Se reciben exportaciones de distintas herramientas ITSM que tengan identificador, servicio, prioridad, apertura, resolución y resumen, aunque sus encabezados sean diferentes. Esto **no significa conexión directa con ServiceNow o Jira Service Management**: el usuario descarga sus archivos y los importa manualmente.

La vista Incidentes y MTTR incorpora filtros por vertical y servicio: KPI, tendencias y tablas se recalculan para el alcance seleccionado. Los KPI de ATLAS (13 fórmulas) se pueden crear con alcance **Corporativo** o de una **vertical específica**, y los OKR que dependan de esos KPI utilizan la misma segmentación.

## Asistente CSV: pasos y reglas

1. Seleccionar un CSV hasta 512 KB (sin enviarlo a ningún servidor).
2. Revisar **mapeo de columnas**; el sistema sugiere encabezados reconocibles en español e inglés, pero permite asignar otras columnas manualmente. La columna de resolución es opcional; las demás son obligatorias.
3. Resolver cada valor de **servicio del archivo** contra un servicio existente en el catálogo ATLAS. Se sugiere la coincidencia de ID o nombre **exacto** normalizado; nunca se inventa un servicio.
4. Asignar cada valor de **prioridad del archivo** a P1–P4. Solo P1, P2, P3 o P4 se sugieren automáticamente. No se interpreta unilateralmente que «Alta», «Critical», «Urgent» o «1» equivale a una prioridad específica.
5. Elegir formato de fecha: ISO `AAAA-MM-DD HH:mm`, ISO con `T`, o `DD/MM/AAAA HH:mm`. La hora de origen debe incluir un huso explícito o el usuario debe especificar un desplazamiento como `-03:00` o `Z`. La app **no asume la zona horaria del navegador**.
6. Revisar previsualización (tres filas), confirmar el lote y validar todo antes de modificar datos.
7. Aplicar la importación con las reglas existentes: deduplicación, actualización controlada de resolución de tickets abiertos y rechazo **transaccional** de archivos incompatibles.

El asistente limita el número de valores distintos de servicios o prioridades que permite mapear a 50 por archivo. Para otros catálogos, preparar CSV por lotes u homologar las etiquetas.

### Ejemplo de exportación de terceros

```csv
Issue key,Service,Severity,Created Date,Resolution Date,Short Description
TK-100,Core transaccional,Alta,2026-11-18T08:00:00-03:00,2026-11-18T09:15:00-03:00,Servicio degradado
```

Al cargar, la persona debe confirmar que `Alta` se considera `P1`, además de la asociación `Core transaccional` → `s-core` sugerida por nombre.

### Ejemplo de fechas locales

```text
18/11/2026 10:00
```

Requiere elegir formato `DD/MM/AAAA` y escribir el desplazamiento de zona horaria correspondiente, por ejemplo `-03:00`.

## KPI segmentados: criterio de alcance

Todos los indicadores del catálogo pueden calcularse para un **conjunto de registros de una vertical**:

- Riesgos: únicamente riesgos de la vertical; sus acciones vinculadas determinan cobertura y vencimientos.
- Capacity: recursos de infraestructura y equipos pertenecientes a esa vertical.
- Continuidad/SLA: únicamente los servicios de la vertical.
- Assessments: únicamente evaluaciones de esa vertical.
- Comité: decisiones con riesgo vinculado a dicha vertical; las decisiones generales sin riesgo asociado quedan exclusivamente en consolidado corporativo, para evitar atribuciones artificiales.
- Incidentes: registros de los servicios vinculados con la vertical, a través de su `service_id`.

**Importante:** un KPI sin registros suficientes devuelve «Sin evaluar» en lugar de un cero artificial. Un objetivo corporativo no hereda automáticamente el alcance de sus KR: cada KR sigue el alcance del KPI que referencia, y el usuario puede combinar indicadores de distintas verticales en un objetivo.

### Filtro adicional por servicio

La pantalla **Incidentes y MTTR** ofrece filtros de vertical y servicio. Se recalculan los casos abiertos, P1/P2, MTTR, volúmenes mensuales, tiempos de cierre y tabla de incidentes. Los filtros **no modifican** el estado guardado ni el alcance de los KPI: si se elige un servicio, el gráfico muestra una exploración puntual y los semáforos de KPI muestran «Sin meta» hasta que exista una meta específica de ese alcance. Los KPI persistidos admiten actualmente alcance corporativo o por vertical, no por servicio.

## Precisión metodológica y seguridad

- Los incidentes importados no sustituyen registros de indisponibilidad ni SLA. MTTR de tickets **no** es tiempo de caída del servicio.
- No se conectan herramientas de terceros ni se transmiten CSV a servidores.
- Almacenamiento local, sin cuentas ni permisos multiusuario. No cargar información bancaria confidencial o datos personales.
- Se conservan respaldos JSON de versiones anteriores y su significado. La segmentación se deriva de los servicios y verticales existentes, sin agregar esquemas de persistencia nuevos.
- No se modifican ni contratan servicios de Cloudflare de pago.

## Pruebas

`tests/import-mapping.test.js` cubre:
- Detección de encabezados sin equivalencias ambiguas.
- Valores y prioridades de terceros, incluido CSV delimitado por punto y coma.
- Fechas ISO y DD/MM con zona horaria explícita y rechazo de fechas imposibles.
- Columnas duplicadas, IDs/servicios inválidos, transacciones y reimportación.
- Segmentación por servicio y vertical en incidentes, tendencias y KPI.
- No-datos reales y rechazo de scope inexistente.

`scripts/governance-smoke.mjs` recorre la UI: selección y mapeo CSV, importación y cierre de tickets, fechas DMY, filtros de vertical, KPI y OKR, persistencia, exportación y móvil.

## Evolución pendiente

Mapeo guardable por origen y versión de esquema, vistas de calidad de datos, fuente y proceso de conciliación, filtros KPI a nivel de servicio y series históricas de resultados para comité. Todo ello requerirá controles de acceso si ATLAS incorpora almacenamiento compartido en el futuro.
