import type { NeedValue } from '@/types/database';

export type MoodSupportSemantics = {
  needLabel: string;
  actionLabel: string;
  acknowledgedLabel: string;
  helper: string;
  secondaryLabel?: string;
  secondaryHref?: string;
};

const supportByNeed: Record<NeedValue, MoodSupportSemantics> = {
  affection: {
    needLabel: 'affection',
    actionLabel: 'Send some love',
    acknowledgedLabel: 'Love sent',
    helper: 'Meet the need they actually named instead of sending a generic acknowledgement.',
  },
  reassurance: {
    needLabel: 'reassurance',
    actionLabel: 'I’ve got you',
    acknowledgedLabel: 'Reassurance sent',
    helper: 'Acknowledge that you saw what they need and that you are with them in it.',
  },
  advice: {
    needLabel: 'advice',
    actionLabel: 'I can help',
    acknowledgedLabel: 'Support offered',
    helper: 'Let them know you are available to think it through with them.',
  },
  listen: {
    needLabel: 'someone to listen',
    actionLabel: 'I’ll listen',
    acknowledgedLabel: 'Listening offered',
    helper: 'Signal that they can talk without needing to solve anything first.',
  },
  distraction: {
    needLabel: 'a distraction',
    actionLabel: 'I’m here',
    acknowledgedLabel: 'Support sent',
    helper: 'You can also let Togetherly find something light for the two of you to do.',
    secondaryLabel: 'Find a distraction',
    secondaryHref: '/features/activity-randomizer?context=distraction',
  },
  space: {
    needLabel: 'some space',
    actionLabel: 'I’ll give you space',
    acknowledgedLabel: 'Space respected',
    helper: 'Acknowledge them without demanding another interaction right now.',
  },
  call: {
    needLabel: 'a call',
    actionLabel: 'I’ll call you',
    acknowledgedLabel: 'Call acknowledged',
    helper: 'Make the acknowledgement specific so they know you understood the request.',
  },
  nothing: {
    needLabel: 'nothing right now',
    actionLabel: 'Seen',
    acknowledgedLabel: 'Seen',
    helper: 'No response is required unless you want to send one.',
  },
};

export function moodSupportForNeed(need: NeedValue): MoodSupportSemantics {
  return supportByNeed[need];
}
