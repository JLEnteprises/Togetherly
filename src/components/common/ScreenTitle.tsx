import { AppText } from './AppText';

// Keep the same type, casing and colour for section names on hubs and details.
// A single text flow wraps naturally with long names or larger accessibility text.
export function ScreenTitle({ title, parent }: { title: string; parent?: string }) {
  const context = parent?.trim();
  return (
    <AppText variant="section" accessibilityRole="header" style={{ flexShrink: 1 }}>
      {context && context.toLowerCase() !== title.trim().toLowerCase() ? `${context} / ` : ''}{title}
    </AppText>
  );
}
