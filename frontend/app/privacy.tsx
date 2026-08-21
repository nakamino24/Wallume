import React from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/src/theme/ThemeProvider';
import { spacing, font } from '@/src/theme/tokens';
import { Screen, H2, Body, Card } from '@/src/components/ui';

export default function Privacy() {
  const { colors } = useTheme();
  const router = useRouter();

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingTop: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <TouchableOpacity onPress={() => router.back()}><Ionicons name="chevron-back" size={24} color={colors.onSurface} /></TouchableOpacity>
            <H2 style={{ marginLeft: 12 }}>Privacy Policy</H2>
          </View>
        </View>
        <ScrollView contentContainerStyle={{ padding: 24, gap: 12, paddingBottom: 60 }}>
          <Card>
            <Body style={{ fontFamily: font.textBold, fontSize: 16, marginBottom: 8 }}>Data Storage</Body>
            <Body muted style={{ lineHeight: 20 }}>
              Wallume stores your financial data (wallets, transactions, budgets, goals, and chat history) on a MongoDB database.
              Your password is hashed with bcrypt and never stored in plain text. Authentication tokens are stored securely
              using your device&apos;s Keychain (iOS) or Encrypted Shared Preferences (Android).
            </Body>
          </Card>

          <Card>
            <Body style={{ fontFamily: font.textBold, fontSize: 16, marginBottom: 8 }}>Data Sharing</Body>
            <Body muted style={{ lineHeight: 20 }}>
              Wallume does not sell, share, or transmit your financial data to any third party. The AI Coach uses
              your financial summary (net worth, income, expenses) as context to provide personalized advice —
              this data is sent to Groq&apos;s API (llama-3.3-70b) for processing and is not stored by Groq.
              Exchange rates are fetched from a public API (open.er-api.com) — no personal data is included in those requests.
            </Body>
          </Card>

          <Card>
            <Body style={{ fontFamily: font.textBold, fontSize: 16, marginBottom: 8 }}>Data Deletion</Body>
            <Body muted style={{ lineHeight: 20 }}>
              You can delete your account and all associated data at any time from the Profile screen.
              This permanently removes your user profile, wallets, transactions, budgets, goals, plans,
              debts, investments, assets, recurring bills, and chat history. This action cannot be undone.
            </Body>
          </Card>

          <Card>
            <Body style={{ fontFamily: font.textBold, fontSize: 16, marginBottom: 8 }}>Security</Body>
            <Body muted style={{ lineHeight: 20 }}>
              All API communication uses HTTPS. Authentication uses JSON Web Tokens (JWT) with a 30-day expiry.
              Tokens can be revoked on logout. Rate limiting is applied to login and signup endpoints.
              Biometric lock (Face ID / fingerprint) is available as an additional security layer.
            </Body>
          </Card>

          <Card>
            <Body style={{ fontFamily: font.textBold, fontSize: 16, marginBottom: 8 }}>Contact</Body>
            <Body muted style={{ lineHeight: 20 }}>
              For questions about this policy or to request data access, reach out via the app&apos;s support channel.
            </Body>
          </Card>

          <Body muted style={{ fontSize: 11, textAlign: 'center', marginTop: 12 }}>
            Last updated: July 2026
          </Body>
        </ScrollView>
      </SafeAreaView>
    </Screen>
  );
}