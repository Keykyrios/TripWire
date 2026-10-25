# Tripwire: cyber deception platform

Problem 03, Cybersecurity and Blockchain. Builds a simulated network with decoy files, fake credentials and
monitored endpoints. Touching a decoy raises an alert, reconstructs the intruder's movement and writes an
incident timeline.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check and production build
npm test           # UI tests (jsdom) and engine tests: npm run test:engine
```

## Firebase

`src/lib/firebase.ts` holds your web config. Events are written to Realtime Database at
`tripwire/rooms/<ROOM>/events/<id>`. Open the same `?room=XXXX` link in two browsers and both see alerts live.
If the database rules refuse writes the app keeps working from local storage and says so in the Report section.
For the demo, allow read and write on `tripwire/` in the Firebase console rules.

## Layout

```
src/lib        network model, detection and reconstruction engine, Firebase store, actions
src/sections   Hero, Method, ConsoleBar, Topology, Terminal, Alerts, Incident, Decoys, Report
src/components SideNav, Toasts
src/styles     one stylesheet per section
src/vendor     component source copied from React Bits and Componentry
tests          jsdom UI tests;  scripts/engine-test.ts engine tests
```

## Where each component is used

| Component | Job here |
|---|---|
| WebGLLiquid | Hero background |
| ClickSpark | Spark on every click, whole app |
| LineSidebar | Section navigation with scroll tracking |
| PixelSwap | Method section, real file versus trap |
| SquishSwitch | Auto-contain toggle, arm or silence a decoy |
| BellToggle | Alert notifications, badge shows open alerts |
| FuseButton | Isolate host and Reset exercise, both with an undo fuse |
| CodeSlots | MFA code prompt on the bastion host |
| SwipeRow | Alert triage: dismiss, acknowledge, escalate |
| JellyRadio | Alert severity filter |
| RubberSegment | Incident views: timeline, movement, narrative |
| BranchedMenu | Asset tree of hosts and files |
| FolderFloat | Decoy kit template picker |
| GlideSelect | Target host picker |
| Shredder | Retire a decoy by dragging it in |

## How detection works

Nothing is hard coded to a scenario. Every action appends an event to one log. `derive()` folds the log into
state, `reconstruct()` folds it into the route, credential lineage, kill chain, risk score and narrative.

- Opening a decoy file: high alert. If it planted a credential, that credential is tracked.
- Using a honeytoken to log in or call a cloud API: critical alert.
- Scanning a decoy host: medium alert. Copying out decoy data: critical alert.
- Real files and real logins stay quiet.

Simulated credentials for the demo: jdoe / Sunshine#22, MFA code 418203 (in a file on ws-114).

## Post-quantum cryptography

The audit trail is secured with NIST-standardised post-quantum algorithms (FIPS 203 / 204), running
entirely in the browser via `@noble/post-quantum`.

| Layer | Algorithm | Purpose |
|---|---|---|
| Integrity | SHA-256 hash chain | Each event is chained to the previous one. Changing any field breaks every hash after it, making the log tamper-evident like a blockchain. |
| Key exchange | ML-KEM-768 (CRYSTALS-Kyber) | Quantum-safe key encapsulation. When two analysts share a room, the shared secret is established through Kyber — immune to Shor's algorithm. |
| Signatures | ML-DSA-65 (CRYSTALS-Dilithium) | The chain head is signed with a lattice-based digital signature. Even a quantum computer cannot forge an event or rewrite history. |

The Quantum section in the app shows live key generation, encapsulation, signing and verification
with real benchmarks, hex dumps and chain exploration.
