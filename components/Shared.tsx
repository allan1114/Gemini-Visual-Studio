import React from 'react';
import { ModelChoice, AspectRatio, UsageStats, ProviderType } from '../types';
import { ASPECT_RATIOS, PROVIDERS, PROVIDER_ICONS, STORAGE_KEYS } from '../constants';

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
  /** Show the free Imagen 4 text-to-image engines (Generate view only). */
  showImagen?: boolean;
  t: any;
}

/**
 * Per-engine presentation metadata. `nameKey`/`descKey` index the translation
 * object; the colour trio keeps the active highlight consistent across the
 * accent bar, border/background and the check icon.
 */
interface ModelMeta {
  id: ModelChoice;
  nameKey: string;
  fallbackName: string;
  descKey: string;
  active: string;
  bar: string;
  check: string;
  imagenOnly?: boolean;
}

const MODEL_META: ModelMeta[] = [
  {
    id: 'flash',
    nameKey: 'engineFlash',
    fallbackName: 'Gemini 3 Flash',
    descKey: 'engineFlashDesc',
    active: 'border-indigo-500 bg-indigo-500/10',
    bar: 'bg-indigo-500',
    check: 'text-indigo-400',
  },
  {
    id: 'pro',
    nameKey: 'enginePro',
    fallbackName: 'Gemini 3 Pro',
    descKey: 'engineProDesc',
    active: 'border-purple-500 bg-purple-500/10',
    bar: 'bg-purple-500',
    check: 'text-purple-400',
  },
  {
    id: 'imagen-4',
    nameKey: 'engineImagen',
    fallbackName: 'Imagen 4',
    descKey: 'engineImagenDesc',
    active: 'border-emerald-500 bg-emerald-500/10',
    bar: 'bg-emerald-500',
    check: 'text-emerald-400',
    imagenOnly: true,
  },
  {
    id: 'imagen-4-fast',
    nameKey: 'engineImagenFast',
    fallbackName: 'Imagen 4 Fast',
    descKey: 'engineImagenFastDesc',
    active: 'border-emerald-500 bg-emerald-500/10',
    bar: 'bg-emerald-500',
    check: 'text-emerald-400',
    imagenOnly: true,
  },
  {
    id: 'imagen-4-ultra',
    nameKey: 'engineImagenUltra',
    fallbackName: 'Imagen 4 Ultra',
    descKey: 'engineImagenUltraDesc',
    active: 'border-emerald-500 bg-emerald-500/10',
    bar: 'bg-emerald-500',
    check: 'text-emerald-400',
    imagenOnly: true,
  },
];

export const TuningControls: React.FC<TuningProps> = ({
  currentModel,
  onModelChange,
  showRatio,
  currentRatio,
  onRatioChange,
  seed,
  onSeedChange,
  temperature,
  onTempChange,
  showImagen,
  t,
}) => {
  const models = MODEL_META.filter((m) => !m.imagenOnly || showImagen);
  // Semantic zone for the current temperature, used to highlight the scale.
  const tempZone = temperature <= 0.6 ? 0 : temperature >= 1.4 ? 2 : 1;
  // The active provider decides what "engine" means: Gemini exposes the
  // Flash/Pro/Imagen choices, whereas fal.ai / OpenAI-compatible providers run a
  // single model configured per-key in the Key Wallet.
  const { provider, imageModelId } = useActiveEndpoint();
  const isGemini = provider === 'gemini';

  return (
    <div className="space-y-6">
      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-4">
        引擎選擇 (Model)
      </label>
      {isGemini ? (
        <div className="grid grid-cols-1 gap-2 mb-6">
          {models.map((m) => {
            const isActive = currentModel === m.id;
            return (
              <button
                key={m.id}
                onClick={() => onModelChange(m.id)}
                className={`relative p-4 pl-5 rounded-xl border-2 text-left transition-all flex items-center justify-between ${isActive ? m.active : 'border-white/5 bg-white/5 hover:bg-white/10'}`}
              >
                {isActive && (
                  <span
                    className={`absolute left-0 top-2.5 bottom-2.5 w-1 rounded-full ${m.bar}`}
                  ></span>
                )}
                <div>
                  <div className="text-xs font-black uppercase">
                    {t[m.nameKey] || m.fallbackName}
                  </div>
                  <div className="text-[10px] text-gray-500 font-medium mt-0.5">{t[m.descKey]}</div>
                </div>
                {isActive && <i className={`fa-solid fa-circle-check ${m.check}`}></i>}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="mb-6">
          <div className="relative p-4 pl-5 rounded-xl border-2 border-indigo-500 bg-indigo-500/10 flex items-center justify-between">
            <span className="absolute left-0 top-2.5 bottom-2.5 w-1 rounded-full bg-indigo-500"></span>
            <div className="flex items-center gap-3 min-w-0">
              <i className={`fa-solid ${PROVIDER_ICONS[provider]} text-indigo-400`}></i>
              <div className="min-w-0">
                <div className="text-xs font-black uppercase">
                  {PROVIDERS[provider]?.label ?? provider}
                </div>
                <div className="text-[10px] text-gray-500 font-medium mt-0.5 truncate">
                  {imageModelId || PROVIDERS[provider]?.defaultImageModel}
                </div>
              </div>
            </div>
            <i className="fa-solid fa-circle-check text-indigo-400 shrink-0"></i>
          </div>
          <p className="text-[9px] text-gray-600 leading-relaxed mt-2">{t.engineManagedNote}</p>
        </div>
      )}
      {showRatio && (
        <>
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-4">
            {t.ratio}
          </label>
          <div className="grid grid-cols-3 gap-2 mb-6">
            {ASPECT_RATIOS.map((r) => (
              <button
                key={r}
                onClick={() => onRatioChange?.(r)}
                className={`py-3 text-[10px] font-black rounded-xl border-2 transition-all ${currentRatio === r ? 'border-indigo-500 bg-indigo-500/10 text-white' : 'border-white/5 bg-white/5 text-gray-600'}`}
              >
                {r}
              </button>
            ))}
          </div>
        </>
      )}
      <div className="flex items-center gap-2 mb-4">
        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
          {t.seed}
        </label>
        <i
          className="fa-solid fa-circle-question text-gray-600 text-[10px] cursor-help"
          title={t.seedHelp}
        ></i>
      </div>
      <div className="flex gap-2 mb-2">
        <input
          type="number"
          value={seed ?? ''}
          onChange={(e) => onSeedChange(e.target.value ? parseInt(e.target.value) : undefined)}
          className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:ring-1 focus:ring-indigo-500"
          placeholder="Random"
        />
        <button
          onClick={() => onSeedChange(Math.floor(Math.random() * 1000000))}
          className="p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all text-xs"
          title={t.seedHelp}
        >
          <i className="fa-solid fa-dice"></i>
        </button>
      </div>
      <p className="text-[9px] text-gray-600 leading-relaxed mb-6">{t.seedHelp}</p>
      <div className="flex items-center gap-2 mb-4">
        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
          {t.creativity} ({temperature})
        </label>
        <i
          className="fa-solid fa-circle-question text-gray-600 text-[10px] cursor-help"
          title={t.tempHelp}
        ></i>
      </div>
      <div className="flex items-center gap-4">
        <input
          type="range"
          min="0"
          max="2"
          step="0.1"
          value={temperature}
          onChange={(e) => onTempChange(parseFloat(e.target.value))}
          className="flex-1 accent-indigo-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
        />
      </div>
      <div className="flex justify-between mt-2 text-[9px] font-black uppercase tracking-wider">
        <span className={tempZone === 0 ? 'text-indigo-400' : 'text-gray-600'}>
          {t.tempPrecise}
        </span>
        <span className={tempZone === 1 ? 'text-indigo-400' : 'text-gray-600'}>
          {t.tempBalanced}
        </span>
        <span className={tempZone === 2 ? 'text-indigo-400' : 'text-gray-600'}>{t.tempBold}</span>
      </div>
    </div>
  );
};

/** Reads the active key's provider + image model from storage (defaults to Gemini). */
export function useActiveEndpoint(): { provider: ProviderType; imageModelId?: string } {
  const [info, setInfo] = React.useState<{ provider: ProviderType; imageModelId?: string }>({
    provider: 'gemini',
  });
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.API_KEYS);
      if (raw) {
        const keys = JSON.parse(raw);
        const active = Array.isArray(keys) ? keys.find((k: any) => k.isActive) : null;
        if (active?.provider) {
          setInfo({ provider: active.provider, imageModelId: active.imageModelId });
        }
      }
    } catch {
      // Malformed storage — keep the Gemini default.
    }
  }, []);
  return info;
}

export const UsageCard: React.FC<{ stats: UsageStats; currentModel: ModelChoice; t: any }> = ({
  stats,
  currentModel,
  t,
}) => {
  const { provider } = useActiveEndpoint();
  return (
    <div className="glass p-6 rounded-[1.5rem] border-white/5 space-y-5 bg-white/[0.02] shadow-2xl">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400">
          <i className="fa-solid fa-circle-info text-lg"></i>
        </div>
        <h3 className="font-bold text-gray-200 text-lg">{t.aiInfo}</h3>
        <span
          className="ml-auto inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-white/5 text-gray-300"
          title={t.activeProvider}
        >
          <i className={`fa-solid ${PROVIDER_ICONS[provider]} text-indigo-400`}></i>
          {PROVIDERS[provider]?.label ?? 'Gemini'}
        </span>
      </div>
      <div className="space-y-4">
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-500 font-medium">{t.currentModel}</span>
          <span className="text-gray-200 font-bold">
            {currentModel === 'pro'
              ? 'Gemini 3 Pro'
              : currentModel === 'imagen-4'
                ? 'Imagen 4'
                : currentModel === 'imagen-4-fast'
                  ? 'Imagen 4 Fast'
                  : currentModel === 'imagen-4-ultra'
                    ? 'Imagen 4 Ultra'
                    : 'Gemini 3 Flash'}
          </span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-500 font-medium">{t.genCount}</span>
          <span className="text-gray-200 font-bold">{stats.sessionCount} 次</span>
        </div>
      </div>
      <div className="pt-4 border-t border-white/5 space-y-4">
        <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest block">
          {t.thisGenCons}
        </label>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-indigo-500/[0.03] border border-white/5 p-4 rounded-2xl">
            <span className="text-[10px] text-gray-500 font-bold block mb-1">{t.inputAmount}</span>
            <span className="text-lg font-black text-gray-200">
              {stats.lastInputTokens.toLocaleString()}
            </span>
          </div>
          <div className="bg-indigo-500/[0.03] border border-white/5 p-4 rounded-2xl">
            <span className="text-[10px] text-gray-500 font-bold block mb-1">{t.outputAmount}</span>
            <span className="text-lg font-black text-gray-200">
              {stats.lastOutputTokens.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
      <div className="pt-4 border-t border-white/5 space-y-3">
        <div className="flex justify-between items-center">
          <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest">
            {t.accuTokenCons}
          </label>
          <span className="text-sm font-black text-indigo-400">
            {stats.totalTokens.toLocaleString()}
          </span>
        </div>
        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 transition-all duration-1000 ease-out"
            style={{ width: `${Math.min(100, (stats.totalTokens / 50000) * 100)}%` }}
          ></div>
        </div>
      </div>
      <p className="text-[9px] text-gray-600 leading-relaxed italic">{t.consNote}</p>
    </div>
  );
};
