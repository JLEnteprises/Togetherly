import type { Activity, Memory, Task } from '@/types/product';

export const demoCouple = {
  partnerA: 'Liam',
  partnerB: 'Partner',
  daysTogether: 187,
  nextVisitDays: 63,
  nextVisitDate: '22 Oct',
  partnerTime: '9:42 PM',
  partnerPlace: 'Illinois',
  localTime: '12:42 PM',
  localPlace: 'Brisbane',
};

export const demoTasks: Task[] = [
  { id: '1', title: 'Pick Halloween costumes', completed: false, assignee: 'Both', dueLabel: 'Tonight' },
  { id: '2', title: 'Add flight details', completed: false, assignee: 'Liam', dueLabel: 'This week' },
  { id: '3', title: 'Choose Saturday date', completed: true, assignee: 'Partner' },
];

export const demoActivities: Activity[] = [
  {
    id: '1',
    title: 'Stargazing Night',
    emoji: '✦',
    description: 'Blanket, hot drinks, a quiet spot, and a playlist you both know.',
    tags: ['ROMANTIC', 'OUTDOORS', 'FREE', 'NIGHT'],
    duration: '~2 hours',
    interested: 'Both interested',
  },
  {
    id: '2',
    title: 'Cook the Same Dinner',
    emoji: '◌',
    description: 'Pick one recipe, cook together on video, then compare the results.',
    tags: ['ONLINE', 'FOOD', 'COZY'],
    duration: '~1 hour',
    interested: 'Both interested',
  },
];

export const demoMemories: Memory[] = [
  { id: '1', title: 'First trip together', date: '28 Jul 2026', note: 'Ten days that went far too quickly.', emoji: '✈︎' },
  { id: '2', title: 'Our dinosaur beginning', date: 'The beginning', note: 'A silly game turned into something very real.', emoji: '◖' },
];
