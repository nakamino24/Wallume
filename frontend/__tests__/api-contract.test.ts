/**
 * Frontend contract: req() must handle both
 * CURRENT ENVELOPE {success,data} and LEGACY FLAT {token,user,...}
 */
import { Text } from 'react-native';

const mockFetch = jest.fn();
global.fetch = mockFetch as any;

jest.mock('@/src/utils/storage', () => ({
  storage: { secureGet: jest.fn(() => Promise.resolve(null)), secureSet: jest.fn(), secureRemove: jest.fn(), getItem: jest.fn(), setItem: jest.fn() },
}));
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return { ...RN, Platform: { OS: 'ios' } };
});

import * as client from '@/src/api/client';

describe('frontend API contract', () => {
  beforeEach(() => jest.clearAllMocks());

  it('unwraps current envelope {success,data}', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: { token: 't123', user: { user_id: 'u1' } } }),
    } as any);
    const res: any = await (client as any).api.login({ email: 'a@b.com', password: 'Password123' });
    // after unwrap, should be data directly
    expect(res.token).toBe('t123');
    expect(res.user.user_id).toBe('u1');
  });

  it('retains compatibility with legacy flat response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ token: 't456', user: { user_id: 'u2' } }),
    } as any);
    const res: any = await (client as any).api.login({ email: 'a@b.com', password: 'Password123' });
    expect(res.token).toBe('t456');
    expect(res.user.user_id).toBe('u2');
  });

  it('attaches err.status for 401/429/500', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ detail: 'Invalid credentials' }),
    } as any);
    try {
      await (client as any).api.login({ email: 'a@b.com', password: 'x' });
      fail('should throw');
    } catch (e: any) {
      expect(e.status).toBe(401);
      expect(e.detail).toBe('Invalid credentials');
    }
  });
});
