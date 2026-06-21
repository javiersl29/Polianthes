import Hero from "@/components/Hero";
import AnnouncementBar from "@/components/AnnouncementBar";
import Decoder from "@/components/Decoder";
import MonthlyOffers from "@/components/MonthlyOffers";
import Catalog from "@/components/Catalog";
import type { Metadata } from "next";
import { query } from "@/lib/db";

export const revalidate = 300;

export const metadata: Metadata = {
  alternates: { canonical: "/" }
};

type Promotion = {
  id: number;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  type: string;
  value: number;
  bundle_price_cents: number;
  required_size_ml: number;
  mix_sizes: boolean;
  quantity_to_take: number;
  quantity_to_pay: number;
  image_url: string | null;
  badge_text: string | null;
  badge_color: string;
  min_items: number;
  max_items: number;
  min_subtotal_cents: number;
  starts_at: string;
  ends_at: string | null;
  sort_order: number;
};

async function getActivePromotions(): Promise<Promotion[]> {
  try {
    const r = await query<Promotion>(
      `SELECT id, slug, title, subtitle, description, type, value, bundle_price_cents,
              required_size_ml, mix_sizes, quantity_to_take, quantity_to_pay,
              CASE WHEN image_url LIKE 'data:%' THEN NULL ELSE image_url END AS image_url,
              badge_text, badge_color,
              min_items, max_items, min_subtotal_cents, starts_at, ends_at, sort_order
       FROM promotion
       WHERE active = TRUE
         AND (starts_at IS NULL OR starts_at <= NOW())
         AND (ends_at IS NULL OR ends_at >= NOW())
       ORDER BY sort_order ASC, created_at DESC
       LIMIT 12`
    );
    return r.rows;
  } catch {
    return [];
  }
}

export default async function Home() {
  const promotions = await getActivePromotions();
  return (
    <main>
      <Hero />
      <AnnouncementBar />
      <Decoder />
      <MonthlyOffers promotions={promotions} />
      <Catalog />
    </main>
  );
}
