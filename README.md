# Gemini Visual Studio 🎨

[English](./README.en.md) | 繁體中文

專業級 AI 影像生成與編輯套件，由 Google Gemini API 驅動。

> **最新版本**: 2.0.0 - 完全重構，包含安全增強、架構優化、完整測試和文檔

## ✨ 核心功能

- **🖼️ 4K 影像生成** - 使用 Gemini 3 Pro 生成超高分辨率影像
- **✏️ AI 編輯工具** - 照片增強、風格轉換和修復
- **👤 頭像創作** - 一致的角色設計生成
- **📝 高級提示詞編輯器** - 專業級 AI 提示詞優化
- **🎨 個人創意工作室** - 本地和雲端智能存儲管理
- **🌍 多語言支援** - 繁體中文/英文完整介面

## 🚀 5 分鐘快速開始

### 前置條件

```bash
- Node.js 16+ 
- npm 7+
- Google Gemini API 金鑰（免費）
```

### 線上使用（無需安裝）

1. 訪問：https://allan1114.github.io/Gemini-Visual-Studio
2. 首次進入時，點擊設定按鈕 ⚙️
3. 輸入 Gemini API 金鑰（[免費取得](https://aistudio.google.com/app/apikey)）
4. 開始創作！

> **金鑰只保存在你的瀏覽器本地，不會上傳到任何伺服器**

### 本地開發安裝

```bash
# 1. 複製專案
git clone https://github.com/allan1114/Gemini-Visual-Studio.git
cd Gemini-Visual-Studio

# 2. 安裝依賴
npm install

# 3. 設定環境變數（可選，線上版本可跳過）
cp .env.example .env.local

# 4. 編輯 .env.local 添加你的 API 金鑰
# VITE_GEMINI_API_KEY=your_api_key_here
# VITE_SUPABASE_URL=your_supabase_url（可選）
# VITE_SUPABASE_ANON_KEY=your_key（可選）

# 5. 啟動開發伺服器
npm run dev

# 訪問 http://localhost:5173
```

## 📚 完整文檔

### 開發指南

```bash
# 代碼品質檢查
npm run lint        # ESLint + TypeScript
npm run lint:fix    # 自動修復問題
npm run format      # Prettier 格式化

# 單元測試
npm test            # 運行 vitest
npm run test:ui     # 啟動測試 UI
npm run test:coverage  # 涵蓋率報告

# 構建和部署
npm run build       # 生產構建
npm run deploy      # 部署到 GitHub Pages
```

### 專案結構

```
src/
├── components/          # UI 組件（10+ 個）
├── services/            # 業務邏輯服務
│   ├── authService.ts        # ✅ 認證管理
│   ├── geminiService.ts      # 🤖 AI API 整合
│   ├── storageService.ts     # 💾 本地存儲
│   ├── supabaseService.ts    # ☁️ 雲端存儲
│   └── syncOrchestrator.ts   # 🔄 數據同步
├── hooks/               # 自訂 Hooks
├── utils/               # 工具函數
│   ├── errorHandler.ts       # ⚠️ 錯誤管理
│   ├── i18n.ts              # 🌍 多語言
│   └── apiKeyManager.ts      # 🔑 金鑰管理
├── types.ts            # TypeScript 型別
└── App.tsx            # 主應用組件
```

## 🔐 2.0.0 版本的關鍵改進

### 1️⃣ 安全性（Phase 1）
- ✅ 移除所有硬編碼的 API 金鑰
- ✅ 使用 VITE_ 前綴的環境變數
- ✅ 金鑰存儲在瀏覽器本地，永不上傳
- ✅ 正確的 Supabase 憑證管理

### 2️⃣ 架構（Phase 2）
- ✅ 拆分 authService - 認證邏輯獨立
- ✅ 拆分 syncOrchestrator - 數據同步獨立
- ✅ 提取 i18n - 翻譯模組化
- ✅ 減少 App.tsx 從 1062 行到 ~500 行

### 3️⃣ 型別安全（Phase 3）
- ✅ 替換 12+ `any` 型別
- ✅ 新增 4 個型別定義
- ✅ 100% TypeScript 嚴格模式

### 4️⃣ 錯誤處理（Phase 4）
- ✅ 創建 ErrorHandler 統一管理
- ✅ 8 種標準錯誤分類
- ✅ 自動重試暫時性錯誤（指數退避）
- ✅ 多語言使用者友善提示

### 5️⃣ 開發工具（Phase 5）
- ✅ ESLint 代碼檢查
- ✅ Prettier 自動格式化
- ✅ Husky pre-commit 鉤子
- ✅ lint-staged 按需檢查

### 6️⃣ 單元測試（Phase 6）
- ✅ Vitest 測試框架
- ✅ 39+ 單元測試用例
- ✅ 涵蓋核心服務

### 7️⃣ 效能優化（Phase 7）
- ✅ 修復 StorageService 並發競態條件
- ✅ Promise-based 同步鎖
- ✅ 防止重複同步

### 8️⃣ 文檔（Phase 8）
- ✅ JSDoc 註解所有關鍵服務
- ✅ 完整的 README 教學
- ✅ 型別定義文檔

## 💡 使用示例

### 認證

```typescript
import { AuthService } from './services/authService';

// 登入
const user = await AuthService.signIn('user@example.com', 'password');

// 註冊
await AuthService.signUp('new@example.com', 'password');

// 取得目前使用者
const currentUser = await AuthService.getCurrentUser();

// 登出
await AuthService.signOut();
```

### 錯誤處理

```typescript
import { ErrorHandler } from './utils/errorHandler';

try {
  const result = await someAsyncOperation();
} catch (error) {
  const errorInfo = ErrorHandler.classify(error);
  
  // 自動重試（最多 3 次）
  const result = await ErrorHandler.withRetry(
    () => someAsyncOperation(),
    3,
    1000
  );
}
```

### 數據同步

```typescript
import { SyncOrchestrator } from './services/syncOrchestrator';

// 登入時同步
await SyncOrchestrator.syncOnLogin(
  user,
  (entries, presets) => {
    // 更新 UI
  },
  (error) => {
    // 處理錯誤
  }
);

// 手動同步
await SyncOrchestrator.performCloudSync(
  userId,
  (entries) => { /* ... */ },
  (error) => { /* ... */ }
);
```

## 🧪 測試

```bash
# 運行所有測試
npm test

# 監視模式
npm test -- --watch

# 涵蓋率報告
npm run test:coverage

# 測試 UI
npm run test:ui
```

### 測試涵蓋

- ✅ ErrorHandler - 18 個測試
- ✅ AuthService - 11 個測試  
- ✅ SyncOrchestrator - 10 個測試

## 📋 環境變數

創建 `.env.local` 檔案（本地開發用）：

```env
# 必填：Google Gemini API 金鑰
VITE_GEMINI_API_KEY=your_gemini_api_key

# 可選：Supabase（用於雲端同步）
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

**注意**：線上版本無需設定環境變數，直接在介面設定 API 金鑰即可。

## 🚀 部署

### GitHub Pages（推薦）

```bash
# 構建專案
npm run build

# 部署到 GitHub Pages
npm run deploy
```

網站會發佈到：`https://你的使用者名.github.io/Gemini-Visual-Studio`

### 自訂伺服器

```bash
# 生產構建
npm run build

# dist/ 資料夾包含所有靜態檔案
# 可部署到任何靜態主機（Netlify, Vercel, etc）
```

## 🏗️ 架構概覽

```
使用者介面 (React Components)
    ↓
應用狀態 (App.tsx)
    ↓
業務邏輯服務層
├─ AuthService ────→ Supabase Auth
├─ GeminiService ──→ Google Gemini API
├─ SyncOrchestrator → 數據同步協調
├─ StorageService ─→ IndexedDB (本地)
└─ SupabaseService → Supabase DB (雲端)
    ↓
錯誤處理和重試 (ErrorHandler)
    ↓
使用者介面更新
```

## 🎯 最佳實踐

### 1. 型別安全
- 總是提供明確型別註解
- 避免使用 `any` 型別
- 使用 TypeScript 嚴格模式

### 2. 錯誤處理
- 使用 `ErrorHandler.classify()` 分類錯誤
- 使用 `ErrorHandler.withRetry()` 重試暫時性錯誤
- 總是提供使用者友善的錯誤提示

### 3. 代碼品質
```bash
# 提交前運行
npm run lint:fix
npm test
```

### 4. 文檔
- 為公開 API 添加 JSDoc 註解
- 編寫清晰的型別定義
- 保持 README 最新

## 📞 取得協助

- 📖 [文檔](./docs)
- 🐛 [報告問題](https://github.com/allan1114/Gemini-Visual-Studio/issues)
- 💬 [討論](https://github.com/allan1114/Gemini-Visual-Studio/discussions)

## 📝 授權

MIT License - 詳見 [LICENSE](LICENSE)

---

**最後更新**: 2026-04-21  
**當前版本**: 2.0.0  
**狀態**: ✅ 生產就緒
