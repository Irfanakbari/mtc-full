const DISPLAY_OPERATOR_PREFIX = /^\[Display operator:\s*([^\]]+)]\s*/i;

export function getDisplayOperator(notes: string | null): string | null {
  return notes?.match(DISPLAY_OPERATOR_PREFIX)?.[1]?.trim() || null;
}

export function getDisplayNotes(notes: string | null): string | null {
  if (!notes) return null;
  const cleaned = notes.replace(DISPLAY_OPERATOR_PREFIX, '').trim();
  return cleaned || null;
}
