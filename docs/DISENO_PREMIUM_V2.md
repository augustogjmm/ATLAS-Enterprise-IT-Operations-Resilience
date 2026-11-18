# ATLAS — Sistema visual ejecutivo V2

**Estado:** Propuesta implementada en rama de revisión · **Idioma de la aplicación:** español.

## Idea rectora

ATLAS no es un terminal de trading, una consola de ciberseguridad ni una colección de gráficos decorativos. Es una **sala de decisiones tecnológica** que permite conectar el riesgo técnico, la continuidad del negocio y la asignación de recursos.

La dirección de arte combina una base **obsidiana** con iluminación sobria en **verde mineral** y acentos **plata**, reservando ámbar y coral exclusivamente para estados de atención. Se evitan neones agresivos, gráficos bursátiles y simulaciones que aparenten infraestructura real.

## Principios de diseño

- **Board-ready:** el mensaje ejecutivo antecede al detalle técnico.
- **Resiliencia con criterio:** la jerarquía visual sigue las decisiones, no la cantidad de indicadores.
- **Honestidad:** avisos de datos ficticios, supuestos y límites visibles.
- **Densidad controlada:** abundante información, pero agrupada en bloques de lectura clara.
- **Sin dependencias de pago:** CSS, HTML y JavaScript nativos; sin fuentes remotas ni librerías externas.
- **Accesibilidad:** contraste, controles nativos etiquetados, foco visible y reducción de movimiento.

## Paleta de referencia

| Rol | Color | Uso |
|---|---|---|
| Obsidiana | `#080D16` | Fondo del producto |
| Pizarra nocturna | `#101A28` | Superficies y tarjetas |
| Verde mineral | `#7DDDC2` | Continuidad, acentos, acciones |
| Plata | `#F3F6F5` | Titulares y valores |
| Gris acero | `#95A6B5` | Metadatos y explicaciones |
| Ámbar sobrio | `#E3B879` | Degradación/alertas |
| Coral apagado | `#E89494` | Caídas y objetivos comprometidos |

## Rediseño por pantalla / módulo

### 1. Navegación y barra superior
Marca ATLAS, menú funcional, selección activa, estado de «modelo interactivo», sin simular un sistema de producción. Microbordes y contraste consistente.

### 2. Portada ejecutiva
Titular: **«La tecnología se gobierna con decisiones.»** Composición tipográfica destacada y visual vectorial conceptual de dependencias en lugar de una letra gigante meramente decorativa. La visualización ilustra arquitectura; no representa telemetría.

### 3. Laboratorio de escenarios
Escenario, respuesta gerencial y exportación dentro de una bandeja clara con jerarquía de controles. El lenguaje es directo para exposición oral en entrevistas.

### 4. Panorama ejecutivo
Cuatro KPI con color funcional y anillo circular de riesgo proporcional al modelo. Se conserva la explicación de que el índice es ilustrativo, no una calificación real.

### 5. Síntesis de decisiones
Nuevo panel de lectura ejecutiva que destaca el efecto de la falla, la prioridad y los pasos de gestión. Se actualiza por escenario; una inversión solo altera supuestos de recuperación.

### 6. Arquitectura
Sitios con encabezados, roles (principal / contingencia / nube), nodos por dominio y señalización coherente de fallas. Las conexiones visuales son conceptuales; el motor de rutas determina el resultado.

### 7. Continuidad de servicios
Tabla con indicadores de criticidad, estado y cumplimiento de RTO/RPO. Se privilegia la lectura rápida de excepciones.

### 8. Decisiones e inversión
Comparación de hipótesis de intervención, diferencia respecto al escenario sin mejora y presupuesto con desglose CAPEX/OPEX. Los costos siguen siendo ficticios.

### 9. Pie y narrativa de portafolio
El producto dirige a documentación, metodología y código verificable; no atribuye proyectos o resultados falsos al autor.

## Responsive

- Escritorio ancho: portada de dos columnas, cuatro KPI, arquitectura y riesgo en paralelo.
- Escritorio pequeño / tablet: portada de una columna, KPI en dos columnas y paneles apilados.
- Móvil: navegación desplazable, formularios y tablas controlados, topología apilada, lectura prioritaria del resumen ejecutivo.
- `prefers-reduced-motion` deshabilita transiciones decorativas.

## Aceptación visual y funcional

1. Los controles del escenario siguen operativos.
2. El resumen ejecutivo cambia junto con el escenario.
3. La topología refleja exactamente los componentes fallados.
4. No hay desbordamiento horizontal del documento en 390 y 820 px.
5. Se mantienen los resultados del motor y la exportación JSON.
6. Pruebas de sintaxis, unidades, compilación y navegador en GitHub Actions.
7. Validación manual con capturas de escritorio, tablet y móvil antes del despliegue.

## Prompt maestro de evolución visual

> Rediseñar ATLAS como un Executive Technology Command Center premium para Head of IT, Director de Tecnología y responsables de Infraestructura & Operaciones. Priorizar una narrativa de arquitectura, continuidad de negocio, riesgo tecnológico y decisiones CAPEX/OPEX. Estética obsidiana, gris acero, verde mineral, detalles de plata y tipografía sobria; evitar estética gamer, dashboards de trading y adornos sin semántica. Jerarquía editorial fuerte, componentes consistentes, gráficos de dependencias explicables y microinteracciones contenidas. Toda la interfaz y el contenido ejecutivo en español; mantener RTO/RPO, Disaster Recovery, Cloud, CAPEX/OPEX como terminología técnica habitual. Preservar el motor determinista, los escenarios ficticios y sus advertencias; jamás presentar el modelo como infraestructura real, medición productiva ni logros de un empleador. Priorizar accesibilidad, usabilidad móvil, dependencias mínimas y publicación gratuita en Cloudflare Workers Static Assets. Exigir pruebas y capturas antes de integrar a producción.

## Límites del alcance

Es una **mejora de producto e identidad visual**, no una ampliación de autenticación, monitoreo real ni despliegue automatizado. Los ejemplos continúan siendo ficticios. La versión desplegada no se reemplazará hasta pasar QA y aprobar el PR.
