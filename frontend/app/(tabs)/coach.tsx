import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';

import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthProvider';
import { spacing, radius, font } from '@/src/theme/tokens';
import { api, getToken, BASE_URL } from '@/src/api/client';
import { Screen, H1, H2, Body, Chip } from '@/src/components/ui';

type Msg = { id: string; role: 'user' | 'assistant'; text: string; pending?: boolean };

const SUGGESTIONS = [
  'How can I save more this month?',
  'Am I overspending on food?',
  'Should I pay off debt or invest?',
  'Build me a 3-month plan',
];

const SESSION_ID = 'default';

export default function Coach() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const loadHistory = useCallback(async () => {
    try {
      const r = await api.coachHistory(SESSION_ID);
      setMessages((r.messages || []).map((m: any) => ({ id: m.id, role: m.role, text: m.text })));
    } catch {}
  }, []);
  useFocusEffect(useCallback(() => { loadHistory(); }, [loadHistory]));

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages.length]);

  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || sending) return;
    setInput('');
    setSending(true);

    const userMsg: Msg = { id: `u${Date.now()}`, role: 'user', text: msg };
    const aiMsgId = `a${Date.now()}`;
    setMessages((m) => [...m, userMsg, { id: aiMsgId, role: 'assistant', text: '', pending: true }]);

    try {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/api/coach/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({ session_id: SESSION_ID, message: msg }),
      });
      if (!res.ok || !res.body) {
        const errTxt = await res.text().catch(() => '');
        // If the body already looks like our SSE stream (e.g. the connection was
        // cut mid-stream by a provider rate limit), salvage any partial answer
        // instead of dumping raw "data: {...}" lines to the user.
        if (errTxt.includes('"delta"')) {
          const salvaged = errTxt
            .split('\n')
            .filter((l) => l.startsWith('data:'))
            .map((l) => { try { return JSON.parse(l.replace(/^data:\s*/, '')).delta || ''; } catch { return ''; } })
            .join('');
          throw new Error(salvaged || 'The AI service hit a rate limit — please wait a few seconds and try again.');
        }
        let detail = errTxt;
        try { detail = JSON.parse(errTxt).detail || errTxt; } catch {}
        throw new Error(detail || `HTTP ${res.status}`);
      }
      const reader = (res.body as any).getReader?.();
      const decoder = new TextDecoder('utf-8');
      let buf = '';
      let acc = '';
      const flush = () => {
        setMessages((m) => m.map((mm) => mm.id === aiMsgId ? { ...mm, text: acc, pending: false } : mm));
      };
      if (reader) {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const parts = buf.split('\n\n');
          buf = parts.pop() || '';
          for (const chunk of parts) {
            const line = chunk.split('\n').find((l) => l.startsWith('data:'));
            if (!line) continue;
            const payload = line.replace(/^data:\s*/, '');
            if (payload === '[DONE]') continue;
            try {
              const obj = JSON.parse(payload);
              if (obj.delta) { acc += obj.delta; flush(); }
              if (obj.error) { acc += `\n\n[error] ${obj.error}`; flush(); }
            } catch {}
          }
        }
      } else {
        const text = await res.text();
        acc = text; flush();
      }
      if (!acc) {
        setMessages((m) => m.map((mm) => mm.id === aiMsgId ? { ...mm, text: 'No response.', pending: false } : mm));
      }
    } catch (e: any) {
      setMessages((m) => m.map((mm) => mm.id === aiMsgId ? { ...mm, text: `Sorry, I couldn't respond: ${e.message}`, pending: false } : mm));
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="sparkles" size={20} color={colors.onBrand} />
              </View>
              <View>
                <H2>AI Coach</H2>
                <Body muted style={{ fontSize: 12 }}>Personal finance guidance</Body>
              </View>
            </View>
          </View>

          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.xxxl }}
            keyboardShouldPersistTaps="handled"
          >
            {messages.length === 0 && (
              <View style={{ paddingVertical: spacing.xl }}>
                <H1 style={{ marginBottom: spacing.md }}>Hi, {user?.name?.split(' ')[0] || 'there'}.</H1>
                <Body muted style={{ marginBottom: spacing.lg }}>
                  I&apos;m your personal finance coach. Ask me anything about budgeting, saving, or investing.
                </Body>
                <View style={{ gap: spacing.sm }}>
                  {SUGGESTIONS.map((s) => (
                    <TouchableOpacity key={s} testID={`coach-suggest-${s.slice(0, 10)}`} onPress={() => send(s)}
                      style={{ padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface2 }}>
                      <Body>{s}</Body>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {messages.map((m) => (
              <View key={m.id} style={{ marginBottom: spacing.md, alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <View style={{
                  maxWidth: '85%',
                  backgroundColor: m.role === 'user' ? colors.brandPrimary : colors.surface2,
                  paddingHorizontal: spacing.md, paddingVertical: 10,
                  borderRadius: radius.lg,
                  borderTopRightRadius: m.role === 'user' ? 6 : radius.lg,
                  borderTopLeftRadius: m.role === 'user' ? radius.lg : 6,
                  borderWidth: m.role === 'assistant' ? 1 : 0,
                  borderColor: colors.border,
                }}>
                  {m.pending && !m.text ? (
                    <ActivityIndicator size="small" color={colors.brandPrimary} />
                  ) : (
                    <Body style={{ color: m.role === 'user' ? colors.onBrand : colors.onSurface, lineHeight: 20 }}>
                      {m.text}
                    </Body>
                  )}
                </View>
              </View>
            ))}
          </ScrollView>

          <View style={[styles.inputBar, { backgroundColor: colors.surface2, borderTopColor: colors.border }]}>
            <TextInput
              testID="coach-input"
              value={input}
              onChangeText={setInput}
              placeholder="Ask about your money…"
              placeholderTextColor={colors.muted}
              editable={!sending}
              style={{ flex: 1, color: colors.onSurface, fontFamily: font.text, fontSize: 15, paddingVertical: 8 }}
              onSubmitEditing={() => send()}
              returnKeyType="send"
            />
            <TouchableOpacity
              testID="coach-send"
              onPress={() => send()}
              disabled={!input.trim() || sending}
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: input.trim() ? colors.brandPrimary : colors.surface3, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="arrow-up" size={20} color={input.trim() ? colors.onBrand : colors.muted} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
  },
});
