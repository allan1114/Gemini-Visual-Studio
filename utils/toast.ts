/**
 * Minimal app-wide toast bus. A module-level pub/sub lets any layer — hooks,
 * services, components — surface a transient message at the top-center of the
 * screen without threading callbacks or React context through the tree. The
 * single subscriber is <ToastHost/>, mounted once at the app root.
 */

export type ToastKind = 'error' | 'info' | 'success';

export interface ToastMessage {
  id: string;
  message: string;
  kind: ToastKind;
}

type Listener = (toast: ToastMessage) => void;

const listeners = new Set<Listener>();

/** Emits a toast to the mounted <ToastHost/>. Defaults to an error toast. */
export function showToast(message: string, kind: ToastKind = 'error'): void {
  if (!message) return;
  const toast: ToastMessage = {
    id:
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`,
    message,
    kind,
  };
  listeners.forEach((fn) => fn(toast));
}

/** Subscribes to toast emissions. Returns an unsubscribe function. */
export function subscribeToast(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
