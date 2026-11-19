# ATLAS — Caso de producto y arquitectura

## Executive summary

**ATLAS** es un ejercicio de diseño y construcción de un producto de gobierno tecnológico centrado en la toma de decisiones. Parte de un problema frecuente: la dirección de IT dispone de información técnica, pero necesita convertirla en prioridades, responsables, mitigaciones y evidencias de ejecución.

**Enfoque:** relacionar los registros que explican un riesgo con las acciones que lo reducen y las decisiones que habilitan su tratamiento. La prioridad no es producir más indicadores, sino construir un circuito de gobierno verificable.

**Alcance:** producto de demostración personal con datos sintéticos y pruebas automatizadas; no representa una implantación corporativa ni resultados operativos de empresas reales.

## Decisiones de producto

### 1. De la alerta a la responsabilidad

Los hallazgos pueden originarse en evaluaciones de madurez o registros de capacidad. La regla de negocio traduce determinadas condiciones en riesgos asociados, que se siguen mediante compromisos, responsables, fechas y evidencias. La validación de una mitigación requiere que se hayan completado los planes vinculados.

**Valor para la dirección:** facilita distinguir entre identificar un problema, asignar su tratamiento y verificar su cierre.

### 2. Métricas calculables y límites explícitos

Los KPI y OKR se calculan a partir del estado almacenado, con fórmulas predefinidas y restricciones documentadas. Si no existe información suficiente, la solución no debe fingir que una meta está cumplida.

La importación de incidentes permite obtener métricas de tickets como MTTR. **MTTR no es disponibilidad**: no se equiparan resoluciones de incidentes con minutos de indisponibilidad de servicios.

**Valor para la dirección:** exige explicar el origen y alcance de una cifra antes de convertirla en un compromiso.

### 3. Continuidad como decisión de arquitectura y gestión

El simulador de resiliencia separa dependencias de componentes, rutas alternativas, RTO/RPO y efectos estimados de intervenciones. Su modelo determinista está diseñado para contrastar supuestos y discutir inversiones, no para certificar DR, costos o cumplimiento.

**Valor para la dirección:** permite preguntar qué sucede cuando fallan recursos compartidos y qué evidencia debe requerirse a una estrategia de recuperación.

### 4. Presentación ejecutiva sin perder profundidad

V5 integra la identidad visual aprobada: **«Visibilidad para decidir.»**, Core y ocho dominios multindustria, perspectiva de capacidad/disponibilidad/riesgo, panel de prioridades y recorrido responsive.

El objetivo es ofrecer una primera lectura clara para la dirección y un acceso posterior a registros y reglas. Los dominios del mapa son **categorías de navegación**, no un descubrimiento automático de dependencias.

## Arquitectura: responsabilidades y evolución

| Capa | V4 en `main` | V5 en PR #8 |
| --- | --- | --- |
| Experiencia | ATLAS Governance y simulador de resiliencia | Command ejecutivo V4 aprobado, integrado con módulos existentes |
| Reglas de negocio | JavaScript ESM determinista y validaciones | Reglas preservadas y controles de rol adicionales |
| Datos | `localStorage` + exportación/importación JSON | Implementación de workspace multiusuario con D1 en pruebas locales |
| Identidad y autorización | No disponible en versión pública V4 | JWT de Cloudflare Access, segregación por tenant y roles en código |
| Evidencia y revisión | Tests de modelo, integración de navegador | Revisión, auditoría, concurrencia, recuperación y pruebas de Worker locales |
| Estado de despliegue | Versión pública que puede consultarse en Workers | Homologación remota y publicación multiusuario pendientes |

**Separación deliberada:** la V4 funcional se mantuvo publicada mientras se desarrollaba V5 en una rama y un pull request de revisión. No se representa un éxito de CI como garantía de disponibilidad de una infraestructura real.

### Decisiones de ingeniería

- **Módulos con responsabilidad identificable.** Separación entre reglas de dominio y presentación, para que la interfaz no defina el negocio.
- **Pruebas como control de cambio.** Construcción reproducible, test unitario, exploración de navegador y recorridos de Worker/D1 locales.
- **Gobierno de datos.** Estados vacíos cuando no existen registros, etiquetado de información de demostración, exportación y trazabilidad de revisiones.
- **Fail-closed en integración remota.** La ausencia de autorización, de configuración validada o de identidad verificable no debe tratarse como permiso implícito.
- **Contención de costos.** El objetivo USD 0 es una restricción de diseño; no se declara conseguido sin evidencia de facturación y cuotas efectivas.

## Qué se puede evaluar al revisar el repositorio

| Dimensión de liderazgo tecnológico | Evidencia en ATLAS |
| --- | --- |
| **Estrategia tecnológica** | Definición de alcance, escenarios y límites del producto. |
| **Arquitectura empresarial** | Vinculación conceptual de dominios, dependencias y servicios. |
| **IT Operations Management** | Datos de incidentes, indicadores, recursos y acuerdos de servicio. |
| **Gobierno y riesgo** | Flujo de hallazgo → riesgo → plan → evidencia → validación. |
| **Continuidad y resiliencia** | Discusión explicable de fallas, rutas de respaldo y recuperación. |
| **Calidad de software** | Pruebas reproducibles, conservación de módulos y documentación de límites. |
| **Gestión del cambio** | Evolución V4/V5 aislada de producción y compuertas de liberación. |

Estas asociaciones describen **lo que muestra este proyecto**, no certificaciones, implantaciones ni resultados de negocio de terceros.

## Recorrido de lectura recomendado

**En 2 minutos:** [README](../README.md) → [Guía de demo](DEMO_GUIDE.md).

**En 10 minutos:** [Gobierno funcional](GOBIERNO_FUNCIONAL_V1.md) → [KPI/OKR](KPI_OKR_METODOLOGIA.md) → [Incidentes y MTTR](INCIDENTES_MTTR_CSV.md).

**En revisión técnica:** [Seguridad](../SECURITY.md) → [Arquitectura del simulador](ARCHITECTURE.md) → [PR V5](https://github.com/augustogjmm/ATLAS-Enterprise-IT-Operations-Resilience/pull/8) y sus controles en GitHub Actions.

## Autor y contexto

**Augusto García Juárez Matorras**, profesional de tecnología con más de 20 años de experiencia en la industria financiera y trayectoria en gestión de infraestructura crítica, arquitectura, ingeniería y operaciones. El proyecto reúne una perspectiva técnica y ejecutiva sobre **cómo gobernar servicios críticos y tomar decisiones trazables**.

[Perfil profesional en LinkedIn](https://www.linkedin.com/in/augustog/)

*ATLAS es un proyecto personal, demostrativo y multindustria. No incluye información de clientes, topologías empresariales privadas ni datos operativos de empleadores anteriores.*
