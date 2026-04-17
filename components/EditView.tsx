
import React, { useState } from 'react';
import { useImageSynthesis } from '../hooks/useImageSynthesis';
import { TuningControls, UsageCard } from './Shared';
import PromptBuilder from './PromptBuilder';
import { Language, AspectRatio, ImageSize, ModelChoice, UsageStats } from '../types';
import InpaintCanvas from './InpaintCanvas';
import PhotoEditorTools from './PhotoEditorTools';
import { GeminiService } from '../services/geminiService';
import { EDIT_FILTERS } from '../constants';
import { ImageProcessingService } from '../services/imageProcessingService';

interface EditViewProps {
  language: Language;
  t: any;
  usageStats: UsageStats;
  onStatsUpdate: (i: number, o: number) => void;
  onSave: (items: {url: string, aiTags: string[]}[], prompt: string, tags: string[], model: ModelChoice, config: any) => Promise<void>;
  user: any;
}

const EDIT_DEFAULT_PROMPT = "根據上載既照片來拍攝各種不同凡響既人像攝影。女神角式樣貌身材都必需一樣，而每張獨立照片都不同動作/表情，造型服裝要一致。";
const DEFAULT_NEGATIVE = "避免低飽和、多餘四肢、惡劣照明、模糊噪音、卡通插圖、動漫3D、扭曲解蓬、過度磨皮、塑膠感皮膚、過度銳化、人物擠、錯數量比例、服飾皮膚粗糙、色調失和不足、形體失真、姿勢僵硬、配件突兀、場景雜亂、臉部扭曲、五官錯位、比例異常、多手指、多肢體、避免Al感。";

const EditView: React.FC<EditViewProps> = ({ language, t, usageStats, onStatsUpdate, onSave, user }) => {
  const [sourceImg, setSourceImg] = useState<{url: string, mime: string} | null>(null);
  const [originalImg, setOriginalImg] = useState<{url: string, mime: string} | null>(null);
  const [editMode, setEditMode] = useState<'whole' | 'area' | 'advanced'>('whole');
  const [prompt, setPrompt] = useState(EDIT_DEFAULT_PROMPT);
  const [chips, setChips] = useState<any[]>([]);
  const [negativePrompt, setNegativePrompt] = useState(DEFAULT_NEGATIVE);
  const [model, setModel] = useState<ModelChoice>('flash');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [imageSize, setImageSize] = useState<ImageSize>('1K');
  const [seed, setSeed] = useState<number | undefined>(undefined);
  const [temperature, setTemperature] = useState<number>(1.0);
  const [isDragOver, setIsDragOver] = useState(false);
  
  const [brushSize, setBrushSize] = useState(40);
  const [brushSoftness, setBrushSoftness] = useState(20);
  const [currentMask, setCurrentMask] = useState<string | null>(null);
  const [isComparing, setIsComparing] = useState(false);

  const [activePreviewIdx, setActivePreviewIdx] = useState(0);
  const [isStoring, setIsStoring] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isSmartRefine, setIsSmartRefine] = useState(true);

  const [isSmartAnalyzing, setIsSmartAnalyzing] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isRemovingBg, setIsRemovingBg] = useState(false);

  const { isLoading: isSynthesisLoading, previews, error, generateInpaint, generateSingle, setPreviews, setError } = useImageSynthesis(onStatsUpdate);
  const isLoading = isSynthesisLoading || isSmartAnalyzing || isSuggesting || isRemovingBg;

  const onAddTag = (value: string, label: string, icon?: string, color?: string) => {
    setChips(prev => [...prev, { id: crypto.randomUUID(), value, label, icon, color }]);
  };

  const handleManifest = async () => {
    if (!sourceImg) return;
    
    const isLocalMode = editMode === 'area' || editMode === 'advanced';
    if (isLocalMode && !currentMask) {
      setError("Please draw a mask on the area you want to edit first.");
      return;
    }

    setIsSaved(false);
    setError(null);
    setActivePreviewIdx(0);
    
    const combinedTags = chips.map(c => c.value).join(', ');
    const visualDirectives = combinedTags ? `Visual directives to strictly follow: ${combinedTags}.` : "";
    const fashionContext = "Fashion editorial style, cinematic lighting, high-end photography.";
    
    const isHealing = prompt === t.healingPrompt;
    
    // If healing, use a clean prompt to avoid global style changes
    const finalPrompt = isHealing ? prompt : [
      visualDirectives, 
      `User Intent: ${prompt}`, 
      `Aesthetic Style: ${fashionContext}`
    ].filter(Boolean).join('\n');

    if (isLocalMode && currentMask) {
      let semanticTarget = undefined;
      if (isSmartRefine) {
        setIsSmartAnalyzing(true);
        try {
          // Quick analysis of what's in the mask to help the inpainter
          semanticTarget = await GeminiService.analyzeMaskedRegion(sourceImg.url, currentMask, prompt);
          console.log("[Edit] Semantic Analysis Result:", semanticTarget);
        } catch (e) {
          console.warn("[Edit] Semantic analysis failed, proceeding with raw prompt.");
        } finally {
          setIsSmartAnalyzing(false);
        }
      }
      await generateInpaint(finalPrompt, { ...sourceImg, mask: currentMask }, { model, aspectRatio, imageSize, negativePrompt, seed, temperature, semanticTarget });
    } else {
      await generateSingle(finalPrompt, { model, aspectRatio, imageSize, negativePrompt, seed, temperature }, { ...sourceImg, context: prompt, type: 'edit' });
    }
  };

  const handleHealingBrush = () => {
    setEditMode('area');
    setPrompt(t.healingPrompt);
    setChips([]);
  };

  const handleApplyAdvanced = (newUrl: string) => {
    const newPreview = {
      id: crypto.randomUUID(),
      url: newUrl,
      aiTags: [],
      aiDescription: "Advanced manual adjustment"
    };
    setPreviews([newPreview]);
    
    // Background metadata analysis
    GeminiService.generateMetadata(newUrl, 'image/webp').then(metadata => {
      setPreviews(prev => prev.map(p => p.id === newPreview.id ? { ...p, aiTags: metadata.tags, aiDescription: metadata.description } : p));
    }).catch(() => {});
  };

  const handleRemoveBackground = async () => {
    if (!sourceImg) return;
    setIsRemovingBg(true);
    setError(null);
    try {
      const result = await GeminiService.removeBackground(sourceImg.url, sourceImg.mime, model, aspectRatio, imageSize);
      const webpUrl = await ImageProcessingService.processToWebP(result.url);
      
      const newPreview = {
        id: crypto.randomUUID(),
        url: webpUrl,
        aiTags: [],
        aiDescription: "Background removed"
      };
      
      setPreviews([newPreview]);
      onStatsUpdate(result.inputTokens, result.outputTokens);
      
      // Background metadata analysis
      GeminiService.generateMetadata(webpUrl, 'image/webp').then(metadata => {
        setPreviews(prev => prev.map(p => p.id === newPreview.id ? { ...p, aiTags: metadata.tags, aiDescription: metadata.description } : p));
      }).catch(() => {});
      
    } catch (err: any) {
      setError(err.message || "Background removal failed.");
    } finally {
      setIsRemovingBg(false);
    }
  };

  const handleAISuggest = async () => {
    if (!sourceImg) return;
    setIsSuggesting(true);
    try {
      let suggestion = "";
      if ((editMode === 'area' || editMode === 'advanced') && currentMask) {
        suggestion = await GeminiService.suggestInpaintPrompt(sourceImg.url, currentMask);
      } else {
        suggestion = await GeminiService.suggestEditPrompt(sourceImg.url, sourceImg.mime);
      }
      setPrompt(suggestion);
    } catch (err) {
      console.error("Suggestion failed", err);
    } finally {
      setIsSuggesting(false);
    }
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

  const currentActivePreview = previews[activePreviewIdx]?.url;

  return (
    <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in">
      <div className="lg:col-span-8 space-y-8">
        <div className="glass p-8 rounded-[2.5rem] space-y-8 border-indigo-500/10">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-black flex items-center gap-3"><i className="fa-solid fa-wand-magic-sparkles text-indigo-400"></i>{t.edit}</h3>
            <div className="flex gap-2 p-1.5 bg-black/40 rounded-2xl border border-white/10">
              <button 
                onClick={() => setEditMode('whole')} 
                className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${editMode === 'whole' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
              >
                {t.editModeWhole}
              </button>
              <button 
                onClick={() => setEditMode('area')} 
                className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${editMode === 'area' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
              >
                {t.editModeArea}
              </button>
              <button 
                onClick={() => setEditMode('advanced')} 
                className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${editMode === 'advanced' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
              >
                {t.editModeAdvanced}
              </button>
            </div>
          </div>
          
          <div className="h-[450px] w-full relative">
            {!sourceImg ? (
              <div className="w-full h-full glass border-dashed border-2 border-indigo-500/20 rounded-3xl flex items-center justify-center relative overflow-hidden bg-black/20 group">
                <div className="text-center py-4">
                  <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={async (e) => {
                    const f = e.target.files?.[0]; if(!f) return;
                    const r = new FileReader(); r.onload = async (ev) => {
                      const rawUrl = ev.target?.result as string;
                      const optimizedUrl = await ImageProcessingService.processToWebP(rawUrl);
                      const data = {url: optimizedUrl, mime: 'image/webp'};
                      setSourceImg(data);
                      setOriginalImg(data);
                    }; r.readAsDataURL(f);
                  }} />
                  <div className="w-16 h-16 bg-indigo-500/10 rounded-full flex items-center justify-center text-indigo-400 mx-auto mb-4 group-hover:scale-110 transition-transform"><i className="fa-solid fa-cloud-arrow-up text-2xl"></i></div>
                  <p className="font-black uppercase tracking-widest text-[11px] text-gray-400">{t.uploadSource}</p>
                </div>
              </div>
            ) : (
              <div className="w-full h-full relative group shadow-2xl rounded-3xl overflow-hidden">
                {(editMode === 'area' || editMode === 'advanced') ? (
                  <InpaintCanvas 
                    imageSrc={sourceImg.url} 
                    onExportMask={setCurrentMask} 
                    brushSize={brushSize} 
                    onBrushSizeChange={setBrushSize}
                    brushSoftness={brushSoftness}
                    onBrushSoftnessChange={setBrushSoftness}
                    t={t} 
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center glass p-4">
                    <img src={sourceImg.url} className="max-h-full max-w-full object-contain rounded-xl" alt="Source" />
                  </div>
                )}
                <button onClick={() => setSourceImg(null)} className="absolute top-6 right-6 bg-black/80 p-3 rounded-full hover:bg-red-500 transition-all text-xs z-30"><i className="fa-solid fa-xmark"></i></button>
              </div>
            )}
          </div>

          {editMode === 'advanced' && sourceImg && (
            <PhotoEditorTools 
              imageSrc={sourceImg.url} 
              maskSrc={currentMask} 
              onApply={handleApplyAdvanced} 
              t={t} 
            />
          )}

          <div className="flex flex-wrap gap-4">
            <button 
              onClick={handleHealingBrush}
              className={`flex-1 py-4 glass border rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${prompt === t.healingPrompt ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/10'}`}
            >
              <i className="fa-solid fa-hand-holding-medical text-lg"></i> {t.healingBrush}
            </button>
            <button 
              onClick={handleRemoveBackground}
              disabled={isLoading || !sourceImg}
              className="flex-1 py-4 glass border border-purple-500/20 rounded-2xl text-[10px] font-black uppercase tracking-widest text-purple-400 hover:bg-purple-500/10 transition-all flex items-center justify-center gap-2 disabled:opacity-30"
            >
              {isRemovingBg ? <i className="fa-solid fa-circle-notch fa-spin text-lg"></i> : <i className="fa-solid fa-scissors text-lg"></i>}
              {isRemovingBg ? "Removing..." : t.removeBg}
            </button>
            <button 
              onClick={() => setIsSmartRefine(!isSmartRefine)}
              className={`px-6 py-4 glass border rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${isSmartRefine ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/5' : 'border-white/10 text-gray-500'}`}
              title="AI Semantic Analysis"
            >
              <i className={`fa-solid fa-brain ${isSmartRefine ? 'animate-pulse' : ''}`}></i>
              Smart Refine: {isSmartRefine ? 'ON' : 'OFF'}
            </button>
            {sourceImg !== originalImg && (
              <button 
                onClick={() => setSourceImg(originalImg)}
                className="px-6 py-4 glass border border-red-500/20 rounded-2xl text-[10px] font-black uppercase tracking-widest text-red-400 hover:bg-red-500/10 transition-all"
              >
                Reset
              </button>
            )}
          </div>

          <div className="space-y-4">
            <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex justify-between items-center">
              <span>{t.stylePresets}</span>
              <span className="text-gray-600 text-[9px]">Quick Style Application</span>
            </label>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {EDIT_FILTERS.map(filter => (
                <button 
                  key={filter.id}
                  onClick={() => setPrompt(filter.prompt)}
                  className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-400 hover:bg-indigo-500/10 hover:text-indigo-400 transition-all whitespace-nowrap"
                >
                  {language === 'zh' ? filter.label.zh : filter.label.en}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex justify-between">
              <span>{t.selectedPromptLabel}</span>
              <span className="text-gray-600 font-bold">{chips.length} tags active</span>
            </label>
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
                <div key={b.id} className={`px-4 py-2 bg-gradient-to-br ${b.color || 'from-indigo-600 to-purple-600'} rounded-xl flex items-center gap-2 shadow-lg group animate-in zoom-in duration-200`}>
                  <i className={`fa-solid ${b.icon || 'fa-tag'} text-[9px]`}></i>
                  <span className="text-[10px] font-black uppercase tracking-tight">{b.label}</span>
                  <button onClick={() => setChips(prev => prev.filter(c => c.id !== b.id))} className="ml-1 opacity-50 hover:opacity-100"><i className="fa-solid fa-circle-xmark"></i></button>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{t.promptLabel}</label>
              <div className="flex gap-4 items-center">
                <button 
                  onClick={() => { setPrompt(''); setChips([]); }} 
                  className="text-gray-500 hover:text-red-400 text-[10px] font-bold uppercase transition-colors flex items-center gap-1"
                >
                  <i className="fa-solid fa-trash"></i> Clear
                </button>
                <button 
                  onClick={handleAISuggest}
                  disabled={isLoading || !sourceImg}
                  className="text-[9px] font-black uppercase tracking-widest text-indigo-400 hover:text-indigo-300 flex items-center gap-2 disabled:opacity-30"
                >
                  {isSuggesting ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-wand-magic"></i>}
                  {t.aiSuggest}
                </button>
              </div>
            </div>
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-2xl p-6 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium resize-y min-h-[100px]" />
          </div>

          <div className="space-y-4">
            <label className="text-[10px] font-black text-red-500/60 uppercase tracking-widest">{t.negativeLabel}</label>
            <textarea value={negativePrompt} onChange={(e) => setNegativePrompt(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 h-24 text-[11px] outline-none resize-y" />
          </div>

          <button 
            onClick={handleManifest} 
            disabled={isLoading || !sourceImg} 
            className="w-full py-6 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl font-black text-xs uppercase tracking-widest shadow-[0_20px_40px_-15px_rgba(99,102,241,0.3)] transition-all hover:brightness-110 active:scale-95 disabled:opacity-30 flex items-center justify-center"
          >
            {isLoading ? <i className="fa-solid fa-circle-notch fa-spin mr-3 text-lg"></i> : <i className="fa-solid fa-wand-sparkles mr-3 text-lg"></i>}
            {isSmartAnalyzing ? "Analyzing Mask..." : (isRemovingBg ? "Removing Background..." : (isSuggesting ? "Generating Suggestion..." : (isLoading ? t.synthesizing : ((editMode === 'area' || editMode === 'advanced') ? t.applyInpaint : t.manifest))))}
          </button>
        </div>

        {user && <PromptBuilder onAdd={onAddTag} language={language} />}

        {error && (
          <div className="p-6 bg-red-500/10 border border-red-500/20 text-red-400 rounded-3xl text-xs font-bold animate-in slide-in-from-top duration-300">
            <i className="fa-solid fa-triangle-exclamation mr-2"></i> {error}
          </div>
        )}

        {previews.length > 0 && (
          <div className="glass p-8 rounded-[3rem] space-y-8 shadow-2xl bg-gradient-to-b from-transparent to-indigo-500/5 border border-indigo-500/20">
             <div className="flex justify-end">
              <button 
                onMouseDown={() => setIsComparing(true)}
                onMouseUp={() => setIsComparing(false)}
                onMouseLeave={() => setIsComparing(false)}
                className="px-8 py-4 bg-white/5 border border-white/10 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:bg-indigo-600"
              >
                <i className="fa-solid fa-code-compare mr-2"></i> {t.compareLabel}
              </button>
             </div>

            <div className="relative w-full aspect-square glass rounded-[2rem] overflow-hidden border border-white/10 shadow-2xl">
              <img 
                src={isComparing ? sourceImg?.url : currentActivePreview} 
                className="w-full h-full object-contain transition-all" 
                alt="Preview" 
              />
              <div className="absolute bottom-6 left-6 px-5 py-2.5 bg-black/80 backdrop-blur-xl rounded-full text-[10px] font-black uppercase tracking-widest text-indigo-400 border border-indigo-500/20">
                {isComparing ? 'Original Source' : 'AI Render Output'}
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              <button onClick={handleSaveResult} disabled={isStoring} className={`flex-1 py-5 rounded-2xl font-black text-xs tracking-widest uppercase shadow-xl transition-all ${isSaved ? 'bg-green-600' : 'bg-indigo-600 hover:bg-indigo-500'}`}>
                {isStoring ? <i className="fa-solid fa-circle-notch fa-spin mr-2"></i> : (isSaved ? <i className="fa-solid fa-check mr-2"></i> : null)} {isStoring ? t.storing : (isSaved ? t.saved : t.store)}
              </button>
              <button onClick={() => {setPreviews([]); setActivePreviewIdx(0);}} className="px-8 py-5 bg-red-500/10 rounded-2xl text-red-400 hover:bg-red-500/20 transition-all border border-red-500/10"><i className="fa-solid fa-trash"></i></button>
            </div>
          </div>
        )}
      </div>
      <div className="lg:col-span-4 space-y-6">
        <div className="glass p-8 rounded-3xl border-white/5">
          <h3 className="font-black mb-6 text-[10px] uppercase tracking-widest text-indigo-400 border-b border-white/10 pb-4">{t.tuning}</h3>
          <TuningControls currentModel={model} onModelChange={setModel} showRatio={true} currentRatio={aspectRatio} onRatioChange={setAspectRatio} seed={seed} onSeedChange={setSeed} temperature={temperature} onTempChange={setTemperature} t={t} />
        </div>
        <UsageCard stats={usageStats} currentModel={model} t={t} />
      </div>
    </div>
  );
};

export default EditView;
