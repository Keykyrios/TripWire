import { vi, beforeAll } from "vitest";

vi.mock("firebase/database", () => ({
  getDatabase: () => ({}),
  ref: (_: unknown, p: string) => ({ p }),
  onValue: (r: { p: string }, cb: (s: { val: () => unknown }) => void) => {
    cb({ val: () => (r.p === ".info/connected" ? true : null) });
    return () => {};
  },
  set: () => Promise.resolve(),
  remove: () => Promise.resolve(),
}));
vi.mock("firebase/analytics", () => ({ getAnalytics: () => ({}), isSupported: () => Promise.resolve(false) }));
vi.mock("firebase/app", () => ({ initializeApp: () => ({}) }));

beforeAll(() => {
  const w = window as unknown as Record<string, unknown>;
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  w.matchMedia = (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false });
  (globalThis as Record<string, unknown>).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  (globalThis as Record<string, unknown>).IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
  HTMLCanvasElement.prototype.getContext = (() => null) as never;
  w.DOMMatrix = class { a = 1; b = 0; };
  Element.prototype.getAnimations = (() => []) as never;
  Element.prototype.animate = (() => {
    const a: Record<string, unknown> = { cancel() {}, finish() {}, pause() {}, play() {}, playState: "running", currentTime: 0, finished: Promise.resolve(), addEventListener() {} };
    Object.defineProperty(a, "onfinish", { set(fn: () => void) { setTimeout(fn, 40); }, get() { return null; } });
    return a;
  }) as never;
  (window as unknown as { Notification: unknown }).Notification = class { static permission = "denied"; static requestPermission() { return Promise.resolve("denied"); } };
  (navigator as unknown as { clipboard: unknown }).clipboard = { writeText: () => Promise.resolve() };
  URL.createObjectURL = () => "blob:x";
  URL.revokeObjectURL = () => {};
});
