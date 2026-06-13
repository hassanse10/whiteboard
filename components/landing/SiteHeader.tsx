"use client";

import { LogoMark } from "./LogoMark";

export function SiteHeader({
  scrolled,
  home = false,
  onStart
}: {
  scrolled?: boolean;
  home?: boolean;
  onStart?: () => void;
}) {
  const anchor = (hash: string) => (home ? hash : `/${hash}`);

  return (
    <header id="header" className={scrolled ? "scrolled" : ""}>
      <div className="wrap nav">
        <a href={home ? "#top" : "/"} className="brand">
          <LogoMark />
          Scribl
        </a>
        <nav className="nav-links">
          <a href={anchor("#features")}>Features</a>
          <a href={anchor("#how")}>How it works</a>
          <a href={anchor("#showcase")}>Showcase</a>
          <a href="#" onClick={(e) => e.preventDefault()}>
            GitHub
          </a>
        </nav>
        <div className="nav-cta">
          <a href={anchor("#how")} className="nav-see-how">
            See how
          </a>
          {onStart ? (
            <button className="btn btn-primary" onClick={onStart}>
              Start whiteboarding
            </button>
          ) : (
            <a href="/board" className="btn btn-primary">
              Start whiteboarding
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
