import { Modal, Pressable, View } from 'react-native';
import { AppText } from './AppText';
import { AppButton } from './AppButton';
import { Card } from './Card';
import { useAppTheme } from '@/theme/useAppTheme';

type Props = {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  destructive?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmDialog({ visible, title, body, confirmLabel = 'Delete', destructive = true, onCancel, onConfirm }: Props) {
  const theme = useAppTheme();
  return (
    <Modal transparent visible={visible} animationType={theme.reducedMotion ? 'none' : 'fade'} onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'center', padding: theme.spacing.xl }}>
        <Pressable accessibilityRole="button" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} onPress={onCancel} accessibilityLabel="Close confirmation" />
        <Card style={{ gap: theme.spacing.lg, maxWidth: 520, width: '100%', alignSelf: 'center' }}>
          <View style={{ gap: theme.spacing.sm }}>
            <AppText variant="section">{title}</AppText>
            <AppText tone="secondary">{body}</AppText>
          </View>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm, justifyContent: 'flex-end' }}>
            <AppButton compact variant="ghost" label="Cancel" onPress={onCancel} />
            <AppButton compact variant={destructive ? 'danger' : 'primary'} label={confirmLabel} onPress={onConfirm} />
          </View>
        </Card>
      </View>
    </Modal>
  );
}
