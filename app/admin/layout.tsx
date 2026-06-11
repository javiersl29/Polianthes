export const dynamic = "force-dynamic";

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  // Passthrough: la guarda se hace en app/admin/(panel)/layout.tsx
  // para no atrapar a /admin/login (que está fuera del route group).
  return <>{children}</>;
}
