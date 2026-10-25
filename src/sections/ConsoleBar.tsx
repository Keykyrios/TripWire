import { useState } from "react";
import SquishSwitch from "../vendor/SquishSwitch/SquishSwitch";
import BellToggle from "../vendor/BellToggle/BellToggle";
import { useTripwire } from "../lib/store";

const STATUS_LABEL = {
  connecting: "Connecting",
  live: "Live",
  offline: "Offline",
  denied: "Blocked by rules",
} as const;

export default function ConsoleBar() {
  const { room, status, autoContain, setAutoContain, notify, setNotify, d, shareUrl, runDemo } = useTripwire();
  const [copied, setCopied] = useState(false);
  const open = d.alerts.filter((a) => !d.triage.has(a.id)).length;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      window.prompt("Copy this link", shareUrl);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const onBell = async (on: boolean) => {
    setNotify(on);
    if (on && "Notification" in window && Notification.permission === "default") {
      try {
        await Notification.requestPermission();
      } catch {
        /* optional */
      }
    }
  };

  const demo = () => {
    document.getElementById("attacker")?.scrollIntoView({ behavior: "smooth" });
    window.setTimeout(runDemo, 650);
  };

  return (
    <div className="cbar">
      <div className="cbar__id">
        <span className="meta">Room</span>
        <strong className="mono cbar__room">{room}</strong>
        <span className={`cbar__sync cbar__sync--${status} mono`}>
          <i aria-hidden="true" /> {STATUS_LABEL[status]}
        </span>
      </div>
      <div className="cbar__ctrl">
        <SquishSwitch
          checked={autoContain}
          onChange={setAutoContain}
          label="Auto-contain critical alerts"
          trackColor="#2a2a28"
          trackOnColor="#e8452c"
          thumbColor="#f2f0ea"
          thumbOnColor="#0a0a0a"
          width={56}
          height={28}
          radius={3}
        />
        <BellToggle
          pressed={notify}
          onChange={onBell}
          offLabel="Alerts muted"
          onLabel="Alerts on"
          count={open}
          size="sm"
          radius={3}
          background="#1b1b1a"
          color="#f2f0ea"
          onBackground="#f2f0ea"
          onColor="#0a0a0a"
          badgeColor="#e8452c"
          badgeTextColor="#0a0a0a"
        />
        <button className="btn btn--sm" onClick={copy} aria-label="Copy room share link">
          {copied ? "Link copied" : "Share room"}
        </button>
        <button className="btn btn--sm btn--primary" onClick={demo} aria-label="Run the scripted demo intrusion">
          Run demo intrusion
        </button>
      </div>
    </div>
  );
}
