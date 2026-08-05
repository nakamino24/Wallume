import React, { useCallback, useContext, useRef, useState, createContext, useEffect, type ReactNode } from 'react';
import {
  Keyboard, KeyboardAvoidingView, Platform, ScrollView,
  type KeyboardEvent, type StyleProp, type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type ScrollCtx = { focusToInput: (node: any) => void };
const Ctx = createContext<ScrollCtx>({ focusToInput: () => {} });

export function useKeyboardScroll() {
  return useContext(Ctx);
}

const FOCUS_OFFSET = 24;

/**
 * Shared keyboard-aware scroll container used by every form (via FormLayout).
 * Provides a context so any focused TextInput can ask it to scroll fully into
 * view above the keyboard. Single place for keyboard-avoidance — screens no
 * longer implement their own.
 *
 * Android notes: we cannot rely on the window softinput mode, so we track the
 * real keyboard height and (a) pad the bottom
 * of the scroll content by exactly that height and (b) scroll the focused
 * input to sit comfortably above it. This works even inside modal/overlay
 * hierarchies where `behavior` on a KeyboardAvoidingView is a no-op.
 */
export function KeyboardAwareContainer({
  children, contentContainerStyle,
}: {
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
}) {
  const scrollRef = useRef<ScrollView>(null);
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

  const focusToInput = useCallback((node: any) => {
    const sv = scrollRef.current;
    if (!sv || !node) return;
    requestAnimationFrame(() => {
      try {
        node.measureLayout(sv as any, (x: number, y: number) => {
          // Bring the input comfortably above the keyboard (including the real
          // keyboard height on Android where softinput mode does not adjust).
          const target = Math.max(0, y - keyboardHeight - FOCUS_OFFSET);
          sv.scrollTo({ y: target, animated: true });
        }, () => {});
      } catch {}
    });
  }, [keyboardHeight]);

  return (
    <Ctx.Provider value={{ focusToInput }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[
            { flexGrow: 1, paddingBottom: keyboardHeight > 0 ? keyboardHeight : undefined },
            contentContainerStyle,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </Ctx.Provider>
  );
}