"use client";
import { useState } from "react";
import { toast } from "sonner";
import { formatMXN } from "@/lib/money";
import { useCart } from "@/components/CartProvider";

type Presentation = {
  size_ml: number;
  price_cents: number | null;
  compare_at_price_cents: number | null;
  stock: number | null;
};

type Props = {
  slug: string;
  brand: string;
  name: string;
  image_url: string | null;
  image_version?: number | null;
  artistic_name?: string | null;
  full_name?: string;
  presentations: Presentation[];
};

function isInStock(p: Presentation): boolean {
  if (p.stock === null) return true;
  if (p.stock < 0) return true;
  return p.stock > 0;
}

function stockLabel(p: Presentation): string | null {
  if (p.stock === null || p.stock < 0) return null;
  if (p.stock === 0) return "Agotado";
  if (p.stock <= 3) return `Últimas ${p.stock}`;
  return null;
}

export default function AddToCart({ slug, brand, name, image_url, image_version, artistic_name, full_name, presentations }: Props) {
  const { add } = useCart();
  const available = presentations
    .filter((p) => p.price_cents !== null && p.price_cents > 0)
    .filter(isInStock);

  const [size, setSize] = useState<number | null>(available[0]?.size_ml ?? null);
  const [qty, setQty] = useState(1);
  const selected = presentations.find((p) => p.size_ml === size) ?? null;

  if (available.length === 0) {
    return (
      <div className="liquid-glass-strong rounded-2xl p-5 text-center">
        <p className="text-sm text-ink-mute">Esta fragancia aún no tiene presentaciones activas.</p>
        <button
          onClick={() => toast.info("Pronto habrá stock. Te avisaremos.")}
          className="mt-3 liquid-glass rounded-full px-4 py-2 text-sm text-ink/80 hover:text-gold transition-colors"
        >
          Notificarme cuando esté disponible
        </button>
      </div>
    );
  }

  const handleAdd = () => {
    if (!selected || !selected.price_cents) return;
    add({
      slug,
      brand,
      name,
      full_name: full_name ?? `${brand} - ${name}`,
      artistic_name: artistic_name ?? null,
      size_ml: selected.size_ml,
      qty,
      unit_price_cents: selected.price_cents,
      image_url,
      image_version: image_version ?? null
    });
    toast.success(`${artistic_name ?? name} (${selected.size_ml}ml) añadido al carrito`);
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] sm:text-xs uppercase tracking-wider text-ink-mute mb-2">Presentación</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {available.map((p) => {
            const active = size === p.size_ml;
            const label = stockLabel(p);
            return (
              <button
                key={p.size_ml}
                onClick={() => setSize(p.size_ml)}
                className={`relative rounded-xl px-2 py-2.5 sm:py-3 text-left transition-all border ${
                  active
                    ? "border-gold bg-gold/10"
                    : "border-line/40 liquid-glass hover:border-gold/40"
                }`}
              >
                <p className="text-[11px] uppercase tracking-wider text-ink-mute">{p.size_ml} ml</p>
                <p className={`mt-0.5 text-sm font-medium ${active ? "text-gold" : "text-ink"}`}>
                  {formatMXN(p.price_cents)}
                </p>
                {p.compare_at_price_cents && p.compare_at_price_cents > (p.price_cents ?? 0) && (
                  <p className="text-[10px] text-ink-mute line-through">{formatMXN(p.compare_at_price_cents)}</p>
                )}
                {label && (
                  <p className="mt-1 text-[9px] uppercase tracking-wider text-rose-300/90">{label}</p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="liquid-glass rounded-full flex items-center">
          <button
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="h-10 w-10 rounded-full text-ink/80 hover:text-gold transition-colors"
            aria-label="Disminuir cantidad"
          >
            −
          </button>
          <span className="w-8 text-center text-sm font-medium">{qty}</span>
          <button
            onClick={() => setQty((q) => Math.min(99, q + 1))}
            className="h-10 w-10 rounded-full text-ink/80 hover:text-gold transition-colors"
            aria-label="Aumentar cantidad"
          >
            +
          </button>
        </div>
        <button
          onClick={handleAdd}
          disabled={!selected}
          className="flex-1 liquid-glass-strong rounded-full px-5 py-3 text-sm font-medium hover:text-gold transition-colors disabled:opacity-50"
        >
          Agregar al carrito
        </button>
      </div>

      {selected?.price_cents && (
        <p className="text-[11px] text-ink-mute text-center">
          Total: <span className="text-ink">{formatMXN(selected.price_cents * qty)}</span>
        </p>
      )}
    </div>
  );
}
