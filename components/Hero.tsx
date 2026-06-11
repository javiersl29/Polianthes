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
        className="absolute inset-0 w-full h-full object-cover object-top z-0"
      />

      <div className="relative z-10 flex flex-col min-h-screen pt-24 sm:pt-28 px-4 sm:px-6">
        <div className="flex-1 flex flex-col items-center justify-center text-center max-w-3xl mx-auto">
          <motion.div
            initial={{ filter: "blur(10px)", opacity: 0, y: 20 }}
            animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
            transition={{ ...easeOut, delay: 0.25 }}
            className="mb-6 sm:mb-8"
          >
            <img
              src="/brand/Logo-Blanco.png"
              alt="Polianthes Parfums"
              width={560}
              height={240}
              className="h-40 sm:h-48 md:h-56 w-auto mx-auto"
            />
          </motion.div>

          <motion.div
            initial={{ filter: "blur(10px)", opacity: 0, y: 20 }}
            animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
            transition={{ ...easeOut, delay: 0.4 }}
            className="liquid-glass inline-flex items-center gap-2 sm:gap-3 rounded-full pl-1 pr-3 py-1"
          >
            <span className="bg-ink text-bg rounded-full px-2.5 sm:px-3 py-1 text-[10px] sm:text-xs font-semibold tracking-wide">Nuevo</span>
            <span className="text-xs sm:text-sm text-ink/90">Decodificador de fragancias con IA</span>
          </motion.div>

          <h1 className="mt-6 sm:mt-8 font-display italic text-ink text-4xl sm:text-5xl md:text-7xl lg:text-[5.5rem] leading-[0.85] tracking-[-2px] sm:tracking-[-3px] max-w-2xl">
            <BlurText text="La fragancia que te encuentra." />
          </h1>

          <motion.p
            initial={{ filter: "blur(10px)", opacity: 0, y: 20 }}
            animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
            transition={{ ...easeOut, delay: 0.8 }}
            className="mt-4 sm:mt-5 text-sm sm:text-base text-ink-mute max-w-xl font-light leading-snug px-2"
          >
            Una curaduría de perfumería de autor. Mueve los seis ejes del decodificador y deja que nuestra IA
            reconozca la fragancia que firma tu presencia.
          </motion.p>

          <motion.div
            initial={{ filter: "blur(10px)", opacity: 0, y: 20 }}
            animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
            transition={{ ...easeOut, delay: 1.1 }}
            className="mt-6 sm:mt-7 flex items-center gap-4 sm:gap-6 flex-wrap justify-center"
          >
            <a
              href="#decodificador"
              className="liquid-glass-strong inline-flex items-center gap-2 rounded-full px-4 sm:px-5 py-2.5 text-sm font-medium text-ink hover:text-gold transition-colors"
            >
              Descifrar mi fragancia
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M7 17 17 7" />
                <path d="M7 7h10v10" />
              </svg>
            </a>
            <a href="#catalogo" className="inline-flex items-center gap-2 text-sm text-ink/80 hover:text-gold transition-colors">
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
            className="mt-8 sm:mt-10 flex flex-wrap items-stretch justify-center gap-3 sm:gap-4"
          >
            <div className="liquid-glass rounded-2xl sm:rounded-3xl p-4 sm:p-5 flex-1 min-w-[140px] max-w-[230px] text-left">
              <div className="h-6 w-6 sm:h-7 sm:w-7 rounded-full border border-ink/40 grid place-items-center text-ink/80">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
              </div>
              <p className="mt-4 sm:mt-6 font-display italic text-3xl sm:text-4xl text-ink leading-none tracking-[-1px]">146</p>
              <p className="mt-1.5 sm:mt-2 text-[10px] sm:text-xs text-ink-mute font-light">Fragancias curadas</p>
            </div>
            <div className="liquid-glass rounded-2xl sm:rounded-3xl p-4 sm:p-5 flex-1 min-w-[140px] max-w-[230px] text-left">
              <div className="h-6 w-6 sm:h-7 sm:w-7 rounded-full border border-ink/40 grid place-items-center text-ink/80">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>
              </div>
              <p className="mt-4 sm:mt-6 font-display italic text-3xl sm:text-4xl text-ink leading-none tracking-[-1px]">6 ejes</p>
              <p className="mt-1.5 sm:mt-2 text-[10px] sm:text-xs text-ink-mute font-light">Familias y estado de ánimo</p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
