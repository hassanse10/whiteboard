"use client";

import { useEffect, useRef, useState } from "react";
import { getSocket } from "../lib/socket";

interface TimerState {
  duration: number;
  remaining: number;
  startedAt: number;
  status: "idle" | "running" | "paused" | "finished";
  setBy: string;
}

const DEFAULT: TimerState = { duration: 300, remaining: 300, startedAt: 0, status: "idle", setBy: "" };

function getLive(t: TimerState): number {
  if (t.status === "running") return Math.max(0, t.remaining - (Date.now() - t.startedAt) / 1000);
  return t.status === "finished" ? 0 : t.remaining;
}

function fmt(secs: number): string {
  const s = Math.ceil(Math.max(0, secs));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export default function CountdownTimer({ userName }: { userName: string }) {
  const [timer, setTimer] = useState<TimerState>(DEFAULT);
  const [display, setDisplay] = useState(300);
  const [open, setOpen] = useState(false);
  const [inputMin, setInputMin] = useState("5");
  const [inputSec, setInputSec] = useState("00");
  const panelRef = useRef<HTMLDivElement>(null);
  const finishedRef = useRef(false);
  const timerRef = useRef<TimerState>(DEFAULT);

  useEffect(() => {
    const socket = getSocket();

    function onSync(state: TimerState) {
      timerRef.current = state;
      setTimer(state);
      finishedRef.current = state.status === "finished";
      setDisplay(getLive(state));
    }

    socket.on("timer-sync", onSync);
    return () => { socket.off("timer-sync", onSync); };
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      const t = timerRef.current;
      const live = getLive(t);
      setDisplay(live);
      if (t.status === "running" && live <= 0 && !finishedRef.current) {
        finishedRef.current = true;
        getSocket().emit("timer-finish");
      }
    }, 500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function handleSet() {
    const mins = Math.max(0, Math.min(99, parseInt(inputMin) || 0));
    const secs = Math.max(0, Math.min(59, parseInt(inputSec) || 0));
    const duration = mins * 60 + secs;
    if (duration <= 0) return;
    getSocket().emit("timer-set", { duration, name: userName });
    setOpen(false);
  }

  function handleStartPause() {
    const s = getSocket();
    if (timer.status === "running") {
      s.emit("timer-pause");
    } else if (timer.status === "finished") {
      s.emit("timer-reset");
    } else {
      s.emit("timer-start");
    }
  }

  const isUrgent = timer.status === "running" && display <= 60;
  const isFinished = timer.status === "finished";

  return (
    <div ref={panelRef} className="timer-widget">
      <button
        className={`timer-pill${timer.status === "running" ? " running" : ""}${isUrgent ? " urgent" : ""}${isFinished ? " finished" : ""}`}
        onClick={() => setOpen((o) => !o)}
        title={`Countdown timer${timer.setBy ? ` · set by ${timer.setBy}` : ""}`}
        type="button"
        aria-label="Countdown timer"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
        <span className="timer-display">
          {isFinished ? "Time's up!" : fmt(display)}
        </span>
      </button>

      {open && (
        <div className="timer-panel">
          <div className="timer-panel-head">Countdown Timer</div>

          <div className="timer-preview">{isFinished ? "Time's up!" : fmt(display)}</div>

          <div className="timer-inputs">
            <div className="timer-input-group">
              <input
                type="number"
                min={0}
                max={99}
                value={inputMin}
                onChange={(e) => setInputMin(e.target.value)}
                className="timer-input"
                aria-label="Minutes"
                placeholder="0"
              />
              <span className="timer-input-label">min</span>
            </div>
            <span className="timer-colon">:</span>
            <div className="timer-input-group">
              <input
                type="number"
                min={0}
                max={59}
                value={inputSec}
                onChange={(e) => setInputSec(e.target.value)}
                className="timer-input"
                aria-label="Seconds"
                placeholder="00"
              />
              <span className="timer-input-label">sec</span>
            </div>
          </div>

          <button className="timer-set-btn" type="button" onClick={handleSet}>
            Set timer
          </button>

          <div className="timer-controls">
            <button
              className={`timer-ctrl-btn${timer.status === "running" ? " pause" : " start"}`}
              type="button"
              onClick={handleStartPause}
            >
              {timer.status === "running" ? "Pause" : timer.status === "finished" ? "Restart" : "Start"}
            </button>
            <button
              className="timer-ctrl-btn reset"
              type="button"
              onClick={() => getSocket().emit("timer-reset")}
            >
              Reset
            </button>
          </div>

          {timer.setBy && (
            <div className="timer-set-by">set by {timer.setBy}</div>
          )}
        </div>
      )}

      <style jsx>{`
        .timer-widget {
          position: relative;
          flex-shrink: 0;
        }

        .timer-pill {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: #ffffff;
          border: none;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.12), 0 2px 4px rgba(15, 23, 42, 0.08);
          font-size: 0.85rem;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          color: #6b7280;
          cursor: pointer;
          white-space: nowrap;
          transition: background 0.15s, color 0.15s;
        }

        .timer-pill:hover {
          background: #f8f7ff;
        }

        .timer-pill.running {
          color: #2f9e44;
        }

        .timer-pill.urgent {
          color: #e03131;
          animation: pulse-urgent 1s ease-in-out infinite;
        }

        .timer-pill.finished {
          animation: flash-done 0.7s ease-in-out infinite;
        }

        @keyframes pulse-urgent {
          0%, 100% { box-shadow: 0 4px 12px rgba(224, 49, 49, 0.15); }
          50% { box-shadow: 0 4px 20px rgba(224, 49, 49, 0.45); }
        }

        @keyframes flash-done {
          0%, 100% { background: #fff0f0; color: #e03131; }
          50% { background: #e03131; color: #ffffff; }
        }

        .timer-panel {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          z-index: 20;
          width: 200px;
          padding: 14px;
          background: #ffffff;
          border-radius: 14px;
          box-shadow: 0 8px 28px rgba(15, 23, 42, 0.14), 0 2px 6px rgba(15, 23, 42, 0.08);
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .timer-panel-head {
          font-size: 0.72rem;
          font-weight: 700;
          color: #6965db;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .timer-preview {
          font-size: 1.7rem;
          font-weight: 800;
          font-variant-numeric: tabular-nums;
          color: #1e1e1e;
          text-align: center;
          padding: 2px 0;
        }

        .timer-inputs {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
        }

        .timer-input-group {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 3px;
        }

        .timer-input {
          width: 58px;
          height: 36px;
          text-align: center;
          font-size: 1rem;
          font-weight: 700;
          border: 1.5px solid #e5e7eb;
          border-radius: 8px;
          background: #f9fafb;
          color: #1e1e1e;
          outline: none;
          -moz-appearance: textfield;
          transition: border-color 0.15s;
        }

        .timer-input::-webkit-outer-spin-button,
        .timer-input::-webkit-inner-spin-button {
          -webkit-appearance: none;
        }

        .timer-input:focus {
          border-color: #6965db;
          background: #fff;
        }

        .timer-input-label {
          font-size: 0.7rem;
          color: #9ca3af;
          font-weight: 600;
        }

        .timer-colon {
          font-size: 1.3rem;
          font-weight: 700;
          color: #9ca3af;
          margin-bottom: 14px;
        }

        .timer-set-btn {
          width: 100%;
          padding: 8px;
          background: #6965db;
          color: #ffffff;
          font-size: 0.82rem;
          font-weight: 700;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.15s;
        }

        .timer-set-btn:hover {
          background: #5b57d1;
        }

        .timer-controls {
          display: flex;
          gap: 6px;
        }

        .timer-ctrl-btn {
          flex: 1;
          padding: 7px 0;
          font-size: 0.82rem;
          font-weight: 700;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.15s;
        }

        .timer-ctrl-btn.start {
          background: #e9fac8;
          color: #2f9e44;
        }

        .timer-ctrl-btn.start:hover { background: #c0eb75; }

        .timer-ctrl-btn.pause {
          background: #fff3bf;
          color: #e67700;
        }

        .timer-ctrl-btn.pause:hover { background: #ffec99; }

        .timer-ctrl-btn.reset {
          background: #f1f3f5;
          color: #495057;
        }

        .timer-ctrl-btn.reset:hover { background: #e9ecef; }

        .timer-set-by {
          font-size: 0.72rem;
          color: #9ca3af;
          text-align: center;
        }

        @media (max-width: 640px) {
          .timer-panel {
            right: auto;
            left: 0;
          }
        }
      `}</style>
    </div>
  );
}
