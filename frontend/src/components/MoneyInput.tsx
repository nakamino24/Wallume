import React, { useCallback, useEffect, useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { spacing, radius, font } from '@/src/theme/tokens';
import { Label } from '@/src/components/ui';
import { useKeyboardScroll } from '@/src/components/KeyboardAwareContainer';
import { formatInputDigits, stripFormatting } from '@/src/lib/money';

/**
 * Smart currency input. Internal state holds ONLY raw digits; the display
 * layer formats them live. The TextInput is stable (never remounted) so focus
 * is never lost. Cursor is preserved by tracking the raw caret position.
 */
export function MoneyInput({
  value, onChange, label, placeholder, testID, style, editable = true, currency = 'IDR', autoFocus,
}: {
  value: string; // raw digits only (e.g. "1234567")
  onChange: (raw: string) => void;
  label?: string;
  placeholder?: string;
  testID?: string;
  style?: any;
  editable?: boolean;
  currency?: string;
  autoFocus?: boolean;
}) {
  const { colors } = useTheme();
  const { focusToInput } = useKeyboardScroll();
  const inputRef = useRef<TextInput>(null);
  const rawCaret = useRef(String(value ?? '').length);
  const [display, setDisplay] = useState(() => formatInputDigits(String(value ?? '')));

  const valueStr = String(value ?? '');

  // Keep display in sync with the controlled raw value (external changes).
  useEffect(() => {
    setDisplay(formatInputDigits(valueStr));
  }, [valueStr]);

  const handleChange = useCallback((text: string) => {
    const raw = stripFormatting(text).replace(/^0+(?=\d)/, '');
    // Preserve the caret relative to the raw digits.
    const prefix = stripFormatting(text.slice(0, rawCaret.current));
    onChange(raw);
    const newDisplay = formatInputDigits(raw);
    setDisplay(newDisplay);
    // Map the raw caret through the formatted string.
    const caretInFormatted = formatInputDigits(prefix).length;
    rawCaret.current = prefix.length;
    requestAnimationFrame(() => {
      inputRef.current?.setNativeProps({ selection: { start: caretInFormatted, end: caretInFormatted } });
    });
  }, [onChange]);

  return (
    <View style={{ marginBottom: spacing.md, ...style }}>
      {label && <Label style={{ marginBottom: 6 }}>{label}</Label>}
      <TextInput
        ref={inputRef}
        testID={testID}
        value={display}
        onChangeText={handleChange}
        keyboardType="decimal-pad"
        editable={editable}
        autoFocus={autoFocus}
        onFocus={() => focusToInput(inputRef.current)}
        placeholder={placeholder ?? '0'}
        placeholderTextColor={colors.muted}
        onSelectionChange={(e) => {
          const sel = e.nativeEvent.selection;
          rawCaret.current = stripFormatting(display.slice(0, sel.start)).length;
        }}
        style={{
          backgroundColor: colors.surface2,
          color: colors.onSurface,
          borderRadius: radius.sm,
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: spacing.md,
          paddingVertical: 12,
          fontFamily: font.displayBold,
          fontSize: 18,
        }}
      />
    </View>
  );
}