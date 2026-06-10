"use client";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HEXAGON_SETS, AxisSet, DecodeVector, defaultVector } from "@/lib/decoder";

type Recommendation = {
  slug: string;
  brand: string;
  name: string;
  full_name: string;
  image_url: string | null;
  reason: string;
};

const HEX_SIZE = 280;
const RADIUS = HEX_SIZE / 2 - 12;
const CENTER = HEX_SIZE / 2;

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

function axisLabelPoint(angleDeg: number, offset: number) {
  return polar(angleDeg, RADIUS + offset);
}

export default function Decoder() {
  const [setId, setSetId] = useState<"familias" | "mood">("familias");
  const set: AxisSet = HEXAGON_SETS[setId];
  const [vector, setVector] = useState<DecodeVector>(() => defaultVector(HEXAGON_SETS.familias));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Recommendation[]>([]);

  const values = set.axes.map((a) => vector[a.id] ?? 50);

  const updateAxis = (id: string, v: number) => {
    setVector((prev) => ({ ...prev, [id]: Math.max(0, Math.min(100, Math.round(v))) }));
  };

  const switchSet = (next: "familias" | "mood") => {
    setSetId(next);
    setVector(defaultVector(HEXAGON_SETS[next]));
    setResults([]);
    setError(null);
  };

  const submit = async () => {
    setLoading(true);
    setError(null);
    setResults([]);
    try {
      const res = await fetch("/api/decode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ set: setId, vector })
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
    <section id="decodificador" className="relative py-32 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col items-center text-center gap-4">
          <p className="text-sm text-ink-mute">// Decodificador</p>
          <h2 className="font-display italic text-ink text-5xl md:text-7xl leading-[0.9] tracking-[-3px] max-w-3xl">
            Descifra<br />tu fragancia
          </h2>
          <p className="text-ink-mute max-w-xl mt-2">
            Mueve los seis ejes. Nuestra IA analiza el vector y selecciona cinco fragancias del catálogo
            que mejor traducen tu intención.
          </p>
        </div>

        <div className="mt-10 flex justify-center">
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
        </div>

        <div className="mt-14 grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-12 items-center">
          <div className="relative mx-auto" style={{ width: HEX_SIZE, height: HEX_SIZE }}>
            <svg width={HEX_SIZE} height={HEX_SIZE} className="block">
              <polygon
                points={polygonPoints(Array(set.axes.length).fill(100))}
                fill="none"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="1"
              />
              <polygon
                points={polygonPoints(Array(set.axes.length).fill(60))}
                fill="none"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="1"
              />
              <polygon
                points={polygonPoints(Array(set.axes.length).fill(30))}
                fill="none"
                stroke="rgba(255,255,255,0.04)"
                strokeWidth="1"
              />
              <motion.polygon
                points={hexPath}
                fill="rgba(212,175,55,0.18)"
                stroke="oklch(0.82 0.13 85)"
                strokeWidth="1.5"
                initial={false}
                animate={{ points: hexPath }}
                transition={{ type: "spring", stiffness: 120, damping: 18 }}
              />
              {set.axes.map((axis, i) => {
                const angle = (360 / set.axes.length) * i;
                const pos = polar(angle, (vector[axis.id] ?? 50) / 100 * RADIUS);
                return (
                  <g key={axis.id}>
                    <line
                      x1={CENTER}
                      y1={CENTER}
                      x2={polar(angle, RADIUS).x}
                      y2={polar(angle, RADIUS).y}
                      stroke="rgba(255,255,255,0.08)"
                      strokeWidth="1"
                    />
                    <motion.circle
                      cx={pos.x}
                      cy={pos.y}
                      r={8}
                      fill="oklch(0.82 0.13 85)"
                      stroke="oklch(0.97 0.01 90)"
                      strokeWidth="1.5"
                      animate={{ cx: pos.x, cy: pos.y }}
                      transition={{ type: "spring", stiffness: 200, damping: 20 }}
                    />
                  </g>
                );
              })}
              {set.axes.map((axis, i) => {
                const angle = (360 / set.axes.length) * i;
                const p = axisLabelPoint(angle, 28);
                return (
                  <text
                    key={axis.id}
                    x={p.x}
                    y={p.y}
                    fill="oklch(0.96 0.01 90)"
                    fontSize="11"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    style={{ letterSpacing: "0.06em", textTransform: "uppercase" }}
                  >
                    {axis.label}
                  </text>
                );
              })}
            </svg>
          </div>

          <div className="space-y-3">
            {set.axes.map((axis) => (
              <div key={axis.id} className="liquid-glass rounded-2xl px-4 py-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-medium">{axis.label}</span>
                  <span className="font-display italic text-gold text-lg">{vector[axis.id] ?? 50}</span>
                </div>
                <p className="text-[11px] text-ink-mute mt-0.5">{axis.hint}</p>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={vector[axis.id] ?? 50}
                  onChange={(e) => updateAxis(axis.id, Number(e.target.value))}
                  className="mt-2 w-full accent-[color:var(--color-gold)]"
                  aria-label={axis.label}
                />
              </div>
            ))}
            <button
              onClick={submit}
              disabled={loading}
              className="liquid-glass-strong mt-4 w-full rounded-full px-5 py-3 text-sm font-medium text-ink hover:text-gold transition-colors disabled:opacity-50"
            >
              {loading ? "Descifrando…" : "Descifrar mi fragancia"}
            </button>
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
                  <p className="mt-3 text-xs text-ink-mute uppercase tracking-wider">{r.brand}</p>
                  <p className="font-display italic text-xl text-ink leading-tight">{r.name}</p>
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
