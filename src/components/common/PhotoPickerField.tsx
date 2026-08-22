import { Alert, Image, Pressable, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAppTheme } from '@/theme/useAppTheme';
import { AppText } from './AppText';
import { AppButton } from './AppButton';

export function PhotoPickerField({ label, value, onChange, circular = false }: {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  circular?: boolean;
}) {
  const theme = useAppTheme();

  async function pick() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Allow photo-library access to choose an image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: circular ? [1, 1] : [4, 3],
      quality: 0.45,
      base64: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) {
      Alert.alert('Couldn’t use that photo', 'Togetherly could not read that image. Try another photo.');
      return;
    }
    const mime = asset.mimeType && ['image/jpeg', 'image/png', 'image/webp'].includes(asset.mimeType) ? asset.mimeType : 'image/jpeg';
    if (!asset.base64) {
      Alert.alert('Couldn’t use that photo', 'Togetherly could not read that image. Try another photo.');
      return;
    }
    const dataUrl = `data:${mime};base64,${asset.base64}`;
    if (dataUrl.length > 1_000_000) {
      Alert.alert('Photo is too large', 'Choose a smaller photo or crop it more tightly.');
      return;
    }
    onChange(dataUrl);
  }

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <AppText variant="caption" tone="secondary">{label}</AppText>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Choose ${label.toLowerCase()}`} onPress={pick}>
          {value ? (
            <Image source={{ uri: value }} style={{ width: circular ? 84 : 112, height: 84, borderRadius: circular ? 42 : theme.radii.md, backgroundColor: theme.colors.elevatedBackground, borderWidth: 1, borderColor: theme.colors.border }} resizeMode="cover" />
          ) : (
            <View style={{ width: circular ? 84 : 112, height: 84, borderRadius: circular ? 42 : theme.radii.md, backgroundColor: theme.colors.elevatedBackground, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' }}>
              <AppText variant="section" tone="accent">＋</AppText>
              <AppText variant="caption" tone="muted">Photo</AppText>
            </View>
          )}
        </Pressable>
        <View style={{ flex: 1, gap: theme.spacing.sm }}>
          <AppButton compact variant={value ? 'ghost' : 'secondary'} label={value ? 'Change photo' : 'Choose photo'} onPress={pick} />
          {value ? <AppButton compact variant="ghost" label="Remove" onPress={() => onChange(null)} /> : null}
        </View>
      </View>
    </View>
  );
}
