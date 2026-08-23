import React, { useState } from 'react';
import { View, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useTheme } from '@/src/theme/ThemeProvider';
import { spacing, radius } from '@/src/theme/tokens';
import { Body, Label } from '@/src/components/ui';

export function DateField({
  label, value, onChange, testID, style,
}: {
  label?: string;
  value: string; // YYYY-MM-DD
  onChange: (iso: string) => void;
  testID?: string;
  style?: any;
}) {
  const { colors } = useTheme();
  const [show, setShow] = useState(false);

  const parsed = value && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date();

  const display = value
    ? parsed.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    : 'Select date';

  return (
    <View style={{ marginBottom: spacing.md, ...style }}>
      {label && <Label style={{ marginBottom: 6 }}>{label}</Label>}
      <TouchableOpacity
        testID={testID}
        onPress={() => setShow(true)}
        activeOpacity={0.7}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: colors.surface2,
          borderRadius: radius.sm,
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: spacing.md,
          paddingVertical: 12,
        }}
      >
        <Body style={{ fontSize: 15 }}>{display}</Body>
        <Ionicons name="calendar-outline" size={18} color={colors.muted} />
      </TouchableOpacity>
      {show && (
        <DateTimePicker
          testID={testID ? `${testID}-picker` : undefined}
          value={parsed}
          mode="date"
          maximumDate={new Date(2100, 11, 31)}
          onChange={(event: DateTimePickerEvent, date?: Date) => {
            if (Platform.OS === 'android') setShow(false);
            if (event.type === 'set' && date) {
              const y = date.getFullYear();
              const m = String(date.getMonth() + 1).padStart(2, '0');
              const d = String(date.getDate()).padStart(2, '0');
              onChange(`${y}-${m}-${d}`);
            }
          }}
        />
      )}
    </View>
  );
}