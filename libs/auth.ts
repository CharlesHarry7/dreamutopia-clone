// JWT-based auth for Cloudflare Workers/Pages Functions
// Uses Web Crypto API (available in Workers runtime)

async function signJWT(payload: object, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '');
  const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, '');
  const data = `${encodedHeader}.${encodedPayload}`;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return `${data}.${encodedSignature}`;
}

async function verifyJWT(token: string, secret: string): Promise<any | null> {
  try {
    const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');
    const data = `${encodedHeader}.${encodedPayload}`;

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signature = Uint8Array.from(
      atob(encodedSignature.replace(/-/g, '+').replace(/_/g, '/')),
      (c) => c.charCodeAt(0)
    );

    const valid = await crypto.subtle.verify('HMAC', key, signature, new TextEncoder().encode(data));
    if (!valid) return null;

    const payload = JSON.parse(atob(encodedPayload));
    if (payload.exp && Date.now() > payload.exp * 1000) return null;

    return payload;
  } catch {
    return null;
  }
}

export async function createSession(env: Env, userId: number, email: string): Promise<string> {
  const token = await signJWT(
    { sub: userId, email, exp: Math.floor(Date.now() / 1000) + 7 * 24 * 3600 },
    env.JWT_SECRET
  );

  // Store session in KV with 7-day TTL
  await env.KV.put(`session:${token}`, JSON.stringify({ userId, email }), {
    expirationTtl: 7 * 24 * 3600,
  });

  return token;
}

export async function verifySession(env: Env, request: Request): Promise<{ userId: number; email: string } | null> {
  const cookie = request.headers.get('Cookie') || '';
  const tokenMatch = cookie.match(/auth_token=([^;]+)/);
  if (!tokenMatch) return null;

  const token = tokenMatch[1];
  const payload = await verifyJWT(token, env.JWT_SECRET);
  if (!payload) return null;

  // Verify session exists in KV
  const session = await env.KV.get(`session:${token}`);
  if (!session) return null;

  return { userId: payload.sub, email: payload.email };
}

export async function destroySession(env: Env, request: Request): Promise<void> {
  const cookie = request.headers.get('Cookie') || '';
  const tokenMatch = cookie.match(/auth_token=([^;]+)/);
  if (tokenMatch) {
    await env.KV.delete(`session:${tokenMatch[1]}`);
  }
}

export { signJWT, verifyJWT };
