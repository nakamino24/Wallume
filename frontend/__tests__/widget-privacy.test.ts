jest.mock('@/src/utils/storage', () => ({
  storage: { getItem: jest.fn(), setItem: jest.fn() },
}));

const { storage: mockStorage } = require('@/src/utils/storage');
const { WIDGET_BALANCE_VISIBILITY_KEY, toggleWidgetBalanceVisibility } = require('@/src/widgets/widget-task-handler');

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
});
