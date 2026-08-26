import React from 'react';
import { StyleSheet } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { useTheme } from '@/src/theme/ThemeProvider';
import { font, spacing } from '@/src/theme/tokens';
import * as Linking from 'expo-linking';

type Props = {
  children: string;
  isUser?: boolean;
};

export function CoachMarkdown({ children, isUser }: Props) {
  const { colors } = useTheme();
  const textColor = isUser ? colors.onBrand : colors.onSurface;

  const styles = StyleSheet.create({
    body: {
      color: textColor,
      fontFamily: font.text,
      fontSize: 14,
      lineHeight: 20,
    },
    heading1: {
      color: textColor,
      fontFamily: font.textBold,
      fontSize: 16,
      marginTop: spacing.md,
      marginBottom: spacing.sm,
    },
    heading2: {
      color: textColor,
      fontFamily: font.textBold,
      fontSize: 15,
      marginTop: spacing.md,
      marginBottom: spacing.sm,
    },
    heading3: {
      color: textColor,
      fontFamily: font.textBold,
      fontSize: 14,
      marginTop: spacing.sm,
      marginBottom: 4,
    },
    strong: {
      fontFamily: font.textBold,
      fontWeight: '600',
    },
    em: {
      fontFamily: font.text,
      fontStyle: 'italic',
    },
    bullet_list: {
      marginTop: 4,
      marginBottom: 4,
    },
    ordered_list: {
      marginTop: 4,
      marginBottom: 4,
    },
    list_item: {
      flexDirection: 'row',
      marginBottom: 2,
    },
    bullet_list_icon: {
      color: textColor,
      marginLeft: 0,
      marginRight: 6,
    },
    ordered_list_icon: {
      color: textColor,
      marginLeft: 0,
      marginRight: 6,
    },
    bullet_list_content: {
      flex: 1,
    },
    ordered_list_content: {
      flex: 1,
    },
    paragraph: {
      marginTop: 4,
      marginBottom: 4,
      flexWrap: 'wrap',
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'flex-start',
      width: '100%',
    },
    blockquote: {
      backgroundColor: colors.surface3,
      borderLeftColor: colors.border,
      borderLeftWidth: 3,
      paddingLeft: spacing.sm,
      marginTop: 4,
      marginBottom: 4,
    },
    code_inline: {
      fontFamily: font.text,
      backgroundColor: colors.surface3,
      color: textColor,
      paddingHorizontal: 4,
      borderRadius: 4,
      fontSize: 13,
    },
    code_block: {
      fontFamily: font.text,
      backgroundColor: colors.surface3,
      color: textColor,
      padding: spacing.sm,
      borderRadius: 6,
      marginTop: 4,
      marginBottom: 4,
    },
    fence: {
      fontFamily: font.text,
      backgroundColor: colors.surface3,
      color: textColor,
      padding: spacing.sm,
      borderRadius: 6,
      marginTop: 4,
      marginBottom: 4,
    },
    link: {
      color: isUser ? colors.onBrand : colors.brandPrimary,
      textDecorationLine: 'underline',
    },
    hr: {
      backgroundColor: colors.border,
      height: 1,
      marginTop: spacing.md,
      marginBottom: spacing.md,
    },
  });

  return (
    <Markdown
      style={styles as any}
      onLinkPress={(url) => {
        if (!url) return false;
        try {
          const parsed = new URL(url);
          if (['http:', 'https:', 'mailto:'].includes(parsed.protocol)) {
            Linking.openURL(url);
            return false;
          }
        } catch {
          // Invalid URL, ignore
        }
        return false;
      }}
    >
      {children}
    </Markdown>
  );
}
