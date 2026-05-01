/**
 * Ed25519 keypair management for valve operation signing.
 *
 * The private key is encrypted at rest in localStorage using AES-GCM derived
 * from the user's passphrase via PBKDF2. The browser never transmits the
 * private key; only the public key is registered with the server.
 *
 * Threat model: protects key material if device storage is exfiltrated
 * (e.g. via XSS reading localStorage), assuming the passphrase has not been
 * captured. For the highest assurance, replace localStorage with a hardware
 * security module / WebAuthn before production.
 */

import nacl from "tweetnacl";
import { encodeBase64, decodeBase64 } from "tweetnacl-util";

const STORAGE_KEY = "ulwandle.signingKey.v1";
const PBKDF2_ITERATIONS = 310_000;

interface StoredKey {
  v: 1;
  publicKey: string;            // base64
  ciphertext: string;           // base64 (private key encrypted)
  salt: string;                 // base64
  iv: string;                   // base64
}

function strToBytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    "raw", strToBytes(passphrase), { name: "PBKDF2" }, false, ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITERATIONS },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function generateAndStoreKeypair(passphrase: string): Promise<{ publicKey: string }> {
  if (passphrase.length < 12) throw new Error("Passphrase must be at least 12 characters");
  const kp = nacl.sign.keyPair();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const aes = await deriveKey(passphrase, salt);
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aes, kp.secretKey),
  );
  const stored: StoredKey = {
    v: 1,
    publicKey: encodeBase64(kp.publicKey),
    ciphertext: encodeBase64(ct),
    salt: encodeBase64(salt),
    iv: encodeBase64(iv),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  return { publicKey: stored.publicKey };
}

export function hasStoredKey(): boolean {
  return !!localStorage.getItem(STORAGE_KEY);
}

export function getStoredPublicKey(): string | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return (JSON.parse(raw) as StoredKey).publicKey;
  } catch {
    return null;
  }
}

export function clearStoredKey(): void {
  localStorage.removeItem(STORAGE_KEY);
}

async function loadSecretKey(passphrase: string): Promise<Uint8Array> {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) throw new Error("No signing key found. Generate one first.");
  const stored = JSON.parse(raw) as StoredKey;
  const aes = await deriveKey(passphrase, decodeBase64(stored.salt));
  const sk = new Uint8Array(
    await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: decodeBase64(stored.iv) },
      aes,
      decodeBase64(stored.ciphertext),
    ),
  );
  return sk;
}

/**
 * Build the canonical operation message (must match the backend's
 * canonical_op_message exactly).
 */
export function canonicalOpMessage(
  role: "propose" | "approve",
  valveId: string,
  action: string,
  nonce: string,
  issuedAt: string,
  proposerId?: number,
): Uint8Array {
  const parts = ["v1", role, valveId, action, nonce, issuedAt];
  if (role === "approve" && typeof proposerId === "number") parts.push(String(proposerId));
  return strToBytes(parts.join("|"));
}

export async function signOperation(
  passphrase: string,
  message: Uint8Array,
): Promise<string> {
  const sk = await loadSecretKey(passphrase);
  try {
    const sig = nacl.sign.detached(message, sk);
    return encodeBase64(sig);
  } finally {
    sk.fill(0);  // best-effort wipe
  }
}

export function newNonce(): string {
  const buf = crypto.getRandomValues(new Uint8Array(24));
  return encodeBase64(buf);
}

export function nowIso(): string {
  return new Date().toISOString();
}
