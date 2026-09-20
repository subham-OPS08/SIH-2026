import type { Metadata } from "next";
import { Cormorant_Garamond, DM_Sans, Caveat } from "next/font/google";
import "@/src/css/main.css";
import "mapbox-gl/dist/mapbox-gl.css";
import { siteConfig } from "@/src/config/site";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-family-serif",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-family-sans",
  display: "swap",
});

const caveat = Caveat({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-family-handwriting",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} — ${siteConfig.tagline}`,
    template: `%s | ${siteConfig.name}`
  },
  description: siteConfig.description,
  keywords: ["Dishaara", "SIH 2026", "Ladakh tourism", "Andaman tourism", "Lakshadweep ePermit", "Delhi heritage", "Chandigarh tourism", "J&K tourism", "Puducherry", "Tourist Helpline 1363", "National Emergency 112"],
  authors: [{ name: "Dishaara SIH 2026 Team" }],
  openGraph: {
    title: siteConfig.name,
    description: siteConfig.description,
    url: siteConfig.url,
    siteName: siteConfig.name,
    images: [{ url: siteConfig.ogImage, width: 1200, height: 630 }],
    type: "website",
  },
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "any" },
      { url: "/favicon.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/favicon.png",
  },
};

import { Suspense } from "react";
import { Navbar } from "@/src/app/components/Navbar";
import { FloatingYatraAI } from "@/src/app/components/FloatingYatraAI";
import { TravelAlertProvider } from "@/src/context/TravelAlertContext";
import { GlobalTravelAlert } from "@/src/app/components/safety/GlobalTravelAlert";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": siteConfig.name,
    "url": siteConfig.url,
    "description": siteConfig.description,
    "potentialAction": {
      "@type": "SearchAction",
      "target": `${siteConfig.url}/search?q={search_term_string}`,
      "query-input": "required name=search_term_string"
    }
  };

  return (
    <html lang="en" data-theme="light" className={`${cormorant.variable} ${dmSans.variable} ${caveat.variable} ${dmSans.className}`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var stored = localStorage.getItem("bsy_theme");
                if (stored === "dark") {
                  document.documentElement.setAttribute("data-theme", "dark");
                } else {
                  document.documentElement.setAttribute("data-theme", "light");
                  if (!stored) {
                    localStorage.setItem("bsy_theme", "light");
                  }
                }
              } catch(e) {
                document.documentElement.setAttribute("data-theme", "light");
              }
            `,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={dmSans.className} style={{ minHeight: "100vh", display: "flex", flexDirection: "column", backgroundColor: "var(--color-bg-canvas, #F2F2ED)", color: "var(--color-text-primary, var(--color-primary))", fontFamily: "var(--font-family-body)", overflowX: "hidden" }}>
        <TravelAlertProvider>
          <div id="root" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
            {/* TEMPORARILY DISABLED: IntroAnimation is excluded from this deployment */}
            <Navbar />
            <div style={{ flexGrow: 1 }}>
              {children}
            </div>
            {/* Global event-driven travel emergency alert system */}
            <GlobalTravelAlert />
            {/* Persistent Yatra AI companion floating across all pages in bottom right */}
            <Suspense fallback={null}>
              <FloatingYatraAI />
            </Suspense>
          </div>
        </TravelAlertProvider>
      </body>
    </html>
  );
}

