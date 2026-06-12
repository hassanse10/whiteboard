import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Whiteboard",
  description: "Simple responsive whiteboard with drawing and image placement"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
