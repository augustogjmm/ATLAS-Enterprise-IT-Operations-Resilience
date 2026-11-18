# ATLAS — Enterprise IT Operations & Resilience
### Centro Ejecutivo de Operaciones y Continuidad Tecnológica

**Arquitectura empresarial · Operaciones de TI · Continuidad operativa · Gobierno tecnológico**

> Proyecto personal demostrativo para analizar cómo las dependencias de infraestructura impactan en los servicios de negocio, los objetivos de recuperación y las decisiones de inversión. **Todos los datos, incidentes, costos y componentes son ficticios**. No representa sistemas de un empleador, telemetría real ni una solución de Disaster Recovery validada.

**Autor:** Augusto García Juárez Matorras · [LinkedIn](https://www.linkedin.com/in/augustog/) · [Perfil profesional](https://github.com/augustogjmm)

## ¿Qué problema aborda?

Las herramientas de monitoreo permiten detectar fallas. En los niveles de conducción tecnológica también necesitamos responder: **¿qué servicios de negocio están comprometidos, qué tan preparada está la organización para recuperarlos y qué decisiones de inversión pueden modificar ese riesgo?**

ATLAS propone un entorno de simulación reproducible para conversar sobre esas decisiones con criterio de arquitectura, operaciones y continuidad.

## Alcance del MVP

| Módulo | Capacidades demostradas |
|---|---|
| Arquitectura empresarial | Topología ficticia de dos data centers y una integración cloud |
| Servicios de negocio | Seis servicios con criticidad, responsables y rutas alternativas de dependencia |
| Gestión de incidentes | Caída del DC principal/secundario, interrupción cloud, falla correlacionada de redes y retraso de replicación |
| Continuidad operativa | Evaluación de tiempos estimados de recuperación y pérdida de datos frente a objetivos RTO/RPO |
| Decisiones ejecutivas | Alternativas de respuesta y comparación ilustrativa de CAPEX/OPEX |
| Evidencia | Exportación local de resultados, supuestos e impacto por servicio en formato JSON |

**Importante:** los tiempos y el índice de riesgo son supuestos pedagógicos, no mediciones reales, probabilidades predictivas ni garantías de disponibilidad.

### Principios de diseño

- **Explicabilidad antes que complejidad.** Cada resultado responde a hipótesis documentadas.
- **Prioridad del negocio.** Las dependencias técnicas se evalúan en función de los servicios que soportan.
- **Redundancia no significa continuidad garantizada.** Una ruta de contingencia puede resultar insuficiente para el RTO.
- **Decisiones con criterios de gobierno.** Las intervenciones muestran efectos potenciales, costos y límites.
- **Sin información confidencial.** Los escenarios no reproducen infraestructura ni eventos de empleadores.

## Cómo ejecutarlo

Se recomienda Node.js 22 o superior. El proyecto no necesita instalar paquetes ni utilizar una cuenta cloud para la demo local.

```bash
npm run check
npm test
npm run build
```

Para levantar el directorio generado `dist/` mediante un servidor HTTP local:

```bash
python -m http.server 8080 --directory dist
```

Abrí [http://localhost:8080](http://localhost:8080). No abras directamente el archivo `index.html` con `file://`, porque los navegadores restringen las importaciones de módulos.

## Publicación en Cloudflare

La salida `dist/` es estática y está diseñada para alojarse mediante **Cloudflare Workers Static Assets**, evitando dependencias con Vercel. Todavía no se declara un despliegue público: antes deben completarse las pruebas visuales y comprobarse la configuración y los límites gratuitos de Cloudflare.

Más información: [arquitectura y reglas de decisión](docs/ARCHITECTURE.md), [ADR-001](docs/ADR-001-static-simulation.md) y [guía de demostración para entrevistas](docs/DEMO_GUIDE.md).

## Alcance y seguridad

No se conectan sistemas de empresas, usuarios ni claves. La simulación se ejecuta en el navegador, sin almacenamiento de datos operativos ni consultas a APIs externas. ATLAS es un **MVP demostrativo**, no una CMDB, plataforma ITSM ni herramienta certificada de monitoreo.

Consultá [SECURITY.md](SECURITY.md). La licencia general de reutilización todavía no fue definida.
