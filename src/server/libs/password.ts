// Password hashing — Web Crypto PBKDF2

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function toHex(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashPassword(
  password: string,
  saltHex?: string
): Promise<{ hash: string; salt: string }> {
  const salt =
    saltHex ||
    toHex(crypto.getRandomValues(new Uint8Array(16)));
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: enc.encode(salt), iterations: 100000, hash: "SHA-256" },
    key,
    256
  );
  return { hash: toHex(bits), salt };
}

export async function verifyPassword(
  password: string,
  salt: string,
  expectedHash: string
): Promise<boolean> {
  if (!salt || !expectedHash) return false;
  const { hash } = await hashPassword(password, salt);
  return safeEqual(hash, expectedHash);
}
