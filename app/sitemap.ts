import type { MetadataRoute } from "next";
import { listActiveFragranceSlugs } from "@/lib/fragrances";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://polianthes.shop";
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${base}/`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1
    },
    {
      url: `${base}/#decodificador`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8
    },
    {
      url: `${base}/#catalogo`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9
    },
    {
      url: `${base}/checkout`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5
    },
    {
      url: `${base}/cuenta`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.4
    }
  ];

  let fragranceRoutes: MetadataRoute.Sitemap = [];
  try {
    const frags = await listActiveFragranceSlugs();
    fragranceRoutes = frags.map((f) => ({
      url: `${base}/fragancias/${f.slug}`,
      lastModified: f.updated_at ?? now,
      changeFrequency: "weekly",
      priority: 0.7
    }));
  } catch {
    /* DB indisponible, solo devolver rutas estáticas */
  }

  return [...staticRoutes, ...fragranceRoutes];
}
