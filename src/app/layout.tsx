import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Odin — OSINT News Verification",
  description: "Trace provenance, corroboration and conflicts behind any news claim.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <div className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">{children}</div>
      </body>
    </html>
  );
}
