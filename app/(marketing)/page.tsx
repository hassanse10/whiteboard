"use client";

import { useEffect, useState } from "react";
import { generateBoardId } from "../../lib/boardId";
import { SiteHeader } from "../../components/landing/SiteHeader";
import { SiteFooter } from "../../components/landing/SiteFooter";

function ToolIcon({ name }: { name: string }) {
  const paths: Record<string, JSX.Element> = {
    select: <path d="M5 3l5 12 2-5 5-2z" />,
    pen: <path d="M3 17l1-4 9-9 3 3-9 9-4 1z" />,
    rect: <rect x="4" y="6" width="12" height="8" rx="1" />,
    ellipse: <ellipse cx="10" cy="10" rx="6" ry="4" />,
    text: <path d="M5 4h10M10 4v12" />,
    note: <path d="M4 4h12v12H4z M4 13h6v3" />,
    eraser: <path d="M4 13l6-6 6 6-3 3H7z" />
  };
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}

function CursorIcon({ color }: { color: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill={color}>
      <path d="M3 2l6 16 2.2-6.6L18 9.2z" />
    </svg>
  );
}

function FeatureIcon({ name }: { name: string }) {
  const icons: Record<string, JSX.Element> = {
    sync: <path d="M4 10a6 6 0 0 1 10-4.5M16 10a6 6 0 0 1-10 4.5M14 3v3h-3M6 17v-3h3" />,
    presence: <path d="M7 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM13 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM2 17c0-2.8 2.2-5 5-5s5 2.2 5 5M9 17c0-2.5 1.9-4.5 4.5-4.5S18 14.5 18 17" />,
    nosignup: <path d="M10 2l7 3v5c0 4.5-3 7.5-7 8-4-0.5-7-3.5-7-8V5z M7 10l2 2 4-4" />,
    autosave: <path d="M4 4h9l3 3v9H4z M7 4v4h6V4M6 13h8" />
  };
  return (
    <svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {icons[name]}
    </svg>
  );
}

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [boardLink, setBoardLink] = useState("");
  const [boardId, setBoardId] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModalOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [modalOpen]);

  function openStartModal() {
    const id = generateBoardId();
    setBoardId(id);
    setBoardLink(`${window.location.origin}/board?board=${id}`);
    setCopied(false);
    setModalOpen(true);
  }

  function goToBoard() {
    setModalOpen(false);
    window.location.href = `/board?board=${boardId}`;
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(boardLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  }

  return (
    <>
      <SiteHeader scrolled={scrolled} home onStart={openStartModal} />

      <main id="top">
        {/* ---------- hero ---------- */}
        <section className="hero">
          <div className="wrap hero-grid">
            <div>
              <span className="eyebrow">✏️ Free &amp; no sign-up</span>
              <h1 className="hero-title">
                Draw{" "}
                <span className="squiggle-wrap accent">
                  together,
                  <svg viewBox="0 0 200 18" preserveAspectRatio="none">
                    <path d="M2 12 Q 30 2, 60 12 T 120 12 T 198 6" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round" />
                  </svg>
                </span>{" "}
                instantly.
              </h1>
              <p className="hero-sub">
                Open a shared canvas in one click, invite anyone with a link, and sketch ideas together in real time — no accounts, no installs, no friction.
              </p>
              <div className="hero-actions">
                <button className="btn btn-primary btn-lg" onClick={openStartModal}>
                  Start whiteboarding
                </button>
                <a href="#how" className="hero-watch">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="10" cy="10" r="8" />
                    <path d="M8.5 7.5l4 2.5-4 2.5z" fill="currentColor" />
                  </svg>
                  Watch it sync
                </a>
              </div>
              <p className="hero-note">No email. No download. Just a board and a link.</p>
            </div>

            <div className="canvas-frame">
              <div className="canvas-top">
                <div className="traffic">
                  <span />
                  <span />
                  <span />
                </div>
                <div className="canvas-url">scribl.app/b/sunny-otter-42</div>
                <div className="presence">
                  <div className="avatars">
                    <div className="avatar" style={{ background: "#6965db" }}>M</div>
                    <div className="avatar" style={{ background: "#f08c00" }}>L</div>
                    <div className="avatar" style={{ background: "#0c8599" }}>P</div>
                  </div>
                  <span className="live-pill">
                    <span className="dot" /> 3 live
                  </span>
                </div>
              </div>
              <div className="canvas-body">
                <div className="toolbar">
                  <div className="tool active">
                    <ToolIcon name="select" />
                  </div>
                  <div className="tool">
                    <ToolIcon name="pen" />
                  </div>
                  <div className="tool">
                    <ToolIcon name="rect" />
                  </div>
                  <div className="tool">
                    <ToolIcon name="ellipse" />
                  </div>
                  <div className="tool">
                    <ToolIcon name="text" />
                  </div>
                  <div className="tool">
                    <ToolIcon name="note" />
                  </div>
                  <div className="tool">
                    <ToolIcon name="eraser" />
                  </div>
                </div>

                <div className="sk sk-rect" style={{ top: "14%", left: "32%", width: 170, height: 90 }}>
                  Sprint Goals
                </div>
                <div className="sk sk-pill" style={{ top: "10%", left: "8%", width: 110, height: 40 }}>
                  research
                </div>
                <div className="sk sk-note" style={{ top: "52%", left: "10%", width: 150, height: 110 }}>
                  ship the beta by friday!
                </div>
                <div className="sk sk-rect alt" style={{ top: "60%", left: "60%", width: 150, height: 80 }}>
                  Launch 🚀
                </div>

                <div className="cursor c1">
                  <CursorIcon color="#6965db" />
                  <span className="cursor-label" style={{ background: "#6965db" }}>Maya</span>
                </div>
                <div className="cursor c2">
                  <CursorIcon color="#f08c00" />
                  <span className="cursor-label" style={{ background: "#f08c00" }}>Leo</span>
                </div>
                <div className="cursor c3">
                  <CursorIcon color="#0c8599" />
                  <span className="cursor-label" style={{ background: "#0c8599" }}>Priya</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- trust strip ---------- */}
        <div className="trust-strip wrap">Loved by teams that think out loud</div>

        {/* ---------- features ---------- */}
        <section id="features" className="section-pad">
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-tag">Why Scribl</span>
              <h2 className="sec-title">Everything you need, nothing you don&apos;t</h2>
              <p className="sec-desc">A whiteboard that gets out of your way — fast to open, easy to share, and ready whenever inspiration strikes.</p>
            </div>
            <div className="features">
              <div className="fcard">
                <div className="ficon" style={{ background: "var(--violet-soft)", color: "var(--violet)" }}>
                  <FeatureIcon name="sync" />
                </div>
                <h3>Real-time sync</h3>
                <p>Every stroke, shape, and sticky note updates instantly for everyone on the board — no refresh required.</p>
              </div>
              <div className="fcard">
                <div className="ficon" style={{ background: "var(--green-soft)", color: "var(--green)" }}>
                  <FeatureIcon name="presence" />
                </div>
                <h3>Live presence</h3>
                <p>See who&apos;s here with colored cursors and avatars, so you always know who you&apos;re sketching with.</p>
              </div>
              <div className="fcard">
                <div className="ficon" style={{ background: "#fff3bf", color: "var(--amber)" }}>
                  <FeatureIcon name="nosignup" />
                </div>
                <h3>No sign-up</h3>
                <p>Click start, share the link, and you&apos;re drawing. No accounts, passwords, or onboarding screens.</p>
              </div>
              <div className="fcard">
                <div className="ficon" style={{ background: "#e7f0ff", color: "var(--teal)" }}>
                  <FeatureIcon name="autosave" />
                </div>
                <h3>Auto-save</h3>
                <p>Your board saves itself as you go. Quiet boards clear after 7 days, so nothing piles up.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- how it works ---------- */}
        <section id="how" className="section-pad band">
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-tag">How it works</span>
              <h2 className="sec-title">From idea to canvas in seconds</h2>
              <p className="sec-desc">No setup, no waiting — just three quick steps and you&apos;re collaborating.</p>
            </div>
            <div className="steps">
              <div className="step">
                <div className="step-num">1</div>
                <h3>Start a board</h3>
                <p>Click &ldquo;Start whiteboarding&rdquo; to spin up a fresh, private canvas instantly.</p>
              </div>
              <svg className="step-arrow" width="40" height="20" viewBox="0 0 40 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 10h34M28 4l8 6-8 6" />
              </svg>
              <div className="step">
                <div className="step-num">2</div>
                <h3>Share the link</h3>
                <p>Copy your board&apos;s URL and send it to anyone — they join instantly, no account needed.</p>
              </div>
              <svg className="step-arrow" width="40" height="20" viewBox="0 0 40 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 10h34M28 4l8 6-8 6" />
              </svg>
              <div className="step">
                <div className="step-num">3</div>
                <h3>Sketch together</h3>
                <p>Draw, write, and move shapes in real time. Everyone sees changes the moment they happen.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- showcase ---------- */}
        <section id="showcase" className="section-pad">
          <div className="wrap showcase-grid">
            <div className="showcase-list">
              <span className="sec-tag">Showcase</span>
              <h2 className="sec-title" style={{ marginBottom: 8 }}>
                Built for fast-moving teams
              </h2>
              <div className="show-item" style={{ marginTop: 16 }}>
                <div className="show-icon">
                  <FeatureIcon name="sync" />
                </div>
                <div>
                  <h3>Plan sprints visually</h3>
                  <p>Map out user flows, backlog items, and milestones on one shared canvas.</p>
                </div>
              </div>
              <div className="show-item">
                <div className="show-icon">
                  <FeatureIcon name="presence" />
                </div>
                <div>
                  <h3>Run better workshops</h3>
                  <p>Brainstorm live with remote teammates — everyone draws and writes at once.</p>
                </div>
              </div>
              <div className="show-item">
                <div className="show-icon">
                  <FeatureIcon name="autosave" />
                </div>
                <div>
                  <h3>Capture ideas instantly</h3>
                  <p>Jot down a thought mid-call and it&apos;s saved automatically — pick it back up anytime.</p>
                </div>
              </div>
            </div>

            <div className="showcase-visual">
              <div className="sv-top">
                <span />
                <span />
                <span />
              </div>
              <div className="sv-body">
                <div className="sk sk-rect" style={{ top: "12%", left: "10%", width: 180, height: 90 }}>
                  User flow
                </div>
                <div className="sk sk-pill" style={{ top: "14%", left: "60%", width: 130, height: 42 }}>
                  onboarding
                </div>
                <div className="sk sk-note" style={{ top: "48%", left: "12%", width: 160, height: 110 }}>
                  don&apos;t forget the empty state ✏️
                </div>
                <div className="sk sk-rect alt" style={{ top: "55%", left: "58%", width: 150, height: 80 }}>
                  done ✅
                </div>
                <div className="cursor" style={{ top: "30%", left: "65%", animation: "roam2 12s ease-in-out infinite" }}>
                  <CursorIcon color="#e64980" />
                  <span className="cursor-label" style={{ background: "#e64980" }}>Riley</span>
                </div>
                <div className="cursor" style={{ top: "65%", left: "35%", animation: "roam3 10s ease-in-out infinite" }}>
                  <CursorIcon color="#6965db" />
                  <span className="cursor-label" style={{ background: "#6965db" }}>Sam</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- cta band ---------- */}
        <section className="cta-band">
          <div className="wrap">
            <div className="cta-card">
              <svg className="cta-deco" style={{ top: -20, left: -20 }} width="160" height="160" viewBox="0 0 160 160" fill="none" stroke="#fff" strokeWidth="2">
                <circle cx="80" cy="80" r="60" />
              </svg>
              <svg className="cta-deco" style={{ bottom: -30, right: -30 }} width="200" height="200" viewBox="0 0 200 200" fill="none" stroke="#fff" strokeWidth="2">
                <rect x="20" y="20" width="160" height="160" rx="24" />
              </svg>
              <h2>Ready to start sketching?</h2>
              <p>Open a board, share the link, and get drawing — together, instantly.</p>
              <button className="btn btn-primary btn-lg" onClick={openStartModal}>
                Start whiteboarding — it&apos;s free
              </button>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter onNewBoard={openStartModal} />

      {/* ---------- modal ---------- */}
      <div className={`modal-overlay ${modalOpen ? "open" : ""}`} onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}>
        <div className="modal">
          <div className="modal-spark">
            <svg width="24" height="24" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 2v4M10 14v4M2 10h4M14 10h4M4.5 4.5l2.5 2.5M13 13l2.5 2.5M15.5 4.5L13 7M7 13l-2.5 2.5" />
            </svg>
          </div>
          <h3>Your board is ready!</h3>
          <p>Share this link with anyone to start sketching together.</p>
          <div className="link-row">
            <input value={boardLink} readOnly onFocus={(e) => e.target.select()} />
            <button className={`copy-btn ${copied ? "done" : ""}`} onClick={copyLink}>
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <div className="modal-foot">
            <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>
              Maybe later
            </button>
            <button className="btn btn-primary" onClick={goToBoard}>
              Open canvas →
            </button>
          </div>
          <div className="modal-presence">
            <div className="avatar" style={{ background: "#6965db", marginLeft: 0 }}>Y</div>
            You&apos;ll be the first one here
          </div>
        </div>
      </div>
    </>
  );
}
