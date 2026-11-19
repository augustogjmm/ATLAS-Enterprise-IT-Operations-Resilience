// ATLAS V5: validar SIEMPRE la firma del JWT de Cloudflare Access.
// Static Assets no propaga ctx.access al Worker; los headers sin firma no son identidad.
export class AccessError extends Error {
  constructor(message = 'Acceso no autorizado', status = 401) {
    super(message);
    this.status = status;
  }
}

const decoder = new TextDecoder();
const keyCache = new Map();
function decodeBase64Url(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value || '')) throw new AccessError();
  const base = value.replace(/-/g, '+').replace(/_/g, '/');
  const bytes = atob(base.padEnd(Math.ceil(base.length / 4) * 4, '='));
  return Uint8Array.from(bytes, character => character.charCodeAt(0));
}
function decodeJson(value) {
  try { return JSON.parse(decoder.decode(decodeBase64Url(value))); }
  catch { throw new AccessError(); }
}
function teamOrigin(env) {
  try {
    const url = new URL(env.ACCESS_TEAM_DOMAIN);
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.cloudflareaccess.com') ||
        url.pathname !== '/' || url.search || url.hash || url.username || url.password) throw new Error();
    return url.origin;
  } catch { throw new AccessError('Cloudflare Access no configurado', 503); }
}

async function keysFor(origin, fetcher, refresh = false) {
  const now=Date.now();
  const cached=keyCache.get(origin);
  if(cached && cached.expires>now &&
      (!refresh || (cached.refreshAfter||0)>now))
    return cached.keys;
  let response,body;
  try {
    response=await fetcher(origin+'/cdn-cgi/access/certs',{
      headers:{Accept:'application/json'},
      signal:AbortSignal.timeout(5000)
    });
    if(!response.ok)throw new Error('HTTP '+response.status);
    body=await response.json();
  } catch {throw new AccessError('No se pudieron obtener claves de Access',503);}
  if(!Array.isArray(body?.keys)||body.keys.length<1||body.keys.length>64)
    throw new AccessError('Certificados Access inválidos',503);
  // Un kid desconocido provoca como máximo una actualización por cada 30 s
  // evitando solicitudes ilimitadas al endpoint público de claves.
  keyCache.set(origin,{keys:body.keys,expires:now+5*60*1000,
    refreshAfter:refresh?now+30*1000:0});
  return body.keys;
}

export async function verifyAccessToken(request, env, fetcher = fetch) {
  const issuer = teamOrigin(env);
  if (typeof env.ACCESS_AUD !== 'string' || !env.ACCESS_AUD.trim())
    throw new AccessError('Audiencia Access no configurada', 503);
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token || token.length > 16000) throw new AccessError();
  const segments = token.split('.');
  if (segments.length !== 3) throw new AccessError();
  const header = decodeJson(segments[0]);
  const payload = decodeJson(segments[1]);
  if (header.alg !== 'RS256' || typeof header.kid !== 'string' ||
      header.kid.length<1 || header.kid.length>128) throw new AccessError();
  let keys = await keysFor(issuer, fetcher);
  let jwk = keys.find(k => k.kid === header.kid && k.kty === 'RSA' &&
    (!k.alg || k.alg==='RS256'));
  if (!jwk) {
    // Cloudflare puede rotar sus claves antes del vencimiento del caché.
    keys=await keysFor(issuer,fetcher,true);
    jwk=keys.find(k=>k.kid===header.kid&&k.kty==='RSA'&&(!k.alg||k.alg==='RS256'));
  }
  if (!jwk) throw new AccessError();
  try {
    const key = await crypto.subtle.importKey('jwk', jwk, {name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256'}, false, ['verify']);
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, decodeBase64Url(segments[2]), new TextEncoder().encode(segments[0] + '.' + segments[1]));
    if (!valid) throw new Error();
  } catch { throw new AccessError(); }
  const now = Math.floor(Date.now() / 1000);
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (payload.iss !== issuer || !aud.includes(env.ACCESS_AUD) ||
      !Number.isSafeInteger(payload.exp) || payload.exp <= now ||
      !Number.isSafeInteger(payload.iat) || payload.iat > now+60 ||
      payload.exp <= payload.iat ||
      (payload.nbf !== undefined &&
        (!Number.isSafeInteger(payload.nbf) || payload.nbf > now)) ||
      typeof payload.sub !== 'string' || !payload.sub || payload.sub.length>512 ||
      typeof payload.email !== 'string' || payload.email.length>254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email))
    throw new AccessError();
  return { sub: payload.sub, email: payload.email.trim().toLowerCase(), name: String(payload.name || '').slice(0, 100) };
}
