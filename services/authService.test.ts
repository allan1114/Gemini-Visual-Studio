import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from './authService';
import * as SupabaseServiceModule from './supabaseService';

// Mock Supabase service
vi.mock('./supabaseService', () => ({
  SupabaseService: {
    signIn: vi.fn(),
    signUp: vi.fn(),
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
    getCurrentUser: vi.fn(),
    mapUser: vi.fn(),
  },
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  },
}));

describe('AuthService', () => {
  const mockUser = {
    id: 'test-user-id',
    username: 'testuser',
    isAdmin: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('signIn', () => {
    it('should return user on successful sign in', async () => {
      const mockSupabaseService = SupabaseServiceModule.SupabaseService as any;
      mockSupabaseService.signIn.mockResolvedValue({ id: 'session-id' });
      mockSupabaseService.getCurrentUser.mockResolvedValue(mockUser);

      const result = await AuthService.signIn('test@example.com', 'password123');

      expect(result).toEqual(mockUser);
      expect(mockSupabaseService.signIn).toHaveBeenCalledWith(
        'test@example.com',
        'password123'
      );
    });

    it('should throw on sign in error', async () => {
      const mockSupabaseService = SupabaseServiceModule.SupabaseService as any;
      mockSupabaseService.signIn.mockRejectedValue(new Error('Invalid credentials'));

      try {
        await AuthService.signIn('test@example.com', 'wrongpassword');
        expect.fail('should have thrown');
      } catch (e) {
        expect((e as Error).message).toContain('Sign in failed');
      }
    });
  });

  describe('signUp', () => {
    it('should return user on successful sign up', async () => {
      const mockSupabaseService = SupabaseServiceModule.SupabaseService as any;
      mockSupabaseService.signUp.mockResolvedValue({ id: 'new-user-id' });
      mockSupabaseService.getCurrentUser.mockResolvedValue(mockUser);

      const result = await AuthService.signUp('new@example.com', 'password123');

      expect(result).toEqual(mockUser);
      expect(mockSupabaseService.signUp).toHaveBeenCalledWith(
        'new@example.com',
        'password123'
      );
    });

    it('should throw on sign up error', async () => {
      const mockSupabaseService = SupabaseServiceModule.SupabaseService as any;
      mockSupabaseService.signUp.mockRejectedValue(new Error('Email already exists'));

      try {
        await AuthService.signUp('existing@example.com', 'password123');
        expect.fail('should have thrown');
      } catch (e) {
        expect((e as Error).message).toContain('Sign up failed');
      }
    });
  });

  describe('signOut', () => {
    it('should call SupabaseService.signOut', async () => {
      const mockSupabaseService = SupabaseServiceModule.SupabaseService as any;
      mockSupabaseService.signOut.mockResolvedValue(undefined);

      await AuthService.signOut();

      expect(mockSupabaseService.signOut).toHaveBeenCalled();
    });

    it('should throw on sign out error', async () => {
      const mockSupabaseService = SupabaseServiceModule.SupabaseService as any;
      mockSupabaseService.signOut.mockRejectedValue(new Error('Sign out failed'));

      try {
        await AuthService.signOut();
        expect.fail('should have thrown');
      } catch (e) {
        expect((e as Error).message).toContain('Sign out failed');
      }
    });
  });

  describe('getCurrentUser', () => {
    it('should return current user', async () => {
      const mockSupabaseService = SupabaseServiceModule.SupabaseService as any;
      mockSupabaseService.getCurrentUser.mockResolvedValue(mockUser);

      const result = await AuthService.getCurrentUser();

      expect(result).toEqual(mockUser);
    });

    it('should return null when no user is logged in', async () => {
      const mockSupabaseService = SupabaseServiceModule.SupabaseService as any;
      mockSupabaseService.getCurrentUser.mockResolvedValue(null);

      const result = await AuthService.getCurrentUser();

      expect(result).toBeNull();
    });
  });

  describe('checkInitialSession', () => {
    it('should return user if session exists', async () => {
      const mockSupabase = SupabaseServiceModule.supabase as any;
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { user: { id: 'user-id' } } },
        error: null,
      });

      const mockSupabaseService = SupabaseServiceModule.SupabaseService as any;
      mockSupabaseService.mapUser.mockResolvedValue(mockUser);

      const result = await AuthService.checkInitialSession(5000);

      expect(result).toEqual(mockUser);
    });

    it('should return null if no session exists', async () => {
      const mockSupabase = SupabaseServiceModule.supabase as any;
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const result = await AuthService.checkInitialSession(5000);

      expect(result).toBeNull();
    });

    it('should timeout if session check takes too long', async () => {
      const mockSupabase = SupabaseServiceModule.supabase as any;
      mockSupabase.auth.getSession.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  data: { session: { user: { id: 'user-id' } } },
                  error: null,
                }),
              10000
            )
          )
      );

      const result = await AuthService.checkInitialSession(100);

      expect(result).toBeNull();
    });
  });
});
