import { isAuthenticated } from "@/lib/auth";
import { redirect } from "next/navigation";
import AdminSidebar from "@/components/AdminSidebar";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

async function getCurrentUser(): Promise<string | null> {
  const cookieModule = await import("next/headers");
  const cookie = cookieModule.cookies().get("polianthes_admin")?.value;
  if (!cookie) return null;
  const [id] = cookie.split(":");
  if (!id) return null;
  const result = await query<{ username: string }>(`SELECT username FROM admin_user WHERE id = $1`, [Number(id)]);
  return result.rows[0]?.username ?? null;
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!isAuthenticated()) {
    redirect("/admin/login");
  }
  const username = await getCurrentUser();
  return (
    <main className="pt-24 px-4 lg:px-8">
      <div className="max-w-7xl mx-auto flex gap-8">
        <AdminSidebar username={username} />
        <div className="flex-1 min-w-0 py-8">{children}</div>
      </div>
    </main>
  );
}
