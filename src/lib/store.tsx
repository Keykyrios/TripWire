import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { onValue, ref, remove, set } from "firebase/database";
import { db, ROOT_PATH } from "./firebase";
import { ctl, derive, reconstruct, type Derived, type NewEvent, type Reconstruction } from "./engine";
import { hostById } from "./network";
import type { DEvent, Severity } from "./types";

export type SyncStatus = "connecting" | "live" | "offline" | "denied";
export interface Toast {
  id: string;
  title: string;
  detail: string;
  severity: Severity;
}

type Incoming = NewEvent & { id?: string };

interface Ctx {
  events: DEvent[];
  d: Derived;
  r: Reconstruction;
  room: string;
  status: SyncStatus;
  shareUrl: string;
  append: (e: Incoming[]) => DEvent[];
  getDerived: () => Derived;
  reset: () => void;
  autoContain: boolean;
  setAutoContain: (v: boolean) => void;
  notify: boolean;
  setNotify: (v: boolean) => void;
  toasts: Toast[];
  closeToast: (id: string) => void;
  demoTick: number;
  runDemo: () => void;
}

const StoreCtx = createContext<Ctx | null>(null);

function pickRoom() {
  const url = new URL(window.location.href);
  let room = (url.searchParams.get("room") || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  if (!room) {
    room = Array.from({ length: 4 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
    url.searchParams.set("room", room);
    window.history.replaceState(null, "", url.toString());
  }
  return room;
}

const clean = <T,>(o: T): T => JSON.parse(JSON.stringify(o));
const lsKey = (room: string) => `tripwire:${room}`;

function loadLocal(room: string): DEvent[] {
  try {
    const raw = localStorage.getItem(lsKey(room));
    return raw ? (JSON.parse(raw) as DEvent[]) : [];
  } catch {
    return [];
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const room = useMemo(pickRoom, []);
  const [events, setEvents] = useState<DEvent[]>(() => loadLocal(room));
  const [status, setStatus] = useState<SyncStatus>("connecting");
  const [autoContain, setAutoContain] = useState(false);
  const [notify, setNotify] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [demoTick, setDemoTick] = useState(0);

  const eventsRef = useRef<DEvent[]>(events);
  const pending = useRef(new Set<string>());
  const lastTs = useRef(0);
  const seen = useRef(new Set<string>(events.map((e) => e.id)));
  const primed = useRef(false);
  const cache = useRef<{ src: DEvent[]; d: Derived } | null>(null);
  const statusRef = useRef<SyncStatus>("connecting");
  const denied = useRef(false);

  const setSync = useCallback((s: SyncStatus) => {
    statusRef.current = s;
    setStatus(s);
  }, []);

  const commit = useCallback(
    (next: DEvent[]) => {
      const sorted = [...next].sort((a, b) => a.ts - b.ts || a.id.localeCompare(b.id));
      eventsRef.current = sorted;
      setEvents(sorted);
      try {
        localStorage.setItem(lsKey(room), JSON.stringify(sorted));
      } catch {
        /* storage full or blocked, sync still works */
      }
    },
    [room],
  );

  /* ---------------------------------------------------------- firebase */
  const evPath = `${ROOT_PATH}/${room}/events`;

  useEffect(() => {
    const offline = window.setTimeout(() => {
      if (statusRef.current === "connecting") setSync("offline");
    }, 7000);

    const stopConn = onValue(ref(db, ".info/connected"), (snap) => {
      if (denied.current) return;
      if (snap.val() === true) {
        window.clearTimeout(offline);
        setSync("live");
      } else if (statusRef.current === "live") setSync("offline");
    });

    const stopEvents = onValue(
      ref(db, evPath),
      (snap) => {
        const val = snap.val() as Record<string, DEvent> | null;
        const remote = val ? Object.values(val) : [];
        const map = new Map<string, DEvent>(remote.map((e) => [e.id, e]));
        for (const e of eventsRef.current) if (pending.current.has(e.id)) map.set(e.id, e);
        commit([...map.values()]);
        if (!primed.current) {
          for (const e of map.values()) seen.current.add(e.id);
          primed.current = true;
        }
      },
      (err) => {
        if (String(err?.message || err).toLowerCase().includes("permission")) {
          denied.current = true;
          setSync("denied");
        } else setSync("offline");
      },
    );
    return () => {
      window.clearTimeout(offline);
      stopConn();
      stopEvents();
    };
  }, [evPath, commit, setSync]);

  const push = useCallback(
    (e: DEvent) => {
      pending.current.add(e.id);
      set(ref(db, `${evPath}/${e.id}`), clean(e))
        .then(() => pending.current.delete(e.id))
        .catch((err) => {
          pending.current.delete(e.id);
          if (String(err?.message || err).toLowerCase().includes("permission")) {
            denied.current = true;
            setSync("denied");
          }
        });
    },
    [evPath, setSync],
  );

  /* ---------------------------------------------------------- actions */
  const append = useCallback(
    (incoming: Incoming[]) => {
      const have = new Set(eventsRef.current.map((e) => e.id));
      const made: DEvent[] = [];
      for (const raw of incoming) {
        const id = raw.id ?? `e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
        if (have.has(id)) continue;
        const ts = Math.max(Date.now(), lastTs.current + 1);
        lastTs.current = ts;
        made.push({ ...raw, id, ts } as DEvent);
        have.add(id);
      }
      if (!made.length) return [];
      commit([...eventsRef.current, ...made]);
      made.forEach(push);
      return made;
    },
    [commit, push],
  );

  const getDerived = useCallback(() => {
    const c = cache.current;
    if (c && c.src === eventsRef.current) return c.d;
    const fresh = derive(eventsRef.current);
    cache.current = { src: eventsRef.current, d: fresh };
    return fresh;
  }, []);

  const reset = useCallback(() => {
    pending.current.clear();
    seen.current.clear();
    commit([]);
    setToasts([]);
    remove(ref(db, evPath)).catch(() => undefined);
  }, [commit, evPath]);

  const d = useMemo(() => {
    const fresh = derive(events);
    cache.current = { src: events, d: fresh };
    return fresh;
  }, [events]);
  const r = useMemo(() => reconstruct(d), [d]);

  /* ---------------------------------------------- alert toasts + response */
  const autoRef = useRef(autoContain);
  autoRef.current = autoContain;
  const notifyRef = useRef(notify);
  notifyRef.current = notify;

  useEffect(() => {
    const fresh = events.filter((e) => e.alert && !seen.current.has(e.id));
    if (!fresh.length) return;
    for (const a of fresh) seen.current.add(a.id);
    if (notifyRef.current) {
      setToasts((t) => [...fresh.map((a) => ({ id: a.id, title: a.title, detail: a.detail, severity: a.severity })), ...t].slice(0, 4));
      /* subtle alert chime via Web Audio API — no external files */
      try {
        const worst = fresh.reduce((w, a) => (a.severity === "critical" ? "critical" : a.severity === "high" && w !== "critical" ? "high" : w), "" as string);
        if (worst === "critical" || worst === "high") {
          const ctx = new AudioContext();
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = "sine";
          o.frequency.setValueAtTime(worst === "critical" ? 880 : 660, ctx.currentTime);
          o.frequency.exponentialRampToValueAtTime(worst === "critical" ? 440 : 330, ctx.currentTime + 0.15);
          g.gain.setValueAtTime(0.12, ctx.currentTime);
          g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
          o.connect(g).connect(ctx.destination);
          o.start();
          o.stop(ctx.currentTime + 0.25);
          o.onended = () => ctx.close();
        }
      } catch {
        /* audio is optional */
      }
      try {
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification(fresh[0].title, { body: fresh[0].detail });
        }
      } catch {
        /* notifications are optional */
      }
    }
    if (autoRef.current) {
      for (const a of fresh) {
        const live = Date.now() - a.ts < 20000;
        const host = a.host;
        if (a.severity === "critical" && live && hostById(host) && !getDerived().contained.has(host)) {
          const c = ctl("contain", host, `${host} isolated automatically`, `Auto-containment cut ${host} off the network after a critical alert.`);
          append([{ ...c, id: `auto-${a.id}` }]);
        }
      }
    }
  }, [events, append, getDerived]);

  const closeToast = useCallback((id: string) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  useEffect(() => {
    if (!toasts.length) return;
    const timer = window.setTimeout(() => setToasts((t) => t.slice(0, -1)), 7000);
    return () => window.clearTimeout(timer);
  }, [toasts]);

  const runDemo = useCallback(() => setDemoTick((n) => n + 1), []);
  const shareUrl = `${window.location.origin}${window.location.pathname}?room=${room}`;

  const value: Ctx = {
    events,
    d,
    r,
    room,
    status,
    shareUrl,
    append,
    getDerived,
    reset,
    autoContain,
    setAutoContain,
    notify,
    setNotify,
    toasts,
    closeToast,
    demoTick,
    runDemo,
  };
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useTripwire() {
  const v = useContext(StoreCtx);
  if (!v) throw new Error("useTripwire must be used inside StoreProvider");
  return v;
}
