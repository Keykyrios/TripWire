import { derive, execCommand, execPassword, execMfa, reconstruct, ctl, buildMarkdown, buildDeploy, startSession, type DEvent, type Prompt, type ExecResult } from "../src/lib/engine";

let events: DEvent[] = [];
let t = 1_000_000;
let prompt: Prompt | null = null;
let fails = 0;
const assert = (c: unknown, m: string) => { if (!c) { fails++; console.log("FAIL", m); } else console.log("ok  ", m); };
const push = (r: ExecResult) => {
  for (const e of r.events) events.push({ ...e, id: "e" + events.length, ts: (t += 4000) });
  prompt = r.prompt ?? null;
  return r;
};
const run = (c: string) => {
  const d = derive(events);
  if (prompt?.type === "password") return push(execPassword(c, prompt, d));
  if (prompt?.type === "mfa") return push(execMfa(c, prompt, d));
  return push(execCommand(c, d));
};
const last = () => derive(events).sorted.at(-1)!;

push({ out: [], events: [startSession()] });
for (const c of ["scan","ls","cat .bash_history","cat token_backup.txt","ssh jdoe@jump-01","Sunshine#22","418203","scan","ls","cat vpn_and_backup.txt","ssh svc_backup@fs-corp","B4ckup!Winter26","scan","ls","cat legacy_runbook.docx","ssh svc_backup@fs-archive-02","B4ckup!Winter26","ls","cat payroll_2026_full.csv","download payroll_2026_full.csv"]) run(c);

let d = derive(events);
let r = reconstruct(d);
assert(r.route.join(">") === "ws-114>jump-01>fs-corp>fs-archive-02", "route reconstructed " + r.route.join(">"));
assert(d.alerts.some(a => a.kind === "probe" && a.host === "fs-archive-02"), "decoy host probe alert");
assert(d.alerts.some(a => a.kind === "exfil" && a.severity === "critical"), "exfil alert critical");
assert(r.lineage.some(l => l.credId === "tok-svc-backup" && l.usedOn === "fs-corp"), "svc_backup lineage");
assert(r.lineage.some(l => l.credId === "tok-admin-legacy" && !l.usedAt), "admin_legacy leaked unused");
assert(r.tier === "critical" && r.risk === 100, `tier critical risk ${r.risk}`);
assert(r.position === "fs-archive-02", "attacker position");
assert(d.stack.length === 4, "stack depth 4");

// MFA wrong then right
events = []; prompt = null;
push({ out: [], events: [startSession()] });
run("ssh jdoe@jump-01"); run("Sunshine#22");
assert(prompt?.type === "mfa", "bastion asks for MFA");
run("000000");
assert(last().kind === "login_fail" && !last().alert, "bad MFA is non-alert failure");
run("418203");
assert(derive(events).stack.at(-1)?.host === "jump-01", "mfa opens bastion");

// honeytoken name guessed
run("ssh svc_backup@fs-corp"); run("wrong");
assert(last().alert && last().severity === "high", "honeytoken name with wrong password = high alert");

// containment cuts the session back
run("ssh svc_backup@fs-corp"); run("B4ckup!Winter26");
assert(derive(events).stack.at(-1)?.host === "fs-corp", "on fs-corp");
events.push({ ...ctl("contain", "fs-corp", "c", "c"), id: "c1", ts: (t += 1000) });
d = derive(events);
assert(d.stack.at(-1)?.host === "jump-01" && d.contained.has("fs-corp"), "containing fs-corp cuts session back to jump-01");
const blocked = run("ssh svc_backup@fs-corp");
assert(blocked.out[0].s.includes("No route"), "contained host unreachable");
events.push({ ...ctl("contain", "ws-114", "c", "c"), id: "c2", ts: (t += 1000) });
assert(!derive(events).alive, "containing entry host kills session");
assert(run("restart").out[0].s.includes("isolated"), "restart refused while entry host isolated");
events.push({ ...ctl("release", "ws-114", "r", "r"), id: "c3", ts: (t += 1000) });
run("restart");
assert(derive(events).alive, "restart works after release");

// deploy, disarm, retire
events = []; prompt = null;
push({ out: [], events: [startSession()] });
let dd = derive(events);
const dep = buildDeploy("aws", "ws-114", dd);
assert(!("error" in dep), "deploy builds");
if (!("error" in dep)) events.push({ ...dep, id: "dep1", ts: (t += 1000) });
dd = derive(events);
const depFile = dd.files.find(f => f.path === "/root/.aws/credentials" && f.host === "ws-114")!;
assert(!!depFile, "deployed decoy exists");
assert("error" in buildDeploy("aws", "ws-114", dd), "duplicate refused");
run("cat credentials");
assert(last().alert, "deployed decoy alerts when read");
const key = dd.creds.find(c => c.deployed)!.user;
run(`aws-login ${key}`);
assert(last().kind === "cred_use" && last().severity === "critical", "deployed key use critical");
run("aws-login AKIAREAL0000");
assert(!last().alert, "unknown key not alert");
events.push({ ...ctl("disarm", depFile.id, "d", "d"), id: "dis", ts: (t += 1000) });
const before = derive(events).alerts.length;
run("cat credentials");
assert(derive(events).alerts.length === before, "disarmed decoy silent");
events.push({ ...ctl("retire", depFile.id, "r", "r"), id: "ret", ts: (t += 1000) });
assert(!derive(events).files.some(f => f.id === depFile.id), "retired decoy removed");

// triage
const al = derive(events).alerts[0];
events.push({ ...ctl("ack", al.id, "a", "a"), id: "ack", ts: (t += 1000) });
assert(derive(events).triage.get(al.id) === "ack", "ack recorded");

d = derive(events);
const md = buildMarkdown(d, reconstruct(d), "TEST");
assert(md.includes("## Timeline"), "markdown built");
console.log(fails ? `\n${fails} FAILED` : "\nall engine checks passed");
process.exit(fails ? 1 : 0);
