import React, { useState } from 'react';
import { STORAGE_KEYS } from '../constants';
import { ApiKeyRecord } from '../types';

interface Props {
  onComplete: () => void;
  onGuestMode?: () => void;
  language: 'en' | 'zh';
}

export default function ApiKeySetup({ onComplete, onGuestMode, language }: Props) {
  const zh = language === 'zh';
  const [geminiKey, setGeminiKey] = useState('');
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    if (!geminiKey.trim()) {
      setError(zh ? '請輸入 Gemini API Key（必填）' : 'Gemini API Key is required');
      return;
    }

    setSaving(true);

    const keyRecord: ApiKeyRecord = {
      id: crypto.randomUUID(),
      key: geminiKey.trim(),
      label: 'Default',
      isActive: true,
      status: 'unknown',
    };
    localStorage.setItem(STORAGE_KEYS.API_KEYS, JSON.stringify([keyRecord]));

    const supabaseChanged = supabaseUrl.trim() || supabaseAnonKey.trim();
    if (supabaseChanged) {
      localStorage.setItem('gvs_supabase_config', JSON.stringify({
        url: supabaseUrl.trim(),
        anonKey: supabaseAnonKey.trim(),
      }));
    }

    if (supabaseChanged) {
      window.location.reload();
    } else {
      onComplete();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0a0a] p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-4">
            <i className="fa-solid fa-key text-2xl text-white"></i>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            {zh ? '設定 API Keys' : 'Configure API Keys'}
          </h1>
          <p className="text-gray-400 text-sm">
            {zh
              ? 'Keys 只會保存在你的瀏覽器本地，不會上傳到任何伺服器'
              : 'Keys are saved locally in your browser only — never uploaded anywhere'}
          </p>
        </div>

        <div className="space-y-6">
          {/* Gemini Key */}
          <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
            <div className="flex items-center gap-2 mb-3">
              <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-400 text-xs font-bold rounded-full">
                {zh ? '必填' : 'Required'}
              </span>
              <h2 className="text-white font-semibold">Gemini API Key</h2>
            </div>
            <input
              type="password"
              value={geminiKey}
              onChange={e => { setGeminiKey(e.target.value); setError(''); }}
              placeholder="AIza..."
              className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
            />
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-xs text-indigo-400 hover:text-indigo-300"
            >
              <i className="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
              {zh ? '免費取得 Key' : 'Get free key'}
            </a>
          </div>

          {/* Supabase Keys */}
          <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
            <div className="flex items-center gap-2 mb-3">
              <span className="px-2 py-0.5 bg-gray-500/20 text-gray-400 text-xs font-bold rounded-full">
                {zh ? '可選' : 'Optional'}
              </span>
              <h2 className="text-white font-semibold">Supabase {zh ? '（雲端同步）' : '(Cloud sync)'}</h2>
            </div>
            <div className="space-y-3">
              <input
                type="text"
                value={supabaseUrl}
                onChange={e => setSupabaseUrl(e.target.value)}
                placeholder="https://your-project.supabase.co"
                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-white/20 transition-colors"
              />
              <input
                type="password"
                value={supabaseAnonKey}
                onChange={e => setSupabaseAnonKey(e.target.value)}
                placeholder={zh ? 'Supabase Anon Key' : 'Supabase Anon Key'}
                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-white/20 transition-colors"
              />
            </div>
            <p className="mt-2 text-xs text-gray-600">
              {zh ? '不填則使用本地儲存，資料不會同步到雲端' : 'Leave blank to use local storage only'}
            </p>
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold rounded-xl hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
          >
            {saving ? (zh ? '儲存中...' : 'Saving...') : (zh ? '開始使用' : 'Get Started')}
          </button>

          {onGuestMode && (
            <button
              onClick={onGuestMode}
              className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-gray-500 hover:text-gray-300 text-xs font-bold uppercase tracking-widest transition-all"
            >
              <i className="fa-solid fa-user-secret mr-2"></i>
              {zh ? '跳過，以訪客身份繼續' : 'Skip & Continue as Guest'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
