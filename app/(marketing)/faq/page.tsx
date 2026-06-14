import type { Metadata } from "next";
import { SiteHeader } from "../../../components/landing/SiteHeader";
import { SiteFooter } from "../../../components/landing/SiteFooter";

export const metadata: Metadata = {
  title: "FAQ — Tablo",
  description: "Frequently asked questions about Tablo, the free real-time collaborative whiteboard."
};

const faqs = [
  {
    q: "Do I need to create an account?",
    a: "No. Tablo works with zero sign-up — click \"Start whiteboarding\" and you'll have a private board in seconds. Just share the link with anyone you want to collaborate with."
  },
  {
    q: "How many people can join a board?",
    a: "As many as you like. Everyone who opens the board link sees live cursors, avatars, and edits from everyone else in real time."
  },
  {
    q: "Is my board private?",
    a: "Each board has its own unguessable link. Anyone with the link can view and edit the board, so only share it with people you trust. Don't post board links publicly if they contain sensitive content."
  },
  {
    q: "Does Tablo save my work?",
    a: "Yes — your board auto-saves as you draw. If a board has no activity for 7 days, it's automatically deleted to keep things tidy, so be sure to revisit boards you want to keep."
  },
  {
    q: "Can I use Tablo on mobile?",
    a: "Tablo works in any modern browser, including on tablets and phones, though it's most comfortable on a larger screen with a mouse, trackpad, or stylus."
  },
  {
    q: "Is Tablo free?",
    a: "Yes, Tablo is free to use."
  },
  {
    q: "What can I draw with?",
    a: "The toolbar includes a selection tool, pen, shapes (rectangle, ellipse), text, sticky notes, and an eraser — everything you need to sketch ideas, diagrams, and notes together."
  },
  {
    q: "I have a question that isn't answered here.",
    a: "Reach out via the Contact page and we'll get back to you."
  }
];

export default function FaqPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="legal">
          <div className="wrap">
            <h1>Frequently asked questions</h1>
            <p className="legal-updated">Everything you need to know about using Tablo.</p>

            <div className="faq-list">
              {faqs.map((item) => (
                <div className="faq-item" key={item.q}>
                  <h3>{item.q}</h3>
                  <p>{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
