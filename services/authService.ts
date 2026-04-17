import { User } from '../types';
import { SupabaseService, supabase } from './supabaseService';

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
}

export interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  loginAsGuest: () => void;
}

export class AuthService {
  static async signIn(email: string, password: string): Promise<User | null> {
    try {
      await SupabaseService.signIn(email, password);
      const user = await SupabaseService.getCurrentUser();
      return user;
    } catch (err: any) {
      throw new Error(err.message || 'Sign in failed');
    }
  }

  static async signUp(email: string, password: string): Promise<User | null> {
    try {
      await SupabaseService.signUp(email, password);
      const user = await SupabaseService.getCurrentUser();
      return user;
    } catch (err: any) {
      throw new Error(err.message || 'Sign up failed');
    }
  }

  static async signInWithGoogle(): Promise<void> {
    try {
      await SupabaseService.signInWithGoogle();
    } catch (err: any) {
      throw new Error(err.message || 'Google sign in failed');
    }
  }

  static async signOut(): Promise<void> {
    try {
      await SupabaseService.signOut();
    } catch (err: any) {
      throw new Error(err.message || 'Sign out failed');
    }
  }

  static async getCurrentUser(): Promise<User | null> {
    try {
      return await SupabaseService.getCurrentUser();
    } catch (err) {
      return null;
    }
  }

  static onAuthStateChange(callback: (event: string, user: User | null) => void): () => void {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const mappedUser = await SupabaseService.mapUser(session.user);
        callback(event, mappedUser);
      } else {
        callback(event, null);
      }
    });

    return () => subscription.unsubscribe();
  }

  static async checkInitialSession(timeoutMs: number = 5000): Promise<User | null> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.warn('[Auth] Initial session check timeout');
        resolve(null);
      }, timeoutMs);

      supabase.auth.getSession()
        .then(async ({ data: { session }, error }) => {
          clearTimeout(timeout);
          if (error) {
            console.error('[Auth] Session check error:', error);
            resolve(null);
            return;
          }

          if (session?.user) {
            const user = await SupabaseService.mapUser(session.user);
            resolve(user);
          } else {
            resolve(null);
          }
        })
        .catch((err) => {
          clearTimeout(timeout);
          console.error('[Auth] Session check failed:', err);
          resolve(null);
        });
    });
  }
}
