import { useState } from "react";
import JellyRadio from "../vendor/JellyRadio/JellyRadio";
import SwipeRow, { type SwipeAction } from "../vendor/SwipeRow/SwipeRow";
import { useTripwire } from "../lib/store";
import { useActions } from "../lib/actions";
import { fmtTime } from "../lib/engine";
import type { DEvent } from "../lib/types";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
];

const match = (f: string, a: DEvent) =>
  f === "all" ? true : f === "medium" ? a.severity === "medium" || a.severity === "low" : a.severity === f;

export default function Alerts() {
  const { d } = useTripwire();
  const { triage } = useActions();
  const [filter, setFilter] = useState("all");

  const visible = d.alerts.filter((a) => d.triage.get(a.id) !== "dismiss");
  const shown = visible.filter((a) => match(filter, a)).slice().reverse().slice(0, 40);
  const open = visible.filter((a) => !d.triage.has(a.id)).length;

  const actionsFor = (a: DEvent): SwipeAction[] => [
    { id: "dismiss", label: "Dismiss", color: "#e8452c", onSelect: () => triage("dismiss", a) },
    { id: "ack", label: "Ack", color: "#2a2a28", onSelect: () => triage("ack", a) },
    { id: "escalate", label: "Escalate", color: "#f2f0ea", onSelect: () => triage("escalate", a) },
  ];

  return (
    <div className="panel alerts">
      <div className="panel__head">
        <h3>Alert feed</h3>
        <span className="meta">
          {open} open, {visible.length} total
        </span>
      </div>
      <div className="alerts__filter">
        <JellyRadio
          items={FILTERS}
          value={filter}
          onChange={setFilter}
          size="sm"
          radius={2}
          chipColor="#1b1b1a"
          activeColor="#f2f0ea"
          textColor="#9a968c"
          activeTextColor="#0a0a0a"
          ariaLabel="Filter alerts by severity"
        />
      </div>
      <div className="alerts__list">
        {shown.length === 0 && (
          <div className="empty">
            Quiet so far. Run the demo intrusion or type commands in the attacker terminal, and decoy hits will land here.
          </div>
        )}
        {shown.map((a) => {
          const t = d.triage.get(a.id);
          return (
            <SwipeRow
              key={a.id}
              label={a.title}
              actions={actionsFor(a)}
              height={92}
              radius={0}
              actionWidth={84}
              rowColor="#1b1b1a"
              drawerColor="#2a2a28"
              textColor="#f2f0ea"
              actionColor="#e8452c"
              className="alert-row"
            >
              <div className={`arow arow--${a.severity}`}>
                <div className="arow__top">
                  <span className={`sev sev--${a.severity}`}>{a.severity}</span>
                  {t && <span className="sev sev--info">{t === "ack" ? "acknowledged" : "escalated"}</span>}
                  <span className="meta mono arow__time">{fmtTime(a.ts)}</span>
                </div>
                <strong className="arow__title">{a.title}</strong>
                <span className="arow__meta mono">
                  {a.host} / {a.tactic} / {a.technique.split(" ")[0]}
                </span>
              </div>
            </SwipeRow>
          );
        })}
      </div>
      <p className="meta alerts__hint">Swipe a row left or use its actions button. A full swipe dismisses.</p>
    </div>
  );
}
