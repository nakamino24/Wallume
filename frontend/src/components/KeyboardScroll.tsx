import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, type ScrollViewProps, Keyboard, type StyleProp, type ViewStyle } from 'react-native';

// Standard keyboard-avoiding scroll container for any screen with text input.
// Use this instead of a bare ScrollView so the focused field stays visible
// above the keyboard, consistently across the app.
export function KeyboardScroll({
  children,
  contentContainerStyle,
  keyboardShouldPersistTaps = 'handled',
  ...rest
}: ScrollViewProps & { contentContainerStyle?: StyleProp<ViewStyle> }) {
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScrollView
        contentContainerStyle={[{ flexGrow: 1 }, contentContainerStyle]}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        onScrollBeginDrag={Keyboard.dismiss}
        {...rest}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}