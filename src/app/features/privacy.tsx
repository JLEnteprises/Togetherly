import { View } from 'react-native';
import { AppScreen } from '@/components/common/AppScreen';
import { BackHeader } from '@/components/common/BackHeader';
import { Card } from '@/components/common/Card';
import { AppText } from '@/components/common/AppText';
import { useAppTheme } from '@/theme/useAppTheme';

export default function PrivacyScreen() {
  const theme = useAppTheme();
  return (
    <AppScreen>
      <BackHeader eyebrow="Account" title="Privacy" subtitle="Choose what stays between you and what only you can see." />
      <View style={{ gap: theme.spacing.md }}>
        <Card tone="secondary" style={{ gap: 6 }}><AppText variant="cardTitle">🔒 Private notes</AppText><AppText tone="secondary">Only the person who created a private note can read or edit it.</AppText></Card>
        <Card tone="secondary" style={{ gap: 6 }}><AppText variant="cardTitle">🔒 Private check-ins</AppText><AppText tone="secondary">Private check-ins stay visible only to the person who created them. Shared check-ins appear to both of you.</AppText></Card>
        <Card style={{ gap: 6 }}><AppText variant="cardTitle">♥ Shared content</AppText><AppText tone="secondary">Tasks, lists, countdowns, events, goals, trips, activities, memories and shared notes belong to your linked couple space.</AppText></Card>
        <Card style={{ gap: 6 }}><AppText variant="cardTitle">Your account stays separate</AppText><AppText tone="secondary">Each person signs in separately. Leaving a couple space does not hand over your private notes or account credentials.</AppText></Card>
      </View>
    </AppScreen>
  );
}
