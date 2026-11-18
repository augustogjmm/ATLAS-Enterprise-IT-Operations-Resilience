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

async function keysFor(origin, fetcher) {
  const cached = keyCache.get(origin);
  if (cached && cached.expires > Date.now()) return cached.keys;
  const response = await fetcher(origin + '/cdn-cgi/access/certs', { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new AccessError('No se pudieron obtener claves de Access', 503);
  const body = await response.json();
  if (!Array.isArray(body.keys)) throw new AccessError('Certificados Access inválidos', 503);
  keyCache.set(origin, { keys: body.keys, expires: Date.now() + 5 * 60 * 1000 });
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
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') throw new AccessError();
  const keys = await keysFor(issuer, fetcher);
  const jwk = keys.find(k => k.kid === header.kid && k.kty === 'RSA');
  if (!jwk) throw new AccessError();
  try {
    const key = await crypto.subtle.importKey('jwk', jwk, {name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256'}, false, ['verify']);
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, decodeBase64Url(segments[2]), new TextEncoder().encode(segments[0] + '.' + segments[1]));
    if (!valid) throw new Error();
  } catch { throw new AccessError(); }
  const now = Math.floor(Date.now() / 1000);
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (payload.iss !== issuer || !aud.includes(env.ACCESS_AUD) ||
      typeof payload.exp !== 'number' || payload.exp <= now ||
      (typeof payload.nbf === 'number' && payload.nbf > now) ||
      (typeof payload.iat === 'number' && payload.iat > now + 60) ||
      typeof payload.sub !== 'string' || !payload.sub ||
      typeof payload.email !== 'string' || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(payload.email))
    throw new AccessError();
  return { sub: payload.sub, email: payload.email.trim().toLowerCase(), name: String(payload.name || '').slice(0, 100) };
}
