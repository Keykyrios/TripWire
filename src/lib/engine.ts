import { BASE_CREDS, BASE_FILES, ENTRY_HOST, ENTRY_USER, HOSTS, MFA_CODE, TEMPLATES, baseName, hostById, neighbors } from "./network";
import type { Credential, CtlOp, DEvent, DecoyFile, Prompt, Severity } from "./types";

export type NewEvent = Omit<DEvent, "id" | "ts">;
export interface Line {
  t: "in" | "out" | "err" | "sys";
  s: string;
}
export interface ExecResult {
  out: Line[];
  events: NewEvent[];
  prompt?: Prompt;
  ok?: boolean;
}

export interface Derived {
  sorted: DEvent[];
  files: DecoyFile[];
  creds: Credential[];
  contained: Set<string>;
  disarmed: Set<string>;
  disarmedCreds: Set<string>;
  triage: Map<string, "ack" | "escalate" | "dismiss">;
  stack: { host: string; user: string }[];
  alive: boolean;
  known: Set<string>;
  alerts: DEvent[];
}

const WEIGHT: Record<Severity, number> = { info: 0, low: 3, medium: 8, high: 18, critical: 30 };
export const SEV_ORDER: Severity[] = ["info", "low", "medium", "high", "critical"];

/* ------------------------------------------------------------------ derive */

export function derive(events: DEvent[]): Derived {
  const sorted = [...events].sort((a, b) => a.ts - b.ts || a.id.localeCompare(b.id));
  let files = BASE_FILES.map((f) => ({ ...f }));
  let creds = BASE_CREDS.map((c) => ({ ...c }));
  const contained = new Set<string>();
  const disarmed = new Set<string>();
  const triage = new Map<string, "ack" | "escalate" | "dismiss">();
  const known = new Set<string>();
  let stack: { host: string; user: string }[] = [];

  for (const e of sorted) {
    switch (e.kind) {
      case "session":
        stack = [{ host: e.host, user: e.actor }];
        break;
      case "login":
      case "cred_use":
        if (e.to) stack = [...stack, { host: e.to, user: e.actor }];
        break;
      case "exit":
        if (stack.length > 1) stack = stack.slice(0, -1);
        break;
      case "read": {
        const f = files.find((x) => x.id === e.ref);
        if (f?.plants) known.add(f.plants);
        break;
      }
      case "ctl":
        switch (e.op) {
          case "contain":
            if (e.ref) contained.add(e.ref);
            {
              const i = stack.findIndex((s) => contained.has(s.host));
              if (i >= 0) stack = stack.slice(0, i);
            }
            break;
          case "release":
            if (e.ref) contained.delete(e.ref);
            break;
          case "disarm":
            if (e.ref) disarmed.add(e.ref);
            break;
          case "arm":
            if (e.ref) disarmed.delete(e.ref);
            break;
          case "retire":
            files = files.filter((f) => f.id !== e.ref);
            break;
          case "deploy":
            if (e.payload?.file && !files.some((f) => f.id === e.payload!.file!.id)) files.push(e.payload.file);
            if (e.payload?.cred && !creds.some((c) => c.id === e.payload!.cred!.id)) creds.push(e.payload.cred);
            break;
          case "ack":
          case "escalate":
          case "dismiss":
            if (e.ref) triage.set(e.ref, e.op);
            break;
        }
        break;
    }
  }

  const disarmedCreds = new Set<string>();
  for (const f of files) if (f.plants && disarmed.has(f.id)) disarmedCreds.add(f.plants);
  const alerts = sorted.filter((e) => e.alert);
  return { sorted, files, creds, contained, disarmed, disarmedCreds, triage, stack, alive: stack.length > 0, known, alerts };
}

/* ------------------------------------------------------------------ helpers */

const line = (t: Line["t"], s: string): Line => ({ t, s });
const ev = (e: Partial<NewEvent> & Pick<NewEvent, "kind" | "host" | "title" | "tactic" | "technique">): NewEvent => ({
  actor: "",
  detail: "",
  severity: "info",
  alert: false,
  ...e,
});

export function ctl(op: CtlOp, ref: string, title: string, detail: string, payload?: NewEvent["payload"]): NewEvent {
  const e: NewEvent = {
    kind: "ctl",
    host: hostById(ref) ? ref : "soc",
    actor: "soc",
    title,
    detail,
    severity: "info",
    alert: false,
    tactic: "Response",
    technique: "Response",
    op,
    ref,
  };
  if (payload) e.payload = payload;
  return e;
}

const top = (d: Derived) => d.stack[d.stack.length - 1];

function findFile(d: Derived, host: string, name: string) {
  const n = name.trim();
  return d.files.find(
    (f) => f.host === host && (f.path === n || baseName(f.path) === n || f.path.endsWith("/" + n)),
  );
}

function recordOf(f: DecoyFile, d: Derived) {
  return f.decoy && !d.disarmed.has(f.id);
}

export const HELP: Line[] = [
  line("sys", "Commands available on this foothold:"),
  line("out", "  scan                     probe neighbouring hosts"),
  line("out", "  ls                       list files on this host"),
  line("out", "  cat <file>               read a file"),
  line("out", "  download <file>          copy a file out of the network"),
  line("out", "  ssh <user>@<host>        open a session on a neighbour"),
  line("out", "  aws-login <access-key>   test a cloud access key"),
  line("out", "  whoami | pwd | exit | clear | restart"),
];

/* ---------------------------------------------------------------- commands */

export function execCommand(raw: string, d: Derived): ExecResult {
  const cmdline = raw.trim();
  const [cmd, ...rest] = cmdline.split(/\s+/);
  const arg = rest.join(" ");
  if (!cmd) return { out: [], events: [] };

  if (cmd === "help") return { out: HELP, events: [] };

  if (cmd === "restart") {
    if (d.alive) return { out: [line("err", "A foothold is already open.")], events: [] };
    if (d.contained.has(ENTRY_HOST)) return { out: [line("err", `${ENTRY_HOST} is isolated by the SOC. No new foothold is possible.`)], events: [] };
    return {
      out: [line("sys", `Phishing payload executed. New foothold on ${ENTRY_HOST} as ${ENTRY_USER}.`)],
      events: [startSession()],
    };
  }

  if (!d.alive) {
    return { out: [line("err", "Session terminated by SOC isolation. Type restart to land a new foothold.")], events: [] };
  }

  const here = top(d);

  switch (cmd) {
    case "whoami":
      return { out: [line("out", here.user)], events: [] };
    case "pwd":
      return { out: [line("out", `${here.user}@${here.host}`)], events: [] };

    case "scan": {
      const nb = neighbors(here.host).filter((h) => !d.contained.has(h));
      const out = [line("sys", `Scanning from ${here.host}...`)];
      if (!nb.length) out.push(line("err", "No reachable hosts."));
      for (const h of nb) out.push(line("out", `  ${hostById(h)!.ip.padEnd(12)} ${h.padEnd(14)} ssh/22 open`));
      const events: NewEvent[] = [
        ev({
          kind: "scan",
          host: here.host,
          actor: here.user,
          title: `Port scan from ${here.host}`,
          detail: `${nb.length} neighbouring hosts probed: ${nb.join(", ") || "none"}.`,
          tactic: "Reconnaissance",
          technique: "T1046 Network Service Discovery",
        }),
      ];
      for (const h of nb) {
        if (hostById(h)?.decoy) {
          events.push(
            ev({
              kind: "probe",
              host: h,
              actor: here.user,
              title: `Decoy host ${h} probed`,
              detail: `${h} is not in any asset inventory. A scan from ${here.host} touched it, so someone is mapping the network.`,
              severity: "medium",
              alert: true,
              tactic: "Reconnaissance",
              technique: "T1046 Network Service Discovery",
              from: here.host,
              to: h,
            }),
          );
        }
      }
      return { out, events };
    }

    case "ls": {
      const fs = d.files.filter((f) => f.host === here.host);
      const out = fs.length ? fs.map((f) => line("out", `  ${f.size.padEnd(8)} ${f.path}`)) : [line("out", "  (empty)")];
      return {
        out,
        events: [
          ev({
            kind: "list",
            host: here.host,
            actor: here.user,
            title: `Directory listing on ${here.host}`,
            detail: `${fs.length} files enumerated by ${here.user}.`,
            tactic: "Reconnaissance",
            technique: "T1083 File and Directory Discovery",
          }),
        ],
      };
    }

    case "cat": {
      if (!arg) return { out: [line("err", "usage: cat <file>")], events: [] };
      const f = findFile(d, here.host, arg);
      if (!f) return { out: [line("err", `cat: ${arg}: No such file or directory`)], events: [] };
      const trap = recordOf(f, d);
      const planted = f.plants ? d.creds.find((c) => c.id === f.plants) : undefined;
      const e: NewEvent = trap
        ? ev({
            kind: "read",
            host: here.host,
            actor: here.user,
            title: `Honeyfile opened: ${baseName(f.path)}`,
            detail: `${here.user} opened decoy ${f.path} on ${here.host}${planted ? ` and exposed credentials that only exist in this trap` : ""}.`,
            severity: "high",
            alert: true,
            tactic: planted ? "Credential access" : "Collection",
            technique: planted ? "T1552.001 Credentials In Files" : "T1005 Data from Local System",
            ref: f.id,
          })
        : ev({
            kind: "read",
            host: here.host,
            actor: here.user,
            title: `File read: ${baseName(f.path)}`,
            detail: `${here.user} read ${f.path}.`,
            tactic: "Collection",
            technique: "T1005 Data from Local System",
            ref: f.id,
          });
      return { out: f.content.map((s) => line("out", s)), events: [e] };
    }

    case "download": {
      if (!arg) return { out: [line("err", "usage: download <file>")], events: [] };
      const f = findFile(d, here.host, arg);
      if (!f) return { out: [line("err", `download: ${arg}: No such file`)], events: [] };
      const trap = recordOf(f, d);
      return {
        out: [line("sys", `Sending ${baseName(f.path)} (${f.size}) over outbound channel...`), line("out", "Transfer complete.")],
        events: [
          ev({
            kind: "exfil",
            host: here.host,
            actor: here.user,
            title: trap ? `Decoy data exfiltrated: ${baseName(f.path)}` : `File copied out: ${baseName(f.path)}`,
            detail: trap
              ? `${f.size} left ${here.host} over an outbound channel. The data is fake, the intent is real.`
              : `${f.size} left ${here.host} over an outbound channel.`,
            severity: trap ? "critical" : "info",
            alert: trap,
            tactic: "Exfiltration",
            technique: "T1041 Exfiltration Over C2 Channel",
            ref: f.id,
          }),
        ],
      };
    }

    case "ssh": {
      const m = /^([\w.\-]+)@([\w.\-]+)$/.exec(arg);
      if (!m) return { out: [line("err", "usage: ssh <user>@<host>")], events: [] };
      const [, user, host] = m;
      if (!hostById(host) || !neighbors(here.host).includes(host) || d.contained.has(host)) {
        return { out: [line("err", `ssh: connect to host ${host} port 22: No route to host`)], events: [] };
      }
      return { out: [line("sys", `${user}@${host}'s password:`)], events: [], prompt: { type: "password", user, host, from: here.host } };
    }

    case "aws-login": {
      if (!arg) return { out: [line("err", "usage: aws-login <access-key>")], events: [] };
      const c = d.creds.find((x) => x.kind === "cloud" && x.user === arg);
      if (c && c.honeytoken) {
        const armed = !d.disarmedCreds.has(c.id);
        return {
          out: [line("out", "Authenticated. Account 4417-0000-2291, role OpsReadOnly.")],
          events: [
            ev({
              kind: "cred_use",
              host: here.host,
              actor: arg,
              title: `Honeytoken cloud key used: ${arg}`,
              detail: `${arg} exists only inside a trap file. The cloud provider call came from ${here.host}.`,
              severity: armed ? "critical" : "info",
              alert: armed,
              tactic: "Credential access",
              technique: "T1552.005 Cloud Instance Metadata API",
              ref: c.id,
            }),
          ],
        };
      }
      return {
        out: [line("err", "An error occurred (InvalidClientTokenId): the security token is invalid.")],
        events: [
          ev({
            kind: "login_fail",
            host: here.host,
            actor: here.user,
            title: "Unknown cloud key rejected",
            detail: `${arg} is not one of our tokens.`,
            tactic: "Credential access",
            technique: "T1078.004 Cloud Accounts",
          }),
        ],
      };
    }

    case "exit": {
      if (d.stack.length < 2) return { out: [line("err", "logout: nowhere further to go.")], events: [] };
      const back = d.stack[d.stack.length - 2];
      return {
        out: [line("sys", `Connection to ${here.host} closed. Back on ${back.host}.`)],
        events: [
          ev({
            kind: "exit",
            host: here.host,
            actor: here.user,
            title: `Session closed on ${here.host}`,
            detail: `${here.user} returned to ${back.host}.`,
            tactic: "Lateral movement",
            technique: "T1021.004 Remote Services: SSH",
            from: here.host,
            to: back.host,
          }),
        ],
      };
    }

    default:
      return { out: [line("err", `${cmd}: command not found. Try help.`)], events: [] };
  }
}

export function startSession(): NewEvent {
  return ev({
    kind: "session",
    host: ENTRY_HOST,
    actor: ENTRY_USER,
    title: `Foothold established on ${ENTRY_HOST}`,
    detail: `Endpoint sensor saw a new interactive session started by a phishing payload (user ${ENTRY_USER}).`,
    tactic: "Initial access",
    technique: "T1566 Phishing",
  });
}

function loginEvents(p: Prompt, cred: Credential, d: Derived): ExecResult {
  const armed = cred.honeytoken && !d.disarmedCreds.has(cred.id);
  const target = hostById(p.host)!;
  const out = [line("sys", `Last login: today from ${p.from}`), line("out", `Welcome to ${p.host} (${target.role}).`)];
  if (cred.honeytoken) {
    return {
      out,
      ok: true,
      events: [
        ev({
          kind: "cred_use",
          host: p.host,
          actor: p.user,
          title: `Honeytoken ${cred.label} logged in to ${p.host}`,
          detail: `The account ${cred.user} exists only inside a trap file. It was used to open a session on ${p.host}${target.decoy ? ", a decoy host" : ""}, coming from ${p.from}.`,
          severity: armed ? "critical" : "info",
          alert: armed,
          tactic: "Lateral movement",
          technique: "T1078 Valid Accounts",
          from: p.from,
          to: p.host,
          ref: cred.id,
        }),
      ],
    };
  }
  return {
    out,
    ok: true,
    events: [
      ev({
        kind: "login",
        host: p.host,
        actor: p.user,
        title: `${p.user} moved ${p.from} to ${p.host}`,
        detail: `Valid account login over SSH on ${p.host}.`,
        tactic: "Lateral movement",
        technique: "T1021.004 Remote Services: SSH",
        from: p.from,
        to: p.host,
        ref: cred.id,
      }),
    ],
  };
}

export function execPassword(pw: string, p: Prompt, d: Derived): ExecResult {
  const cred = d.creds.find((c) => c.kind === "ssh" && c.user === p.user);
  const good = !!cred && cred.hosts.includes(p.host) && cred.secret === pw;
  if (!good) {
    const trapName = !!cred?.honeytoken && !d.disarmedCreds.has(cred.id);
    return {
      ok: false,
      out: [line("err", "Permission denied, please try again.")],
      events: [
        ev({
          kind: "login_fail",
          host: p.host,
          actor: p.user,
          title: trapName ? `Honeytoken name tried: ${p.user}` : `Failed login for ${p.user}`,
          detail: trapName
            ? `${p.user} is an account that only exists in a trap file, so someone is replaying stolen data. The password was wrong.`
            : `Password rejected on ${p.host}.`,
          severity: trapName ? "high" : "low",
          alert: trapName,
          tactic: "Credential access",
          technique: "T1110 Brute Force",
          from: p.from,
          to: p.host,
          ref: cred?.id,
        }),
      ],
    };
  }
  if (cred!.mfa) {
    return { ok: true, out: [line("sys", "Verification code required.")], events: [], prompt: { ...p, type: "mfa" } };
  }
  return loginEvents(p, cred!, d);
}

export function execMfa(code: string, p: Prompt, d: Derived): ExecResult {
  const cred = d.creds.find((c) => c.kind === "ssh" && c.user === p.user)!;
  if (code !== MFA_CODE) {
    return {
      ok: false,
      out: [line("err", "Verification code rejected.")],
      events: [
        ev({
          kind: "login_fail",
          host: p.host,
          actor: p.user,
          title: `MFA code rejected for ${p.user}`,
          detail: `A wrong verification code was entered on ${p.host}.`,
          severity: "low",
          tactic: "Credential access",
          technique: "T1111 Multi-Factor Authentication Interception",
          from: p.from,
          to: p.host,
        }),
      ],
      prompt: p,
    };
  }
  return loginEvents(p, cred, d);
}

/* -------------------------------------------------------------- deployment */

const rnd = (n: number, chars: string) =>
  Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join("");

export function buildDeploy(templateId: string, host: string, d: Derived): NewEvent | { error: string } {
  const t = TEMPLATES.find((x) => x.id === templateId);
  if (!t) return { error: "Pick a decoy template first." };
  if (!hostById(host)) return { error: "Pick a target host first." };
  if (d.files.some((f) => f.host === host && f.path === t.path)) {
    return { error: `${host} already has ${t.path}. Pick another host or template.` };
  }
  const n = rnd(5, "abcdefghjkmnpqrstuvwxyz23456789");
  const credId = `tok-dep-${n}`;
  const user =
    t.kind === "cloud" ? `AKIAZ7TRIP${rnd(9, "ABCDEFGHJKLMNPQRSTUVWXYZ234567")}` : `svc_${rnd(4, "abcdefghjkmnpqrstuvwxyz")}${rnd(2, "23456789")}`;
  const secret = t.kind === "cloud" ? rnd(32, "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789") : `${rnd(8, "abcdefghjkmnpqrstuvwxyz")}!${rnd(2, "23456789")}`;
  const cred: Credential = {
    id: credId,
    user,
    secret,
    hosts: t.kind === "cloud" ? [] : neighbors(host),
    honeytoken: true,
    kind: t.kind,
    label: user,
    deployed: true,
  };
  const file: DecoyFile = {
    id: `dep-${n}`,
    host,
    path: t.path,
    decoy: true,
    size: "1 KB",
    content: t.lines(user, secret),
    plants: credId,
    deployed: true,
  };
  return ctl("deploy", file.id, `Decoy deployed: ${t.label}`, `${t.path} on ${host} now carries honeytoken ${user}. Any read or use raises an alert.`, { file, cred });
}

/* ---------------------------------------------------------- reconstruction */

export interface Hop {
  from: string;
  to: string;
  ts: number;
  user: string;
  honey: boolean;
  credLabel?: string;
}
export interface Lineage {
  credId: string;
  label: string;
  file: string;
  fileHost: string;
  leakedAt?: number;
  usedAt?: number;
  usedOn?: string;
}
export interface Reconstruction {
  route: string[];
  hops: Hop[];
  lineage: Lineage[];
  phases: Record<string, number>;
  position: string | null;
  first: number;
  last: number;
  dwell: number;
  risk: number;
  tier: "clear" | "low" | "medium" | "high" | "critical";
  decoyHits: number;
  observed: number;
  exfil: DEvent[];
  narrative: string[];
  actions: string[];
}

export const fmtTime = (ts: number) =>
  new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

export const fmtDur = (ms: number) => {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${String(s % 60).padStart(2, "0")}s`;
};

export function reconstruct(d: Derived): Reconstruction {
  const act = d.sorted.filter((e) => e.kind !== "ctl");
  const hops: Hop[] = [];
  const route: string[] = [];
  for (const e of act) {
    if (e.kind === "session") route.push(e.host);
    if ((e.kind === "login" || e.kind === "cred_use") && e.from && e.to) {
      hops.push({
        from: e.from,
        to: e.to,
        ts: e.ts,
        user: e.actor,
        honey: e.kind === "cred_use",
        credLabel: d.creds.find((c) => c.id === e.ref)?.label,
      });
      if (!route.includes(e.to)) route.push(e.to);
    }
  }
  const lineage: Lineage[] = [];
  for (const c of d.creds.filter((x) => x.honeytoken)) {
    const src = d.files.find((f) => f.plants === c.id);
    const read = act.find((e) => e.kind === "read" && e.ref === src?.id);
    const used = act.find((e) => e.kind === "cred_use" && e.ref === c.id);
    if (!read && !used) continue;
    lineage.push({
      credId: c.id,
      label: c.label,
      file: src ? src.path : "unknown file",
      fileHost: src ? src.host : "unknown",
      leakedAt: read?.ts,
      usedAt: used?.ts,
      usedOn: used ? used.to ?? used.host : undefined,
    });
  }
  const phases: Record<string, number> = {};
  for (const e of act) phases[e.tactic] = (phases[e.tactic] ?? 0) + 1;
  const live = d.alerts.filter((a) => d.triage.get(a.id) !== "dismiss");
  const risk = Math.min(100, live.reduce((n, a) => n + WEIGHT[a.severity], 0));
  const tier = risk >= 75 ? "critical" : risk >= 45 ? "high" : risk >= 20 ? "medium" : risk > 0 ? "low" : "clear";
  const first = act[0]?.ts ?? 0;
  const last = act[act.length - 1]?.ts ?? 0;
  const exfil = act.filter((e) => e.kind === "exfil" && e.alert);
  const position = d.alive ? d.stack[d.stack.length - 1].host : null;

  /* narrative */
  const n: string[] = [];
  if (act.length) {
    const sess = act.find((e) => e.kind === "session");
    n.push(
      `Activity starts at ${fmtTime(first)}${sess ? ` on ${sess.host}` : ""} and runs for ${fmtDur(last - first)}. ${act.filter((e) => e.alert).length} of ${act.length} observed events tripped a decoy.`,
    );
    const early = act.find((e) => e.kind === "probe");
    if (early)
      n.push(`Recon was visible early: a port scan touched ${early.host}, a host that no legitimate user would ever contact.`);
    for (const l of lineage) {
      n.push(
        `${l.label} was lifted from ${l.file} on ${l.fileHost}${l.leakedAt ? ` at ${fmtTime(l.leakedAt)}` : ""} and ${
          l.usedAt ? `first used on ${l.usedOn} at ${fmtTime(l.usedAt)}` : "has not been used yet"
        }.`,
      );
    }
    if (route.length > 1) {
      const honeyHops = hops.filter((h) => h.honey).length;
      n.push(`Reconstructed route: ${route.join(" > ")}. ${honeyHops} of ${hops.length} hops relied on a honeytoken.`);
    }
    if (exfil.length) n.push(`${exfil.length} decoy file${exfil.length > 1 ? "s were" : " was"} taken off the network: ${exfil.map((e) => e.title.split(": ")[1]).join(", ")}. No real data was lost.`);
    if (d.contained.size) n.push(`Containment in place on ${[...d.contained].join(", ")}.`);
    n.push(position ? `The attacker is currently on ${position}.` : "The attacker has no live session.");
  }

  /* actions */
  const actions: string[] = [];
  for (const h of route) {
    const host = hostById(h);
    if (host && !host.decoy && !d.contained.has(h)) actions.push(`Isolate ${h} and collect memory and auth logs.`);
  }
  for (const l of lineage) actions.push(`Rotate everything that shared a vault with ${l.label} and retire ${l.file}.`);
  if (exfil.length) actions.push("Notify legal: the stolen files are decoys, but the exfiltration path is real.");
  if (!actions.length && act.length) actions.push("Keep monitoring. No lateral movement has been confirmed.");

  return { route, hops, lineage, phases, position, first, last, dwell: last - first, risk, tier, decoyHits: act.filter((e) => e.alert).length, observed: act.length, exfil, narrative: n, actions };
}

export function buildMarkdown(d: Derived, r: Reconstruction, room: string): string {
  const L: string[] = [];
  L.push(`# Incident report, room ${room}`, "");
  L.push(`- Risk: ${r.risk}/100 (${r.tier})`);
  L.push(`- Dwell time: ${fmtDur(r.dwell)}`);
  L.push(`- Hosts touched: ${r.route.length}`);
  L.push(`- Alerts: ${d.alerts.length}`, "");
  L.push("## Narrative", "", ...(r.narrative.length ? r.narrative : ["No activity recorded."]).map((s) => `- ${s}`), "");
  L.push("## Movement", "", r.route.length ? r.route.join(" > ") : "No route yet.", "");
  L.push("## Alerts", "", "| Time | Severity | Host | Alert |", "|---|---|---|---|");
  for (const a of d.alerts) L.push(`| ${fmtTime(a.ts)} | ${a.severity} | ${a.host} | ${a.title} |`);
  L.push("", "## Timeline", "");
  for (const e of d.sorted) L.push(`- ${fmtTime(e.ts)} [${e.tactic}] ${e.title}. ${e.detail}`);
  L.push("", "## Recommended actions", "", ...(r.actions.length ? r.actions : ["None yet."]).map((s) => `- ${s}`), "");
  return L.join("\n");
}

export { HOSTS };
