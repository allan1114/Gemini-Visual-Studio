
import { PromptEntry, Preset } from '../types';
import { SupabaseService, supabase } from './supabaseService';
import { ErrorHandler } from '../utils/errorHandler';

const DB_NAME = 'GeminiStudioDB';
const STORE_NAME = 'studio_entries';
const DB_VERSION = 1;

export class StorageService {
  private static db: IDBDatabase | null = null;
  private static isSyncing = false;

  private static async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve(this.db!);
      };
      request.onerror = () => reject(new Error('Failed to open IndexedDB'));
    });
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
      timestamp: entry.timestamp
    };
  }

  private static mapFromDb(dbEntry: Record<string, unknown>): PromptEntry {
    return {
      id: dbEntry.id,
      userId: dbEntry.user_id,
      author: dbEntry.author,
      text: dbEntry.text,
      negativePrompt: dbEntry.negative_prompt,
      tags: dbEntry.tags,
      imageUrl: dbEntry.image_url,
      model: dbEntry.model,
      type: dbEntry.type,
      config: dbEntry.config,
      timestamp: dbEntry.timestamp
    };
  }

  /**
   * Performs full bi-directional sync between local DB and Cloud.
   */
  static async performFullSync(userId: string): Promise<PromptEntry[]> {
    if (!userId || userId === 'anon' || this.isSyncing) return await this.getAllEntries();
    this.isSyncing = true;
    
    try {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('SYNC_TIMEOUT')), 120000) // 2 minutes total sync timeout
      );

      const syncPromise = (async () => {
        console.log('[Sync] Fetching local entries...');
        const localEntries = await this.getAllEntries();
        
        console.log('[Sync] Fetching cloud timestamps...');
        const { data: cloudData, error } = await supabase
          .from('studio_entries')
          .select('id, timestamp')
          .eq('user_id', userId);

        if (error) throw error;

        const cloudMap = new Map<string, number>((cloudData || []).map((c: any) => [c.id, Number(c.timestamp)]));
        const localMap = new Map<string, number>(localEntries.map(l => [l.id, Number(l.timestamp)]));

        // 1. Local to Cloud (Upload if missing or newer)
        const toUpload = localEntries.filter(l => !cloudMap.has(l.id) || (Number(l.timestamp) > (cloudMap.get(l.id) || 0)));
        
        if (toUpload.length > 0) {
          console.log(`[Sync] Found ${toUpload.length} entries to upload.`);
          // Parallelize with a limit of 3 concurrent uploads
          const concurrencyLimit = 3;
          for (let i = 0; i < toUpload.length; i += concurrencyLimit) {
            const chunk = toUpload.slice(i, i + concurrencyLimit);
            console.log(`[Sync] Uploading chunk ${i/concurrencyLimit + 1}...`);
            await Promise.all(chunk.map(entry => 
              this.syncEntryToCloud(entry, userId)
                .catch(err => console.error(`[Sync] Failed to sync ${entry.id}:`, err))
            ));
            console.log(`[Sync] Upload Progress: ${Math.min(i + concurrencyLimit, toUpload.length)}/${toUpload.length}`);
          }
        }

        // 2. Cloud to Local (Download if missing or newer)
        const toDownloadIds = (cloudData || [])
          .filter((c: any) => !localMap.has(c.id) || (Number(c.timestamp) > (localMap.get(c.id) || 0)))
          .map((c: any) => c.id);

        if (toDownloadIds.length > 0) {
          console.log(`[Sync] Found ${toDownloadIds.length} entries to download.`);
          for (let i = 0; i < toDownloadIds.length; i += 20) {
            const ids = toDownloadIds.slice(i, i + 20);
            console.log(`[Sync] Downloading chunk ${i/20 + 1}...`);
            const { data: downloaded, error: dlErr } = await supabase
              .from('studio_entries')
              .select('*')
              .in('id', ids);
            
            if (!dlErr && downloaded) {
              const db = await this.getDB();
              const tx = db.transaction(STORE_NAME, 'readwrite');
              const store = tx.objectStore(STORE_NAME);
              downloaded.forEach(item => store.put(this.mapFromDb(item)));
            }
          }
          console.log(`[Sync] Download complete.`);
        }

        console.log('[Sync] Full sync completed successfully.');
        return await this.getAllEntries();
      })();

      return await Promise.race([syncPromise, timeoutPromise]) as PromptEntry[];
    } catch (err: any) {
      if (err.message === 'SYNC_TIMEOUT') {
        console.warn('[Sync] Full sync timed out, some items may not be synced.');
      } else {
        console.error('Sync failed:', err);
      }
      return await this.getAllEntries();
    } finally {
      this.isSyncing = false;
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
      request.onsuccess = () => resolve((request.result || []).sort((a: any, b: any) => b.timestamp - a.timestamp));
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Local-first save logic. Resolves as soon as the entry is in IndexedDB.
   * Syncing to cloud happens asynchronously in the background.
   */
  static async saveEntry(entry: PromptEntry, userId: string): Promise<void> {
    // 1. Immediate Local Save
    const db = await this.getDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(entry);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    // 2. Background Cloud Sync (Optimistic UI)
    if (userId && userId !== 'anon') {
      // Fire and forget, but log errors
      this.syncEntryToCloud(entry, userId).catch(err => {
        console.warn('Background cloud sync failed for entry:', entry.id, err);
      });
    }
  }

  static async saveEntries(entries: PromptEntry[], userId: string): Promise<void> {
    // Parallelize local saves
    await Promise.all(entries.map(e => this.saveEntry(e, userId)));
  }

  static async deleteEntry(id: string, userId?: string): Promise<void> {
    const db = await this.getDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.delete(id);

    if (userId && userId !== 'anon') {
      // No need to wait for storage removal to finish locally
      supabase.from('studio_entries').delete().eq('id', id).then(({ error }) => {
        if (error) console.error("Cloud delete error:", error);
      });
      SupabaseService.deleteImage(userId, id).catch(err => console.error("Cloud image delete error:", err));
    }
  }

  static async savePreset(preset: Preset, userId: string): Promise<void> {
    const existing = JSON.parse(localStorage.getItem('gvs_presets_v2') || '[]');
    localStorage.setItem('gvs_presets_v2', JSON.stringify([preset, ...existing]));

    if (userId && userId !== 'anon') {
      supabase.from('presets').upsert({
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
        timestamp: preset.timestamp
      }).then(({ error }) => {
        if (error) console.error("Cloud preset save error:", error);
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
        return data.map(p => ({
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
          timestamp: p.timestamp
        }));
      }
    }
    return local;
  }
}
