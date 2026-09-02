import React, { useRef, useState } from 'react';
import { View, Text, ActivityIndicator, ViewStyle, TextStyle, StyleProp, TextInput, TextInputProps, Pressable } from 'react-native';
import type { TextProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useI18n } from '@/src/lib/I18nProvider';
import { spacing, radius, font } from '@/src/theme/tokens';
import { scale } from '@/src/utils/responsive';
import Svg, { Circle } from 'react-native-svg';
import { useKeyboardScroll } from '@/src/components/KeyboardAwareContainer';
import { AppBackground } from '@/src/components/AppBackground';

export function Screen({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <AppBackground><View style={[{ flex: 1 }, style]}>{children}</View></AppBackground>;
}

export function Card({ children, style, onPress, testID, accessibilityLabel }: {
  children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; testID?: string; accessibilityLabel?: string;
}) {
  const { colors } = useTheme();
  const inner = (
    <View testID={onPress ? undefined : testID} style={[{
      backgroundColor: colors.surface2,
      borderRadius: radius.md,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
    }, style]}>{children}</View>
  );
  if (onPress) return <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.88 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] })}>{inner}</Pressable>;
  return inner;
}

// Typography — Inter-only, tabular for money
export function DisplayNumber({ children, size = 40, style, color }: {
  children: React.ReactNode; size?: number; style?: StyleProp<TextStyle>; color?: string;
}) {
  const { colors } = useTheme();
  return (
    <Text
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.5}
      style={[{
        color: color || colors.onSurface,
        fontFamily: font.displayBold,
        fontSize: scale(size),
        letterSpacing: -0.5,
        fontWeight: '600',
        fontVariant: ['tabular-nums'],
      } as TextStyle, style]}
    >{children}</Text>
  );
}

export function H1({ children, style, ...rest }: TextProps & { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const { colors } = useTheme();
  return <Text style={[{ color: colors.onSurface, fontFamily: font.textBold, fontSize: scale(font.sizes.xl), fontWeight: '600', letterSpacing: -0.3, lineHeight: scale(32) }, style]} {...rest}>{children}</Text>;
}
export function H2({ children, style, ...rest }: TextProps & { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const { colors } = useTheme();
  return <Text style={[{ color: colors.onSurface, fontFamily: font.textBold, fontSize: scale(font.sizes.lg), fontWeight: '600', letterSpacing: -0.2, lineHeight: scale(22) }, style]} {...rest}>{children}</Text>;
}
export function Body({ children, style, muted, testID, ...rest }: TextProps & { children: React.ReactNode; style?: StyleProp<TextStyle>; muted?: boolean; testID?: string }) {
  const { colors } = useTheme();
  return <Text testID={testID} style={[{ color: muted ? colors.muted : colors.onSurface2, fontFamily: font.text, fontSize: scale(font.sizes.base), lineHeight: scale(22) }, style]} {...rest}>{children}</Text>;
}
export function Caption({ children, style, muted, testID }: { children: React.ReactNode; style?: StyleProp<TextStyle>; muted?: boolean; testID?: string }) {
  const { colors } = useTheme();
  return <Text testID={testID} style={[{ color: muted ? colors.muted : colors.onSurface3, fontFamily: font.text, fontSize: scale(font.sizes.sm), lineHeight: scale(16) }, style]}>{children}</Text>;
}
export function Label({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const { colors } = useTheme();
  return <Text style={[{ color: colors.muted, fontFamily: font.textMedium, fontSize: scale(11), letterSpacing: 0.5, lineHeight: scale(14) }, style]}>{children}</Text>;
}

// Button
export function Button({
  label, onPress, variant = 'primary', loading, disabled, style, testID, icon, accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean; disabled?: boolean;
  style?: StyleProp<ViewStyle>; testID?: string; icon?: React.ReactNode; accessibilityLabel?: string;
}) {
  const { colors } = useTheme();
  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';
  const isGhost = variant === 'ghost';
  const bg = isPrimary ? colors.brandPrimary : isDanger ? 'transparent' : isGhost ? 'transparent' : 'transparent';
  const fg = isPrimary ? colors.onBrand : isDanger ? colors.error : colors.onSurface;
  const bd = isPrimary ? 'transparent' : isDanger ? colors.error : colors.border;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ disabled: Boolean(disabled || loading), busy: Boolean(loading) }}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [{
        backgroundColor: bg,
        borderRadius: radius.sm,
        paddingVertical: 12,
        paddingHorizontal: spacing.lg,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.5 : pressed ? 0.9 : 1,
        transform: [{ scale: pressed ? 0.985 : 1 }],
        flexDirection: 'row',
        borderWidth: isPrimary ? 0 : 1,
        borderColor: bd,
      }, style]}
    >
      {loading ? <ActivityIndicator color={fg} /> : (
        <>
          {icon && <View style={{ marginRight: 8 }}>{icon}</View>}
          <Text style={{ color: fg, fontFamily: font.textMedium, fontSize: 14, fontWeight: '500' }}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

// Progress Ring
export function ProgressRing({
  progress, size = 72, stroke = 8, color, trackColor, children,
}: {
  progress: number; size?: number; stroke?: number;
  color?: string; trackColor?: string;
  children?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const c = color || colors.brandPrimary;
  const t = trackColor || colors.surface3;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, progress));
  const offset = circ - clamped * circ;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={t} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={c} strokeWidth={stroke} fill="none"
          strokeDasharray={`${circ} ${circ}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>{children}</View>
    </View>
  );
}

export function ProgressBar({ progress, color, height = 6 }: { progress: number; color?: string; height?: number }) {
  const { colors } = useTheme();
  const p = Math.max(0, Math.min(1, progress));
  return (
    <View style={{ height, backgroundColor: colors.surface3, borderRadius: height / 2, overflow: 'hidden' }}>
      <View style={{ width: `${p * 100}%`, height, backgroundColor: color || colors.brandPrimary, borderRadius: height / 2 }} />
    </View>
  );
}

export function Chip({ label, active, onPress, testID }: { label: string; active?: boolean; onPress?: () => void; testID?: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={label}
      accessibilityState={{ selected: Boolean(active), disabled: !onPress }}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 44,
        flexShrink: 0,
        paddingHorizontal: spacing.md,
        borderRadius: radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: active ? colors.brandPrimary : colors.border,
        backgroundColor: active ? colors.brandPrimary : colors.surface2,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text style={{
        color: active ? colors.onBrand : colors.onSurface,
        fontFamily: font.textMedium, fontSize: 13,
      }}>{label}</Text>
    </Pressable>
  );
}

export function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.md }} />;
}

export function EmptyState({
  icon, title, subtitle, actionLabel, onAction, testID,
}: {
  icon?: React.ReactNode; title: string; subtitle?: string;
  actionLabel?: string; onAction?: () => void; testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <View testID={testID} style={{ alignItems: 'center', paddingVertical: spacing.xxxl, paddingHorizontal: spacing.xl }}>
      {icon && <View style={{ marginBottom: spacing.md }}>{icon}</View>}
      <Text style={{ color: colors.onSurface, fontFamily: font.displayBold, fontSize: 18, fontWeight: '600', marginBottom: 6 }}>{title}</Text>
      {subtitle && <Text style={{ color: colors.muted, textAlign: 'center', fontFamily: font.text, fontSize: font.sizes.base, marginBottom: spacing.lg }}>{subtitle}</Text>}
      {actionLabel && onAction && (
        <Button label={actionLabel} onPress={onAction} testID={testID ? `${testID}-action` : undefined} />
      )}
    </View>
  );
}

// Input


export function Input(props: TextInputProps & { label?: string; testID?: string }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const { label, style, testID, onFocus, secureTextEntry, ...rest } = props;
  const { focusToInput } = useKeyboardScroll();
  const ref = useRef<TextInput>(null);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const isPassword = secureTextEntry === true;
  return (
    <View style={{ marginBottom: spacing.md }}>
      {label && <Label style={{ marginBottom: 6 }}>{label}</Label>}
      <View style={{ position: 'relative' }}>
        <TextInput
          ref={ref}
          testID={testID}
          accessibilityLabel={label || rest.placeholder}
          placeholderTextColor={colors.muted}
          onFocus={(e) => { focusToInput(ref.current); if (onFocus) onFocus(e); }}
          secureTextEntry={isPassword ? !passwordVisible : secureTextEntry}
          {...rest}
          style={[{
            backgroundColor: colors.surface2,
            color: colors.onSurface,
            borderRadius: radius.sm,
            paddingHorizontal: spacing.md,
            paddingVertical: 12,
            borderWidth: 1,
            borderColor: colors.border,
            fontFamily: font.text,
            fontSize: 15,
          }, style, isPassword && { paddingRight: 52 }]}
        />
        {isPassword && (
          <Pressable
            testID={testID ? `${testID}-visibility-toggle` : undefined}
            accessibilityRole="button"
            accessibilityLabel={t(passwordVisible ? 'auth.password.hide' : 'auth.password.show')}
            onPress={() => setPasswordVisible((visible) => !visible)}
            style={({ pressed }) => ({
              position: 'absolute',
              right: 4,
              top: 0,
              bottom: 0,
              width: 44,
              minHeight: 44,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.65 : 1,
            })}
          >
            <Ionicons
              name={passwordVisible ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.muted}
            />
          </Pressable>
        )}
      </View>
    </View>
  );
}

export function IconBadge({ children, color, size = 40 }: { children: React.ReactNode; color?: string; size?: number }) {
  const { colors } = useTheme();
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: (color || colors.brandSoft),
    }}>{children}</View>
  );
}
