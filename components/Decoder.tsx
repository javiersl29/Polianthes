"use client";
import { useEffect, useMemo, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HEXAGON_SETS, AxisSet, DecodeVector, defaultVector } from "@/lib/decoder";

type Gender = "hombre" | "mujer" | "unisex";
type SetId = "familias" | "mood" | "referencia";
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
type FragranceOption = {
  slug: string;
  brand: string;
  name: string;
  full_name: string;
  image_url: string | null;
  family: string | null;
};

const HEX_SIZE = 360;
const RADIUS = HEX_SIZE / 2 - 56;
const CENTER = HEX_SIZE / 2;
const LABEL_RADIUS = RADIUS + 30;

const THINKING_LINES = [
  "Leyendo tu afinidad…",
  "Comparando con 146 fragancias curadas…",
  "Calculando distancias en el espacio olfativo…",
  "Entrevistando a las fragancias candidatas…",
  "Componiendo tu selección personal…"
];

const COUNT_OPTIONS = [3, 5, 7, 10];

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
  const [setId, setSetId] = useState<SetId>("familias");
  const [vector, setVector] = useState<DecodeVector>(() => defaultVector(HEXAGON_SETS.familias));
  const [active, setActive] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(HEXAGON_SETS.familias.axes.map((a) => [a.id, true]))
  );
  const [gender, setGender] = useState<Gender>("unisex");
  const [mode, setMode] = useState<"fast" | "rich">("rich");
  const [count, setCount] = useState(5);
  const [loading, setLoading] = useState(false);
  const [thinkingIdx, setThinkingIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Recommendation[]>([]);
  const [reflection, setReflection] = useState<string | null>(null);
  const [referenceSlug, setReferenceSlug] = useState<string | null>(null);

  const [fragrances, setFragrances] = useState<FragranceOption[]>([]);
  const [refSearch, setRefSearch] = useState("");
  const [refDropdownOpen, setRefDropdownOpen] = useState(false);
  const [selectedRef, setSelectedRef] = useState<FragranceOption | null>(null);
  const refInputRef = useRef<HTMLInputElement>(null);
  const refContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!refDropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (refContainerRef.current && !refContainerRef.current.contains(e.target as Node)) {
        setRefDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [refDropdownOpen]);

  useEffect(() => {
    fetch("/api/fragrances")
      .then((r) => r.json())
      .then((data) => setFragrances(data.items ?? []))
      .catch(() => {});
  }, []);

  const currentSet: AxisSet = HEXAGON_SETS[setId === "referencia" ? "familias" : setId];

  useEffect(() => {
    if (setId !== "referencia") {
      setActive(Object.fromEntries(currentSet.axes.map((a) => [a.id, true])));
    }
  }, [setId, currentSet]);

  useEffect(() => {
    if (!loading) return;
    const t = setInterval(() => setThinkingIdx((i) => (i + 1) % THINKING_LINES.length), 900);
    return () => clearInterval(t);
  }, [loading]);

  const values = currentSet.axes.map((a) => (active[a.id] ? vector[a.id] ?? 50 : 0));

  const updateAxis = (id: string, v: number) => {
    setVector((prev) => ({ ...prev, [id]: Math.max(0, Math.min(100, Math.round(v))) }));
  };
  const toggleAxis = (id: string) => {
    setActive((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const switchSet = (next: SetId) => {
    setSetId(next);
    if (next !== "referencia") {
      setVector(defaultVector(HEXAGON_SETS[next]));
      setActive(Object.fromEntries(HEXAGON_SETS[next].axes.map((a) => [a.id, true])));
    }
    setResults([]);
    setError(null);
    setReflection(null);
    setReferenceSlug(null);
    setSelectedRef(null);
    setRefSearch("");
  };

  const filteredFragrances = useMemo(() => {
    if (!refSearch.trim()) return fragrances.slice(0, 50);
    const terms = refSearch.toLowerCase().split(/\s+/).filter(Boolean);
    return fragrances.filter((f) => {
      const text = `${f.full_name} ${f.brand} ${f.family ?? ""}`.toLowerCase();
      return terms.every((t) => text.includes(t));
    }).slice(0, 50);
  }, [fragrances, refSearch]);

  const selectReference = (f: FragranceOption) => {
    setSelectedRef(f);
    setReferenceSlug(f.slug);
    setRefSearch(f.full_name);
    setRefDropdownOpen(false);
  };

  const clearReference = () => {
    setSelectedRef(null);
    setReferenceSlug(null);
    setRefSearch("");
    setRefDropdownOpen(false);
  };

  const submit = async () => {
    if (setId === "referencia" && !referenceSlug) {
      setError("Selecciona una fragancia de referencia.");
      return;
    }
    setLoading(true);
    setThinkingIdx(0);
    setError(null);
    setResults([]);
    setReflection(null);

    const apiSetId = setId === "referencia" ? "familias" : setId;
    const effectiveVector: DecodeVector = {};
    if (setId !== "referencia") {
      for (const a of currentSet.axes) {
        effectiveVector[a.id] = active[a.id] ? vector[a.id] ?? 50 : 0;
      }
    }

    try {
      const res = await fetch("/api/decode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          set: apiSetId,
          vector: effectiveVector,
          gender,
          mode,
          count,
          reference_slug: referenceSlug || undefined
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo descifrar la fragancia");
      setResults(data.recommendations ?? []);
      setReflection(data.reflection ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  const hexPath = useMemo(() => polygonPoints(values), [values]);

  const setTabs: { id: SetId; label: string }[] = [
    { id: "familias", label: "Por familias" },
    { id: "mood", label: "Por estado de ánimo" },
    { id: "referencia", label: "Por referencia" }
  ];

  return (
    <section id="decodificador" className="relative py-20 sm:py-32 px-4 overflow-hidden">
      <HexBackground />

      <div className="relative max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="flex flex-col items-center text-center gap-3 sm:gap-4"
        >
          <p className="text-sm text-ink-mute">// Decodificador</p>
          <h2 className="font-display italic text-ink text-4xl sm:text-5xl md:text-7xl leading-[0.9] tracking-[-2px] sm:tracking-[-3px] max-w-3xl">
            Descifra<br />tu fragancia
          </h2>
          <p className="text-ink-mute max-w-xl mt-1 sm:mt-2 text-sm sm:text-base px-2">
            {setId === "referencia"
              ? "Elige una fragancia que ya conoces y te gusta. Encontraremos otras con la misma composición aromática."
              : "Activa los ejes que te interesan, ajústalos a tu gusto y deja que la IA reflexione sobre tu mapa olfativo."
            }
          </p>
        </motion.div>

        <div className="mt-8 sm:mt-10 space-y-2 sm:space-y-3 px-2">
          <div className="liquid-glass inline-flex items-center rounded-full p-1 sm:p-1.5 w-full sm:w-auto justify-center flex-wrap gap-y-1">
            {setTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => switchSet(tab.id)}
                className={`flex-1 sm:flex-none px-3 sm:px-4 py-1.5 text-xs sm:text-sm rounded-full transition-colors ${
                  setId === tab.id ? "bg-ink text-bg" : "text-ink/80 hover:text-gold"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2 sm:gap-3">
            <div className="liquid-glass inline-flex items-center rounded-full p-1 sm:p-1.5 flex-1 sm:flex-none justify-center" role="group" aria-label="Género">
              {(["hombre", "mujer", "unisex"] as Gender[]).map((g) => (
                <button
                  key={g}
                  onClick={() => setGender(g)}
                  className={`flex-1 sm:flex-none px-3 sm:px-4 py-1.5 text-xs sm:text-sm rounded-full transition-colors capitalize ${
                    gender === g ? "bg-gold text-bg" : "text-ink/80 hover:text-gold"
                  }`}
                  aria-pressed={gender === g}
                >
                  {g}
                </button>
              ))}
            </div>

            <div className="liquid-glass inline-flex items-center rounded-full p-1 sm:p-1.5 flex-1 sm:flex-none justify-center gap-1">
              <span className="text-[10px] sm:text-xs text-ink-mute px-1 hidden sm:inline">Cant.</span>
              {COUNT_OPTIONS.map((n) => (
                <button
                  key={n}
                  onClick={() => setCount(n)}
                  className={`w-8 sm:w-9 h-8 sm:h-9 text-xs sm:text-sm rounded-full transition-colors ${
                    count === n ? "bg-ink/60 text-ink" : "text-ink/60 hover:text-gold"
                  }`}
                  aria-label={`${n} recomendaciones`}
                  aria-pressed={count === n}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {setId === "referencia" ? (
            <motion.div
              key="reference"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.4 }}
              className="mt-10 sm:mt-14 max-w-lg mx-auto"
            >
              <div className="liquid-glass rounded-2xl p-5 sm:p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-8 w-8 rounded-full bg-gold/10 grid place-items-center">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gold">
                      <path d="M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7Z" />
                      <path d="M9 22h6" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Tu fragancia favorita</p>
                    <p className="text-[11px] text-ink-mute">Busca la fragancia que ya conoces y amas</p>
                  </div>
                </div>

                {selectedRef ? (
                  <div className="flex items-center gap-3 liquid-glass rounded-xl p-3">
                    <div className="h-12 w-12 rounded-lg bg-bg-elev overflow-hidden grid place-items-center shrink-0">
                      {selectedRef.image_url ? (
                        <img src={selectedRef.image_url} alt={selectedRef.full_name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="font-display italic text-gold text-lg">{selectedRef.brand[0]}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] text-ink-mute uppercase tracking-wider">{selectedRef.brand}</p>
                      <p className="font-display italic text-lg text-ink truncate">{selectedRef.name}</p>
                      {selectedRef.family && <p className="text-[10px] text-gold">{selectedRef.family}</p>}
                    </div>
                    <button onClick={clearReference} className="text-ink-mute hover:text-gold transition-colors p-2" aria-label="Quitar referencia">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                    </button>
                  </div>
                ) : (
                  <div className="relative" ref={refContainerRef}>
                    <div className="liquid-glass rounded-xl flex items-center gap-2 px-3 py-2.5 min-h-[48px]">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-ink-mute shrink-0"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
                      <input
                        ref={refInputRef}
                        value={refSearch}
                        onChange={(e) => { setRefSearch(e.target.value); setRefDropdownOpen(true); }}
                        onFocus={() => setRefDropdownOpen(true)}
                        placeholder="Buscar fragancia…"
                        className="flex-1 bg-transparent outline-none text-sm placeholder:text-ink-mute min-w-0"
                      />
                    </div>

                    <AnimatePresence>
                      {refDropdownOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.2 }}
                          className="absolute z-20 left-0 right-0 mt-1 liquid-glass-strong rounded-xl max-h-[320px] overflow-y-auto"
                        >
                          <div className="sticky top-0 z-10 bg-bg-elev/90 backdrop-blur-sm px-3 py-1.5 text-[10px] text-ink-mute flex items-center justify-between">
                            <span>{refSearch.trim() ? `${filteredFragrances.length} resultado${filteredFragrances.length === 1 ? "" : "s"}` : `${fragrances.length} fragancias`}</span>
                            {refSearch.trim() && filteredFragrances.length > 50 && <span>Mostrando 50 de {filteredFragrances.length}</span>}
                          </div>
                          {filteredFragrances.length === 0 ? (
                            <div className="px-4 py-6 text-center text-sm text-ink-mute">
                              <p>No encontramos coincidencias.</p>
                              <p className="mt-1 text-xs">Intenta con otro nombre o marca.</p>
                            </div>
                          ) : (
                            filteredFragrances.map((f) => (
                              <button
                                key={f.slug}
                                onClick={() => selectReference(f)}
                                className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-white/5 transition-colors"
                              >
                                <div className="h-10 w-10 rounded-lg bg-bg-elev overflow-hidden grid place-items-center shrink-0">
                                  {f.image_url ? (
                                    <img src={f.image_url} alt={f.full_name} className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="font-display italic text-gold text-sm">{f.brand[0]}</span>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-[10px] text-ink-mute uppercase tracking-wider">{f.brand}</p>
                                  <p className="text-sm text-ink truncate">{f.name}</p>
                                </div>
                                {f.family && (
                                  <span className="text-[10px] text-gold shrink-0 ml-auto">{f.family}</span>
                                )}
                              </button>
                            ))
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                <p className="mt-4 text-[11px] text-ink-mute leading-relaxed">
                  Se buscarán fragancias con la misma composición aromática (familias y vectores olfativos)
                  que tu referencia, excluyendo la fragancia misma.
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key={setId}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.4 }}
              className="mt-10 sm:mt-14 grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-8 sm:gap-12 items-center"
            >
              <div className="relative mx-auto w-full max-w-[360px]">
                <svg viewBox={`0 0 ${HEX_SIZE} ${HEX_SIZE}`} className="block w-full h-auto relative z-10">
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

                  {[100, 75, 50, 25].map((p) => (
                    <polygon
                      key={p}
                      points={polygonPoints(Array(currentSet.axes.length).fill(p))}
                      fill="none"
                      stroke="rgba(255,255,255,0.07)"
                      strokeWidth="1"
                    />
                  ))}

                  {currentSet.axes.map((axis, i) => {
                    const angle = (360 / currentSet.axes.length) * i;
                    const p = polar(angle, RADIUS);
                    return (
                      <line key={`line-${axis.id}`} x1={CENTER} y1={CENTER} x2={p.x} y2={p.y}
                        stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
                    );
                  })}

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

                  {currentSet.axes.map((axis, i) => {
                    const angle = (360 / currentSet.axes.length) * i;
                    const isActive = active[axis.id];
                    const pos = polar(angle, (values[i] ?? 0) / 100 * RADIUS);
                    return (
                      <motion.g key={`pt-${axis.id}`} animate={{ opacity: isActive ? 1 : 0.25 }}>
                        <motion.circle
                          cx={pos.x} cy={pos.y}
                          r={isActive ? 8 : 5}
                          fill={isActive ? "oklch(0.82 0.13 85)" : "rgba(255,255,255,0.4)"}
                          stroke="oklch(0.97 0.01 90)" strokeWidth="1.5"
                          animate={{ cx: pos.x, cy: pos.y }}
                          transition={{ type: "spring", stiffness: 200, damping: 20 }}
                        />
                      </motion.g>
                    );
                  })}

                  {currentSet.axes.map((axis, i) => {
                    const angle = (360 / currentSet.axes.length) * i;
                    const p = polar(angle, LABEL_RADIUS);
                    const isActive = active[axis.id];
                    return (
                      <text
                        key={`lbl-${axis.id}`}
                        x={p.x} y={p.y}
                        fill={isActive ? "oklch(0.97 0.01 90)" : "rgba(255,255,255,0.4)"}
                        fontSize="12" fontWeight="600"
                        fontFamily="var(--font-body), system-ui, sans-serif"
                        textAnchor="middle" dominantBaseline="middle"
                        style={{ letterSpacing: "0.12em", textTransform: "uppercase" }}
                      >
                        {axis.label}
                      </text>
                    );
                  })}
                </svg>
              </div>

              <div className="space-y-3">
                {currentSet.axes.map((axis) => {
                  const isActive = active[axis.id];
                  return (
                    <div
                      key={axis.id}
                      className={`liquid-glass rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3 transition-opacity ${isActive ? "" : "opacity-50"}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <label className="flex items-center gap-2 cursor-pointer select-none min-h-[44px]">
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
                      <p className="text-[11px] text-ink-mute mt-0.5 hidden sm:block">{axis.hint}</p>
                      <input
                        type="range" min={0} max={100}
                        disabled={!isActive}
                        value={vector[axis.id] ?? 50}
                        onChange={(e) => updateAxis(axis.id, Number(e.target.value))}
                        className="mt-1 sm:mt-2 w-full disabled:opacity-40"
                        aria-label={axis.label}
                      />
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-6 sm:mt-8 max-w-lg mx-auto space-y-3">
          <div className="liquid-glass rounded-full p-1 flex items-center">
            <button
              onClick={() => setMode("fast")}
              className={`flex-1 px-4 py-2.5 text-xs sm:text-sm rounded-full transition-colors min-h-[44px] ${
                mode === "fast" ? "bg-ink text-bg" : "text-ink/80 hover:text-gold"
              }`}
            >
              Decodificación rápida
            </button>
            <button
              onClick={() => setMode("rich")}
              className={`flex-1 px-4 py-2.5 text-xs sm:text-sm rounded-full transition-colors min-h-[44px] ${
                mode === "rich" ? "bg-gold text-bg" : "text-ink/80 hover:text-gold"
              }`}
            >
              Decodificación con IA
            </button>
          </div>

          <button
            onClick={submit}
            disabled={loading}
            className="liquid-glass-strong w-full rounded-full px-5 py-3.5 sm:py-3 text-sm font-medium text-ink hover:text-gold transition-colors disabled:opacity-50 flex items-center justify-center gap-3 min-h-[48px]"
          >
            {loading ? (
              <>
                <ThinkingVisual />
                <span key={thinkingIdx} className="animate-fade-in">{THINKING_LINES[thinkingIdx]}</span>
              </>
            ) : (
              mode === "fast" ? "Decodificar rápidamente" : "Descifrar mi fragancia"
            )}
          </button>
          <p className="text-[10px] text-ink-mute text-center px-2">
            {mode === "fast"
              ? "Ranking numérico instantáneo. Sin IA."
              : "La IA reflexiona sobre tu mapa olfativo y propone una selección personalizada."
            }
          </p>
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
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="mt-12 sm:mt-16"
          >
            {reflection && (
              <motion.div
                initial={{ opacity: 0, y: 20, filter: "blur(8px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ duration: 0.7, ease: "easeOut" }}
                className="liquid-glass rounded-2xl sm:rounded-3xl p-6 sm:p-8 md:p-10 mb-8 sm:mb-10 max-w-3xl mx-auto text-center"
              >
                <p className="text-[11px] uppercase tracking-[0.3em] text-gold">Inspiración</p>
                <p className="mt-3 sm:mt-4 font-display italic text-xl sm:text-2xl md:text-3xl text-ink leading-snug">
                  {reflection}
                </p>
                <p className="mt-3 sm:mt-4 text-[10px] text-ink-mute">
                  Polianthes interpreta tu mapa olfativo. Las fragancias son versiones inspiradas en las composiciones originales.
                </p>
              </motion.div>
            )}

            <p className="text-center text-sm text-ink-mute mb-4 sm:mb-6">
              {results.length} recomendación{results.length === 1 ? "" : "es"} personalizada{results.length === 1 ? "" : "s"}
            </p>
            <div className={`grid gap-3 sm:gap-4 ${
              results.length <= 3 ? "grid-cols-2 sm:grid-cols-3 max-w-2xl mx-auto" :
              results.length <= 5 ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5" :
              results.length <= 7 ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" :
              "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
            }`}>
              {results.map((r, idx) => (
                <motion.a
                  key={r.slug}
                  href={`/fragancias/${r.slug}`}
                  initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  transition={{ delay: idx * 0.06, duration: 0.5, ease: "easeOut" }}
                  className="liquid-glass rounded-2xl sm:rounded-3xl p-3 sm:p-4 hover:text-gold transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-gold/5 group"
                >
                  <div className="aspect-[3/4] rounded-xl sm:rounded-2xl bg-bg-elev overflow-hidden grid place-items-center text-ink-mute text-xs">
                    {r.image_url ? (
                      <img src={r.image_url} alt={r.full_name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    ) : (
                      <span className="font-display italic text-gold text-3xl">{r.brand[0]}</span>
                    )}
                  </div>
                  <div className="mt-2 sm:mt-3 flex items-center justify-between gap-1">
                    <p className="text-[10px] sm:text-xs text-ink-mute uppercase tracking-wider truncate">{r.brand}</p>
                    <span className="liquid-glass rounded-full px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] text-ink/80 capitalize shrink-0">
                      {r.gender}
                    </span>
                  </div>
                  <p className="font-display italic text-base sm:text-xl text-ink leading-tight mt-0.5">{r.name}</p>
                  {typeof r.score === "number" && (
                    <p className="mt-0.5 sm:mt-1 text-[10px] text-gold">Afinidad {r.score}%</p>
                  )}
                  <p className="mt-1 sm:mt-2 text-[11px] sm:text-[12px] text-ink-mute leading-snug line-clamp-2">{r.reason}</p>
                </motion.a>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </section>
  );
}

function ThinkingVisual() {
  return (
    <span className="relative inline-flex items-center justify-center w-6 h-6" aria-hidden="true">
      <svg viewBox="0 0 32 32" className="absolute inset-0">
        <motion.polygon
          points="16,3 28,10 28,22 16,29 4,22 4,10"
          fill="none" stroke="oklch(0.82 0.13 85)" strokeWidth="1.5"
          strokeLinecap="round" strokeLinejoin="round"
          strokeDasharray="80 80"
          initial={{ strokeDashoffset: 0, rotate: 0 }}
          animate={{ strokeDashoffset: -160, rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: "16px 16px" }}
        />
        <motion.circle
          cx="16" cy="16" r="2" fill="oklch(0.82 0.13 85)"
          animate={{ r: [1.5, 3, 1.5], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        />
      </svg>
    </span>
  );
}

function HexBackground() {
  return (
    <div className="absolute inset-0 -z-0 overflow-hidden pointer-events-none">
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] sm:w-[900px] h-[500px] sm:h-[900px] rounded-full animate-hex-breathe"
        style={{
          background: "radial-gradient(closest-side, color-mix(in oklch, var(--color-gold) 12%, transparent), transparent 70%)",
          filter: "blur(30px)"
        }}
      />
      <svg className="absolute inset-0 w-full h-full opacity-30" preserveAspectRatio="none">
        <defs>
          <pattern id="hexGrid" width="48" height="48" patternUnits="userSpaceOnUse" patternTransform="rotate(0)">
            <path d="M24 4 L42 14 L42 34 L24 44 L6 34 L6 14 Z" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.6" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hexGrid)" />
      </svg>
      <style jsx>{`
        @keyframes hexBreathe {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.85; }
          50% { transform: translate(-50%, -50%) scale(1.08); opacity: 1; }
        }
        .animate-hex-breathe { animation: hexBreathe 9s ease-in-out infinite; }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(2px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fadeIn 0.4s ease-out; }
      `}</style>
    </div>
  );
}
