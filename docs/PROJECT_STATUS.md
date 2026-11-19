# ATLAS — Estado verificable del producto

**Última revisión documental:** 19 de noviembre de 2026.

Este archivo separa **disponibilidad pública**, **implementación en código** y **pruebas**. Evita presentar prototipos, simulaciones o pipelines como funcionalidades productivas confirmadas.

| Dimensión | V4 en `main` | V5 en PR #8 |
| --- | --- | --- |
| Experiencia de usuario | Gobierno IT funcional, responsive | Diseño editorial aprobado «Visibilidad para decidir.» |
| Datos | Persistencia local y exportación/importación JSON | Modelo de workspaces multiusuario y revisiones |
| Modelo de gobierno | Riesgos, acciones, capacidad, KPI/OKR, incidentes, comité | Funcionalidad preservada e integrada con el command ejecutivo |
| Identidad/autorización | Sin cuentas ni roles | Implementación de Access JWT + roles en el código |
| Persistencia compartida | No | Código D1 y pruebas con bases locales de test |
| Publicación | Versión pública existente | **No verificada en producción** |
| Pruebas | GitHub Actions de `main` | GitHub Actions de PR, Chromium y Worker/D1 locales |
| Garantía de costo cero | No proclamada | **No verificada:** acceso a facturación/API denegado |

**V4 publicada ≠ V5 implementada ≠ V5 desplegada.**

## Principales evidencias

- [Repositorio y código fuente](https://github.com/augustogjmm/ATLAS-Enterprise-IT-Operations-Resilience)
- [Pipeline de calidad](https://github.com/augustogjmm/ATLAS-Enterprise-IT-Operations-Resilience/actions/workflows/quality.yml)
- [Pull request de V5](https://github.com/augustogjmm/ATLAS-Enterprise-IT-Operations-Resilience/pull/8)
- [Contrato de diseño y QA visual de V5](https://github.com/augustogjmm/ATLAS-Enterprise-IT-Operations-Resilience/blob/feature/atlas-v5-multiusuario-gobierno/docs/ATLAS_V4_DESIGN_INTEGRATION_QA.md)
- [Controles de costo V5](https://github.com/augustogjmm/ATLAS-Enterprise-IT-Operations-Resilience/blob/feature/atlas-v5-multiusuario-gobierno/docs/COSTO_CERO_ATLAS_V5.md)
- [Runbook local de recuperación V5](https://github.com/augustogjmm/ATLAS-Enterprise-IT-Operations-Resilience/blob/feature/atlas-v5-multiusuario-gobierno/docs/RUNBOOK_OPERACION_RECUPERACION_V5.md)

## Qué representa la calidad declarada

Los resultados de GitHub Actions acreditan que el código de una revisión **pasó las comprobaciones automatizadas configuradas para esa revisión**. Las capturas de navegador muestran una interfaz ejecutada con datos demostrativos. Ninguna de esas evidencias certifica seguridad integral, accesibilidad normativa, operación productiva, cadena de custodia regulatoria o disponibilidad de un servicio externo.

## Principales próximos hitos para operar V5

1. Verificar plan, facturación y cuotas del entorno Cloudflare utilizado.
2. Homologar identidad Cloudflare Access real y segregación de tenants en un entorno aislado.
3. Probar procedimiento y RPO/RTO de recuperación D1 sobre recursos de pruebas.
4. Completar evaluación de accesibilidad y comparación visual contra el contrato V4.
5. Autorizar formalmente el despliegue, ejecutar pruebas postpublicación y registrar el commit efectivamente publicado.

Estos hitos son **pendientes operativos**, no funcionalidades anunciadas como terminadas.

---

Para entender el propósito del producto y sus decisiones de diseño, ver [Caso de estudio](CASE_STUDY.md) y [Guía de demostración](DEMO_GUIDE.md).
