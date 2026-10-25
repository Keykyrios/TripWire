import { useMemo, useState } from "react";
import BranchedMenu, { type BranchedMenuItem } from "../vendor/BranchedMenu/BranchedMenu";
import FolderFloat from "../vendor/FolderFloat/FolderFloat";
import GlideSelect from "../vendor/GlideSelect/GlideSelect";
import Shredder from "../vendor/Shredder/Shredder";
import SquishSwitch from "../vendor/SquishSwitch/SquishSwitch";
import { useTripwire } from "../lib/store";
import { useActions } from "../lib/actions";
import { HOSTS, TEMPLATES, baseName } from "../lib/network";
import type { DecoyFile } from "../lib/types";

export default function Decoys() {
  const { d } = useTripwire();
  const { arm, retire, deploy } = useActions();
  const [selId, setSelId] = useState("f-vpn");
  const [tpl, setTpl] = useState("aws");
  const [target, setTarget] = useState("ws-114");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const tree = useMemo<BranchedMenuItem[]>(
    () =>
      HOSTS.filter((h) => d.files.some((f) => f.host === h.id)).map((h) => ({
        label: h.decoy ? `${h.id} (decoy host)` : h.id,
        children: d.files
          .filter((f) => f.host === h.id)
          .map((f) => ({ value: f.id, label: `${f.decoy ? "\u25C6 " : ""}${baseName(f.path)}` })),
      })),
    [d.files],
  );

  const file = d.files.find((f) => f.id === selId);
  const cred = file?.plants ? d.creds.find((c) => c.id === file.plants) : undefined;
  const hostDecoys = file ? d.files.filter((f) => f.host === file.host && f.decoy).slice(0, 4) : [];
  const counts = {
    files: d.files.length,
    traps: d.files.filter((f) => f.decoy).length,
    tokens: d.creds.filter((c) => c.honeytoken).length,
  };

  const doDeploy = () => {
    const err = deploy(tpl, target);
    if (err) setMsg({ ok: false, text: err });
    else {
      const t = TEMPLATES.find((x) => x.id === tpl)!;
      setMsg({ ok: true, text: `${t.label} planted on ${target}. It is watched from now on.` });
    }
  };

  return (
    <div className="stack">
      <div className="dstats">
        <div><strong className="mono">{counts.files}</strong><span className="meta">files on the network</span></div>
        <div><strong className="mono">{counts.traps}</strong><span className="meta">are traps</span></div>
        <div><strong className="mono">{counts.tokens}</strong><span className="meta">honeytokens live</span></div>
        <div><strong className="mono">{HOSTS.filter((h) => h.decoy).length}</strong><span className="meta">decoy hosts</span></div>
      </div>

      <div className="split">
        <div className="panel">
          <div className="panel__head">
            <h3>Asset tree</h3>
            <span className="meta">&#9670; marks a trap</span>
          </div>
          <div className="panel__body tree">
            <BranchedMenu
              key={d.files.length}
              items={tree}
              defaultOpen={tree.map((_, i) => i)}
              defaultActive={selId}
              onSelect={(value) => setSelId(value)}
              color="#9a968c"
              accentColor="#f2f0ea"
              lineColor="#4a4843"
              width={300}
              rowHeight={34}
              fontSize={13}
            />
          </div>
        </div>

        <div className="panel">
          <div className="panel__head">
            <h3>{file ? baseName(file.path) : "No file selected"}</h3>
            {file && <span className={`sev ${file.decoy ? "sev--high" : ""}`}>{file.decoy ? "trap" : "real"}</span>}
          </div>
          <div className="panel__body topo__body">
            {!file && <div className="empty">Pick a file in the tree.</div>}
            {file && (
              <>
                <dl className="kv">
                  <div><dt>Path</dt><dd className="mono">{file.path}</dd></div>
                  <div><dt>Host</dt><dd className="mono">{file.host}</dd></div>
                  <div><dt>Size</dt><dd>{file.size}</dd></div>
                  {cred && (
                    <div>
                      <dt>Plants</dt>
                      <dd className="mono">{cred.user}</dd>
                    </div>
                  )}
                </dl>
                {file.decoy && (
                  <SquishSwitch
                    checked={!d.disarmed.has(file.id)}
                    onChange={(v) => arm(file.id, v)}
                    label={d.disarmed.has(file.id) ? "Silent. Reads raise no alert." : "Armed. Reads raise an alert."}
                    trackColor="#2a2a28"
                    trackOnColor="#e8452c"
                    thumbColor="#f2f0ea"
                    thumbOnColor="#0a0a0a"
                    width={56}
                    height={28}
                    radius={3}
                  />
                )}
                <pre className="preview mono">{file.content.join("\n")}</pre>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="split">
        <div className="panel">
          <div className="panel__head">
            <h3>Deploy a decoy</h3>
            <span className="meta">Plant a new trap and its honeytoken</span>
          </div>
          <div className="panel__body deploy">
            <div className="deploy__kit">
              <FolderFloat
                items={TEMPLATES.map((t) => ({ label: t.label, value: t.id }))}
                label="Decoy kit"
                sublabel={TEMPLATES.find((t) => t.id === tpl)?.label}
                trigger="click"
                folderColor="#2a2a28"
                frontColor="#3a3835"
                paperColor="#f2f0ea"
                itemColor="#f2f0ea"
                itemTextColor="#0a0a0a"
                labelColor="#f2f0ea"
                radius={3}
                width={220}
                height={150}
                onSelect={(v) => {
                  setTpl(v);
                  setMsg(null);
                }}
              />
            </div>
            <div className="deploy__form">
              <span className="meta">Target host</span>
              <GlideSelect
                options={HOSTS.map((h) => ({ value: h.id, label: h.id, tag: h.decoy ? "decoy" : h.zone }))}
                value={target}
                onChange={(v) => {
                  setTarget(v);
                  setMsg(null);
                }}
                showTags
                radius={3}
                accentColor="#e8452c"
                surfaceColor="#1b1b1a"
                highlightColor="#2a2a28"
                textColor="#f2f0ea"
                menuWidth={260}
                ariaLabel="Target host"
              />
              <button className="btn btn--primary" onClick={doDeploy}>
                Deploy decoy
              </button>
              {msg && <p className={`deploy__msg ${msg.ok ? "" : "deploy__msg--err"}`}>{msg.text}</p>}
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel__head">
            <h3>Retire a decoy</h3>
            <span className="meta">Drag a card into the shredder</span>
          </div>
          <div className="panel__body shred">
            {hostDecoys.length === 0 ? (
              <div className="empty">The selected host has no traps to retire. Pick a file on another host.</div>
            ) : (
              <Shredder<DecoyFile>
                key={file?.host}
                items={hostDecoys}
                width={340}
                height={380}
                color="#f2f0ea"
                slitColor="#e8452c"
                renderItem={(f) => (
                  <div className="shcard">
                    <strong className="mono">{baseName(f.path)}</strong>
                    <span className="meta mono">{f.host}</span>
                  </div>
                )}
                onShred={(f) => retire(f.id, f.path)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
