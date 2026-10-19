/** Fixed list of event tags. Users can't add their own (deliberate product decision). */
export const EVENT_KINDS = [
  'exam',
  'test',
  'presentation',
  'deadline',
  'appointment',
  'interview',
  'work',
  'sport',
  'social',
  'other',
] as const
export type EventKind = (typeof EVENT_KINDS)[number]

/** Rendered as a solid subject-coloured block and listed on the Exams page. */
export const ASSESSED_KINDS: readonly EventKind[] = ['exam', 'test', 'presentation']
/** Personal (non-school) events: neutral block with an ink rule, no subject. */
export const PERSONAL_KINDS: readonly EventKind[] = ['appointment', 'interview', 'work', 'sport', 'social']
/** Kinds that get an "in N days" countdown in Today / sidebar. */
export const COUNTDOWN_KINDS: readonly EventKind[] = ['exam', 'test', 'presentation', 'appointment', 'interview']

export const EVENT_KIND_LABELS: Record<EventKind, string> = {
  exam: 'Exam',
  test: 'Test',
  presentation: 'Presentation',
  deadline: 'Deadline',
  appointment: 'Appointment',
  interview: 'Interview',
  work: 'Work',
  sport: 'Sport',
  social: 'Social',
  other: 'Event',
}

/** Subject palette keys — the hex values live in src/styles/tokens.css (from Figma). */
export const SUBJECT_COLORS = [
  'blue', 'orange', 'violet', 'teal', 'green', 'amber', 'pink', 'brown',
  'red', 'cyan', 'lime', 'navy', 'plum', 'olive', 'slate', 'rose',
] as const
export type SubjectColor = (typeof SUBJECT_COLORS)[number]
