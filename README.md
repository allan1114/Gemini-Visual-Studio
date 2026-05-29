# Gemini Visual Studio 🎨

[English](./README.en.md) | 繁體中文

由 Google Gemini API 驅動的前端 AI 影像生成、編輯、提示詞與作品庫工具。此專案以 **GitHub Pages 靜態網站** 形式發佈，所有 Gemini / Supabase 呼叫都由使用者瀏覽器直接發出。

> **最新版本：2.1.0（2026-05-29）** — 針對公開 GitHub Pages 部署完成安全加固、測試設定修正、Service Worker 快取收斂，以及文件更新。

## ✨ 功能重點

- **AI 影像生成**：支援 `gemini-3-pro-image-preview` 與 `gemini-2.5-flash-image`。
- **影像編輯**：照片增強、局部修復、背景處理、風格轉換。
- **角色 / 頭像工作流**：用參考圖與提示詞建立一致角色設定。
- **提示詞 Builder**：內建風格、構圖、鏡頭、光影、媒介等提示詞片段。
- **本地作品庫**：IndexedDB / localStorage 保存歷史、預設與 API Key 錢包。
- **可選 Supabase 同步**：啟用登入、Google OAuth、雲端備份與跨裝置同步。
- **PWA 快取**：GitHub Pages 環境可離線載入已快取的靜態資產。

## 🔐 公開 GitHub Pages 安全說明

此 Repo 會公開部署，請特別注意：

1. **不要把任何真實 API Key commit 入 Repo**。
   - `.env`, `.env.local`, `.env.*.local` 已在 `.gitignore`。
   - `.env.example` 只保留 placeholder。
2. **前端環境變數不是秘密**。
   - `VITE_*` 變數會被打包到瀏覽器端，任何訪客都可檢視。
   - 若需要保護 Gemini Key，請改用後端 proxy / serverless function，不要直接放入 GitHub Pages build。
3. **使用者自行輸入的 Gemini Key 只保存在其瀏覽器本地**。
   - Key Wallet 使用 localStorage；同一瀏覽器 profile 內可讀取。
   - 請提醒使用者避免在共用電腦保存金鑰。
4. **Supabase 必須使用 RLS**。
   - 只可在前端使用 `anon / public key`。
   - 絕不可使用 `service_role` key。
5. **已加固項目**。
   - `index.html` 已加入 Content Security Policy。
   - Font Awesome CDN 已加上 SRI、`crossorigin` 與 `referrerpolicy`。
   - Service Worker 只處理同源、無 query 的 GitHub Pages GET 請求，避免快取 OAuth / API URL。
   - Production build 關閉 source map。

## 🚀 線上使用

1. 開啟：<https://allan1114.github.io/Gemini-Visual-Studio/>
2. 點擊設定 / Key Wallet。
3. 輸入 Gemini API Key（可於 [Google AI Studio](https://aistudio.google.com/app/apikey) 建立）。
4. 開始生成或編輯影像。

## 🧑‍💻 本地開發

### 前置條件

- Node.js 20+（建議 LTS）
- npm 10+
- Gemini API Key（本地可選；亦可在 UI 輸入）
- Supabase project（雲端同步可選）

### 安裝與啟動

```bash
git clone https://github.com/allan1114/Gemini-Visual-Studio.git
cd Gemini-Visual-Studio
npm install
cp .env.example .env.local
npm run dev
```

本機網址預設為 <http://localhost:5173>。

### `.env.local` 範例

```bash
VITE_GEMINI_API_KEY=your_gemini_api_key
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

> 注意：GitHub Pages build 不應包含共用或私有 Gemini Key。公開網站建議讓使用者自行輸入 Key。

## ☁️ Supabase 設定（可選）

### 1. 建立 project

在 <https://supabase.com> 建立新專案，記下：

- Project URL
- `anon / public` key

### 2. 建立 `profiles` 表與 RLS policy

在 Supabase SQL Editor 執行：

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

### 3. Google OAuth（可選）

1. Supabase → **Authentication → Providers → Google**。
2. Google Cloud Console 建立 OAuth Web Client。
3. Redirect URI 填：`https://<your-project>.supabase.co/auth/v1/callback`。
4. 將 Client ID / Secret 填回 Supabase。

## 🧪 常用指令

```bash
npm run lint          # ESLint + TypeScript noEmit
npm test -- --run     # Vitest 一次性執行
npm run build         # TypeScript + Vite production build
npm run preview       # 預覽 dist
npm run deploy        # gh-pages -d dist
```

公開 GitHub Pages 版本建議用以下流程先驗證，確認可行可用才 merge / deploy：

1. 在 PR branch 跑 `npm run lint`、`npm test -- --run`、`npm run build`。
2. 用 `npm run preview -- --host 127.0.0.1` 預覽 build output。
3. 開啟 `/Gemini-Visual-Studio/` base path，確認首頁、設定 / Key Wallet、生成頁、作品庫頁可載入。
4. 用測試 Gemini API Key 做一次低成本 smoke test；不要用正式共用 key。
5. Supabase 如有啟用，先用測試帳號確認登入 / 登出 / 同步，不要直接用 production admin 帳號。

如果部署後發現不可用，可以 rollback：

```bash
# 方案 A：GitHub UI
# GitHub → Actions / Pages deployment → 選擇上一個成功 deployment → Re-run / redeploy

# 方案 B：Git revert 最新 commit，再重新 deploy
git revert <bad_commit_sha>
npm run build
npm run deploy

# 方案 C：直接回到上一個已知可用 commit，再 deploy
git checkout <known_good_commit_sha>
npm install
npm run build
npm run deploy
```

建議保留上一個已知可用 commit SHA；今次改動前嘅直接上一個 commit 是 `bcf4367`。

## 📁 專案結構

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

## ✅ 2.1.0 檢查結果

- 修正 ESLint blocking errors（未使用 expression、不可見空白、ESM `__dirname`、test global）。
- 修正 Vitest 設定，服務層單元測試可在 Node environment 執行，不再依賴缺失的 jsdom。
- 加入 CSP 與 CDN SRI，移除 inline Service Worker registration script。
- 收斂 Service Worker cache scope，避免快取帶 query 的 URL 或外部 API。
- 關閉 production source map，降低公開部署資訊曝露。
- 更新 README 至 GitHub Pages 公開部署適用版本。

## ⚠️ 已知限制

- GitHub Pages 是純靜態 hosting，無法真正隱藏前端 API Key。
- `npm audit` 需要 npm registry audit endpoint；目前執行環境回傳 403，需在可存取 registry 的 CI / 本機重新跑。
- Font Awesome 仍透過 CDN 載入；如需更嚴格供應鏈控制，可改為 vendored / npm bundled icon assets。

## 📄 License

請依原 Repo license / 上游依賴 license 使用。若公開分發，請補上正式 LICENSE 檔案。
