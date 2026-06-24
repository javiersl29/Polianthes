import type { Metadata } from "next";
import { InfoPageShell } from "@/components/InfoPageShell";

export const metadata: Metadata = {
  title: "Tamaños y presentaciones · Polianthes",
  description: "Conoce nuestros tamaños: 10ml Travel, 30ml Standard, 60ml Grande y 100ml Coleccionista."
};

export default function TamanosPage() {
  return (
    <InfoPageShell
      eyebrow="Ayuda"
      title="Tamaños y presentaciones"
      intro="Cada fragancia está disponible en cuatro presentaciones. Elige el tamaño perfecto para cada ocasión."
      sections={[
        {
          title: "Nuestras presentaciones",
          icon: <IconBottle />,
          content: (
            <div className="space-y-3">
              <div className="border border-line/40 rounded-xl p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-ink font-medium text-sm">10 ml — Travel</p>
                  <span className="text-gold text-sm font-semibold">$100 MXN</span>
                </div>
                <p className="text-xs mt-1">Ideal para probar una fragancia nueva o llevarla de viaje. Compacto y discreto.</p>
              </div>
              <div className="border border-line/40 rounded-xl p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-ink font-medium text-sm">30 ml — Standard</p>
                  <span className="text-gold text-sm font-semibold">$250 MXN</span>
                </div>
                <p className="text-xs mt-1">El equilibrio perfecto entre precio y duración. Aproximadamente 300-400 pulverizaciones.</p>
              </div>
              <div className="border border-line/40 rounded-xl p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-ink font-medium text-sm">60 ml — Grande</p>
                  <span className="text-gold text-sm font-semibold">$350 MXN</span>
                </div>
                <p className="text-xs mt-1">Para uso diario. Dura varios meses con aplicación regular.</p>
              </div>
              <div className="border border-line/40 rounded-xl p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-ink font-medium text-sm">100 ml — Coleccionista</p>
                  <span className="text-gold text-sm font-semibold">$450 MXN</span>
                </div>
                <p className="text-xs mt-1">El mejor precio por mililitro. Para tu fragancia favorita o para regalar.</p>
              </div>
            </div>
          )
        },
        {
          title: "¿Cuál elegir?",
          icon: <IconCompass />,
          content: (
            <div className="space-y-2">
              <p><strong className="text-gold">¿Quieres probar?</strong> El 10ml es perfecto para descubrir si la fragancia va contigo antes de comprometerte con un tamaño mayor.</p>
              <p><strong className="text-gold">¿Uso diario?</strong> El 30ml o 60ml son ideales. Tendrás suficiente para usarla a diario durante meses.</p>
              <p><strong className="text-gold">¿Es tu favorita?</strong> El 100ml ofrece el mejor valor. Perfecto si ya sabes que la amarás por mucho tiempo.</p>
              <p><strong className="text-gold">¿Para regalar?</strong> El 60ml o 100ml en su empaque elegante son una excelente opción de regalo.</p>
            </div>
          )
        },
        {
          title: "Conservación",
          icon: <IconSparkle />,
          content: (
            <div className="space-y-1">
              <p>Para mantener tus fragancias en óptimas condiciones:</p>
              <p>• Guárdalas en un lugar <strong className="text-ink">fresco, oscuro y seco</strong>.</p>
              <p>• Evita la luz solar directa y fuentes de calor.</p>
              <p>• No las guardes en el baño (la humedad y los cambios de temperatura las alteran).</p>
              <p>• Mantén el frasco bien cerrado para preservar las notas.</p>
              <p>• Un perfume bien conservado dura <strong className="text-gold">3-5 años</strong>.</p>
            </div>
          )
        }
      ]}
    />
  );
}

function IconBottle() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3h6M10 3v3.5a2 2 0 0 1-1 1.7l-2 .9a2 2 0 0 0-1 1.7V20a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-8.2a2 2 0 0 0-1-1.7l-2-.9a2 2 0 0 1-1-1.7V3" /></svg>; }
function IconCompass() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="m16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12Z" /></svg>; }
function IconSparkle() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /><circle cx="12" cy="12" r="3" /></svg>; }
