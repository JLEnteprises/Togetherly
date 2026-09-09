import { View } from 'react-native';
import { Card } from '@/components/common/Card';
import { AppText } from '@/components/common/AppText';
import type { LiveLocationMember } from '@/types/database';
import { participantPalettes, participantPalette } from '@/theme/tokens';

// TypeScript resolves this base file, while Metro selects PartnerMap.native.tsx or
// PartnerMap.web.tsx for the actual platform at bundle time.
export function PartnerMap({ members }: { members: LiveLocationMember[] }) {
  const visible = members.filter((member) => member.sharingEnabled && member.latitude != null && member.longitude != null);
  return (
    <Card tone="secondary" style={{ gap: 12, paddingVertical: 26 }}>
      <AppText variant="section">Live location</AppText>
      <AppText variant="bodySmall" tone="muted">Open Togetherly on a supported device to view the live map.</AppText>
      {visible.length ? <View style={{ gap: 10 }}>{visible.map((member) => (
        <View key={member.userId} style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: participantPalette(member.participantColor).accent }} />
          <AppText>{member.displayName}</AppText>
        </View>
      ))}</View> : <AppText tone="secondary">No location is being shared.</AppText>}
    </Card>
  );
}
