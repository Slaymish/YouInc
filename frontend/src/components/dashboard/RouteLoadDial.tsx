import { useEffect, useState } from "react";

interface RouteLoadDialProps {
  label: string;
  tone?: "default" | "dark";
}

const FILL_DURATION_MS = 900;
const EXIT_DURATION_MS = 180;

export function RouteLoadDial({
  label,
  tone = "default",
}: RouteLoadDialProps) {
  const [progress, setProgress] = useState(0);
  const [exiting, setExiting] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    let frame = 0;
    let exitTimer = 0;

    const finish = () => {
      setProgress(100);
      setExiting(true);
      exitTimer = window.setTimeout(() => setVisible(false), EXIT_DURATION_MS);
    };

    if (reducedMotion) {
      finish();
    } else {
      const startedAt = performance.now();
      const fill = (now: number) => {
        const next = Math.min(
          100,
          Math.round(((now - startedAt) / FILL_DURATION_MS) * 100),
        );
        setProgress(next);
        if (next < 100) {
          frame = window.requestAnimationFrame(fill);
        } else {
          finish();
        }
      };
      frame = window.requestAnimationFrame(fill);
    }

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(exitTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`route-load route-load--${tone}${exiting ? " route-load--exiting" : ""}`}
    >
      <div className="route-load__content">
        <div
          className="route-load__dial"
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <circle className="route-load__track" cx="50" cy="50" r="44" />
            <circle
              className="route-load__fill"
              cx="50"
              cy="50"
              r="44"
              pathLength="100"
              style={{ strokeDashoffset: 100 - progress }}
            />
          </svg>
          <span>{progress}</span>
        </div>
        <p>{label}</p>
      </div>
    </div>
  );
}
