function classifyLoginError(e: any): string {
  const status = e?.status;
  const msg = String(e?.detail || e?.message || '').toLowerCase();
  if (status === 401 || msg.includes('invalid credentials')) return 'auth.error.invalidCredentials';
  if (status >= 500) return 'auth.error.server';
  if (!status || msg.includes('network') || msg.includes('fetch') || msg.includes('failed to fetch')) return 'auth.error.network';
  return 'auth.error.login';
}

describe('Login error classification', () => {
  it('401 shows invalid credentials', () => {
    const err: any = new Error('Invalid credentials');
    err.status = 401;
    expect(classifyLoginError(err)).toBe('auth.error.invalidCredentials');
  });
  it('network error shows network message', () => {
    const err: any = new Error('fetch failed');
    expect(classifyLoginError(err)).toBe('auth.error.network');
  });
  it('5xx shows server message', () => {
    const err: any = new Error('Server error');
    err.status = 500;
    expect(classifyLoginError(err)).toBe('auth.error.server');
  });
  it('other shows generic', () => {
    const err: any = new Error('other');
    err.status = 400;
    expect(classifyLoginError(err)).toBe('auth.error.login');
  });
});
