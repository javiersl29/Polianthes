# Polianthes

Web de venta de perfumería de autor. **Next.js 14 + Postgres + OpenAI-compatible**.

## Stack
- Next.js 14 (App Router), TypeScript, Tailwind, Framer Motion, `pg`.
- Postgres en Railway (variable `DATABASE_URL`).
- API de IA **compatible con OpenAI** (OpenAI, Groq, Together, OpenRouter, etc.).

## Estructura
```
app/                # Rutas (App Router)
  api/              # Endpoints: /decode, /search, /enrich, /admin/*
  admin/            # Panel de super-usuario
  fragancias/[slug] # Detalle
  page.tsx          # Home
components/         # Hero, Decoder, Catalog, Capabilities, FadingVideo, BlurText
lib/                # db, auth, llm, ai-config, catalog, decoder, fragrances
db/schema.sql       # Esquema Postgres
data/catalog.csv    # Catálogo (146 fragancias)
scripts/            # seed, migrate, admin (CLI con tsx)
```

## Desarrollo local
```bash
npm install
cp .env.example .env.local
# Edita .env.local con DATABASE_URL (puedes usar el proxy público de Railway)
npm run dev
```

## Bootstrap en Railway (producción)
1. Asegúrate de que `DATABASE_URL` esté como reference variable en el servicio `web` apuntando a `Postgres`.
2. Aplica el schema, siembra el catálogo y crea el admin inicial con:
   ```bash
   curl -X POST https://web-production-529650.up.railway.app/api/bootstrap \
        -H "x-bootstrap-secret: $BOOTSTRAP_SECRET"
   ```
   (Por defecto `BOOTSTRAP_SECRET=polianthes-bootstrap`. Cámbialo en el panel para producción.)
3. Entra a `/admin` con las credenciales configuradas vía `ADMIN_USERNAME` y `ADMIN_PASSWORD` (por defecto `admin` / `polianthes`).
4. Configura el endpoint IA en `/admin/config`.

## Variables de entorno
| Var | Descripción |
|---|---|
| `DATABASE_URL` | Cadena de conexión Postgres (ya inyectada por Railway) |
| `OPENAI_API_KEY` | (opcional) Default; también configurable vía panel admin |
| `OPENAI_BASE_URL` | (opcional) Default `https://api.openai.com/v1` |
| `OPENAI_MODEL` | (opcional) Default `gpt-4o-mini` |
| `PEXELS_API_KEY` | API key de Pexels para búsqueda de imágenes. Si no, usa Wikimedia Commons |
| `TAVILY_API_KEY` | (Opcional) Búsqueda web usada para enriquecer fragancias con notas reales. Si no, se apoya solo en el conocimiento del LLM. |
| `SERPER_API_KEY` | Alternativa a Tavily (Google Serper). Se usa si TAVILY no está configurada. |
| `ADMIN_USERNAME` | Usuario inicial del panel |
| `ADMIN_PASSWORD` | Contraseña inicial del panel |
| `ADMIN_SESSION_SECRET` | Firma HMAC de la cookie de sesión |
| `BOOTSTRAP_SECRET` | Secreto para `/api/bootstrap` |

## Despliegue
Push a `main` → redespliegue automático en Railway.
