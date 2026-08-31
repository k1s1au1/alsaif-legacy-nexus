export const FAMILY_OCCASION_EVENT_MARKER = "__familyOccasion";

export function encodeFamilyOccasionEventDescription<T extends object>(occasion: T) {
  return JSON.stringify({
    [FAMILY_OCCASION_EVENT_MARKER]: true,
    occasion,
  });
}

export function decodeFamilyOccasionEventDescription<T extends object>(
  description: string | null | undefined,
): T | null {
  if (!description) return null;

  try {
    const parsed: unknown = JSON.parse(description);
    if (!parsed || typeof parsed !== "object") return null;

    const payload = parsed as Record<string, unknown>;
    if (payload[FAMILY_OCCASION_EVENT_MARKER] !== true) return null;
    if (!payload.occasion || typeof payload.occasion !== "object") return null;

    return payload.occasion as T;
  } catch {
    return null;
  }
}

export function isFamilyOccasionEvent(event: {
  description?: string | null;
}) {
  return decodeFamilyOccasionEventDescription(event.description) !== null;
}
