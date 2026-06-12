import { HEXAGON_SETS } from "@/lib/decoder";

type Axis = { id: string; label: string; hint?: string };

type Props = {
  /**
   * Vector de valores 0-100, una entrada por eje del set (6 ejes).
   * Las claves deben coincidir con los `id` de `HEXAGON_SETS`.
   */
  values: Record<string, number>;
  /**
   * "familias" muestra Floral/Oriental/Amaderado/Chipre/Cítrico/Gourmand.
   * "mood"     muestra Frescura/Misterio/Romántico/Energía/Sofisticado/Nostálgico.
   */
  setId: "familias" | "mood";
  /** Tamaño en px del cuadrado SVG. Default 280. */
  size?: number;
  /** Color del polígono. Default dorado. */
  fill?: string;
  /** Color del trazo del polígono. Default dorado claro. */
  stroke?: string;
  /** Etiqueta opcional sobre el gráfico. */
  caption?: string;
};

const POLYGON_INSET = 36; // espacio reservado para etiquetas externas

function polar(angleDeg: number, radius: number, center: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: center + radius * Math.cos(a), y: center + radius * Math.sin(a) };
}

function polygonPoints(values: number[], radius: number, center: number): string {
  return values
    .map((v, i) => {
      const angle = (360 / values.length) * i;
      const r = (Math.max(0, Math.min(100, v)) / 100) * radius;
      const p = polar(angle, r, center);
      return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
    })
    .join(" ");
}

/**
 * Visualizador hexagonal de un vector olfativo. Read-only: recibe
 * un mapa `id → 0..100` y dibuja el polígono con sus ejes. Usado
 * en la ficha de producto para mostrar la "huella" de la fragancia
 * tanto en familias como en mood/ocasión.
 */
export default function HexagonView({
  values,
  setId,
  size = 280,
  fill = "rgba(212, 175, 55, 0.18)",
  stroke = "rgba(212, 175, 55, 0.85)",
  caption
}: Props) {
  const set = HEXAGON_SETS[setId];
  const axes: Axis[] = set.axes;
  const center = size / 2;
  const radius = center - POLYGON_INSET;
  const labelRadius = radius + 18;

  // Gridlines: hexágonos concéntricos al 25/50/75/100%
  const gridLevels = [0.25, 0.5, 0.75, 1].map((m) => m * radius);

  return (
    <figure className="flex flex-col items-center gap-2">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width="100%"
        style={{ maxWidth: size }}
        className="overflow-visible"
        aria-label={`Mapa olfativo de ${set.title}`}
        role="img"
      >
        <defs>
          <linearGradient id={`hexFill-${setId}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgba(212, 175, 55, 0.32)" />
            <stop offset="100%" stopColor="rgba(212, 175, 55, 0.06)" />
          </linearGradient>
        </defs>

        {/* Gridlines hexagonales */}
        {gridLevels.map((r, i) => (
          <polygon
            key={`grid-${i}`}
            points={polygonPoints(
              Array(axes.length).fill((r / radius) * 100),
              radius,
              center
            )}
            fill="none"
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth={1}
          />
        ))}

        {/* Ejes (líneas del centro a cada vértice) */}
        {axes.map((axis, i) => {
          const angle = (360 / axes.length) * i;
          const p = polar(angle, radius, center);
          return (
            <line
              key={`axis-${axis.id}`}
              x1={center}
              y1={center}
              x2={p.x}
              y2={p.y}
              stroke="rgba(255, 255, 255, 0.08)"
              strokeWidth={1}
            />
          );
        })}

        {/* Polígono con los valores */}
        <polygon
          points={polygonPoints(axes.map((a) => values[a.id] ?? 50), radius, center)}
          fill={fill === "rgba(212, 175, 55, 0.18)" ? `url(#hexFill-${setId})` : fill}
          stroke={stroke}
          strokeWidth={1.6}
          strokeLinejoin="round"
        />

        {/* Puntos en cada vértice */}
        {axes.map((axis, i) => {
          const angle = (360 / axes.length) * i;
          const v = Math.max(0, Math.min(100, values[axis.id] ?? 50));
          const r = (v / 100) * radius;
          const p = polar(angle, r, center);
          return (
            <circle
              key={`pt-${axis.id}`}
              cx={p.x}
              cy={p.y}
              r={3.5}
              fill="rgba(212, 175, 55, 0.95)"
              stroke="rgba(0,0,0,0.4)"
              strokeWidth={0.5}
            />
          );
        })}

        {/* Etiquetas de cada eje */}
        {axes.map((axis, i) => {
          const angle = (360 / axes.length) * i;
          const p = polar(angle, labelRadius, center);
          const v = values[axis.id] ?? 50;
          return (
            <g key={`lbl-${axis.id}`}>
              <text
                x={p.x}
                y={p.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="11"
                fontWeight="500"
                fill="rgba(245, 245, 245, 0.95)"
              >
                {axis.label}
              </text>
              <text
                x={p.x}
                y={p.y + 12}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="9"
                fill="rgba(212, 175, 55, 0.8)"
              >
                {v}
              </text>
            </g>
          );
        })}
      </svg>
      {caption && (
        <figcaption className="text-[10px] sm:text-[11px] text-ink-mute text-center uppercase tracking-wider">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
