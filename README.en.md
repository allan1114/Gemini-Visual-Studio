# Gemini Visual Studio 🎨

[繁體中文](./README.md) | English

A frontend AI image generation, editing, prompt-building, and gallery app powered by the Google Gemini API. This project is published as a **GitHub Pages static site**, so Gemini and Supabase requests are made directly from each user's browser.

> **Latest version: 2.1.0 (2026-05-29)** — Security hardening for public GitHub Pages deployment, fixed test configuration, tightened Service Worker caching, and refreshed documentation.

## ✨ Highlights

- **AI image generation** with `gemini-3-pro-image-preview` and `gemini-2.5-flash-image`.
- **Image editing** for enhancement, inpainting, background handling, and style transfer.
- **Avatar / character workflows** using source images and prompt chips.
- **Prompt Builder** with style, composition, lens, lighting, and medium presets.
- **Local creative library** using IndexedDB / localStorage for history, presets, and the API Key Wallet.
- **Optional Supabase sync** for login, Google OAuth, cloud backup, and cross-device sync.
- **PWA caching** so previously cached static assets can load from GitHub Pages offline.

## 🔐 Public GitHub Pages Security Notes

This repository is publicly deployed. Keep these rules in mind:

1. **Never commit real API keys to the repository.**
   - `.env`, `.env.local`, and `.env.*.local` are ignored.
   - `.env.example` contains placeholders only.
2. **Frontend environment variables are not secrets.**
   - `VITE_*` variables are bundled into browser-readable JavaScript.
   - If you must protect a Gemini key, use a backend proxy / serverless function instead of GitHub Pages-only hosting.
3. **User-entered Gemini keys are stored only in that user's browser.**
   - The Key Wallet uses localStorage.
   - Users should avoid saving keys on shared computers.
4. **Supabase must rely on RLS.**
   - Use only the `anon / public key` in the frontend.
   - Never expose a `service_role` key.
5. **Hardening included in 2.1.0.**
   - `index.html` includes a Content Security Policy.
   - Font Awesome CDN has SRI, `crossorigin`, and `referrerpolicy` attributes.
   - The Service Worker only handles same-origin, query-free GitHub Pages GET requests, avoiding OAuth / API URL caching.
   - Production source maps are disabled.

## 🚀 Online Usage

1. Open <https://allan1114.github.io/Gemini-Visual-Studio/>.
2. Open settings / Key Wallet.
3. Enter a Gemini API Key from [Google AI Studio](https://aistudio.google.com/app/apikey).
4. Start generating or editing images.

## 🧑‍💻 Local Development

### Requirements

- Node.js 20+ (LTS recommended)
- npm 10+
- Gemini API Key (optional locally; you can also enter it in the UI)
- Supabase project (optional, only for cloud sync)

### Install and run

```bash
git clone https://github.com/allan1114/Gemini-Visual-Studio.git
cd Gemini-Visual-Studio
npm install
cp .env.example .env.local
npm run dev
```

The local dev server defaults to <http://localhost:5173>.

### Example `.env.local`

```bash
VITE_GEMINI_API_KEY=your_gemini_api_key
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

> Do not ship a shared or private Gemini key in the GitHub Pages build. For the public site, prefer user-provided keys.

## ☁️ Supabase Setup (Optional)

### 1. Create a project

Create a project at <https://supabase.com> and copy:

- Project URL
- `anon / public` key

### 2. Create the `profiles` table and RLS policies

Run this in the Supabase SQL Editor:

```sql
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text,
  is_admin boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, is_admin)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    false
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

### 3. Google OAuth (optional)

1. Go to Supabase → **Authentication → Providers → Google**.
2. Create an OAuth Web Client in Google Cloud Console.
3. Add this redirect URI: `https://<your-project>.supabase.co/auth/v1/callback`.
4. Paste the Client ID / Secret back into Supabase.

## 🧪 Common Commands

```bash
npm run lint          # ESLint + TypeScript noEmit
npm test -- --run     # Run Vitest once
npm run build         # TypeScript + Vite production build
npm run preview       # Preview dist
npm run deploy        # gh-pages -d dist
```

For the public GitHub Pages version, verify the PR branch before merging or deploying:

1. Run `npm run lint`, `npm test -- --run`, and `npm run build` on the PR branch.
2. Preview the production output with `npm run preview -- --host 127.0.0.1`.
3. Open the `/Gemini-Visual-Studio/` base path and confirm the home screen, settings / Key Wallet, generation view, and gallery load correctly.
4. Run one low-cost smoke test with a test Gemini API key; do not use a shared production key.
5. If Supabase is enabled, verify login / logout / sync with a test account instead of a production admin account.

If the deployed version is not usable, rollback is available:

```bash
# Option A: GitHub UI
# GitHub → Actions / Pages deployment → choose the previous successful deployment → re-run / redeploy

# Option B: revert the bad commit and deploy again
git revert <bad_commit_sha>
npm run build
npm run deploy

# Option C: check out a known-good commit and deploy it directly
git checkout <known_good_commit_sha>
npm install
npm run build
npm run deploy
```

Keep the previous known-good commit SHA handy; the commit immediately before this hardening work was `bcf4367`.

## 📁 Project Structure

```text
.
├── App.tsx
├── components/              # UI components and views
├── hooks/                   # React hooks
├── services/                # Gemini, Supabase, storage, sync, auth services
├── utils/                   # Error handler and i18n
├── public/sw.js             # GitHub Pages service worker
├── index.html               # CSP and external stylesheet policy
├── vite.config.ts           # GitHub Pages base path and build config
└── vitest.config.ts         # Unit test config
```

## ✅ 2.1.0 Check Results

- Fixed blocking ESLint errors, including unused expressions, irregular whitespace, ESM `__dirname`, and test globals.
- Updated Vitest to run service-layer unit tests in the Node environment without requiring missing jsdom.
- Added CSP and CDN SRI, and removed the inline Service Worker registration script.
- Tightened Service Worker cache scope to avoid caching query URLs or external APIs.
- Disabled production source maps to reduce public deployment exposure.
- Refreshed README content for GitHub Pages public deployment.

## ⚠️ Known Limits

- GitHub Pages is static hosting and cannot truly hide frontend API keys.
- `npm audit` requires the npm registry audit endpoint; this environment returned 403, so rerun it in CI or on a machine with registry access.
- Font Awesome is still loaded from a CDN. For stricter supply-chain control, vendor it or bundle icons through npm.

## 📄 License

Use according to the original repository license and dependency licenses. If this is publicly redistributed, add a formal LICENSE file.
