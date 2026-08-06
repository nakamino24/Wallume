import React, { useCallback, useEffect, useRef, useState } from 'react';
import { TextInput, Text, View } from 'react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { spacing, radius, font } from '@/src/theme/tokens';
import { scale } from '@/src/utils/responsive';
import { Label } from '@/src/components/ui';
import { useKeyboardScroll } from '@/src/components/KeyboardAwareContainer';
import { formatInputDigits, stripFormatting } from '@/src/lib/money';

/**
 * Smart currency input. Internal state holds ONLY raw digits; the display
 * layer formats them live. The TextInput is stable (never remounted) so focus
 * is never lost. Cursor is preserved by tracking the raw caret position.
 *
 * `variant="hero"` renders the large centered amount display used on the
 * transaction form: no box, big displayBold digits with the currency symbol
 * inline at the same size, baseline-aligned — consistent for short ("Rp0") and
 * long ("Rp10.000.000") values.
 */
export function MoneyInput({
  value, onChange, label, placeholder, testID, style, editable = true, currency = 'IDR', autoFocus,
  variant = 'default', symbol,
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
  variant?: 'default' | 'hero';
  symbol?: string;
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

  const isHero = variant === 'hero';
  const heroFontSize = scale(34);

  if (isHero) {
    return (
      <View style={[{ alignItems: 'center' }, style]}>
        {label && <Label style={{ marginBottom: 8 }}>{label}</Label>}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', marginTop: spacing.sm }}>
          {symbol ? (
            <Text style={{ fontFamily: font.displayBold, fontSize: heroFontSize, color: colors.onSurface, marginRight: 2, paddingBottom: 2, lineHeight: heroFontSize * 1.25 }}>
              {symbol}
            </Text>
          ) : null}
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
              color: colors.onSurface,
              fontFamily: font.displayBold,
              fontSize: heroFontSize,
              padding: 0,
              paddingVertical: 0,
              margin: 0,
              minWidth: 80,
              textAlign: 'center',
              lineHeight: heroFontSize * 1.25,
            }}
          />
        </View>
      </View>
    );
  }

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