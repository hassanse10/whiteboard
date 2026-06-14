import type { Metadata } from "next";
import { SiteHeader } from "../../../components/landing/SiteHeader";
import { SiteFooter } from "../../../components/landing/SiteFooter";

export const metadata: Metadata = {
  title: "Terms of Service — Tablo",
  description: "The terms that govern your use of Tablo."
};

export default function TermsPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="legal">
          <div className="wrap">
            <h1>Terms of Service</h1>
            <p className="legal-updated">Last updated: June 13, 2026</p>

            <p>
              These terms govern your use of Tablo, a free real-time collaborative whiteboard. By using Tablo,
              you agree to these terms.
            </p>

            <h2>Using Tablo</h2>
            <ul>
              <li>Tablo is provided free of charge, with no account required.</li>
              <li>You&apos;re responsible for the content you create and share on boards.</li>
              <li>Boards are accessible to anyone with the board link — share links responsibly.</li>
            </ul>

            <h2>Acceptable use</h2>
            <p>You agree not to use Tablo to:</p>
            <ul>
              <li>Upload, draw, or share unlawful, harmful, abusive, or infringing content.</li>
              <li>Attempt to disrupt, overload, or gain unauthorized access to the service.</li>
              <li>Use Tablo to store or transmit malware or other malicious code.</li>
            </ul>
            <p>We reserve the right to remove content or boards that violate these terms.</p>

            <h2>Board retention</h2>
            <p>
              Boards are automatically deleted after 7 days of inactivity. Tablo is not intended for long-term
              storage — please export or back up anything important.
            </p>

            <h2>No warranty</h2>
            <p>
              Tablo is provided &ldquo;as is&rdquo; without warranties of any kind. We do our best to keep the
              service available and reliable, but we don&apos;t guarantee uninterrupted access or that data will
              never be lost.
            </p>

            <h2>Limitation of liability</h2>
            <p>
              To the fullest extent permitted by law, Tablo and its operators are not liable for any indirect,
              incidental, or consequential damages arising from your use of the service.
            </p>

            <h2>Changes to these terms</h2>
            <p>
              We may update these terms from time to time. Continued use of Tablo after changes are posted means
              you accept the updated terms.
            </p>

            <h2>Contact</h2>
            <p>
              Questions about these terms? Reach out via our <a href="/contact">Contact page</a>.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
