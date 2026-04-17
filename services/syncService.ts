
export interface SyncData {
  type: 'full_push' | 'pull' | 'ping';
  userId: string;
  metadata?: {
    deviceInfo: string;
    lastSyncAt: number;
    appVersion: string;
    itemCount: number;
  };
  payload?: {
    entries?: any[];
    presets?: any[];
  };
  timestamp: string;
}

export class SyncService {
  private static APP_VERSION = '2.2.0';

  static setSyncUrl(url: string) {
    const trimmed = (url || '').trim();
    if (!trimmed) {
      localStorage.setItem('gvs_sync_url', '');
      return;
    }

    if (!trimmed.startsWith('http')) {
      throw new Error("Invalid URL format. Must start with http:// or https://");
    }

    // Specific check for Google Apps Script URL types
    if (trimmed.includes('script.google.com')) {
      if (trimmed.includes('/d/')) {
        throw new Error("Detected Project URL (/d/). You must use the Web App URL from 'Deploy' > 'New Deployment' which ends in '/exec'.");
      }
      if (!trimmed.includes('/macros/s/') || !trimmed.endsWith('/exec')) {
        throw new Error("Invalid Web App URL. Ensure it ends with '/exec'. Found in 'Deploy' > 'Test deployments' or 'New deployment'.");
      }
    }

    localStorage.setItem('gvs_sync_url', trimmed);
  }

  static getSyncUrl() {
    return localStorage.getItem('gvs_sync_url') || '';
  }

  static isConfigured(): boolean {
    const url = this.getSyncUrl();
    return !!url && url.includes('/exec');
  }

  /**
   * Refined request handler for Google Drive integration via GAS.
   */
  private static async requestCloudWithJSON(data: SyncData, timeoutMs: number = 60000): Promise<any> {
    const url = this.getSyncUrl();
    if (!url) throw new Error("Sync URL not configured");

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        mode: 'cors',
        cache: 'no-cache',
        redirect: 'follow', // Critical for GAS
        headers: {
          'Content-Type': 'text/plain;charset=utf-8', // Bypass CORS preflight
        },
        body: JSON.stringify(data),
        signal: controller.signal
      });

      clearTimeout(id);
      
      if (!response.ok) {
        throw new Error(`Cloud error: ${response.status} ${response.statusText}`);
      }

      const text = await response.text();
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    } catch (error: any) {
      clearTimeout(id);
      if (error.name === 'AbortError') {
        throw new Error("Request timed out. Please check your network or GAS script performance.");
      }
      if (error.message && error.message.includes('Failed to fetch')) {
        throw new Error("Connection failed: Browser blocked the request. Ensure the script is deployed as a Web App and accessible to 'Anyone'.");
      }
      throw error;
    }
  }

  /**
   * Pushes the complete local state to Google Drive.
   */
  static async pushFullState(userId: string, entries: any[], presets: any[]): Promise<boolean> {
    try {
      const result = await this.requestCloudWithJSON({
        type: 'full_push',
        userId,
        metadata: {
          deviceInfo: navigator.userAgent,
          lastSyncAt: Date.now(),
          appVersion: this.APP_VERSION,
          itemCount: (entries?.length || 0) + (presets?.length || 0)
        },
        payload: { entries, presets },
        timestamp: new Date().toISOString()
      }, 90000); 
      return !!result;
    } catch (err) {
      console.error("Failed to push to cloud:", err);
      return false;
    }
  }

  /**
   * Pulls data from Google Drive.
   */
  static async pullFullState(userId: string): Promise<{ entries: any[], presets: any[] } | null> {
    try {
      const result = await this.requestCloudWithJSON({
        type: 'pull',
        userId,
        timestamp: new Date().toISOString()
      }, 45000);
      
      if (result && typeof result === 'object') {
        const entries = result.entries || (result.payload?.entries) || [];
        const presets = result.presets || (result.payload?.presets) || [];
        return { entries, presets };
      }
      return null;
    } catch (err) {
      console.error("Failed to pull from cloud:", err);
      return null;
    }
  }

  static async ping(userId: string): Promise<boolean> {
    try {
      await this.requestCloudWithJSON({
        type: 'ping',
        userId,
        timestamp: new Date().toISOString()
      }, 20000);
      return true;
    } catch (e: any) {
      console.error("Ping failed:", e);
      throw e;
    }
  }
}
