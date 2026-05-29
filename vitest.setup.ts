import { afterEach, vi } from 'vitest';

// Reset mocks after each service/unit test.
afterEach(() => {
  vi.clearAllMocks();
});

const localStorageMock = {
  length: 0,
  clear: vi.fn(),
  getItem: vi.fn(),
  key: vi.fn(),
  removeItem: vi.fn(),
  setItem: vi.fn(),
};

vi.stubGlobal('localStorage', localStorageMock);
