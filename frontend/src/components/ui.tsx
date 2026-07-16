import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ViewStyle, TextStyle, StyleProp } from 'react-native';
import type { TextProps } from 'react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { spacing, radius, font } from '@/src/theme/tokens';
import Svg, { Circle } from 'react-native-svg';

// ------------------------- Screen ---------------------------------
export function Screen({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return <View style={[{ flex: 1, backgroundColor: colors.surface }, style]}>{children}</View>;
}

// ------------------------- Card -----------------------------------
export function Card({ children, style, onPress, testID }: {
  children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; testID?: string;
}) {
  const { colors } = useTheme();
  const inner = (
    <View style={[{
      backgroundColor: colors.surface2,
      borderRadius: radius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
    }, style]}>{children}</View>
  );
  if (onPress) return <TouchableOpacity testID={testID} activeOpacity={0.85} onPress={onPress}>{inner}</TouchableOpacity>;
  return inner;
}

// ----------------------- Typography -------------------------------
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
        fontSize: size,
        letterSpacing: -0.5,
      }, style]}
    >{children}</Text>
  );
}

export function H1({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const { colors } = useTheme();
  return <Text style={[{ color: colors.onSurface, fontFamily: font.displayBold, fontSize: 28, letterSpacing: -0.4 }, style]}>{children}</Text>;
}
export function H2({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const { colors } = useTheme();
  return <Text style={[{ color: colors.onSurface, fontFamily: font.displayBold, fontSize: 20 }, style]}>{children}</Text>;
}
export function Body({ children, style, muted, testID, ...rest }: TextProps & { children: React.ReactNode; style?: StyleProp<TextStyle>; muted?: boolean; testID?: string }) {
  const { colors } = useTheme();
  return <Text testID={testID} style={[{ color: muted ? colors.muted : colors.onSurface2, fontFamily: font.text, fontSize: 14 }, style]} {...rest}>{children}</Text>;
}
export function Label({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const { colors } = useTheme();
  return <Text style={[{ color: colors.muted, fontFamily: font.textMedium, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase' }, style]}>{children}</Text>;
}

// ------------------------- Button ---------------------------------
export function Button({
  label, onPress, variant = 'primary', loading, disabled, style, testID, icon,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean; disabled?: boolean;
  style?: StyleProp<ViewStyle>; testID?: string; icon?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const bg =
    variant === 'primary' ? colors.brandPrimary
    : variant === 'secondary' ? colors.surface3
    : variant === 'danger' ? colors.error
    : 'transparent';
  const fg =
    variant === 'primary' ? colors.onBrand
    : variant === 'danger' ? '#fff'
    : colors.onSurface;
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      style={[{
        backgroundColor: bg,
        borderRadius: radius.pill,
        paddingVertical: 14,
        paddingHorizontal: spacing.xl,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.5 : 1,
        flexDirection: 'row',
      }, style]}
    >
      {loading ? <ActivityIndicator color={fg} /> : (
        <>
          {icon && <View style={{ marginRight: 8 }}>{icon}</View>}
          <Text style={{ color: fg, fontFamily: font.textBold, fontSize: 15 }}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

// --------------------- Progress Ring -----------------------------
export function ProgressRing({
  progress, size = 72, stroke = 8, color, trackColor, children,
}: {
  progress: number; // 0..1
  size?: number; stroke?: number;
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

// ------------------- Linear Progress Bar --------------------------
export function ProgressBar({ progress, color, height = 6 }: { progress: number; color?: string; height?: number }) {
  const { colors } = useTheme();
  const p = Math.max(0, Math.min(1, progress));
  return (
    <View style={{ height, backgroundColor: colors.surface3, borderRadius: height, overflow: 'hidden' }}>
      <View style={{ width: `${p * 100}%`, height, backgroundColor: color || colors.brandPrimary, borderRadius: height }} />
    </View>
  );
}

// ------------------------- Chip -----------------------------------
export function Chip({ label, active, onPress, testID }: { label: string; active?: boolean; onPress?: () => void; testID?: string }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        height: 36,
        flexShrink: 0,
        paddingHorizontal: spacing.lg,
        borderRadius: radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: active ? colors.brandPrimary : colors.border,
        backgroundColor: active ? colors.brandPrimary : 'transparent',
      }}
    >
      <Text style={{
        color: active ? colors.onBrand : colors.onSurface,
        fontFamily: font.textMedium, fontSize: 13,
      }}>{label}</Text>
    </TouchableOpacity>
  );
}

// ------------------------- Divider --------------------------------
export function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.md }} />;
}

// ------------------------- Empty ----------------------------------
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
      <Text style={{ color: colors.onSurface, fontFamily: font.displayBold, fontSize: 18, marginBottom: 6 }}>{title}</Text>
      {subtitle && <Text style={{ color: colors.muted, textAlign: 'center', fontFamily: font.text, fontSize: 14, marginBottom: spacing.lg }}>{subtitle}</Text>}
      {actionLabel && onAction && (
        <Button label={actionLabel} onPress={onAction} testID={testID ? `${testID}-action` : undefined} />
      )}
    </View>
  );
}

// --------------------- Input --------------------------------------
import { TextInput, TextInputProps } from 'react-native';

export function Input(props: TextInputProps & { label?: string; testID?: string }) {
  const { colors } = useTheme();
  const { label, style, testID, ...rest } = props;
  return (
    <View style={{ marginBottom: spacing.md }}>
      {label && <Label style={{ marginBottom: 6 }}>{label}</Label>}
      <TextInput
        testID={testID}
        placeholderTextColor={colors.muted}
        {...rest}
        style={[{
          backgroundColor: colors.surface2,
          color: colors.onSurface,
          borderRadius: radius.md,
          paddingHorizontal: spacing.lg,
          paddingVertical: 14,
          borderWidth: 1,
          borderColor: colors.border,
          fontFamily: font.text,
          fontSize: 15,
        }, style]}
      />
    </View>
  );
}

// --------------------- IconBadge (emoji-free) ---------------------
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
