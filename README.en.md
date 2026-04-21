# Gemini Visual Studio 🎨

[繁體中文](./README.md) | English

Professional-grade AI image generation and editing suite powered by Google's Gemini API.

> **Latest Version**: 2.0.0 - Complete refactor with security enhancements, architecture optimization, comprehensive testing, and documentation

## ✨ Core Features

- **🖼️ 4K Image Generation** - Generate ultra-high-resolution images using Gemini 3 Pro
- **✏️ AI Editing Tools** - Photo enhancement, style transfer, and image restoration
- **👤 Avatar Creation** - Consistent character design generation
- **📝 Advanced Prompt Editor** - Professional-grade AI prompt optimization
- **🎨 Creative Studio** - Smart storage management for both local and cloud
- **🌍 Multi-language Support** - Full Traditional Chinese & English interface

## 🚀 Get Started in 5 Minutes

### Prerequisites

```bash
- Node.js 16+ 
- npm 7+
- Google Gemini API Key (free)
```

### Online Usage (No Installation)

1. Visit: https://allan1114.github.io/Gemini-Visual-Studio
2. On first visit, click the settings button ⚙️
3. Enter your Gemini API Key ([Get free key](https://aistudio.google.com/app/apikey))
4. Start creating!

> **Your API keys are stored only in your browser and never uploaded anywhere**

### Local Development Setup

```bash
# 1. Clone the repository
git clone https://github.com/allan1114/Gemini-Visual-Studio.git
cd Gemini-Visual-Studio

# 2. Install dependencies
npm install

# 3. Configure environment variables (optional, can skip for online version)
cp .env.example .env.local

# 4. Edit .env.local and add your API keys
# VITE_GEMINI_API_KEY=your_api_key_here
# VITE_SUPABASE_URL=your_supabase_url (optional)
# VITE_SUPABASE_ANON_KEY=your_key (optional)

# 5. Start the development server
npm run dev

# Access http://localhost:5173
```

## 📚 Complete Documentation

### Development Guide

```bash
# Code quality checks
npm run lint        # ESLint + TypeScript
npm run lint:fix    # Auto-fix issues
npm run format      # Prettier formatting

# Unit tests
npm test            # Run vitest
npm run test:ui     # Launch test UI
npm run test:coverage  # Coverage report

# Build and deployment
npm run build       # Production build
npm run deploy      # Deploy to GitHub Pages
```

### Project Structure

```
src/
├── components/          # UI Components (10+)
├── services/            # Business Logic Services
│   ├── authService.ts        # ✅ Authentication
│   ├── geminiService.ts      # 🤖 AI API Integration
│   ├── storageService.ts     # 💾 Local Storage
│   ├── supabaseService.ts    # ☁️ Cloud Storage
│   └── syncOrchestrator.ts   # 🔄 Data Synchronization
├── hooks/               # Custom Hooks
├── utils/               # Utility Functions
│   ├── errorHandler.ts       # ⚠️ Error Management
│   ├── i18n.ts              # 🌍 Internationalization
│   └── apiKeyManager.ts      # 🔑 API Key Management
├── types.ts            # TypeScript Types
└── App.tsx            # Main Application Component
```

## 🔐 Version 2.0.0 Key Improvements

### 1️⃣ Security (Phase 1)
- ✅ Removed all hardcoded API keys
- ✅ Using VITE_ prefixed environment variables
- ✅ API keys stored locally in browser, never uploaded
- ✅ Proper Supabase credential management

### 2️⃣ Architecture (Phase 2)
- ✅ Separated authService - Independent authentication logic
- ✅ Separated syncOrchestrator - Independent data synchronization
- ✅ Extracted i18n - Modularized translations
- ✅ Reduced App.tsx from 1062 lines to ~500 lines

### 3️⃣ Type Safety (Phase 3)
- ✅ Replaced 12+ `any` type annotations
- ✅ Added 4 new type definitions
- ✅ 100% TypeScript strict mode

### 4️⃣ Error Handling (Phase 4)
- ✅ Created ErrorHandler for centralized management
- ✅ 8 standard error classifications
- ✅ Automatic retry for transient errors (exponential backoff)
- ✅ User-friendly multilingual error messages

### 5️⃣ Developer Tools (Phase 5)
- ✅ ESLint code checking
- ✅ Prettier auto-formatting
- ✅ Husky pre-commit hooks
- ✅ lint-staged for selective checking

### 6️⃣ Unit Testing (Phase 6)
- ✅ Vitest testing framework
- ✅ 39+ unit test cases
- ✅ Coverage for core services

### 7️⃣ Performance Optimization (Phase 7)
- ✅ Fixed StorageService race conditions
- ✅ Promise-based synchronization locks
- ✅ Prevented duplicate syncs

### 8️⃣ Documentation (Phase 8)
- ✅ JSDoc comments for all critical services
- ✅ Complete README documentation
- ✅ Type definition documentation

## 💡 Usage Examples

### Authentication

```typescript
import { AuthService } from './services/authService';

// Sign in
const user = await AuthService.signIn('user@example.com', 'password');

// Sign up
await AuthService.signUp('new@example.com', 'password');

// Get current user
const currentUser = await AuthService.getCurrentUser();

// Sign out
await AuthService.signOut();
```

### Error Handling

```typescript
import { ErrorHandler } from './utils/errorHandler';

try {
  const result = await someAsyncOperation();
} catch (error) {
  const errorInfo = ErrorHandler.classify(error);
  
  // Automatic retry (max 3 attempts)
  const result = await ErrorHandler.withRetry(
    () => someAsyncOperation(),
    3,
    1000
  );
}
```

### Data Synchronization

```typescript
import { SyncOrchestrator } from './services/syncOrchestrator';

// Sync on login
await SyncOrchestrator.syncOnLogin(
  user,
  (entries, presets) => {
    // Update UI
  },
  (error) => {
    // Handle error
  }
);

// Manual sync
await SyncOrchestrator.performCloudSync(
  userId,
  (entries) => { /* ... */ },
  (error) => { /* ... */ }
);
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Watch mode
npm test -- --watch

# Coverage report
npm run test:coverage

# Test UI
npm run test:ui
```

### Test Coverage

- ✅ ErrorHandler - 18 tests
- ✅ AuthService - 11 tests  
- ✅ SyncOrchestrator - 10 tests

## 📋 Environment Variables

Create `.env.local` file (for local development only):

```env
# Required: Google Gemini API Key
VITE_GEMINI_API_KEY=your_gemini_api_key

# Optional: Supabase (for cloud synchronization)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

**Note**: The online version doesn't require environment variables. Configure your API key directly in the app settings interface.

## 🚀 Deployment

### GitHub Pages (Recommended)

```bash
# Build the project
npm run build

# Deploy to GitHub Pages
npm run deploy
```

Your site will be published at: `https://your-username.github.io/Gemini-Visual-Studio`

### Custom Server

```bash
# Production build
npm run build

# The dist/ folder contains all static files
# Deploy to any static host (Netlify, Vercel, etc)
```

## 🏗️ Architecture Overview

```
User Interface (React Components)
    ↓
Application State (App.tsx)
    ↓
Business Logic Service Layer
├─ AuthService ────→ Supabase Auth
├─ GeminiService ──→ Google Gemini API
├─ SyncOrchestrator → Data Synchronization
├─ StorageService ─→ IndexedDB (Local)
└─ SupabaseService → Supabase DB (Cloud)
    ↓
Error Handling and Retry (ErrorHandler)
    ↓
User Interface Update
```

## 🎯 Best Practices

### 1. Type Safety
- Always provide explicit type annotations
- Avoid using `any` type
- Use TypeScript strict mode

### 2. Error Handling
- Use `ErrorHandler.classify()` to categorize errors
- Use `ErrorHandler.withRetry()` for transient errors
- Always provide user-friendly error messages

### 3. Code Quality
```bash
# Run before committing
npm run lint:fix
npm test
```

### 4. Documentation
- Add JSDoc comments for public APIs
- Write clear type definitions
- Keep README up to date

## 📞 Get Help

- 📖 [Documentation](./docs)
- 🐛 [Report Issues](https://github.com/allan1114/Gemini-Visual-Studio/issues)
- 💬 [Discussions](https://github.com/allan1114/Gemini-Visual-Studio/discussions)

## 📝 License

MIT License - See [LICENSE](LICENSE) for details

---

**Last Updated**: 2026-04-21  
**Current Version**: 2.0.0  
**Status**: ✅ Production Ready
