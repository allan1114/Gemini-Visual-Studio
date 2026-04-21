import { User } from '../types';
import { SupabaseService, supabase } from './supabaseService';

/** Current user authentication state */
export interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
}

/** Authentication context value with auth methods */
export interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  loginAsGuest: () => void;
}

/**
 * Centralized authentication service
 * Handles sign in/up, session management, and user profile mapping
 */
export class AuthService {
  /** Sign in with email and password */
  static async signIn(email: string, password: string): Promise<User | null> {
    try {
      await SupabaseService.signIn(email, password);
      const user = await SupabaseService.getCurrentUser();
      return user;
    } catch (err: any) {
      throw new Error(err.message || 'Sign in failed');
    }
  }

  /** Sign up with email and password */
  static async signUp(email: string, password: string): Promise<User | null> {
    try {
      await SupabaseService.signUp(email, password);
      const user = await SupabaseService.getCurrentUser();
      return user;
    } catch (err: any) {
      throw new Error(err.message || 'Sign up failed');
    }
  }

  /** Initiate Google OAuth sign in */
  static async signInWithGoogle(): Promise<void> {
    try {
      await SupabaseService.signInWithGoogle();
    } catch (err: any) {
      throw new Error(err.message || 'Google sign in failed');
    }
  }

  /** Sign out current user */
  static async signOut(): Promise<void> {
    try {
      await SupabaseService.signOut();
    } catch (err: any) {
      throw new Error(err.message || 'Sign out failed');
    }
  }

  /** Get current authenticated user */
  static async getCurrentUser(): Promise<User | null> {
    try {
      return await SupabaseService.getCurrentUser();
    } catch (err) {
      return null;
    }
  }

  /** Subscribe to auth state changes */
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

  /** Check for existing session on app load with timeout protection */
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
