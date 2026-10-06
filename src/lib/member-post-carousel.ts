export type CarouselPosition = { index: number; url: string | null };

/** Keep the current photo when a realtime update reorders the attachments. */
export function resolveCarouselIndex(
  images: readonly string[],
  position: CarouselPosition,
): number {
  if (images.length === 0) return 0;
  if (position.url && images[position.index] === position.url) return position.index;
  const retained = position.url ? images.indexOf(position.url) : -1;
  if (retained >= 0) return retained;
  return Math.max(0, Math.min(images.length - 1, Math.trunc(position.index) || 0));
}

export function moveCarousel(index: number, step: number, count: number): number {
  if (count <= 0) return 0;
  return (((index + step) % count) + count) % count;
}

/** A sliding window, rather than a row that grows with the attachment count. */
export function carouselIndicators(count: number, active: number): number[] {
  const length = Math.min(Math.max(0, count), 7);
  const start = Math.max(0, Math.min(active - Math.floor(length / 2), count - length));
  return Array.from({ length }, (_, index) => start + index);
}

/** Match the RTL arrows; a vertical scroll or small tap must not change photos. */
export function carouselSwipeStep(dx: number, dy: number): number {
  if (Math.abs(dx) < 42 || Math.abs(dx) < Math.abs(dy) * 1.4) return 0;
  return dx > 0 ? 1 : -1;
}

export function memberPostImages(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (url): url is string => typeof url === "string" && /^(https?:\/\/|\/(?!\/))/.test(url),
  );
}
