import { isAuthenticated } from "@/lib/auth";
import AvisosClient from "./AvisosClient";

export const dynamic = "force-dynamic";

export default async function AvisosPage() {
  if (!isAuthenticated()) {
    return <div className="p-8 text-sm text-ink-mute">No autorizado.</div>;
  }
  return <AvisosClient />;
}
