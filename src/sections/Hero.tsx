import WebGLLiquid from "../vendor/webgl-liquid";
import { useTripwire } from "../lib/store";

export default function Hero() {
  const { room, status, runDemo } = useTripwire();

  const openConsole = () => document.getElementById("network")?.scrollIntoView({ behavior: "smooth" });
  const demo = () => {
    document.getElementById("attacker")?.scrollIntoView({ behavior: "smooth" });
    window.setTimeout(runDemo, 650);
  };

  return (
    <header id="top" className="hero">
      <WebGLLiquid
        title=""
        subtitle=""
        description=""
        colorDeep="#0a0402"
        colorMid="#4a120a"
        colorHighlight="#e8452c"
        speed={0.8}
        flowStrength={1.1}
        grain={0.07}
        contrast={1.15}
        opacity={0.9}
        style={{ position: "absolute", inset: 0, minHeight: 0, height: "100%" }}
      />
      <div className="hero__veil" aria-hidden="true" />
      <div className="hero__content">
        <div className="hero__strip">
          <span className="brand">
            <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true">
              <path d="M2 16h9l4-10 4 20 4-10h7" fill="none" stroke="#e8452c" strokeWidth="3" />
            </svg>
            TRIPWIRE
          </span>
          <span className="mono hero__room">
            room {room} / sync {status}
          </span>
        </div>
        <h1 className="hero__title">Let them walk into the trap.</h1>
        <p className="hero__sub">
          Decoy files, fake credentials and monitored endpoints. Touch one and Tripwire alerts, rebuilds the path and writes the incident timeline.
        </p>
        <div className="hero__cta">
          <button className="btn btn--primary" onClick={openConsole}>
            Open the console
          </button>
          <button className="btn btn--primary btn--pulse" onClick={demo}>
            Run demo intrusion
          </button>
        </div>
      </div>
    </header>
  );
}
