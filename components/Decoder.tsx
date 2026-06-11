"use client";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HEXAGON_SETS, AxisSet, DecodeVector, defaultVector } from "@/lib/decoder";

type Gender = "hombre" | "mujer" | "unisex";
type Recommendation = {
  slug: string;
  brand: string;
  name: string;
  full_name: string;
  image_url: string | null;
  gender: Gender;
  reason: string;
  score?: number;
};

const HEX_SIZE = 360;
const RADIUS = HEX_SIZE / 2 - 56;
const CENTER = HEX_SIZE / 2;
const LABEL_RADIUS = RADIUS + 30;

const THINKING_LINES = [
  "Leyendo tu afinidad…",
  "Comparando con 146 fragancias curadas…",
  "Calculando distancias en el espacio olfativo…",
  "Buscando las cinco firmas más cercanas…",
  "Componiendo tu selección…"
];

function polar(angleDeg: number, radius: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CENTER + radius * Math.cos(a), y: CENTER + radius * Math.sin(a) };
}

function polygonPoints(values: number[]) {
  return values
    .map((v, i) => {
      const angle = (360 / values.length) * i;
      const r = (v / 100) * RADIUS;
      const p = polar(angle, r);
      return `${p.x},${p.y}`;
    })
    .join(" ");
}

export default function Decoder() {
  const [setId, setSetId] = useState<"familias" | "mood">("familias");
  const set: AxisSet = HEXAGON_SETS[setId];
  const [vector, setVector] = useState<DecodeVector>(() => defaultVector(HEXAGON_SETS.familias));
  const [active, setActive] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(HEXAGON_SETS.familias.axes.map((a) => [a.id, true]))
  );
  const [gender, setGender] = useState<Gender>("unisex");
  const [loading, setLoading] = useState(false);
  const [thinkingIdx, setThinkingIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Recommendation[]>([]);

  // Resetea "active" cuando cambias de set
  useEffect(() => {
    setActive(Object.fromEntries(set.axes.map((a) => [a.id, true])));
  }, [setId, set]);

  // Rotación de frases mientras loading
  useEffect(() => {
    if (!loading) return;
    const t = setInterval(() => setThinkingIdx((i) => (i + 1) % THINKING_LINES.length), 900);
    return () => clearInterval(t);
  }, [loading]);

  const values = set.axes.map((a) => (active[a.id] ? vector[a.id] ?? 50 : 0));

  const updateAxis = (id: string, v: number) => {
    setVector((prev) => ({ ...prev, [id]: Math.max(0, Math.min(100, Math.round(v))) }));
  };
  const toggleAxis = (id: string) => {
    setActive((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const switchSet = (next: "familias" | "mood") => {
    setSetId(next);
    setVector(defaultVector(HEXAGON_SETS[next]));
    setActive(Object.fromEntries(HEXAGON_SETS[next].axes.map((a) => [a.id, true])));
    setResults([]);
    setError(null);
  };

  const submit = async (mode: "fast" | "rich" = "fast") => {
    setLoading(true);
    setThinkingIdx(0);
    setError(null);
    setResults([]);
    const effectiveVector: DecodeVector = {};
    for (const a of set.axes) {
      effectiveVector[a.id] = active[a.id] ? vector[a.id] ?? 50 : 0;
    }
    try {
      const res = await fetch("/api/decode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ set: setId, vector: effectiveVector, gender, mode })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo descifrar la fragancia");
      setResults(data.recommendations ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  const hexPath = useMemo(() => polygonPoints(values), [values]);

  return (
    <section id="decodificador" className="relative py-32 px-4 overflow-hidden">
      {/* Fondo animado tenue */}
      <HexBackground />

      <div className="relative max-w-6xl mx-auto">
        <div className="flex flex-col items-center text-center gap-4">
          <p className="text-sm text-ink-mute">// Decodificador</p>
          <h2 className="font-display italic text-ink text-5xl md:text-7xl leading-[0.9] tracking-[-3px] max-w-3xl">
            Descifra<br />tu fragancia
          </h2>
          <p className="text-ink-mute max-w-xl mt-2">
            Activa los ejes que te interesan, ajústalos a tu gusto y deja que la IA encuentre las cinco
            fragancias que mejor traducen tu intención.
          </p>
        </div>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
          <div className="liquid-glass inline-flex items-center rounded-full p-1.5">
            {(Object.keys(HEXAGON_SETS) as ("familias" | "mood")[]).map((id) => (
              <button
                key={id}
                onClick={() => switchSet(id)}
                className={`px-4 py-1.5 text-sm rounded-full transition-colors ${
                  setId === id ? "bg-ink text-bg" : "text-ink/80 hover:text-gold"
                }`}
              >
                {id === "familias" ? "Por familias" : "Por estado de ánimo"}
              </button>
            ))}
          </div>
          <div className="liquid-glass inline-flex items-center rounded-full p-1.5" role="group" aria-label="Género">
            {(["hombre", "mujer", "unisex"] as Gender[]).map((g) => (
              <button
                key={g}
                onClick={() => setGender(g)}
                className={`px-4 py-1.5 text-sm rounded-full transition-colors capitalize ${
                  gender === g ? "bg-gold text-bg" : "text-ink/80 hover:text-gold"
                }`}
                aria-pressed={gender === g}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-14 grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-12 items-center">
          <div className="relative mx-auto" style={{ width: HEX_SIZE, height: HEX_SIZE }}>
            <svg width={HEX_SIZE} height={HEX_SIZE} className="block relative z-10">
              <defs>
                <linearGradient id="hexFill" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="oklch(0.82 0.13 85)" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="oklch(0.82 0.13 85)" stopOpacity="0.05" />
                </linearGradient>
                <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* anillos concéntricos */}
              {[100, 75, 50, 25].map((p) => (
                <polygon
                  key={p}
                  points={polygonPoints(Array(set.axes.length).fill(p))}
                  fill="none"
                  stroke="rgba(255,255,255,0.07)"
                  strokeWidth="1"
                />
              ))}

              {/* ejes */}
              {set.axes.map((axis, i) => {
                const angle = (360 / set.axes.length) * i;
                const p = polar(angle, RADIUS);
                return (
                  <line
                    key={`line-${axis.id}`}
                    x1={CENTER}
                    y1={CENTER}
                    x2={p.x}
                    y2={p.y}
                    stroke="rgba(255,255,255,0.08)"
                    strokeWidth="1"
                  />
                );
              })}

              {/* polígono activo */}
              <motion.polygon
                points={hexPath}
                fill="url(#hexFill)"
                stroke="oklch(0.82 0.13 85)"
                strokeWidth="1.5"
                initial={false}
                animate={{ points: hexPath }}
                transition={{ type: "spring", stiffness: 120, damping: 18 }}
                filter="url(#glow)"
              />

              {/* marcadores */}
              {set.axes.map((axis, i) => {
                const angle = (360 / set.axes.length) * i;
                const isActive = active[axis.id];
                const pos = polar(angle, (values[i] ?? 0) / 100 * RADIUS);
                return (
                  <motion.g key={`pt-${axis.id}`} animate={{ opacity: isActive ? 1 : 0.25 }}>
                    <motion.circle
                      cx={pos.x}
                      cy={pos.y}
                      r={isActive ? 8 : 5}
                      fill={isActive ? "oklch(0.82 0.13 85)" : "rgba(255,255,255,0.4)"}
                      stroke="oklch(0.97 0.01 90)"
                      strokeWidth="1.5"
                      animate={{ cx: pos.x, cy: pos.y }}
                      transition={{ type: "spring", stiffness: 200, damping: 20 }}
                    />
                  </motion.g>
                );
              })}

              {/* etiquetas — más legibles */}
              {set.axes.map((axis, i) => {
                const angle = (360 / set.axes.length) * i;
                const p = polar(angle, LABEL_RADIUS);
                const isActive = active[axis.id];
                return (
                  <text
                    key={`lbl-${axis.id}`}
                    x={p.x}
                    y={p.y}
                    fill={isActive ? "oklch(0.97 0.01 90)" : "rgba(255,255,255,0.4)"}
                    fontSize="12"
                    fontWeight="600"
                    fontFamily="var(--font-body), system-ui, sans-serif"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    style={{ letterSpacing: "0.12em", textTransform: "uppercase" }}
                  >
                    {axis.label}
                  </text>
                );
              })}
            </svg>
          </div>

          <div className="space-y-3">
            {set.axes.map((axis) => {
              const isActive = active[axis.id];
              return (
                <div
                  key={axis.id}
                  className={`liquid-glass rounded-2xl px-4 py-3 transition-opacity ${isActive ? "" : "opacity-50"}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={() => toggleAxis(axis.id)}
                        className="h-4 w-4 accent-[color:var(--color-gold)]"
                        aria-label={`Activar ${axis.label}`}
                      />
                      <span className="text-sm font-medium">{axis.label}</span>
                    </label>
                    <span className={`font-display italic text-lg ${isActive ? "text-gold" : "text-ink-mute"}`}>
                      {isActive ? vector[axis.id] ?? 50 : "—"}
                    </span>
                  </div>
                  <p className="text-[11px] text-ink-mute mt-0.5">{axis.hint}</p>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    disabled={!isActive}
                    value={vector[axis.id] ?? 50}
                    onChange={(e) => updateAxis(axis.id, Number(e.target.value))}
                    className="mt-2 w-full accent-[color:var(--color-gold)] disabled:opacity-40"
                    aria-label={axis.label}
                  />
                </div>
              );
            })}

            <div className="mt-4 grid grid-cols-3 gap-2">
              <button
                onClick={() => submit("fast")}
                disabled={loading}
                className="liquid-glass-strong col-span-2 rounded-full px-5 py-3 text-sm font-medium text-ink hover:text-gold transition-colors disabled:opacity-50 flex items-center justify-center gap-3"
              >
                {loading ? (
                  <>
                    <ThinkingDots />
                    <span key={thinkingIdx} className="animate-fade-in">{THINKING_LINES[thinkingIdx]}</span>
                  </>
                ) : (
                  "Descifrar mi fragancia"
                )}
              </button>
              <button
                onClick={() => submit("rich")}
                disabled={loading}
                className="liquid-glass rounded-full px-3 py-3 text-xs hover:text-gold transition-colors disabled:opacity-50"
                title="Justificaciones más elaboradas (más lento)"
              >
                Con razón IA
              </button>
            </div>
            <p className="mt-2 text-[10px] text-ink-mute text-center">
              Modo rápido: afinidad numérica. Modo IA: justificación literaria de cada fragancia.
            </p>
          </div>
        </div>

        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-8 text-center text-sm text-rose-300"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        {results.length > 0 && (
          <div className="mt-16">
            <p className="text-center text-sm text-ink-mute mb-6">Selección personalizada</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {results.map((r, idx) => (
                <motion.a
                  key={r.slug}
                  href={`/fragancias/${r.slug}`}
                  initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  transition={{ delay: idx * 0.08, duration: 0.6, ease: "easeOut" }}
                  className="liquid-glass rounded-3xl p-4 hover:text-gold transition-colors"
                >
                  <div className="aspect-[3/4] rounded-2xl bg-bg-elev overflow-hidden grid place-items-center text-ink-mute text-xs">
                    {r.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.image_url} alt={r.full_name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-display italic text-gold text-3xl">{r.brand[0]}</span>
                    )}
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <p className="text-xs text-ink-mute uppercase tracking-wider">{r.brand}</p>
                    <span className="liquid-glass rounded-full px-2 py-0.5 text-[10px] text-ink/80 capitalize">
                      {r.gender}
                    </span>
                  </div>
                  <p className="font-display italic text-xl text-ink leading-tight">{r.name}</p>
                  {typeof r.score === "number" && (
                    <p className="mt-1 text-[10px] text-gold">Afinidad {r.score}%</p>
                  )}
                  <p className="mt-2 text-[12px] text-ink-mute leading-snug">{r.reason}</p>
                </motion.a>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function ThinkingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="h-1.5 w-1.5 rounded-full bg-gold animate-bounce" style={{ animationDelay: "0ms" }} />
      <span className="h-1.5 w-1.5 rounded-full bg-gold animate-bounce" style={{ animationDelay: "150ms" }} />
      <span className="h-1.5 w-1.5 rounded-full bg-gold animate-bounce" style={{ animationDelay: "300ms" }} />
    </span>
  );
}

/** Fondo animado: gradiente respirando + partículas SVG muy tenues */
function HexBackground() {
  return (
    <div className="absolute inset-0 -z-0 overflow-hidden pointer-events-none">
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] rounded-full animate-hex-breathe"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in oklch, var(--color-gold) 12%, transparent), transparent 70%)",
          filter: "blur(30px)"
        }}
      />
      <svg className="absolute inset-0 w-full h-full opacity-30" preserveAspectRatio="none">
        <defs>
          <pattern id="hexGrid" width="48" height="48" patternUnits="userSpaceOnUse" patternTransform="rotate(0)">
            <path
              d="M24 4 L42 14 L42 34 L24 44 L6 34 L6 14 Z"
              fill="none"
              stroke="rgba(255,255,255,0.05)"
              strokeWidth="0.6"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hexGrid)" />
      </svg>
      <style jsx>{`
        @keyframes hexBreathe {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.85; }
          50% { transform: translate(-50%, -50%) scale(1.08); opacity: 1; }
        }
        .animate-hex-breathe {
          animation: hexBreathe 9s ease-in-out infinite;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(2px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fadeIn 0.4s ease-out;
        }
      `}</style>
    </div>
  );
}
