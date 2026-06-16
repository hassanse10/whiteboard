import type { Metadata } from "next";
import { SiteHeader } from "../../../components/landing/SiteHeader";
import { SiteFooter } from "../../../components/landing/SiteFooter";

export const metadata: Metadata = {
  title: "Privacy Policy — tablo",
  description:
    "Learn how tablo collects, uses, and protects your data. We keep it minimal — no accounts, no tracking beyond what's needed to run the service.",
  alternates: {
    canonical: "https://tablo.click/privacy"
  },
  openGraph: {
    title: "Privacy Policy — tablo",
    description:
      "Learn how tablo collects, uses, and protects your data. We keep it minimal — no accounts, no tracking beyond what's needed to run the service.",
    url: "https://tablo.click/privacy",
    siteName: "tablo",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "Privacy Policy — tablo",
    description:
      "Learn how tablo collects, uses, and protects your data. We keep it minimal — no accounts, no tracking beyond what's needed to run the service."
  }
};

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="legal">
          <div className="wrap">
            <h1>Privacy Policy</h1>
            <p className="legal-updated">Last updated: June 13, 2026</p>

            <p>
              Tablo is designed to be used without an account, and we collect as little information as possible.
              This page explains what data we store and why.
            </p>

            <h2>What we store</h2>
            <ul>
              <li>
                <strong>Board content.</strong> Drawings, shapes, text, and sticky notes you add to a board are
                stored so the board can sync between participants and persist between visits.
              </li>
              <li>
                <strong>Display name and color.</strong> A randomly generated name and color are assigned to your
                browser session so collaborators can see who&apos;s on the board. This is stored locally in your
                browser and is not tied to any personal account.
              </li>
              <li>
                <strong>Basic connection data.</strong> Like most web services, our servers process standard
                technical information (such as IP address) as part of handling real-time connections. This is not
                used for tracking or advertising.
              </li>
            </ul>

            <h2>Board links</h2>
            <p>
              Each board is identified by a random, unguessable link. Anyone with the link can view and edit the
              board. Treat board links like you would a shared document — don&apos;t share links to boards
              containing sensitive information with people you don&apos;t trust.
            </p>

            <h2>Auto-deletion</h2>
            <p>
              Boards with no activity for 7 days are automatically and permanently deleted, along with their
              contents.
            </p>

            <h2>Cookies &amp; local storage</h2>
            <p>
              Tablo uses your browser&apos;s local storage to remember your board identity (name and color) and
              your most recent board. We do not use third-party tracking or advertising cookies.
            </p>

            <h2>Third parties</h2>
            <p>
              We do not sell or share your data with third parties. Tablo may use infrastructure providers
              (such as hosting and database providers) solely to operate the service.
            </p>

            <h2>Changes to this policy</h2>
            <p>
              We may update this policy from time to time. Continued use of Tablo after changes are posted means
              you accept the updated policy.
            </p>

            <h2>Contact</h2>
            <p>
              Questions about this policy? Reach out via our <a href="/contact">Contact page</a>.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
