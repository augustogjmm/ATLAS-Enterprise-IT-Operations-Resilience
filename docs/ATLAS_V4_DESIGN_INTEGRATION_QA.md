# ATLAS V5 — Integración de la identidad ATLAS V4 (revisión visual)

**Estado:** integración funcional en la rama `feature/atlas-v5-multiusuario-gobierno`. No desplegada, no fusionada en `main`.

## Contrato aprobado y fuentes
- `ATLAS_V4_Executive_Command.html` — estructura, mapas, interacciones y estilo de demostración.
- `ATLAS_V4_Preview_Desktop.png` — referencia visual escritorio.
- `ATLAS_V4_Preview_Mobile.png` — referencia visual responsive.
- `ATLAS_V4_Brief_Maestro.md` — tokens, jerarquía, contenido y comportamiento.

Los cuatro archivos se inspeccionaron como referencia. **No se incorporaron al repositorio como artefactos de producción**, ni se reemplazó V5 por el prototipo HTML. El diseño se adaptó a las estructuras de datos y los módulos reales de ATLAS V5.

## Integración
- `public/atlas-v4-system.css`: tokens de identidad, rail oscuro de 82/61 px, hero serif, franja de KPIs, ecosistema, panel de decisiones, footer, mobile y foco.
- `public/executive-command.js`: vista ejecutiva y perspectivas vinculadas al estado actual del workspace. Los ocho dominios son categorías de navegación, no dependencias reales inferidas.
- `public/atlas-shell.js`: búsqueda global Ctrl+K, búsqueda de módulos/dominios/decisiones/riesgos, resúmenes de pendientes y nombre de organización autorizada.
- `public/index.html`: barra superior, panel de herramientas desplegable, diálogos y rail SVG.
- `public/governance.js`: nueva vista `overview`; la vista ejecutiva anterior se conserva como `operations`. El resto de navegación y las APIs permanecen.
- `scripts/governance-smoke.mjs`, `scripts/v5-browser-smoke.mjs`, `scripts/v5-multiuser-smoke.mjs`, `tests/v5-executive-command.test.js`: regresión, datos vacíos, métricas, seguridad HTML, rutas y captures.

## Datos y comportamiento
- Disponibilidad calculada con tiempo de servicio y caída informado (ponderación por período). No se atribuye monitoreo en vivo.
- Los componentes críticos proceden de registros de servicios con criticidad 1; decisiones, riesgos e incidentes proceden de registros existentes.
- Los dominios sin registro muestran **Sin datos** en lugar de métricas ficticias.
- Una decisión se enlaza con responsable, fecha y riesgo cuando existen en el workspace.
- Los módulos de incidentes/MTTR, KPIs/OKR, verticales, capacity, assessments, riesgos, acciones, continuidad y comité siguen accesibles.
- Los controles de datos (importar, exportar, demo, crear workspaces, auditoría y recuperación) están agrupados en **Workspace y herramientas de datos**. No se eliminaron.
- Roles, Cloudflare Access JWT, D1, auditoría y control de concurrencia mantienen su implementación original.

## Evidencia visual reproducible
`node scripts/v5-browser-smoke.mjs` (después de `npm run build` y dependencias de Playwright) genera, dentro de `test-artifacts/`:
- `v5-command-1700.png` (Chromium real, ancho 1700 px)
- `v5-command-430.png` (Chromium real, ancho 430 px)

Estos PNG se suben en el artifact de GitHub Actions `atlas-capturas-escritorio-movil` cuando la CI finaliza. Son **capturas de la aplicación ejecutada**, no imágenes generadas con IA.

### Diferencias conocidas respecto a la V4
1. La V4 de referencia incluye una disposición y datos de ejemplo precisos (incluidas tres decisiones). V5 muestra datos del workspace y, por ello, los conteos y las decisiones pueden variar.
2. La taxonomía Core + ocho dominios reproduce el esquema aprobado; las conexiones del mapa representan la **relación conceptual** con Core. Todavía no son dependencias operativas cargadas en un grafo de relaciones.
3. El rail contiene enlaces adicionales a módulos reales de gobierno, para no sacrificar funciones existentes.
4. La barra de herramientas de V5 se conserva en un panel desplegable; el prototipo original no incluía controles de persistencia ni auditoría.
5. El diseño se compara manualmente contra las capturas de referencia; todavía no hay ensayo automatizado de equivalencia visual píxel por píxel ni certificación de accesibilidad WCAG AA completa.

## Cómo revisar
```bash
npm test
npm run check
npm run build
# Requiere playwright@1.55.0 y Chrome/Chromium
node scripts/v5-browser-smoke.mjs
```

Abrir el sitio construido desde un servidor HTTP local con su `dist/index.html`. Revisar en 1700 px y 430 px. En modo local se inicia sin consultar la API V5. Para probar multiusuario se utiliza el backend simulado en las pruebas; no usar credenciales productivas.

**No publicar:** Cloudflare Access/Zero Trust y los costos efectivos no se han podido verificar (API 403). La condición USD 0 y la protección de V4 siguen vigentes. No usar datos personales o confidenciales en la demostración.
