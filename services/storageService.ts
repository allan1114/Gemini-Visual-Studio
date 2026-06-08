import { PromptEntry, Preset, ModelChoice, GenerationConfig } from '../types';
import { SupabaseService, supabase } from './supabaseService';
import { ErrorHandler } from '../utils/errorHandler';

const DB_NAME = 'GeminiStudioDB';
const STORE_NAME = 'studio_entries';
// v2 adds a `timestamp` index for ordered/paginated reads without a full scan.
const DB_VERSION = 2;

export class StorageService {
  private static db: IDBDatabase | null = null;
  private static isSyncing = false;
  private static syncPromise: Promise<PromptEntry[]> | null = null;
  // Entry ids whose background cloud sync failed; retried on the next full sync.
  private static cloudRetryQueue = new Map<string, PromptEntry>();

  private static async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        const tx = request.transaction;
        const store = db.objectStoreNames.contains(STORE_NAME)
          ? tx!.objectStore(STORE_NAME)
          : db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        if (!store.indexNames.contains('timestamp')) {
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve(this.db!);
      };
      request.onerror = () => reject(new Error('Failed to open IndexedDB'));
    });
  }

  /**
   * Frees local space when IndexedDB hits its quota by removing the oldest
   * entries that are already backed up to the cloud (their imageUrl is a remote
   * URL). The cloud copy is preserved and re-downloaded on the next sync.
   */
  private static async purgeOldestSynced(maxToRemove = 25): Promise<number> {
    const all = await this.getAllEntries();
    const candidates = all
      .filter((e) => typeof e.imageUrl === 'string' && /^https?:/i.test(e.imageUrl))
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(0, maxToRemove);
    if (candidates.length === 0) return 0;
    const db = await this.getDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      candidates.forEach((e) => store.delete(e.id));
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
    return candidates.length;
  }

  private static isQuotaError(err: unknown): boolean {
    const e = err as { name?: string };
    return e?.name === 'QuotaExceededError' || e?.name === 'NS_ERROR_DOM_QUOTA_REACHED';
  }

  private static mapToDb(entry: PromptEntry, userId: string) {
    return {
      id: entry.id,
      user_id: userId,
      author: entry.author,
      text: entry.text,
      negative_prompt: entry.negativePrompt || '',
      tags: entry.tags || [],
      image_url: entry.imageUrl,
      model: entry.model,
      type: entry.type,
      config: entry.config || {},
      timestamp: entry.timestamp,
    };
  }

  private static mapFromDb(dbEntry: Record<string, unknown>): PromptEntry {
    return {
      id: dbEntry.id as string,
      userId: dbEntry.user_id as string,
      author: dbEntry.author as string,
      text: dbEntry.text as string,
      negativePrompt: dbEntry.negative_prompt as string | undefined,
      tags: dbEntry.tags as string[] | undefined,
      imageUrl: dbEntry.image_url as string | undefined,
      model: dbEntry.model as ModelChoice,
      type: dbEntry.type as 'generation' | 'edit' | 'avatar',
      config: dbEntry.config as GenerationConfig | undefined,
      timestamp: dbEntry.timestamp as number,
    };
  }

  /**
   * Performs full bi-directional sync between local DB and Cloud.
   * Uses promise-based locking to prevent concurrent sync operations.
   */
  static async performFullSync(userId: string): Promise<PromptEntry[]> {
    if (!userId || userId === 'anon') return await this.getAllEntries();

    // Return existing sync promise if one is already in progress
    if (this.syncPromise) {
      return this.syncPromise;
    }

    // Create new sync promise
    this.syncPromise = this.performSyncInternal(userId);

    try {
      return await this.syncPromise;
    } finally {
      this.syncPromise = null;
      this.isSyncing = false;
    }
  }

  private static async performSyncInternal(userId: string): Promise<PromptEntry[]> {
    this.isSyncing = true;

    try {
      const timeoutPromise = new Promise(
        (_, reject) => setTimeout(() => reject(new Error('SYNC_TIMEOUT')), 120000) // 2 minutes total sync timeout
      );

      const syncPromise = (async () => {
        // Flush any entries whose background sync previously failed.
        if (this.cloudRetryQueue.size > 0) {
          const pending = Array.from(this.cloudRetryQueue.values());
          console.log(`[Sync] Retrying ${pending.length} previously failed uploads...`);
          await Promise.all(
            pending.map((entry) =>
              this.syncEntryToCloud(entry, userId)
                .then(() => this.cloudRetryQueue.delete(entry.id))
                .catch((err) => console.warn('[Sync] Retry still failing for', entry.id, err))
            )
          );
        }

        console.log('[Sync] Fetching local entries...');
        const localEntries = await this.getAllEntries();

        console.log('[Sync] Fetching cloud timestamps...');
        const { data: cloudData, error } = await supabase
          .from('studio_entries')
          .select('id, timestamp')
          .eq('user_id', userId);

        if (error) throw error;

        const cloudMap = new Map<string, number>(
          (cloudData || []).map((c: any) => [c.id, Number(c.timestamp)])
        );
        const localMap = new Map<string, number>(
          localEntries.map((l) => [l.id, Number(l.timestamp)])
        );

        // 1. Local to Cloud (Upload if missing or newer)
        const toUpload = localEntries.filter(
          (l) => !cloudMap.has(l.id) || Number(l.timestamp) > (cloudMap.get(l.id) || 0)
        );

        if (toUpload.length > 0) {
          console.log(`[Sync] Found ${toUpload.length} entries to upload.`);
          // Parallelize with a limit of 3 concurrent uploads
          const concurrencyLimit = 3;
          for (let i = 0; i < toUpload.length; i += concurrencyLimit) {
            const chunk = toUpload.slice(i, i + concurrencyLimit);
            console.log(`[Sync] Uploading chunk ${i / concurrencyLimit + 1}...`);
            await Promise.all(
              chunk.map((entry) =>
                this.syncEntryToCloud(entry, userId).catch((err) =>
                  console.error(`[Sync] Failed to sync ${entry.id}:`, err)
                )
              )
            );
            console.log(
              `[Sync] Upload Progress: ${Math.min(i + concurrencyLimit, toUpload.length)}/${toUpload.length}`
            );
          }
        }

        // 2. Cloud to Local (Download if missing or newer)
        const toDownloadIds = (cloudData || [])
          .filter(
            (c: any) => !localMap.has(c.id) || Number(c.timestamp) > (localMap.get(c.id) || 0)
          )
          .map((c: any) => c.id);

        if (toDownloadIds.length > 0) {
          console.log(`[Sync] Found ${toDownloadIds.length} entries to download.`);
          for (let i = 0; i < toDownloadIds.length; i += 20) {
            const ids = toDownloadIds.slice(i, i + 20);
            console.log(`[Sync] Downloading chunk ${i / 20 + 1}...`);
            const { data: downloaded, error: dlErr } = await supabase
              .from('studio_entries')
              .select('*')
              .in('id', ids);

            if (!dlErr && downloaded) {
              const db = await this.getDB();
              const tx = db.transaction(STORE_NAME, 'readwrite');
              const store = tx.objectStore(STORE_NAME);
              downloaded.forEach((item) => store.put(this.mapFromDb(item)));
            }
          }
          console.log(`[Sync] Download complete.`);
        }

        console.log('[Sync] Full sync completed successfully.');
        return await this.getAllEntries();
      })();

      return (await Promise.race([syncPromise, timeoutPromise])) as PromptEntry[];
    } catch (err: any) {
      if (err.message === 'SYNC_TIMEOUT') {
        console.warn('[Sync] Full sync timed out, some items may not be synced.');
      } else {
        console.error('Sync failed:', err);
      }
      return await this.getAllEntries();
    }
  }

  private static async updateLocalUrl(id: string, url: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(id);
      request.onsuccess = () => {
        const entry = request.result;
        if (entry) {
          entry.imageUrl = url;
          const putRequest = store.put(entry);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Internal method to push an entry to cloud storage and database.
   */
  private static async syncEntryToCloud(entry: PromptEntry, userId: string): Promise<void> {
    if (!userId || userId === 'anon') return;

    let finalUrl = entry.imageUrl;

    // Upload image to Storage if it's still a local base64 blob
    if (finalUrl?.startsWith('data:')) {
      const publicUrl = await SupabaseService.uploadImage(userId, entry.id, finalUrl);
      if (publicUrl) {
        finalUrl = publicUrl;
        // Persistence: update local URL so we don't upload it again
        await this.updateLocalUrl(entry.id, publicUrl);
      }
    }

    // Upsert metadata to DB
    const payload = this.mapToDb({ ...entry, imageUrl: finalUrl }, userId);
    const { error } = await supabase.from('studio_entries').upsert(payload);
    if (error) throw error;
  }

  static async getAllEntries(): Promise<PromptEntry[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () =>
        resolve((request.result || []).sort((a: any, b: any) => b.timestamp - a.timestamp));
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Local-first save logic. Resolves as soon as the entry is in IndexedDB.
   * Syncing to cloud happens asynchronously in the background.
   */
  /** Writes a single entry to IndexedDB, recovering once from a quota error. */
  private static async putLocal(entry: PromptEntry, allowPurge = true): Promise<void> {
    const db = await this.getDB();
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(entry);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
        transaction.onabort = () => reject(transaction.error);
      });
    } catch (err) {
      if (allowPurge && this.isQuotaError(err)) {
        const removed = await this.purgeOldestSynced();
        console.warn(`[Storage] Quota exceeded; purged ${removed} synced entries and retrying.`);
        if (removed > 0) return this.putLocal(entry, false);
      }
      throw err;
    }
  }

  static async saveEntry(entry: PromptEntry, userId: string): Promise<void> {
    // 1. Immediate Local Save (with quota recovery)
    await this.putLocal(entry);

    // 2. Background Cloud Sync (Optimistic UI)
    if (userId && userId !== 'anon') {
      // Fire and forget, but queue for retry on failure.
      this.syncEntryToCloud(entry, userId).catch((err) => {
        console.warn('Background cloud sync failed for entry:', entry.id, err);
        this.cloudRetryQueue.set(entry.id, entry);
      });
    }
  }

  static async saveEntries(entries: PromptEntry[], userId: string): Promise<void> {
    // Parallelize local saves
    await Promise.all(entries.map((e) => this.saveEntry(e, userId)));
  }

  static async deleteEntry(id: string, userId?: string): Promise<void> {
    const db = await this.getDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.delete(id);

    if (userId && userId !== 'anon') {
      // No need to wait for storage removal to finish locally
      supabase
        .from('studio_entries')
        .delete()
        .eq('id', id)
        .then(({ error }) => {
          if (error) console.error('Cloud delete error:', error);
        });
      SupabaseService.deleteImage(userId, id).catch((err) =>
        console.error('Cloud image delete error:', err)
      );
    }
  }

  static async savePreset(preset: Preset, userId: string): Promise<void> {
    const existing = JSON.parse(localStorage.getItem('gvs_presets_v2') || '[]');
    localStorage.setItem('gvs_presets_v2', JSON.stringify([preset, ...existing]));

    if (userId && userId !== 'anon') {
      supabase
        .from('presets')
        .upsert({
          id: preset.id,
          user_id: userId,
          name: preset.name,
          prompt: preset.prompt,
          negative_prompt: preset.negativePrompt,
          chips: preset.chips,
          aspect_ratio: preset.aspectRatio,
          image_size: preset.imageSize,
          model: preset.model,
          temperature: preset.temperature,
          timestamp: preset.timestamp,
        })
        .then(({ error }) => {
          if (error) console.error('Cloud preset save error:', error);
        });
    }
  }

  static async getPresets(userId?: string): Promise<Preset[]> {
    const local = JSON.parse(localStorage.getItem('gvs_presets_v2') || '[]');
    if (userId && userId !== 'anon') {
      const { data, error } = await supabase
        .from('presets')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false });

      if (!error && data) {
        return data.map((p) => ({
          id: p.id,
          userId: p.user_id,
          name: p.name,
          prompt: p.prompt,
          negativePrompt: p.negative_prompt,
          chips: p.chips,
          aspectRatio: p.aspect_ratio,
          imageSize: p.image_size,
          model: p.model,
          temperature: p.temperature,
          timestamp: p.timestamp,
        }));
      }
    }
    return local;
  }
}
