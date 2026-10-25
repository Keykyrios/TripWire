import { useState } from "react";
import FuseButton from "../vendor/FuseButton/FuseButton";
import { useTripwire } from "../lib/store";
import { useActions } from "../lib/actions";
import { EDGES, HOSTS, baseName, hostById } from "../lib/network";

const hopKey = (a: string, b: string) => [a, b].sort().join("|");

export default function Topology() {
  const { d, r } = useTripwire();
  const { contain, release } = useActions();
  const [sel, setSel] = useState("ws-114");

  const routeEdges = new Set(r.hops.map((h) => hopKey(h.from, h.to)));
  const alertsBy = (h: string) => d.alerts.filter((a) => a.host === h && d.triage.get(a.id) !== "dismiss").length;
  const host = hostById(sel)!;
  const files = d.files.filter((f) => f.host === sel);
  const here = d.alive ? d.stack[d.stack.length - 1].host : null;
  const evictedHost = !d.alive && r.route.length ? r.route[r.route.length - 1] : null;
  const isolated = d.contained.has(sel);

  return (
    <div className="topo">
      <div className="panel topo__map">
        <div className="panel__head">
          <h3>Simulated network</h3>
          <span className="meta">
            {HOSTS.length} hosts, {HOSTS.filter((h) => h.decoy).length} decoys, {d.contained.size} isolated
          </span>
        </div>
        <svg viewBox="0 0 900 420" className="topo__svg" role="img" aria-label="Network map with attacker route">
          {EDGES.map(([a, b]) => {
            const A = hostById(a)!;
            const B = hostById(b)!;
            const cut = d.contained.has(a) || d.contained.has(b);
            const on = routeEdges.has(hopKey(a, b));
            return (
              <line
                key={a + b}
                x1={A.x}
                y1={A.y}
                x2={B.x}
                y2={B.y}
                className={`edge${on ? " edge--route" : ""}${cut ? " edge--cut" : ""}`}
              />
            );
          })}
          {HOSTS.map((h) => {
            const n = alertsBy(h.id);
            const cut = d.contained.has(h.id);
            const route = r.route.includes(h.id);
            return (
              <g
                key={h.id}
                transform={`translate(${h.x},${h.y})`}
                className={`node${h.decoy ? " node--decoy" : ""}${sel === h.id ? " node--sel" : ""}${route ? " node--route" : ""}${cut ? " node--cut" : ""}`}
                role="button"
                tabIndex={0}
                aria-label={`${h.id}, ${h.role}${h.decoy ? ", decoy" : ""}${cut ? ", isolated" : ""}`}
                onClick={() => setSel(h.id)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setSel(h.id)}
              >
                <rect x={-62} y={-24} width={124} height={48} />
                <text className="node__id" x={0} y={-3} textAnchor="middle">
                  {h.id}
                </text>
                <text className="node__ip" x={0} y={14} textAnchor="middle">
                  {cut ? "ISOLATED" : h.ip}
                </text>
                {n > 0 && (
                  <g transform="translate(62,-24)">
                    <rect x={-10} y={-10} width={20} height={20} className="node__badge" />
                    <text x={0} y={4} textAnchor="middle" className="node__badgeText">
                      {n}
                    </text>
                  </g>
                )}
                {here === h.id && (
                  <g transform="translate(0,-40)">
                    <g className="attacker">
                      <rect x={-34} y={-11} width={68} height={20} />
                      <text x={0} y={3} textAnchor="middle">
                        ATTACKER
                      </text>
                    </g>
                  </g>
                )}
                {evictedHost === h.id && !here && (
                  <g transform="translate(0,-40)">
                    <g className="evicted">
                      <rect x={-34} y={-11} width={68} height={20} />
                      <text x={0} y={3} textAnchor="middle">
                        EVICTED
                      </text>
                    </g>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
        <div className="topo__legend meta">
          <span><i className="lg lg--host" /> production host</span>
          <span><i className="lg lg--decoy" /> decoy host</span>
          <span><i className="lg lg--route" /> attacker route</span>
          <span><i className="lg lg--cut" /> isolated</span>
        </div>
      </div>

      <aside className="panel topo__inspect" aria-live="polite">
        <div className="panel__head">
          <h3 className="mono">{host.id}</h3>
          <span className={`sev ${host.decoy ? "sev--high" : ""}`}>{host.decoy ? "decoy host" : "production"}</span>
        </div>
        <div className="panel__body topo__body">
          <dl className="kv">
            <div><dt>Address</dt><dd className="mono">{host.ip}</dd></div>
            <div><dt>Role</dt><dd>{host.role}</dd></div>
            <div><dt>Open alerts</dt><dd>{alertsBy(host.id)}</dd></div>
            <div><dt>State</dt><dd>{isolated ? "Isolated" : here === host.id ? "Attacker present" : "Normal"}</dd></div>
          </dl>
          <h4 className="topo__sub">Files</h4>
          <ul className="flist">
            {files.length === 0 && <li className="meta">No files.</li>}
            {files.map((f) => (
              <li key={f.id}>
                <span className="mono">{baseName(f.path)}</span>
                {f.decoy && <span className={`sev sev--${d.disarmed.has(f.id) ? "info" : "high"}`}>{d.disarmed.has(f.id) ? "silent" : "trap"}</span>}
              </li>
            ))}
          </ul>
          <div className="topo__act">
            {isolated ? (
              <button className="btn btn--sm" onClick={() => release(host.id)}>
                Release {host.id}
              </button>
            ) : (
              <FuseButton
                key={host.id}
                label={`Isolate ${host.id}`}
                undoLabel="Undo"
                doneLabel="Isolating"
                color="#f2f0ea"
                background="#1b1b1a"
                fuseColor="#e8452c"
                radius={3}
                size="md"
                undoWindow={3500}
                commitOn="fuseEnd"
                onCommit={() => contain(host.id)}
              />
            )}
            <span className="meta">Isolation starts after a 3.5 second fuse. Undo cancels it.</span>
          </div>
        </div>
      </aside>
    </div>
  );
}
