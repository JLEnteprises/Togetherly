import type { ReactNode } from 'react';
import { AppText } from './AppText';

type Props = {
  children: ReactNode;
  tone?: 'accent' | 'secondary' | 'muted';
};

// E4_FINAL_VISUAL_CONSISTENCY: one eyebrow style keeps page, detail, and grouped-section hierarchy aligned.
export function EyebrowText({ children, tone = 'accent' }: Props) {
  return (
    <AppText
      variant="caption"
      tone={tone}
      style={{ textTransform: 'uppercase', letterSpacing: 1.1 }}
    >
      {children}
    </AppText>
  );
}
