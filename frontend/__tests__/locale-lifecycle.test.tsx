import React, { useMemo } from 'react';
import { Pressable, Text } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { I18nProvider, useI18n } from '@/src/lib/I18nProvider';
import { initLocale } from '@/src/lib/i18n';

function LocaleProbe() {
  const { locale, setLocale, t } = useI18n();
  const memoizedHome = useMemo(() => t('home'), [t]);
  return (
    <>
      <Text testID="locale">{locale}</Text>
      <Text testID="home-label">{t('home')}</Text>
      <Text testID="memoized-home-label">{memoizedHome}</Text>
      <Pressable testID="set-id" onPress={() => void setLocale('id')} />
    </>
  );
}

describe('locale lifecycle', () => {
  const values = new Map<string, string>();

  beforeEach(() => {
    values.clear();
    jest.mocked(AsyncStorage.getItem).mockImplementation(async (key) => values.get(key) ?? null);
    jest.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => { values.set(key, value); });
  });

  it('loads a saved Indonesian locale before exposing the ready app state', async () => {
    values.set('mf.locale', JSON.stringify('id'));
    const { getByTestId } = render(<I18nProvider><LocaleProbe /></I18nProvider>);

    await waitFor(() => expect(getByTestId('locale').props.children).toBe('id'));
    expect(getByTestId('home-label').props.children).toBe('Beranda');
  });

  it('rerenders subscribers immediately and restores the persisted locale', async () => {
    values.set('mf.locale', JSON.stringify('en'));
    const { getByTestId } = render(<I18nProvider><LocaleProbe /></I18nProvider>);
    await waitFor(() => expect(getByTestId('home-label').props.children).toBe('Home'));

    fireEvent.press(getByTestId('set-id'));
    await waitFor(() => expect(getByTestId('home-label').props.children).toBe('Beranda'));
    expect(getByTestId('memoized-home-label').props.children).toBe('Beranda');
    expect(await initLocale()).toBe('id');
  });
});
