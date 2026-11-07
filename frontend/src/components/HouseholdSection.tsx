import React, { useCallback, useEffect, useState } from 'react';
import { View, TouchableOpacity, Alert, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/src/theme/ThemeProvider';
import { spacing, radius, font } from '@/src/theme/tokens';
import { Body, Label, Button, Input, Card } from '@/src/components/ui';
import { useI18n } from '@/src/lib/I18nProvider';
import { api } from '@/src/api/client';

type Member = { user_id: string; name?: string; role: string; joined_at?: string };
type Household = {
  id: string;
  name: string;
  role: 'owner' | 'member';
  invite_code: string | null;
  is_shared: boolean;
  members: Member[];
};

export function HouseholdSection({ currentUserId }: { currentUserId?: string }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const [household, setHousehold] = useState<Household | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [name, setName] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const result: any = await api.household();
      setHousehold(result?.household || null);
      setName(result?.household?.name || '');
    } catch (cause: any) {
      setError(cause?.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void load(); }, [load]);

  const act = async (fn: () => Promise<any>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      await load();
    } catch (cause: any) {
      setError(cause?.message || t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  const shareCode = async () => {
    if (!household?.invite_code) return;
    try {
      await Share.share({
        message: t('household.shareMessage', { code: household.invite_code }),
      });
    } catch {
      // Sharing is best-effort; the code is visible on screen regardless.
    }
  };

  const confirmLeave = () => {
    Alert.alert(t('household.leaveTitle'), t('household.leaveMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('household.leave'), style: 'destructive', onPress: () => act(() => api.leaveHousehold()) },
    ]);
  };

  const confirmTransfer = (member: Member) => {
    Alert.alert(t('household.transferTitle'), t('household.transferMessage', { name: memberDisplayName(member) }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('household.transfer'),
        style: 'default',
        onPress: () => act(() => api.transferHouseholdOwnership(member.user_id)),
      },
    ]);
  };

  const memberDisplayName = (member: Member) =>
    member.user_id === currentUserId ? t('household.you') : (member.name || t('household.untitled'));

  const confirmRemove = (member: Member) => {
    Alert.alert(t('household.removeTitle'), t('household.removeMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('household.remove'), style: 'destructive', onPress: () => act(() => api.removeHouseholdMember(member.user_id)) },
    ]);
  };

  const isOwner = household?.role === 'owner';

  return (
    <Card testID="household-section">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Ionicons name="people-outline" size={18} color={colors.brandPrimary} />
        <Label>{t('household.title')}</Label>
      </View>

      {loading ? (
        <Body muted style={{ marginTop: spacing.sm, fontSize: 12 }}>{t('common.loading')}</Body>
      ) : (
        <>
          <Body muted style={{ marginTop: spacing.sm, fontSize: 12 }}>
            {household?.is_shared ? t('household.sharedBody') : t('household.soloBody')}
          </Body>

          {!!error && <Body style={{ marginTop: spacing.sm, color: colors.error, fontSize: 12 }}>{error}</Body>}

          {isOwner && (
            <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
              <Input
                testID="household-name"
                label={t('household.name')}
                value={name}
                onChangeText={setName}
                placeholder={t('household.namePlaceholder')}
              />
              <Button
                testID="household-rename"
                variant="secondary"
                label={t('common.save')}
                onPress={() => act(() => api.renameHousehold(name))}
                loading={busy}
                disabled={!name.trim() || name === household?.name}
              />
            </View>
          )}

          {isOwner && household?.invite_code && (
            <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
              <Body style={{ fontFamily: font.textBold, fontSize: 13 }}>{t('household.inviteCode')}</Body>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View testID="household-invite-code" style={{
                  flex: 1, padding: spacing.md, borderRadius: radius.md,
                  backgroundColor: colors.surface3, alignItems: 'center',
                }}>
                  <Body style={{ fontFamily: font.displayBold, fontSize: 20, letterSpacing: 3 }}>
                    {household.invite_code}
                  </Body>
                </View>
                <TouchableOpacity
                  testID="household-share"
                  accessibilityRole="button"
                  accessibilityLabel={t('household.share')}
                  onPress={shareCode}
                  style={{ padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.brandPrimary }}
                >
                  <Ionicons name="share-outline" size={18} color={colors.onBrand} />
                </TouchableOpacity>
              </View>
              <Button
                testID="household-rotate"
                variant="ghost"
                label={t('household.rotate')}
                onPress={() => act(() => api.rotateHouseholdInvite())}
                loading={busy}
              />
            </View>
          )}

          {household && household.members.length > 0 && (
            <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
              <Body style={{ fontFamily: font.textBold, fontSize: 13 }}>{t('household.members')}</Body>
              {household.members.map((member) => (
                <View key={member.user_id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 }}>
                  <Body style={{ fontSize: 13 }} numberOfLines={1}>
                    {memberDisplayName(member)}
                    {member.role === 'owner' ? ` · ${t('household.owner')}` : ''}
                  </Body>
                  {isOwner && member.user_id !== currentUserId && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                      <TouchableOpacity
                        testID={`household-transfer-${member.user_id}`}
                        accessibilityRole="button"
                        accessibilityLabel={t('household.transfer')}
                        hitSlop={8}
                        onPress={() => confirmTransfer(member)}
                      >
                        <Ionicons name="key-outline" size={18} color={colors.muted} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        testID={`household-remove-${member.user_id}`}
                        accessibilityRole="button"
                        accessibilityLabel={t('household.remove')}
                        hitSlop={8}
                        onPress={() => confirmRemove(member)}
                      >
                        <Ionicons name="close-circle-outline" size={18} color={colors.muted} />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

          {!isOwner && (
            <Button
              testID="household-leave"
              variant="secondary"
              label={t('household.leave')}
              onPress={confirmLeave}
              loading={busy}
              style={{ marginTop: spacing.md }}
            />
          )}

          <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
            <Input
              testID="household-join-code"
              label={t('household.joinLabel')}
              value={inviteCode}
              onChangeText={setInviteCode}
              autoCapitalize="characters"
              placeholder={t('household.joinPlaceholder')}
            />
            <Button
              testID="household-join"
              label={t('household.join')}
              onPress={() => act(() => api.joinHousehold(inviteCode.trim().toUpperCase()))}
              loading={busy}
              disabled={inviteCode.trim().length < 4}
            />
          </View>
        </>
      )}
    </Card>
  );
}
