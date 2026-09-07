import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '@/theme/useAppTheme';
import { CosmicBackdrop } from './CosmicBackdrop';
import { FadeSlideIn } from '@/components/motion/Motion';

type Props = {
  children: ReactNode;
  scroll?: boolean;
  contentStyle?: ViewStyle;
};

export function AppScreen({ children, scroll = true, contentStyle }: Props) {
  const theme = useAppTheme();
  const content = <FadeSlideIn distance={8}><View style={[styles.content, { paddingHorizontal: theme.spacing.xl }, contentStyle]}>{children}</View></FadeSlideIn>;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]} edges={['top', 'left', 'right']}>
      <CosmicBackdrop />
      <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView
            style={styles.safe}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          >
            {content}
          </ScrollView>
        ) : content}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scrollContent: { paddingBottom: 120 },
  content: { flexGrow: 1, width: '100%', maxWidth: 1040, alignSelf: 'center', paddingTop: 10 },
});
