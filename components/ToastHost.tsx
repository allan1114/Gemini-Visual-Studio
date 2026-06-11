import React, { useEffect, useState } from 'react';
import { ToastKind, ToastMessage, subscribeToast } from '../utils/toast';

/** How long each toast stays before auto-dismissing (ms). */
const TOAST_TTL = 20000;

const KIND_STYLES: Record<ToastKind, { wrap: string; icon: string }> = {
  error: {
    wrap: 'bg-red-500/90 border-red-400/50',
    icon: 'fa-triangle-exclamation',
  },
  info: {
    wrap: 'bg-indigo-500/90 border-indigo-400/50',
    icon: 'fa-circle-info',
  },
  success: {
    wrap: 'bg-emerald-500/90 border-emerald-400/50',
    icon: 'fa-circle-check',
  },
  // Rate limits / quota: a calmer amber with an hourglass to signal "wait & retry".
  warning: {
    wrap: 'bg-amber-500/90 border-amber-400/50',
    icon: 'fa-hourglass-half',
  },
};

/**
 * Renders the stack of active toasts pinned to the top-center of the viewport.
 * Subscribes to the toast bus; each toast auto-dismisses after TOAST_TTL and can
 * be closed manually. Timers are cleared on unmount to avoid leaks.
 */
const ToastHost: React.FC = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const timers = new Map<string, ReturnType<typeof setTimeout>>();

    const dismiss = (id: string) => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      const timer = timers.get(id);
      if (timer) {
        clearTimeout(timer);
        timers.delete(id);
      }
    };

    const unsubscribe = subscribeToast((toast) => {
      setToasts((prev) => [...prev, toast]);
      timers.set(
        toast.id,
        setTimeout(() => dismiss(toast.id), TOAST_TTL)
      );
    });

    return () => {
      unsubscribe();
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const close = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[300] flex flex-col items-center gap-2 w-full max-w-md px-4 pointer-events-none">
      {toasts.map((toast) => {
        const style = KIND_STYLES[toast.kind];
        return (
          <div
            key={toast.id}
            className={`pointer-events-auto w-full flex items-center gap-3 ${style.wrap} backdrop-blur-md text-white px-6 py-3 rounded-2xl shadow-2xl border animate-in slide-in-from-top fade-in duration-300`}
          >
            <i className={`fa-solid ${style.icon} shrink-0`}></i>
            <span className="text-xs font-bold flex-1 leading-relaxed break-words">
              {toast.message}
            </span>
            <button
              onClick={() => close(toast.id)}
              className="ml-1 shrink-0 hover:text-white/70 transition-colors"
              aria-label="Dismiss"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default ToastHost;
