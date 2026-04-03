export const CONTEST_END = new Date('2026-05-01T23:59:59Z');

/** Human-readable short date, e.g. "May 1, 2026" */
export const CONTEST_END_LABEL = CONTEST_END.toLocaleDateString('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});
