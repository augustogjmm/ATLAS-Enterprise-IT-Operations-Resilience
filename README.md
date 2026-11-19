# ATLAS
### Technology Governance · IT Operations · Executive Decision Intelligence

**De la complejidad tecnológica a decisiones con responsables, prioridades y evidencia.**

ATLAS es una aplicación demostrativa de gobierno y operaciones de tecnología. Conecta registros de infraestructura, continuidad, capacidad, incidentes, riesgos, planes de acción y objetivos para responder una pregunta de dirección: **¿qué necesita atención, por qué importa y quién debe actuar?**

El proyecto muestra tanto una visión ejecutiva como los mecanismos que la sostienen: datos estructurados, reglas de negocio verificables, trazabilidad entre entidades y pruebas automatizadas.

**[Abrir la demostración pública](https://atlas-enterprise-it-operations-resilience.augusto-garciajm.workers.dev/)** · **[Explorar el recorrido funcional](docs/DEMO_GUIDE.md)** · **[Ver evolución V5 (PR #8)](https://github.com/augustogjmm/ATLAS-Enterprise-IT-Operations-Resilience/pull/8)**

> **Estado de versiones — 19/11/2026:** `main` contiene **ATLAS V4**, una aplicación funcional con persistencia local en el navegador. La interfaz premium V5 y el backend multiusuario con Cloudflare Access/D1 están desarrollados en el **PR #8 (borrador)** y validados en entornos de prueba; **no deben confundirse con capacidades publicadas en producción**. La dirección pública sigue mostrando la versión anterior mientras no se realice un despliegue verificado. Todos los datos iniciales son **ficticios**.

---

## Qué problema resuelve

En organizaciones con servicios críticos, la información de incidentes, capacidad, resiliencia y riesgos suele quedar repartida entre equipos y herramientas. Una dirección tecnológica necesita relacionar esas señales antes de priorizar inversión, mitigación y continuidad.

ATLAS propone un circuito unificado de **observación → evaluación → riesgo → acción → evidencia → decisión**. No pretende sustituir un ITSM empresarial ni ser una plataforma de monitoreo en tiempo real.

## Capacidades funcionales de V4

| Dimensión | Qué se puede hacer |
| --- | --- |
| **Gobierno y equipos** | Administrar verticales, responsables y evaluaciones de madurez. |
| **Riesgos y remediación** | Registrar probabilidad e impacto, generar riesgos desde hallazgos y capacidad, vincular planes y exigir evidencia de cierre. |
| **Operaciones e incidentes** | Importar CSV mediante un asistente de columnas, validar y deduplicar incidentes, calcular MTTR y tendencias. |
| **Capacidad tecnológica y de equipos** | Registrar utilización, umbrales, cobertura y proyección de recursos; crear riesgos por desvíos. |
| **Continuidad y disponibilidad** | Gestionar SLA, disponibilidad calculada, RTO/RPO y resultados documentados de pruebas de recuperación. |
| **KPI y OKR** | Seguir indicadores derivados de registros, vincular resultados clave y conservar evidencia de cierre. |
| **Comité y decisiones** | Registrar decisiones, responsable, fecha objetivo, riesgo asociado y resolución. |
| **Portabilidad de datos** | Exportar e importar un respaldo JSON desde el navegador. |

### Un circuito de decisión que se puede probar

```text
Assessment de un dominio
         │ Hallazgo de baja madurez
         ▼
 Riesgo identificado ──► Priorización por impacto y probabilidad
         │
         ▼
 Plan de acción + responsable + fecha
         │
         ▼
 Ejecución y evidencia documentada
         │
         ▼
 Validación de mitigación
         │
         ▼
 Indicadores y comité de tecnología
```

El ejemplo es **funcional, no una animación**: la información se modifica mediante formularios, las reglas operan sobre esos registros y el tablero refleja sus cambios.

## Visión de producto: ATLAS V5

**“Visibilidad para decidir.”** es la identidad visual aprobada para la evolución V5: navegación compacta, indicadores editoriales, **Core** y ocho dominios tecnológicos, cinco perspectivas, prioridades de dirección y experiencia responsive.

La rama de desarrollo incorpora, además, un modelo multiusuario con aislamiento por organización, roles, versiones de workspace, auditoría y ejercicios locales de recuperación. **Su implementación en código y las pruebas no equivalen a activación en Cloudflare.**

| Disponible en la rama V5 | Pendiente de habilitación operativa |
| --- | --- |
| Diseño ejecutivo integrado en la aplicación real | Homologación de Cloudflare Access y D1 en la cuenta |
| Roles, workspaces y aislamiento probados localmente | Verificación de costos, cuotas y configuración remota |
| Auditoría, control de concurrencia y recuperación local | Despliegue y validación final con identidades reales |
| Pruebas de navegador a 1700 px y 430 px | Certificación WCAG AA y fidelidad visual exhaustiva |

**[Diseño, evidencias y diferencias conocidas](docs/DEMO_GUIDE.md)** · **[PR de evolución V5](https://github.com/augustogjmm/ATLAS-Enterprise-IT-Operations-Resilience/pull/8)**

## Calidad de ingeniería

[![ATLAS · Calidad y reproducibilidad](https://github.com/augustogjmm/ATLAS-Enterprise-IT-Operations-Resilience/actions/workflows/quality.yml/badge.svg?branch=main)](https://github.com/augustogjmm/ATLAS-Enterprise-IT-Operations-Resilience/actions/workflows/quality.yml)

- **Motor determinista:** métricas reproducibles a partir de registros; no se inventan datos de operación.
- **Validaciones de dominio:** restricciones de cierre, trazabilidad de acciones y consistencia de importaciones.
- **Pruebas de extremo a extremo:** escenarios en Chromium sobre formularios, persistencia, importaciones, exportaciones y pantallas móviles.
- **Separación de responsabilidades:** módulos de dominio, presentación y preparación de artefactos estáticos.

### Ejecutar localmente

Requiere **Node.js 22 o superior** y Python 3 para el servidor estático de ejemplo.

```bash
git clone https://github.com/augustogjmm/ATLAS-Enterprise-IT-Operations-Resilience.git
cd ATLAS-Enterprise-IT-Operations-Resilience
npm run check
npm test
npm run build
python -m http.server 8080 --directory dist
```

Abrir **http://localhost:8080/**. El simulador de resiliencia anterior continúa disponible en **/simulador.html**. La ejecución local no requiere credenciales de Cloudflare.

## Arquitectura y documentación

| Documento | Para qué sirve |
| --- | --- |
| [Guía de demostración](docs/DEMO_GUIDE.md) | Recorrido corto para una entrevista o revisión ejecutiva. |
| [Caso de producto y liderazgo](docs/CASE_STUDY.md) | Decisiones de arquitectura, gobierno, evidencia y evolución del producto. |
| [Arquitectura y decisiones](docs/ARCHITECTURE.md) | Separación de componentes y límites técnicos. |
| [Gobierno funcional](docs/GOBIERNO_FUNCIONAL_V1.md) | Reglas que convierten hallazgos en riesgos y acciones. |
| [Metodología KPI/OKR](docs/KPI_OKR_METODOLOGIA.md) | Definiciones, alcances y fórmulas. |
| [Incidentes y MTTR](docs/INCIDENTES_MTTR_CSV.md) | Interpretación de métricas e importación de registros. |
| [Importación flexible V4](docs/IMPORTACION_FLEXIBLE_Y_KPI_VERTICAL_V4.md) | Mapeo de CSV y segmentación. |
| [Seguridad y limitaciones](SECURITY.md) | Alcance demostrativo, datos locales y manejo responsable. |
| [Evolución V5](https://github.com/augustogjmm/ATLAS-Enterprise-IT-Operations-Resilience/pull/8) | Desarrollo, pruebas y revisión pendiente. |

## Sobre el autor

**Augusto García Juárez Matorras** — líder de tecnología con más de 20 años de trayectoria en servicios financieros, infraestructura crítica, ingeniería y operaciones. Experiencia en gestión de equipos multidisciplinarios, arquitectura empresarial, continuidad, transformación tecnológica y gobierno de servicios críticos.

ATLAS es un **proyecto personal de demostración**: expresa una manera de abordar problemas de dirección tecnológica mediante sistemas, datos, responsabilidades y decisiones verificables. **No representa un sistema interno ni expone información de empleadores anteriores.**

[LinkedIn profesional](https://www.linkedin.com/in/augustog/) · [Perfil de GitHub](https://github.com/augustogjmm)

---

<sub>**Uso y límites.** Los registros iniciales son sintéticos y no constituyen monitoreo real. No ingresar información personal, confidencial o regulada. Los datos de la versión pública se guardan en el navegador; limpiar su almacenamiento puede eliminarlos. **No hay licencia de reutilización concedida** mientras el propietario no publique expresamente una. El acceso público al código no supone autorización para copiarlo, redistribuirlo o explotarlo comercialmente.</sub>
