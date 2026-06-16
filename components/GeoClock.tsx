"use client";

import { useEffect, useState } from "react";
import { fetchUserLocation, getUserTimezone, timezoneToLabel } from "../lib/geo";

export default function GeoClock() {
  const [now, setNow] = useState<Date | null>(null);
  const [timezone, setTimezone] = useState("UTC");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");

  useEffect(() => {
    const tz = getUserTimezone();
    setTimezone(tz);
    setCity(timezoneToLabel(tz));
    setNow(new Date());

    fetchUserLocation().then((loc) => {
      if (loc) {
        if (loc.city) setCity(loc.city);
        if (loc.country) setCountry(loc.country);
        if (loc.timezone) setTimezone(loc.timezone);
      }
    });

    const interval = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  if (!now) return null;

  const time = new Intl.DateTimeFormat(undefined, {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit"
  }).format(now);

  const label = country ? `${city}, ${country}` : city;

  return (
    <div className="geo-clock" title={timezone}>
      <span className="geo-clock-time">{time}</span>
      {label && <span className="geo-clock-label">{label}</span>}
      <style jsx>{`
        .geo-clock {
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
          flex-shrink: 0;
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
