export type Severity = "info" | "low" | "medium" | "high" | "critical";

export type Kind =
  | "session"
  | "scan"
  | "list"
  | "read"
  | "login"
  | "login_fail"
  | "cred_use"
  | "probe"
  | "exfil"
  | "exit"
  | "ctl";

export type Tactic =
  | "Initial access"
  | "Reconnaissance"
  | "Credential access"
  | "Lateral movement"
  | "Collection"
  | "Exfiltration"
  | "Response";

export interface Host {
  id: string;
  ip: string;
  role: string;
  zone: "edge" | "corp" | "prod";
  decoy: boolean;
  x: number;
  y: number;
}

export interface DecoyFile {
  id: string;
  host: string;
  path: string;
  decoy: boolean;
  size: string;
  content: string[];
  plants?: string;
  deployed?: boolean;
}

export interface Credential {
  id: string;
  user: string;
  secret: string;
  hosts: string[];
  honeytoken: boolean;
  mfa?: boolean;
  kind: "ssh" | "cloud";
  label: string;
  deployed?: boolean;
}

export type CtlOp =
  | "contain"
  | "release"
  | "ack"
  | "escalate"
  | "dismiss"
  | "disarm"
  | "arm"
  | "retire"
  | "deploy";

export interface DEvent {
  id: string;
  ts: number;
  kind: Kind;
  host: string;
  actor: string;
  title: string;
  detail: string;
  severity: Severity;
  alert: boolean;
  tactic: Tactic;
  technique: string;
  from?: string;
  to?: string;
  ref?: string;
  op?: CtlOp;
  payload?: { file?: DecoyFile; cred?: Credential };
}

export interface Prompt {
  type: "password" | "mfa";
  user: string;
  host: string;
  from: string;
}
