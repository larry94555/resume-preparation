import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Resume Preparation",
  description: "Local-first resume, LinkedIn, and cover-letter coach.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
