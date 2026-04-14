import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { ParticleBackground } from "@/components/ParticleBackground";
import { Sidebar } from "@/components/Sidebar";
import { dashboard } from "@/lib/dashboardBranding";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: `${dashboard.appName} — ${dashboard.heroTitle}`,
  description: dashboard.tagline,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body className="relative min-h-screen bg-slate-100/80 font-sans antialiased">
        <ParticleBackground />
        <div className="relative z-10 flex min-h-screen">
          <Sidebar />
          <main className="flex-1 overflow-auto bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(34,211,238,0.12),transparent)] bg-gradient-to-br from-slate-50 via-white to-cyan-50/40 pt-14 md:pt-0">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
