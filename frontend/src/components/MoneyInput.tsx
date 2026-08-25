import React, { useCallback, useEffect, useRef, useState } from 'react';
import { TextInput, Text, View, type TextStyle } from 'react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { spacing, radius, font, currencySymbol } from '@/src/theme/tokens';
import { scale } from '@/src/utils/responsive';
import { Label } from '@/src/components/ui';
import { useKeyboardScroll } from '@/src/components/KeyboardAwareContainer';
import { computeInputAmount, formatInputDigits, stripFormatting, getCurrencyFractionDigits } from '@/src/lib/money';

/**
 * Smart currency input. Internal state holds ONLY raw digits; the display
 * layer formats them live. The TextInput is stable (never remounted) so focus
 * is never lost.
 *
 * Caret handling works in RAW-DIGIT space, not display space: this is what makes
 * mid-string edits, backspace, paste, selection-replace and leading-zero typing
 * land the caret correctly even when separators (".",",") are inserted. The raw
 * caret offset and the raw selection range are tracked via `selDigit` in
 * `onSelectionChange`, then converted back to a formatted caret through
 * `formatInputDigits(prefix)`.
 *
 * `variant="hero"` renders the large centered amount display used on the
 * transaction form: no box, big displayBold digits with the currency symbol
 * inline at the same size, baseline-aligned.
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

  // Current selection expressed as a range of RAW digits (start..end).
  const selDigits = useRef({ start: 0, end: 0 });
  // Previous raw digit value, kept fresh so the change handler can diff against it.
  const rawValueRef = useRef(String(value ?? ''));

  const fractionDigits = getCurrencyFractionDigits(currency);
  const resolvedSymbol = symbol ?? currencySymbol(currency);
  const [display, setDisplay] = useState(() => formatInputDigits(String(value ?? '')));

  const valueStr = String(value ?? '');

  // Keep the previous raw value and display in sync with external changes.
  useEffect(() => {
    rawValueRef.current = valueStr;
  }, [valueStr]);
  useEffect(() => {
    setDisplay(formatInputDigits(valueStr));
  }, [valueStr]);

  const handleSelection = useCallback((sel: { start: number; end: number }) => {
    selDigits.current = {
      start: stripFormatting(display.slice(0, sel.start)).length,
      end: stripFormatting(display.slice(0, sel.end)).length,
    };
  }, [display]);

  const handleChange = useCallback((text: string) => {
    // prevRaw is the previous RAW digit value (before this keystroke), taken
    // from the re-render that produced this handler.
    const prevRaw = rawValueRef.current;
    const { raw, caretFormatted, caretRaw } = computeInputAmount(
      text,
      prevRaw,
      selDigits.current.start,
      selDigits.current.end,
    );

    onChange(raw);
    rawValueRef.current = raw;
    const newDisplay = formatInputDigits(raw);
    setDisplay(newDisplay);

    selDigits.current = { start: caretRaw, end: caretRaw };

    requestAnimationFrame(() => {
      inputRef.current?.setNativeProps({ selection: { start: caretFormatted, end: caretFormatted } });
    });
  }, [onChange]);

  const isHero = variant === 'hero';
  const heroFontSize = scale(34);

  const baseInputStyle: TextStyle = {
    backgroundColor: colors.surface2,
    color: colors.onSurface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontFamily: font.displayBold,
    fontSize: 18,
  };

  const onSelectionChange = (e: any) => handleSelection(e.nativeEvent.selection);

  return (
    <View style={isHero ? [{ alignItems: 'center' }, style] : { marginBottom: spacing.md, ...style }}>
      {label && <Label style={{ marginBottom: isHero ? 8 : 6 }}>{label}</Label>}

      {isHero ? (
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
            onSelectionChange={onSelectionChange}
            placeholder={placeholder ?? '0'}
            placeholderTextColor={colors.muted}
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
      ) : (
        <View style={[baseInputStyle, { flexDirection: 'row', alignItems: 'center', paddingVertical: 0, paddingHorizontal: spacing.md }]}>
          <Text style={{ fontFamily: font.textMedium, fontSize: 15, color: colors.muted, marginRight: 6 }}>{resolvedSymbol}</Text>
          <TextInput
            ref={inputRef}
            testID={testID}
            value={display}
            onChangeText={handleChange}
            keyboardType={fractionDigits === 0 ? 'number-pad' : 'decimal-pad'}
            editable={editable}
            autoFocus={autoFocus}
            onFocus={() => focusToInput(inputRef.current)}
            onSelectionChange={onSelectionChange}
            placeholder={placeholder ?? '0'}
            placeholderTextColor={colors.muted}
            style={{ flex: 1, color: colors.onSurface, fontFamily: font.textBold, fontSize: 15, paddingVertical: 12, fontVariant: ['tabular-nums'] }}
          />
        </View>
      )}
    </View>
  );
}