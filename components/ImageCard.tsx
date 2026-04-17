
import React, { useState } from 'react';
import { PromptEntry } from '../types';

interface ImageCardProps {
  entry: PromptEntry;
  onDelete: (id: string) => void;
  onRemix?: (entry: PromptEntry) => void;
  isOwner: boolean;
  selected?: boolean;
  onSelect?: (id: string) => void;
}

const ImageCard: React.FC<ImageCardProps> = ({ entry, onDelete, onRemix, isOwner, selected, onSelect }) => {
  const [showFocus, setShowFocus] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [copied, setCopied] = useState(false);

  // 判斷是否具備 UserID，通常具備 UserID 且非 anon 即代表已觸發雲端同步邏輯
  const isSynced = entry.userId && entry.userId !== 'anon';

  const handleNativeShare = async () => {
    if (!entry.imageUrl) return;
    try {
      const response = await fetch(entry.imageUrl);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const blob = await response.blob();
      const file = new File([blob], `gemini-studio-${entry.id}.webp`, { type: 'image/webp' });
      
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Check out my AI creation!',
          text: `Generated on Gemini Studio: "${entry.text}"`,
        });
      } else {
        window.open(entry.imageUrl, '_blank');
      }
    } catch (err: any) {
      console.error('Share failed', err);
      if (err.message && err.message.includes('Failed to fetch')) {
        alert("Network Error: Could not fetch image for sharing. This might be due to CORS or connection issues.");
      }
    }
  };

  const handleDownload = async () => {
    if (!entry.imageUrl) return;
    try {
      const response = await fetch(entry.imageUrl);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `gemini-studio-${entry.id.substring(0, 8)}.webp`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Download failed', err);
      if (err.message && err.message.includes('Failed to fetch')) {
        alert("Network Error: Could not fetch image for download. This might be due to CORS or connection issues.");
      }
    }
  };

  const handleCopyPrompt = () => {
    const fullText = [entry.text, entry.tags?.join(', ')].filter(Boolean).join(', ');
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <div className={`group relative glass rounded-2xl overflow-hidden flex flex-col border-white/5 hover:border-indigo-500/30 transition-all duration-300 shadow-xl ${selected ? 'ring-2 ring-indigo-500 border-indigo-500' : ''}`}>
        <div className="aspect-[4/5] relative overflow-hidden bg-[#0c0c0c] cursor-zoom-in" onClick={() => setShowFocus(true)}>
          <img 
            src={entry.imageUrl} 
            alt={entry.text} 
            loading="lazy"
            onLoad={() => setIsLoaded(true)}
            className={`w-full h-full object-cover transition-all duration-700 group-hover:scale-110 ${isLoaded ? 'opacity-100' : 'opacity-0 scale-95'}`}
          />
          
          {!isLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/5 animate-pulse">
               <i className="fa-solid fa-image text-white/10 text-4xl"></i>
            </div>
          )}
          
          {/* 同步狀態圖標 */}
          {isSynced && (
            <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 px-2 py-1 bg-black/40 backdrop-blur-md rounded-lg border border-white/10">
              <i className="fa-solid fa-cloud-check text-green-400 text-[10px]"></i>
              <span className="text-[8px] font-black text-white/80 uppercase tracking-tighter">Synced</span>
            </div>
          )}

          {onSelect && (
            <div 
              className="absolute top-3 right-3 z-20"
              onClick={(e) => { e.stopPropagation(); onSelect(entry.id); }}
            >
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${selected ? 'bg-indigo-500 border-indigo-500' : 'bg-black/40 border-white/40 hover:border-white'}`}>
                {selected && <i className="fa-solid fa-check text-[10px] text-white"></i>}
              </div>
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-5">
            <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
              {isOwner && (
                <button 
                  onClick={() => onDelete(entry.id)}
                  className="w-10 h-10 rounded-xl bg-red-500/80 hover:bg-red-500 flex items-center justify-center backdrop-blur-md transition-all shrink-0"
                >
                  <i className="fa-solid fa-trash-can text-white text-sm"></i>
                </button>
              )}
              <button 
                onClick={handleDownload}
                className="w-10 h-10 rounded-xl bg-white/10 hover:bg-indigo-600 flex items-center justify-center backdrop-blur-md transition-all shrink-0"
              >
                <i className="fa-solid fa-download text-white text-sm"></i>
              </button>
              <button 
                onClick={handleNativeShare}
                className="flex-1 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center gap-2 backdrop-blur-md transition-all font-bold text-xs"
              >
                <i className="fa-solid fa-share-nodes"></i> Share
              </button>
            </div>
          </div>

          <div className="absolute top-12 left-3 flex gap-2">
             <span className={`text-[8px] uppercase font-black px-2 py-0.5 rounded shadow-lg backdrop-blur-md ${entry.model === 'pro' ? 'bg-purple-600 text-white' : 'bg-yellow-500 text-black'}`}>
              {entry.model}
             </span>
          </div>
        </div>
        
        <div className="p-4 bg-[#0a0a0a]/40 backdrop-blur-lg border-t border-white/5">
          <p className="text-xs text-gray-200 line-clamp-2 mb-3 leading-relaxed font-medium group-hover:text-indigo-300 transition-colors cursor-pointer" onClick={() => setShowFocus(true)}>
            "{entry.text}"
          </p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[8px] font-bold">
                {entry.author[0].toUpperCase()}
              </div>
              <span className="text-[10px] text-gray-500 font-bold">{entry.author}</span>
            </div>
            <span className="text-[9px] text-gray-600 font-medium">
              {new Date(entry.timestamp).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      {showFocus && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 md:p-10">
          <div className="absolute inset-0 bg-black/95 backdrop-blur-2xl" onClick={() => setShowFocus(false)}></div>
          <div className="relative glass w-full max-w-6xl max-h-full rounded-[2.5rem] border-white/10 shadow-2xl overflow-hidden animate-in zoom-in duration-300 flex flex-col md:flex-row">
            <div className="flex-1 bg-black flex items-center justify-center relative min-h-[300px]">
              <img src={entry.imageUrl} alt={entry.text} className="max-h-full max-w-full object-contain" />
              <button 
                onClick={() => setShowFocus(false)}
                className="absolute top-6 left-6 w-12 h-12 bg-white/10 hover:bg-white/20 backdrop-blur-xl rounded-full flex items-center justify-center text-white transition-all z-10"
              >
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
            </div>
            
            <div className="w-full md:w-96 p-8 overflow-y-auto bg-[#0a0a0a]/50 backdrop-blur-xl border-l border-white/10 flex flex-col gap-8">
              <div className="relative group/p-box">
                <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-3 flex justify-between items-center">
                  Core Prompt
                  <button onClick={handleCopyPrompt} className="text-indigo-400/50 hover:text-indigo-400 transition-colors">
                    {copied ? <span className="text-[8px] lowercase">copied!</span> : <i className="fa-solid fa-copy"></i>}
                  </button>
                </h3>
                <p className="text-sm leading-relaxed text-gray-200 font-medium italic">"{entry.text}"</p>
              </div>

              {entry.negativePrompt && (
                <div>
                  <h3 className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-3">Negative Prompt</h3>
                  <p className="text-[11px] leading-relaxed text-gray-500">{entry.negativePrompt}</p>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {entry.tags?.map((tag, i) => (
                  <span key={i} className="text-[9px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-3 py-1.5 rounded-xl font-black uppercase">
                    {tag}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="glass p-4 rounded-2xl border-white/5">
                  <span className="text-[8px] font-black text-gray-500 uppercase block mb-1">Model</span>
                  <span className="text-xs font-bold text-white uppercase">{entry.model}</span>
                </div>
                {entry.config?.aspectRatio && (
                  <div className="glass p-4 rounded-2xl border-white/5">
                    <span className="text-[8px] font-black text-gray-500 uppercase block mb-1">Ratio</span>
                    <span className="text-xs font-bold text-white uppercase">{entry.config.aspectRatio}</span>
                  </div>
                )}
                <div className="glass p-4 rounded-2xl border-white/5 col-span-2">
                  <span className="text-[8px] font-black text-gray-500 uppercase block mb-1">Sync Status</span>
                  <span className={`text-[10px] font-black uppercase ${isSynced ? 'text-green-400' : 'text-yellow-500'}`}>
                    {isSynced ? 'Cloud Synchronized' : 'Local Only (Guest Mode)'}
                  </span>
                </div>
              </div>

              <div className="mt-auto space-y-3">
                <div className="flex items-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/10">
                   <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center font-black text-xs text-white">
                    {entry.author[0].toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <span className="text-[8px] font-black text-gray-500 uppercase block">Created By</span>
                    <span className="text-sm font-bold text-white">{entry.author}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button 
                    onClick={handleDownload}
                    className="flex-1 py-4 bg-white/5 hover:bg-white/10 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all"
                  >
                    Download
                  </button>
                  {onRemix && (
                    <button 
                      onClick={() => { onRemix(entry); setShowFocus(false); }}
                      className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-indigo-500/20"
                    >
                      Remix Prompt
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ImageCard;
