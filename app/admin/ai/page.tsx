import ConfigForm from "./ConfigForm";

export const dynamic = "force-dynamic";

export default function AiConfigPage() {
  return (
    <div>
      <p className="text-sm text-ink-mute">// Configuración de IA</p>
      <h1 className="mt-2 font-display italic text-5xl text-ink tracking-[-2px]">Modelo de IA</h1>
      <p className="mt-3 text-ink-mute max-w-xl">
        Define el endpoint compatible con OpenAI (OpenAI, Groq, Together, OpenRouter…) y el prompt del sistema
        que guía al decodificador. La API key puede quedarse aquí; nunca se expone al cliente.
      </p>
      <ConfigForm />
    </div>
  );
}
