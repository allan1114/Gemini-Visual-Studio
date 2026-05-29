# Gemini Visual Studio 🎨

[繁體中文](./README.md) | English

A frontend AI image generation, editing, prompt-building, and gallery app powered by the Google Gemini API. This project is published as a **GitHub Pages static site**, so Gemini and Supabase requests are made directly from each user's browser.

> **Latest version: 2.2.0 (2026-05-29)** — Fixed the user-guide modal, added a Back button to Settings, OAuth now returns to the correct base path with expanded setup docs, the app version is shown in the top-right, and a GitHub Pages auto-deploy workflow was added.

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

Follow every step — most "invalid Client ID" / "Client ID 唔啱" errors come from a
mismatched redirect URI or the wrong OAuth client type.

**a. Create the OAuth client in Google Cloud Console**

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services → Credentials**.
2. Configure the **OAuth consent screen** first (External, add your email as a test user).
3. **Create Credentials → OAuth client ID** and choose application type **Web application** (NOT "Desktop" or "Android" — Supabase only accepts a Web client).
4. Under **Authorized JavaScript origins**, add:
   - `http://localhost:5173` (local dev)
   - `https://<your-username>.github.io` (GitHub Pages)
5. Under **Authorized redirect URIs**, add the **Supabase callback** exactly:
   - `https://<your-project-ref>.supabase.co/auth/v1/callback`
6. Click **Create** and copy the **Client ID** and **Client Secret**.

**b. Paste the credentials into Supabase**

1. Go to Supabase → **Authentication → Providers → Google** and enable it.
2. Paste the **Client ID** and **Client Secret** — make sure there are no leading/trailing spaces (a stray space is the most common cause of the "invalid Client ID" error).
3. The Client ID must end with `.apps.googleusercontent.com`. If it doesn't, you copied the wrong value.

**c. Set the Supabase redirect allow-list**

1. Go to Supabase → **Authentication → URL Configuration**.
2. Set **Site URL** to your deployed app, including the base path:
   - `https://<your-username>.github.io/Gemini-Visual-Studio/`
3. Add the same URL (and `http://localhost:5173/` for local dev) to **Redirect URLs**.

> The app redirects OAuth back to its own base path (`/Gemini-Visual-Studio/`), so the
> exact deployed URL must be on the Supabase redirect allow-list or login will fail
> after the Google prompt.

**Still seeing "invalid Client ID"?**

- Confirm the OAuth client type is **Web application**.
- Confirm the redirect URI in Google matches the Supabase callback **character for character** (https, project ref, `/auth/v1/callback`, no trailing slash).
- Re-copy the Client ID/Secret into Supabase (watch for whitespace) and save.
- Wait a few minutes — Google credential changes can take a short time to propagate.

## 🧪 Common Commands

```bash
npm run lint          # ESLint + TypeScript noEmit
npm test -- --run     # Run Vitest once
npm run build         # TypeScript + Vite production build
npm run preview       # Preview dist
npm run deploy        # gh-pages -d dist (manual fallback)
```

### Automatic deployment to GitHub Pages

The `gh-pages` branch is this repo's GitHub Pages source. Every time a PR is
merged into `main`, `.github/workflows/deploy-pages.yml` automatically runs
lint / test / build and publishes `dist/` to the `gh-pages` branch, so the live
site always reflects the latest version.

- You can also trigger it manually from GitHub → **Actions → Deploy to GitHub Pages → Run workflow**.
- On first enable, go to repo **Settings → Pages** and set the Source to **Deploy from a branch → `gh-pages` / root**.
- `npm run deploy` is still available as a manual fallback from your machine.

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

## ✅ 2.2.0 Changes

- Fixed the user-guide ("Manual") button — it now opens a proper guide modal that can be closed/returned from.
- Added a **Back** button to the Settings (API Keys) screen and pre-filled existing keys, so you can leave settings without being stuck.
- Google OAuth now redirects back to the app's own base path (`/Gemini-Visual-Studio/`), and the README has detailed, correct setup steps to fix "invalid Client ID" errors.
- The app version (`v2.2.0`) is now shown in the top-right header and on the login screen, sourced from `package.json`.
- Added `.github/workflows/deploy-pages.yml` to auto-build and publish to the `gh-pages` branch on merge to `main`.

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
