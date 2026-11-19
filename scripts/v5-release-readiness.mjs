// Gate de decisión de lanzamiento de ATLAS V5. Sólo evalúa evidencia explícita;
// no se comunica con Cloudflare ni habilita infraestructura.
export const RELEASE_CHECKS=Object.freeze([
  'workersFreeVerified','accessFreeVerified','d1FreeVerified',
  'zeroChargeVerified','quotaHeadroomVerified','accessTwoUsersVerified',
  'realD1RecoveryVerified','cloudflareRuntimeTestsPassed',
  'ownerApprovedDeployment'
]);

export function assessV5Readiness(evidence){
  if(!evidence||typeof evidence!=='object'||Array.isArray(evidence))
    return {go:false,missing:[...RELEASE_CHECKS],reason:'Evidencia ausente'};
  const missing=RELEASE_CHECKS.filter(key=>evidence[key]!==true);
  // No tratar cadenas 'true', campos implícitos ni resultados 403 como aprobaciones.
  return {go:missing.length===0,missing,reason:missing.length?
    'No desplegar: controles de costo, acceso o homologación pendientes':
    'Controles declarados como aprobados; requiere revisión manual de evidencias antes de cualquier acción'};
}
