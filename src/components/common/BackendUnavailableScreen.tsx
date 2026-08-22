import { View } from 'react-native';
import { AppScreen } from './AppScreen';
import { AppText } from './AppText';
import { AppButton } from './AppButton';
import { Card } from './Card';
import { useAppTheme } from '@/theme/useAppTheme';
export function BackendUnavailableScreen({ onRetry }: { message?: string; onRetry: () => void }) { const theme=useAppTheme(); return <AppScreen contentStyle={{ justifyContent:'center' }}><Card style={{ gap:theme.spacing.lg }}><View style={{gap:theme.spacing.sm}}><AppText variant="pageTitle">Can’t connect right now</AppText><AppText tone="secondary">Check your internet connection and try again. Your last loaded information may still be available offline.</AppText></View><AppButton label="Try again" onPress={onRetry} /></Card></AppScreen>; }
