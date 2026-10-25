/**
 * Client-side PDF incident report generator using jsPDF.
 * Produces a styled, professional cybersecurity incident report
 * with branded header, tables, timeline, and crypto attestation.
 * Runs entirely in the browser — no server needed (works on Vercel).
 */

import { jsPDF } from "jspdf";
import type { Derived } from "./engine";
import type { Reconstruction } from "./engine";
import { fmtTime, SEV_ORDER } from "./engine";
import { buildChain, truncHex, KEY_SIZES } from "./crypto";

/* ---- colour palette (RGB tuples) ---- */
type RGB = [number, number, number];
const C = {
  bg:      [10, 10, 10]   as RGB,
  surface: [27, 27, 26]   as RGB,
  ink:     [242, 240, 234] as RGB,
  dim:     [154, 150, 140] as RGB,
  accent:  [232, 69, 44]   as RGB,
  green:   [52, 211, 153]  as RGB,
  yellow:  [251, 191, 36]  as RGB,
  line:    [48, 46, 42]    as RGB,
};

const SEV_COLOUR: Record<string, RGB> = {
  critical: C.accent,
  high:     [239, 68, 68],
  medium:   C.yellow,
  low:      C.green,
  info:     C.dim,
};

function sevColour(s: string): RGB {
  return SEV_COLOUR[s] ?? C.dim;
}

function fill(doc: jsPDF, c: RGB) { doc.setFillColor(c[0], c[1], c[2]); }
function stroke(doc: jsPDF, c: RGB) { doc.setDrawColor(c[0], c[1], c[2]); }
function ink(doc: jsPDF, c: RGB) { doc.setTextColor(c[0], c[1], c[2]); }

/* ---- helpers ---- */

function addPage(doc: jsPDF) {
  doc.addPage();
  fill(doc, C.bg);
  doc.rect(0, 0, 210, 297, "F");
  return 20;
}

function sectionHeader(doc: jsPDF, title: string, y: number): number {
  doc.setFontSize(14);
  ink(doc, C.accent);
  doc.text(title.toUpperCase(), 15, y);
  y += 2;
  stroke(doc, C.line);
  doc.setLineWidth(0.5);
  doc.line(15, y, 195, y);
  return y + 8;
}

function kvLabel(doc: jsPDF, key: string, value: string, x: number, y: number): number {
  doc.setFontSize(8);
  ink(doc, C.dim);
  doc.text(key.toUpperCase(), x, y);
  doc.setFontSize(10);
  ink(doc, C.ink);
  doc.text(value, x, y + 5);
  return y + 12;
}

function ensureSpace(doc: jsPDF, y: number, need: number): number {
  if (y + need > 280) return addPage(doc);
  return y;
}

function pageFooter(doc: jsPDF) {
  doc.setFontSize(7);
  ink(doc, C.dim);
  doc.text("TRIPWIRE — Cyber Deception Platform | Post-Quantum Secured | CONFIDENTIAL", 15, 290);
}

/* ---- main export ---- */

export function generatePDF(d: Derived, r: Reconstruction, room: string, events: { id: string; ts: number }[]) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const chain = buildChain(d.sorted);
  const now = new Date();

  /* ====== PAGE 1: COVER ====== */
  fill(doc, C.bg);
  doc.rect(0, 0, 210, 297, "F");

  // accent stripe
  fill(doc, C.accent);
  doc.rect(0, 0, 210, 6, "F");

  // logo + title
  let y = 40;
  doc.setFontSize(32);
  ink(doc, C.ink);
  doc.text("TRIPWIRE", 15, y);
  y += 10;
  doc.setFontSize(12);
  ink(doc, C.dim);
  doc.text("Cyber Deception Platform  —  Incident Report", 15, y);

  // cover info block
  y += 25;
  fill(doc, C.surface);
  doc.roundedRect(15, y - 5, 180, 55, 3, 3, "F");

  y = kvLabel(doc, "Room ID", room, 20, y);
  y = kvLabel(doc, "Generated", now.toLocaleString(), 20, y);
  y = kvLabel(doc, "Events", `${events.length} events logged`, 20, y);
  y = kvLabel(doc, "Risk Score", `${r.risk}/100  —  ${r.risk >= 60 ? "CRITICAL" : r.risk >= 30 ? "HIGH" : "LOW"}`, 20, y);

  // risk bar
  y += 3;
  fill(doc, C.line);
  doc.roundedRect(20, y, 160, 4, 2, 2, "F");
  const riskColor = r.risk >= 60 ? C.accent : r.risk >= 30 ? C.yellow : C.green;
  fill(doc, riskColor);
  doc.roundedRect(20, y, Math.max(3, (r.risk / 100) * 160), 4, 2, 2, "F");

  // narrative summary
  y += 18;
  doc.setFontSize(10);
  ink(doc, C.ink);
  const narrative = r.narrative.length ? r.narrative.join(" ") : "No intrusion detected.";
  const narLines = doc.splitTextToSize(narrative, 170);
  doc.text(narLines, 20, y);
  y += narLines.length * 5 + 10;

  // PQ attestation box
  y = ensureSpace(doc, y, 40);
  fill(doc, [20, 20, 18] as RGB);
  doc.roundedRect(15, y - 3, 180, 35, 3, 3, "F");
  doc.setFontSize(8);
  ink(doc, C.accent);
  doc.text("POST-QUANTUM ATTESTATION", 20, y + 3);
  ink(doc, C.dim);
  doc.setFontSize(7);
  doc.text(`Hash chain: ${chain.length} blocks  —  SHA-256 linked`, 20, y + 10);
  doc.text(`Chain head: ${chain.length ? truncHex(chain[chain.length - 1].hash, 16) : "empty"}`, 20, y + 15);
  doc.text(`Key exchange: ${KEY_SIZES.kem.name} (${KEY_SIZES.kem.standard})  —  quantum-safe`, 20, y + 20);
  doc.text(`Signatures: ${KEY_SIZES.dsa.name} (${KEY_SIZES.dsa.standard})  —  quantum-safe`, 20, y + 25);

  pageFooter(doc);

  /* ====== PAGE 2: ATTACK PATH + ALERTS ====== */
  y = addPage(doc);
  y = sectionHeader(doc, "Attack Path Reconstruction", y);

  // route
  doc.setFontSize(9);
  ink(doc, C.ink);
  doc.text("Route:", 15, y);
  ink(doc, C.accent);
  doc.text(r.route.join("  →  ") || "None", 35, y);
  y += 10;

  // kill chain phases
  const phases = Object.keys(r.phases);
  if (phases.length) {
    ink(doc, C.ink);
    doc.text("Kill chain:", 15, y);
    ink(doc, C.dim);
    const chainText = doc.splitTextToSize(phases.join("  →  "), 140);
    doc.text(chainText, 42, y);
    y += chainText.length * 5 + 5;
  }

  // credential lineage
  if (r.lineage.length) {
    y = ensureSpace(doc, y, 10 + r.lineage.length * 7);
    y = sectionHeader(doc, "Credential Lineage", y);
    for (const l of r.lineage) {
      doc.setFontSize(8);
      ink(doc, C.ink);
      doc.text(l.label, 20, y);
      ink(doc, C.dim);
      doc.text(`leaked on ${l.fileHost}  →  used on ${l.usedOn || "not used"}`, 55, y);
      y += 6;
    }
    y += 5;
  }

  /* ---- ALERT TABLE ---- */
  y = ensureSpace(doc, y, 30);
  y = sectionHeader(doc, "Alerts", y);

  const sortedAlerts = [...d.alerts].sort((a, b) => SEV_ORDER.indexOf(b.severity) - SEV_ORDER.indexOf(a.severity));

  // table header row
  fill(doc, C.surface);
  doc.rect(15, y - 4, 180, 8, "F");
  doc.setFontSize(7);
  ink(doc, C.dim);
  doc.text("SEV", 17, y);
  doc.text("TIME", 38, y);
  doc.text("HOST", 62, y);
  doc.text("TITLE", 90, y);
  y += 7;

  for (const a of sortedAlerts.slice(0, 30)) {
    y = ensureSpace(doc, y, 8);
    fill(doc, sevColour(a.severity));
    doc.circle(19, y - 1.5, 1.5, "F");
    doc.setFontSize(7);
    ink(doc, C.ink);
    doc.text(a.severity.toUpperCase(), 22, y);
    ink(doc, C.dim);
    doc.text(fmtTime(a.ts), 38, y);
    doc.text(a.host, 62, y);
    ink(doc, C.ink);
    const titleLine = doc.splitTextToSize(a.title, 100);
    doc.text(titleLine[0], 90, y);
    y += 6;
  }

  if (sortedAlerts.length > 30) {
    doc.setFontSize(7);
    ink(doc, C.dim);
    doc.text(`... and ${sortedAlerts.length - 30} more alerts`, 15, y + 2);
  }

  pageFooter(doc);

  /* ====== PAGE 3: TIMELINE ====== */
  y = addPage(doc);
  y = sectionHeader(doc, "Event Timeline", y);

  for (let i = 0; i < Math.min(d.sorted.length, 50); i++) {
    const e = d.sorted[i];
    y = ensureSpace(doc, y, 10);
    // timeline dot
    const dotCol = e.alert ? sevColour(e.severity) : C.dim;
    fill(doc, dotCol);
    doc.circle(18, y - 1, 1.2, "F");
    // connecting line
    if (i < d.sorted.length - 1 && i < 49) {
      stroke(doc, C.line);
      doc.setLineWidth(0.3);
      doc.line(18, y + 1, 18, y + 6);
    }
    doc.setFontSize(7);
    ink(doc, C.dim);
    doc.text(fmtTime(e.ts), 22, y);
    ink(doc, C.ink);
    const tl = doc.splitTextToSize(e.title, 95);
    doc.text(tl[0], 48, y);
    ink(doc, C.dim);
    doc.text(e.host, 155, y);
    y += 7;
  }

  if (d.sorted.length > 50) {
    doc.setFontSize(7);
    ink(doc, C.dim);
    doc.text(`... ${d.sorted.length - 50} more events`, 22, y);
  }

  pageFooter(doc);

  /* ====== PAGE 4: HASH CHAIN ====== */
  if (chain.length) {
    y = addPage(doc);
    y = sectionHeader(doc, "SHA-256 Hash Chain (Blockchain)", y);

    doc.setFontSize(8);
    ink(doc, C.dim);
    doc.text("Each event is hashed with the previous block's hash, forming a tamper-evident chain.", 15, y);
    y += 8;

    for (const b of chain.slice(-25)) {
      y = ensureSpace(doc, y, 11);
      fill(doc, C.surface);
      doc.roundedRect(15, y - 4, 180, 9, 1, 1, "F");
      doc.setFontSize(7);
      ink(doc, C.accent);
      doc.text(`#${String(b.index).padStart(3, "0")}`, 17, y);
      ink(doc, C.dim);
      doc.text(truncHex(b.hash, 10), 30, y);
      ink(doc, C.ink);
      const t = doc.splitTextToSize(b.title, 85);
      doc.text(t[0], 82, y);
      ink(doc, C.dim);
      doc.text(fmtTime(b.ts), 172, y);
      y += 10;
    }

    pageFooter(doc);
  }

  doc.save(`tripwire-incident-${room}.pdf`);
}
