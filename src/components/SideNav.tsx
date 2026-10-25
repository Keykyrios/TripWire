import { useEffect, useState } from "react";
import LineSidebar from "../vendor/LineSidebar/LineSidebar";

export const SECTIONS = [
  { id: "top", label: "Overview" },
  { id: "method", label: "Method" },
  { id: "network", label: "Network" },
  { id: "attacker", label: "Attacker" },
  { id: "alerts", label: "Alerts" },
  { id: "incident", label: "Incident" },
  { id: "quantum", label: "Quantum" },
  { id: "decoys", label: "Decoys" },
  { id: "report", label: "Report" },
];

export default function SideNav() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(s.id));
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (hit) setActive(els.findIndex((el) => el === hit.target));
      },
      { rootMargin: "-35% 0px -55% 0px", threshold: [0, 0.2, 0.6] },
    );
    els.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  const go = (i: number) => {
    document.getElementById(SECTIONS[i].id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      <div className="rail-nav">
        <LineSidebar
          key={active}
          items={SECTIONS.map((s) => s.label)}
          defaultActive={active}
          accentColor="#e8452c"
          textColor="#9a968c"
          markerColor="#4a4843"
          fontSize={0.8}
          itemGap={14}
          maxShift={16}
          markerLength={36}
          proximityRadius={90}
          onItemClick={go}
        />
      </div>
      <nav className="mobile-nav" aria-label="Sections">
        {SECTIONS.map((s) => (
          <a key={s.id} href={`#${s.id}`}>
            {s.label}
          </a>
        ))}
      </nav>
    </>
  );
}
