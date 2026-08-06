import React, { useCallback, useContext, useRef, useState, createContext, useEffect, type ReactNode } from 'react';
import {
  Keyboard, KeyboardAvoidingView, Platform, ScrollView,
  type KeyboardEvent, type StyleProp, type ViewStyle, View,
} from 'react-native';

type ScrollCtx = { focusToInput: (node: any) => void };
const Ctx = createContext<ScrollCtx>({ focusToInput: () => {} });

export function useKeyboardScroll() {
  return useContext(Ctx);
}

const FOCUS_OFFSET = 24;
const SPACER_PAD = 16;

/**
 * Shared keyboard-aware scroll container used by every form (via FormLayout).
 * Provides a context so any focused TextInput can ask it to scroll fully into
 * view above the keyboard. Single place for keyboard-avoidance — screens no
 * longer implement their own.
 *
 * Mirrors the pattern that makes the "Add category" modal work: track the REAL
 * keyboard height and use it as a bottom spacer inside the scroll content so a
 * focused input can always scroll comfortably above the keyboard — even on
 * Android where KeyboardAvoidingView's `behavior` is a no-op.
 */
export function KeyboardAwareContainer({
  children, contentContainerStyle,
}: {
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const focusedRef = useRef<any>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const onShow = (e: KeyboardEvent) => setKeyboardHeight(e.endCoordinates?.height ?? 0);
    const onHide = () => setKeyboardHeight(0);
    const subs = [
      Keyboard.addListener('keyboardWillShow', onShow),
      Keyboard.addListener('keyboardWillHide', onHide),
      Keyboard.addListener('keyboardDidShow', onShow),
      Keyboard.addListener('keyboardDidHide', onHide),
    ];
    return () => subs.forEach((s) => s.remove());
  }, []);

  const scrollFocused = useCallback((height: number) => {
    const sv = scrollRef.current;
    const node = focusedRef.current;
    if (!sv || !node) return;
    requestAnimationFrame(() => {
      try {
        node.measureLayout(sv as any, (x: number, y: number) => {
          const target = Math.max(0, y - height - FOCUS_OFFSET);
          sv.scrollTo({ y: target, animated: true });
        }, () => {});
      } catch {}
    });
  }, []);

  const focusToInput = useCallback((node: any) => {
    focusedRef.current = node;
    // Scroll immediately (best-effort before the keyboard is measured), then
    // let the keyboardHeight effect re-scroll with the real height.
    scrollFocused(0);
  }, [scrollFocused]);

  // Re-scroll the focused input once the keyboard height is actually known —
  // this is the part that made the old fixed-offset approach fail on Android.
  useEffect(() => {
    if (keyboardHeight > 0) {
      const t = setTimeout(() => scrollFocused(keyboardHeight), 80);
      return () => clearTimeout(t);
    }
  }, [keyboardHeight, scrollFocused]);

  return (
    <Ctx.Provider value={{ focusToInput }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[{ flexGrow: 1 }, contentContainerStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
          {/* Bottom spacer sized to the real keyboard so the focused input can
              always scroll above it. Kept as an in-content element so a caller's
              `contentContainerStyle.paddingBottom` can never override it. */}
          {keyboardHeight > 0 && <View style={{ height: keyboardHeight + SPACER_PAD }} />}
        </ScrollView>
      </KeyboardAvoidingView>
    </Ctx.Provider>
  );
}