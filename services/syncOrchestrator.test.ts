import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SyncOrchestrator } from './syncOrchestrator';
import * as StorageServiceModule from './storageService';

// Mock StorageService
vi.mock('./storageService', () => ({
  StorageService: {
    performFullSync: vi.fn(),
    getPresets: vi.fn(),
    getAllEntries: vi.fn(),
  },
}));

describe('SyncOrchestrator', () => {
  const mockUser = {
    id: 'test-user-id',
    username: 'testuser',
    isAdmin: false,
  };

  const mockEntries = [
    {
      id: 'entry-1',
      userId: 'test-user-id',
      author: 'testuser',
      text: 'test prompt',
      tags: ['tag1', 'tag2'],
      timestamp: Date.now(),
      imageUrl: 'http://example.com/image.jpg',
      type: 'generation' as const,
      model: 'flash' as const,
    },
  ];

  const mockPresets = [
    {
      id: 'preset-1',
      userId: 'test-user-id',
      name: 'Test Preset',
      prompt: 'test',
      negativePrompt: 'bad',
      chips: ['chip1'],
      aspectRatio: '1:1' as const,
      imageSize: '1K' as const,
      model: 'flash' as const,
      temperature: 0.5,
      timestamp: Date.now(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('syncOnLogin', () => {
    it('should sync data for authenticated user', async () => {
      const mockStorageService = StorageServiceModule.StorageService as any;
      mockStorageService.performFullSync.mockResolvedValue(mockEntries);
      mockStorageService.getPresets.mockResolvedValue(mockPresets);

      const onUpdate = vi.fn();
      const onError = vi.fn();

      await SyncOrchestrator.syncOnLogin(mockUser, onUpdate, onError);

      expect(mockStorageService.performFullSync).toHaveBeenCalledWith('test-user-id');
      expect(mockStorageService.getPresets).toHaveBeenCalledWith('test-user-id');
      expect(onUpdate).toHaveBeenCalledWith(mockEntries, mockPresets);
      expect(onError).not.toHaveBeenCalled();
    });

    it('should load guest data for anonymous user', async () => {
      const guestUser = { id: 'anon', username: 'Guest', isAdmin: false };
      const mockStorageService = StorageServiceModule.StorageService as any;
      mockStorageService.getAllEntries.mockResolvedValue(mockEntries);

      const onUpdate = vi.fn();
      const onError = vi.fn();

      await SyncOrchestrator.syncOnLogin(guestUser, onUpdate, onError);

      expect(mockStorageService.getAllEntries).toHaveBeenCalled();
      expect(onUpdate).toHaveBeenCalledWith(mockEntries, []);
    });

    it('should handle sync errors', async () => {
      const mockStorageService = StorageServiceModule.StorageService as any;
      const testError = new Error('Sync failed');
      mockStorageService.performFullSync.mockRejectedValue(testError);

      const onUpdate = vi.fn();
      const onError = vi.fn();

      await SyncOrchestrator.syncOnLogin(mockUser, onUpdate, onError);

      expect(onError).toHaveBeenCalled();
      expect(onUpdate).not.toHaveBeenCalled();
    });

    it('should handle SYNC_TIMEOUT error with proper message', async () => {
      const mockStorageService = StorageServiceModule.StorageService as any;
      mockStorageService.performFullSync.mockRejectedValue(
        new Error('SYNC_TIMEOUT')
      );

      const onUpdate = vi.fn();
      const onError = vi.fn();

      await SyncOrchestrator.syncOnLogin(mockUser, onUpdate, onError);

      expect(onError).toHaveBeenCalledWith(expect.stringContaining('timed out'));
    });
  });

  describe('performCloudSync', () => {
    it('should perform sync for authenticated user', async () => {
      const mockStorageService = StorageServiceModule.StorageService as any;
      mockStorageService.performFullSync.mockResolvedValue(mockEntries);

      const onUpdate = vi.fn();
      const onError = vi.fn();

      await SyncOrchestrator.performCloudSync('test-user-id', onUpdate, onError);

      expect(mockStorageService.performFullSync).toHaveBeenCalledWith('test-user-id');
      expect(onUpdate).toHaveBeenCalledWith(mockEntries);
      expect(onError).not.toHaveBeenCalled();
    });

    it('should not sync for anonymous user', async () => {
      const mockStorageService = StorageServiceModule.StorageService as any;

      const onUpdate = vi.fn();
      const onError = vi.fn();

      await SyncOrchestrator.performCloudSync('anon', onUpdate, onError);

      expect(mockStorageService.performFullSync).not.toHaveBeenCalled();
      expect(onUpdate).not.toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
    });

    it('should handle sync errors', async () => {
      const mockStorageService = StorageServiceModule.StorageService as any;
      mockStorageService.performFullSync.mockRejectedValue(
        new Error('Network error')
      );

      const onUpdate = vi.fn();
      const onError = vi.fn();

      await SyncOrchestrator.performCloudSync('test-user-id', onUpdate, onError);

      expect(onError).toHaveBeenCalled();
      expect(onUpdate).not.toHaveBeenCalled();
    });
  });

  describe('isSyncInProgress', () => {
    it('should return false initially', () => {
      const status = SyncOrchestrator.isSyncInProgress();
      expect(status).toBe(false);
    });
  });

  describe('getSyncStatus', () => {
    it('should return sync status', () => {
      const status = SyncOrchestrator.getSyncStatus();

      expect(status).toHaveProperty('isSyncing');
      expect(status).toHaveProperty('lastSynced');
      expect(status).toHaveProperty('error');
      expect(typeof status.isSyncing).toBe('boolean');
      expect(typeof status.lastSynced).toBe('number');
    });
  });
});
