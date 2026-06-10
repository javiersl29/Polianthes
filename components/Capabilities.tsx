"use client";
import { motion } from "framer-motion";

const cards = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6"><path d="M5 21q-.825 0-1.412-.587T3 19V5q0-.825.588-1.412T5 3h14q.825 0 1.413.588T21 5v14q0 .825-.587 1.413T19 21H5Zm1-4h12l-3.75-5-3 4L9 13l-3 4Z" /></svg>
    ),
    title: "Curaduría",
    body: "146 fragancias seleccionadas por casas independientes y maisons de autor. Sin ruido, sin exceso.",
    tags: ["146 fragancias", "Casas de autor", "Edición curada", "Sin duplicados"]
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6"><path d="M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7Zm-2 18a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-1h-4v1Z" /></svg>
    ),
    title: "Notas",
    body: "Documentamos cada fragancia con sus notas de salida, corazón y fondo. Transparencia olfativa.",
    tags: ["Salida", "Corazón", "Fondo", "Español"]
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6"><path d="M12 2 4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6l-8-4Zm0 4.3 5 2.5v3.7c0 3.5-2.4 6.6-5 7.4-2.6-.8-5-3.9-5-7.4V8.8l5-2.5Z" /></svg>
    ),
    title: "Personalidad",
    body: "El decodificador transforma tu mood en cinco fragancias, con una justificación que se siente como una nota manuscrita.",
    tags: ["IA", "Cinco fragancias", "Justificación", "Mood & familia"]
  }
];

export default function Capabilities() {
  return (
    <section id="capacidades" className="relative py-32 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-12">
          <p className="text-sm text-ink-mute mb-4">// Capacidades</p>
          <h2 className="font-display italic text-ink text-5xl md:text-7xl leading-[0.9] tracking-[-3px]">
            Perfumería<br />traducida
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {cards.map((card, i) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
              whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ delay: i * 0.1, duration: 0.7, ease: "easeOut" }}
              className="liquid-glass rounded-3xl p-6 min-h-[360px] flex flex-col"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="liquid-glass h-11 w-11 rounded-2xl grid place-items-center text-ink">
                  {card.icon}
                </div>
                <div className="flex flex-wrap justify-end gap-1.5 max-w-[70%]">
                  {card.tags.map((t) => (
                    <span key={t} className="liquid-glass rounded-full px-3 py-1 text-[11px] text-ink/90">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex-1" />
              <h3 className="font-display italic text-ink text-3xl tracking-[-1px] leading-none">{card.title}</h3>
              <p className="mt-3 text-sm text-ink/90 font-light leading-snug max-w-[32ch]">{card.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
