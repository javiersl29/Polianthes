import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["italic", "normal"],
  variable: "--font-display",
  display: "swap"
});

const body = Manrope({
  subsets: ["latin"],
  weight: ["200", "300", "400", "500", "600"],
  variable: "--font-body",
  display: "swap"
});

export const metadata: Metadata = {
  title: "Polianthes — Perfumería de autor",
  description: "Casa de perfumería de autor. Decodifica tu fragancia y descubre una curaduría de nicho.",
  icons: {
    icon: [{ url: "/brand/Isotipo-color.png", type: "image/png" }],
    apple: "/brand/Isotipo-color.png"
  }
};

export const viewport: Viewport = {
  themeColor: "#0c0c0c"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${display.variable} ${body.variable}`}>
      <body className="bg-bg text-ink min-h-screen">
        <Navbar />
        {children}
        <Footer />
        <Toaster
          theme="dark"
          position="bottom-center"
          toastOptions={{
            style: {
              background: "color-mix(in oklch, var(--color-bg-elev) 90%, transparent)",
              border: "1px solid color-mix(in oklch, var(--color-gold) 30%, transparent)",
              color: "var(--color-ink)",
              backdropFilter: "blur(14px)"
            }
          }}
        />
      </body>
    </html>
  );
}
