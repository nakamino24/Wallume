import React, { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/theme/ThemeProvider';
import { spacing, radius, font } from '@/src/theme/tokens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ToastType = 'success' | 'error' | 'info';

type ToastCtx = {
  show: (message: string, type?: ToastType) => void;
};

const Ctx = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [type, setType] = useState<ToastType>('success');
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setVisible(false));
  }, [opacity]);

  const show = useCallback((msg: string, t: ToastType = 'success') => {
    if (timer.current) clearTimeout(timer.current);
    setMessage(msg);
    setType(t);
    setVisible(true);
    Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    timer.current = setTimeout(hide, 2500);
  }, [opacity, hide]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const icon = type === 'success' ? 'checkmark-circle' : type === 'error' ? 'alert-circle' : 'information-circle';
  const bgColor = type === 'success' ? colors.success : type === 'error' ? colors.error : colors.brand;

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      {visible && (
        <Animated.View style={[styles.container, { opacity, backgroundColor: bgColor, bottom: insets.bottom + 80 }]}>
          <Ionicons name={icon} size={18} color="#FFFFFF" />
          <Text style={styles.text}>{message}</Text>
        </Animated.View>
      )}
    </Ctx.Provider>
  );
}

export function useToast() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useToast outside ToastProvider');
  return c;
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    zIndex: 9999,
  },
  text: {
    color: '#FFFFFF',
    fontFamily: font.textMedium,
    fontSize: 14,
    flex: 1,
  },
});