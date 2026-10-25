import { useState } from "react";
import FuseButton from "../vendor/FuseButton/FuseButton";
import { buildMarkdown } from "../lib/engine";
import { useTripwire } from "../lib/store";

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const STATUS_COPY = {
  connecting: "Connecting to Firebase Realtime Database...",
  live: "Live. Every event is written to Firebase as it happens, and any browser on this room sees it.",
  offline: "Offline. The console keeps working from local storage and syncs when the connection returns.",
  denied: "Firebase refused the write because of the database rules. The console keeps working locally. Allow read and write on tripwire/ in the Firebase console to sync.",
} as const;

/** Lightweight markdown-to-HTML for the report preview (headers, tables, lists, bold). */
function renderMd(md: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const bold = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  const lines = md.split("\n");
  const out: string[] = [];
  let inTable = false;
  for (const raw of lines) {
    const l = raw;
    if (/^\|[-|: ]+\|$/.test(l)) continue;
    if (l.startsWith("| ")) {
      const cells = l.split("|").filter(Boolean).map((c) => `<td>${bold(c.trim())}</td>`).join("");
      if (!inTable) { out.push("<table>"); inTable = true; }
      out.push(`<tr>${cells}</tr>`);
      continue;
    }
    if (inTable) { out.push("</table>"); inTable = false; }
    if (l.startsWith("# ")) { out.push(`<h3>${esc(l.slice(2))}</h3>`); continue; }
    if (l.startsWith("## ")) { out.push(`<h4>${esc(l.slice(3))}</h4>`); continue; }
    if (l.startsWith("- ")) { out.push(`<p class="report__li">${bold(l.slice(2))}</p>`); continue; }
    if (l.trim() === "") { out.push("<br/>"); continue; }
    out.push(`<p>${bold(l)}</p>`);
  }
  if (inTable) out.push("</table>");
  return out.join("\n");
}

export default function Report() {
  const { d, r, room, status, shareUrl, reset, events } = useTripwire();
  const [copied, setCopied] = useState(false);
  const [raw, setRaw] = useState(false);
  const md = buildMarkdown(d, r, room);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      window.prompt("Copy this link", shareUrl);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="split">
      <div className="panel">
        <div className="panel__head">
          <h3>Export and sync</h3>
          <span className={`sev ${status === "live" ? "sev--high" : ""}`}>{status}</span>
        </div>
        <div className="panel__body topo__body">
          <p className="report__status">{STATUS_COPY[status]}</p>
          <dl className="kv">
            <div><dt>Room</dt><dd className="mono">{room}</dd></div>
            <div><dt>Events logged</dt><dd>{events.length}</dd></div>
            <div><dt>Share link</dt><dd className="mono report__link">{shareUrl}</dd></div>
          </dl>
          <div className="report__btns">
            <button className="btn btn--sm" onClick={copy} aria-label="Copy share link to clipboard">{copied ? "Link copied" : "Copy share link"}</button>
            <button className="btn btn--sm" onClick={() => download(`incident-${room}.md`, md, "text/markdown")} aria-label="Download incident report as Markdown">Download report (.md)</button>
            <button className="btn btn--sm" onClick={() => download(`events-${room}.json`, JSON.stringify(events, null, 2), "application/json")} aria-label="Download raw events as JSON">Download events (.json)</button>
            <button className="btn btn--sm btn--primary" onClick={() => { import("../lib/pdf").then(m => m.generatePDF(d, r, room, events)).catch(() => alert("PDF generation failed")); }} aria-label="Download styled PDF report">Download PDF report</button>
          </div>
          <div className="report__reset">
            <FuseButton
              label="Reset exercise"
              undoLabel="Undo"
              doneLabel="Cleared"
              color="#f2f0ea"
              background="#1b1b1a"
              fuseColor="#e8452c"
              radius={3}
              undoWindow={4000}
              commitOn="fuseEnd"
              onCommit={reset}
            />
            <span className="meta">Wipes the event log for this room, here and in Firebase, after a 4 second fuse.</span>
          </div>
        </div>
      </div>
      <div className="panel">
        <div className="panel__head">
          <h3>Report preview</h3>
          <button className="btn btn--sm" onClick={() => setRaw(!raw)} aria-label="Toggle raw markdown">{raw ? "Rendered" : "Raw markdown"}</button>
        </div>
        {raw ? (
          <pre className="report__md mono">{md}</pre>
        ) : (
          <div className="report__rendered" dangerouslySetInnerHTML={{ __html: renderMd(md) }} />
        )}
      </div>
    </div>
  );
}
