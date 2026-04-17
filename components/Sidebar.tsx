
import React from 'react';
import { View, User } from '../types';

interface SidebarProps {
  currentView: View;
  onViewChange: (view: View) => void;
  user: User | null;
  isOpen?: boolean;
  onClose?: () => void;
  onSyncClick?: () => void;
  isSyncing?: boolean;
  lastSynced?: number;
  t: any;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  currentView, onViewChange, user, isOpen, onClose, onSyncClick, isSyncing, lastSynced, t 
}) => {
  const isLoggedIn = !!user;
  const isAdmin = user?.isAdmin || false;

  const items = [
    { id: View.GALLERY, icon: 'fa-earth-americas', label: t.gallery },
    { id: View.GENERATE, icon: 'fa-wand-magic-sparkles', label: t.create },
    { id: View.AVATAR, icon: 'fa-user-astronaut', label: t.avatar },
    { id: View.EDIT, icon: 'fa-wand-magic', label: t.edit },
    { id: View.STUDIO, icon: 'fa-images', label: t.studio, requiresAuth: true },
    { id: View.PROMPTS, icon: 'fa-terminal', label: t.prompts, requiresAuth: true },
    { id: View.PRESETS, icon: 'fa-bookmark', label: t.presets, requiresAuth: true },
    { id: View.KEY_WALLET, icon: 'fa-wallet', label: t.keyWallet || 'Key Wallet' },
    { id: View.DATABASE, icon: 'fa-database', label: t.memberDb, requiresAuth: true, adminOnly: true },
  ];

  const sidebarClasses = `
    fixed inset-y-0 left-0 z-50 w-72 bg-[#0a0a0a] border-r border-white/10 p-6 flex flex-col gap-8 
    transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 md:flex h-full
    ${isOpen ? 'translate-x-0' : '-translate-x-full'}
  `;

  const formatLastSync = (timestamp: number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <aside className={sidebarClasses}>
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <i className="fa-solid fa-layer-group text-white"></i>
          </div>
          <h1 className="text-xl font-bold tracking-tight">Gemini Studio</h1>
        </div>
        <button 
          onClick={onClose}
          className="md:hidden w-8 h-8 flex items-center justify-center bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
        >
          <i className="fa-solid fa-xmark text-gray-400"></i>
        </button>
      </div>

      <nav className="flex flex-col gap-1 overflow-y-auto scrollbar-hide">
        {items.map((item) => {
          if (item.requiresAuth && !isLoggedIn) return null;
          if (item.adminOnly && !isAdmin) return null;

          return (
            <button
              key={item.id}
              onClick={() => {
                onViewChange(item.id as View);
                if (onClose) onClose();
              }}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group ${
                currentView === item.id
                  ? 'bg-indigo-500/10 text-indigo-400 font-semibold shadow-[inset_0_0_0_1px_rgba(99,102,241,0.2)]'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <i className={`fa-solid ${item.icon} w-5 text-center group-hover:scale-110 transition-transform ${currentView === item.id ? 'text-indigo-400' : ''}`}></i>
              <span className="text-sm">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="mt-auto space-y-4">
        {isLoggedIn && user?.id !== 'anon' && (
          <div className="space-y-2">
            <button 
              onClick={onSyncClick}
              disabled={isSyncing}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl glass border-indigo-500/20 text-xs font-bold transition-all hover:bg-indigo-500/5 group ${isSyncing ? 'opacity-50' : ''}`}
            >
              <div className="flex items-center gap-3">
                <i className={`fa-solid fa-cloud-arrow-up ${isSyncing ? 'fa-spin text-indigo-400' : 'text-gray-500 group-hover:text-indigo-400'}`}></i>
                <span className="text-gray-400 group-hover:text-white transition-colors">
                  {isSyncing ? t.syncing : t.cloudSync}
                </span>
              </div>
              <div className={`w-2 h-2 rounded-full ${isSyncing ? 'bg-indigo-500 animate-pulse' : 'bg-green-500'} shadow-[0_0_8px_rgba(34,197,94,0.6)]`}></div>
            </button>
            {lastSynced ? (
              <p className="text-[9px] text-gray-600 text-center uppercase tracking-widest px-4">
                {t.lastSynced.replace('{time}', formatLastSync(lastSynced))}
              </p>
            ) : null}
          </div>
        )}

        <div className="p-4 glass rounded-xl text-[11px] text-gray-500 leading-relaxed border-indigo-500/10">
          <p className="flex items-center gap-2 mb-2 text-indigo-400 font-bold uppercase tracking-widest">
            <i className="fa-solid fa-shield-halved"></i> 
            {user?.id === 'anon' ? 'Guest Access' : (isAdmin ? 'Admin Console' : 'Member Access')}
          </p>
          <p>
            {user?.id === 'anon' 
              ? t.guestWarning 
              : (isAdmin ? 'Manage members and synchronize creative library.' : 'Your creations are synchronized with Supabase.')}
          </p>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
