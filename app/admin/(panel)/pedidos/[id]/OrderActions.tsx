"use client";
import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type OrderStatus = "pending" | "approved" | "rejected" | "cancelled" | "refunded" | "in_transit" | "delivered";

type Props = {
  order: {
    id: number;
    status: OrderStatus;
    carrier: string;
    tracking_number: string;
    tracking_url: string;
    notes: string;
  };
  statuses: { value: OrderStatus; label: string; color: string }[];
};

export default function OrderActions({ order, statuses }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<OrderStatus>(order.status);
  const [carrier, setCarrier] = useState(order.carrier);
  const [trackingNumber, setTrackingNumber] = useState(order.tracking_number);
  const [trackingUrl, setTrackingUrl] = useState(order.tracking_url);
  const [notes, setNotes] = useState(order.notes);
  const [savingStatus, setSavingStatus] = useState(false);
  const [SavingTracking, setSavingTracking] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);

  async function saveStatus() {
    setSavingStatus(true);
    try {
      const r = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: order.id, action: "status", status })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Error");
      toast.success(`Estado actualizado a "${statuses.find((s) => s.value === status)?.label}"`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setSavingStatus(false);
    }
  }

  async function saveTracking() {
    setSavingTracking(true);
    try {
      const r = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: order.id, action: "tracking",
          carrier, tracking_number: trackingNumber, tracking_url: trackingUrl
        })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Error");
      toast.success("Tracking guardado");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setSavingTracking(false);
    }
  }

  async function saveNotes() {
    setSavingNotes(true);
    try {
      const r = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: order.id, action: "notes", notes })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Error");
      toast.success("Notas guardadas");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setSavingNotes(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="text-[11px] uppercase tracking-wider text-gold/80">Estado</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {statuses.map((s) => (
            <button
              key={s.value}
              onClick={() => setStatus(s.value)}
              className={`rounded-full px-3 py-1.5 text-xs border transition-colors ${
                status === s.value ? s.color : "border-white/10 text-ink/60 hover:text-ink"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <button
          onClick={saveStatus}
          disabled={savingStatus || status === order.status}
          className="mt-3 rounded-full bg-gold text-bg px-4 py-1.5 text-xs font-medium hover:bg-gold/90 transition-colors disabled:opacity-50"
        >
          {savingStatus ? "Guardando…" : "Actualizar estado"}
        </button>
      </div>

      <div className="pt-4 border-t border-line">
        <p className="text-[11px] uppercase tracking-wider text-gold/80">Paquetería</p>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input
            value={carrier}
            onChange={(e) => setCarrier(e.target.value)}
            className="bg-black/40 border border-line rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold"
            placeholder="Transportista (DHL, Estafeta…)"
          />
          <input
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            className="bg-black/40 border border-line rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold"
            placeholder="Número de guía"
          />
        </div>
        <input
          value={trackingUrl}
          onChange={(e) => setTrackingUrl(e.target.value)}
          className="mt-2 w-full bg-black/40 border border-line rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold"
          placeholder="URL de seguimiento (opcional)"
        />
        <button
          onClick={saveTracking}
          disabled={SavingTracking}
          className="mt-2 rounded-full liquid-glass border border-line px-4 py-1.5 text-xs hover:border-gold/40 transition-colors disabled:opacity-50"
        >
          {SavingTracking ? "Guardando…" : "Guardar tracking"}
        </button>
      </div>

      <div className="pt-4 border-t border-line">
        <p className="text-[11px] uppercase tracking-wider text-gold/80">Notas internas</p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="mt-2 w-full bg-black/40 border border-line rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold resize-y"
          placeholder="Notas visibles solo para el equipo…"
        />
        <button
          onClick={saveNotes}
          disabled={savingNotes}
          className="mt-2 rounded-full liquid-glass border border-line px-4 py-1.5 text-xs hover:border-gold/40 transition-colors disabled:opacity-50"
        >
          {savingNotes ? "Guardando…" : "Guardar notas"}
        </button>
      </div>
    </div>
  );
}
