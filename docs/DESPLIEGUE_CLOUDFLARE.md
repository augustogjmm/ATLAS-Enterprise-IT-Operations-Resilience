# Publicación de ATLAS en Cloudflare (sin dependencia de Vercel)

## Objetivo y condiciones

Publicar exclusivamente la aplicación estática generada en `dist/`. No requiere bases de datos, KV, Durable Objects, funciones backend, llaves API ni suscripciones de terceros.

Cloudflare documenta que **las solicitudes a assets estáticos y su almacenamiento no tienen costo adicional**. Esto no significa que todas las operaciones de la cuenta estén garantizadas sin cargo; antes de aceptar cualquier contratación o cambio de plan, verificar expresamente que el proyecto utiliza **Workers Free** y que no se habilitaron servicios de pago.

Referencias: [Static Assets: facturación](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/) y [Workers Builds: integración GitHub](https://developers.cloudflare.com/workers/ci-cd/builds/).

## Controles previos

1. El PR principal debe pasar revisión de interfaz y pruebas de navegador.
2. Confirmar que la cuenta Cloudflare tenga **Workers Free**. No se verificó la suscripción mediante API porque la conexión actual no tiene permisos de facturación.
3. Confirmar que el nombre del Worker no exista ya y que no se modifique otro servicio.
4. No agregar bases de datos, funciones server-side ni `run_worker_first`; ATLAS no las necesita.
5. No conectar la rama de trabajo a un sitio público: publicar desde `main` una vez validada.

## Flujo recomendado mediante Cloudflare Dashboard

1. Ingresar en [Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages).
2. Seleccionar **Create application** y la integración con **GitHub** para una nueva aplicación Worker.
3. Elegir el repositorio `augustogjmm/ATLAS-Enterprise-IT-Operations-Resilience` y la rama `main`.
4. Utilizar un proyecto de **Workers Static Assets** (no Vercel; no SSR).
5. Configurar **build command**: `npm run build`; **output directory**: `dist`.
6. Para la implementación, elegir el comando de despliegue estático compatible con la versión actual del CLI de Cloudflare; revisar la configuración automática propuesta por Workers Builds antes de aceptar.
7. Confirmar que no solicita cambiar de plan, activar servicios pagos o contratar un dominio.
8. Publicar, verificar el enlace `workers.dev`, y ejecutar nuevamente la prueba funcional sobre el dominio público.

Si Cloudflare propone instrucciones distintas, seguir [su configuración vigente de Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/) y no asumir que un proyecto estático requiere scripts backend.

## Validación posterior

- Abrir el panel en escritorio y móvil.
- Seleccionar «Caída del data center principal» y confirmar el impacto en servicios.
- Cambiar a «Caída del data center secundario» y comprobar la alerta de redundancia sin interrupción.
- Simular pérdida de datos y validar el indicador RPO.
- Aplicar la alternativa de automatización y comparar los objetivos.
- Exportar JSON y confirmar que la clasificación indique «datos ficticios».
- Verificar que no haya errores de JavaScript, CORS, rutas rotas ni solicitudes a APIs externas.
- Conservar el enlace del despliegue y el SHA exacto del commit publicado.

No se afirma que el despliegue ya haya ocurrido. Cualquier operación de publicación debe respetar los límites gratuitos y ser verificada antes de anunciarse como disponible.
