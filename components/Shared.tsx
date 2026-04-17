
import React from 'react';
import { ModelChoice, AspectRatio, UsageStats } from '../types';
import { ASPECT_RATIOS } from '../constants';

interface TuningProps {
  currentModel: ModelChoice;
  onModelChange: (m: ModelChoice) => void;
  showRatio?: boolean;
  currentRatio?: AspectRatio;
  onRatioChange?: (r: AspectRatio) => void;
  seed?: number;
  onSeedChange: (s?: number) => void;
  temperature: number;
  onTempChange: (t: number) => void;
  t: any;
}

export const TuningControls: React.FC<TuningProps> = ({ 
  currentModel, onModelChange, showRatio, currentRatio, onRatioChange, seed, onSeedChange, temperature, onTempChange, t 
}) => (
  <div className="space-y-6">
    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-4">引擎選擇 (Model)</label>
    <div className="grid grid-cols-1 gap-2 mb-6">
      <button onClick={() => onModelChange('flash')} className={`p-4 rounded-xl border-2 text-left transition-all ${currentModel === 'flash' ? 'border-indigo-500 bg-indigo-500/10' : 'border-white/5 bg-white/5'}`}>
        <div className="text-xs font-black uppercase">{t.engineFlash}</div>
      </button>
      <button onClick={() => onModelChange('pro')} className={`p-4 rounded-xl border-2 text-left transition-all ${currentModel === 'pro' ? 'border-purple-500 bg-purple-500/10' : 'border-white/5 bg-white/5'}`}>
        <div className="text-xs font-black uppercase">{t.enginePro}</div>
      </button>
    </div>
    {showRatio && (
      <>
        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-4">{t.ratio}</label>
        <div className="grid grid-cols-3 gap-2 mb-6">
          {ASPECT_RATIOS.map(r => <button key={r} onClick={() => onRatioChange?.(r)} className={`py-3 text-[10px] font-black rounded-xl border-2 transition-all ${currentRatio === r ? 'border-indigo-500 bg-indigo-500/10 text-white' : 'border-white/5 bg-white/5 text-gray-600'}`}>{r}</button>)}
        </div>
      </>
    )}
    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-4">{t.seed}</label>
    <div className="flex gap-2 mb-6">
      <input type="number" value={seed ?? ''} onChange={(e) => onSeedChange(e.target.value ? parseInt(e.target.value) : undefined)} className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:ring-1 focus:ring-indigo-500" placeholder="Random" />
      <button onClick={() => onSeedChange(Math.floor(Math.random() * 1000000))} className="p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all text-xs"><i className="fa-solid fa-dice"></i></button>
    </div>
    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-4">{t.creativity} ({temperature})</label>
    <div className="flex items-center gap-4">
      <input type="range" min="0" max="2" step="0.1" value={temperature} onChange={(e) => onTempChange(parseFloat(e.target.value))} className="flex-1 accent-indigo-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer" />
    </div>
  </div>
);

export const UsageCard: React.FC<{ stats: UsageStats; currentModel: ModelChoice; t: any }> = ({ stats, currentModel, t }) => (
  <div className="glass p-6 rounded-[1.5rem] border-white/5 space-y-5 bg-white/[0.02] shadow-2xl">
    <div className="flex items-center gap-3 mb-2">
      <div className="w-9 h-9 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400">
        <i className="fa-solid fa-circle-info text-lg"></i>
      </div>
      <h3 className="font-bold text-gray-200 text-lg">{t.aiInfo}</h3>
    </div>
    <div className="space-y-4">
      <div className="flex justify-between items-center text-sm">
        <span className="text-gray-500 font-medium">{t.currentModel}</span>
        <span className="text-gray-200 font-bold">{currentModel === 'pro' ? 'Gemini 3 Pro' : 'Gemini 3 Flash'}</span>
      </div>
      <div className="flex justify-between items-center text-sm">
        <span className="text-gray-500 font-medium">{t.genCount}</span>
        <span className="text-gray-200 font-bold">{stats.sessionCount} 次</span>
      </div>
    </div>
    <div className="pt-4 border-t border-white/5 space-y-4">
      <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest block">{t.thisGenCons}</label>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-indigo-500/[0.03] border border-white/5 p-4 rounded-2xl">
          <span className="text-[10px] text-gray-500 font-bold block mb-1">{t.inputAmount}</span>
          <span className="text-lg font-black text-gray-200">{stats.lastInputTokens.toLocaleString()}</span>
        </div>
        <div className="bg-indigo-500/[0.03] border border-white/5 p-4 rounded-2xl">
          <span className="text-[10px] text-gray-500 font-bold block mb-1">{t.outputAmount}</span>
          <span className="text-lg font-black text-gray-200">{stats.lastOutputTokens.toLocaleString()}</span>
        </div>
      </div>
    </div>
    <div className="pt-4 border-t border-white/5 space-y-3">
      <div className="flex justify-between items-center">
        <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest">{t.accuTokenCons}</label>
        <span className="text-sm font-black text-indigo-400">{stats.totalTokens.toLocaleString()}</span>
      </div>
      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div className="h-full bg-indigo-500 transition-all duration-1000 ease-out" style={{ width: `${Math.min(100, (stats.totalTokens / 50000) * 100)}%` }}></div>
      </div>
    </div>
    <p className="text-[9px] text-gray-600 leading-relaxed italic">{t.consNote}</p>
  </div>
);
