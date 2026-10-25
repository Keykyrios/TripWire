import type { Credential, DecoyFile, Host } from "./types";

export const ENTRY_HOST = "ws-114";
export const ENTRY_USER = "jdoe";
export const MFA_CODE = "418203";

export const HOSTS: Host[] = [
  { id: "ws-114", ip: "10.0.4.114", role: "Workstation, finance", zone: "corp", decoy: false, x: 90, y: 250 },
  { id: "gw-edge", ip: "10.0.0.1", role: "Edge gateway", zone: "edge", decoy: false, x: 90, y: 90 },
  { id: "jump-01", ip: "10.0.2.10", role: "Bastion host", zone: "corp", decoy: false, x: 270, y: 250 },
  { id: "web-01", ip: "10.0.1.20", role: "Public web server", zone: "edge", decoy: false, x: 330, y: 70 },
  { id: "fs-corp", ip: "10.0.3.31", role: "Corporate file server", zone: "corp", decoy: false, x: 470, y: 160 },
  { id: "dc-01", ip: "10.0.3.5", role: "Domain controller", zone: "corp", decoy: false, x: 470, y: 340 },
  { id: "db-prod", ip: "10.0.5.40", role: "Production database", zone: "prod", decoy: false, x: 660, y: 280 },
  { id: "fs-archive-02", ip: "10.0.3.77", role: "Archive file server", zone: "corp", decoy: true, x: 660, y: 110 },
  { id: "bk-vault-03", ip: "10.0.5.91", role: "Backup vault", zone: "prod", decoy: true, x: 810, y: 350 },
];

export const EDGES: [string, string][] = [
  ["ws-114", "gw-edge"],
  ["ws-114", "jump-01"],
  ["gw-edge", "web-01"],
  ["jump-01", "fs-corp"],
  ["jump-01", "dc-01"],
  ["jump-01", "db-prod"],
  ["web-01", "fs-corp"],
  ["fs-corp", "fs-archive-02"],
  ["db-prod", "bk-vault-03"],
];

export const BASE_CREDS: Credential[] = [
  {
    id: "real-jdoe",
    user: "jdoe",
    secret: "Sunshine#22",
    hosts: ["jump-01"],
    honeytoken: false,
    mfa: true,
    kind: "ssh",
    label: "jdoe (employee account)",
  },
  {
    id: "tok-svc-backup",
    user: "svc_backup",
    secret: "B4ckup!Winter26",
    hosts: ["fs-corp", "fs-archive-02", "bk-vault-03"],
    honeytoken: true,
    kind: "ssh",
    label: "svc_backup",
  },
  {
    id: "tok-admin-legacy",
    user: "admin_legacy",
    secret: "L3gacy#Admin9",
    hosts: ["dc-01"],
    honeytoken: true,
    kind: "ssh",
    label: "admin_legacy",
  },
  {
    id: "tok-aws-ops",
    user: "AKIAZ7TRIPWIRE0OPS1",
    secret: "aws",
    hosts: [],
    honeytoken: true,
    kind: "cloud",
    label: "AWS key AKIAZ7TRIPWIRE0OPS1",
  },
];

export const BASE_FILES: DecoyFile[] = [
  {
    id: "f-bash",
    host: "ws-114",
    path: "/home/jdoe/.bash_history",
    decoy: false,
    size: "2 KB",
    content: [
      "cd ~/Documents",
      "ls",
      "vim token_backup.txt",
      "sshpass -p 'Sunshine#22' ssh jdoe@jump-01",
      "exit",
    ],
  },
  {
    id: "f-token",
    host: "ws-114",
    path: "/home/jdoe/Documents/token_backup.txt",
    decoy: false,
    size: "1 KB",
    content: ["Bastion MFA seed fallback", "Current code: 418203", "Rotate on the first of the month."],
  },
  {
    id: "f-q3",
    host: "ws-114",
    path: "/home/jdoe/Documents/q3_notes.docx",
    decoy: false,
    size: "44 KB",
    content: ["Q3 close checklist.", "Reconcile AR, accruals and intercompany."],
  },
  {
    id: "f-gw",
    host: "gw-edge",
    path: "/etc/gateway.conf",
    decoy: false,
    size: "3 KB",
    content: ["wan0 203.0.113.9", "nat inside 10.0.0.0/16"],
  },
  {
    id: "f-web",
    host: "web-01",
    path: "/var/www/app.conf",
    decoy: false,
    size: "5 KB",
    content: ["listen 443 ssl;", "root /var/www/public;"],
  },
  {
    id: "f-vpn",
    host: "jump-01",
    path: "/home/jdoe/notes/vpn_and_backup.txt",
    decoy: true,
    size: "1 KB",
    content: [
      "VPN notes and backup job login (keep private)",
      "backup service account: svc_backup",
      "password: B4ckup!Winter26",
      "works on fs-corp and the archive box",
    ],
    plants: "tok-svc-backup",
  },
  {
    id: "f-todo",
    host: "jump-01",
    path: "/home/jdoe/notes/todo.txt",
    decoy: false,
    size: "1 KB",
    content: ["renew bastion cert", "ask IT about the backup job"],
  },
  {
    id: "f-runbook",
    host: "fs-corp",
    path: "/shares/it/legacy_runbook.docx",
    decoy: true,
    size: "212 KB",
    content: [
      "Legacy domain recovery runbook",
      "Break glass account: admin_legacy",
      "password: L3gacy#Admin9",
      "use on dc-01 only",
    ],
    plants: "tok-admin-legacy",
  },
  {
    id: "f-handbook",
    host: "fs-corp",
    path: "/shares/hr/handbook.pdf",
    decoy: false,
    size: "1.2 MB",
    content: ["Employee handbook, revision 14."],
  },
  {
    id: "f-budget",
    host: "fs-corp",
    path: "/shares/finance/budget_2026.xlsx",
    decoy: false,
    size: "610 KB",
    content: ["FY26 operating budget by cost centre."],
  },
  {
    id: "f-env",
    host: "db-prod",
    path: "/opt/app/.env.bak",
    decoy: true,
    size: "1 KB",
    content: [
      "# old deploy env, delete me",
      "DB_HOST=db-prod",
      "AWS_ACCESS_KEY_ID=AKIAZ7TRIPWIRE0OPS1",
      "AWS_SECRET_ACCESS_KEY=r7Q2xT0m9DkVn3LwY8bPz1HcF5uEaJ6s",
    ],
    plants: "tok-aws-ops",
  },
  {
    id: "f-config",
    host: "db-prod",
    path: "/opt/app/config.yaml",
    decoy: false,
    size: "2 KB",
    content: ["pool: 20", "timeout: 30s"],
  },
  {
    id: "f-policies",
    host: "dc-01",
    path: "/sysvol/policies.xml",
    decoy: false,
    size: "88 KB",
    content: ["Group policy objects for corp.local"],
  },
  {
    id: "f-ntds",
    host: "dc-01",
    path: "/backup/ntds_backup.dit",
    decoy: true,
    size: "214 MB",
    content: ["[binary directory database, 214 MB]"],
  },
  {
    id: "f-payroll",
    host: "fs-archive-02",
    path: "/archive/payroll_2026_full.csv",
    decoy: true,
    size: "38 MB",
    content: ["employee_id,name,salary,iban", "E-1001,Placeholder Person,0,XX00 0000 0000"],
  },
  {
    id: "f-terms",
    host: "fs-archive-02",
    path: "/archive/hr_terminations.xlsx",
    decoy: true,
    size: "2 MB",
    content: ["[spreadsheet, 2 MB]"],
  },
  {
    id: "f-keys",
    host: "bk-vault-03",
    path: "/vault/keys_export.kdbx",
    decoy: true,
    size: "9 MB",
    content: ["[encrypted key vault, 9 MB]"],
  },
  {
    id: "f-restore",
    host: "bk-vault-03",
    path: "/vault/restore_creds.txt",
    decoy: true,
    size: "1 KB",
    content: ["restore job credentials rotated quarterly"],
  },
];

export const hostById = (id: string) => HOSTS.find((h) => h.id === id);
export const neighbors = (id: string) =>
  EDGES.filter(([a, b]) => a === id || b === id).map(([a, b]) => (a === id ? b : a));
export const baseName = (path: string) => path.split("/").pop() ?? path;

export interface DeployTemplate {
  id: string;
  label: string;
  path: string;
  lines: (user: string, secret: string) => string[];
  kind: "ssh" | "cloud";
}

export const TEMPLATES: DeployTemplate[] = [
  {
    id: "aws",
    label: "AWS credentials file",
    path: "/root/.aws/credentials",
    kind: "cloud",
    lines: (u, s) => ["[default]", `aws_access_key_id = ${u}`, `aws_secret_access_key = ${s}`],
  },
  {
    id: "ssh",
    label: "Saved SSH login note",
    path: "/home/admin/ssh_logins.txt",
    kind: "ssh",
    lines: (u, s) => ["prod hosts shared login", `user: ${u}`, `password: ${s}`],
  },
  {
    id: "pw",
    label: "Password spreadsheet",
    path: "/shares/it/passwords_2026.csv",
    kind: "ssh",
    lines: (u, s) => ["system,user,password", `core-net,${u},${s}`],
  },
];
