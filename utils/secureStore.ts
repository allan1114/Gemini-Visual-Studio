/**
 * Best-effort encryption-at-rest for sensitive strings (API keys) kept in
 * localStorage. This is obfuscation hardening, not a vault: a client-only app
 * cannot keep a secret from same-origin scripts. The goal is that raw keys are
 * not sitting in plaintext in localStorage dumps / browser backups / shared
 * machines.
 *
 * Encrypted values are tagged with the `enc:v1:` prefix so reads can
 * transparently fall back to legacy plaintext (enabling lazy migration).
 */

const ENC_PREFIX = 'enc:v1:';
const DEVICE_KEY_STORAGE = 'gvs_device_key_v1';

let cachedKey: CryptoKey | null = null;

function hasSubtle(): boolean {
  return typeof crypto !== 'undefined' && !!crypto.subtle;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Returns (creating if needed) a per-device random secret used to derive the AES key. */
function getDeviceSecret(): Uint8Array {
  let stored = localStorage.getItem(DEVICE_KEY_STORAGE);
  if (!stored) {
    const random = crypto.getRandomValues(new Uint8Array(32));
    stored = toBase64(random);
    localStorage.setItem(DEVICE_KEY_STORAGE, stored);
  }
  return fromBase64(stored);
}

async function getKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  const secret = getDeviceSecret();
  cachedKey = await crypto.subtle.importKey(
    'raw',
    secret as BufferSource,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
  return cachedKey;
}

/** Encrypts a plaintext string. Falls back to returning plaintext if WebCrypto is unavailable. */
export async function encryptString(plaintext: string): Promise<string> {
  if (!plaintext || !hasSubtle()) return plaintext;
  try {
    const key = await getKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = new TextEncoder().encode(plaintext);
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data as BufferSource);
    return `${ENC_PREFIX}${toBase64(iv)}:${toBase64(new Uint8Array(cipher))}`;
  } catch {
    return plaintext;
  }
}

/** Decrypts a value produced by encryptString. Returns the input unchanged if it is plaintext. */
export async function decryptString(value: string): Promise<string> {
  if (!value || !value.startsWith(ENC_PREFIX)) return value;
  if (!hasSubtle()) return value;
  try {
    const payload = value.slice(ENC_PREFIX.length);
    const [ivB64, cipherB64] = payload.split(':');
    const key = await getKey();
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(ivB64) as BufferSource },
      key,
      fromBase64(cipherB64) as BufferSource
    );
    return new TextDecoder().decode(plain);
  } catch {
    return value;
  }
}

/** True when a value is already encrypted with this module. */
export function isEncrypted(value: string): boolean {
  return typeof value === 'string' && value.startsWith(ENC_PREFIX);
}
