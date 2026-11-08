import React, { useCallback, useEffect, useState } from 'react';
import { View, Image, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { File, Paths } from 'expo-file-system';

import { useTheme } from '@/src/theme/ThemeProvider';
import { spacing, radius } from '@/src/theme/tokens';
import { Body, Label, Button } from '@/src/components/ui';
import { useI18n } from '@/src/lib/I18nProvider';
import { api, getToken } from '@/src/api/client';

export type Receipt = {
  id: string;
  content_type: string;
  filename: string;
  size: number;
};

/**
 * Receipts are served from an authenticated endpoint, so <Image source={{uri}}>
 * cannot load them directly. Bytes are fetched with the bearer token and cached
 * to a local file, which the Image then renders.
 */
function useReceiptImage(receipt: Receipt | null) {
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!receipt) { setUri(null); return; }

    void (async () => {
      try {
        const token = await getToken();
        const res = await fetch(api.receiptFileUrl(receipt.id), {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) return;
        const buffer = await res.arrayBuffer();
        const ext = receipt.content_type === 'application/pdf' ? 'pdf' : 'jpg';
        const file = new File(Paths.cache, `receipt-${receipt.id}.${ext}`);
        if (file.exists) file.delete();
        file.create();
        file.write(new Uint8Array(buffer));
        if (!cancelled) setUri(file.uri);
      } catch {
        // Leave uri null; the caller shows a placeholder.
      }
    })();

    return () => { cancelled = true; };
  }, [receipt]);

  return uri;
}

export function ReceiptAttachments({
  transactionId,
  editable = true,
}: {
  transactionId: string;
  editable?: boolean;
}) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<Receipt | null>(null);
  const previewUri = useReceiptImage(preview);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result: any = await api.receipts(transactionId);
      setReceipts(result?.receipts || []);
    } catch (cause: any) {
      setError(cause?.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [transactionId, t]);

  useEffect(() => { void load(); }, [load]);

  const pickAndUpload = async () => {
    setError('');
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError(t('receipt.permissionDenied'));
        return;
      }
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsMultipleSelection: false,
      });
      if (picked.canceled || !picked.assets?.[0]) return;

      const asset = picked.assets[0];
      setUploading(true);
      await api.uploadReceipt(transactionId, {
        uri: asset.uri,
        name: asset.fileName || 'receipt.jpg',
        type: asset.mimeType || 'image/jpeg',
      });
      await load();
    } catch (cause: any) {
      setError(cause?.message || t('receipt.uploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  const remove = (receipt: Receipt) => {
    Alert.alert(t('receipt.deleteTitle'), t('receipt.deleteMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteReceipt(receipt.id);
            setReceipts((prev) => prev.filter((r) => r.id !== receipt.id));
            if (preview?.id === receipt.id) setPreview(null);
          } catch (cause: any) {
            setError(cause?.message || t('common.error'));
          }
        },
      },
    ]);
  };

  return (
    <View testID="receipt-attachments" style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Label>{t('receipt.title')}</Label>
        {editable && (
          <Button
            testID="receipt-add"
            variant="secondary"
            label={uploading ? t('receipt.uploading') : t('receipt.add')}
            onPress={pickAndUpload}
            loading={uploading}
          />
        )}
      </View>

      {!!error && <Body style={{ color: colors.error, fontSize: 12 }}>{error}</Body>}

      {loading ? (
        <Body muted style={{ fontSize: 12 }}>{t('common.loading')}</Body>
      ) : receipts.length === 0 ? (
        <Body muted style={{ fontSize: 12 }}>{t('receipt.empty')}</Body>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {receipts.map((receipt) => (
            <View key={receipt.id} style={{ position: 'relative' }}>
              <TouchableOpacity
                testID={`receipt-open-${receipt.id}`}
                accessibilityRole="button"
                accessibilityLabel={receipt.filename}
                onPress={() => setPreview(receipt)}
                style={{
                  width: 84, height: 84, borderRadius: radius.md, overflow: 'hidden',
                  backgroundColor: colors.surface3, alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Ionicons name="document-attach-outline" size={22} color={colors.muted} />
              </TouchableOpacity>
              {editable && (
                <TouchableOpacity
                  testID={`receipt-remove-${receipt.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.delete')}
                  hitSlop={8}
                  onPress={() => remove(receipt)}
                  style={{
                    position: 'absolute', top: -6, right: -6,
                    width: 22, height: 22, borderRadius: 11,
                    backgroundColor: colors.error, alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Ionicons name="close" size={12} color={colors.onBrand} />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      )}

      {preview && (
        <View testID="receipt-preview" style={{
          borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
          backgroundColor: colors.surface2, padding: spacing.sm, gap: spacing.sm,
        }}>
          {previewUri ? (
            preview.content_type === 'application/pdf' ? (
              <Body muted style={{ fontSize: 12 }}>{t('receipt.pdfNotice')}</Body>
            ) : (
              <Image
                source={{ uri: previewUri }}
                style={{ width: '100%', height: 220, borderRadius: radius.sm }}
                resizeMode="contain"
                accessibilityLabel={preview.filename}
              />
            )
          ) : (
            <Body muted style={{ fontSize: 12 }}>{t('common.loading')}</Body>
          )}
          <Body muted style={{ fontSize: 11 }} numberOfLines={1}>{preview.filename}</Body>
          <Button
            variant="ghost"
            label={t('common.dismiss')}
            onPress={() => setPreview(null)}
          />
        </View>
      )}
    </View>
  );
}
