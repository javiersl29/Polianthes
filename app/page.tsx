import Hero from "@/components/Hero";
import Decoder from "@/components/Decoder";
import Capabilities from "@/components/Capabilities";
import Catalog from "@/components/Catalog";

export const dynamic = "force-dynamic";

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
