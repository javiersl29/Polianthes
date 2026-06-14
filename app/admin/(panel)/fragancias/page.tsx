"use client";
import { useState, lazy, Suspense } from "react";
import FragranceManager from "./FragranceManager";
import PricingManager from "../precios/PricingManager";

const ImagenesPanel = lazy(() => import("../imagenes/ImagenesPanel"));
const NombresPanel = lazy(() => import("../nombres/NombresPanel"));

type Tab = "catalogo" | "imagenes" | "precios" | "nombres";

const TABS: { id: Tab; label: string; icon: string; desc: string }[] = [
  { id: "catalogo", label: "Catálogo", icon: "❍", desc: "Datos generales, notas, vectores" },
  { id: "imagenes", label: "Imágenes IA", icon: "🖼", desc: "Generación y búsqueda de imágenes" },
  { id: "precios", label: "Precios", icon: "$", desc: "Inventario y costos por presentación" },
  { id: "nombres", label: "Nombres", icon: "✦", desc: "Nombres artísticos con IA" }
];

export default function FragranceStudio() {
  const [tab, setTab] = useState<Tab>("catalogo");

  return (
    <div>
      {/* Tab bar */}
      <div className="flex items-center gap-1 mb-6 overflow-x-auto scrollbar-none">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`shrink-0 rounded-full px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t.id
                ? "bg-ink text-bg"
                : "liquid-glass text-ink/80 hover:text-gold"
            }`}
          >
            <span className="mr-1.5">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div key={tab}>
        {tab === "catalogo" && <FragranceManager />}
        {tab === "imagenes" && (
          <Suspense fallback={<div className="py-8 text-center text-ink-mute text-sm">Cargando panel de imágenes…</div>}>
            <ImagenesPanel />
          </Suspense>
        )}
        {tab === "precios" && <PricingManager />}
        {tab === "nombres" && (
          <Suspense fallback={<div className="py-8 text-center text-ink-mute text-sm">Cargando…</div>}>
            <NombresPanel />
          </Suspense>
        )}
      </div>
    </div>
  );
}
