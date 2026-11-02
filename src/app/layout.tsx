import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import "./globals.css";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL("https://status.instalify.app"),
  title: "Instalify Status",
  description:
    "Live status of Instalify — website, API, database and Redis — and of Cloudflare, Railway, Supabase and Vercel, the platforms it runs on.",
  openGraph: {
    title: "Instalify Status",
    description: "Is Instalify working? Live status of Instalify and every platform it runs on.",
    url: "https://status.instalify.app",
    siteName: "Instalify Status",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b1324",
  width: "device-width",
  initialScale: 1,
};

// Applies a saved light/dark choice before the first paint. The choice is a
// cookie (see ThemeToggle); this site keeps nothing in localStorage.
const themeScript = `(function(){try{var m=document.cookie.match(/(?:^|; )theme=(light|dark)(?:;|$)/);if(m)document.documentElement.dataset.theme=m[1];}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={sans.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="font-sans">{children}</body>
    </html>
  );
}
