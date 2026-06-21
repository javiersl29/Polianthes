import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { CartProvider } from "@/components/CartProvider";
import CartDrawer from "@/components/CartDrawer";

const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["italic", "normal"],
  variable: "--font-display",
  display: "swap",
  preload: true
});

const body = Manrope({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-body",
  display: "swap",
  preload: true
});

const SITE_URL = "https://polianthes.shop";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Polianthes — Perfumes de inspiración | Decodificador de fragancias con IA",
    template: "%s | Polianthes"
  },
  description: "Perfumes de inspiración. Decodifica tu fragancia ideal con IA, explora 146+ fragancias curadas y compra online con envío a todo México. Pagos seguros con Mercado Pago.",
  keywords: [
    "perfumes de inspiración",
    "perfumes similares",
    "perfumes baratos México",
    "dupes de perfumes",
    "decodificador de fragancias",
    "perfumería online México",
    "fragancias inspiradas",
    "Polianthes",
    "perfumes de nicho",
    "e-commerce perfumes"
  ],
  authors: [{ name: "Polianthes" }],
  creator: "Polianthes",
  publisher: "Polianthes",
  alternates: {
    canonical: "/"
  },
  openGraph: {
    type: "website",
    locale: "es_MX",
    url: SITE_URL,
    siteName: "Polianthes",
    title: "Polianthes — Perfumes de inspiración | Decodificador con IA",
    description: "Decodifica tu fragancia ideal con IA. 146+ perfumes inspirados en las fragancias más icónicas del mundo. Envíos a todo México.",
    images: [
      {
        url: "/brand/Logo-Color.png",
        width: 1200,
        height: 630,
        alt: "Polianthes — Perfumería de inspiración"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Polianthes — Perfumes de inspiración",
    description: "Decodifica tu fragancia ideal con IA. 146+ perfumes inspirados. Envíos a todo México.",
    images: ["/brand/Logo-Color.png"]
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1
    }
  },
  category: "shopping",
  icons: {
    icon: [
      { url: "/brand/Isotipo-color.png", type: "image/png", sizes: "any" }
    ],
    apple: [{ url: "/brand/Isotipo-color.png", sizes: "180x180" }]
  },
  manifest: undefined
};

export const viewport: Viewport = {
  themeColor: "#0c0c0c",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Store",
  name: "Polianthes",
  description: "Perfumes de inspiración. Decodificador de fragancias con IA y curaduría de 146+ fragancias.",
  url: SITE_URL,
  image: `${SITE_URL}/brand/Logo-Color.png`,
  logo: `${SITE_URL}/brand/Isotipo-color.png`,
  email: "ventas@polianthes.shop",
  priceRange: "$$",
  address: {
    "@type": "PostalAddress",
    addressCountry: "MX",
    addressLocality: "Cocula",
    addressRegion: "Jalisco"
  },
  sameAs: [],
  potentialAction: {
    "@type": "SearchAction",
    target: `${SITE_URL}/#catalogo`,
    "query-input": "required name=search_string"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${display.variable} ${body.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="bg-bg text-ink min-h-screen">
        <CartProvider>
          <Navbar />
          {children}
          <Footer />
          <CartDrawer />
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
        </CartProvider>
      </body>
    </html>
  );
}
