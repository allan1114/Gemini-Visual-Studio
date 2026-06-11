# CLAUDE.md

Guidance for AI assistants (and humans) working in this repository.

## What this is

**Gemini Visual Studio** is a client-only (no app server) React + TypeScript
creative suite for AI image generation, editing, avatars, prompt building, and a
local gallery. All AI and database calls are made **directly from the user's
browser**. It ships three ways from the same codebase:

- **GitHub Pages** static site (primary, sub-path `/Gemini-Visual-Studio/`)
- **Vercel** (root path `/`, plus one serverless edge function in `api/`)
- **Tauri** desktop app (macOS universal build), relative asset paths

Because the frontend is public and serverless, **there is no trusted backend to
hold secrets**. This constraint drives most of the architecture (per-user keys
in the browser, encryption-at-rest, Supabase RLS). Keep it in mind for every
change.

> The version of record is `package.json` `version` (currently **2.7.0**),
> re-exported as `APP_VERSION` in `constants.ts`. The READMEs and
> `src-tauri/tauri.conf.json` may lag — trust `package.json`.

## Tech stack

- **React 19** + **TypeScript** (strict), **Vite 5** bundler
- **Tailwind CSS 4** via `@tailwindcss/vite` (no `tailwind.config.js`;
  configured in `index.css`)
- **@google/genai** (Gemini SDK), **@supabase/supabase-js** (auth + cloud sync)
- **d3** (curves editor), **jszip** (gallery export), **lucide-react** + Font
  Awesome (CDN) icons, **motion** (animations)
- **Vitest** (`node` environment) for unit tests
- **Tauri 2** (Rust) for the desktop wrapper

## Commands

```bash
npm run dev            # Vite dev server at http://localhost:5173
npm run lint           # eslint . --ext .ts,.tsx  +  tsc --noEmit  (CI gate)
npm run lint:fix       # eslint --fix + prettier --write .
npm run format         # prettier --write .
npm test               # vitest (watch). Use: npm test -- --run  for one-shot
npm run test:coverage  # v8 coverage report
npm run build          # tsc && vite build -> dist/
npm run preview        # serve dist/ locally
npm run deploy         # gh-pages -d dist  (manual fallback; CI is primary)
npm run tauri:dev      # desktop dev
npm run tauri:build    # desktop build (use :build:mac for universal macOS)
```

**Before pushing, always run `npm run lint` and `npm test -- --run`** — both are
hard gates in the deploy workflow, and a pre-commit hook (`.husky/pre-commit`)
runs `lint-staged` (eslint --fix + prettier) on staged `*.ts/*.tsx`.

## Directory layout

```text
App.tsx                  # Root component: auth, view routing, global state, gallery
index.tsx / index.html   # Entry point + CSP / external stylesheet (Font Awesome) policy
constants.ts             # MODELS, PROVIDERS, STORAGE_KEYS, presets/filters, APP_VERSION
types.ts                 # Shared domain types + the View enum
components/               # UI; views are lazy-loaded from App.tsx
hooks/useImageSynthesis  # Image-generation orchestration hook used by views
services/                # Side-effecting layer (see below)
services/ai/             # Provider abstraction (Gemini / OpenAI-compatible / fal)
utils/                   # errorHandler, validation, rateLimiter, secureStore, toast, i18n
api/fal.ts               # Vercel edge function: same-origin proxy for fal.ai (CORS)
public/sw.js             # Service worker (GitHub Pages PWA cache, same-origin only)
supabase/policies.sql    # RLS policy template (documentation — not auto-applied)
src-tauri/               # Tauri (Rust) desktop shell + config + icons
.github/workflows/       # deploy-pages.yml (Pages), build-macos.yml (Tauri on v* tags)
```

## Architecture

### State & routing
`App.tsx` is the hub: it owns auth state, the active `View` (see the `View` enum
in `types.ts`), gallery entries, presets, usage stats, and sync status — all via
`useState`/`useEffect`, **no Redux/Zustand/router library**. Views are
code-split with `React.lazy` + `Suspense`. UI strings are bilingual (English /
繁體中文) via `utils/i18n.ts` and an inline `TRANSLATIONS` map; default language
is `zh`.

### AI provider abstraction — the most important seam
`services/ai/` decouples the UI from any single AI vendor. **Add new model
behavior here, not in components.**

- `types.ts` — the `AIProvider` interface every backend implements
  (`generateImage`, `editImage`, `inpaintImage`, `removeBackground`,
  `generateText`, `generateJson`, `testKey`) plus normalized request/result
  shapes.
- `providerFactory.ts` — `getActiveProvider()` resolves the endpoint and returns
  the right provider from a `registry` keyed by `ProviderType`.
- `endpointResolver.ts` — picks the active endpoint in priority order:
  (1) forced key → (2) active record in `localStorage` → (3)
  `VITE_GEMINI_API_KEY`. Throws the **`API_KEY_MISSING`** sentinel string when
  none found (matched downstream). Decrypts stored keys via `secureStore`.
- Providers: `GeminiProvider`, `OpenAICompatibleProvider`, `FALProvider`.
- `services/geminiService.ts` is the **facade** the app calls. It handles
  prompt validation, rate limiting, system instructions, and prompt
  expansion/metadata, then delegates to `getActiveProvider()`.

`ProviderType = 'gemini' | 'openai-compatible' | 'fal'`. Model ids and
per-provider defaults live in `constants.ts` (`MODELS`, `PROVIDERS`). Gemini
image models (`gemini-3-pro-image-preview`, `gemini-2.5-flash-image`) and the
free-tier Imagen 4 models are the defaults.

### Storage & sync
- `services/storageService.ts` — **IndexedDB** (`GeminiStudioDB`, v2 with a
  `timestamp` index) is the primary local store for gallery entries; falls back
  to localStorage. Has a background cloud-retry queue.
- `services/imageProcessingService.ts` — re-encodes images to WebP, caps
  dimensions (~1536px) before persisting.
- `services/syncOrchestrator.ts` / `syncService.ts` — bi-directional sync for
  logged-in users; guests stay local-only (`user.id === 'anon'`).
- `services/supabaseService.ts` / `authService.ts` / `dbService.ts` — Supabase
  client, auth (email + Google OAuth via PKCE), and `profiles` access. Supabase
  config can come from env vars **or** a `localStorage` override
  (`gvs_supabase_config`).

### Utilities (cross-cutting, used by every layer)
- `errorHandler.ts` — `ErrorHandler` normalizes errors to coded `ErrorInfo`.
- `validation.ts` — client-side input guards (`LIMITS`: 4000-char prompts,
  20 MB images). Defense-in-depth, not authoritative.
- `rateLimiter.ts` — token-bucket courtesy limiter to avoid burning quota.
- `secureStore.ts` — best-effort AES encryption-at-rest for API keys in
  localStorage, tagged `enc:v1:` with lazy plaintext fallback. **Obfuscation,
  not a vault** — a client-only app cannot hide a secret from same-origin JS.
- `toast.ts` — module-level pub/sub toast bus; the single subscriber is
  `<ToastHost/>` mounted at the app root. Call `showToast(msg, kind)` from
  anywhere.

## Conventions

- **TypeScript strict mode is on.** No implicit `any` in new code; reuse the
  shared types in `types.ts` and `services/ai/types.ts`.
- **Formatting is enforced** by Prettier (`.prettierrc.json`) + ESLint
  (`eslint.config.js`, flat config). Run `npm run lint:fix`; don't hand-format.
- **localStorage keys** go through `STORAGE_KEYS` in `constants.ts` (prefix
  `gvs_`). Don't scatter raw key strings.
- **Backward-compatible storage migrations**: read-time defaulting, never
  destructive rewrites (see how `endpointResolver` treats keys with no
  `provider` field as `gemini`). Follow this pattern.
- **Errors that callers must branch on are sentinel strings** (e.g.
  `API_KEY_MISSING`). Preserve existing sentinels.
- **New AI/model logic belongs in `services/ai/` or the `geminiService`
  facade**, never inline in a component.
- **Components are lazy-loaded views**; keep them presentational and push
  side effects into hooks/services.
- Files are large and self-documenting — match the existing doc-comment density
  (most modules open with a block comment explaining intent and the
  client-only threat model).

## Testing

Vitest runs in the **`node`** environment (not jsdom), so tests focus on the
service/util layer. `vitest.setup.ts` mocks `localStorage` globally and clears
mocks after each test. Test files sit next to their source as `*.test.ts`.
Existing coverage: AI providers + endpoint resolver, authService,
syncOrchestrator, and the utils (errorHandler, rateLimiter, toast, validation).
**Add a `*.test.ts` beside any new service/util.**

## Security model (read before touching keys, CSP, auth, or the SW)

This is a **public, serverless, client-only** app. Consequences:

1. **`VITE_*` env vars are baked into the public bundle** — they are *not*
   secrets. Never ship a real shared Gemini key in a hosted build; prefer
   per-user keys entered in the in-app **Key Wallet** (encrypted via
   `secureStore`) or a backend proxy.
2. **Supabase: anon/public key only, never `service_role`.** Per-user isolation
   is enforced by **Row Level Security** — see `supabase/policies.sql` (a
   template; apply manually). Every user-keyed table must restrict rows to
   `auth.uid()`.
3. **CSP is defined in `index.html`** (web) and `src-tauri/tauri.conf.json`
   (desktop). Font Awesome loads from CDN with SRI/crossorigin. Keep these tight
   if you add external resources.
4. **The service worker (`public/sw.js`) only caches same-origin, query-less GET
   requests** — deliberately, to avoid caching OAuth/API URLs. Don't broaden it.
5. Production source maps are disabled (`vite.config.ts`).
6. Never commit real keys. `.env`, `.env.local`, `.env.*.local` are gitignored;
   `.env.example` holds placeholders only.

## Build & deploy

- **`base` path is environment-driven** (`vite.config.ts`): Tauri → `./`,
  otherwise `VITE_BASE_PATH ?? '/Gemini-Visual-Studio/'`. Vercel sets
  `VITE_BASE_PATH=/` via `vercel.json`.
- **GitHub Pages** (primary): `.github/workflows/deploy-pages.yml` runs on push
  to `main` — lint → test → build → publish `dist/` to the `gh-pages` branch
  (with an `index.html`→`404.html` SPA fallback). `npm run deploy` is a manual
  backup.
- **macOS desktop**: `.github/workflows/build-macos.yml` builds the Tauri
  universal app on `v*` tags (or manual dispatch).
- Vite manually chunks vendors (react / ai / supabase / d3 / zip / ui) — preserve
  these groupings when adding heavy deps.

## Working in this repo

- Default branch is `main`; develop on a feature branch and open a **draft PR**.
- Don't bump versions or rewrite the READMEs unless asked; if you do change
  user-facing behavior, the version of record is `package.json`.
- When adding a provider, model, or storage field, trace it through the
  abstraction (`services/ai/types.ts` → provider → `providerFactory` →
  `constants.ts` defaults) and add tests. Never special-case a vendor inside a
  component.
