export const MEMBER_POST_PREVIEW_SIZE = 3;
export const MEMBER_POST_ROTATION_MS = 60_000;
export const PUBLIC_MEMBER_POST_KINDS = ["diary", "question", "photo"];

// Partial Fisher–Yates: constant memory even for a very large member corner.
function sampleIndices(total: number, size: number, random: () => number) {
  const swaps = new Map<number, number>();
  return Array.from({ length: Math.min(total, size) }, (_, index) => {
    const unit = Math.max(0, Math.min(1 - Number.EPSILON, random()));
    const picked = index + Math.floor(unit * (total - index));
    const value = swaps.get(picked) ?? picked;
    swaps.set(picked, swaps.get(index) ?? index);
    return value;
  });
}

/** Prefer unseen posts; with 4–5 posts, retain only the unavoidable overlap. */
export function sampleMemberPostOffsets(
  total: number,
  previous: readonly number[] = [],
  random: () => number = Math.random,
) {
  if (!Number.isSafeInteger(total) || total <= 0) return [];
  const size = Math.min(total, MEMBER_POST_PREVIEW_SIZE);
  const excluded = [...new Set(previous)]
    .filter((value) => Number.isInteger(value) && value >= 0 && value < total)
    .sort((a, b) => a - b);
  const available = total - excluded.length;
  const fresh = sampleIndices(available, size, random).map((index) => {
    let offset = index;
    for (const skipped of excluded) {
      if (skipped <= offset) offset += 1;
      else break;
    }
    return offset;
  });
  const overlap = sampleIndices(excluded.length, size - fresh.length, random)
    .map((index) => excluded[index]);
  return [...fresh, ...overlap];
}
