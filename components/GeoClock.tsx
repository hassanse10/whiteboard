"use client";

import { useEffect, useState } from "react";
import { getUserTimezone, timezoneToLabel } from "../lib/geo";

export default function GeoClock() {
  const [now, setNow] = useState<Date | null>(null);
  const [timezone, setTimezone] = useState("UTC");

  useEffect(() => {
    setTimezone(getUserTimezone());
    setNow(new Date());
    const interval = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  if (!now) return null;

  const time = new Intl.DateTimeFormat(undefined, {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit"
  }).format(now);

  return (
    <div className="geo-clock" title={timezone}>
      <span className="geo-clock-time">{time}</span>
      <span className="geo-clock-label">{timezoneToLabel(timezone)}</span>
      <style jsx>{`
        .geo-clock {
          position: absolute;
          top: 16px;
          left: 16px;
          z-index: 10;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: #ffffff;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.12), 0 2px 4px rgba(15, 23, 42, 0.08);
          font-size: 0.85rem;
          color: #1e1e1e;
          white-space: nowrap;
        }

        .geo-clock-time {
          font-weight: 700;
          font-variant-numeric: tabular-nums;
        }

        .geo-clock-label {
          color: #8a8a96;
          font-size: 0.78rem;
        }

        @media (max-width: 640px) {
          .geo-clock {
            top: 8px;
            left: 8px;
            padding: 4px 10px;
          }

          .geo-clock-label {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
