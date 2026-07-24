import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, StyleSheet, ActivityIndicator, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';

import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuth } from '@/src/auth/AuthProvider';
import { spacing, radius, font } from '@/src/theme/tokens';
import { api, getToken, BASE_URL } from '@/src/api/client';
import { Screen, H1, H2, Body } from '@/src/components/ui';

type Msg = { id: string; role: 'user' | 'assistant'; text: string; pending?: boolean };

const SUGGESTIONS = [
  'How can I save more this month?',
  'Am I overspending on food?',
  'Should I pay off debt or invest?',
  'Build me a 3-month plan',
];

const QUICK_SUMMARY = 'Give me a quick financial summary';

const SESSION_ID = 'default';

// Parses one or more "data: {...}" SSE lines out of a raw text blob and
// concatenates every delta it finds. Ignores [DONE] and malformed lines
// instead of letting them leak into the chat as literal text.
function extractDeltasFromSSE(raw: string): { text: string; error?: string } {
  let acc = '';
  let error: string | undefined;
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) continue;
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === '[DONE]') continue;
    try {
      const ev = JSON.parse(payload);
      if (typeof ev.delta === 'string') acc += ev.delta;
      else if (typeof ev.error === 'string') error = ev.error;
    } catch {
      // not a JSON event line — ignore rather than dumping it into the chat
    }
  }
  return { text: acc, error };
}

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

      if (!res.ok) {
        const errTxt = await res.text().catch(() => '');
        let detail = errTxt;
        try { detail = JSON.parse(errTxt).detail || errTxt; } catch {}
        throw new Error(detail || `HTTP ${res.status}`);
      }

      // Try real progressive streaming first (works on iOS/most Android + web).
      // @ts-ignore - React Native's fetch types don't always expose a body reader
      const reader = res.body?.getReader?.();
      if (reader) {
        const decoder = new TextDecoder();
        let buffer = '';
        let acc = '';
        let streamErr: string | undefined;
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() || '';
          for (const chunk of parts) {
            const { text, error } = extractDeltasFromSSE(chunk);
            if (error) streamErr = error;
            if (text) {
              acc += text;
              setMessages((m) => m.map((mm) => mm.id === aiMsgId ? { ...mm, text: acc, pending: false } : mm));
            }
          }
        }
        if (!acc && streamErr) throw new Error(streamErr);
        if (!acc) {
          setMessages((m) => m.map((mm) => mm.id === aiMsgId ? { ...mm, text: 'The AI service returned an empty response. Please try again.', pending: false } : mm));
        }
        return;
      }

      // Fallback: environment doesn't support streamed reads — read the whole
      // body at once and parse out every "data:" event from it.
      const rawText = await res.text().catch(() => '');
      const { text, error } = extractDeltasFromSSE(rawText);
      if (text) {
        setMessages((m) => m.map((mm) => mm.id === aiMsgId ? { ...mm, text, pending: false } : mm));
      } else {
        throw new Error(error || 'The AI service returned an empty response.');
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
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="sparkles" size={20} color={colors.onBrand} />
                </View>
                <View>
                  <H2>AI Coach</H2>
                  <Body muted style={{ fontSize: 12 }}>Personal finance guidance</Body>
                </View>
              </View>
              {messages.length > 0 && (
                <TouchableOpacity testID="coach-clear" onPress={() => setMessages([])}
                  style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface3, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="trash-outline" size={16} color={colors.muted} />
                </TouchableOpacity>
              )}
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
                <TouchableOpacity testID="coach-quick-summary" onPress={() => send(QUICK_SUMMARY)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.brandPrimary + '1A', borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.brandPrimary + '44' }}>
                  <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="stats-chart" size={16} color={colors.onBrand} />
                  </View>
                  <Body style={{ flex: 1, fontFamily: font.textBold, color: colors.brandPrimary }}>Quick financial summary</Body>
                  <Ionicons name="chevron-forward" size={16} color={colors.brandPrimary} />
                </TouchableOpacity>
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
                    <TypingDots color={colors.brandPrimary} />
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

function TypingDots({ color }: { color: string }) {
  const opacity1 = useRef(new Animated.Value(0.3)).current;
  const opacity2 = useRef(new Animated.Value(0.3)).current;
  const opacity3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const bounce = (anim: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 1, duration: 400, delay, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0.3, duration: 400, useNativeDriver: true }),
        ]),
      ).start();
    };
    bounce(opacity1, 0);
    bounce(opacity2, 200);
    bounce(opacity3, 400);
  }, []);

  return (
    <View style={{ flexDirection: 'row', gap: 4, paddingVertical: 4 }}>
      {[opacity1, opacity2, opacity3].map((o, i) => (
        <Animated.View key={i} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, opacity: o }} />
      ))}
    </View>
  );
}
