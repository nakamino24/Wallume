jest.mock('@/src/utils/storage', () => ({
  storage: { getItem: jest.fn(), setItem: jest.fn(), secureGet: jest.fn() },
}));

const { storage: mockStorage } = require('@/src/utils/storage');
const { WIDGET_BALANCE_VISIBILITY_KEY, fetchWidgetData, toggleWidgetBalanceVisibility } = require('@/src/widgets/widget-task-handler');

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('Widget balance privacy', () => {
  beforeEach(() => jest.clearAllMocks());

  it('uses a widget-only key and defaults the first toggle to visible', async () => {
    mockStorage.getItem.mockResolvedValue(null);

    await toggleWidgetBalanceVisibility();

    expect(mockStorage.getItem).toHaveBeenCalledWith(WIDGET_BALANCE_VISIBILITY_KEY, null);
    expect(mockStorage.setItem).toHaveBeenCalledWith(WIDGET_BALANCE_VISIBILITY_KEY, true);
    expect(WIDGET_BALANCE_VISIBILITY_KEY).not.toBe('wallume.privacy.showBalances');
  });

  it('toggles the widget preference without reading or writing the app preference', async () => {
    mockStorage.getItem.mockResolvedValue(true);

    await toggleWidgetBalanceVisibility();

    expect(mockStorage.setItem).toHaveBeenCalledWith(WIDGET_BALANCE_VISIBILITY_KEY, false);
    expect(mockStorage.getItem).not.toHaveBeenCalledWith('wallume.privacy.showBalances', expect.anything());
    expect(mockStorage.setItem).not.toHaveBeenCalledWith('wallume.privacy.showBalances', expect.anything());
  });

  it('keeps widget balance visible when app privacy is hidden but widget privacy is visible', async () => {
    mockStorage.getItem.mockImplementation((key: string, fallback: any) => {
      if (key === 'mf.widget.currency') return Promise.resolve('IDR');
      if (key === WIDGET_BALANCE_VISIBILITY_KEY) return Promise.resolve(true);
      if (key === 'wallume.privacy.showBalances') return Promise.resolve(false);
      return Promise.resolve(fallback);
    });
    mockStorage.secureGet.mockResolvedValue('token');
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ wallet_total: 3218754, month_income: 6600000, month_expense: 5100000, cash_flow: 1500000, health_score: 80, category_breakdown: [] }) });

    const data = await fetchWidgetData();

    expect(data.balance).toBe('Rp3.218.754');
    expect(data.income).toBe('Rp6.600.000');
    expect(data.isBalanceVisible).toBe(true);
    expect(mockStorage.getItem).not.toHaveBeenCalledWith('wallume.privacy.showBalances', expect.anything());
  });

  it('masks widget balance when widget privacy is hidden even if app privacy is visible', async () => {
    mockStorage.getItem.mockImplementation((key: string, fallback: any) => {
      if (key === 'mf.widget.currency') return Promise.resolve('IDR');
      if (key === WIDGET_BALANCE_VISIBILITY_KEY) return Promise.resolve(false);
      if (key === 'wallume.privacy.showBalances') return Promise.resolve(true);
      return Promise.resolve(fallback);
    });
    mockStorage.secureGet.mockResolvedValue('token');
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ wallet_total: 3218754, month_income: 6600000, month_expense: 5100000, cash_flow: 1500000, health_score: 80, category_breakdown: [] }) });

    const data = await fetchWidgetData();

    expect(data.balance).toBe('Rp•••••••');
    expect(data.income).toBe('Rp6.600.000');
    expect(data.expense).toBe('Rp5.100.000');
    expect(data.cashFlow).toBe('Rp1.500.000');
    expect(data.isBalanceVisible).toBe(false);
    expect(mockStorage.getItem).not.toHaveBeenCalledWith('wallume.privacy.showBalances', expect.anything());
  });

  it('persists widget privacy across refreshes', async () => {
    mockStorage.getItem.mockImplementation((key: string, fallback: any) => {
      if (key === 'mf.widget.currency') return Promise.resolve('IDR');
      if (key === WIDGET_BALANCE_VISIBILITY_KEY) return Promise.resolve(false);
      return Promise.resolve(fallback);
    });
    mockStorage.secureGet.mockResolvedValue('token');
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ wallet_total: 3218754, month_income: 6600000, month_expense: 5100000, cash_flow: 1500000, health_score: 80, category_breakdown: [] }), arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) });

    const first = await fetchWidgetData();
    const second = await fetchWidgetData();

    expect(first.balance).toBe('Rp•••••••');
    expect(second.balance).toBe('Rp•••••••');
    expect(mockStorage.setItem).not.toHaveBeenCalledWith(WIDGET_BALANCE_VISIBILITY_KEY, expect.anything());
  });

  it('changing app privacy does not change widget visibility', async () => {
    mockStorage.getItem.mockImplementation((key: string, fallback: any) => {
      if (key === 'mf.widget.currency') return Promise.resolve('IDR');
      if (key === WIDGET_BALANCE_VISIBILITY_KEY) return Promise.resolve(true);
      if (key === 'wallume.privacy.showBalances') return Promise.resolve(false);
      return Promise.resolve(fallback);
    });
    mockStorage.secureGet.mockResolvedValue('token');
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ wallet_total: 3218754, month_income: 6600000, month_expense: 5100000, cash_flow: 1500000, health_score: 80, category_breakdown: [] }) });

    const data = await fetchWidgetData();

    expect(data.balance).toBe('Rp3.218.754');
    expect(mockStorage.setItem).not.toHaveBeenCalledWith(WIDGET_BALANCE_VISIBILITY_KEY, expect.anything());
  });

  it('changing widget privacy does not write app visibility', async () => {
    mockStorage.getItem.mockResolvedValue(false);

    await toggleWidgetBalanceVisibility();

    expect(mockStorage.setItem).toHaveBeenCalledWith(WIDGET_BALANCE_VISIBILITY_KEY, true);
    expect(mockStorage.setItem).not.toHaveBeenCalledWith('wallume.privacy.showBalances', expect.anything());
  });

  it('does not fetch spending-chart for widget', async () => {
    mockStorage.getItem.mockImplementation((key: string, fallback: any) => {
      if (key === 'mf.widget.currency') return Promise.resolve('IDR');
      if (key === WIDGET_BALANCE_VISIBILITY_KEY) return Promise.resolve(true);
      return Promise.resolve(fallback);
    });
    mockStorage.secureGet.mockResolvedValue('token');
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ wallet_total: 1000, month_income: 2000, month_expense: 1000, cash_flow: 1000, health_score: 70, category_breakdown: [] }) });

    await fetchWidgetData();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/api/analytics/summary'), expect.anything());
    expect(mockFetch).not.toHaveBeenCalledWith(expect.stringContaining('spending-chart'), expect.anything());
  });

  it('widget data no longer requires chartUri or categories', async () => {
    mockStorage.getItem.mockImplementation((key: string, fallback: any) => {
      if (key === 'mf.widget.currency') return Promise.resolve('IDR');
      if (key === WIDGET_BALANCE_VISIBILITY_KEY) return Promise.resolve(true);
      return Promise.resolve(fallback);
    });
    mockStorage.secureGet.mockResolvedValue('token');
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ wallet_total: 1000, month_income: 2000, month_expense: 1000, cash_flow: 1000, health_score: 70 }) });

    const data = await fetchWidgetData();

    expect((data as any).chartUri).toBeUndefined();
    expect((data as any).categories).toBeUndefined();
    expect(data.healthScore).toBe(70);
  });
});
