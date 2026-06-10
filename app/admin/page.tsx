import { isAuthenticated } from "@/lib/auth";
import { redirect } from "next/navigation";
import { query } from "@/lib/db";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  if (!isAuthenticated()) redirect("/admin/login");

  const totals = await query<{ count: string; enriched: string }>(
    `SELECT COUNT(*)::text AS count, COUNT(enriched_at)::text AS enriched FROM fragrance`
  );
  const ai = await query<{ model: string; api_key: string | null; base_url: string | null }>(
    `SELECT model, api_key, base_url FROM ai_config WHERE id = 1`
  );

  const total = Number(totals.rows[0]?.count ?? 0);
  const enriched = Number(totals.rows[0]?.enriched ?? 0);
  const config = ai.rows[0] ?? null;
  const aiReady = !!config?.api_key;

  const cards = [
    { href: "/admin/ai", title: "Configuración IA", body: aiReady ? `Modelo activo: ${config?.model}` : "Sin API key configurada" },
    { href: "/admin/fragancias", title: "Fragancias", body: `${total} en catálogo · ${enriched} con notas documentadas` }
  ];

  return (
    <div>
      <p className="text-sm text-ink-mute">// Resumen</p>
      <h1 className="mt-2 font-display italic text-5xl text-ink tracking-[-2px]">Bienvenido</h1>
      <p className="mt-3 text-ink-mute max-w-xl">
        Desde aquí gestionas la IA que recomienda fragancias y el catálogo completo. Usa el menú lateral para
        saltar a cada sección.
      </p>

      <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="liquid-glass rounded-3xl p-6 hover:text-gold transition-colors"
          >
            <p className="text-[11px] uppercase tracking-[0.2em] text-ink-mute">{c.href}</p>
            <p className="mt-2 font-display italic text-3xl text-ink">{c.title}</p>
            <p className="mt-3 text-sm text-ink/90">{c.body}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
