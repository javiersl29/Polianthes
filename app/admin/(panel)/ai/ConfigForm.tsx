"use client";
import { useEffect, useState } from "react";

type Config = {
  base_url: string | null;
  api_key: string | null;
  model: string;
  system_prompt: string | null;
  temperature: number;
};

export default function ConfigForm() {
  const [config, setConfig] = useState<Config | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("gpt-4o-mini");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [temperature, setTemperature] = useState(0.7);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/ai").then(async (r) => {
      if (!r.ok) return;
      const data = await r.json();
      setConfig(data.config);
      setBaseUrl(data.config.base_url ?? "");
      setModel(data.config.model);
      setSystemPrompt(data.config.system_prompt ?? "");
      setTemperature(data.config.temperature);
    });
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/admin/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ base_url: baseUrl || null, api_key: apiKey || undefined, model, system_prompt: systemPrompt, temperature })
    });
    setSaving(false);
    setMessage(res.ok ? "Configuración guardada" : "No se pudo guardar");
    if (res.ok) setApiKey("");
  };

  if (!config) return <p className="mt-8 text-ink-mute">Cargando…</p>;

  return (
    <form onSubmit={submit} className="mt-8 liquid-glass rounded-3xl p-6 space-y-4">
      <div>
        <label className="text-xs uppercase tracking-wider text-ink-mute">Base URL</label>
        <input
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="https://api.openai.com/v1"
          className="mt-1 w-full bg-transparent border-b border-line py-2 outline-none focus:border-gold"
        />
      </div>
      <div>
        <label className="text-xs uppercase tracking-wider text-ink-mute">API key</label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={config.api_key ? "Dejar en blanco para conservar la actual" : "sk-…"}
          className="mt-1 w-full bg-transparent border-b border-line py-2 outline-none focus:border-gold"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs uppercase tracking-wider text-ink-mute">Modelo</label>
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="mt-1 w-full bg-transparent border-b border-line py-2 outline-none focus:border-gold"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-ink-mute">Temperatura</label>
          <input
            type="number"
            step="0.05"
            min={0}
            max={1.5}
            value={temperature}
            onChange={(e) => setTemperature(Number(e.target.value))}
            className="mt-1 w-full bg-transparent border-b border-line py-2 outline-none focus:border-gold"
          />
        </div>
      </div>
      <div>
        <label className="text-xs uppercase tracking-wider text-ink-mute">Prompt del sistema</label>
        <textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={6}
          className="mt-1 w-full bg-bg-elev border border-line rounded-2xl p-3 outline-none focus:border-gold text-sm"
        />
      </div>
      <button
        disabled={saving}
        className="liquid-glass-strong rounded-full px-5 py-2.5 text-sm font-medium hover:text-gold transition-colors disabled:opacity-50"
      >
        {saving ? "Guardando…" : "Guardar"}
      </button>
      {message && <p className="text-sm text-ink-mute">{message}</p>}
    </form>
  );
}
