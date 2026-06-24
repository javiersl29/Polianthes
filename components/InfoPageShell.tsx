import Link from "next/link";
import { ReactNode } from "react";

type Section = {
  title: string;
  icon?: ReactNode;
  content: ReactNode;
};

export function InfoPageShell({
  eyebrow,
  title,
  intro,
  sections,
  cta
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  sections: Section[];
  cta?: { label: string; href: string };
}) {
  return (
    <main className="pt-24 sm:pt-32 pb-20 px-4 sm:px-6 lg:px-8 min-h-screen">
      <div className="max-w-3xl mx-auto">
        <p className="text-sm text-ink-mute">// {eyebrow}</p>
        <h1 className="mt-2 font-display italic text-4xl sm:text-5xl text-ink tracking-[-2px]">
          {title}
        </h1>
        {intro && (
          <p className="mt-4 text-ink-mute leading-relaxed max-w-2xl">{intro}</p>
        )}

        <div className="mt-8 space-y-4">
          {sections.map((s, i) => (
            <section key={i} className="liquid-glass rounded-2xl p-5 sm:p-6">
              <div className="flex items-center gap-2 mb-3">
                {s.icon && <span className="text-gold shrink-0">{s.icon}</span>}
                <h2 className="font-display italic text-xl sm:text-2xl text-ink">{s.title}</h2>
              </div>
              <div className="text-sm text-ink-mute leading-relaxed space-y-2">
                {s.content}
              </div>
            </section>
          ))}
        </div>

        {cta && (
          <div className="mt-8 text-center">
            <a
              href={cta.href}
              className="inline-block rounded-full bg-gold text-bg px-6 py-2.5 text-sm font-medium hover:bg-gold/90 transition-colors"
            >
              {cta.label}
            </a>
          </div>
        )}

        <div className="mt-8 text-center">
          <Link href="/" className="text-xs text-ink-mute hover:text-gold transition-colors">
            ← Volver al inicio
          </Link>
        </div>
      </div>
    </main>
  );
}
