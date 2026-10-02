import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// ---------------------------------------------------------------------------
// Envelope encryption for highly sensitive values (SSN / fødselsnummer).
//
// Each value is encrypted with a fresh per-record data key (DEK), and the DEK
// itself is wrapped with a master key (KEK) that lives in the environment /
// KMS. A database dump alone therefore reveals nothing.
// ---------------------------------------------------------------------------

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

interface Envelope {
  v: 1;
  alg: typeof ALGO;
  dek: string; // DEK encrypted with KEK (base64)
  dekIv: string;
  dekTag: string;
  iv: string;
  tag: string;
  ciphertext: string;
}

function getKek(): Buffer {
  const raw = process.env.SSN_KEK;
  if (!raw) {
    throw new Error(
      "SSN_KEK is not set. Generate one with `openssl rand -base64 32` and store it in your secret manager.",
    );
  }
  const kek = Buffer.from(raw, "base64");
  if (kek.length !== 32) {
    throw new Error("SSN_KEK must decode to exactly 32 bytes (AES-256).");
  }
  return kek;
}

function encrypt(key: Buffer, plaintext: Buffer) {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const data = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: data.toString("base64"),
  };
}

function decrypt(key: Buffer, ivB64: string, tagB64: string, dataB64: string): Buffer {
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
}

export function encryptSsn(ssn: string): string {
  const kek = getKek();
  const dek = randomBytes(32);
  const wrapped = encrypt(kek, dek);
  const encrypted = encrypt(dek, Buffer.from(ssn, "utf8"));

  const envelope: Envelope = {
    v: 1,
    alg: ALGO,
    dek: wrapped.data,
    dekIv: wrapped.iv,
    dekTag: wrapped.tag,
    iv: encrypted.iv,
    tag: encrypted.tag,
    ciphertext: encrypted.data,
  };
  return JSON.stringify(envelope);
}

export function decryptSsn(envelope: string): string {
  const kek = getKek();
  const env = JSON.parse(envelope) as Envelope;
  if (env.v !== 1 || env.alg !== ALGO) {
    throw new Error("Unsupported SSN envelope format.");
  }
  const dek = decrypt(kek, env.dekIv, env.dekTag, env.dek);
  return decrypt(dek, env.iv, env.tag, env.ciphertext).toString("utf8");
}

export function maskSsn(ssn: string): string {
  const cleaned = ssn.replace(/\D/g, "");
  if (cleaned.length <= 4) return "••••";
  return `${"•".repeat(cleaned.length - 4)} ${cleaned.slice(-4)}`;
}
