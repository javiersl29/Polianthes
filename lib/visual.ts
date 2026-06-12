/**
 * Helpers visuales compartidos entre admin y público. Mantener
 * consistencia con `app/admin/(panel)/imagenes/page.tsx` y la
 * home pública.
 */

export type Gender = "hombre" | "mujer" | "unisex";

export type GenderBadge = {
  label: string;
  short: string;
  icon: string;
  classes: string;
};

/**
 * Pill visual para mostrar el género de una fragancia.
 * - hombre  → azul cielo
 * - mujer   → rosa
 * - unisex  → ámbar
 * - null/"" → gris neutro
 */
export function genderBadge(gender: Gender | string | null | undefined): GenderBadge {
  switch (gender) {
    case "hombre":
      return {
        label: "Hombre",
        short: "♂",
        icon: "♂",
        classes: "bg-sky-400/15 text-sky-200 border-sky-300/30"
      };
    case "mujer":
      return {
        label: "Mujer",
        short: "♀",
        icon: "♀",
        classes: "bg-pink-400/15 text-pink-200 border-pink-300/30"
      };
    case "unisex":
      return {
        label: "Unisex",
        short: "⚥",
        icon: "⚥",
        classes: "bg-amber-400/15 text-amber-200 border-amber-300/30"
      };
    default:
      return {
        label: "Sin género",
        short: "?",
        icon: "?",
        classes: "bg-white/5 text-ink-mute border-white/10"
      };
  }
}
