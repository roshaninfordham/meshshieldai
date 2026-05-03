import "./globals.css";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "MeshShield AI", description: "Counter-swarm operator console" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  // suppressHydrationWarning silences benign attribute mismatches injected by
  // browser extensions (Grammarly, Dark Reader, LastPass, etc.) on <html>/<body>
  // after the SSR'd HTML reaches the client. It does NOT suppress mismatches in
  // our own components — only top-level extension noise.
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased overflow-x-hidden" style={{ background: "#0b0f17" }} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
