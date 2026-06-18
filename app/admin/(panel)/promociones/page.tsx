import { isAuthenticated } from "@/lib/auth";
import PromocionesClient from "./PromocionesClient";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function PromocionesPage() {
  if (!isAuthenticated()) {
    return (
      <div className="p-8 text-sm text-ink-mute">
        No autorizado. Inicia sesión desde /admin/login.
      </div>
    );
  }

  const r = await query<{
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
    image_ai_generated: boolean;
    image_prompt: string | null;
    badge_text: string | null;
    badge_color: string;
    min_items: number;
    max_items: number;
    min_subtotal_cents: number;
    starts_at: string;
    ends_at: string | null;
    active: boolean;
    sort_order: number;
    created_at: string;
    updated_at: string;
  }>(`SELECT * FROM promotion ORDER BY sort_order ASC, created_at DESC`);

  return <PromocionesClient initialPromotions={r.rows} />;
}
