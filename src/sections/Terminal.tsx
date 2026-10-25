import { useCallback, useEffect, useRef, useState } from "react";
import CodeSlots, { type CodeSlotsStatus } from "../vendor/CodeSlots/CodeSlots";
import { execCommand, execMfa, execPassword, type ExecResult, type Line } from "../lib/engine";
import { useTripwire } from "../lib/store";
import { ENTRY_HOST, ENTRY_USER } from "../lib/network";
import type { Prompt } from "../lib/types";

const INTRO: Line[] = [
  { t: "sys", s: "Attacker foothold console (simulation). Everything typed here is a real event in the log." },
  { t: "sys", s: `Phishing payload landed on ${ENTRY_HOST} as ${ENTRY_USER}. Type help, or run the demo.` },
];

const DEMO: string[] = [
  "scan",
  "ls",
  "cat .bash_history",
  "cat token_backup.txt",
  "ssh jdoe@jump-01",
  "Sunshine#22",
  "418203",
  "scan",
  "ls",
  "cat vpn_and_backup.txt",
  "ssh svc_backup@fs-corp",
  "B4ckup!Winter26",
  "scan",
  "ls",
  "cat legacy_runbook.docx",
  "ssh svc_backup@fs-archive-02",
  "B4ckup!Winter26",
  "ls",
  "cat payroll_2026_full.csv",
  "download payroll_2026_full.csv",
];

const wait = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

export default function Terminal() {
  const { append, getDerived, d, demoTick } = useTripwire();
  const [lines, setLines] = useState<Line[]>(INTRO);
  const [input, setInput] = useState("");
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [mfa, setMfa] = useState("");
  const [mfaStatus, setMfaStatus] = useState<CodeSlotsStatus>("idle");
  const [running, setRunning] = useState(false);

  const promptRef = useRef<Prompt | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const runId = useRef(0);
  const announced = useRef(new Set(d.sorted.filter((e) => e.kind === "ctl" && e.op === "contain").map((e) => e.id)));

  const print = useCallback((x: Line[]) => setLines((l) => [...l, ...x].slice(-300)), []);
  const setP = (p: Prompt | null) => {
    promptRef.current = p;
    setPrompt(p);
  };

  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines, prompt]);

  /* the SOC cut the session: tell the attacker */
  useEffect(() => {
    for (const e of d.sorted) {
      if (e.kind === "ctl" && e.op === "contain" && !announced.current.has(e.id)) {
        announced.current.add(e.id);
        const top = d.alive ? d.stack[d.stack.length - 1].host : null;
        print([
          {
            t: "err",
            s: top
              ? `[SOC] ${e.ref} was isolated. Your session was cut back to ${top}.`
              : `[SOC] ${e.ref} was isolated. Connection lost. Type restart to land a new foothold.`,
          },
        ]);
        if (promptRef.current?.host === e.ref) setP(null);
      }
    }
  }, [d, print]);

  const apply = useCallback(
    (res: ExecResult) => {
      if (res.out.length) print(res.out);
      if (res.events.length) append(res.events);
    },
    [append, print],
  );

  const submitMfa = useCallback(
    (code: string) => {
      const p = promptRef.current;
      if (!p || p.type !== "mfa") return;
      const res = execMfa(code, p, getDerived());
      apply(res);
      if (res.ok) {
        setMfaStatus("success");
        promptRef.current = null;
        window.setTimeout(() => {
          setPrompt(null);
          setMfa("");
          setMfaStatus("idle");
        }, 950);
      } else {
        setMfaStatus("error");
        window.setTimeout(() => setMfaStatus("idle"), 900);
      }
    },
    [apply, getDerived],
  );

  const submit = useCallback(
    (raw: string) => {
      const text = raw.trim();
      const p = promptRef.current;
      const d0 = getDerived();
      if (p?.type === "mfa") return submitMfa(text);
      if (p?.type === "password") {
        print([{ t: "in", s: "*".repeat(text.length) }]);
        const res = execPassword(text, p, d0);
        setP(res.prompt ?? null);
        apply(res);
        return;
      }
      const top = d0.alive ? d0.stack[d0.stack.length - 1] : null;
      print([{ t: "in", s: `${top ? `${top.user}@${top.host}` : "offline"}:~$ ${text}` }]);
      if (text === "clear") return setLines([]);
      const res = execCommand(text, d0);
      setP(res.prompt ?? null);
      apply(res);
    },
    [apply, getDerived, print, submitMfa],
  );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (running) return;
    const v = input;
    setInput("");
    submit(v);
  };

  /* scripted intrusion */
  useEffect(() => {
    if (!demoTick) return;
    const id = ++runId.current;
    const alive = () => runId.current === id;
    (async () => {
      setRunning(true);
      setP(null);
      setMfa("");
      const typeLine = async (text: string) => {
        for (let i = 1; i <= text.length; i++) {
          if (!alive()) return false;
          setInput(text.slice(0, i));
          await wait(16);
        }
        await wait(260);
        setInput("");
        submit(text);
        return true;
      };
      let d0 = getDerived();
      if (!d0.alive) {
        if (!(await typeLine("restart"))) return;
        await wait(500);
      }
      d0 = getDerived();
      while (d0.stack.length > 1) {
        if (!(await typeLine("exit"))) return;
        await wait(250);
        d0 = getDerived();
      }
      for (const step of DEMO) {
        if (!alive()) break;
        if (!getDerived().alive) {
          print([{ t: "sys", s: "[demo] The session is gone, so the scripted intrusion stops here." }]);
          break;
        }
        if (promptRef.current?.type === "mfa") {
          for (let i = 1; i <= step.length; i++) {
            if (!alive()) break;
            setMfa(step.slice(0, i));
            await wait(150);
          }
          await wait(1500);
        } else {
          if (!(await typeLine(step))) break;
          await wait(promptRef.current ? 350 : 750);
        }
      }
      if (alive()) setRunning(false);
    })().catch(() => setRunning(false));
    return () => {
      runId.current++;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoTick]);

  const top = d.alive ? d.stack[d.stack.length - 1] : null;
  const label = top ? `${top.user}@${top.host}:~$` : "offline:~$";

  return (
    <div className="panel term">
      <div className="panel__head">
        <h3>Attacker foothold</h3>
        <span className="meta mono">{d.alive ? d.stack.map((s) => s.host).join(" > ") : "no session"}</span>
      </div>
      <div className="term__body mono" ref={bodyRef} onClick={() => inputRef.current?.focus()}>
        {lines.map((l, i) => (
          <div key={i} className={`term__line term__line--${l.t}`}>
            {l.s}
          </div>
        ))}
      </div>
      <div className="term__foot">
        {prompt?.type === "mfa" ? (
          <div className="term__mfa">
            <span className="meta">
              Verification code for {prompt.user}@{prompt.host}
            </span>
            <CodeSlots
              length={6}
              value={mfa}
              onChange={setMfa}
              onComplete={submitMfa}
              status={mfaStatus}
              slotSize={40}
              gap={8}
              radius={2}
              accentColor="#e8452c"
              inkColor="#f2f0ea"
              slotColor="#1b1b1a"
              digitColor="#f2f0ea"
              dangerColor="#e8452c"
              autoFocus={!running}
              disabled={running}
              ariaLabel="Verification code"
            />
          </div>
        ) : (
          <form className="term__form" onSubmit={onSubmit}>
            <label className="term__prompt mono" htmlFor="term-input">
              {prompt?.type === "password" ? `${prompt.user}@${prompt.host} password:` : label}
            </label>
            <input
              id="term-input"
              ref={inputRef}
              className="term__input mono"
              type={prompt?.type === "password" ? "password" : "text"}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              disabled={running}
              aria-label="terminal input"
              placeholder={running ? "demo intrusion running..." : "type a command"}
            />
          </form>
        )}
        <div className="term__chips">
          {(() => {
            const base = ["help", "scan", "ls", "clear"];
            const hints: string[] = [];
            try {
              if (d.alive && !prompt && d.stack.length > 0) {
                const here = d.stack[d.stack.length - 1];
                const files = d.files.filter((f) => f.host === here.host);
                const decoyFile = files.find((f) => f.decoy && !d.disarmed.has(f.id));
                if (decoyFile) hints.push(`cat ${decoyFile.path.split("/").pop()}`);
                else {
                  const realFile = files.find((f) => !f.decoy);
                  if (realFile) hints.push(`cat ${realFile.path.split("/").pop()}`);
                }
                if (d.known.size) {
                  const cred = d.creds.find((c) => d.known.has(c.id) && c.kind === "ssh" && c.hosts.length > 0);
                  if (cred) {
                    const target = cred.hosts.find((h) => !d.contained.has(h) && !d.stack.some((s) => s.host === h));
                    if (target) hints.push(`ssh ${cred.user}@${target}`);
                  }
                }
              }
            } catch { /* safety net */ }
            return [...base, ...hints].map((c) => (
              <button key={c} className={`chip mono${hints.includes(c) ? " chip--hot" : ""}`} disabled={running || !!prompt} onClick={() => submit(c)}>
                {c}
              </button>
            ));
          })()}
          {!d.alive && (
            <button className="chip chip--hot mono" disabled={running} onClick={() => submit("restart")}>
              restart
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
