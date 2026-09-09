import { AppText } from './AppText';
export function DraftStatus({ status }: { status: 'loading' | 'saved' | 'saving' | 'error' }) {
  return <AppText variant="caption" tone={status === 'error' ? 'warning' : 'muted'} accessibilityLiveRegion="polite">
    {status === 'loading' ? 'Restoring draft…' : status === 'saving' ? 'Saving draft…' : status === 'saved' ? 'Draft saved on this device' : 'Draft could not be saved. Keep this screen open.'}
  </AppText>;
}
