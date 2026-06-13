import "./landing.css";
import { Kalam, Plus_Jakarta_Sans } from "next/font/google";
import type { Metadata } from "next";

const kalam = Kalam({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-hand"
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans"
});

export const metadata: Metadata = {
  title: "Scribl — Draw together, instantly.",
  description: "A real-time collaborative whiteboard. No sign-up, no setup — just open a board and start sketching with anyone, anywhere."
};

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`scribl-landing ${kalam.variable} ${plusJakarta.variable}`}>
      {children}
    </div>
  );
}
