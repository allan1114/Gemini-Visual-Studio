import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import JSZip from 'jszip';
import { View, PromptEntry, ModelChoice, User, Language, Preset, UsageStats, Member, GenerationConfig, AppError } from './types';
import { STORAGE_KEYS } from './constants';
import Sidebar from './components/Sidebar';
import { DBService } from './services/dbService';
import { StorageService } from './services/storageService';
import { ImageProcessingService } from './services/imageProcessingService';
import { SupabaseService, supabase } from './services/supabaseService';
import { AuthService } from './services/authService';
import { SyncOrchestrator } from './services/syncOrchestrator';

// Views
import GenerateView from './components/GenerateView';
import EditView from './components/EditView';
import AvatarView from './components/AvatarView';
import KeyWallet from './components/KeyWallet';
import { GalleryGrid, PresetsList, MembersDB } from './components/StudioViews';

const TRANSLATIONS = {
  en: {
    gallery: "Explore Gallery", create: "Create", edit: "AI Edit", avatar: "AI Avatar", studio: "My Studio", prompts: "My Prompts", presets: "My Presets",
    inspire: "Inspire Me", randomStyle: "Random Style", construction: "Visual Workspace", promptLabel: "Custom Subject", selectedPromptLabel: "Visual Prompt Sequence",
    subjectPlaceholder: "Type a core subject...", negativeLabel: "Negative Elements", negativePlaceholder: "e.g., blurry...", manifest: "Synthesize Vision",
    synthesizing: "Synthesizing...", store: "Save to Studio", saveAll: "Save All Results", storing: "Saving...", saved: "Saved!", tuning: "Advanced Engine Tuning",
    seed: "Deterministic Seed", creativity: "Creativity (Temp)", ratio: "Aspect Ratio", resolution: "Resolution", signIn: "Sign In", signUp: "Sign Up",
    noAccount: "Don't have an account?", alreadyHaveAccount: "Already have an account?", emptyStudio: "Studio empty.", searchPlaceholder: "Search...",
    transformPhoto: "Transform Photo", createFromScratch: "Create from Description", bulkDownload: "Download ZIP", promptRequired: "Prompt is required.",
    importSuccess: "Import success.", importError: "Import error.", help: "Help", pickOne: "Select result:", generatingMany: "Creating {current}/5...",
    engineFlash: "Gemini 3.0 Flash", enginePro: "Gemini 3.0 Pro", quotaError: "API limit reached.", dropHint: "Drag tags here", importData: "Import Data",
    exportData: "Export Data", bulkDelete: "Delete Selected", zipping: "Creating ZIP...", selectedCount: "{count} items selected", memberDb: "Members Database", 
    helpTitle: "Studio Master Guide", helpClose: "Return to Studio",
    helpIntro: "Welcome to Gemini Visual Studio. Master high-end AI synthesis with these steps:",
    helpStep1: "1. Visual Construction: Drag and drop professional tags from our curated library into the workspace. Combine them with core subjects to shape your artistic vision with precision.",
    helpStep2: "2. Engine Tuning: Toggle between Gemini 3 Pro for ultra-realistic 4K results or Flash for rapid iterations. Use 'Deterministic Seeds' to replicate specific aesthetics or increase 'Creativity' for bold variations.",
    helpStep3: "3. Advanced Modes: Use 'AI Edit' for surgical modifications of existing photos, or 'AI Avatar' to generate consistent character variations while preserving key facial features.",
    helpStep4: "4. Personal Studio: Manage your library in 'My Studio'. All creations are stored in your secure browser-based vault, accessible offline and ready for high-resolution export.",
    uploadPrompt: "Upload Prompt", aiInfo: "AI Runtime Info", currentModel: "Current Model", genCount: "Gen Count", thisGenCons: "Session Consumption",
    inputAmount: "Input", outputAmount: "Output", accuTokenCons: "Accu. Consumption", consNote: "* Stats for current stage.",
    uploadSource: "Upload source photo", applyEdit: "Apply AI Edit", savePreset: "Save Preset", presetName: "Preset name:", 
    expandPrompt: "Expand with AI", expanding: "Refining...", copyPrompt: "Copy Prompt", copied: "Copied!",
    editModeWhole: "Whole Image", editModeArea: "Area In-paint", brushSize: "Brush Size", brushSoftness: "Softness", clearMask: "Clear Mask",
    applyInpaint: "Apply Area Edit", compareLabel: "Hold to Compare",
    removeBg: "Remove BG", aiSuggest: "AI Suggest", stylePresets: "Style Presets",
    editModeAdvanced: "Advanced Tools", healingBrush: "Healing Brush", healingPrompt: "Seamlessly remove the object in the masked area and fill with a realistic background that matches the surrounding texture and lighting.",
    importing: "Importing data... {progress}%",
    googleLogin: "Continue with Google",
    emailPlaceholder: "Email address",
    passwordPlaceholder: "Password",
    selectAll: "Select All",
    deselectAll: "Deselect All",
    syncing: "Syncing...",
    cloudSync: "Cloud Sync",
    lastSynced: "Last Synced: {time}",
    keyWallet: "Key Wallet",
    welcomeTitle: "Welcome to Gemini Studio",
    welcomeSubtitle: "Professional-grade AI image synthesis platform. Sign in to start your creative journey.",
    guestMode: "Continue as Guest",
    guestWarning: "Cloud sync disabled in guest mode.",
    fetchError: "Network error: Failed to fetch resource. Please check your connection or CORS settings."
  },
  zh: {
    gallery: "探索畫廊", create: "創作中心", edit: "AI 編輯", avatar: "AI 頭像", studio: "個人工作室", prompts: "我的提示詞", presets: "我的預設",
    inspire: "獲取靈感", randomStyle: "隨機風格", construction: "視覺工作區", promptLabel: "核心主體", selectedPromptLabel: "視覺提示序列",
    subjectPlaceholder: "輸入創作主體...", negativeLabel: "排除元素", negativePlaceholder: "例如：模糊...", manifest: "啟動創作",
    synthesizing: "正在合成...", store: "存入工作室", saveAll: "儲存全部結果", storing: "儲存中...", saved: "已儲存！", tuning: "進階調試",
    seed: "隨機種子", creativity: "創造力", ratio: "畫面比例", resolution: "解析度", signIn: "登錄", signUp: "註冊",
    noAccount: "還沒有帳號？", alreadyHaveAccount: "已經有帳號？", emptyStudio: "工作室暫無內容。", searchPlaceholder: "搜索...",
    transformPhoto: "照片轉換", createFromScratch: "文字創建", bulkDownload: "打包下載", promptRequired: "請輸入提示詞。",
    importSuccess: "導入成功。", importError: "導入失敗。", help: "手冊", pickOne: "選擇作品：", generatingMany: "合成中 {current}/5...",
    engineFlash: "Gemini 3.0 Flash", enginePro: "Gemini 3.0 Pro", quotaError: "配額已滿。", dropHint: "將元素拖曳至此處組合視覺序列", importData: "導入數據",
    exportData: "導出數據", bulkDelete: "刪除選中項", zipping: "正在打包...", selectedCount: "已選中 {count} 個項目", memberDb: "成員數據庫", 
    helpTitle: "進階使用手冊", helpClose: "返回工作室",
    helpIntro: "歡迎使用 Gemini Visual Studio。透過以下步驟掌握專業級 AI 合成：",
    helpStep1: "1. 構建視覺：從專業標籤庫中拖拽元素至工作區。將標籤與核心提示詞結合，精確控制光影、構圖與藝術風格。",
    helpStep2: "2. 引擎調試：切換 Gemini 3 Pro 獲得 4K 極致寫實畫質，或使用 Flash 進行快速草稿。調整『隨機種子』以重現特定效果，或提高『創造力』以探索意想不到的藝術變化。",
    helpStep3: "3. 進階模式：使用『AI 編輯』對現有照片進行外科手術般的進階局部修改；或利用『AI 頭像』功能，在保持人物面部特徵一致的同時，生成不同風格的視覺版本。",
    helpStep4: "4. 個人工作室：在『個人工作室』管理所有作品。您的創作將儲存在瀏覽器的安全本地庫中，支持離線訪問與高清導出。",
    uploadPrompt: "上傳提示詞", aiInfo: "當前運行資訊", currentModel: "當前模型", genCount: "生成次數", thisGenCons: "本次消耗",
    inputAmount: "輸入", outputAmount: "輸出", accuTokenCons: "累計消耗", consNote: "* 數據由當前會話統計。",
    uploadSource: "上傳照片", applyEdit: "應用 AI 編輯", savePreset: "儲存預設", presetName: "預設名稱：", 
    expandPrompt: "AI 智能優化", expanding: "正在優化...", copyPrompt: "複製提示詞", copied: "已複製！",
    editModeWhole: "全圖修改", editModeArea: "區域修補", brushSize: "筆刷大小", brushSoftness: "羽化程度", clearMask: "清除遮罩",
    applyInpaint: "應用局部編輯", compareLabel: "長按對比原圖",
    removeBg: "一鍵去背", aiSuggest: "AI 建議", stylePresets: "風格預設",
    editModeAdvanced: "進階工具", healingBrush: "修復畫筆", healingPrompt: "無縫移除遮罩區域中的物體，並填充與周圍紋理和光影匹配的真實背景。",
    importing: "正在導入數據... {progress}%",
    googleLogin: "使用 Google 帳號登錄",
    emailPlaceholder: "電子郵件地址",
    passwordPlaceholder: "Password",
    selectAll: "全選",
    deselectAll: "取消全選",
    syncing: "同步中...",
    cloudSync: "雲端同步",
    lastSynced: "上次同步: {time}",
    keyWallet: "金鑰錢包",
    welcomeTitle: "歡迎來到 Gemini Studio",
    welcomeSubtitle: "專業級 AI 合成與存儲平台。登錄以開始您的創作之旅。",
    guestMode: "訪客模式 (不登錄)",
    guestWarning: "訪客模式下雲端同步功能將被禁用。",
    fetchError: "網路錯誤：無法獲取資源。請檢查您的網路連接或 CORS 設定。"
  }
};

const App: React.FC = () => {
  const [view, setView] = useState<View>(View.GALLERY);
  const [language, setLanguage] = useState<Language>('zh'); 
  const [allEntries, setAllEntries] = useState<PromptEntry[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [showHelp, setShowHelp] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authForm, setAuthForm] = useState({ email: '', password: '' });
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [usageStats, setUsageStats] = useState<UsageStats>({ sessionCount: 0, lastInputTokens: 0, lastOutputTokens: 0, totalTokens: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [members, setMembers] = useState<Member[]>([]);
  const [isDbLoading, setIsDbLoading] = useState(false);
  const [remixData, setRemixData] = useState<PromptEntry | null>(null);
  
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<number>(0);
  const [networkError, setNetworkError] = useState<string | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const t = TRANSLATIONS[language];

  const hasInitialized = useRef(false);
  const currentUserRef = useRef<User | null>(null);

  const refreshData = async (targetUser?: User | null) => {
    const activeUserId = targetUser?.id || user?.id || 'anon';
    try {
      const entries = await StorageService.getAllEntries();
      const loadedPresets = await StorageService.getPresets(activeUserId);
      setAllEntries(entries || []);
      setPresets(loadedPresets || []);
      setNetworkError(null);
    } catch (err: unknown) {
      console.error("Refresh data failed:", err);
      const error = err as AppError;
      if (error.message && error.message.includes('Failed to fetch')) {
        setNetworkError(t.fetchError);
      }
    }
  };

  const syncOnLogin = async (loggedUser: User) => {
    setIsSyncing(true);
    setNetworkError(null);
    await SyncOrchestrator.syncOnLogin(
      loggedUser,
      (entries, presets) => {
        setAllEntries(entries);
        setPresets(presets);
        setLastSynced(Date.now());
        setIsSyncing(false);
      },
      (error) => {
        setNetworkError(error);
        setIsSyncing(false);
      }
    );
  };

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const handleAuthStateChange = async (event: string, session: { user?: { id: string } } | null) => {
      console.log(`[Auth] Event: ${event}, User: ${session?.user?.id || 'none'}`);
      
      try {
        if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') && session?.user) {
          // Check if we're already logged in as this user to prevent loops
          if (currentUserRef.current?.id === session.user.id) {
            console.log("[Auth] User already set, skipping...");
            setIsInitialLoading(false);
            return;
          }

          console.log("[Auth] Mapping user profile...");
          const mappedUser = await SupabaseService.mapUser(session.user);
          if (mappedUser) {
            console.log("[Auth] Setting user state:", mappedUser.username);
            currentUserRef.current = mappedUser;
            setUser(mappedUser);
            // Only switch view if we are on the gallery/login
            setView(prev => (prev === View.GALLERY ? View.STUDIO : prev));
            syncOnLogin(mappedUser);
          }
        } else if (event === 'SIGNED_OUT') {
          console.log("[Auth] User signed out, clearing state...");
          currentUserRef.current = null;
          setUser(null);
          setAllEntries([]);
          setView(View.GALLERY);
        }
      } catch (err) {
        console.error("[Auth] Handler error:", err);
      } finally {
        setIsInitialLoading(false);
      }
    };

    // Initial check with robust error handling
    const checkInitialSession = async () => {
      // Safety timeout: Guaranteed to clear loading screen after 5 seconds
      const safetyTimer = setTimeout(() => {
        console.warn("[Auth] Initialization safety timeout triggered");
        setIsInitialLoading(false);
      }, 5000);

      try {
        console.log("[Auth] Checking initial session...");
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        
        if (session) {
          console.log("[Auth] Initial session found");
          await handleAuthStateChange('INITIAL_SESSION', session);
        } else {
          console.log("[Auth] No initial session");
          setIsInitialLoading(false);
        }
      } catch (err: unknown) {
        console.error("[Auth] Initial session check failed:", err);
        if (err.message?.includes('Failed to fetch')) {
          setAuthError(language === 'zh' ? '無法連線至 Supabase，請檢查 VITE_SUPABASE_URL 是否正確。' : 'Cannot connect to Supabase. Please check VITE_SUPABASE_URL.');
        }
        setIsInitialLoading(false);
      } finally {
        clearTimeout(safetyTimer);
      }
    };

    checkInitialSession();

    // Listen for subsequent changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Use setTimeout to ensure we don't block the auth state change process
      setTimeout(() => handleAuthStateChange(event, session), 0);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleCloudSync = async () => {
    if (!user || user.id === 'anon') return;
    await SyncOrchestrator.performCloudSync(
      user.id,
      (entries) => {
        setAllEntries(entries);
        setLastSynced(Date.now());
      },
      (error) => {
        setNetworkError(error);
      }
    );
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthLoading(true);
    setAuthError(null);
    try {
      if (authMode === 'signup') {
        await AuthService.signUp(authForm.email, authForm.password);
        alert(language === 'zh' ? '註冊成功，請檢查您的電子郵件進行驗證。' : 'Sign up successful! Please check your email for verification.');
      } else {
        await AuthService.signIn(authForm.email, authForm.password);
      }
    } catch (err: unknown) {
      if (err.message && err.message.includes('Failed to fetch')) {
        setAuthError(language === 'zh' ? '網路連接失敗，請檢查您的網路設定。' : 'Network connection failed. Please check your internet connection.');
      } else {
        setAuthError(err.message || "Authentication failed.");
      }
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleGuestMode = () => {
    const guestUser: User = { id: 'anon', username: 'Guest', isAdmin: false };
    setUser(guestUser);
    setView(View.STUDIO);
    refreshData(guestUser);
  };

  const handleGoogleLogin = async () => {
    try {
      await AuthService.signInWithGoogle();
    } catch (err: unknown) {
      if (err.message && err.message.includes('Failed to fetch')) {
        setAuthError(language === 'zh' ? '網路連接失敗，請檢查您的網路設定。' : 'Network connection failed. Please check your internet connection.');
      } else {
        setAuthError(err.message);
      }
    }
  };

  const handleLogout = async () => {
    if (user?.id === 'anon') {
      setUser(null);
      setAllEntries([]);
      setView(View.GALLERY);
      return;
    }
    try {
      await AuthService.signOut();
    } catch (err: unknown) {
      console.error("Sign out error:", err);
      if (err.message && err.message.includes('Failed to fetch')) {
        setNetworkError(t.fetchError);
      }
    } finally {
      setUser(null);
      setAllEntries([]);
      setView(View.GALLERY);
    }
  };

  const handleSaveEntry = async (url: string, text: string, tags: string[], model: ModelChoice, config: GenerationConfig, aiTags: string[] = []) => {
    const combinedTags = Array.from(new Set([...tags, ...aiTags]));
    const entryId = crypto.randomUUID();
    const currentUserId = user?.id || 'anon';
    const entry: PromptEntry = { 
      id: entryId, 
      userId: currentUserId, 
      author: user?.username || 'Anon', 
      text, 
      tags: combinedTags, 
      timestamp: Date.now(), 
      imageUrl: url, 
      type: 'generation', 
      model, 
      config 
    };
    
    setAllEntries(prev => [entry, ...prev]);
    await StorageService.saveEntry(entry, currentUserId);
  };

  const handleStatsUpdate = useCallback((i: number, o: number) => {
    setUsageStats(prev => ({ sessionCount: prev.sessionCount + 1, lastInputTokens: i, lastOutputTokens: o, totalTokens: prev.totalTokens + i + o }));
  }, []);

  const handleRemix = (entry: PromptEntry) => {
    setRemixData(entry);
    setView(View.GENERATE);
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBulkDownload = async () => {
    const targets = allEntries.filter(e => selectedIds.has(e.id));
    if (targets.length === 0) return;
    setIsZipping(true);
    try {
      const zip = new JSZip();
      for (const e of targets) { 
        if (e.imageUrl) { 
          try {
            const r = await fetch(e.imageUrl);
            if (!r.ok) throw new Error(`HTTP error! status: ${r.status}`);
            zip.file(`${e.id.substring(0,8)}.png`, await r.blob()); 
          } catch (err: unknown) {
            console.error(`Failed to fetch image ${e.id}:`, err);
            if (err.message && err.message.includes('Failed to fetch')) {
              setNetworkError(t.fetchError);
            }
            // Continue with other images
          }
        } 
      }
      const content = await zip.generateAsync({type: 'blob'}); 
      const url = URL.createObjectURL(content);
      const l = document.createElement('a'); 
      l.href = url; 
      l.download = `studio-pack-${Date.now()}.zip`; 
      l.click();
    } catch (err: unknown) {
      console.error("ZIP creation failed:", err);
      if (err.message && err.message.includes('Failed to fetch')) {
        setNetworkError(t.fetchError);
      } else {
        alert("ZIP creation failed: " + (err.message || "Unknown error"));
      }
    } finally { 
      setIsZipping(false); 
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const confirm = window.confirm(language === 'zh' ? `確定要刪除選中的 ${selectedIds.size} 個項目嗎？` : `Delete ${selectedIds.size} selected items?`);
    if (!confirm) return;
    
    const currentUserId = user?.id || 'anon';
    for (const id of selectedIds) { 
      await StorageService.deleteEntry(id, currentUserId); 
    }
    setAllEntries(prev => prev.filter(e => !selectedIds.has(e.id)));
    setSelectedIds(new Set());
  };

  const handleExportData = () => {
    const data = { entries: allEntries, presets: presets, exportDate: new Date().toISOString(), version: '2.2.0' };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `gemini-studio-export-${Date.now()}.json`; link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setIsImporting(true);
    try {
      const text = await file.text(); 
      const data = JSON.parse(text);
      const currentUserId = user?.id || 'anon';
      if (data.entries && Array.isArray(data.entries)) {
        const chunk = (data.entries as PromptEntry[]).map((entry: PromptEntry) => ({
          ...entry,
          userId: currentUserId,
        }));
        await StorageService.saveEntries(chunk, currentUserId);
        await refreshData();
      }
      alert(t.importSuccess);
    } catch (err: unknown) { 
      console.error("Import failed:", err);
      if (err.message && err.message.includes('Failed to fetch')) {
        setNetworkError(t.fetchError);
      } else {
        alert(`${t.importError}: ${err.message}`); 
      }
    } finally {
      setIsImporting(false);
      e.target.value = '';
    }
  };

  const filtered = useMemo(() => {
    let res = (view === View.STUDIO || view === View.PROMPTS) ? allEntries.filter(e => e.userId === user?.id) : allEntries;
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      res = res.filter(e => e.text.toLowerCase().includes(lowerSearch) || e.tags?.some(tag => tag.toLowerCase().includes(lowerSearch)));
    }
    return res;
  }, [allEntries, view, user, searchTerm]);

  if (isInitialLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#050505]">
        <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-6"></div>
        <p className="text-gray-500 font-black uppercase tracking-[0.3em] text-[10px]">Synchronizing Library...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="relative glass w-full max-w-md p-10 rounded-[3rem] border-white/10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] z-10">
          <div className="text-center mb-10">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-purple-500 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20 mx-auto mb-6">
              <i className="fa-solid fa-layer-group text-white text-2xl"></i>
            </div>
            <h1 className="text-3xl font-black mb-2 tracking-tight text-white">{t.welcomeTitle}</h1>
            <p className="text-sm text-gray-500 font-medium leading-relaxed">{t.welcomeSubtitle}</p>
          </div>

          {authError && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl animate-in slide-in-from-top duration-300">
              <div className="flex items-start gap-3">
                <i className="fa-solid fa-circle-exclamation text-red-500 mt-1"></i>
                <p className="text-xs text-red-400 font-bold leading-relaxed">{authError}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            <div className="relative group">
               <i className="fa-solid fa-envelope absolute left-5 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-indigo-400 transition-colors"></i>
               <input type="email" placeholder={t.emailPlaceholder} required value={authForm.email} onChange={e => setAuthForm({...authForm, email: e.target.value})} className="w-full bg-white/[0.03] border border-white/10 rounded-2xl pl-14 pr-6 py-4 outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all text-sm font-medium" />
            </div>
            <div className="relative group">
               <i className="fa-solid fa-lock absolute left-5 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-indigo-400 transition-colors"></i>
               <input type="password" placeholder={t.passwordPlaceholder} required value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})} className="w-full bg-white/[0.03] border border-white/10 rounded-2xl pl-14 pr-6 py-4 outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all text-sm font-medium" />
            </div>
            <button type="submit" disabled={isAuthLoading} className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-black text-xs uppercase shadow-xl transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center">
              {isAuthLoading && <i className="fa-solid fa-spinner fa-spin mr-3"></i>}
              {authMode === 'login' ? t.signIn : t.signUp}
            </button>
          </form>

          <div className="mt-4">
            <button 
              onClick={handleGuestMode}
              className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all text-gray-400"
            >
              <i className="fa-solid fa-user-secret mr-2"></i> {t.guestMode}
            </button>
          </div>

          <div className="relative my-10">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10"></div></div>
            <div className="relative flex justify-center text-[10px] uppercase font-bold text-gray-500"><span className="bg-[#0c0c0c] px-4">Social Access</span></div>
          </div>
          <button onClick={handleGoogleLogin} className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-3 mb-8">
            <i className="fa-brands fa-google text-lg text-white"></i>
            {t.googleLogin}
          </button>
          <div className="text-center">
            <button onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')} className="text-indigo-400 text-sm font-bold hover:text-indigo-300 transition-colors">
              {authMode === 'login' ? t.noAccount : t.alreadyHaveAccount}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#050505] text-gray-100 relative">
      <Sidebar currentView={view} onViewChange={setView} user={user} isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} onSyncClick={handleCloudSync} isSyncing={isSyncing} lastSynced={lastSynced} t={t} />
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {networkError && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[150] flex items-center gap-3 bg-red-500/90 backdrop-blur-md text-white px-6 py-3 rounded-2xl shadow-2xl border border-red-400/50 animate-in slide-in-from-top duration-300">
            <i className="fa-solid fa-triangle-exclamation"></i>
            <span className="text-xs font-bold">{networkError}</span>
            <button onClick={() => setNetworkError(null)} className="ml-2 hover:text-white/70">
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        )}
        <header className="px-8 py-5 border-b border-white/5 flex justify-between items-center bg-[#0a0a0a]/50 backdrop-blur-xl z-10">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="md:hidden"><i className="fa-solid fa-bars"></i></button>
            <h2 className="text-xl font-bold tracking-tight capitalize">{t[view as keyof typeof t] || view}</h2>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => setShowHelp(true)} className="px-4 py-2 bg-indigo-500/10 text-indigo-400 rounded-full text-xs font-bold"><i className="fa-solid fa-circle-question mr-2"></i>{t.help}</button>
            <button onClick={() => setLanguage(language === 'en' ? 'zh' : 'en')} className="px-4 py-2 bg-white/5 rounded-full text-xs font-bold">{(language === 'en' ? 'EN' : '中文')}</button>
            <div className="flex items-center gap-3 px-3 py-2 rounded-full glass border-indigo-500/20">
              <span className="text-sm font-medium">{user.username}</span>
              <button onClick={handleLogout} className="hover:text-red-400 transition-colors">
                <i className="fa-solid fa-right-from-bracket text-gray-400"></i>
              </button>
            </div>
          </div>
        </header>
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-8 scrollbar-hide relative">
          {view === View.GENERATE && (
            <GenerateView language={language} t={t} usageStats={usageStats} onStatsUpdate={handleStatsUpdate} onSave={handleSaveEntry} onSavePreset={(p) => {StorageService.savePreset(p, user.id).then(() => refreshData(user));}} user={user} onAuthRequired={() => {}} initialData={remixData} onClearInitialData={() => setRemixData(null)} />
          )}
          {view === View.EDIT && <EditView language={language} t={t} usageStats={usageStats} onStatsUpdate={handleStatsUpdate} onSave={async (items, p, tags, m, config) => {
              const currentUserId = user?.id || 'anon';
              const entries = items.map(item => ({
                id: crypto.randomUUID(),
                userId: currentUserId,
                author: user?.username || 'Anon',
                text: p,
                tags: Array.from(new Set([...tags, ...item.aiTags])),
                timestamp: Date.now(),
                imageUrl: item.url,
                type: 'edit' as const,
                model: m,
                config
              }));
              await StorageService.saveEntries(entries, currentUserId);
              setAllEntries(prev => [...entries.slice().reverse(), ...prev]);
            }} user={user} />}
          {view === View.AVATAR && <AvatarView language={language} t={t} usageStats={usageStats} onStatsUpdate={handleStatsUpdate} onSave={async (items, p, tags, m, config) => {
              const currentUserId = user?.id || 'anon';
              const entries = items.map(item => ({
                id: crypto.randomUUID(),
                userId: currentUserId,
                author: user?.username || 'Anon',
                text: p,
                tags: Array.from(new Set([...tags, ...item.aiTags])),
                timestamp: Date.now(),
                imageUrl: item.url,
                type: 'avatar' as const,
                model: m,
                config
              }));
              await StorageService.saveEntries(entries, currentUserId);
              setAllEntries(prev => [...entries.slice().reverse(), ...prev]);
            }} user={user} />}
          {view === View.KEY_WALLET && <KeyWallet t={t} />}
          {(view === View.GALLERY || view === View.STUDIO || view === View.PROMPTS) && (
            <GalleryGrid language={language} entries={filtered} onDelete={async (id) => {
              await StorageService.deleteEntry(id, user?.id); 
              setAllEntries(prev => prev.filter(e => e.id !== id));
            }} onBulkDelete={handleBulkDelete} user={user} searchTerm={searchTerm} setSearchTerm={setSearchTerm} selectedIds={selectedIds} toggleSelect={(id) => setSelectedIds(prev => {const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;})} selectAll={() => setSelectedIds(new Set(filtered.map(e => e.id)))} deselectAll={() => setSelectedIds(new Set())} onBulkDownload={handleBulkDownload} onImport={handleImportData} onExport={handleExportData} isZipping={isZipping} t={t} isPromptView={view === View.PROMPTS} onRemix={handleRemix} />
          )}
          {view === View.PRESETS && <PresetsList presets={presets} onDelete={(id) => {StorageService.deleteEntry(id, user?.id).then(() => refreshData(user));}} t={t} />}
          {view === View.DATABASE && user && <MembersDB members={members} isLoading={isDbLoading} t={t} />}
        </div>
        
        {/* Floating Scroll Navigation Buttons */}
        <div className="fixed bottom-10 right-10 flex flex-col gap-4 z-[110]">
          <button 
            onClick={() => scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
            className="w-12 h-12 bg-indigo-600/90 hover:bg-indigo-600 text-white rounded-2xl flex items-center justify-center backdrop-blur-xl shadow-2xl transition-all active:scale-90 border border-white/10 group"
            title="Scroll to Top"
          >
            <i className="fa-solid fa-arrow-up group-hover:-translate-y-1 transition-transform"></i>
          </button>
          <button 
            onClick={() => {
              if (scrollContainerRef.current) {
                scrollContainerRef.current.scrollTo({ 
                  top: scrollContainerRef.current.scrollHeight, 
                  behavior: 'smooth' 
                });
              }
            }}
            className="w-12 h-12 bg-white/10 hover:bg-white/20 text-white rounded-2xl flex items-center justify-center backdrop-blur-xl shadow-2xl transition-all active:scale-90 border border-white/10 group"
            title="Scroll to Bottom"
          >
            <i className="fa-solid fa-arrow-down group-hover:translate-y-1 transition-transform"></i>
          </button>
        </div>
      </main>
      
      {isSyncing && (
        <div className="fixed bottom-10 left-10 z-[100] flex items-center gap-3 bg-indigo-600 px-5 py-3 rounded-2xl shadow-2xl animate-in slide-in-from-left duration-300">
           <i className="fa-solid fa-cloud-arrow-up animate-bounce"></i>
           <div className="flex flex-col">
             <span className="text-[10px] font-black uppercase tracking-widest opacity-70">{t.syncing}</span>
             <span className="text-[9px] font-medium opacity-50">Background Process</span>
           </div>
           <button 
             onClick={() => setIsSyncing(false)} 
             className="ml-2 w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
             title="Hide Indicator"
           >
             <i className="fa-solid fa-xmark text-[10px]"></i>
           </button>
        </div>
      )}
    </div>
  );
};

export default App;