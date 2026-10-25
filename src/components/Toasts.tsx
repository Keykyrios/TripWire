import { useTripwire } from "../lib/store";

export default function Toasts() {
  const { toasts, closeToast } = useTripwire();
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <button key={t.id} className={`toast toast--${t.severity}`} onClick={() => closeToast(t.id)} aria-label={`Dismiss alert: ${t.title}`}>
          <span className={`sev sev--${t.severity}`}>{t.severity}</span>
          <strong>{t.title}</strong>
          <span className="toast__detail">{t.detail}</span>
        </button>
      ))}
    </div>
  );
}
