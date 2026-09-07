import { Alert, Image, Pressable, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAppTheme } from '@/theme/useAppTheme';
import { AppText } from './AppText';
import { AppButton } from './AppButton';
import { AppIcon } from '@/components/art/AppIcon';

export function MultiPhotoPickerField({ label, values, onChange, max = 8 }: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  max?: number;
}) {
  const theme = useAppTheme();

  async function pick() {
    if (values.length >= max) { Alert.alert('Photo limit reached', `A memory can contain up to ${max} photos.`); return; }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { Alert.alert('Photo access needed', 'Allow photo-library access to add images.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ allowsMultipleSelection: true, selectionLimit: max - values.length, quality: 0.35, base64: true });
    if (result.canceled) return;
    const added: string[] = [];
    for (const asset of result.assets) {
      const mime = asset.mimeType && ['image/jpeg', 'image/png', 'image/webp'].includes(asset.mimeType) ? asset.mimeType : 'image/jpeg';
      if (!asset.base64) continue;
      const dataUrl = `data:${mime};base64,${asset.base64}`;
      if (dataUrl.length <= 1_000_000) added.push(dataUrl);
    }
    if (!added.length) { Alert.alert('Couldn’t add those photos', 'Try smaller images or crop them first.'); return; }
    const next = [...values, ...added].slice(0, max);
    if (next.reduce((sum, value) => sum + value.length, 0) > 6_500_000) {
      Alert.alert('Photos are too large together', 'Remove one or two images, or choose smaller versions.');
      return;
    }
    onChange(next);
  }

  return <View style={{ gap: theme.spacing.sm }}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><AppText variant="caption" tone="secondary">{label}</AppText><AppText variant="caption" tone="muted">{values.length}/{max}</AppText></View>
    {values.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>{values.map((value, index) => <View key={`${value.slice(0, 30)}-${index}`} style={{ position: 'relative' }}><Image source={{ uri: value }} style={{ width: 86, height: 86, borderRadius: theme.radii.md, backgroundColor: theme.colors.elevatedBackground }} resizeMode="cover" /><Pressable accessibilityRole="button" accessibilityLabel={`Remove photo ${index + 1}`} onPress={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))} style={{ position: 'absolute', top: 4, right: 4, width: 26, height: 26, borderRadius: 13, backgroundColor: theme.colors.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.border }}><AppIcon name="close" size={14} color={theme.colors.textPrimary} /></Pressable></View>)}</View> : <AppText variant="bodySmall" tone="muted">Add up to {max} photos to this memory.</AppText>}
    <AppButton compact variant="secondary" label={values.length ? 'Add more photos' : 'Choose photos'} onPress={pick} disabled={values.length >= max} />
  </View>;
}
