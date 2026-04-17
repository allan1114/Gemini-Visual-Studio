import React, { useState, useRef, useEffect } from 'react';
import { useImageSynthesis, ExtendedPreview } from '../hooks/useImageSynthesis';
import { TuningControls, UsageCard } from './Shared';
import PromptBuilder from './PromptBuilder';
import { Language, AspectRatio, ImageSize, ModelChoice, UsageStats, PromptEntry } from '../types';
import { GeminiService } from '../services/geminiService';

interface GenerateViewProps {
  language: Language;
  t: any;
  usageStats: UsageStats;
  onStatsUpdate: (i: number, o: number) => void;
  onSave: (url: string, prompt: string, tags: string[], model: ModelChoice, config: any, aiTags: string[]) => Promise<void>;
  onSavePreset: (data: any) => void;
  user: any;
  onAuthRequired: () => void;
  initialData?: PromptEntry | null;
  onClearInitialData?: () => void;
}

const MAX_PROMPT_CHARS = 3000;
const QUALITY_MODIFIERS = "sharp focus, focus on model, detailed textures";
const DEFAULT_NEGATIVE = "避免低飽和、多餘四肢、惡劣照明、模糊噪音、卡通插圖、動漫3D、扭曲解蓬、過度磨皮、塑膠感皮膚、過度銳化、人物擠、錯數量比例、服飾皮膚粗糙、色調失和不足、形體失真、姿勢僵硬、配件突兀、場景雜亂、臉部扭曲、五官錯位、比例異常、多手指、多肢體、避免Al感、不要加入text除非prompt有要求。";

const GenerateView: React.FC<GenerateViewProps> = ({ 
  language, t, usageStats, onStatsUpdate, onSave, onSavePreset, user, onAuthRequired, initialData, onClearInitialData 
}) => {
  const [prompt, setPrompt] = useState('');
  const [chips, setChips] = useState<any[]>([]);
  const [negativePrompt, setNegativePrompt] = useState(DEFAULT_NEGATIVE);
  const [model, setModel] = useState<ModelChoice>('flash');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [imageSize, setImageSize] = useState<ImageSize>('1K');
  const [seed, setSeed] = useState<number | undefined>(undefined);
  const [temperature, setTemperature] = useState<number>(1.0);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isExpanding, setIsExpanding] = useState(false);
  const [storingIds, setStoringIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [isDragOver, setIsDragOver] = useState(false);
  const [isPromptFocused, setIsPromptFocused] = useState(false);
  const [selectedPreviewIdx, setSelectedPreviewIdx] = useState(0);
  const [hasStudioKey, setHasStudioKey] = useState(true);

  useEffect(() => {
    if ((window as any).aistudio) {
      (window as any).aistudio.hasSelectedApiKey().then(setHasStudioKey);
    }
  }, []);

  const handleSelectKey = async () => {
    if ((window as any).aistudio) {
      await (window as any).aistudio.openSelectKey();
      const has = await (window as any).aistudio.hasSelectedApiKey();
      setHasStudioKey(has);
    }
  };

  const { isLoading, previews, error, generateSingle, setPreviews } = useImageSynthesis(onStatsUpdate);
  const promptFileInputRef = useRef<HTMLInputElement>(null);

  // Handle Initial Remix Data
  useEffect(() => {
    if (initialData) {
      setPrompt(initialData.text || '');
      setNegativePrompt(initialData.negativePrompt || DEFAULT_NEGATIVE);
      setModel(initialData.model || 'flash');
      if (initialData.config) {
        setAspectRatio(initialData.config.aspectRatio || '1:1');
        setImageSize(initialData.config.size || '1K');
        setSeed(initialData.config.seed);
        setTemperature(initialData.config.temperature || 1.0);
      }
      // Reconstruct chips if possible
      if (initialData.tags && initialData.tags.length > 0) {
        setChips(initialData.tags.map(tag => ({
          id: crypto.randomUUID(),
          label: tag,
          value: tag,
          icon: 'fa-tag',
          color: 'from-indigo-600 to-purple-600'
        })));
      }
      // Cleanup remix source
      if (onClearInitialData) onClearInitialData();
    }
  }, [initialData, onClearInitialData]);

  const handleManifest = async () => {
    const combinedTags = chips.map(c => c.value).join(', ');
    const fullPrompt = [prompt, combinedTags, QUALITY_MODIFIERS].filter(Boolean).join(', ');
    if (!fullPrompt.trim()) return;
    setSavedIds(new Set());
    setSelectedPreviewIdx(0);
    // Force single generation per request as per requirements
    await generateSingle(fullPrompt, { model, aspectRatio, imageSize, negativePrompt, seed, temperature });
  };

  const handleExpandPrompt = async () => {
    if (!prompt.trim()) return;
    setIsExpanding(true);
    try {
      const refined = await GeminiService.expandPrompt(prompt);
      setPrompt(refined);
    } catch (err) {
      console.error(err);
    } finally {
      setIsExpanding(false);
    }
  };

  const handleSaveItem = async (item: ExtendedPreview) => {
    if (savedIds.has(item.id)) return;
    setStoringIds(prev => new Set(prev).add(item.id));
    try {
      const combinedTags = chips.map(c => c.label);
      await onSave(
        item.url, 
        prompt, 
        combinedTags, 
        model, 
        { aspectRatio, imageSize, seed, temperature },
        item.aiTags
      );
      setSavedIds(prev => new Set(prev).add(item.id));
    } finally {
      setStoringIds(prev => {
        const n = new Set(prev);
        n.delete(item.id);
        return n;
      });
    }
  };

  const handleSaveAll = async () => {
    for (const item of previews) {
      if (!savedIds.has(item.id)) {
        await handleSaveItem(item);
      }
    }
  };

  const handleSuggest = async () => {
    setIsSuggesting(true);
    try {
      const suggest = await GeminiService.suggestPrompt();
      setPrompt(suggest);
    } finally {
      setIsSuggesting(false);
    }
  };

  const onAddTag = (value: string, label: string, icon?: string, color?: string) => {
    setChips(prev => [...prev, { id: crypto.randomUUID(), value, label, icon, color }]);
  };

  const getRatioClass = (ratio: AspectRatio) => {
    switch (ratio) {
      case '1:1': return 'aspect-square';
      case '3:4': return 'aspect-[3/4]';
      case '4:3': return 'aspect-[4/3]';
      case '9:16': return 'aspect-[9/16]';
      case '16:9': return 'aspect-[16/9]';
      default: return 'aspect-square';
    }
  };

  return (
    <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in">
      <div className="lg:col-span-8 space-y-8">
        <div className="glass p-8 rounded-[2.5rem] border-white/10 space-y-8 relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500/5 blur-[100px] pointer-events-none"></div>
          
          <div className="flex justify-between items-center relative z-10">
            <h3 className="text-xl font-black flex items-center gap-3"><i className="fa-solid fa-layer-group text-indigo-400"></i>{t.construction}</h3>
            <div className="flex gap-4">
              <button onClick={() => promptFileInputRef.current?.click()} className="text-indigo-400 hover:text-indigo-300 text-[10px] font-bold uppercase transition-colors flex items-center gap-1"><i className="fa-solid fa-file-arrow-up"></i> {t.uploadPrompt}</button>
              <button onClick={() => {setPrompt(''); setChips([]);}} className="text-gray-500 hover:text-red-400 text-[10px] font-bold uppercase transition-colors flex items-center gap-1"><i className="fa-solid fa-trash"></i> Clear</button>
            </div>
          </div>
          {/* Fix: Removed non-standard attributes causing TypeScript errors */}
          <input type="file" ref={promptFileInputRef} className="hidden" accept=".txt,.json" onChange={async (e) => {
            const file = e.target.files?.[0]; if(!file) return;
            const text = await file.text(); setPrompt(text);
          }} />

          <div className="space-y-6 relative z-10">
            <div 
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => {
                e.preventDefault(); setIsDragOver(false);
                const tagData = e.dataTransfer.getData('application/gvs-tag');
                if (!tagData) return;
                const tag = JSON.parse(tagData);
                if(tag) onAddTag(tag.value, tag.label, tag.icon, tag.color);
              }}
              className={`min-h-[160px] p-6 rounded-[2.5rem] border-2 border-dashed transition-all flex flex-wrap gap-3 items-center justify-center relative overflow-hidden ${isDragOver ? 'bg-indigo-500/10 border-indigo-500 scale-[1.01] shadow-[0_0_40px_rgba(99,102,241,0.1)]' : 'bg-black/40 border-white/5 hover:border-white/10'}`}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none"></div>
              {chips.length === 0 && <p className="text-gray-600 text-xs font-black uppercase tracking-[0.2em] pointer-events-none">{t.dropHint}</p>}
              {chips.map((b) => (
                <div key={b.id} className={`px-4 py-2.5 bg-gradient-to-br ${b.color || 'from-indigo-600 to-purple-600'} rounded-2xl flex items-center gap-2 shadow-xl shadow-black/20 group animate-in zoom-in duration-200`}>
                  <i className={`fa-solid ${b.icon || 'fa-tag'} text-[10px]`}></i>
                  <span className="text-[10px] font-black uppercase tracking-tight">{b.label}</span>
                  <button onClick={() => setChips(prev => prev.filter(c => c.id !== b.id))} className="ml-1 opacity-50 hover:opacity-100 transition-opacity"><i className="fa-solid fa-circle-xmark"></i></button>
                </div>
              ))}
            </div>

            <div className={`transition-all duration-500 p-[1px] rounded-[2rem] bg-gradient-to-b ${isPromptFocused ? 'from-indigo-500 via-purple-500 to-indigo-500 shadow-[0_0_50px_rgba(99,102,241,0.15)]' : 'from-white/10 to-transparent'}`}>
              <div className="bg-[#0c0c0c] rounded-[2rem] p-6 space-y-4 relative overflow-hidden group/prompt">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(99,102,241,0.05),transparent_70%)] pointer-events-none"></div>
                
                <div className="relative z-10">
                  <textarea 
                    value={prompt} 
                    onFocus={() => setIsPromptFocused(true)}
                    onBlur={() => setIsPromptFocused(false)}
                    onChange={(e) => setPrompt(e.target.value.slice(0, MAX_PROMPT_CHARS))} 
                    placeholder={t.subjectPlaceholder} 
                    rows={2} 
                    className="w-full bg-transparent border-none py-2 pr-14 text-xl outline-none transition-all font-semibold placeholder:text-gray-700 resize-y min-h-[60px] scrollbar-hide text-white leading-relaxed" 
                  />
                  <button 
                    onClick={handleExpandPrompt}
                    disabled={isExpanding || !prompt.trim()}
                    title={t.expandPrompt}
                    className="absolute right-0 top-0 w-12 h-12 flex items-center justify-center bg-indigo-500/10 hover:bg-indigo-600 hover:text-white text-indigo-400 rounded-2xl transition-all disabled:opacity-30 active:scale-90 shadow-lg"
                  >
                    {isExpanding ? <i className="fa-solid fa-wand-sparkles fa-spin text-lg"></i> : <i className="fa-solid fa-wand-magic-sparkles text-lg"></i>}
                  </button>
                </div>

                <div className="flex items-center justify-between gap-4 pt-2 relative z-10">
                  <button 
                    onClick={handleSuggest} 
                    disabled={isSuggesting} 
                    className="flex-1 py-3.5 bg-white/[0.03] hover:bg-white/[0.08] text-indigo-400/90 rounded-2xl border border-white/5 transition-all text-[10px] font-black uppercase tracking-[0.25em] flex items-center justify-center gap-2 group/inspire active:scale-[0.98]"
                  >
                    {isSuggesting ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-lightbulb group-hover/inspire:scale-110 transition-transform"></i>} {t.inspire}
                  </button>
                  <div className="text-[10px] font-bold text-gray-700 uppercase tabular-nums">
                    {prompt.length} / {MAX_PROMPT_CHARS}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-black text-red-500/50 uppercase tracking-[0.2em] flex items-center gap-2">
                <i className="fa-solid fa-circle-minus"></i> {t.negativeLabel}
              </label>
              <textarea 
                value={negativePrompt} 
                onChange={(e) => setNegativePrompt(e.target.value)} 
                className="w-full bg-black/40 border border-white/5 rounded-[1.5rem] p-5 h-24 text-[11px] outline-none resize-y focus:border-red-500/30 transition-colors text-gray-400 font-medium" 
              />
            </div>
          </div>

          <button 
            onClick={handleManifest} 
            disabled={isLoading || (!prompt.trim() && chips.length === 0) || (model === 'pro' && (window as any).aistudio && !hasStudioKey)} 
            className="w-full py-7 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 rounded-[2rem] font-black text-xs tracking-[0.3em] uppercase shadow-[0_20px_40px_-15px_rgba(99,102,241,0.4)] transition-all hover:scale-[1.01] active:scale-95 disabled:opacity-30 disabled:hover:scale-100 flex items-center justify-center group/gen"
          >
            {isLoading ? <i className="fa-solid fa-circle-notch fa-spin mr-3 text-lg"></i> : <i className="fa-solid fa-sparkles mr-3 text-lg group-hover/gen:rotate-12 transition-transform"></i>}
            {isLoading ? t.synthesizing : t.manifest}
          </button>

          {(window as any).aistudio && !hasStudioKey && model === 'pro' && (
            <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <i className="fa-solid fa-triangle-exclamation text-amber-500"></i>
                <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">
                  {language === 'zh' ? '尚未選擇 API 金鑰' : 'No API Key Selected'}
                </p>
              </div>
              <button 
                onClick={handleSelectKey}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-[9px] font-black uppercase rounded-xl transition-all"
              >
                {language === 'zh' ? '立即選擇' : 'Select Now'}
              </button>
            </div>
          )}
        </div>

        {user && <PromptBuilder onAdd={onAddTag} language={language} />}

        {isLoading && previews.length === 0 && (
          <div className={`glass p-4 rounded-[2.5rem] border-white/10 shadow-2xl bg-white/[0.02] animate-pulse`}>
            <div className={`w-full ${getRatioClass(aspectRatio)} bg-white/5 rounded-[2rem] flex flex-col items-center justify-center gap-4 relative overflow-hidden`}>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent -translate-x-full animate-[shimmer_2s_infinite]"></div>
              <i className="fa-solid fa-sparkles text-indigo-500/20 text-6xl"></i>
              <div className="flex flex-col items-center">
                <p className="text-indigo-400/40 text-[10px] font-black uppercase tracking-[0.3em]">{t.synthesizing}</p>
                <div className="w-32 h-1 bg-white/5 rounded-full mt-4 overflow-hidden">
                  <div className="h-full bg-indigo-500/40 w-1/3 animate-[loading-bar_1.5s_infinite_ease-in-out]"></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {previews.length > 0 && (
          <div className="glass p-8 rounded-[3rem] space-y-8 animate-in slide-in-from-bottom duration-500 shadow-2xl bg-gradient-to-b from-transparent to-indigo-500/5 border border-indigo-500/10">
            {previews.length > 1 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {previews.map((p, idx) => (
                  <button 
                    key={p.id} 
                    onClick={() => setSelectedPreviewIdx(idx)}
                    className={`relative rounded-2xl overflow-hidden aspect-square border-2 transition-all group ${selectedPreviewIdx === idx ? 'border-indigo-500 scale-105 shadow-xl shadow-indigo-500/30' : 'border-white/10 opacity-60 hover:opacity-100'}`}
                  >
                    <img src={p.url} className="w-full h-full object-cover" alt={`Preview ${idx + 1}`} />
                    {savedIds.has(p.id) && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <i className="fa-solid fa-check-circle text-green-400 text-3xl"></i>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="relative group/img-preview">
              <img src={previews[selectedPreviewIdx]?.url} className="w-full rounded-[2.5rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] border border-white/10 transition-transform duration-700" alt="Result" />
            </div>
            
            {previews[selectedPreviewIdx]?.aiDescription && (
              <div className="p-6 bg-indigo-500/5 border border-indigo-500/10 rounded-[1.5rem] italic text-sm text-gray-300 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                <i className="fa-solid fa-quote-left text-indigo-500/20 absolute top-4 right-4 text-4xl"></i>
                <p className="relative z-10">"{previews[selectedPreviewIdx].aiDescription}"</p>
              </div>
            )}

            <div className="flex flex-wrap gap-4">
              <button 
                onClick={() => handleSaveItem(previews[selectedPreviewIdx])} 
                disabled={storingIds.has(previews[selectedPreviewIdx].id) || savedIds.has(previews[selectedPreviewIdx].id)} 
                className={`flex-1 py-5 rounded-2xl font-black text-xs tracking-widest uppercase shadow-xl transition-all ${savedIds.has(previews[selectedPreviewIdx].id) ? 'bg-green-600/50 cursor-default' : 'bg-green-600 hover:bg-green-500 hover:shadow-green-500/20 active:scale-95'}`}
              >
                {storingIds.has(previews[selectedPreviewIdx].id) ? <i className="fa-solid fa-circle-notch fa-spin mr-2"></i> : (savedIds.has(previews[selectedPreviewIdx].id) ? <i className="fa-solid fa-check mr-2"></i> : null)} 
                {storingIds.has(previews[selectedPreviewIdx].id) ? t.storing : (savedIds.has(previews[selectedPreviewIdx].id) ? t.saved : t.store)}
              </button>
              
              {previews.length > 1 && (
                <button onClick={handleSaveAll} className="flex-1 py-5 bg-purple-600 hover:bg-purple-500 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95">
                  <i className="fa-solid fa-images mr-2"></i> {t.saveAll}
                </button>
              )}

              <button onClick={() => onSavePreset({ prompt, chips: chips.map(c => c.label), model, aspectRatio, imageSize, negativePrompt, temperature })} className="flex-1 py-5 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 rounded-2xl font-black text-xs uppercase tracking-widest text-indigo-400 transition-all hover:shadow-indigo-500/10 active:scale-95">
                <i className="fa-solid fa-bookmark mr-2"></i> {t.savePreset}
              </button>
              
              <button onClick={() => setPreviews([])} className="px-8 py-5 bg-red-500/10 hover:bg-red-500/20 rounded-2xl text-red-400 border border-red-500/20 transition-all active:scale-95"><i className="fa-solid fa-trash"></i></button>
            </div>
          </div>
        )}
        {error && <div className="p-6 bg-red-500/10 border border-red-500/20 text-red-400 rounded-[1.5rem] text-xs font-bold animate-in slide-in-from-top"><i className="fa-solid fa-circle-exclamation mr-2"></i> {error}</div>}
      </div>
      <div className="lg:col-span-4 space-y-6">
        <div className="glass p-8 rounded-[2rem] border-white/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-[50px] pointer-events-none"></div>
          <h3 className="font-black mb-6 text-[10px] uppercase tracking-[0.2em] text-indigo-400 border-b border-white/5 pb-4 relative z-10">{t.tuning}</h3>
          <div className="relative z-10">
            <TuningControls currentModel={model} onModelChange={setModel} showRatio={true} currentRatio={aspectRatio} onRatioChange={setAspectRatio} seed={seed} onSeedChange={setSeed} temperature={temperature} onTempChange={setTemperature} t={t} />
          </div>
        </div>
        <UsageCard stats={usageStats} currentModel={model} t={t} />
      </div>

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes loading-bar {
          0% { transform: translateX(-100%); width: 20%; }
          50% { width: 50%; }
          100% { transform: translateX(200%); width: 20%; }
        }
      `}</style>
    </div>
  );
};

export default GenerateView;