import { describe, it, expect, beforeEach } from "vitest";
import { render, fireEvent, act, waitFor, within, cleanup } from "@testing-library/react";
import App from "../src/App";

const sleep = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });

function pick(el: HTMLElement) {
  fireEvent.pointerDown(el, { pointerId: 1, button: 0, clientX: 5, clientY: 5, isPrimary: true });
  fireEvent.pointerUp(el, { pointerId: 1, button: 0, clientX: 5, clientY: 5, isPrimary: true });
  fireEvent.click(el);
}

async function send(container: HTMLElement, text: string) {
  const input = container.querySelector(".term__input") as HTMLInputElement;
  fireEvent.change(input, { target: { value: text } });
  fireEvent.submit(input.closest("form")!);
  await sleep(10);
}

describe("Tripwire UI", () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
    window.history.replaceState(null, "", "/?room=TEST");
  });

  it("renders every section and every vendored component", async () => {
    const { container } = render(<App />);
    for (const id of ["top", "method", "network", "attacker", "alerts", "incident", "decoys", "report"]) {
      expect(container.querySelector(`#${id}`), id).toBeTruthy();
    }
    const classes = [
      ".line-sidebar", ".pixel-swap", ".squish-switch", ".bell-toggle", ".swipe-row, .alerts__list", ".jelly-radio", ".rubber-segment",
      ".branched-menu", ".folder-float", ".glide-select", ".shredder", ".fuse-button",
    ];
    for (const c of classes) expect(container.querySelector(c), c).toBeTruthy();
  });

  it("scripted-by-hand intrusion produces alerts, route, lineage, MFA via code slots", async () => {
    const { container } = render(<App />);
    await send(container, "restart");
    for (const c of ["scan", "ls", "cat .bash_history", "cat token_backup.txt", "ssh jdoe@jump-01", "Sunshine#22"]) await send(container, c);
    // MFA must now be asked through the code slots
    const slots = container.querySelector(".code-slots") as HTMLElement;
    expect(slots, "code slots shown").toBeTruthy();
    const codeInput = slots.querySelector("input") as HTMLInputElement;
    fireEvent.change(codeInput, { target: { value: "418203" } });
    await sleep(1400);
    expect(container.querySelector(".code-slots"), "code slots closed after success").toBeFalsy();
    for (const c of ["scan", "ls", "cat vpn_and_backup.txt", "ssh svc_backup@fs-corp", "B4ckup!Winter26", "ls", "cat legacy_runbook.docx", "ssh svc_backup@fs-archive-02", "B4ckup!Winter26", "ls", "cat payroll_2026_full.csv", "download payroll_2026_full.csv"]) await send(container, c);

    const alerts = container.querySelector("#alerts")!.textContent!;
    expect(alerts).toContain("Honeyfile opened: vpn_and_backup.txt");
    expect(alerts).toContain("Honeytoken svc_backup logged in to fs-corp");
    expect(alerts).toContain("Decoy data exfiltrated");
    const inc = container.querySelector("#incident") as HTMLElement;
    expect(inc.textContent).toContain("Foothold established on ws-114");
    pick(within(inc).getByRole("radio", { name: "Movement" }));
    await sleep(60);
    expect(inc.textContent).toContain("ws-114");
    expect(inc.textContent).toContain("fs-archive-02");
    expect(inc.textContent).toContain("honeytoken");
    pick(within(inc).getByRole("radio", { name: "Narrative" }));
    await sleep(60);
    expect(inc.textContent).toContain("Reconstructed route: ws-114 > jump-01 > fs-corp > fs-archive-02");
    // topology shows the attacker
    expect(container.querySelector(".attacker")).toBeTruthy();
    expect(container.querySelectorAll(".edge--route").length).toBe(3);
  });

  it("fuse isolation cuts the live session and the terminal says so", async () => {
    const { container } = render(<App />);
    await send(container, "restart");
    await send(container, "ssh jdoe@jump-01");
    await send(container, "Sunshine#22");
    const codeInput = container.querySelector(".code-slots input") as HTMLInputElement;
    fireEvent.change(codeInput, { target: { value: "418203" } });
    await sleep(1400);
    await send(container, "ssh svc_backup@fs-corp");
    await send(container, "B4ckup!Winter26");
    const node = [...container.querySelectorAll(".node")].find((n) => n.textContent?.startsWith("fs-corp"))!;
    fireEvent.click(node);
    const fuse = within(container.querySelector(".topo__inspect") as HTMLElement).getByRole("button", { name: /Isolate fs-corp/ });
    fireEvent.pointerDown(fuse, { button: 0 });
    fireEvent.click(fuse);
    await sleep(400);
    await waitFor(() => expect(container.querySelector(".term__body")!.textContent).toContain("[SOC] fs-corp was isolated"), { timeout: 4000 });
    expect(container.querySelector(".term")!.textContent).toContain("ws-114 > jump-01");
    expect(container.querySelectorAll(".node--cut").length).toBe(1);
  });

  it("auto-contain reacts to a critical alert", async () => {
    const { container } = render(<App />);
    const sw = within(container.querySelector(".cbar") as HTMLElement).getByRole("switch");
    pick(sw);
    await sleep(100);
    expect(sw.getAttribute("aria-checked")).toBe("true");
    await send(container, "restart");
    await send(container, "ssh jdoe@jump-01");
    await send(container, "Sunshine#22");
    fireEvent.change(container.querySelector(".code-slots input") as HTMLInputElement, { target: { value: "418203" } });
    await sleep(1400);
    await send(container, "ssh svc_backup@fs-corp");
    await send(container, "B4ckup!Winter26");
    await sleep(200);
    expect(container.querySelector("#incident")!.textContent).toContain("fs-corp isolated automatically");
    expect(container.querySelector(".term__body")!.textContent).toContain("[SOC] fs-corp was isolated");
  });

  it("decoy deployment, arm switch and reset work", async () => {
    const { container } = render(<App />);
    const decoys = container.querySelector("#decoys") as HTMLElement;
    const before = decoys.querySelector(".dstats")!.textContent!;
    fireEvent.click(within(decoys).getByRole("button", { name: "Deploy decoy" }));
    await sleep(50);
    expect(decoys.textContent).toContain("planted on ws-114");
    expect(decoys.querySelector(".dstats")!.textContent).not.toBe(before);
    // second identical deploy is refused
    fireEvent.click(within(decoys).getByRole("button", { name: "Deploy decoy" }));
    await sleep(50);
    expect(decoys.textContent).toContain("already has");
    // reset through the fuse
    const rep = container.querySelector("#report") as HTMLElement;
    const fuse = within(rep).getByRole("button", { name: /Reset exercise/ });
    fireEvent.pointerDown(fuse, { button: 0 });
    fireEvent.click(fuse);
    await waitFor(() => expect(decoys.querySelector(".dstats")!.textContent).toBe(before), { timeout: 4000 });
    expect(container.querySelector("#alerts")!.textContent).toContain("Quiet so far");
  });

  it("demo button runs the whole scripted intrusion end to end", async () => {
    const { container } = render(<App />);
    fireEvent.click(within(container.querySelector(".cbar") as HTMLElement).getByRole("button", { name: "Run demo intrusion" }));
    await waitFor(() => expect(container.querySelector("#alerts")!.textContent).toContain("Decoy data exfiltrated"), { timeout: 55000, interval: 700 });
    const inc = container.querySelector("#incident")!.textContent!;
    expect(inc).toContain("Exfiltration");
    expect(container.querySelectorAll(".edge--route").length).toBe(3);
  });
});
