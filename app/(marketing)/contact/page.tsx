import type { Metadata } from "next";
import { SiteHeader } from "../../../components/landing/SiteHeader";
import { SiteFooter } from "../../../components/landing/SiteFooter";

export const metadata: Metadata = {
  title: "Contact us — Tablo",
  description: "Get in touch with the Tablo team."
};

export default function ContactPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="legal">
          <div className="wrap">
            <h1>Contact us</h1>
            <p className="legal-updated">We&apos;d love to hear from you.</p>

            <div className="contact-card">
              <h3>Email</h3>
              <p>
                For questions, feedback, or support, email us at{" "}
                <a href="mailto:hello@tablo.click">hello@tablo.click</a> and we&apos;ll get back to you as soon as we can.
              </p>
            </div>

            <div className="contact-card">
              <h3>Bug reports &amp; feature requests</h3>
              <p>Found something broken or have an idea to make Tablo better? Let us know — every message helps us improve.</p>
            </div>

            <div className="contact-card">
              <h3>Privacy &amp; data requests</h3>
              <p>
                For questions about our <a href="/privacy">Privacy Policy</a> or to request removal of a board, contact us at the email above.
              </p>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
