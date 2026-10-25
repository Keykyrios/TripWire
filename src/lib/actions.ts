import { useCallback } from "react";
import { buildDeploy, ctl } from "./engine";
import { useTripwire } from "./store";
import type { DEvent } from "./types";

export function useActions() {
  const { append, getDerived } = useTripwire();

  const contain = useCallback(
    (host: string) => {
      if (getDerived().contained.has(host)) return;
      append([ctl("contain", host, `${host} isolated`, `SOC isolated ${host}. Sessions through it were terminated.`)]);
    },
    [append, getDerived],
  );

  const release = useCallback(
    (host: string) => append([ctl("release", host, `${host} released`, `Network isolation lifted for ${host}.`)]),
    [append],
  );

  const triage = useCallback(
    (op: "ack" | "escalate" | "dismiss", alert: DEvent) => {
      const verb = { ack: "acknowledged", escalate: "escalated", dismiss: "dismissed" }[op];
      append([ctl(op, alert.id, `Alert ${verb}`, `${alert.title} was ${verb} by the analyst.`)]);
    },
    [append],
  );

  const arm = useCallback(
    (fileId: string, on: boolean) =>
      append([ctl(on ? "arm" : "disarm", fileId, on ? "Decoy armed" : "Decoy disarmed", `${fileId} is now ${on ? "watched" : "silent"}.`)]),
    [append],
  );

  const retire = useCallback(
    (fileId: string, path: string) => append([ctl("retire", fileId, "Decoy retired", `${path} was removed from the network.`)]),
    [append],
  );

  const deploy = useCallback(
    (template: string, host: string): string | null => {
      const res = buildDeploy(template, host, getDerived());
      if ("error" in res) return res.error;
      append([res]);
      return null;
    },
    [append, getDerived],
  );

  return { contain, release, triage, arm, retire, deploy };
}
