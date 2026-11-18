# ATLAS — IT Governance & Operations Management

### Gobierno de Tecnología: KPI, OKR, incidentes ITSM, capacity, riesgos y continuidad

**ATLAS** es un proyecto personal demostrativo para roles de Head of IT, Gerencia de Infraestructura, Operaciones Tecnológicas y Arquitectura Empresarial. El propósito es mostrar cómo se organiza el **gobierno de tecnología basado en registros, responsables, prioridades y evidencias**, no solamente indicadores visuales.

> **Versión funcional V4:** plataforma estática, con operaciones reales sobre datos almacenados en **el navegador del usuario**. El contenido de inicio es 100% ficticio, identificado como demostración. No monitorea infraestructura ni conecta servicios productivos. No utiliza todavía D1 ni autenticación multiusuario.

## ATLAS V5 — Evolución multiusuario en desarrollo (PR #8)

> **Esta rama no es la versión publicada.** La V4 de `main` continúa pública y exclusivamente local. V5 no ha creado D1, habilitado Cloudflare Access ni activado servicios de pago.

La rama V5 incorpora una API con membresías multi-tenant, roles (`owner`, `admin`, `editor`, `auditor`, `viewer`), persistencia preparada para Cloudflare D1, verificación de JWT de Access, protección CSRF y auditoría separada. La persistencia incluye un historial de las cinco versiones más recientes de cada workspace, con restauración autorizada y auditada como nueva revisión. La interfaz incorpora un panel **Conectar V5** de activación voluntaria, selección de organización/workspace, lectura y guardado por revisión, exportación de cambios ante un conflicto, consulta de auditoría y gestión básica de roles.

El modo local sigue siendo el predeterminado y conserva su `localStorage`. Abrir un workspace remoto **no sobrescribe los registros V4 locales**. Copiar un respaldo local al servidor exige confirmaciones expresas. Sin la configuración autenticada de Access y D1, el modo remoto falla cerrado y la V4 local permanece disponible.

**Validación:** la CI ejecuta tests de negocio, identidad, RBAC, aislamiento multi-tenant y Chromium con API remota simulada; **no demuestra todavía un despliegue real con Cloudflare Access+D1**. Ver [arquitectura, controles y condiciones de activación de V5](docs/ARQUITECTURA_ATLAS_V5.md).

## ¿Qué podés hacer?

| Área | Operaciones disponibles |
|---|---|
| **Incidentes ITSM** | Importar CSV con validación, deduplicación y cierres; calcular MTTR, P1/P2, pendientes, históricos mensuales y métricas por servicio, procesados localmente. |
| **KPI / OKR** | Definir indicadores y objetivos con responsables y metas, vincular KR con KPI, calcular avances desde registros, registrar cierre con evidencia y congelar valores al cerrar. |\n| **Verticales y equipos** | Registrar unidades de gestión con responsables y ámbitos, comparar madurez y exposición. |
| **Capacity tecnológico** | Registrar consumo/total por recurso, umbrales y tasa de crecimiento; calcular utilización y proyección a tres meses. Una medición sobre el umbral genera un riesgo vinculado. |
| **Capacity de equipos** | Registrar FTE disponibles/asignados, cobertura operativa, brechas de reemplazo o habilidades. Sobrecarga o cobertura baja dispara un riesgo. No se evalúa desempeño individual. |
| **Assessments** | Registrar dimensiones, puntuación 1 a 5, hallazgos, responsables y evidencia. Calificación 1 o 2 crea un riesgo automáticamente. |
| **Riesgos** | Registrar probabilidad, impacto y exposición; identificar riesgos sin plan y vincularlos con assessments, capacidades o servicios. |
| **Planes de acción** | Asignar compromisos a riesgos, responsable, fecha objetivo y evidencia. Solo permite completar una acción con evidencia y validar mitigación después de cerrar todas las acciones vinculadas. |
| **Continuidad / disponibilidad** | Administrar servicios, criticidad, objetivo SLA, minutos observados de caída, resultado y evidencia de ejercicios DR, objetivos RTO/RPO. |
| **Comité de Tecnología** | Registrar decisiones, responsables, fecha, riesgo asociado y constancia de resolución. |
| **Centro ejecutivo** | Calcular automáticamente riesgos críticos sin plan, acciones vencidas, servicios críticos con DR sin validar y alertas de capacidad. |
| **Respaldo** | Exportar / importar el estado como JSON y comenzar desde datos de prueba o un espacio vacío. |

## Circuito funcional que demuestra el proyecto

1. **Assessment:** registrar un hallazgo en una vertical con puntuación de madurez baja.
2. **Riesgo:** ATLAS crea automáticamente un riesgo vinculado, inicialmente **sin plan**.
3. **Plan de acción:** definir responsable y fecha. El riesgo pasa a **con plan**.
4. **Ejecución:** completar la acción aportando evidencia.
5. **Cierre:** validar la mitigación del riesgo con evidencia independiente.
6. **Indicadores:** la situación ejecutiva se actualiza a partir de los registros y sus relaciones.

La segunda automatización vincula **mediciones de capacity sobre el umbral** con riesgos. Los KPI y KR se recalculan cuando los registros cambian: un riesgo que recibe un plan modifica la cobertura, los riesgos sin plan y los OKR que dependan de esas métricas. La puntuación de exposición resulta de **probabilidad × impacto**, no de un modelo probabilístico.

## ITSM: incidentes, importación flexible y métricas derivadas

ATLAS importa incidentes desde CSV con identificador, servicio, prioridad P1–P4, apertura, resolución ISO 8601 con zona horaria y descripción. Se valida todo el lote antes de aplicar cambios y se reconocen IDs repetidos sin duplicar registros.

El módulo calcula MTTR de 90 días, P1/P2 de 30 días, incidentes abiertos, estadísticas por servicio y tendencias mensuales. Se incorporan tres nuevos KPI vinculables a OKR: MTTR (min), P1/P2 y pendientes. **Total: 13 métricas calculables.**

**Novedad V4:** importa CSV de distintas herramientas mediante asistente de columnas, servicios, prioridades y zonas horarias explícitas. Filtra incidentes por vertical y servicio y permite definir KPI con alcance de una vertical para alimentar OKR segmentados. No equivale a conectarse directamente con ServiceNow o Jira.

Importante: MTTR de tickets no es indisponibilidad real. El CSV no modifica automáticamente los minutos de caída ni los indicadores SLA de servicios.

## Ejecución local

Requiere Node.js 22 o posterior, sin instalar dependencias para el build.

```bash
npm run check
npm test
npm run build
python -m http.server 8080 --directory dist
```

Abrir `http://localhost:8080`. La aplicación principal es **ATLAS Governance**. El simulador anterior de resiliencia permanece disponible en `/simulador.html`, separado del flujo de gestión.

La CI incorpora pruebas automatizadas del dominio y pruebas en Chromium que cubren formularios, reglas de negocio, trazabilidad, persistencia, exportación y móvil.

## Arquitectura

```text
Navegador / ATLAS Governance
  ├── public/index.html          -> experiencia de gobierno
  ├── public/governance.css      -> presentación responsive
  ├── public/governance.js       -> formularios, gestión, respaldos
  ├── src/governance/core.js     -> motor de dominio determinista\n  ├── src/governance/insights.js -> semáforos ejecutivos, matriz de riesgos y status por vertical\n  ├── src/governance/performance.js -> métricas KPI y progreso de OKR verificables
  ├── src/governance/incidents.js -> importación CSV, incidentes, MTTR y tendencias
  ├── public/incidents-ui.js -> panel de incidentes y CSV\n  ├── public/performance-ui.js  -> tablero de indicadores y objetivos
  └── localStorage              -> persistencia por navegador

Simulador conceptual anterior
  ├── public/simulador.html
  ├── public/app.js
  └── src/engine.js + src/data.js
```

El build copia `public/` y `src/` a `dist/`, preparado para **Cloudflare Workers Static Assets** sin backend dinámico, secretos ni pago obligatorio.

## KPI / OKR: funcionalidad real y límites

Un KPI selecciona una **fórmula predefinida**, un objetivo numérico y un responsable. El sistema deriva su valor de los registros locales del workspace; cuando no existe base suficiente, aparece **«Sin evaluar»**, nunca un falso «en meta».

Los OKR tienen responsables, fecha de inicio/fin y resultados clave relacionados con los KPI. Cada KR requiere línea base y meta; su progreso deriva del KPI y se limita al intervalo 0–100 %. El promedio del objetivo solo considera KR medidos, con advertencia si existen KR sin datos. El cierre requiere evidencia y congela el resultado observado en ese instante.

La pantalla **KPI y OKR tecnológicos** incorpora demostraciones ficticias en una instalación nueva. Los usuarios con registros ya editados conservan todos sus datos; pueden crear sus propios KPI o incorporar ejemplos voluntariamente sin sobrescribir los registros operativos.

Los KPI disponibles son un **catálogo acotado de mediciones calculables**, no una plataforma completa de gestión de incidentes o importación ITSM. Todavía no hay fórmulas personalizadas por vertical, series históricas, presupuestos reales ni integraciones productivas.

## Seguridad y límites de uso

**Persistencia real, pero local y de un solo navegador:** los registros pueden modificarse, mantenerse tras recargar y exportarse/importarse. **No son datos compartidos ni sincronizados en la nube**. Si se borra el almacenamiento del navegador o se utiliza otro dispositivo, los registros no estarán disponibles sin importar un respaldo. No hay autenticación, permisos, auditoría independiente o acceso multiusuario.

**No cargar información empresarial confidencial ni datos personales.** Este entorno público está concebido como demostración. Los datos iniciales son ficticios; si el usuario introduce información propia, la aplicación no puede verificarla automáticamente.

La siguiente evolución prevista es D1 + autenticación + control por roles, previo diseño de seguridad y validación de cuotas del plan gratuito. Quedan pendientes conectores ITSM productivos, mapeo de formatos de terceros, KPI por vertical y auditoría de origen. No se declaran implementados.

## Documentación

- [Modelo y criterios del primer circuito funcional](docs/GOBIERNO_FUNCIONAL_V1.md)\n- [Definiciones y metodología KPI/OKR](docs/KPI_OKR_METODOLOGIA.md)
- [Importación ITSM, CSV y metodología MTTR](docs/INCIDENTES_MTTR_CSV.md)
- [Asistente de mapeo CSV y KPI segmentados por vertical](docs/IMPORTACION_FLEXIBLE_Y_KPI_VERTICAL_V4.md)
- [Simulador de resiliencia y su arquitectura](docs/ARCHITECTURE.md)
- [Guía de Cloudflare](docs/DESPLIEGUE_CLOUDFLARE.md)
- [Seguridad](SECURITY.md)

**Autor:** Augusto García Juárez Matorras · [LinkedIn](https://www.linkedin.com/in/augustog/)

No se ha asignado aún una licencia general de reutilización.
