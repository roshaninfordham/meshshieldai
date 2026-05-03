import "./globals.css";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "MeshShield AI", description: "Counter-swarm operator console" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body className="antialiased">{children}</body></html>;
}
