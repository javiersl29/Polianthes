/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "var(--color-ink)",
        "ink-mute": "var(--color-ink-mute)",
        gold: "var(--color-gold)",
        "gold-soft": "var(--color-gold-soft)",
        bg: "var(--color-bg)",
        "bg-elev": "var(--color-bg-elev)",
        line: "var(--color-line)",
        paper: "var(--color-paper)",
        "paper-ink": "var(--color-paper-ink)"
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"]
      },
      borderRadius: {
        DEFAULT: "9999px"
      }
    }
  },
  plugins: []
};
