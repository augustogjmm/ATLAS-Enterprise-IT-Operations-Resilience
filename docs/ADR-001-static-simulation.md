# ADR-001 — Priorizar una simulación reproducible antes de integrar sistemas reales

**Estado:** aceptada para el MVP · **Fecha:** 18/11/2026

## Contexto

ATLAS busca demostrar criterios de gobierno tecnológico, impacto sobre servicios de negocio y decisiones de continuidad. Integrar métricas reales requeriría inventarios, credenciales, acceso a plataformas y controles de privacidad que no corresponden a un proyecto público de demostración.

## Decisión

Desarrollar una aplicación estática y explicable, sin dependencias de ejecución externas, con escenarios ficticios, lógica de dominio independiente de la interfaz, pruebas automatizadas y una salida compatible con Cloudflare. Documentar todos los supuestos y mantener separadas las reglas de negocio de su presentación.

## Consecuencias

**Ventajas:** reproducibilidad, costo bajo, ausencia de credenciales y datos sensibles, independencia del proveedor cloud en el motor, pruebas deterministas y facilidad de revisión.

**Limitaciones:** no hay telemetría ni descubrimiento real, persistencia multiusuario, mediciones de RTO/SLA ni resultados verificados de recuperación. Un modelo de DR de mayor fidelidad requiere evidencias operativas y dependencias más detalladas.

## Condiciones para revisar la decisión

Si se incorporan fuentes de datos reales, autenticación, evidencias persistentes o flujos de aprobación, evaluar un backend Cloudflare Worker y servicios como D1, KV o Durable Objects según necesidades concretas de consistencia y carga.
