# ATLAS — Guía de demostración ejecutiva

**Duración sugerida:** 5–7 minutos · **Público:** CIO, CTO, IT Director, Head of IT, responsables de operaciones y selección ejecutiva.

La demostración utiliza registros **sintéticos**. No se muestran métricas productivas, información de clientes, infraestructura real ni datos de empleadores.

## Apertura: el desafío de dirección (45 segundos)

> Una dirección de tecnología necesita algo más que tableros: necesita asociar señales operativas con exposición, responsables y acciones verificables. ATLAS permite recorrer un circuito de gobierno desde el registro inicial hasta la decisión.

Abrí la [aplicación pública](https://atlas-enterprise-it-operations-resilience.augusto-garciajm.workers.dev/) o ejecutala localmente. La rama pública puede mostrar V4 hasta que exista un despliegue V5 confirmado.

## Recorrido funcional de ATLAS Governance V4

| Momento | Recorrido | Qué demuestra |
| --- | --- | --- |
| 0:45–1:45 | **Verticales / Assessments:** revisar una evaluación e identificar una dimensión de madurez reducida. | Las observaciones se registran con contexto y responsables. |
| 1:45–2:45 | **Riesgos:** mostrar el riesgo generado desde un assessment o desde una capacidad que superó su umbral. | El hallazgo pasa a exposición priorizable y no queda aislado en un reporte. |
| 2:45–3:45 | **Planes de acción:** asociar compromiso, responsable y fecha; revisar los requisitos de evidencia para cerrar. | La remediación tiene trazabilidad y controles de finalización. |
| 3:45–4:45 | **KPI/OKR:** observar cómo las reglas recalculan los indicadores cuando cambian los registros. | El reporte ejecutivo deriva del dato de gestión y no de números escritos a mano. |
| 4:45–5:45 | **Continuidad o incidentes:** consultar SLA/RTO/RPO documentados o importar CSV y analizar MTTR. | Se distingue disponibilidad registrada, objetivos de recuperación y métricas de tickets. |
| 5:45–6:30 | **Comité:** vincular un riesgo con una decisión, responsable y fecha. | La arquitectura técnica se conecta con la gobernanza. |

La mayoría de los módulos se pueden explorar sin modificar registros. Para demostrar una operación, utilizar exclusivamente datos sintéticos y, antes de editar, exportar un respaldo JSON.

## Simulador de resiliencia (recorrido alternativo, 3 minutos)

En **/simulador.html** está disponible un ejercicio diferente del módulo de gobierno:

1. Elegir el escenario ficticio de caída de un centro de datos.
2. Comparar rutas alternativas y objetivos de recuperación de servicios.
3. Revisar el impacto de fallas correlacionadas sobre la redundancia.
4. Comparar intervenciones de automatización y sus supuestos de CAPEX/OPEX.
5. Exportar un JSON con resultados estimados.

**Aclaración técnica:** los cálculos representan escenarios, no disponibilidad, probabilidad de falla, cumplimiento de SLA ni resultados de ejercicios DR reales.

## Evolución V5 — qué mostrar y qué no prometer

La rama de desarrollo [V5 (PR #8)](https://github.com/augustogjmm/ATLAS-Enterprise-IT-Operations-Resilience/pull/8) incorpora la experiencia editorial **«Visibilidad para decidir.»**, Core y ocho dominios, cinco perspectivas, prioridades de dirección y adaptación móvil.

También implementa en código funcionalidades multiusuario, persistencia D1 y autenticación mediante Cloudflare Access, probadas en entornos sintéticos y locales. **No confundir el PR y su CI con un despliegue validado en producción.** Las capturas de 1700 y 430 px se producen en la ejecución de pruebas y quedan como artefactos de GitHub Actions, sujetos a retención temporal.

## Tres preguntas que vale la pena discutir

**¿Cómo se decide qué mitigar primero?** Relacionando criticidad de servicios, exposición de riesgos y capacidad de ejecución, con criterios de priorización visibles.

**¿Qué evidencia valida una mejora?** No alcanza cambiar un semáforo; debe existir un compromiso trazable, resultado documentado y validación del cierre.

**¿Dónde agrega valor un líder técnico con experiencia de gestión?** En traducir dependencias, continuidad, capacidad y arquitectura en decisiones de recursos, coordinación, inversión y riesgos.

## Limitaciones y ética de la demostración

- Ninguna cifra inicial es una medición empresarial real.
- No hay conexión productiva a ServiceNow, Jira ni sistemas de monitoreo.
- Los datos de V4 se guardan en el navegador y pueden borrarse al limpiar su almacenamiento.
- No cargar información empresarial confidencial o datos regulados.
- Las reglas y resultados de simulación son explicables, pero no sustituyen controles organizacionales formales.

**Contacto profesional:** [Augusto García Juárez Matorras — LinkedIn](https://www.linkedin.com/in/augustog/).
