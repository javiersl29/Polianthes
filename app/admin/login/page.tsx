import { isAuthenticated } from "@/lib/auth";
import { redirect } from "next/navigation";
import LoginForm from "../LoginForm";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  if (isAuthenticated()) redirect("/admin");
  return (
    <main className="pt-28 pb-20 px-4">
      <div className="max-w-3xl mx-auto">
        <p className="text-sm text-ink-mute">// Panel de super-usuario</p>
        <h1 className="mt-2 font-display italic text-5xl text-ink tracking-[-2px]">Administración</h1>
        <p className="mt-6 text-ink-mute">Inicia sesión para configurar la IA y el catálogo.</p>
        <LoginForm />
      </div>
    </main>
  );
}
