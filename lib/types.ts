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
  /** Note for online pastoral care (older reports: free text naming who). */
  pastoralCare: string;
  /** Members picked for online pastoral care — missing on reports made before the picker. */
  pastoralCareIds?: number[];
  visits: { id: number | null; name: string; day: string; note: string }[];
  challenge: { ids: number[]; note: string };
  nextAgenda: string;
  improve: string;
  otherInfo: string;
  signature: string;
};

export type ReportRow = { id: number; shepherd_id: number; meeting_date: string; week_start: string; data: ReportData; created_at: string };

/** Spiritual milestones kept on a member's profile (each is a date). */
export const MILESTONES = [
  { key: 'joinedOn', label: 'Joined the church' },
  { key: 'bornAgainOn', label: 'Born again' },
  { key: 'waterBaptismOn', label: 'Water baptism' },
  { key: 'holySpiritOn', label: 'Holy Spirit baptism' },
  { key: 'foundationDoneOn', label: 'Completed foundation class' },
] as const;

export const PERSONAL_FIELDS = [
  { key: 'gender', label: 'Gender', options: ['Female', 'Male'] },
  { key: 'birthday', label: 'Birthday', date: true },
  { key: 'maritalStatus', label: 'Marital status', options: ['Single', 'Married', 'Widowed', 'Divorced', 'Separated'] },
  { key: 'occupation', label: 'Occupation' },
  { key: 'area', label: 'Area / where they live' },
  { key: 'department', label: 'Serving in (department)' },
] as const;

export type MilestoneKey = (typeof MILESTONES)[number]['key'];
export type PersonalKey = (typeof PERSONAL_FIELDS)[number]['key'];
export type ProfileDetails = Partial<Record<MilestoneKey | PersonalKey, string>>;

export const CARE_STATUS = [
  { value: 'urgent', label: 'Urgent', hint: 'Needs pastoral attention now' },
  { value: 'needs_care', label: 'Needs care', hint: 'Slipping — follow up this week' },
  { value: 'stable', label: 'Stable', hint: 'Steady, keep shepherding as usual' },
  { value: 'thriving', label: 'Thriving', hint: 'Consistent and growing' },
  { value: 'new', label: 'No data yet', hint: 'Not yet marked in any recent report' },
] as const;
export type CareStatus = (typeof CARE_STATUS)[number]['value'];

export const NOTE_KINDS = ['Phone call', 'Visit', 'Counselling', 'Prayer request', 'Follow-up', 'Other'] as const;

export type CareNote = { id: number; person_id: number; note_date: string; kind: string; note: string };
