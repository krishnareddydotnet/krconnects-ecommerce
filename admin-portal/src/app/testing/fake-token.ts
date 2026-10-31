// -----------------------------------------------------------------------
// Test helper: builds a token that LOOKS like auth-api's JWT.
// The signature part is fake: the browser never checks signatures
// (the backends do), so the portal only needs a readable payload.
// -----------------------------------------------------------------------

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fakeToken(options: { name?: string; role?: string; expiresInSeconds?: number } = {}): string {
  const expiresInSeconds = options.expiresInSeconds ?? 3600;
  const payload: Record<string, unknown> = {
    sub: '1',
    name: options.name ?? 'boss',
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
  };
  if (options.role !== undefined) {
    payload['role'] = options.role;
  }

  const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  return `${header}.${toBase64Url(JSON.stringify(payload))}.fake-signature`;
}
