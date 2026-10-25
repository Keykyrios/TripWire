import ClickSpark from "./vendor/ClickSpark/ClickSpark";
import { StoreProvider } from "./lib/store";
import SideNav from "./components/SideNav";
import Toasts from "./components/Toasts";
import Hero from "./sections/Hero";
import Method from "./sections/Method";
import ConsoleBar from "./sections/ConsoleBar";
import Topology from "./sections/Topology";
import Terminal from "./sections/Terminal";
import Alerts from "./sections/Alerts";
import Incident from "./sections/Incident";
import Crypto from "./sections/Crypto";
import Decoys from "./sections/Decoys";
import Report from "./sections/Report";

function Section({ id, eyebrow, title, lede, children }: { id: string; eyebrow: string; title: string; lede: string; children: React.ReactNode }) {
  return (
    <section id={id} className="sec console">
      <div className="sec__in">
        <div className="sec__head">
          <span className="eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
          <p>{lede}</p>
        </div>
        {children}
      </div>
    </section>
  );
}

export default function App() {
  return (
    <ClickSpark sparkColor={["#e8452c", "#f2f0ea"]} sparkSize={9} sparkRadius={22} sparkCount={9} duration={520} shape="line" style={{ height: "auto" }}>
      <StoreProvider>
        <SideNav />
        <Toasts />
        <Hero />
        <Method />
        <Section
          id="network"
          eyebrow="Console"
          title="Watch every host, decoy or not."
          lede="Nine hosts, two of them decoys no real user would ever contact. Select a host to see its files, its alerts and isolate it."
        >
          <ConsoleBar />
          <Topology />
        </Section>
        <Section
          id="attacker"
          eyebrow="Simulation"
          title="Play the intruder."
          lede="Type commands from the phished workstation, or run the scripted intrusion. Every command is logged exactly as a sensor would see it."
        >
          <Terminal />
        </Section>
        <Section id="alerts" eyebrow="Detection" title="Only traps raise alerts." lede="Normal reads stay quiet. Decoy hits, honeytoken logins and decoy exfiltration land here, ranked by severity.">
          <Alerts />
        </Section>
        <Section id="incident" eyebrow="Reconstruction" title="The path, rebuilt." lede="Route, credential lineage, kill chain and the full incident timeline, derived from the event log alone.">
          <Incident />
        </Section>
        <Section id="quantum" eyebrow="Post-quantum" title="Tamper-proof, even against quantum." lede="SHA-256 hash chain for integrity, CRYSTALS-Kyber for key exchange, CRYSTALS-Dilithium for signatures. NIST FIPS 203 / 204 post-quantum cryptography running in your browser.">
          <Crypto />
        </Section>
        <Section id="decoys" eyebrow="Decoys" title="Plant, arm and retire traps." lede="Browse every asset, switch a decoy between armed and silent, deploy a fresh honeytoken or shred one you no longer need.">
          <Decoys />
        </Section>
        <Section id="report" eyebrow="Handover" title="Take the report with you." lede="Export the incident as Markdown or raw events, share the room with a teammate, or reset the exercise.">
          <Report />
        </Section>
        <footer className="footer">
          <div className="footer__in meta">
            <span>TRIPWIRE, cyber deception. All hosts, files and credentials here are simulated.</span>
            <span>Cybersecurity &amp; Blockchain, problem 03.</span>
          </div>
          <div className="footer__in footer__tech meta">
            <span>React · TypeScript · Firebase Realtime DB · Vite</span>
            <span>CRYSTALS-Kyber (ML-KEM-768) · CRYSTALS-Dilithium (ML-DSA-65) · SHA-256 hash chain</span>
          </div>
        </footer>
      </StoreProvider>
    </ClickSpark>
  );
}
