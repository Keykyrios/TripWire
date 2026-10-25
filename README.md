# Tripwire

A simulated corporate network with decoy files, fake credentials and monitored endpoints. An attacker moves through the network — every touch on a decoy triggers alerts, and the system reconstructs the full intrusion path from the event log alone.

Built for the **Cybersecurity & Blockchain** track (Problem 03).

## What it does

You get dropped into a terminal as an attacker on `ws-114`. You can `ls`, `cat` files, `ssh` between hosts, `scan` the network. Some files are decoys. Some credentials are honeytokens. Touch one and Tripwire catches you.

The defender side sees:
- Live alerts with severity classification
- Full attack route reconstruction on a network topology map
- Credential lineage tracking (where a cred was leaked → where it was used)
- Kill chain derivation
- Auto-containment of compromised hosts
- A downloadable incident report (Markdown + styled PDF)

Everything syncs in real time via Firebase — open the same room on two browsers and one person attacks while the other watches the alerts roll in.

## The blockchain angle

Every event appended to the log gets a **SHA-256 hash** that chains to the previous event's hash. Change any field in any event and every hash after it breaks. The chain is visible, explorable and verifiable in the app.

On top of that, the chain head is signed with **CRYSTALS-Dilithium** (ML-DSA-65, NIST FIPS 204) and key exchange between room participants uses **CRYSTALS-Kyber** (ML-KEM-768, NIST FIPS 203). All post-quantum, all running in the browser via `@noble/post-quantum`.

| Layer | Algorithm | What it does |
|---|---|---|
| Integrity | SHA-256 hash chain | Tamper-evident event log |
| Key exchange | ML-KEM-768 | Quantum-safe shared secret between analysts |
| Signatures | ML-DSA-65 | Chain head signed — can't forge events |

## Stack

- React 19 + TypeScript
- Vite
- Firebase Realtime Database
- `@noble/post-quantum` + `@noble/hashes`
- jsPDF (client-side PDF generation)
- Vanilla CSS (no component library)

## Run locally

```bash
npm install
npm run dev
```

The demo works without Firebase config — it falls back to local storage. To enable real-time sync, set your Firebase credentials in `.env.local`.

## Project structure

```
src/
├── lib/
│   ├── engine.ts      # derive() and reconstruct() — all state from events
│   ├── crypto.ts      # SHA-256 chain, Kyber KEM, Dilithium DSA
│   ├── network.ts     # hosts, edges, credentials, decoy files
│   ├── store.tsx      # React context + Firebase sync
│   ├── actions.ts     # terminal command interpreter
│   ├── pdf.ts         # client-side PDF report generator
│   └── types.ts       # shared types
├── sections/          # each section of the single-page app
└── vendor/            # third-party React components
```

## Demo credentials

- Username: `jdoe`, password: `Sunshine#22`
- MFA code: `418203` (found in a file on `ws-114`)
- Or just click **Run demo intrusion** and watch it play out.
