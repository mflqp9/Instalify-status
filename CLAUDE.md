@AGENTS.md

# Instalify Status (status.instalify.app)

Public status page for Instalify users. Next.js 16 (Cache Components on), React 19,
Tailwind 3. Separate from the Instalify repo on purpose: it must stay up and readable
when Instalify itself is not.

Run: `npm run dev` (port **5200**). Typecheck: `npm run typecheck`.

## Rules the owner set (2026-11-02)

- **No browser storage.** Nothing goes in localStorage, sessionStorage or IndexedDB.
  The board lives in memory; the open section is the URL hash. The only thing kept
  is the light/dark choice, in a `theme` cookie (ThemeToggle.tsx + the inline
  script in layout.tsx). `__next_debug_channel` in IndexedDB is Next's dev overlay
  and does not exist in a production build.
- **Every platform shows a green tick when fine, a cross or "!" when not**
  (`StatusGlyph` in components/ui.tsx). Platform tiles sit above the section
  navigation; on laptops the navigation is a sidebar, on phones a scrolling row.
- **Database & Redis have their own section**, checked through the Instalify API.

## How it works

- `src/lib/status/board.ts` gathers everything in one `use cache` function with
  `cacheLife({ stale: 30, revalidate: 60, expire: 600 })`. Both the page and
  `/api/status` (which the page polls every minute) read it, so providers are asked
  at most about once a minute however many people are watching. Do not make it
  uncached: during an outage everyone opens this page at once.
- One adapter per status vendor, all normalised to `src/lib/status/types.ts`:
  - `statuspage.ts` — Atlassian Statuspage (Cloudflare, Vercel)
  - `incidentio.ts` — incident.io widget + compatible incident feed (Supabase)
  - `railway.ts` — Railway's own `status.railway.com/api/status`
  - `instalify.ts` — `instalify.app` and `api.instalify.app/api/health?db=1&redis=1`
- **No credentials.** The database and Redis are read through the API's public
  health route. Never give this project a DATABASE_URL or REDIS_URL.
- `src/config/providers.ts` says which components Instalify depends on (`focus`),
  which incident titles are about other places (`regional`) or unused features
  (`unused`). The page leads with the focus status and still shows each provider's
  own headline. If a provider renames components, the focus list stops matching and
  the adapter falls back to the provider's headline (and logs a warning) — fix the
  list rather than removing the fallback.
- Times are Pakistan time, formatted from numeric parts (components/time.ts) so the
  server and browser print identical text.

## Facts the config rests on (checked 2026-11-02)

- instalify.app / admin.instalify.app: Cloudflare Workers (OpenNext, R2 cache),
  Karachi edge.
- api.instalify.app and Redis: Railway, Southeast Asia (Singapore) — `x-railway-edge: sin1`,
  DB round trip ~3 ms.
- Database: Supabase ap-southeast-1.
- Vercel: business subdomain sites (the separate `../Subdomain` project).

If any of these move, update `focus` and the role/impact text in providers.ts.

## Deploying

Deploy on **Vercel** (not Cloudflare), so the status page stays up when the
Cloudflare-hosted app is down. Root directory `Instalify-status`, no environment
variables. Add the domain `status.instalify.app`; in Cloudflare DNS a CNAME
`status` → `cname.vercel-dns.com`, DNS only (grey cloud).
