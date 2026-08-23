import React, { useEffect, useRef } from 'react';
import { View, Animated } from 'react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { spacing, radius } from '@/src/theme/tokens';

export function Skeleton({ width, height, style }: { width?: number | string; height?: number | string; style?: any }) {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <Animated.View
      style={[{
        width: width ?? '100%',
        height: height ?? 20,
        borderRadius: radius.sm,
        backgroundColor: colors.surface3,
        opacity,
      }, style]}
    />
  );
}

export function SkeletonCard({ style }: { style?: any }) {
  const { colors } = useTheme();
  return (
    <View style={[{
      backgroundColor: colors.surface2,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      gap: spacing.md,
    }, style]}>
      <Skeleton width="40%" height={12} />
      <Skeleton width="70%" height={24} />
      <View style={{ flexDirection: 'row', gap: spacing.xl }}>
        <Skeleton width={80} height={16} />
        <Skeleton width={80} height={16} />
      </View>
    </View>
  );
}

export function SkeletonRow({ style }: { style?: any }) {
  const { colors } = useTheme();
  return (
    <View style={[{
      flexDirection: 'row', alignItems: 'center', padding: spacing.md,
      borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.md,
    }, style]}>
      <Skeleton width={40} height={40} style={{ borderRadius: radius.md }} />
      <View style={{ flex: 1, gap: 4 }}>
        <Skeleton width="50%" height={14} />
        <Skeleton width="30%" height={12} />
      </View>
      <Skeleton width={80} height={16} />
    </View>
  );
}