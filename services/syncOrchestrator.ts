import { User, PromptEntry, Preset } from '../types';
import { StorageService } from './storageService';

/** State of sync operations */
export interface SyncState {
  isSyncing: boolean;
  lastSynced: number;
  error: string | null;
}

/**
 * Orchestrates data synchronization between local and cloud storage
 * Handles sync on login, manual sync triggers, and error reporting
 */
export class SyncOrchestrator {
  private static isSyncing = false;

  /**
   * Synchronize user data on login
   * For authenticated users: performs full bi-directional sync
   * For guests: loads local data only
   */
  static async syncOnLogin(
    user: User,
    onUpdate: (entries: PromptEntry[], presets: Preset[]) => void,
    onError: (error: string) => void
  ): Promise<void> {
    if (!user || user.id === 'anon') {
      // Guest user - just refresh local data
      try {
        const entries = await StorageService.getAllEntries();
        const presets: Preset[] = [];
        onUpdate(entries || [], presets);
      } catch (err: any) {
        console.error('[Sync] Guest refresh failed:', err);
        onError(err.message || 'Failed to load data');
      }
      return;
    }

    if (this.isSyncing) {
      console.warn('[Sync] Already syncing, skipping duplicate request');
      return;
    }

    this.isSyncing = true;

    try {
      console.log('[Sync] Starting sync for user:', user.id);
      const mergedEntries = await StorageService.performFullSync(user.id);
      const loadedPresets = await StorageService.getPresets(user.id);

      onUpdate(mergedEntries, loadedPresets || []);
    } catch (err: any) {
      console.error('[Sync] Sync on login failed:', err);

      let errorMessage = 'Sync failed';
      if (err.message === 'SYNC_TIMEOUT') {
        errorMessage = 'Sync timed out. Some items may not be synced.';
      } else if (err.message?.includes('Failed to fetch')) {
        errorMessage = 'Network error: Failed to connect. Please check your internet connection.';
      }

      onError(errorMessage);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Perform manual cloud synchronization
   * Only for authenticated users (not guests)
   */
  static async performCloudSync(
    userId: string,
    onUpdate: (entries: PromptEntry[]) => void,
    onError: (error: string) => void
  ): Promise<void> {
    if (!userId || userId === 'anon') {
      console.warn('[Sync] Cannot sync for anonymous user');
      return;
    }

    if (this.isSyncing) {
      console.warn('[Sync] Already syncing, skipping duplicate request');
      return;
    }

    this.isSyncing = true;

    try {
      console.log('[Sync] Performing manual cloud sync for user:', userId);
      const merged = await StorageService.performFullSync(userId);
      onUpdate(merged);
    } catch (err: any) {
      console.error('[Sync] Cloud sync failed:', err);

      let errorMessage = 'Sync failed';
      if (err.message?.includes('Failed to fetch')) {
        errorMessage = 'Network error: Failed to connect. Please check your internet connection.';
      }

      onError(errorMessage);
    } finally {
      this.isSyncing = false;
    }
  }

  static isSyncInProgress(): boolean {
    return this.isSyncing;
  }

  static getSyncStatus(): SyncState {
    return {
      isSyncing: this.isSyncing,
      lastSynced: Date.now(),
      error: null
    };
  }
}
