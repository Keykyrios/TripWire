import { useState } from "react";
import RubberSegment from "../vendor/RubberSegment/RubberSegment";
import { useTripwire } from "../lib/store";
import { fmtDur, fmtTime } from "../lib/engine";

const STAGES = ["Initial access", "Reconnaissance", "Credential access", "Lateral movement", "Collection", "Exfiltration"];
const TABS = [
  { value: "timeline", label: "Timeline" },
  { value: "movement", label: "Movement" },
  { value: "narrative", label: "Narrative" },
];

export default function Incident() {
  const { d, r } = useTripwire();
  const [tab, setTab] = useState("timeline");
  const rows = d.sorted;

  return (
    <div className="panel incident">
      <div className="panel__head">
        <h3>Incident reconstruction</h3>
        <span className="meta">Built from the event log alone</span>
      </div>

      <div className="stats">
        <div className="stat stat--hot">
          <span className="meta">Risk</span>
          <strong className="mono">{r.risk}</strong>
        </div>
        <div className="stat">
          <span className="meta">Tier</span>
          <strong className="mono">{r.tier}</strong>
        </div>
        <div className="stat">
          <span className="meta">Dwell time</span>
          <strong className="mono">{r.observed ? fmtDur(r.dwell) : "0s"}</strong>
        </div>
        <div className="stat">
          <span className="meta">Hosts touched</span>
          <strong className="mono">{r.route.length}</strong>
        </div>
        <div className="stat">
          <span className="meta">Alerts</span>
          <strong className="mono">{d.alerts.length}</strong>
        </div>
      </div>

      <ol className="chain" aria-label="Kill chain stages">
        {STAGES.map((s, i) => (
          <li key={s} className={r.phases[s] ? "chain__on" : ""}>
            <span className="mono">{String(i + 1).padStart(2, "0")}</span>
            <span>{s}</span>
            <b className="mono">{r.phases[s] ?? 0}</b>
          </li>
        ))}
      </ol>

      <div className="incident__tabs">
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
          aria-label="Incident view"
        />
      </div>

      <div className="incident__view">
        {tab === "timeline" &&
          (rows.length ? (
            <ol className="tl">
              {rows.map((e) => (
                <li key={e.id} className={`tl__row${e.alert ? " tl__row--alert" : ""}${e.kind === "ctl" ? " tl__row--ctl" : ""}`}>
                  <span className="mono tl__time">{fmtTime(e.ts)}</span>
                  <div className="tl__main">
                    <div className="tl__top">
                      {e.alert && <span className={`sev sev--${e.severity}`}>{e.severity}</span>}
                      <strong>{e.title}</strong>
                    </div>
                    <p>{e.detail}</p>
                    <span className="meta mono">
                      {e.tactic} / {e.host} / {e.technique}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <div className="empty">No events yet. The timeline fills in as the intruder moves.</div>
          ))}

        {tab === "movement" &&
          (r.route.length ? (
            <div className="move">
              <div className="move__route mono">
                {r.route.map((h, i) => (
                  <span key={h} className="move__host">
                    {i > 0 && <em aria-hidden="true">{"\u2192"}</em>}
                    <b className={r.position === h ? "move__here" : ""}>{h}</b>
                  </span>
                ))}
              </div>
              <h4 className="topo__sub">Hops</h4>
              <ul className="hops">
                {r.hops.length === 0 && <li className="meta">No lateral movement yet.</li>}
                {r.hops.map((h, i) => (
                  <li key={i}>
                    <span className="mono">{fmtTime(h.ts)}</span>
                    <span className="mono">
                      {h.from} {"\u2192"} {h.to}
                    </span>
                    <span>as {h.user}</span>
                    {h.honey ? <span className="sev sev--critical">honeytoken</span> : <span className="sev sev--info">valid login</span>}
                  </li>
                ))}
              </ul>
              <h4 className="topo__sub">Credential lineage</h4>
              <ul className="hops">
                {r.lineage.length === 0 && <li className="meta">No stolen credentials yet.</li>}
                {r.lineage.map((l) => (
                  <li key={l.credId} className="lineage">
                    <span className="mono">{l.label}</span>
                    <span>
                      lifted from <span className="mono">{l.file}</span> on {l.fileHost}
                      {l.leakedAt ? ` at ${fmtTime(l.leakedAt)}` : ""}
                    </span>
                    <span className={`sev sev--${l.usedAt ? "critical" : "medium"}`}>{l.usedAt ? `used on ${l.usedOn}` : "not used yet"}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="empty">No movement recorded. Start the demo to see the route form.</div>
          ))}

        {tab === "narrative" &&
          (r.narrative.length ? (
            <div className="narr">
              {r.narrative.map((s, i) => (
                <p key={i}>{s}</p>
              ))}
              <h4 className="topo__sub">Recommended actions</h4>
              <ul className="acts">
                {r.actions.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="empty">The narrative is written once there is activity to describe.</div>
          ))}
      </div>
    </div>
  );
}
