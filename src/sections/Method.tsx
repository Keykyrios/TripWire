import PixelSwap from "../vendor/PixelSwap/PixelSwap";

const STEPS = [
  { n: "01", t: "Plant", d: "Decoy files, fake credentials and decoy hosts sit exactly where an intruder looks first." },
  { n: "02", t: "Watch", d: "Every decoy and every honeytoken is monitored. A real user has no reason to touch one." },
  { n: "03", t: "Reconstruct", d: "Each event joins one log. The route, the stolen credentials and the timeline are rebuilt from that log alone." },
  { n: "04", t: "Respond", d: "Triage alerts, isolate a host, retire what leaked. Containment cuts the live session at once." },
];

function Card({ trap }: { trap: boolean }) {
  return (
    <div className={`swapcard${trap ? " swapcard--trap" : ""}`}>
      <span className="swapcard__tag mono">{trap ? "TRAP, ARMED" : "REAL FILE"}</span>
      <strong className="swapcard__name mono">{trap ? "legacy_runbook.docx" : "budget_2026.xlsx"}</strong>
      <span className="swapcard__path mono">{trap ? "/shares/it/legacy_runbook.docx" : "/shares/finance/budget_2026.xlsx"}</span>
      <p className="swapcard__note">
        {trap
          ? "Holds a break glass login that exists nowhere else. Opening it raises an alert. Using the login raises a critical one."
          : "Used by finance every week. Opening it is normal and stays quiet."}
      </p>
    </div>
  );
}

export default function Method() {
  return (
    <section id="method" className="sec method">
      <div className="sec__in method__grid">
        <div>
          <div className="sec__head">
            <span className="eyebrow">How it works</span>
            <h2>A trap only the intruder can see.</h2>
          </div>
          <ol className="steps">
            {STEPS.map((s) => (
              <li key={s.n} className="steps__item">
                <span className="steps__n mono">{s.n}</span>
                <div>
                  <h3>{s.t}</h3>
                  <p>{s.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div className="method__swap">
          <PixelSwap
            firstContent={<Card trap={false} />}
            secondContent={<Card trap />}
            trigger="click"
            pattern="pointer"
            pixelSize={26}
            gap={1}
            pixelRadius={0}
            pixelScale={0.1}
            duration={700}
            randomness={0.3}
            aspectRatio="4 / 3"
          />
          <p className="meta method__hint">Click the card. One side is real, the other side is the trap.</p>
        </div>
      </div>
    </section>
  );
}
