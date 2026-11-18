# ATLAS — Arquitectura y modelo de decisiones

> **Clasificación:** aplicación demostrativa con datos ficticios, sin información empresarial real.

## Objetivo

Representar decisiones de arquitectura, operaciones y continuidad que pueden abordar un Head of IT, Gerente de Infraestructura, Director de Tecnología o comité de gobierno de TI. El MVP es un **simulador explicable**, no una solución de monitoreo.

## Capas de la solución

```text
Navegador: centro de decisiones responsive
  ├── Selección de escenarios e indicadores ejecutivos
  ├── Topología por componentes y dependencias
  ├── Matriz de objetivos de recuperación por servicio
  ├── Comparación de alternativas de inversión
  └── Exportación local de resultados ficticios (JSON)
            |
            v
Modelo determinista de dominio
  ├── src/data.js    : componentes, servicios, rutas, incidentes
  └── src/engine.js  : análisis de impacto y recuperación
            |
            v
Sin backend persistente / sin secretos / sin APIs externas
```

`scripts/build.mjs` copia `public/` y `src/` dentro de `dist/`, utilizando módulos ECMAScript compatibles con navegador. No requiere instalar dependencias.

## Reglas de impacto

Cada servicio de negocio define **rutas alternativas completas de dependencias**. La primera es la ruta principal. Cada ruta está disponible únicamente cuando todos sus componentes están disponibles.

- **HEALTHY (operativo):** ruta principal y al menos una ruta alternativa disponibles.
- **EXPOSED (redundancia reducida):** ruta principal disponible, alternativas indisponibles.
- **SINGLE_PATH (ruta única):** ruta principal disponible sin redundancia definida.
- **FAILOVER (contingencia):** ruta principal caída y al menos una alternativa operativa. Se supone una interrupción durante la conmutación.
- **OUTAGE (indisponibilidad):** ninguna ruta disponible. Se estima un tiempo de recuperación manual.

El modelo compara el tiempo estimado de recuperación con el RTO y la pérdida potencial de datos con el RPO **solo cuando ocurre una interrupción simulada**. Contar con una ruta alternativa no prueba que la conmutación haya sido ensayada.

### Índice de riesgo

Es un **indicador orientativo de priorización**, no una probabilidad de falla ni una certificación de cumplimiento.

Los servicios de criticidad 1 pesan 3 y los de criticidad 2 pesan 1. Factores ficticios: operativo 0; ruta única 0,25; redundancia reducida 0,35; contingencia 0,55; indisponibilidad 1. Un incumplimiento de RTO suma 0,12, con tope individual en 1. El índice se normaliza de 0 a 100 y se redondea.

## Intervenciones de gestión

Las alternativas modifican tiempos **estimados** de recuperación para determinados servicios; nunca agregan rutas, modifican la topología, cambian el RPO ni resuelven por sí solas la causa del incidente. Sus costos son ficticios y sus beneficios requieren validación operativa.

El CAPEX se representa como inversión puntual frente a un presupuesto base ilustrativo; la vista de OPEX representa gasto anual. No utilizar la combinación como un pronóstico contable.

## Privacidad y calidad

- Sin autenticación de usuarios, cargas de archivos ni escrituras remotas.
- Sin credenciales, topología de empleadores ni eventos reales.
- Las selecciones se procesan localmente en el navegador.
- El archivo exportado contiene exclusivamente datos y supuestos ficticios.
- Pruebas reproducibles: `npm run check`, `npm test`, `npm run build`.
- Alojamiento previsto: Cloudflare Workers Static Assets; **sin publicación confirmada aún**.

## Limitaciones y evolución

ATLAS no es una CMDB, herramienta ITSM, plataforma de observabilidad ni solución DR certificada. No integra descubrimiento de activos, incidentes reales, medición de SLA, probabilidades de falla, permisos de aprobación ni ejercicios de recuperación demostrados.

Como futuras mejoras se contemplan trazabilidad de responsables, validación de dependencias, historial de ejercicios de mesa, simulación de incidentes complejos, capacidad, bitácora de decisiones y flujos de aprobación. Son ideas para evolución, **no funcionalidades implementadas**.
