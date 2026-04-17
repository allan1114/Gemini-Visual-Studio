
import React, { useState, useEffect } from 'react';
import { ApiKeyRecord } from '../types';
import { STORAGE_KEYS } from '../constants';
import { GeminiService } from '../services/geminiService';

interface KeyWalletProps {
  t: any;
}

const KeyWallet: React.FC<KeyWalletProps> = ({ t }) => {
  const [keys, setKeys] = useState<ApiKeyRecord[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newKey, setNewKey] = useState({ label: '', key: '' });
  const [testingId, setTestingId] = useState<string | null>(null);
  const [hasStudioKey, setHasStudioKey] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.API_KEYS);
    if (saved) setKeys(JSON.parse(saved));

    // Check for AI Studio platform key
    if ((window as any).aistudio) {
      (window as any).aistudio.hasSelectedApiKey().then((has: boolean) => {
        setHasStudioKey(has);
      });
    }
  }, []);

  const handleSelectStudioKey = async () => {
    if ((window as any).aistudio) {
      await (window as any).aistudio.openSelectKey();
      const has = await (window as any).aistudio.hasSelectedApiKey();
      setHasStudioKey(has);
    }
  };

  const saveKeys = (updated: ApiKeyRecord[]) => {
    setKeys(updated);
    localStorage.setItem(STORAGE_KEYS.API_KEYS, JSON.stringify(updated));
  };

  const handleAdd = () => {
    if (!newKey.label || !newKey.key) return;
    const record: ApiKeyRecord = {
      id: crypto.randomUUID(),
      label: newKey.label,
      key: newKey.key,
      isActive: keys.length === 0,
      status: 'unknown'
    };
    saveKeys([...keys, record]);
    setNewKey({ label: '', key: '' });
    setIsAdding(false);
  };

  const handleToggleActive = (id: string) => {
    const updated = keys.map(k => ({
      ...k,
      isActive: k.id === id
    }));
    saveKeys(updated);
  };

  const handleDelete = (id: string) => {
    const updated = keys.filter(k => k.id !== id);
    if (updated.length > 0 && !updated.find(k => k.isActive)) {
      updated[0].isActive = true;
    }
    saveKeys(updated);
  };

  const handleTest = async (record: ApiKeyRecord) => {
    setTestingId(record.id);
    const success = await GeminiService.testKey(record.key);
    const updated = keys.map(k => k.id === record.id ? { 
      ...k, 
      status: success ? 'active' : 'invalid' as any,
      lastTested: Date.now()
    } : k);
    saveKeys(updated);
    setTestingId(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-white mb-2">Key Wallet</h2>
          <p className="text-gray-500 text-sm font-medium">Manage multiple Gemini API keys for Pro & Veo models.</p>
        </div>
        <div className="flex gap-3">
          {(window as any).aistudio && (
            <button 
              onClick={handleSelectStudioKey}
              className={`px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all flex items-center gap-2 ${hasStudioKey ? 'bg-green-600/20 text-green-400 border border-green-500/30' : 'bg-amber-600 hover:bg-amber-500 text-white animate-pulse'}`}
            >
              <i className={`fa-solid ${hasStudioKey ? 'fa-key' : 'fa-triangle-exclamation'}`}></i>
              {hasStudioKey ? 'Studio Key Active' : 'Select Studio Key'}
            </button>
          )}
          <button 
            onClick={() => setIsAdding(true)}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all"
          >
            <i className="fa-solid fa-plus mr-2"></i> Add New Key
          </button>
        </div>
      </div>

      {(window as any).aistudio && !hasStudioKey && (
        <div className="p-6 bg-amber-500/10 border border-amber-500/20 rounded-[2rem] flex items-start gap-4 animate-in slide-in-from-top duration-500">
          <div className="w-12 h-12 bg-amber-500/20 rounded-2xl flex items-center justify-center text-amber-500 shrink-0">
            <i className="fa-solid fa-circle-info text-xl"></i>
          </div>
          <div>
            <h4 className="text-amber-500 font-black uppercase tracking-widest text-xs mb-1">AI Studio Key Required</h4>
            <p className="text-amber-500/70 text-[11px] leading-relaxed font-medium">
              To use high-end models like <b>Gemini 3 Pro</b> or <b>Veo</b>, you must select an API key from your Google Cloud project. 
              Click the "Select Studio Key" button above to open the platform dialog. 
              <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="underline ml-1 hover:text-amber-400">Learn about billing</a>.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {keys.map(k => (
          <div key={k.id} className={`glass p-6 rounded-[2rem] border-2 transition-all flex items-center justify-between ${k.isActive ? 'border-indigo-500 bg-indigo-500/5' : 'border-white/5 hover:border-white/10'}`}>
            <div className="flex items-center gap-6">
              <div 
                onClick={() => handleToggleActive(k.id)}
                className={`w-12 h-12 rounded-2xl flex items-center justify-center cursor-pointer transition-all ${k.isActive ? 'bg-indigo-500 text-white shadow-lg' : 'bg-white/5 text-gray-500 hover:bg-white/10'}`}
              >
                {k.isActive ? <i className="fa-solid fa-check-circle text-xl"></i> : <i className="fa-solid fa-circle text-xs opacity-20"></i>}
              </div>
              
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="font-black text-gray-200 uppercase tracking-wider">{k.label}</h3>
                  <div className={`w-2 h-2 rounded-full ${
                    k.status === 'active' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' :
                    k.status === 'invalid' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]' :
                    'bg-gray-600'
                  }`}></div>
                </div>
                <p className="text-xs font-mono text-gray-500 tracking-tighter">
                  {k.key.substring(0, 10)}••••••••••••••••{k.key.substring(k.key.length - 4)}
                </p>
                {k.lastTested && (
                  <span className="text-[9px] text-gray-600 font-bold uppercase mt-2 block">
                    Last tested: {new Date(k.lastTested).toLocaleString()}
                  </span>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <button 
                onClick={() => handleTest(k)}
                disabled={testingId === k.id}
                className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all disabled:opacity-50"
              >
                {testingId === k.id ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-vial"></i>}
              </button>
              <button 
                onClick={() => handleDelete(k.id)}
                className="w-10 h-10 rounded-xl bg-white/5 hover:bg-red-500/20 text-gray-500 hover:text-red-400 flex items-center justify-center transition-all"
              >
                <i className="fa-solid fa-trash-can"></i>
              </button>
            </div>
          </div>
        ))}

        {keys.length === 0 && (
          <div className="py-20 flex flex-col items-center justify-center opacity-20 border-2 border-dashed border-white/10 rounded-[3rem]">
            <i className="fa-solid fa-wallet text-6xl mb-4"></i>
            <p className="font-black uppercase tracking-[0.4em] text-xs">Wallet is empty</p>
          </div>
        )}
      </div>

      {isAdding && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={() => setIsAdding(false)}></div>
          <div className="relative glass w-full max-w-md p-10 rounded-[3rem] border-white/10 shadow-2xl animate-in zoom-in duration-300">
            <h3 className="text-2xl font-black mb-8">Add API Key</h3>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">Key Label (e.g. Work)</label>
                <input 
                  type="text" 
                  value={newKey.label}
                  onChange={e => setNewKey({...newKey, label: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-indigo-500/50"
                  placeholder="Personal Key 1"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">API Key String</label>
                <input 
                  type="password" 
                  value={newKey.key}
                  onChange={e => setNewKey({...newKey, key: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-indigo-500/50"
                  placeholder="AIza..."
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button 
                  onClick={() => setIsAdding(false)}
                  className="flex-1 py-4 bg-white/5 hover:bg-white/10 rounded-2xl font-black text-xs uppercase"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleAdd}
                  className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-black text-xs uppercase shadow-xl"
                >
                  Save Key
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KeyWallet;
