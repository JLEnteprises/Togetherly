import { AppScreen } from './AppScreen';
import { AppText } from './AppText';
import { Card } from './Card';
import { useAppTheme } from '@/theme/useAppTheme';
export function BackendSetupScreen() { const theme=useAppTheme(); return <AppScreen contentStyle={{ justifyContent:'center' }}><Card style={{ gap:theme.spacing.md }}><AppText variant="pageTitle">Togetherly needs an update</AppText><AppText tone="secondary">This build is missing its connection settings. Install the configured build for your Togetherly space, then open the app again.</AppText></Card></AppScreen>; }
