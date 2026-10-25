/**
 * Post-quantum cryptography module for Tripwire.
 *
 * - SHA-256 hash chain:  tamper-evident event log (the "blockchain" angle)
 * - ML-KEM-768 (Kyber):  NIST FIPS 203 post-quantum key encapsulation
 * - ML-DSA-65 (Dilithium): NIST FIPS 204 post-quantum digital signatures
 *
 * Every function is synchronous and runs entirely in the browser.
 */

import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { ml_kem768 } from "@noble/post-quantum/ml-kem.js";
import { ml_dsa65 } from "@noble/post-quantum/ml-dsa.js";
import type { DEvent } from "./types";

/* ---------------------------------------------------------------- helpers */

export const toHex = bytesToHex;
export const truncHex = (hex: string, n = 8) => (hex.length <= n * 2 + 1 ? hex : hex.slice(0, n) + "…" + hex.slice(-n));

/* ------------------------------------------------- SHA-256 hash chain */

export interface ChainBlock {
  index: number;
  eventId: string;
  prevHash: string;
  hash: string;
  ts: number;
  title: string;
}

const GENESIS = "0".repeat(64);

function hashPayload(prevHash: string, e: DEvent): string {
  const data = `${prevHash}|${e.id}|${e.ts}|${e.kind}|${e.host}|${e.actor}|${e.title}|${e.detail}`;
  return bytesToHex(sha256(new TextEncoder().encode(data)));
}

/**
 * Build a blockchain-style hash chain from sorted events.
 * Each block contains the SHA-256 hash of (previous hash + event fields).
 */
export function buildChain(sorted: DEvent[]): ChainBlock[] {
  const blocks: ChainBlock[] = [];
  let prev = GENESIS;
  for (let i = 0; i < sorted.length; i++) {
    const e = sorted[i];
    const hash = hashPayload(prev, e);
    blocks.push({ index: i, eventId: e.id, prevHash: prev, hash, ts: e.ts, title: e.title });
    prev = hash;
  }
  return blocks;
}

/**
 * Verify the entire chain.  Returns the first broken index if tampered.
 */
export function verifyChain(blocks: ChainBlock[], sorted: DEvent[]): { valid: boolean; brokenAt?: number; checked: number } {
  if (blocks.length !== sorted.length) return { valid: false, brokenAt: 0, checked: 0 };
  let prev = GENESIS;
  for (let i = 0; i < blocks.length; i++) {
    const expected = hashPayload(prev, sorted[i]);
    if (blocks[i].hash !== expected || blocks[i].prevHash !== prev) {
      return { valid: false, brokenAt: i, checked: i };
    }
    prev = expected;
  }
  return { valid: true, checked: blocks.length };
}

/* ------------------------------------------------ ML-KEM-768 (Kyber) */

export interface KemResult {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
  cipherText: Uint8Array;
  sharedSecretSender: Uint8Array;
  sharedSecretReceiver: Uint8Array;
  match: boolean;
  genTimeMs: number;
  encapTimeMs: number;
  decapTimeMs: number;
}

/**
 * Run a full Kyber key exchange: keygen → encapsulate → decapsulate.
 * Both shared secrets must match.
 */
export function runKyberExchange(): KemResult {
  const t0 = performance.now();
  const keys = ml_kem768.keygen();
  const genTimeMs = performance.now() - t0;

  const t1 = performance.now();
  const { cipherText, sharedSecret: senderSecret } = ml_kem768.encapsulate(keys.publicKey);
  const encapTimeMs = performance.now() - t1;

  const t2 = performance.now();
  const receiverSecret = ml_kem768.decapsulate(cipherText, keys.secretKey);
  const decapTimeMs = performance.now() - t2;

  return {
    publicKey: keys.publicKey,
    secretKey: keys.secretKey,
    cipherText,
    sharedSecretSender: senderSecret,
    sharedSecretReceiver: receiverSecret,
    match: bytesToHex(senderSecret) === bytesToHex(receiverSecret),
    genTimeMs,
    encapTimeMs,
    decapTimeMs,
  };
}

/* -------------------------------------------- ML-DSA-65 (Dilithium) */

export interface DsaKeys {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

export interface DsaResult {
  publicKey: Uint8Array;
  message: string;
  signature: Uint8Array;
  verified: boolean;
  signTimeMs: number;
  verifyTimeMs: number;
}

export function dsaKeygen(): DsaKeys {
  return ml_dsa65.keygen();
}

export function dsaSign(secretKey: Uint8Array, message: string): Uint8Array {
  return ml_dsa65.sign(secretKey, new TextEncoder().encode(message));
}

export function dsaVerify(publicKey: Uint8Array, message: string, signature: Uint8Array): boolean {
  return ml_dsa65.verify(publicKey, new TextEncoder().encode(message), signature);
}

/* -------------------------------------------------- key size info */

export const KEY_SIZES = {
  kem: {
    name: "ML-KEM-768",
    standard: "FIPS 203",
    classical: "AES-192",
    publicKeyBytes: 1184,
    secretKeyBytes: 2400,
    ciphertextBytes: 1088,
    sharedSecretBytes: 32,
  },
  dsa: {
    name: "ML-DSA-65",
    standard: "FIPS 204",
    classical: "Ed25519 / RSA-3072",
    publicKeyBytes: 1952,
    secretKeyBytes: 4032,
    signatureBytes: 3309,
  },
};
