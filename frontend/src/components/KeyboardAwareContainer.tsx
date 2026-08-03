import React, { useCallback, useContext, useRef, createContext, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type ScrollCtx = { focusToInput: (node: any) => void };
const Ctx = createContext<ScrollCtx>({ focusToInput: () => {} });

export function useKeyboardScroll() {
  return useContext(Ctx);
}

/**
 * Shared keyboard-aware scroll container used by every form (via FormLayout).
 * Provides a context so any focused TextInput can ask it to scroll fully into
 * view above the keyboard. Single place for keyboard-avoidance — screens no
 * longer implement their own.
 */
export function KeyboardAwareContainer({
  children, contentContainerStyle,
}: {
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
}) {
  const scrollRef = useRef<ScrollView>(null);

  const focusToInput = (node: any) => {
    const sv = scrollRef.current;
    if (!sv || !node) return;
    requestAnimationFrame(() => {
      try {
        node.measureLayout(sv as any, (x: number, y: number) => {
          sv.scrollTo({ y: y - 90, animated: true });
        }, () => {});
      } catch {}
    });
  };

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
        </ScrollView>
      </KeyboardAvoidingView>
    </Ctx.Provider>
  );
}