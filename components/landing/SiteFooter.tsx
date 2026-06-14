"use client";

import { LogoMark } from "./LogoMark";

export function SiteFooter({ onNewBoard }: { onNewBoard?: () => void }) {
  return (
    <footer>
      <div className="wrap foot-grid">
        <div>
          <a href="/" className="foot-brand">
            <LogoMark />
            tablo
          </a>
          <p>Draw together, instantly. A free real-time whiteboard for teams that think out loud.</p>
        </div>
        <div className="foot-col">
          <h4>Product</h4>
          <ul>
            <li>
              {onNewBoard ? (
                <a href="#" onClick={(e) => { e.preventDefault(); onNewBoard(); }}>
                  New board
                </a>
              ) : (
                <a href="/board">New board</a>
              )}
            </li>
            <li>
              <a href="/#features">Features</a>
            </li>
            <li>
              <a href="/#how">How it works</a>
            </li>
            <li>
              <a href="/faq">FAQ</a>
            </li>
          </ul>
        </div>
        <div className="foot-col">
          <h4>Project</h4>
          <ul>
            <li>
              <a href="#" onClick={(e) => e.preventDefault()}>GitHub</a>
            </li>
            <li>
              <a href="#" onClick={(e) => e.preventDefault()}>Changelog</a>
            </li>
            <li>
              <a href="#" onClick={(e) => e.preventDefault()}>Status</a>
            </li>
          </ul>
        </div>
        <div className="foot-col">
          <h4>Connect &amp; Legal</h4>
          <ul>
            <li>
              <a href="/contact">Contact us</a>
            </li>
            <li>
              <a href="#" onClick={(e) => e.preventDefault()}>Twitter</a>
            </li>
            <li>
              <a href="/privacy">Privacy Policy</a>
            </li>
            <li>
              <a href="/terms">Terms of Service</a>
            </li>
          </ul>
        </div>
      </div>
      <div className="wrap foot-bottom">
        <span>© {new Date().getFullYear()} tablo</span>
        <span>made with a steady-ish hand ✏️</span>
      </div>
    </footer>
  );
}
