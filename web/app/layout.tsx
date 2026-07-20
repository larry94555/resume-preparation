import type { ReactNode } from "react";
import Link from "next/link";
import "./globals.css";

export const metadata = {
  title: "Resume Preparation",
  description: "Local-first resume, LinkedIn, and cover-letter coach.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav className="nav">
          <strong>Resume Prep</strong>
          <Link href="/">Tailor</Link>
          <Link href="/coach">Coach</Link>
          <Link href="/linkedin">LinkedIn</Link>
          <Link href="/audit">Audit</Link>
        </nav>
        {children}
      </body>
    </html>
  );
}
