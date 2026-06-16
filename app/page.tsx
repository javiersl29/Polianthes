import Hero from "@/components/Hero";
import Decoder from "@/components/Decoder";
import Capabilities from "@/components/Capabilities";
import Catalog from "@/components/Catalog";
import type { Metadata } from "next";

export const revalidate = 300;

export const metadata: Metadata = {
  alternates: { canonical: "/" }
};

export default function Home() {
  return (
    <main>
      <Hero />
      <Decoder />
      <Capabilities />
      <Catalog />
    </main>
  );
}
