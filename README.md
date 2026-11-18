# ATLAS — IT Governance & Operations Management

### De la observación a la ejecución: capacidad, assessments, riesgos, acciones y continuidad

**ATLAS** es un proyecto personal demostrativo para roles de Head of IT, Gerencia de Infraestructura, Operaciones Tecnológicas y Arquitectura Empresarial. El propósito es mostrar cómo se organiza el **gobierno de tecnología basado en registros, responsables, prioridades y evidencias**, no solamente indicadores visuales.

> **Versión funcional V1:** plataforma estática, con operaciones reales sobre datos almacenados en **el navegador del usuario**. El contenido de inicio es 100% ficticio, identificado como demostración. No monitorea infraestructura ni conecta servicios productivos. No utiliza todavía D1 ni autenticación multiusuario.

## ¿Qué podés hacer?

| Área | Operaciones disponibles |
|---|---|
| **Verticales y equipos** | Registrar unidades de gestión con responsables y ámbitos, comparar madurez y exposición. |
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

La segunda automatización vincula **mediciones de capacity sobre el umbral** con riesgos. La puntuación de exposición resulta de **probabilidad × impacto**, no de un modelo probabilístico.

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
  ├── src/governance/core.js     -> motor de dominio determinista
  └── localStorage              -> persistencia por navegador

Simulador conceptual anterior
  ├── public/simulador.html
  ├── public/app.js
  └── src/engine.js + src/data.js
```

El build copia `public/` y `src/` a `dist/`, preparado para **Cloudflare Workers Static Assets** sin backend dinámico, secretos ni pago obligatorio.

## Seguridad y límites de uso

**Persistencia real, pero local y de un solo navegador:** los registros pueden modificarse, mantenerse tras recargar y exportarse/importarse. **No son datos compartidos ni sincronizados en la nube**. Si se borra el almacenamiento del navegador o se utiliza otro dispositivo, los registros no estarán disponibles sin importar un respaldo. No hay autenticación, permisos, auditoría independiente o acceso multiusuario.

**No cargar información empresarial confidencial ni datos personales.** Este entorno público está concebido como demostración. Los datos iniciales son ficticios; si el usuario introduce información propia, la aplicación no puede verificarla automáticamente.

La siguiente evolución prevista es D1 + autenticación + control por roles, previo diseño de seguridad y validación de cuotas del plan gratuito. También quedan pendientes los OKR con resultados clave, importación de incidentes CSV y conectores de fuentes reales; **no se declaran implementados**.

## Documentación

- [Modelo y criterios del primer circuito funcional](docs/GOBIERNO_FUNCIONAL_V1.md)
- [Simulador de resiliencia y su arquitectura](docs/ARCHITECTURE.md)
- [Guía de Cloudflare](docs/DESPLIEGUE_CLOUDFLARE.md)
- [Seguridad](SECURITY.md)

**Autor:** Augusto García Juárez Matorras · [LinkedIn](https://www.linkedin.com/in/augustog/)

No se ha asignado aún una licencia general de reutilización.
