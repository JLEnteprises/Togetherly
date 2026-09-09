import { View } from 'react-native';
import { AppText } from './AppText';
import { usePartnerPresence } from '@/hooks/usePartnerPresence';
import { useAppTheme } from '@/theme/useAppTheme';

export function PartnerPresencePill({ scope }: { scope: string }) {
  const theme = useAppTheme();
  const { hasPartner, partnerName, isHere } = usePartnerPresence(scope);
  if (!hasPartner) return null;

  return (
    <View style={{
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      paddingHorizontal: 11,
      paddingVertical: 7,
      marginBottom: theme.spacing.lg,
      borderRadius: theme.radii.pill,
      borderWidth: 1,
      borderColor: isHere ? theme.colors.accent : theme.colors.border,
      backgroundColor: isHere ? theme.colors.accentSoft : theme.colors.elevatedBackground,
    }}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: isHere ? theme.colors.accentStrong : theme.colors.textMuted }} />
      <AppText variant="bodySmall" tone={isHere ? 'accent' : 'muted'}>
        {isHere ? `${partnerName} is here ♥` : `Waiting for ${partnerName}…`}
      </AppText>
    </View>
  );
}
