import { View } from 'react-native';
import { AppText } from './AppText';
import { usePartnerPresence } from '@/hooks/usePartnerPresence';
import { useAppTheme } from '@/theme/useAppTheme';

export function PartnerPresencePill({ scope }: { scope: string }) {
  const theme = useAppTheme();
  const { hasPartner, partnerName, isHere } = usePartnerPresence(scope);
  // Absence from this screen does not establish offline status.
  if (!hasPartner || !isHere) return null;

  return (
    <View style={{
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      paddingHorizontal: 11,
      paddingVertical: 7,
      marginBottom: 0,
      borderRadius: theme.radii.pill,
      borderWidth: 1,
      borderColor: isHere ? theme.colors.accent : theme.colors.border,
      backgroundColor: isHere ? theme.colors.accentSoft : theme.colors.elevatedBackground,
    }}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: isHere ? theme.colors.accentStrong : theme.colors.textMuted }} />
      <AppText style={{ flexShrink: 1 }} variant="bodySmall" tone={isHere ? 'accent' : 'muted'}>
        {`${partnerName} is here with you`}
      </AppText>
    </View>
  );
}
