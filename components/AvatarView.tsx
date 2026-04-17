
import React, { useState } from 'react';
import { useImageSynthesis } from '../hooks/useImageSynthesis';
import { TuningControls, UsageCard } from './Shared';
import PromptBuilder from './PromptBuilder';
import { GeminiService } from '../services/geminiService';
import { ImageProcessingService } from '../services/imageProcessingService';
import { Language, AspectRatio, ImageSize, ModelChoice, UsageStats } from '../types';
import { AVATAR_STYLES } from '../constants';

interface AvatarViewProps {
  language: Language;
  t: any;
  usageStats: UsageStats;
  onStatsUpdate: (i: number, o: number) => void;
  onSave: (items: {url: string, aiTags: string[]}[], prompt: string, tags: string[], model: ModelChoice, config: any) => Promise<void>;
  user: any;
}

const DEFAULT_NEGATIVE = "避免低飽和、多餘四肢、惡劣照明、模糊噪音、卡通插圖、動漫3D、扭曲解蓬、過度磨皮、塑膠感皮膚、過度銳化、人物擠、錯數量比例、服飾皮膚粗糙、色調失和不足、形體失真、姿勢僵硬、配件突兀、場景雜亂、臉部扭曲、五官錯位、比例異常、多手指、多肢體、避免Al感、不要加入text除非prompt有要求。";

const AvatarView: React.FC<AvatarViewProps> = ({ language, t, usageStats, onStatsUpdate, onSave, user }) => {
  const [sourceImg, setSourceImg] = useState<{url: string, mime: string} | null>(null);
  const [mode, setMode] = useState<'transform' | 'scratch'>('transform');
  const [prompt, setPrompt] = useState('');
  const [chips, setChips] = useState<any[]>([]);
  const [styleId, setStyleId] = useState(AVATAR_STYLES[0].id);
  const [negativePrompt, setNegativePrompt] = useState(DEFAULT_NEGATIVE);
  const [model, setModel] = useState<ModelChoice>('flash');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [imageSize, setImageSize] = useState<ImageSize>('1K');
  const [seed, setSeed] = useState<number | undefined>(undefined);
  const [temperature, setTemperature] = useState<number>(1.0);
  const [isStoring, setIsStoring] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const { isLoading, previews, error, generateSingle, setPreviews } = useImageSynthesis(onStatsUpdate);

  const onAddTag = (value: string, label: string, icon?: string, color?: string) => {
    setChips(prev => [...prev, { id: crypto.randomUUID(), value, label, icon, color }]);
  };

  const handleManifest = async () => {
    if (mode === 'transform' && !sourceImg) return;
    const styleData = AVATAR_STYLES.find(s => s.id === styleId);
    const combinedTags = chips.map(c => c.value).join(', ');
    const finalPrompt = [prompt, combinedTags, styleData?.prompt].filter(Boolean).join(', ');
    setIsSaved(false);
    await generateSingle(
      finalPrompt, 
      { model, aspectRatio, imageSize, negativePrompt, seed, temperature }, 
      mode === 'transform' ? { ...sourceImg!, type: 'avatar' } : undefined
    );
  };

  const handleSaveResult = async () => {
    if (previews.length === 0) return;
    setIsStoring(true);
    try {
      const saveItems = previews.map(p => ({ url: p.url, aiTags: p.aiTags }));
      await onSave(saveItems, prompt, chips.map(c => c.label), model, { aspectRatio, imageSize, seed, temperature });
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } finally {
      setIsStoring(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in">
      <div className="lg:col-span-8 space-y-8">
        <div className="glass p-8 rounded-[2.5rem] space-y-8 border-indigo-500/10 bg-gradient-to-tr from-transparent via-indigo-500/[0.01] to-transparent shadow-2xl">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-black flex items-center gap-3"><i className="fa-solid fa-user-astronaut text-indigo-400"></i>{t.avatar}</h3>
            <button onClick={() => {setPrompt(''); setChips([]);}} className="text-gray-500 hover:text-red-400 text-[10px] font-bold uppercase"><i className="fa-solid fa-trash mr-1"></i> Clear</button>
          </div>
          <div className="flex gap-4 p-1 bg-black/40 rounded-2xl border border-white/5">
            <button onClick={() => setMode('transform')} className={`flex-1 py-3 rounded-xl text-xs font-bold uppercase transition-all ${mode === 'transform' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}>{t.transformPhoto}</button>
            <button onClick={() => setMode('scratch')} className={`flex-1 py-3 rounded-xl text-xs font-bold uppercase transition-all ${mode === 'scratch' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}>{t.createFromScratch}</button>
          </div>
          {mode === 'transform' && (
            <div className="glass p-8 border-dashed border-2 border-indigo-500/20 rounded-3xl flex items-center justify-center relative overflow-hidden bg-black/20 group">
              {!sourceImg ? (
                <div className="text-center py-4">
                  <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={async (e) => {
                    const f = e.target.files?.[0]; if(!f) return;
                    const r = new FileReader(); r.onload = async (ev) => {
                      const rawUrl = ev.target?.result as string;
                      const optimizedUrl = await ImageProcessingService.processToWebP(rawUrl);
                      setSourceImg({url: optimizedUrl, mime: 'image/webp'});
                    }; r.readAsDataURL(f);
                  }} />
                  <div className="w-12 h-12 bg-indigo-500/10 rounded-full flex items-center justify-center text-indigo-400 mx-auto mb-3 group-hover:scale-110 transition-transform"><i className="fa-solid fa-cloud-arrow-up text-xl"></i></div>
                  <p className="font-bold uppercase tracking-widest text-[10px] text-gray-500">{t.uploadSource}</p>
                </div>
              ) : (
                <div className="relative w-full flex flex-col items-center">
                  <img src={sourceImg.url} className="max-h-48 rounded-xl shadow-xl border border-white/10" alt="Source" />
                  <button onClick={() => setSourceImg(null)} className="absolute top-2 right-2 bg-black/60 p-2 rounded-full hover:bg-red-500 transition-all text-xs z-20"><i className="fa-solid fa-trash"></i></button>
                </div>
              )}
            </div>
          )}
          <div className="grid grid-cols-4 gap-2">
            {AVATAR_STYLES.map(s => (
              <button key={s.id} onClick={() => setStyleId(s.id)} className={`py-3 rounded-xl text-[10px] font-bold uppercase transition-all ${styleId === s.id ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/50 shadow-lg shadow-indigo-500/10' : 'bg-white/5 text-gray-500 border border-white/5 hover:border-white/10'}`}>
                {s.label[language]}
              </button>
            ))}
          </div>

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
            className={`min-h-[120px] p-6 rounded-[2rem] border-2 border-dashed transition-all flex flex-wrap gap-3 items-center justify-center ${isDragOver ? 'bg-indigo-500/10 border-indigo-500 scale-[1.01] shadow-[0_0_30px_rgba(99,102,241,0.1)]' : 'bg-black/40 border-white/5 hover:border-white/10'}`}
          >
            {chips.length === 0 && <p className="text-gray-600 text-[10px] font-black uppercase tracking-widest pointer-events-none text-center px-4">{t.dropHint}</p>}
            {chips.map((b) => (
              <div key={b.id} className={`px-4 py-2 bg-gradient-to-br ${b.color || 'from-indigo-600 to-purple-600'} rounded-xl flex items-center gap-2 shadow-lg group`}>
                <i className={`fa-solid ${b.icon || 'fa-tag'} text-[9px]`}></i>
                <span className="text-[10px] font-black uppercase tracking-tight">{b.label}</span>
                <button onClick={() => setChips(prev => prev.filter(c => c.id !== b.id))} className="ml-1 opacity-50 hover:opacity-100"><i className="fa-solid fa-circle-xmark"></i></button>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{t.promptLabel}</label>
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-2xl p-6 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium resize-y min-h-[100px]" placeholder={t.subjectPlaceholder} />
          </div>

          <div className="space-y-4">
            <label className="text-[10px] font-black text-red-500/60 uppercase tracking-widest">{t.negativeLabel}</label>
            <textarea value={negativePrompt} onChange={(e) => setNegativePrompt(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 h-24 text-[11px] outline-none resize-y" />
          </div>

          <button onClick={handleManifest} disabled={isLoading} className="w-full py-6 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all flex items-center justify-center group/gen">
             {isLoading ? <i className="fa-solid fa-circle-notch fa-spin mr-3 text-lg"></i> : <i className="fa-solid fa-sparkles mr-3 text-lg"></i>}
             {isLoading ? t.synthesizing : t.manifest}
          </button>
        </div>

        {user && <PromptBuilder onAdd={onAddTag} language={language} />}

        {previews.length > 0 && (
          <div className="glass p-8 rounded-[3rem] space-y-8 shadow-2xl bg-gradient-to-b from-transparent to-indigo-500/5 border border-indigo-500/10 animate-in slide-in-from-bottom duration-500">
            <div className="relative group/img-preview">
              <img src={previews[0]?.url} className="w-full rounded-[2.5rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] border border-white/10" alt="Result" />
            </div>
            
            {previews[0]?.aiDescription && (
              <div className="p-6 bg-indigo-500/5 border border-indigo-500/10 rounded-[1.5rem] italic text-sm text-gray-300 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                <i className="fa-solid fa-quote-left text-indigo-500/20 absolute top-4 right-4 text-4xl"></i>
                <p className="relative z-10">"{previews[0].aiDescription}"</p>
              </div>
            )}

            <div className="flex flex-wrap gap-4">
              <button onClick={handleSaveResult} disabled={isStoring} className={`flex-1 py-5 rounded-2xl font-black text-xs tracking-widest uppercase shadow-xl transition-all ${isSaved ? 'bg-green-600' : 'bg-indigo-600 hover:bg-indigo-500'}`}>
                {isStoring ? <i className="fa-solid fa-circle-notch fa-spin mr-2"></i> : (isSaved ? <i className="fa-solid fa-check mr-2"></i> : null)} {isStoring ? t.storing : (isSaved ? t.saved : t.store)}
              </button>
              <button onClick={() => setPreviews([])} className="px-8 py-5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl transition-all hover:bg-red-500/20"><i className="fa-solid fa-trash"></i></button>
            </div>
          </div>
        )}
        {error && <div className="p-6 bg-red-500/10 border border-red-500/20 text-red-400 rounded-3xl text-xs font-bold animate-in slide-in-from-top duration-300"><i className="fa-solid fa-triangle-exclamation mr-2"></i> {error}</div>}
      </div>
      <div className="lg:col-span-4 space-y-6">
        <div className="glass p-8 rounded-3xl border-white/5 shadow-xl">
          <h3 className="font-black mb-6 text-[10px] uppercase tracking-widest text-indigo-400 border-b border-white/10 pb-4">{t.tuning}</h3>
          <TuningControls currentModel={model} onModelChange={setModel} showRatio={true} currentRatio={aspectRatio} onRatioChange={setAspectRatio} seed={seed} onSeedChange={setSeed} temperature={temperature} onTempChange={setTemperature} t={t} />
        </div>
        <UsageCard stats={usageStats} currentModel={model} t={t} />
      </div>
    </div>
  );
};

export default AvatarView;
