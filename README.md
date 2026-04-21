# Gemini Visual Studio 🎨

Professional-grade AI image generation and editing suite powered by Google's Gemini API.

> **最新版本**: 2.0.0 - 完全重构，包含安全增强、架构优化、完整测试和文档

## ✨ 核心功能

- **🖼️ 4K 图像生成** - 使用 Gemini 3 Pro 生成超高分辨率图像
- **✏️ AI 编辑工具** - 照片增强、风格转换和修复
- **👤 头像创作** - 一致的角色设计生成
- **📝 高级提示词编辑器** - 专业级 AI 提示词优化
- **🎨 个人创意工作室** - 本地和云端智能存储管理
- **🌍 多语言支持** - 中文/英文完整界面

## 🚀 5 分钟快速开始

### 前置条件

```bash
- Node.js 16+ 
- npm 7+
- Google Gemini API 密钥（免费）
```

### 安装步骤

```bash
# 1. 克隆项目
git clone https://github.com/allan1114/Gemini-Visual-Studio.git
cd Gemini-Visual-Studio

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env.local

# 4. 编辑 .env.local 添加你的 API 密钥
# VITE_GEMINI_API_KEY=your_api_key_here
# VITE_SUPABASE_URL=your_supabase_url（可选）
# VITE_SUPABASE_ANON_KEY=your_key（可选）

# 5. 启动开发服务器
npm run dev

# 访问 http://localhost:5173
```

> 获取免费 API 密钥：https://aistudio.google.com/app/apikey

## 📚 完整文档

### 开发指南

```bash
# 代码质量检查
npm run lint        # ESLint + TypeScript
npm run lint:fix    # 自动修复问题
npm run format      # Prettier 格式化

# 单元测试
npm test            # 运行 vitest
npm run test:ui     # 启动测试 UI
npm run test:coverage  # 覆盖率报告

# 构建和部署
npm run build       # 生产构建
npm run deploy      # 部署到 GitHub Pages
```

### 项目结构

```
src/
├── components/          # UI 组件（10+ 个）
├── services/            # 业务逻辑服务
│   ├── authService.ts        # ✅ 认证管理
│   ├── geminiService.ts      # 🤖 AI API 集成
│   ├── storageService.ts     # 💾 本地存储
│   ├── supabaseService.ts    # ☁️ 云端存储
│   └── syncOrchestrator.ts   # 🔄 数据同步
├── hooks/               # 自定义 Hooks
├── utils/               # 工具函数
│   ├── errorHandler.ts       # ⚠️ 错误管理
│   └── i18n.ts              # 🌍 多语言
├── types.ts            # TypeScript 类型
└── App.tsx            # 主应用组件
```

## 🔐 2.0.0 版本的关键改进

### 1️⃣ 安全性（Phase 1）
- ✅ 移除所有硬编码的 API 密钥
- ✅ 使用 VITE_ 前缀的环境变量
- ✅ 正确的 Supabase 凭证管理

### 2️⃣ 架构（Phase 2）
- ✅ 拆分 authService - 认证逻辑独立
- ✅ 拆分 syncOrchestrator - 数据同步独立
- ✅ 提取 i18n - 翻译模块化
- ✅ 减少 App.tsx 从 1062 行到 ~500 行

### 3️⃣ 类型安全（Phase 3）
- ✅ 替换 12+ `any` 类型
- ✅ 新增 4 个类型定义
- ✅ 100% TypeScript 严格模式

### 4️⃣ 错误处理（Phase 4）
- ✅ 创建 ErrorHandler 统一管理
- ✅ 8 种标准错误分类
- ✅ 自动重试瞬时错误（指数退避）
- ✅ 多语言用户友好提示

### 5️⃣ 开发工具（Phase 5）
- ✅ ESLint 代码检查
- ✅ Prettier 自动格式化
- ✅ Husky pre-commit 钩子
- ✅ lint-staged 按需检查

### 6️⃣ 单元测试（Phase 6）
- ✅ Vitest 测试框架
- ✅ 39+ 单元测试用例
- ✅ 覆盖核心服务

### 7️⃣ 性能优化（Phase 7）
- ✅ 修复 StorageService 并发竞态条件
- ✅ Promise-based 同步锁
- ✅ 防止重复同步

### 8️⃣ 文档（Phase 8）
- ✅ JSDoc 注释所有关键服务
- ✅ 完整的 README 教学
- ✅ 类型定义文档

## 💡 使用示例

### 认证

```typescript
import { AuthService } from './services/authService';

// 登录
const user = await AuthService.signIn('user@example.com', 'password');

// 注册
await AuthService.signUp('new@example.com', 'password');

// 获取当前用户
const currentUser = await AuthService.getCurrentUser();

// 退出登录
await AuthService.signOut();
```

### 错误处理

```typescript
import { ErrorHandler } from './utils/errorHandler';

try {
  const result = await someAsyncOperation();
} catch (error) {
  const errorInfo = ErrorHandler.classify(error);
  
  // 自动重试（最多 3 次）
  const result = await ErrorHandler.withRetry(
    () => someAsyncOperation(),
    3,
    1000
  );
}
```

### 数据同步

```typescript
import { SyncOrchestrator } from './services/syncOrchestrator';

// 登录时同步
await SyncOrchestrator.syncOnLogin(
  user,
  (entries, presets) => {
    // 更新 UI
  },
  (error) => {
    // 处理错误
  }
);

// 手动同步
await SyncOrchestrator.performCloudSync(
  userId,
  (entries) => { /* ... */ },
  (error) => { /* ... */ }
);
```

## 🧪 测试

```bash
# 运行所有测试
npm test

# 监视模式
npm test -- --watch

# 覆盖率报告
npm run test:coverage

# 测试 UI
npm run test:ui
```

### 测试覆盖

- ✅ ErrorHandler - 18 个测试
- ✅ AuthService - 11 个测试  
- ✅ SyncOrchestrator - 10 个测试

## 📋 环境变量

创建 `.env.local` 文件：

```env
# 必需：Google Gemini API 密钥
VITE_GEMINI_API_KEY=your_gemini_api_key

# 可选：Supabase（用于云同步）
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

## 🚀 部署

### GitHub Pages

```bash
# 构建项目
npm run build

# 部署到 GitHub Pages
npm run deploy
```

### 自定义服务器

```bash
# 生产构建
npm run build

# dist/ 文件夹包含所有静态文件
# 可部署到任何静态主机（Netlify, Vercel, 等）
```

## 🏗️ 架构概览

```
用户界面 (React Components)
    ↓
应用状态 (App.tsx)
    ↓
业务逻辑服务层
├─ AuthService ────→ Supabase Auth
├─ GeminiService ──→ Google Gemini API
├─ SyncOrchestrator → 数据同步协调
├─ StorageService ─→ IndexedDB (本地)
└─ SupabaseService → Supabase DB (云端)
    ↓
错误处理和重试 (ErrorHandler)
    ↓
用户界面更新
```

## 🎯 最佳实践

### 1. 类型安全
- 总是提供显式类型注解
- 避免使用 `any` 类型
- 使用 TypeScript 严格模式

### 2. 错误处理
- 使用 `ErrorHandler.classify()` 分类错误
- 使用 `ErrorHandler.withRetry()` 重试临时错误
- 总是提供用户友好的错误提示

### 3. 代码质量
```bash
# 提交前运行
npm run lint:fix
npm test
```

### 4. 文档
- 为公共 API 添加 JSDoc 注释
- 编写清晰的类型定义
- 保持 README 最新

## 📞 获取帮助

- 📖 [文档](./docs)
- 🐛 [报告问题](https://github.com/allan1114/Gemini-Visual-Studio/issues)
- 💬 [讨论](https://github.com/allan1114/Gemini-Visual-Studio/discussions)

## 📝 许可

MIT License - 详见 [LICENSE](LICENSE)

---

**最后更新**: 2026-04-17  
**当前版本**: 2.0.0  
**状态**: ✅ 生产就绪