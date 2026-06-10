import { isAuthenticated } from "@/lib/auth";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default function AdminPage() {
  const authed = isAuthenticated();
  return (
    <main className="pt-28 pb-20 px-4">
      <div className="max-w-3xl mx-auto">
        <p className="text-sm text-ink-mute">// Panel de super-usuario</p>
        <h1 className="mt-2 font-display italic text-5xl text-ink tracking-[-2px]">Administración</h1>
        {authed ? (
          <p className="mt-6 text-ink-mute">Sesión activa. Usa el menú inferior.</p>
        ) : (
          <p className="mt-6 text-ink-mute">Inicia sesión para configurar la IA y el catálogo.</p>
        )}
        {!authed && <LoginForm />}
      </div>
    </main>
  );
}
