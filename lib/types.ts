export const PERFORMANCE = [
  { value: 'excellent', label: 'Excellent', hint: 'High energy, deep vulnerability, great discourse' },
  { value: 'good', label: 'Good', hint: 'Steady engagement, productive discussion' },
  { value: 'fair', label: 'Fair', hint: 'Low engagement, conversations felt forced' },
  { value: 'difficult', label: 'Difficult', hint: 'High conflict, extreme distractions, low participation' },
] as const;

export const GOAL = [
  { value: 'yes', label: 'Yes, fully', hint: 'Core message well received and understood; steps were taken to apply it' },
  { value: 'partial', label: 'Partially', hint: 'We hit the topic but ran out of time, got sidetracked, or the leader had to attend to something' },
  { value: 'no', label: 'No', hint: 'Postponement or emergency' },
] as const;

export const SCALE = [
  { value: 3, hint: 'Everyone readily shared deeply' },
  { value: 2, hint: 'Just a few openly shared or interacted' },
  { value: 1, hint: 'Everyone had to be prompted to speak, but eventually did' },
  { value: 0, hint: 'No interaction; members refused to speak' },
] as const;

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

export type Highlight = { ids: number[]; note: string };
export type ReportData = {
  groupName: string;
  meetingDate: string;
  meetingTime: string;
  presentIds: number[];
  absentIds: number[];
  visitors: number;
  totalPresent: number;
  totalAbsent: number;
  performance: string;
  atmosphere: string;
  mainGoal: string;
  goalAchieved: string;
  goalSummary: string;
  participation: number;
  vulnerability: number;
  stoodOut: Highlight;
  lessInteractive: Highlight;
  deepQuestion: Highlight;
  neededExplanation: Highlight;
  pastoralCare: string;
  visits: { id: number | null; name: string; day: string; note: string }[];
  challenge: { ids: number[]; note: string };
  nextAgenda: string;
  improve: string;
  otherInfo: string;
  signature: string;
};

export type ReportRow = { id: number; shepherd_id: number; meeting_date: string; week_start: string; data: ReportData; created_at: string };
