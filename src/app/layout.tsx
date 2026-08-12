import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import { AuthProvider } from "@/lib/auth";
import { I18nProvider } from "@/lib/i18n";
import { PwaBanner } from "@/components/pwa-banner";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "DreamUtopia — Free AI Image & Video Generator",
    template: "%s — DreamUtopia",
  },
  description:
    "Transform your photos into cinematic AI-powered videos in seconds. Start free — no account needed, no credit card required.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "DreamUtopia",
  },
  icons: {
    icon: "/assets/icons/icon-192.png",
    apple: "/assets/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0d0d12",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={outfit.variable}>
      <body className="flex min-h-screen flex-col antialiased">
        <I18nProvider>
          <AuthProvider>
            {children}
            <PwaBanner />
          </AuthProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
