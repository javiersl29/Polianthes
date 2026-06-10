"use client";
import { motion } from "framer-motion";
import BlurText from "./BlurText";
import FadingVideo from "./FadingVideo";

const HERO_VIDEO = "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260418_080021_d598092b-c4c2-4e53-8e46-94cf9064cd50.mp4";

const easeOut = { duration: 0.8, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] };

export default function Hero() {
  return (
    <section className="relative min-h-screen w-full overflow-hidden">
      <FadingVideo
        src={HERO_VIDEO}
        scale={1.2}
        className="absolute left-1/2 top-0 -translate-x-1/2 object-cover object-top z-0"
      />

      <div className="relative z-10 flex flex-col min-h-screen pt-28 px-4">
        <div className="flex-1 flex flex-col items-center justify-center text-center max-w-3xl mx-auto">
          <motion.div
            initial={{ filter: "blur(10px)", opacity: 0, y: 20 }}
            animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
            transition={{ ...easeOut, delay: 0.4 }}
            className="liquid-glass inline-flex items-center gap-3 rounded-full pl-1 pr-3 py-1"
          >
            <span className="bg-ink text-bg rounded-full px-3 py-1 text-xs font-semibold tracking-wide">Nuevo</span>
            <span className="text-sm text-ink/90">Decodificador de fragancias con IA — disponible</span>
          </motion.div>

          <h1 className="mt-8 font-display italic text-ink text-5xl md:text-7xl lg:text-[5.5rem] leading-[0.85] tracking-[-3px] max-w-2xl">
            <BlurText text="La fragancia que te encuentra." />
          </h1>

          <motion.p
            initial={{ filter: "blur(10px)", opacity: 0, y: 20 }}
            animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
            transition={{ ...easeOut, delay: 0.8 }}
            className="mt-5 text-sm md:text-base text-ink-mute max-w-xl font-light leading-snug"
          >
            Una curaduría de perfumería de autor. Mueve los seis ejes del decodificador y deja que nuestra IA
            reconozca la fragancia que firma tu presencia.
          </motion.p>

          <motion.div
            initial={{ filter: "blur(10px)", opacity: 0, y: 20 }}
            animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
            transition={{ ...easeOut, delay: 1.1 }}
            className="mt-7 flex items-center gap-6"
          >
            <a
              href="#decodificador"
              className="liquid-glass-strong inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium text-ink hover:text-gold transition-colors"
            >
              Descifrar mi fragancia
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M7 17 17 7" />
                <path d="M7 7h10v10" />
              </svg>
            </a>
            <a href="#catalogo" className="inline-flex items-center gap-2 text-sm text-ink/80 hover:text-gold">
              Explorar catálogo
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M6 4l14 8-14 8z" />
              </svg>
            </a>
          </motion.div>

          <motion.div
            initial={{ filter: "blur(10px)", opacity: 0, y: 20 }}
            animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
            transition={{ ...easeOut, delay: 1.3 }}
            className="mt-10 flex flex-wrap items-stretch justify-center gap-4"
          >
            <div className="liquid-glass rounded-3xl p-5 w-[230px] text-left">
              <div className="h-7 w-7 rounded-full border border-ink/40 grid place-items-center text-ink/80">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
              </div>
              <p className="mt-6 font-display italic text-4xl text-ink leading-none tracking-[-1px]">146</p>
              <p className="mt-2 text-xs text-ink-mute font-light">Fragancias curadas en el catálogo</p>
            </div>
            <div className="liquid-glass rounded-3xl p-5 w-[230px] text-left">
              <div className="h-7 w-7 rounded-full border border-ink/40 grid place-items-center text-ink/80">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>
              </div>
              <p className="mt-6 font-display italic text-4xl text-ink leading-none tracking-[-1px]">6 ejes</p>
              <p className="mt-2 text-xs text-ink-mute font-light">Familias olfativas y estado de ánimo</p>
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ filter: "blur(10px)", opacity: 0, y: 20 }}
          animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
          transition={{ ...easeOut, delay: 1.4 }}
          className="flex flex-col items-center gap-4 pb-10"
        >
          <div className="liquid-glass rounded-full px-3.5 py-1 text-xs text-ink/90">
            Casas que confluyen en Polianthes
          </div>
          <div className="font-display italic text-ink text-2xl md:text-3xl tracking-tight flex flex-wrap items-center justify-center gap-x-12 gap-y-3">
            <span>Chanel</span>
            <span>Tom Ford</span>
            <span>Le Labo</span>
            <span>Xerjoff</span>
            <span>Kilian</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
