export type Axis = {
  id: string;
  label: string;
  hint: string;
};

export type AxisSet = {
  id: "familias" | "mood";
  title: string;
  subtitle: string;
  axes: [Axis, Axis, Axis, Axis, Axis, Axis];
};

export const HEXAGON_SETS: Record<"familias" | "mood", AxisSet> = {
  familias: {
    id: "familias",
    title: "Por familias olfativas",
    subtitle: "Lenguaje técnico:花香, maderas, resinas. Mueve cada eje según la familia que más te atraiga.",
    axes: [
      { id: "floral", label: "Floral", hint: "Rosa, jazmín, peonía" },
      { id: "oriental", label: "Oriental", hint: "Ámbar, vainilla, especias" },
      { id: "amaderado", label: "Amaderado", hint: "Sándalo, cedro, vetiver" },
      { id: "chipre", label: "Chipre", hint: "Musgo de roble, pachulí" },
      { id: "citrico", label: "Cítrico", hint: "Bergamota, mandarina, pomelo" },
      { id: "gourmand", label: "Gourmand", hint: "Caramelo, café, cacao" }
    ]
  },
  mood: {
    id: "mood",
    title: "Por estado de ánimo",
    subtitle: "Lenguaje emocional: cómo quieres que se sienta quien lo perciba.",
    axes: [
      { id: "frescura", label: "Frescura", hint: "Limpio, ligero, diario" },
      { id: "misterio", label: "Misterio", hint: "Noche, profundidad" },
      { id: "romantico", label: "Romántico", hint: "Sensual, envolvente" },
      { id: "energia", label: "Energía", hint: "Vibrante, juvenil" },
      { id: "sofisticado", label: "Sofisticado", hint: "Pulcro, editorial" },
      { id: "nostalgico", label: "Nostálgico", hint: "Evocador, íntimo" }
    ]
  }
};

export type DecodeVector = Record<string, number>;

export function defaultVector(set: AxisSet): DecodeVector {
  return Object.fromEntries(set.axes.map((a) => [a.id, 50]));
}
