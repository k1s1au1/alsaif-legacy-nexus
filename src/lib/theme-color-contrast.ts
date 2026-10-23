function channels(color: string) {
  return [1, 3, 5].map((offset) => parseInt(color.slice(offset, offset + 2), 16));
}

function luminance(color: string) {
  return channels(color)
    .map((value) => value / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
    .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
}

export function themeContrast(first: string, second: string) {
  const a = luminance(first);
  const b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Adjust the selected ink's shade only when its own container needs more contrast. */
export function readableThemeInk(preferred: string, background: string, minimum: number) {
  if (themeContrast(preferred, background) >= minimum) return preferred;
  const target = themeContrast("#000000", background) > themeContrast("#ffffff", background)
    ? 0 : 255;
  const source = channels(preferred);
  for (let step = 1; step <= 40; step++) {
    const candidate = `#${source.map((value) =>
      Math.round(value + (target - value) * step / 40).toString(16).padStart(2, "0"),
    ).join("")}`;
    if (themeContrast(candidate, background) >= minimum) return candidate;
  }
  return target ? "#ffffff" : "#000000";
}
