
import React, { useState, useMemo, useEffect, useRef } from 'react';
// @ts-ignore
import * as ReactWindow from 'react-window';
// @ts-ignore
import * as AutoSizerPkg from 'react-virtualized-auto-sizer';
import ImageCard from './ImageCard';

const FixedSizeGrid = (ReactWindow as any).FixedSizeGrid;
const AutoSizer = (AutoSizerPkg as any).AutoSizer || (AutoSizerPkg as any).default || AutoSizerPkg;
/* Import Language type from types */
import { PromptEntry, Preset, User, Language } from '../types';

interface GalleryProps {
  entries: PromptEntry[];
  onDelete: (id: string) => void;
  onBulkDelete: () => void;
  user: User | null;
  searchTerm: string;
  setSearchTerm: (s: string) => void;
  selectedIds: Set<string>;
  toggleSelect: (id: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
  onBulkDownload: () => void;
  onImport?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onExport?: () => void;
  isZipping: boolean;
  t: any;
  /* Add language prop */
  language: Language;
  isPromptView?: boolean;
  onRemix?: (entry: PromptEntry) => void;
}

export const GalleryGrid: React.FC<GalleryProps> = ({ 
  entries, onDelete, onBulkDelete, user, searchTerm, setSearchTerm, 
  selectedIds, toggleSelect, selectAll, deselectAll, onBulkDownload, onImport, onExport, isZipping, t, 
  /* Destructure language from props */
  language, isPromptView, onRemix 
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyPrompt = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const Cell = ({ columnIndex, rowIndex, style, data }: any) => {
    const { columnCount, items, onDelete, onRemix, user, selectedIds, toggleSelect } = data;
    const index = rowIndex * columnCount + columnIndex;
    const entry = items[index];

    if (!entry) return null;

    return (
      <div style={{ ...style, padding: '12px' }}>
        <ImageCard 
          entry={entry} 
          onDelete={() => onDelete(entry.id)} 
          onRemix={onRemix}
          isOwner={entry.userId === user?.id} 
          selected={selectedIds.has(entry.id)} 
          onSelect={toggleSelect} 
        />
      </div>
    );
  };

  if (isPromptView) {
    return (
      <div className="space-y-8 animate-in fade-in max-w-7xl mx-auto pb-24">
        <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between px-2">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-white mb-1 flex items-center gap-3">
              <i className="fa-solid fa-book-open text-indigo-500"></i>
              {language === 'zh' ? '提示詞創作誌' : 'Prompt Journal'}
            </h2>
            <p className="text-gray-500 text-xs font-medium uppercase tracking-widest">
              {entries.length} {language === 'zh' ? '個已存檔的視覺構思' : 'Archived Visual Concepts'}
            </p>
          </div>
          <div className="relative w-full max-w-xl">
            <i className="fa-solid fa-magnifying-glass absolute left-5 top-1/2 -translate-y-1/2 text-indigo-500/50"></i>
            <input 
              type="text" 
              placeholder={t.searchPlaceholder} 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
              className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-6 py-4 outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium text-sm" 
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 px-2">
          {entries.map(entry => (
            <div key={entry.id} className="glass rounded-[3.5rem] border-white/10 flex flex-col md:flex-row gap-0 hover:border-indigo-500/30 transition-all group relative overflow-hidden bg-white/[0.01] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)]">
              {/* Photo Section */}
              <div className="w-full md:w-[400px] h-[400px] md:h-auto shrink-0 bg-[#050505] relative overflow-hidden">
                <img src={entry.imageUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000" alt="Generated visual" referrerPolicy="no-referrer" />
                <div className="absolute top-6 left-6 flex flex-col gap-2">
                   <span className={`text-[10px] font-black px-3 py-1.5 rounded-xl uppercase tracking-[0.2em] shadow-2xl backdrop-blur-xl border border-white/10 ${entry.model === 'pro' ? 'bg-purple-600/80 text-white' : 'bg-yellow-500/80 text-black'}`}>
                      {entry.model} Engine
                   </span>
                   {entry.userId !== 'anon' && (
                     <span className="text-[10px] font-black px-3 py-1.5 bg-green-500/80 text-white rounded-xl uppercase tracking-[0.2em] shadow-2xl backdrop-blur-xl border border-white/10 flex items-center gap-2">
                        <i className="fa-solid fa-cloud-check"></i> Cloud Synced
                     </span>
                   )}
                </div>
                <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-transparent pointer-events-none"></div>
              </div>

              {/* Prompt/Info Section */}
              <div className="flex-1 flex flex-col p-10 lg:p-12 relative z-10 bg-gradient-to-br from-transparent via-transparent to-indigo-500/[0.03]">
                <div className="flex justify-between items-start mb-10">
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 rounded-[1.25rem] bg-indigo-500/10 flex items-center justify-center text-indigo-400 font-black text-lg border border-indigo-500/20 shadow-inner">
                      {(entry.author || 'A')[0].toUpperCase()}
                    </div>
                    <div>
                      <span className="text-sm font-black text-gray-100 block uppercase tracking-widest mb-1">{entry.author}</span>
                      <div className="flex items-center gap-2 text-[11px] text-gray-500 font-bold uppercase tracking-tighter">
                        <i className="fa-regular fa-clock"></i>
                        {new Date(entry.timestamp).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => handleCopyPrompt(entry.id, entry.text)}
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${copiedId === entry.id ? 'bg-green-600 text-white' : 'bg-white/5 hover:bg-white/10 text-gray-400 border border-white/5'}`}
                    >
                      {copiedId === entry.id ? <i className="fa-solid fa-check"></i> : <i className="fa-solid fa-copy"></i>}
                    </button>
                    <button 
                      onClick={() => onDelete(entry.id)}
                      className="w-12 h-12 rounded-2xl bg-white/5 hover:bg-red-500 text-gray-400 hover:text-white flex items-center justify-center transition-all border border-white/5"
                    >
                      <i className="fa-solid fa-trash-can"></i>
                    </button>
                  </div>
                </div>

                <div className="flex-1 mb-10">
                  <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em] mb-5 flex items-center gap-2">
                    <i className="fa-solid fa-terminal text-sm"></i> Visual Blueprint
                  </h4>
                  <div className="p-8 bg-black/60 border border-white/5 rounded-[2.5rem] font-medium text-base text-gray-200 leading-relaxed italic group-hover:border-indigo-500/40 transition-all shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] max-h-60 overflow-y-auto scrollbar-hide">
                    "{entry.text}"
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 mb-10">
                  {entry.tags?.map((tag, i) => (
                    <span key={i} className="text-[9px] bg-indigo-500/10 border border-indigo-500/10 px-4 py-2 rounded-2xl text-indigo-400 uppercase font-black tracking-widest shadow-sm">
                      #{tag}
                    </span>
                  ))}
                </div>

                <div className="flex gap-4">
                   <button 
                    onClick={() => onRemix?.(entry)} 
                    className="flex-1 py-5 bg-indigo-600 hover:bg-indigo-500 rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] text-white shadow-[0_20px_40px_-10px_rgba(99,102,241,0.3)] transition-all flex items-center justify-center gap-4 active:scale-[0.98]"
                  >
                    <i className="fa-solid fa-wand-magic-sparkles text-lg"></i> 
                    {language === 'zh' ? '載入此視覺配置' : 'Load Configuration'}
                  </button>
                </div>
              </div>
            </div>
          ))}
          {entries.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-40 opacity-20">
              <i className="fa-solid fa-box-open text-9xl mb-8"></i>
              <p className="uppercase font-black text-sm tracking-[0.6em]">{t.emptyStudio}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in max-w-7xl mx-auto flex flex-col pb-24">
      <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between px-2">
        <div className="relative w-full max-w-xl">
          <i className="fa-solid fa-magnifying-glass absolute left-5 top-1/2 -translate-y-1/2 text-indigo-500/50"></i>
          <input 
            type="text" 
            placeholder={t.searchPlaceholder} 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-6 py-4 outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium text-sm" 
          />
        </div>

        <div className="flex flex-wrap gap-3 items-center w-full lg:w-auto">
          <div className="flex bg-white/5 p-1.5 rounded-2xl border border-white/10 gap-1">
            <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 hover:bg-white/5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2">
              <i className="fa-solid fa-file-import text-indigo-400"></i> {t.importData}
            </button>
            <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={onImport} />
            <button onClick={onExport} className="px-4 py-2 hover:bg-white/5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2">
              <i className="fa-solid fa-file-export text-indigo-400"></i> {t.exportData}
            </button>
          </div>
          
          <button onClick={onBulkDownload} disabled={selectedIds.size === 0 || isZipping} className="flex-1 lg:flex-none px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 rounded-2xl text-[10px] font-black uppercase transition-all shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-2">
            {isZipping ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-file-zipper"></i>} {t.bulkDownload}
          </button>
          
          {selectedIds.size > 0 && (
            <button onClick={onBulkDelete} className="px-6 py-3 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white rounded-2xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2">
              <i className="fa-solid fa-trash"></i> {t.bulkDelete}
            </button>
          )}
        </div>
      </div>

      <div className="px-2">
        {entries.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {entries.map(entry => (
              <ImageCard 
                key={entry.id}
                entry={entry} 
                onDelete={() => onDelete(entry.id)} 
                onRemix={onRemix}
                isOwner={entry.userId === user?.id} 
                selected={selectedIds.has(entry.id)} 
                onSelect={toggleSelect} 
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-32 opacity-20">
            <i className="fa-solid fa-box-open text-8xl mb-6"></i>
            <p className="uppercase font-black text-sm tracking-[0.5em]">{t.emptyStudio}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export const PresetsList: React.FC<{ presets: Preset[]; onDelete: (id: string) => void; t: any }> = ({ presets, onDelete, t }) => (
  <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in">
    {presets.map(p => (
      <div key={p.id} className="glass p-8 rounded-[2.5rem] border-white/5 relative group bg-white/[0.01] hover:border-indigo-500/20 transition-all">
        <button onClick={() => onDelete(p.id)} className="absolute top-6 right-6 w-10 h-10 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
          <i className="fa-solid fa-trash-can text-xs"></i>
        </button>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400">
            <i className="fa-solid fa-bookmark"></i>
          </div>
          <h4 className="font-black text-gray-200 uppercase tracking-widest text-xs">{p.name}</h4>
        </div>
        <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-3 mb-6 font-medium italic">"{p.prompt}"</p>
        <div className="flex flex-wrap gap-2">
          {p.chips.map((c, i) => <span key={i} className="text-[8px] bg-white/5 border border-white/10 px-2 py-1 rounded text-gray-500 uppercase font-black">{c}</span>)}
        </div>
      </div>
    ))}
    {presets.length === 0 && (
      <div className="col-span-full flex flex-col items-center justify-center py-20 opacity-20">
        <i className="fa-solid fa-bookmark text-6xl mb-4"></i>
        <p className="uppercase font-black text-xs tracking-widest">{t.presets} {t.emptyStudio}</p>
      </div>
    )}
  </div>
);

export const MembersDB: React.FC<{ members: any[]; isLoading: boolean; t: any }> = ({ members, isLoading, t }) => (
  <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in">
    <div className="glass rounded-[3rem] border-white/5 overflow-hidden shadow-2xl min-h-[500px] flex flex-col bg-white/[0.01]">
      <div className="p-8 border-b border-white/5 bg-white/[0.02] flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-400 border border-indigo-500/20">
            <i className="fa-solid fa-database"></i>
          </div>
          <h3 className="text-sm font-black uppercase tracking-[0.2em] text-gray-200">Registered Members</h3>
        </div>
        {isLoading && <i className="fa-solid fa-circle-notch fa-spin text-indigo-500"></i>}
      </div>
      {members.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                <th className="px-8 py-5 text-[10px] font-black uppercase text-gray-500 tracking-widest">Username</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase text-gray-500 tracking-widest">Access Identity</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase text-gray-500 tracking-widest">Registration Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {members.map(m => (
                <tr key={m.id} className="hover:bg-white/[0.01] transition-colors group">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center font-black text-[10px] text-white shadow-lg">
                        {(m.username || 'U')[0].toUpperCase()}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-gray-200">{m.username}</span>
                        <span className="text-[9px] text-gray-600 font-mono tracking-tighter uppercase">{m.id}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className="px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-[9px] font-black uppercase text-indigo-400 tracking-widest">
                      Member Tier
                    </span>
                  </td>
                  <td className="px-8 py-6 text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                    {m.joinedAt ? new Date(m.joinedAt).toLocaleDateString() : 'Historical User'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center py-20 text-gray-600 uppercase font-black text-xs tracking-widest opacity-30">
          <i className="fa-solid fa-folder-open text-6xl mb-6"></i>
          {isLoading ? 'Decrypting member registry...' : 'No records found'}
        </div>
      )}
    </div>
  </div>
);
