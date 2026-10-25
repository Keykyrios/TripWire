import { useEffect, useMemo, useRef, useState } from "react";
import RubberSegment from "../vendor/RubberSegment/RubberSegment";
import { useTripwire } from "../lib/store";
import {
  buildChain,
  verifyChain,
  runKyberExchange,
  dsaKeygen,
  dsaSign,
  dsaVerify,
  toHex,
  truncHex,
  KEY_SIZES,
  type KemResult,
  type DsaResult,
  type DsaKeys,
} from "../lib/crypto";
import { fmtTime } from "../lib/engine";

const TABS = [
  { value: "chain", label: "Hash chain" },
  { value: "kyber", label: "Kyber KEM" },
  { value: "dilithium", label: "Dilithium DSA" },
];

export default function Crypto() {
  const { d } = useTripwire();
  const [tab, setTab] = useState("chain");
  const [kem, setKem] = useState<KemResult | null>(null);
  const [dsa, setDsa] = useState<DsaResult | null>(null);
  const dsaKeys = useRef<DsaKeys | null>(null);

  /* hash chain */
  const chain = useMemo(() => buildChain(d.sorted), [d.sorted]);
  const integrity = useMemo(() => verifyChain(chain, d.sorted), [chain, d.sorted]);

  /* Kyber key exchange — run once on mount */
  useEffect(() => {
    try {
      setKem(runKyberExchange());
    } catch {
      /* WebCrypto unavailable */
    }
  }, []);

  /* Dilithium — keygen once, re-sign every time chain changes */
  useEffect(() => {
    try {
      dsaKeys.current = dsaKeygen();
    } catch {
      /* PQ crypto unavailable */
    }
  }, []);

  useEffect(() => {
    if (!chain.length || !dsaKeys.current) {
      setDsa(null);
      return;
    }
    try {
      const keys = dsaKeys.current;
      const head = chain[chain.length - 1].hash;
      const t0 = performance.now();
      const sig = dsaSign(keys.secretKey, head);
      const signTimeMs = performance.now() - t0;
      const t1 = performance.now();
      const verified = dsaVerify(keys.publicKey, head, sig);
      const verifyTimeMs = performance.now() - t1;
      setDsa({ publicKey: keys.publicKey, message: head, signature: sig, verified, signTimeMs, verifyTimeMs });
    } catch {
      setDsa(null);
    }
  }, [chain]);

  const chainLen = chain.length;
  const headHash = chainLen ? truncHex(chain[chainLen - 1].hash) : "—";

  return (
    <div className="panel pq">
      <div className="panel__head">
        <h3>Post-quantum audit trail</h3>
        <span className="meta">NIST FIPS 203 / 204</span>
      </div>

      {/* ---- stats ---- */}
      <div className="pq__stats">
        <div className={`pq__stat ${chainLen === 0 ? "" : integrity.valid ? "pq__stat--ok" : "pq__stat--bad"}`}>
          <span className="meta">Chain</span>
          <strong className="mono">{chainLen === 0 ? "EMPTY" : integrity.valid ? "✓ INTACT" : "✗ BROKEN"}</strong>
        </div>
        <div className="pq__stat">
          <span className="meta">Blocks</span>
          <strong className="mono">{chainLen}</strong>
        </div>
        <div className="pq__stat">
          <span className="meta">KEM</span>
          <strong className="mono">{KEY_SIZES.kem.name}</strong>
        </div>
        <div className="pq__stat">
          <span className="meta">DSA</span>
          <strong className="mono">{KEY_SIZES.dsa.name}</strong>
        </div>
        <div className="pq__stat">
          <span className="meta">Head</span>
          <strong className="mono pq__head-hash">{headHash}</strong>
        </div>
      </div>

      {/* ---- tabs ---- */}
      <div className="pq__tabs">
        <RubberSegment
          items={TABS}
          value={tab}
          onChange={setTab}
          size="sm"
          radius={2}
          trackColor="#1b1b1a"
          thumbColor="#f2f0ea"
          textColor="#9a968c"
          activeTextColor="#0a0a0a"
          aria-label="Post-quantum view"
        />
      </div>

      {/* ---- tab content ---- */}
      <div className="pq__view">
        {/* ---- HASH CHAIN ---- */}
        {tab === "chain" &&
          (chainLen ? (
            <div className="chain-view">
              <div className="chain-view__hdr meta">
                {integrity.checked} block{integrity.checked !== 1 ? "s" : ""} verified.
                {" "}Each block hashes its event fields together with the previous block's hash, forming a tamper-evident chain.
              </div>
              {chain
                .slice()
                .reverse()
                .slice(0, 40)
                .map((b) => (
                  <div key={b.eventId} className={`cb${b.index === 0 ? " cb--genesis" : ""}`}>
                    <div className="cb__idx mono">{String(b.index).padStart(3, "0")}</div>
                    <div className="cb__body">
                      <div className="cb__top">
                        <span className="mono cb__hash">{truncHex(b.hash, 6)}</span>
                        <span className="mono cb__time">{fmtTime(b.ts)}</span>
                      </div>
                      <strong className="cb__title">{b.title}</strong>
                      <span className="mono cb__prev">← {b.index === 0 ? "genesis" : truncHex(b.prevHash, 6)}</span>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="empty">
              No events in the chain yet. Run the demo intrusion — every event gets a SHA-256 hash linked to its predecessor, forming a tamper-evident blockchain.
            </div>
          ))}

        {/* ---- KYBER KEM ---- */}
        {tab === "kyber" &&
          (kem ? (
            <div className="kem-view">
              <div className="pq__banner">
                <span className={`pq__badge ${kem.match ? "pq__badge--ok" : "pq__badge--bad"}`}>
                  {kem.match ? "✓ KEY EXCHANGE VERIFIED" : "✗ MISMATCH"}
                </span>
                <span className="meta">CRYSTALS-Kyber / {KEY_SIZES.kem.standard} — quantum-safe key encapsulation mechanism</span>
              </div>

              {/* flow diagram */}
              <div className="kem__flow">
                <div className="kem__party">
                  <span className="kem__role mono">SOC (room creator)</span>
                  <span className="meta">keygen → publicKey</span>
                </div>
                <div className="kem__arrow">
                  <span className="mono">publicKey →</span>
                  <span className="mono">← cipherText</span>
                </div>
                <div className="kem__party">
                  <span className="kem__role mono">ANALYST (room joiner)</span>
                  <span className="meta">encapsulate → sharedSecret</span>
                </div>
              </div>

              <div className="kem__grid">
                <div className="kem__card">
                  <span className="kem__label mono">PUBLIC KEY</span>
                  <span className="mono kem__hex">{truncHex(toHex(kem.publicKey), 16)}</span>
                  <span className="meta">{kem.publicKey.byteLength} bytes</span>
                </div>
                <div className="kem__card">
                  <span className="kem__label mono">CIPHERTEXT</span>
                  <span className="mono kem__hex">{truncHex(toHex(kem.cipherText), 16)}</span>
                  <span className="meta">{kem.cipherText.byteLength} bytes</span>
                </div>
                <div className="kem__card kem__card--accent">
                  <span className="kem__label mono">SHARED SECRET</span>
                  <span className="mono kem__hex kem__hex--accent">{toHex(kem.sharedSecretSender)}</span>
                  <span className="meta">{kem.sharedSecretSender.byteLength} bytes — derived independently by both parties</span>
                </div>
              </div>

              <dl className="kv kem__perf">
                <div><dt>Key generation</dt><dd className="mono">{kem.genTimeMs.toFixed(1)} ms</dd></div>
                <div><dt>Encapsulation</dt><dd className="mono">{kem.encapTimeMs.toFixed(1)} ms</dd></div>
                <div><dt>Decapsulation</dt><dd className="mono">{kem.decapTimeMs.toFixed(1)} ms</dd></div>
                <div><dt>Lattice problem</dt><dd className="mono">Module-LWE</dd></div>
                <div><dt>Classical equivalent</dt><dd className="mono">{KEY_SIZES.kem.classical}</dd></div>
                <div><dt>Quantum-safe</dt><dd className="mono pq__yes">Yes — NIST FIPS 203</dd></div>
              </dl>
            </div>
          ) : (
            <div className="empty">Generating ML-KEM-768 keypair…</div>
          ))}

        {/* ---- DILITHIUM DSA ---- */}
        {tab === "dilithium" &&
          (dsa ? (
            <div className="dsa-view">
              <div className="pq__banner">
                <span className={`pq__badge ${dsa.verified ? "pq__badge--ok" : "pq__badge--bad"}`}>
                  {dsa.verified ? "✓ SIGNATURE VERIFIED" : "✗ INVALID SIGNATURE"}
                </span>
                <span className="meta">CRYSTALS-Dilithium / {KEY_SIZES.dsa.standard} — quantum-safe digital signature</span>
              </div>

              <div className="kem__grid">
                <div className="kem__card">
                  <span className="kem__label mono">PUBLIC KEY</span>
                  <span className="mono kem__hex">{truncHex(toHex(dsa.publicKey), 16)}</span>
                  <span className="meta">{dsa.publicKey.byteLength} bytes</span>
                </div>
                <div className="kem__card">
                  <span className="kem__label mono">SIGNATURE</span>
                  <span className="mono kem__hex">{truncHex(toHex(dsa.signature), 16)}</span>
                  <span className="meta">{dsa.signature.byteLength} bytes</span>
                </div>
                <div className="kem__card kem__card--accent">
                  <span className="kem__label mono">SIGNED MESSAGE (CHAIN HEAD HASH)</span>
                  <span className="mono kem__hex kem__hex--accent">{dsa.message}</span>
                  <span className="meta">SHA-256 hash of the latest block — any tampering breaks both the chain and the signature</span>
                </div>
              </div>

              <dl className="kv kem__perf">
                <div><dt>Signing time</dt><dd className="mono">{dsa.signTimeMs.toFixed(1)} ms</dd></div>
                <div><dt>Verification time</dt><dd className="mono">{dsa.verifyTimeMs.toFixed(1)} ms</dd></div>
                <div><dt>Lattice problem</dt><dd className="mono">Module-LWE + SelfTargetMSIS</dd></div>
                <div><dt>Classical equivalent</dt><dd className="mono">{KEY_SIZES.dsa.classical}</dd></div>
                <div><dt>Quantum-safe</dt><dd className="mono pq__yes">Yes — NIST FIPS 204</dd></div>
              </dl>
            </div>
          ) : (
            <div className="empty">No events to sign yet. The chain head is signed with ML-DSA-65 after each new event.</div>
          ))}
      </div>
    </div>
  );
}
