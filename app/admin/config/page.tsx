import { isAuthenticated } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function ConfigPage() {
  if (!isAuthenticated()) redirect("/admin");
  return (
    <main className="pt-28 pb-20 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="font-display italic text-4xl text-ink tracking-[-2px]">Configuración de IA</h1>
        <p className="mt-2 text-ink-mute text-sm">Endpoint compatible con OpenAI (OpenAI, Groq, Together, OpenRouter…)</p>
        <ConfigForm />
        <FragranceManager />
      </div>
    </main>
  );
}
