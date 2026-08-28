import React from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/src/theme/ThemeProvider';
import { font } from '@/src/theme/tokens';
import { Screen, H2, Body, Card } from '@/src/components/ui';
import { useI18n } from '@/src/lib/I18nProvider';

export default function Privacy() {
  const { colors } = useTheme();
  const router = useRouter();
  const { t } = useI18n();

  const sections = [
    ['privacy.storage.title', 'privacy.storage.body'],
    ['privacy.sharing.title', 'privacy.sharing.body'],
    ['privacy.deletion.title', 'privacy.deletion.body'],
    ['privacy.security.title', 'privacy.security.body'],
    ['privacy.contact.title', 'privacy.contact.body'],
  ] as const;

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingTop: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('navigation.back')} hitSlop={10} onPress={() => router.back()}><Ionicons name="chevron-back" size={24} color={colors.onSurface} /></TouchableOpacity>
            <H2 style={{ marginLeft: 12 }}>{t('privacy')}</H2>
          </View>
        </View>
        <ScrollView contentContainerStyle={{ padding: 24, gap: 12, paddingBottom: 60 }}>
          {sections.map(([titleKey, bodyKey]) => (
            <Card key={titleKey}>
              <Body style={{ fontFamily: font.textBold, fontSize: 16, marginBottom: 8 }}>{t(titleKey)}</Body>
              <Body muted style={{ lineHeight: 20 }}>{t(bodyKey)}</Body>
            </Card>
          ))}

          <Body muted style={{ fontSize: 11, textAlign: 'center', marginTop: 12 }}>
            {t('privacy.updated')}
          </Body>
        </ScrollView>
      </SafeAreaView>
    </Screen>
  );
}
