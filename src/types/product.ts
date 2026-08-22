export type DashboardItem = {
  id: string;
  title: string;
  subtitle?: string;
};

export type Task = DashboardItem & {
  completed: boolean;
  assignee: 'Liam' | 'Partner' | 'Both';
  dueLabel?: string;
};

export type Activity = {
  id: string;
  title: string;
  emoji: string;
  description: string;
  tags: string[];
  duration: string;
  interested: 'Both interested' | 'Liam interested' | 'Partner interested';
};

export type Memory = {
  id: string;
  title: string;
  date: string;
  note: string;
  emoji: string;
};
