
import { createClient } from '@supabase/supabase-js';
import { User } from '../types';

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string) || '';
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('[Supabase] Missing environment variables: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env.local');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  }
});

export class SupabaseService {
  static async mapUser(sbUser: any): Promise<User | null> {
    if (!sbUser) return null;

    let isAdmin = sbUser.user_metadata?.is_admin || false;
    let username = sbUser.user_metadata?.username || sbUser.email?.split('@')[0] || 'User';

    try {
      // Create a promise that rejects after 2 seconds
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('TIMEOUT')), 2000)
      );

      // Race the database query against the timeout
      const profilePromise = supabase
        .from('profiles')
        .select('is_admin, username')
        .eq('id', sbUser.id)
        .single();

      const result: any = await Promise.race([profilePromise, timeoutPromise]);
      
      if (result && !result.error && result.data) {
        isAdmin = result.data.is_admin;
        username = result.data.username || username;
      }
    } catch (e: any) {
      if (e.message === 'TIMEOUT') {
        console.warn("[Auth] Profile fetch timed out, using fallback metadata.");
      } else {
        console.warn("[Auth] Could not fetch profile, using metadata as fallback.");
      }
    }

    return {
      id: sbUser.id,
      username: username,
      isAdmin: isAdmin
    };
  }

  static async getSession() {
    return await supabase.auth.getSession();
  }

  static async getCurrentUser(): Promise<User | null> {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) return null;
      return this.mapUser(user);
    } catch (e) {
      return null;
    }
  }

  static async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.user;
  }

  static async signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: email.split('@')[0],
          is_admin: false
        }
      }
    });
    if (error) throw error;
    return data.user;
  }

  static async signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });
    if (error) throw error;
  }

  static async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  /**
   * Uploads a base64 image to Supabase Storage and returns the public URL.
   */
  static async uploadImage(userId: string, entryId: string, base64Data: string): Promise<string | null> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !session.user) {
        console.error('[Supabase] Upload failed: No active session found');
        return null;
      }

      // Use the actual session user ID to ensure RLS policy compliance
      const activeUserId = session.user.id;
      console.log(`[Supabase] Starting upload for user: ${activeUserId}`);

      // Robust Base64 to Blob conversion
      const parts = base64Data.split(';base64,');
      if (parts.length < 2) {
        console.error('[Supabase] Invalid image data format');
        return null;
      }
      
      const contentType = parts[0].split(':')[1] || 'image/webp';
      const raw = window.atob(parts[1]);
      const rawLength = raw.length;
      const uInt8Array = new Uint8Array(rawLength);

      for (let i = 0; i < rawLength; ++i) {
        uInt8Array[i] = raw.charCodeAt(i);
      }

      const blob = new Blob([uInt8Array], { type: contentType });
      const fileName = `${activeUserId}/${entryId}.webp`;
      
      console.log(`[Supabase] Uploading to bucket "images" at path: ${fileName}`);

      // Add a timeout for the upload operation
      const uploadPromise = supabase.storage
        .from('images')
        .upload(fileName, blob, {
          contentType: 'image/webp',
          cacheControl: '3600',
          upsert: false 
        });

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('UPLOAD_TIMEOUT')), 30000) // 30 seconds timeout
      );

      const { data, error }: any = await Promise.race([uploadPromise, timeoutPromise]);

      if (error) {
        if (error.message?.includes('already exists')) {
           console.log('[Supabase] Image exists on cloud, fetching URL...');
           const { data: { publicUrl } } = supabase.storage.from('images').getPublicUrl(fileName);
           return publicUrl;
        }
        
        // Specific RLS error handling
        if (error.message?.includes('row-level security')) {
          console.error('[Supabase] RLS Policy Violation: Ensure "images" bucket allows INSERT for authenticated users at path: ' + activeUserId + '/');
        }
        throw error;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('images')
        .getPublicUrl(fileName);

      console.log('[Supabase] Upload successful:', publicUrl);
      return publicUrl;
    } catch (err: any) {
      console.error('Supabase Storage Upload Error:', err.message || err);
      return null;
    }
  }

  /**
   * Deletes an image from Supabase Storage.
   */
  static async deleteImage(userId: string, entryId: string): Promise<void> {
    try {
      const fileName = `${userId}/${entryId}.webp`;
      await supabase.storage.from('images').remove([fileName]);
    } catch (err) {
      console.error('Supabase Storage Delete Error:', err);
    }
  }
}
