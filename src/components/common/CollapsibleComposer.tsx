import type { ComponentProps } from 'react';
import { ComposerSheet } from './ComposerSheet';

export type CollapsibleComposerProps = ComponentProps<typeof ComposerSheet>;

// G6_COMPOSER_SHEETS: compatibility wrapper for older call sites; all composer behavior now lives in ComposerSheet.
export function CollapsibleComposer(props: CollapsibleComposerProps) {
  return <ComposerSheet {...props} />;
}
